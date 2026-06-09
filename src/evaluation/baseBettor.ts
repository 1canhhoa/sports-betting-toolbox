import type { BoolMatrix, NumericMatrix, Table } from "../types.js";
import { columnNames, rowCount } from "../types.js";
import {
  checkConsistentLength,
  checkScalar,
  nanToNum,
  sumAxis,
} from "../utils/validation.js";
import {
  groupSumByDate,
  selectColumns,
  selectRows,
  toBoolMatrix,
  toNumericMatrix,
} from "../utils/table.js";

export const COMPLEMENTARY_EVENTS = [
  ["home_win__full_time_goals", "draw__full_time_goals", "away_win__full_time_goals"],
  ["over_2.5__full_time_goals", "under_2.5__full_time_goals"],
  ["over_3.5__full_time_goals", "under_3.5__full_time_goals"],
];

const TOL = 1e-6;

export abstract class BaseBettor {
  bettingMarkets: string[] | null;
  initCash: number | null;
  stake: number | null;

  bettingMarkets_!: string[];
  initCash_!: number;
  stake_!: number;
  featureNamesOut_!: string[];
  featureNamesOdds_!: string[];
  fitted = false;

  constructor(
    bettingMarkets: string[] | null = null,
    initCash: number | null = null,
    stake: number | null = null,
  ) {
    this.bettingMarkets = bettingMarkets;
    this.initCash = initCash;
    this.stake = stake;
  }

  protected abstract fitInternal(X: Table, Y: Table, O: Table | null): this;
  protected abstract predictProbaInternal(X: Table): NumericMatrix;

  protected getFeatureNamesOdds(O: Table): string[] {
    return columnNames(O).filter((col) => {
      const market = col.split("__").slice(2).join("__");
      return this.bettingMarkets_.includes(market);
    });
  }

  protected check(X: Table, Y: Table, O: Table | null, yBettingMarkets: string[]): void {
    if (this.bettingMarkets === null) {
      this.bettingMarkets_ = columnNames(Y).map((col) => col.replace("output__", ""));
    } else if (
      !Array.isArray(this.bettingMarkets) ||
      this.bettingMarkets.length === 0
    ) {
      throw new TypeError("Parameter `bettingMarkets` should be a list of betting market names.");
    } else if (!this.bettingMarkets.every((m) => yBettingMarkets.includes(m))) {
      throw new ValueError("Parameter `bettingMarkets` does not contain valid names.");
    } else {
      this.bettingMarkets_ = [...this.bettingMarkets];
    }

    this.initCash_ = checkScalar(this.initCash ?? 1e4, "init_cash", { min: 0 });
    this.stake_ = checkScalar(this.stake ?? 50, "stake", { min: 0 });

    this.featureNamesOut_ = columnNames(Y).filter((col) => {
      const market = col.split("__").slice(1).join("__");
      return this.bettingMarkets_.includes(market);
    });
    if (O !== null) {
      this.featureNamesOdds_ = this.getFeatureNamesOdds(O);
    }
  }

  protected validateXY(X: Table, Y: Table): [Table, Table, string[]] {
    checkConsistentLength(rowCount(X), rowCount(Y));
    if (!X.index.every((d) => d instanceof Date && !Number.isNaN(d.getTime()))) {
      throw new TypeError("Input data `X` should be a table with a date index.");
    }
    const yCols = columnNames(Y).map((c) => c.split("__"));
    if (!yCols.every((t) => t.length === 3)) {
      throw new ValueError(
        "Output data column names should follow a naming convention of the form `output__{betting_market_prefix}__{betting_market_target}`",
      );
    }
    if (!yCols.every((t) => t[0] === "output")) {
      throw new ValueError("Prefixes of output data column names should be equal to `output`.");
    }
    const markets = yCols.map((t) => t.slice(1).join("__"));
    return [X, Y, markets];
  }

  protected validateXO(X: Table, O: Table): [Table, Table, string[]] {
    checkConsistentLength(rowCount(X), rowCount(O));
    if (!X.index.every((d) => d instanceof Date && !Number.isNaN(d.getTime()))) {
      throw new TypeError("Input data `X` should be a table with a date index.");
    }
    const oCols = columnNames(O).map((c) => c.split("__"));
    if (!oCols.every((t) => t.length === 4)) {
      throw new ValueError(
        "Odds data column names should follow a naming convention of the form `odds__{bookmaker}__{betting_market_prefix}__{betting_market_target}`",
      );
    }
    if (!oCols.every((t) => t[0] === "odds")) {
      throw new ValueError("Prefixes of odds data column names should be equal to `odds`.");
    }
    const bookmakers = new Set(oCols.map((t) => t[1]!));
    if (bookmakers.size !== 1) {
      throw new ValueError("Bookmakers of odds data column names should be unique.");
    }
    const markets = oCols.map((t) => t.slice(2).join("__"));
    return [X, O, markets];
  }

  protected normalizeProba(YProbaPred: NumericMatrix): NumericMatrix {
    const result = YProbaPred.map((row) => [...row]);
    for (const events of COMPLEMENTARY_EVENTS) {
      if (events.every((e) => this.bettingMarkets_.includes(e))) {
        const indices = this.bettingMarkets_.map((m, i) => (events.includes(m) ? i : -1)).filter((i) => i >= 0);
        for (let r = 0; r < result.length; r++) {
          let sum = indices.reduce((acc, j) => acc + (result[r]![j] ?? 0), 0);
          if (sum === 0) sum = TOL;
          for (const j of indices) {
            result[r]![j] = (result[r]![j] ?? 0) / sum;
          }
        }
      }
    }
    return result;
  }

