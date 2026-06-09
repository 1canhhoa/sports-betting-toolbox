#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { DummySoccerDataLoader } from "../src/extractors/dummySoccer.js";
import { OddsComparisonBettor, backtest } from "../src/strategies/index.js";
import type { Table } from "../src/registry/schema.js";
import { columnNames } from "../src/registry/schema.js";
import { backtestCacheKey, valueBetsCacheKey } from "../src/platform/cache/keys.js";
import { cacheFlushNamespace, cacheGet, cacheSet } from "../src/platform/cache/store.js";
import { closeRedisClient, isRedisEnabled, pingRedis } from "../src/platform/cache/redis.js";
import { TimeSeriesSplit } from "../src/platform/chrono.js";

const logger = {
  info: (msg: unknown) => console.log(typeof msg === "string" ? msg : JSON.stringify(msg, null, 2)),
};

function printUsage(): void {
  logger.info(`
${chalk.bold("toolbox")} — Modular sports betting toolbox

Usage:
  npm run toolbox -- data params
  npm run toolbox -- data odds
  npm run toolbox -- data export [--out dir] [--no-cache]
  npm run toolbox -- strategy backtest [--out dir] [--no-cache]
  npm run toolbox -- strategy picks [--no-cache]
  npm run toolbox -- cache ping
  npm run toolbox -- cache flush
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const useCache = !hasFlag(args, "--no-cache");
  const dataloader = new DummySoccerDataLoader();
  const outIdx = args.indexOf("--out");
  const outDir = outIdx >= 0 ? args[outIdx + 1] : null;

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
    logger.info(JSON.stringify(DummySoccerDataLoader.getAllParams(), null, 2));
    return;
  }

  if (args[0] === "data" && args[1] === "odds") {
    logger.info(JSON.stringify(dataloader.getOddsTypes(), null, 2));
    return;
  }

  if (args[0] === "data" && args[1] === "export") {
    const [X, Y, O] = dataloader.extractTrainData(0, "williamhill");
    if (outDir) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, "X_train.csv"), tableToCsv(X, "X_train"));
      writeFileSync(join(outDir, "Y_train.csv"), tableToCsv(Y, "Y_train"));
      if (O) writeFileSync(join(outDir, "O_train.csv"), tableToCsv(O, "O_train"));
      logger.info(chalk.green(`Training data written to ${outDir}`));
    } else {
      logger.info({ rows: X.index.length, markets: columnNames(Y), cache: useCache });
    }
    return;
  }

  if (args[0] === "strategy" && args[1] === "backtest") {
    const oddsType = "williamhill";
    const alpha = 0.03;
    const splits = 2;
    const cacheKey = backtestCacheKey(oddsType, alpha, splits);

    if (useCache) {
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

    const [X, Y, O] = dataloader.extractTrainData(0, oddsType);
    if (!O) throw new Error("Odds required for backtest.");
    const bettor = new OddsComparisonBettor([oddsType], alpha);
    const results = backtest(bettor, X, Y, O, new TimeSeriesSplit(splits));

    if (useCache) await cacheSet(cacheKey, results);

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
    const oddsType = "williamhill";
    const alpha = 0.03;
    const cacheKey = valueBetsCacheKey(oddsType, alpha);

    if (useCache) {
      const cached = await cacheGet<{ valueBets: unknown }>(cacheKey);
      if (cached) {
        logger.info(chalk.cyan("(cached)"));
        logger.info(JSON.stringify(cached, null, 2));
        return;
      }
    }

    const [XTrain, YTrain, OTrain] = dataloader.extractTrainData(0, oddsType);
    const [XFix, , OFix] = dataloader.extractFixturesData();
    if (!OTrain || !OFix) throw new Error("Odds required for betting.");
    const bettor = new OddsComparisonBettor([oddsType], alpha);
    bettor.fit(XTrain, YTrain);
    const valueBets = bettor.bet(XFix, OFix);
    const payload = { valueBets };

    if (useCache) await cacheSet(cacheKey, payload);
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
