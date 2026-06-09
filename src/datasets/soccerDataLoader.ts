import { fetch } from "undici";
import { parse } from "csv-parse/sync";
import type { ParamGrid, Schema, Table } from "../types.js";
import { BaseDataLoader } from "./baseDataLoader.js";
import { createTable, parameterGrid, parseDate } from "../utils/table.js";

const TRAINING_URL =
  "https://raw.githubusercontent.com/georgedouzas/sports-betting/data/data/soccer/modelling/{league}_{division}_{year}.csv";
const FIXTURES_URL =
  "https://raw.githubusercontent.com/georgedouzas/sports-betting/data/data/soccer/modelling/fixtures.csv";

const OUTPUTS = [
  [
    "output__home_win__full_time_goals",
    (t: Table) =>
      t.index.map((_, i) => {
        const h = Number(t.columns["target__home_team__full_time_goals"]?.[i]);
        const a = Number(t.columns["target__away_team__full_time_goals"]?.[i]);
        return h > a;
      }),
  ],
  [
    "output__away_win__full_time_goals",
    (t: Table) =>
      t.index.map((_, i) => {
        const h = Number(t.columns["target__home_team__full_time_goals"]?.[i]);
        const a = Number(t.columns["target__away_team__full_time_goals"]?.[i]);
        return h < a;
      }),
  ],
  [
    "output__draw__full_time_goals",
    (t: Table) =>
      t.index.map((_, i) => {
        const h = Number(t.columns["target__home_team__full_time_goals"]?.[i]);
        const a = Number(t.columns["target__away_team__full_time_goals"]?.[i]);
        return h === a;
      }),
  ],
] as const;

async function fetchCsv(url: string): Promise<Record<string, string>[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const text = await response.text();
  return parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true }) as Record<
    string,
    string
  >[];
}

function recordsToTable(records: Record<string, string>[], fixtures: boolean): Table {
  const dates = records.map((r) => parseDate(r.date ?? "") ?? new Date(NaN));
  const columns: Record<string, Array<string | number | boolean | null>> = { fixtures: [] };
  const keys = Object.keys(records[0] ?? {}).filter((k) => k !== "date");
  for (const key of keys) {
    columns[key] = records.map((r) => {
      const raw = r[key];
      if (raw === undefined || raw === "" || raw === "-") return null;
      const num = Number(raw);
      return Number.isNaN(num) ? raw : num;
    });
  }
  columns.fixtures = records.map(() => fixtures);
  return createTable(dates, columns);
}

export class SoccerDataLoader extends BaseDataLoader {
  static override SCHEMA: Schema = [];
  static override OUTPUTS = OUTPUTS;
  private cachedData: Table | null = null;

  constructor(paramGrid: ParamGrid | null = null) {
    super(paramGrid);
  }

  static override getFullParamGrid() {
    return parameterGrid([
      { league: ["England"], division: [1], year: [2020] },
      { league: ["England"], division: [2], year: [2020] },
      { league: ["Spain"], division: [1], year: [2020] },
      { league: ["Italy"], division: [1], year: [2020] },
      { league: ["Germany"], division: [1], year: [2020] },
      { league: ["France"], division: [1], year: [2020] },
    ]);
  }

  async loadRemoteData(): Promise<Table> {
    if (this.cachedData) return this.cachedData;
    const params = this.paramGrid_ ?? SoccerDataLoader.getFullParamGrid();
    const frames: Table[] = [];
    for (const p of params.slice(0, 3)) {
      const league = String(p.league ?? "England");
      const division = String(p.division ?? 1);
      const year = String(p.year ?? 2020);
      const url = TRAINING_URL.replace("{league}", league)
        .replace("{division}", division)
        .replace("{year}", year);
      try {
        const records = await fetchCsv(url);
        if (records.length > 0) frames.push(recordsToTable(records, false));
      } catch {
        // skip unavailable league files
      }
    }
    try {
      const fixRecords = await fetchCsv(FIXTURES_URL);
      if (fixRecords.length > 0) frames.push(recordsToTable(fixRecords, true));
    } catch {
      // fixtures optional
    }
    if (frames.length === 0) {
      throw new Error("Could not download soccer data from remote repository.");
    }
    let combined = frames[0]!;
    for (let i = 1; i < frames.length; i++) {
      combined = concatTables(combined, frames[i]!);
    }
    combined = {
      index: [...combined.index],
      columns: { ...combined.columns, date: combined.index.map((d) => d) },
    };
    this.cachedData = combined;
    return combined;
  }

  getData(): Table {
    if (this.cachedData) return this.cachedData;
    throw new Error("Call loadRemoteData() before using SoccerDataLoader in synchronous context.");
  }
}

function concatTables(a: Table, b: Table): Table {
  const keys = new Set([...Object.keys(a.columns), ...Object.keys(b.columns)]);
  const columns: Record<string, Array<string | number | boolean | null>> = {};
  const nA = a.index.length;
  const nB = b.index.length;
  for (const key of keys) {
    columns[key] = [
      ...(a.columns[key] ?? Array(nA).fill(null)),
      ...(b.columns[key] ?? Array(nB).fill(null)),
    ];
  }
  return createTable([...a.index, ...b.index], columns);
}