  fit(X: Table, Y: Table, O: Table | null = null): this {
    const [, , yMarkets] = this.validateXY(X, Y);
    if (O !== null) {
      const [, , oMarkets] = this.validateXO(X, O);
      if (JSON.stringify(yMarkets) !== JSON.stringify(oMarkets)) {
        throw new ValueError("Output and odds data column names are not compatible.");
      }
    }
    this.check(X, Y, O, yMarkets);
    const ySubset = selectColumns(Y, this.featureNamesOut_);
    const oSubset = O !== null ? selectColumns(O, this.featureNamesOdds_) : null;
    this.fitInternal(X, ySubset, oSubset);
    this.fitted = true;
    return this;
  }

  predictProba(X: Table): NumericMatrix {
    if (!this.fitted) throw new Error("Bettor is not fitted.");
    if (rowCount(X) === 0) return [];
    let proba = this.predictProbaInternal(X);
    if (proba[0]?.length !== this.bettingMarkets_.length) {
      throw new TypeError(
        "Predicted probabilities and selected betting markets have incompatible shapes.",
      );
    }
    return this.normalizeProba(proba);
  }

  predict(X: Table): BoolMatrix {
    return this.predictProba(X).map((row) => row.map((p) => p > 0.5));
  }

  bet(X: Table, O: Table): BoolMatrix {
    const YProbaPred = this.predictProba(X);
    const [, OValidated, oMarkets] = this.validateXO(X, O);
    if (!this.bettingMarkets_.every((m) => oMarkets.includes(m))) {
      throw new ValueError("Odds data do not include selected betting markets.");
    }
    const oddsColNames = this.featureNamesOdds_ ?? this.getFeatureNamesOdds(OValidated);
    const OSubset = selectColumns(OValidated, oddsColNames);
    const odds = toNumericMatrix(OSubset, oddsColNames);
    const BPred = YProbaPred.map((row, i) =>
      row.map((p, j) => p * (odds[i]?.[j] ?? NaN) > 1),
    );

    const selected: BoolMatrix[] = [];
    for (const events of COMPLEMENTARY_EVENTS) {
      const eventIndices = this.bettingMarkets_
        .map((m, i) => (events.includes(m) ? i : -1))
        .filter((i) => i >= 0);
      if (eventIndices.length === 0) continue;
      const BEvents = BPred.map((row) => eventIndices.map((j) => row[j]!));
      const estimatedReturns = BPred.map((_, i) =>
        eventIndices.map((j, k) => {
          const o = odds[i]?.[j] ?? 0;
          const p = YProbaPred[i]?.[j] ?? 0;
          return o * p - 1 + k * TOL;
        }),
      );
      const maxReturns = estimatedReturns.map((row) => Math.max(...row));
      const masked = BEvents.map((row, i) =>
        row.map((b, j) => b && estimatedReturns[i]![j] === maxReturns[i]),
      );
      const fullRow = BPred.map(() => this.bettingMarkets_.map(() => false));
      for (let r = 0; r < masked.length; r++) {
        for (let k = 0; k < eventIndices.length; k++) {
          fullRow[r]![eventIndices[k]!] = masked[r]![k]!;
        }
      }
      selected.push(fullRow);
    }

    if (selected.length === 0) return BPred;
    return BPred.map((_, i) =>
      this.bettingMarkets_.map((_, j) => selected.some((block) => block[i]![j])),
    );
  }

  score(X: Table, Y: Table, O: Table): number {
    if (!this.fitted) throw new Error("Bettor is not fitted.");
    const [, Yv, yMarkets] = this.validateXY(X, Y);
    const [, Ov, oMarkets] = this.validateXO(X, O);
    if (JSON.stringify(yMarkets) !== JSON.stringify(oMarkets)) {
      throw new ValueError("Output and odds data column names are not compatible.");
    }
    const yMat = toNumericMatrix(selectColumns(Yv, this.featureNamesOut_), this.featureNamesOut_);
    const oMat = toNumericMatrix(selectColumns(Ov, this.featureNamesOdds_), this.featureNamesOdds_);
    const bets = this.bet(X, O);
    const returns = sumAxis(
      yMat.map((row, i) =>
        row.map((y, j) => (bets[i]?.[j] ? y * (oMat[i]?.[j] ?? 0) - 1 : 0)),
      ),
      1,
    );
    const daily = groupSumByDate(X.index, nanToNum(returns));
    const values = [...daily.values()];
    const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
    const variance =
      values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length || 1);
    const std = Math.sqrt(variance);
    if (std === 0 || Number.isNaN(std)) {
      return mean > 0 ? 100 : -100;
    }
    return Math.sqrt(365) * (mean / std);
  }
}

export class ValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValueError";
  }
}

export function saveBettor(_bettor: BaseBettor, _path: string): void {
  throw new Error("saveBettor serialization is not yet implemented.");
}

export function loadBettor(_path: string): BaseBettor {
  throw new Error("loadBettor deserialization is not yet implemented.");
}
