#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { OddsComparisonBettor, backtest } from "../src/strategies/index.js";
import type { Table } from "../src/registry/schema.js";
import { columnNames } from "../src/registry/schema.js";
import { backtestCacheKey, valueBetsCacheKey } from "../src/platform/cache/keys.js";
import { cacheFlushNamespace, cacheGet, cacheSet } from "../src/platform/cache/store.js";
import { closeRedisClient, isRedisEnabled, pingRedis } from "../src/platform/cache/redis.js";
import { TimeSeriesSplit } from "../src/platform/chrono.js";
import {
  createDataLoader,
  loadMatchOddsData,
  type MatchOddsSource,
} from "../src/extractors/loadMatchOdds.js";
import { DummySoccerDataLoader } from "../src/extractors/dummySoccer.js";
import { SoccerDataLoader } from "../src/extractors/soccerRemote.js";
import type { Param } from "../src/registry/schema.js";
import { predictMatch } from "../src/predict/matchPredictor.js";

const logger = {
  info: (msg: unknown) => console.log(typeof msg === "string" ? msg : JSON.stringify(msg, null, 2)),
};

function parsePredictTeams(args: string[]): { home: string; away: string } {
  const homeFlag = getFlagValue(args, "--home");
  const awayFlag = getFlagValue(args, "--away");
  if (homeFlag && awayFlag) return { home: homeFlag, away: awayFlag };

  const positional = args.filter((a) => !a.startsWith("--") && a !== "predict");
  if (positional.length >= 2) {
    return { home: positional[0]!, away: positional[1]! };
  }

  throw new Error("Usage: npm run toolbox -- predict <home> <away>  OR  --home TeamA --away TeamB");
}

function printUsage(): void {
  logger.info(`
${chalk.bold("toolbox")} — Soccer match prediction toolbox

Primary workflow:
  npm run toolbox -- predict <home-team> <away-team> [--source dummy|remote|file]
  npm run toolbox -- predict --home Arsenal --away Chelsea [--no-ai]

Output: home win %, draw %, away win %, and confidence (AI when OPENAI_API_KEY is set).

Other commands:
  npm run toolbox -- data load [--source dummy|remote|file] [--file path] [--odds-type name]
                    [--league name] [--division n] [--year n] [--no-cache]
  npm run toolbox -- data params [--source dummy|remote]
  npm run toolbox -- data odds [--source dummy|remote|file] [--file path] [--league ...]
  npm run toolbox -- data export [--out dir] [--source ...] [--odds-type name] [--no-cache]
  npm run toolbox -- strategy backtest [--out dir] [--source ...] [--odds-type name] [--no-cache]
  npm run toolbox -- strategy picks [--source ...] [--odds-type name] [--no-cache]
  npm run toolbox -- cache ping
  npm run toolbox -- cache flush

Data sources:
  --source dummy   Built-in sample matches (default)
  --source remote  Download CSVs from georgedouzas/sports-betting on GitHub
  --source file    Local CSV (--file required); see guide/extractors.md
`);
}

