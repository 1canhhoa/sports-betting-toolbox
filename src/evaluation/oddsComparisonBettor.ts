import type { NumericMatrix, Table } from "../types.js";
import { columnNames } from "../types.js";
import { checkScalar } from "../utils/validation.js";
import { rowMeans, selectColumns } from "../utils/table.js";
import { BaseBettor } from "./baseBettor.js";

export class OddsComparisonBettor extends BaseBettor {
  oddsTypes: string[] | null;
  alpha: number;

  oddsTypes_!: string[];
  alpha_!: number;
  outputKeys_!: string[];

  constructor(
    oddsTypes: string[] | null = null,
    alpha = 0.05,
    bettingMarkets: string[] | null = null,
    initCash: number | null = null,
    stake: number | null = null,
  ) {
    super(bettingMarkets, initCash, stake);
    this.oddsTypes = oddsTypes;
    this.alpha = alpha;
  }

  protected checkOddsTypes(X: Table): void {
    const available = [
      ...new Set(
        columnNames(X)
          .filter((c) => c.startsWith("odds__"))
          .map((c) => c.split("__")[1]!),
      ),
    ];
    if (available.length === 0) {
      throw new ValueError("Input data do not include any odds columns.");
    }
    const msg = `Parameter \`oddsTypes\` should be either \`null\` or a list of any of the odds types: ${available.sort().join(", ")}. Got ${JSON.stringify(this.oddsTypes)} instead.`;
    if (this.oddsTypes !== null) {
      if (
        !Array.isArray(this.oddsTypes) ||
        this.oddsTypes.some((t) => typeof t !== "string")
      ) {
        throw new TypeError(msg);
      }
      if (!this.oddsTypes.every((t) => available.includes(t))) {
        throw new ValueError(msg);
      }
    }
    this.oddsTypes_ =
      this.oddsTypes !== null
        ? [...this.oddsTypes].sort()
        : available.includes("market_average")
          ? ["market_average"]
          : [...available].sort();
  }

  protected override fitInternal(X: Table, Y: Table, _O: Table | null): this {
    this.checkOddsTypes(X);
    this.alpha_ = checkScalar(this.alpha, "alpha", { min: 0, max: 1 });
    this.outputKeys_ = columnNames(Y).map((col) => col.split("__").slice(1).join("__"));
    return this;
  }

  protected override predictProbaInternal(X: Table): NumericMatrix {
    const proba: number[][] = [];
    for (const key of this.outputKeys_) {
      const oddsCols: string[] = [];
      for (const oddsType of this.oddsTypes_) {
        const col = `odds__${oddsType}__${key}`;
        if (col in X.columns) oddsCols.push(col);
      }
      const means = rowMeans(X, oddsCols);
      proba.push(means.map((m) => Math.max(0, 1 / m - this.alpha_)));
    }
    return X.index.map((_, i) => proba.map((col) => col[i] ?? 0));
  }
}

class ValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValueError";
  }
}

export { ValueError };
