import type { CellValue, ColumnData, Table } from "../registry/schema.js";
import { columnNames, isNull, rowCount } from "../registry/schema.js";

export function createTable(
  index: Date[],
  columns: Record<string, ColumnData>,
): Table {
  const n = index.length;
  for (const values of Object.values(columns)) {
    if (values.length !== n) {
      throw new Error("All columns must match index length.");
    }
  }
  return { index, columns };
}

export function tableFromRecords(
  records: Array<Record<string, CellValue>>,
  indexCol = "date",
): Table {
  if (records.length === 0) {
    return { index: [], columns: {} };
  }
  const keys = Object.keys(records[0]!);
  const index = records.map((row) => {
    const value = row[indexCol];
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") return new Date(value);
    throw new TypeError(`Invalid date value in column '${indexCol}'.`);
  });
  const columns: Record<string, ColumnData> = {};
  for (const key of keys) {
    if (key === indexCol) continue;
    columns[key] = records.map((row) => {
      const value = row[key];
      if (value === undefined) return null;
      return value;
    });
  }
  return { index, columns };
}

export function getColumn(table: Table, name: string): ColumnData {
  const col = table.columns[name];
  if (!col) throw new Error(`Column '${name}' not found.`);
  return col;
}

export function selectColumns(table: Table, names: string[]): Table {
  const columns: Record<string, ColumnData> = {};
  for (const name of names) {
    columns[name] = [...getColumn(table, name)];
  }
  return { index: [...table.index], columns };
}

export function selectRows(table: Table, indices: number[]): Table {
  return {
    index: indices.map((i) => table.index[i]!),
    columns: Object.fromEntries(
      Object.entries(table.columns).map(([name, values]) => [
        name,
        indices.map((i) => values[i] ?? null),
      ]),
    ),
  };
}

export function sortByIndex(table: Table): Table {
  const order = table.index
    .map((date, i) => [date.getTime(), i] as const)
    .sort((a, b) => a[0] - b[0])
    .map(([, i]) => i);
  return selectRows(table, order);
}

export function setIndexFromColumn(table: Table, colName: string): Table {
  const dates = getColumn(table, colName).map((v) => {
    if (v instanceof Date) return v;
    if (typeof v === "string" || typeof v === "number") return new Date(v);
    throw new TypeError(`Invalid date in column '${colName}'.`);
  });
  const columns = { ...table.columns };
  delete columns[colName];
  return sortByIndex({ index: dates, columns });
}

export function dropColumns(table: Table, names: string[]): Table {
  const drop = new Set(names);
  const columns: Record<string, ColumnData> = {};
  for (const [name, values] of Object.entries(table.columns)) {
    if (!drop.has(name)) columns[name] = [...values];
  }
  return { index: [...table.index], columns };
}

export function filterRows(table: Table, mask: boolean[]): Table {
  const indices = mask.map((m, i) => (m ? i : -1)).filter((i) => i >= 0);
  return selectRows(table, indices);
}

export function concatColumns(left: Table, right: Table): Table {
  if (left.index.length !== right.index.length) {
    throw new Error("Cannot concat columns with different row counts.");
  }
  return {
    index: [...left.index],
    columns: { ...left.columns, ...right.columns },
  };
}

export function dropNaRows(table: Table, cols: string[]): Table {
  const mask = table.index.map((_, i) =>
    cols.every((col) => {
      const values = table.columns[col];
      return values && !isNull(values[i] ?? null);
    }),
  );
  return filterRows(table, mask);
}

export function dropNaColumnsAll(table: Table): Table {
  const keep = columnNames(table).filter((name) => {
    const values = getColumn(table, name);
    return values.some((v) => !isNull(v));
  });
  return selectColumns(table, keep);
}

export function dropNaColumnsThresh(table: Table, minCount: number): Table {
  const keep = columnNames(table).filter((name) => {
    const values = getColumn(table, name);
    const count = values.filter((v) => !isNull(v)).length;
    return count >= minCount;
  });
  return selectColumns(table, keep);
}

export function rowMeans(table: Table, colNames: string[]): number[] {
  return table.index.map((_, i) => {
    const nums = colNames
      .map((name) => table.columns[name]?.[i])
      .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
    if (nums.length === 0) return NaN;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
  });
}

export function toNumericMatrix(table: Table, colNames: string[]): number[][] {
  return table.index.map((_, i) =>
    colNames.map((name) => {
      const value = table.columns[name]?.[i];
      if (typeof value === "number" && !Number.isNaN(value)) return value;
      if (typeof value === "boolean") return value ? 1 : 0;
      return NaN;
    }),
  );
}

export function toBoolMatrix(table: Table, colNames: string[]): boolean[][] {
  return table.index.map((_, i) =>
    colNames.map((name) => Boolean(table.columns[name]?.[i])),
  );
}

export function groupSumByDate(index: Date[], values: number[]): Map<string, number> {
  const sums = new Map<string, number>();
  for (let i = 0; i < index.length; i++) {
    const key = index[i]!.toDateString();
    sums.set(key, (sums.get(key) ?? 0) + (values[i] ?? 0));
  }
  return sums;
}

export function parameterGrid(
  grid:
    | Record<string, Array<string | number | boolean | null>>
    | Array<Record<string, Array<string | number | boolean | null>>>,
): Array<Record<string, string | number | boolean | null>> {
  const grids = Array.isArray(grid) ? grid : [grid];
  const results: Array<Record<string, string | number | boolean | null>> = [];

  function expand(
    partial: Record<string, string | number | boolean | null>,
    keys: string[],
    source: Record<string, Array<string | number | boolean | null>>,
  ): void {
    if (keys.length === 0) {
      results.push({ ...partial });
      return;
    }
    const [head, ...tail] = keys;
    const values = source[head!] ?? [];
    for (const value of values) {
      expand({ ...partial, [head!]: value }, tail, source);
    }
  }

  for (const g of grids) {
    expand({}, Object.keys(g), g);
  }
  return results;
}

export function rowsMatchParams(
  data: Table,
  paramList: Array<Record<string, string | number | boolean | null>>,
): boolean[] {
  return data.index.map((_, i) =>
    paramList.some((params) =>
      Object.entries(params).every(([key, value]) => data.columns[key]?.[i] === value),
    ),
  );
}

export function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function parseDate(value: string): Date | null {
  if (value === "NaT" || value === "") return null;
  const parts = value.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    if ([d, m, y].some((n) => Number.isNaN(n))) return null;
    return new Date(Date.UTC(y!, m! - 1, d));
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function colsByPrefix(table: Table, prefix: string): string[] {
  return columnNames(table).filter((col) => col.startsWith(prefix));
}

export function inputCols(table: Table): string[] {
  return columnNames(table).filter((col) => !col.startsWith("target"));
}

export function targetCols(table: Table): string[] {
  return colsByPrefix(table, "target");
}

export function oddsCols(table: Table): string[] {
  return colsByPrefix(table, "odds");
}