function tableToCsv(table: Table, name: string): string {
  const cols = columnNames(table);
  const header = ["date", ...cols].join(",");
  const rows = table.index.map((date, i) =>
    [date.toISOString().slice(0, 10), ...cols.map((c) => String(table.columns[c]?.[i] ?? ""))].join(","),
  );
  return `# ${name}\n${header}\n${rows.join("\n")}\n`;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function getFlagValue(args: string[], flag: string): string | null {
  const idx = args.indexOf(flag);
  return idx >= 0 ? (args[idx + 1] ?? null) : null;
}

function parseSource(args: string[]): MatchOddsSource {
  const raw = getFlagValue(args, "--source") ?? "dummy";
  if (raw === "dummy" || raw === "remote" || raw === "file") return raw;
  throw new Error(`Invalid --source '${raw}'. Use dummy, remote, or file.`);
}

function parseParams(args: string[]): Param | undefined {
  const league = getFlagValue(args, "--league");
  const division = getFlagValue(args, "--division");
  const year = getFlagValue(args, "--year");
  if (!league && !division && !year) return undefined;
  const params: Param = {};
  if (league) params.league = league;
  if (division) params.division = Number(division);
  if (year) params.year = Number(year);
  return params;
}

function parseDataOptions(args: string[]) {
  return {
    source: parseSource(args),
    file: getFlagValue(args, "--file") ?? undefined,
    params: parseParams(args),
    useCache: !hasFlag(args, "--no-cache"),
    oddsType: getFlagValue(args, "--odds-type") ?? "williamhill",
  };
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const outIdx = args.indexOf("--out");
  const outDir = outIdx >= 0 ? args[outIdx + 1] : null;

  if (args[0] === "predict") {
    const { home, away } = parsePredictTeams(args);
    const dataOpts = parseDataOptions(args);
    const result = await predictMatch(home, away, {
      ...dataOpts,
      useAi: !hasFlag(args, "--no-ai"),
    });
    logger.info({
      match: `${result.homeTeam} vs ${result.awayTeam}`,
      homeWin: pct(result.homeWin),
      draw: pct(result.draw),
      awayWin: pct(result.awayWin),
      confidence: pct(result.confidence),
      model: result.model,
      dataSource: dataOpts.source,
      resolvedTeams: {
        home: result.resolvedHome,
        away: result.resolvedAway,
      },
      historicalSamples: result.context,
      reasoning: result.reasoning,
    });
    return;
  }

  if (args[0] === "cache" && args[1] === "ping") {
    if (!isRedisEnabled()) {
      logger.info(chalk.yellow("Redis is disabled. Set REDIS_URL or REDIS_HOST to enable."));
      return;
    }
    const ok = await pingRedis();
    logger.info(ok ? chalk.green("Redis PONG") : chalk.red("Redis unreachable"));
    return;
  }

  if (args[0] === "cache" && args[1] === "flush") {
    const removed = await cacheFlushNamespace();
    logger.info(chalk.green(`Flushed ${removed} Redis key(s) with sportsbet prefix`));
    return;
  }

  if (args[0] === "data" && args[1] === "params") {
    const source = parseSource(args);
    const LoaderClass = source === "remote" ? SoccerDataLoader : DummySoccerDataLoader;
    logger.info(JSON.stringify(LoaderClass.getAllParams(), null, 2));
    return;
  }

  if (args[0] === "data" && args[1] === "load") {
    const opts = parseDataOptions(args);
    const data = await loadMatchOddsData(opts);
    const [X, Y, O] = data.train;
    const [XFix] = data.fixtures;
    logger.info({
      source: data.meta.source,
      oddsType: opts.oddsType,
      availableOddsTypes: data.meta.oddsTypes,
      trainRows: data.meta.trainRows,
      fixtureRows: data.meta.fixtureRows,
      featureColumns: columnNames(X).length,
      outcomeColumns: columnNames(Y),
      oddsColumns: O ? columnNames(O) : [],
      nextFixtures: XFix.index.slice(0, 3).map((d, i) => ({
        date: d.toISOString().slice(0, 10),
        home: XFix.columns.home_team?.[i],
        away: XFix.columns.away_team?.[i],
      })),
    });
    return;
  }

  if (args[0] === "data" && args[1] === "odds") {
    const opts = parseDataOptions(args);
    const loader = await createDataLoader(opts);
    logger.info(JSON.stringify(loader.getOddsTypes(), null, 2));
    return;
  }

  if (args[0] === "data" && args[1] === "export") {
    const opts = parseDataOptions(args);
    const [X, Y, O] = (await loadMatchOddsData(opts)).train;
    if (outDir) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, "X_train.csv"), tableToCsv(X, "X_train"));
      writeFileSync(join(outDir, "Y_train.csv"), tableToCsv(Y, "Y_train"));
      if (O) writeFileSync(join(outDir, "O_train.csv"), tableToCsv(O, "O_train"));
      logger.info(chalk.green(`Training data written to ${outDir}`));
    } else {
      logger.info({ rows: X.index.length, markets: columnNames(Y), oddsType: opts.oddsType, source: opts.source });
    }
    return;
  }

  if (args[0] === "strategy" && args[1] === "backtest") {
    const opts = parseDataOptions(args);
    const { oddsType } = opts;
    const alpha = 0.03;
    const splits = 2;
    const cacheKey = backtestCacheKey(oddsType, alpha, splits);

    if (opts.useCache) {
      const cached = await cacheGet<ReturnType<typeof backtest>>(cacheKey);
      if (cached) {
        logger.info(chalk.cyan("(cached)"));
        if (outDir) {
          mkdirSync(outDir, { recursive: true });
          writeFileSync(join(outDir, "backtest.json"), JSON.stringify(cached, null, 2));
          logger.info(chalk.green(`Backtest results written to ${outDir}/backtest.json`));
        } else {
          logger.info(JSON.stringify(cached, null, 2));
        }
        return;
      }
    }

    const { train } = await loadMatchOddsData(opts);
    const [X, Y, O] = train;
    if (!O) throw new Error("Odds required for backtest.");
    const bettor = new OddsComparisonBettor([oddsType], alpha);
    const results = backtest(bettor, X, Y, O, new TimeSeriesSplit(splits));

    if (opts.useCache) await cacheSet(cacheKey, results);

    if (outDir) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, "backtest.json"), JSON.stringify(results, null, 2));
      logger.info(chalk.green(`Backtest results written to ${outDir}/backtest.json`));
    } else {
      logger.info(JSON.stringify(results, null, 2));
    }
    return;
  }

  if (args[0] === "strategy" && args[1] === "picks") {
    const opts = parseDataOptions(args);
    const { oddsType } = opts;
    const alpha = 0.03;
    const cacheKey = valueBetsCacheKey(oddsType, alpha);

    if (opts.useCache) {
      const cached = await cacheGet<{ valueBets: unknown }>(cacheKey);
      if (cached) {
        logger.info(chalk.cyan("(cached)"));
        logger.info(JSON.stringify(cached, null, 2));
        return;
      }
    }

    const data = await loadMatchOddsData(opts);
    const [XTrain, YTrain, OTrain] = data.train;
    const [XFix, , OFix] = data.fixtures;
    if (!OTrain || !OFix) throw new Error("Odds required for betting.");
    const bettor = new OddsComparisonBettor([oddsType], alpha);
    bettor.fit(XTrain, YTrain);
    const valueBets = bettor.bet(XFix, OFix);
    const payload = { source: data.meta.source, oddsType, valueBets };

    if (opts.useCache) await cacheSet(cacheKey, payload);
    logger.info(JSON.stringify(payload, null, 2));
    return;
  }

  printUsage();
  process.exit(1);
}

main()
  .catch((err: unknown) => {
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(1);
  })
  .finally(async () => {
    await closeRedisClient();
  });
