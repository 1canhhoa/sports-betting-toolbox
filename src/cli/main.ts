#!/usr/bin/env node
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import chalk from "chalk";
import { DummySoccerDataLoader } from "../datasets/dummySoccerDataLoader.js";
import { OddsComparisonBettor, backtest } from "../evaluation/index.js";
import type { Table } from "../types.js";
import { columnNames } from "../types.js";
import { TimeSeriesSplit } from "../utils/timeSeriesSplit.js";

function printUsage(): void {
  console.log(`
${chalk.bold("sportsbet")} — TypeScript sports betting CLI

Usage:
  npm run sportsbet -- dataloader params
  npm run sportsbet -- dataloader odds-types
  npm run sportsbet -- dataloader training [--out dir]
  npm run sportsbet -- bettor backtest [--out dir]
  npm run sportsbet -- bettor bet [--out dir]
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

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const dataloader = new DummySoccerDataLoader();
  const outIdx = args.indexOf("--out");
  const outDir = outIdx >= 0 ? args[outIdx + 1] : null;

  if (args[0] === "dataloader" && args[1] === "params") {
    console.log(JSON.stringify(DummySoccerDataLoader.getAllParams(), null, 2));
    return;
  }

  if (args[0] === "dataloader" && args[1] === "odds-types") {
    console.log(JSON.stringify(dataloader.getOddsTypes(), null, 2));
    return;
  }

  if (args[0] === "dataloader" && args[1] === "training") {
    const [X, Y, O] = dataloader.extractTrainData(0, "williamhill");
    if (outDir) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, "X_train.csv"), tableToCsv(X, "X_train"));
      writeFileSync(join(outDir, "Y_train.csv"), tableToCsv(Y, "Y_train"));
      if (O) writeFileSync(join(outDir, "O_train.csv"), tableToCsv(O, "O_train"));
      console.log(chalk.green(`Training data written to ${outDir}`));
    } else {
      console.log({ rows: X.index.length, markets: columnNames(Y) });
    }
    return;
  }

  if (args[0] === "bettor" && args[1] === "backtest") {
    const [X, Y, O] = dataloader.extractTrainData(0, "williamhill");
    if (!O) throw new Error("Odds required for backtest.");
    const bettor = new OddsComparisonBettor(["williamhill"], 0.03);
    const results = backtest(bettor, X, Y, O, new TimeSeriesSplit(2));
    if (outDir) {
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, "backtest.json"), JSON.stringify(results, null, 2));
      console.log(chalk.green(`Backtest results written to ${outDir}/backtest.json`));
    } else {
      console.log(JSON.stringify(results, null, 2));
    }
    return;
  }

  if (args[0] === "bettor" && args[1] === "bet") {
    const [XTrain, YTrain, OTrain] = dataloader.extractTrainData(0, "williamhill");
    const [XFix, , OFix] = dataloader.extractFixturesData();
    if (!OTrain || !OFix) throw new Error("Odds required for betting.");
    const bettor = new OddsComparisonBettor(["williamhill"], 0.03);
    bettor.fit(XTrain, YTrain);
    const valueBets = bettor.bet(XFix, OFix);
    console.log(JSON.stringify({ valueBets }, null, 2));
    return;
  }

  printUsage();
  process.exit(1);
}

main().catch((err: unknown) => {
  console.error(chalk.red(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
