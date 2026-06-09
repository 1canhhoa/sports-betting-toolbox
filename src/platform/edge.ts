/** Implied probability and expected value helpers for value-bet detection. */

export function impliedProbability(decimalOdds: number): number {
  if (decimalOdds <= 0) return 0;
  return 1 / decimalOdds;
}

export function isValueBet(estimatedProb: number, decimalOdds: number): boolean {
  return estimatedProb * decimalOdds > 1;
}

export function expectedReturn(estimatedProb: number, decimalOdds: number, stake: number): number {
  return stake * (estimatedProb * decimalOdds - 1);
}

export function sharpeRatio(dailyReturns: number[]): number {
  if (dailyReturns.length === 0) return 0;
  const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const variance =
    dailyReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / dailyReturns.length;
  const std = Math.sqrt(variance);
  if (std === 0 || Number.isNaN(std)) return mean > 0 ? 100 : -100;
  return Math.sqrt(365) * (mean / std);
}
