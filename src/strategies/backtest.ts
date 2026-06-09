import type { Table } from "../registry/schema.js";
import { rowCount } from "../registry/schema.js";
import { checkConsistentLength } from "../platform/validate.js";
import { selectRows, sortByIndex } from "../platform/frame.js";
import { TimeSeriesSplit } from "../platform/chrono.js";
import type { BaseBettor } from "./base.js";

export type BacktestRow = Record<string, string | number>;

export function backtest(
  bettor: BaseBettor,
  X: Table,
  Y: Table,
  O: Table,
  cv: TimeSeriesSplit | null = null,
): BacktestRow[] {
  checkConsistentLength(rowCount(X), rowCount(Y), rowCount(O));
  if (!X.index.every((d) => d instanceof Date)) {
    throw new TypeError("Input data `X` should be a table with a date index.");
  }

  const sorted = sortByIndex(X);
  const order = X.index.map((d, i) => [d.getTime(), i] as const).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
  const Xs = selectRows(X, order);
  const Ys = selectRows(Y, order);
  const Os = selectRows(O, order);

  const splitter = cv ?? new TimeSeriesSplit();
  const splits = splitter.split(rowCount(Xs));

  return splits.map(([trainIdx, testIdx]) => {
    const clone = Object.create(Object.getPrototypeOf(bettor)) as BaseBettor;
    Object.assign(clone, bettor);
    clone.fit(
      selectRows(Xs, trainIdx),
      selectRows(Ys, trainIdx),
      selectRows(Os, trainIdx),
    );
    const valueBets = clone.bet(selectRows(Xs, testIdx), selectRows(Os, testIdx));
    const yTest = selectRows(Ys, testIdx);
    const oTest = selectRows(Os, testIdx);

    const yCols = clone.featureNamesOut_;
    const oCols = clone.featureNamesOdds_;
    const returns: number[][] = valueBets.map((row, i) =>
      row.map((bet, j) => {
        if (!bet) return 0;
        const y = yTest.columns[yCols[j]!]?.[i];
        const o = oTest.columns[oCols[j]!]?.[i];
        return (Number(y) * Number(o) - 1) || 0;
      }),
    );
    const flat = returns.flat().filter((r) => r !== 0);
    const nBets = returns.map((row) => row.filter((r) => r !== 0).length);
    const totalBets = nBets.reduce((a, b) => a + b, 0);

    const row: BacktestRow = {
      "Training start": Xs.index[trainIdx[0]!]!.toISOString().slice(0, 10),
      "Training end": Xs.index[trainIdx[trainIdx.length - 1]!]!.toISOString().slice(0, 10),
      "Testing start": Xs.index[testIdx[0]!]!.toISOString().slice(0, 10),
      "Testing end": Xs.index[testIdx[testIdx.length - 1]!]!.toISOString().slice(0, 10),
      "Number of betting days": new Set(testIdx.map((i) => Xs.index[i]!.toDateString())).size,
      "Number of bets": totalBets,
      "Yield percentage per bet": flat.length ? Math.round(100 * (flat.reduce((a, b) => a + b, 0) / flat.length) * 10) / 10 : 0,
      "ROI percentage": Math.round(100 * clone.stake_ * flat.reduce((a, b) => a + b, 0) / clone.initCash_ * 10) / 10,
      "Final cash": clone.initCash_ + clone.stake_ * flat.reduce((a, b) => a + b, 0),
    };

    for (let j = 0; j < clone.bettingMarkets_.length; j++) {
      const market = clone.bettingMarkets_[j]!;
      const marketReturns = returns.map((row) => row[j] ?? 0).filter((r) => r !== 0);
      row[`Number of bets (${market})`] = marketReturns.length;
      row[`Yield percentage per bet (${market})`] =
        marketReturns.length
          ? Math.round(100 * (marketReturns.reduce((a, b) => a + b, 0) / marketReturns.length) * 10) / 10
          : 0;
    }
    return row;
  });
}
