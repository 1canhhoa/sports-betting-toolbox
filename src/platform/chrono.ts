/** Time-ordered cross-validation splits (mirrors sklearn TimeSeriesSplit). */

export class TimeSeriesSplit {
  readonly nSplits: number;

  constructor(nSplits = 5) {
    this.nSplits = nSplits;
  }

  split(nSamples: number): Array<[number[], number[]]> {
    if (nSamples <= this.nSplits) {
      throw new Error("Cannot split time series with fewer samples than splits.");
    }
    const foldSize = Math.floor(nSamples / (this.nSplits + 1));
    const splits: Array<[number[], number[]]> = [];
    for (let i = 1; i <= this.nSplits; i++) {
      const trainEnd = foldSize * i + (i - 1);
      const testEnd = Math.min(trainEnd + foldSize, nSamples);
      const trainIdx = Array.from({ length: trainEnd }, (_, j) => j);
      const testIdx = Array.from({ length: testEnd - trainEnd }, (_, j) => trainEnd + j);
      if (testIdx.length > 0) splits.push([trainIdx, testIdx]);
    }
    return splits;
  }
}
