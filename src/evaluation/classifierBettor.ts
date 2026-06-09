import type { Classifier, NumericMatrix, Table } from "../types.js";
import { BaseBettor } from "./baseBettor.js";

export class ClassifierBettor extends BaseBettor {
  classifier: Classifier;
  classifier_!: Classifier;

  constructor(
    classifier: Classifier,
    bettingMarkets: string[] | null = null,
    initCash: number | null = null,
    stake: number | null = null,
  ) {
    super(bettingMarkets, initCash, stake);
    this.classifier = classifier;
  }

  protected override fitInternal(X: Table, Y: Table, _O: Table | null): this {
    this.classifier_ = this.classifier;
    this.classifier_.fit(X, Y);
    return this;
  }

  protected override predictProbaInternal(X: Table): NumericMatrix {
    const proba = this.classifier_.predictProba(X);
    if (Array.isArray(proba[0])) {
      return (proba as NumericMatrix[]).map((block) => block.map((row) => row[row.length - 1] ?? 0));
    }
    return (proba as NumericMatrix).map((row) => row[row.length - 1] ?? 0).map((v) => [v]);
  }
}
