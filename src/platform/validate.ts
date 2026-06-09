/** Numeric helpers used across evaluation and datasets. */

export function checkScalar(
  value: unknown,
  name: string,
  options: { min?: number; max?: number } = {},
): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new TypeError(`${name} must be a number, got ${typeof value}.`);
  }
  if (options.min !== undefined && value < options.min) {
    throw new ValueError(`${name} == ${value}, must be >= ${options.min}.`);
  }
  if (options.max !== undefined && value > options.max) {
    throw new ValueError(`${name} == ${value}, must be <= ${options.max}.`);
  }
  return value;
}

export class ValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValueError";
  }
}

export function nanToNum(values: number[], replacement = 0): number[] {
  return values.map((v) => (Number.isNaN(v) ? replacement : v));
}

export function sumAxis(matrix: number[][], axis: 0 | 1): number[] {
  if (axis === 1) {
    return matrix.map((row) => row.reduce((a, b) => a + (Number.isNaN(b) ? 0 : b), 0));
  }
  const width = matrix[0]?.length ?? 0;
  return Array.from({ length: width }, (_, j) =>
    matrix.reduce((acc, row) => acc + (Number.isNaN(row[j] ?? NaN) ? 0 : (row[j] ?? 0)), 0),
  );
}

export function checkConsistentLength(...lengths: number[]): void {
  const first = lengths[0];
  if (lengths.some((n) => n !== first)) {
    throw new ValueError(
      `Found input variables with inconsistent numbers of samples: [${lengths.join(", ")}]`,
    );
  }
}
