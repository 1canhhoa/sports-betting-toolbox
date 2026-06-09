/** Shared type aliases mirroring the Python sports-betting package. */

export type Param = Record<string, string | number | boolean | null>;
export type ParamGrid =
  | Record<string, Array<string | number | boolean | null>>
  | Array<Record<string, Array<string | number | boolean | null>>>;

export type CellValue = string | number | boolean | null | Date;
export type ColumnData = CellValue[];

export interface Table {
  /** Row dates; length equals number of rows. */
  index: Date[];
  /** Column name → values (one array per column). */
  columns: Record<string, ColumnData>;
}

export type TrainData = [Table, Table, Table | null];
export type FixturesData = [Table, null, Table | null];

export type NumericMatrix = number[][];
export type BoolMatrix = boolean[][];

export type SchemaEntry = [string, "int" | "float" | "string" | "date"];
export type Schema = SchemaEntry[];

export type OutputFn = (targets: Table) => boolean[];
export type OutputDef = [string, OutputFn];

export type Classifier = {
  fit(X: Table, Y: Table): void;
  predictProba(X: Table): NumericMatrix | NumericMatrix[];
};

export function columnNames(table: Table): string[] {
  return Object.keys(table.columns);
}

export function rowCount(table: Table): number {
  return table.index.length;
}

export function isNull(value: CellValue): boolean {
  return value === null || value === undefined || (typeof value === "number" && Number.isNaN(value));
}

export function isNumeric(value: CellValue): value is number {
  return typeof value === "number" && !Number.isNaN(value);
}
