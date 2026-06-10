import { fetch } from "undici";
import type { ParamGrid, Schema, Table } from "../registry/schema.js";
import { BaseDataLoader } from "./base.js";
import { csvCacheKey } from "../platform/cache/keys.js";
import { cacheGet, cacheSet } from "../platform/cache/store.js";
import { parameterGrid, parseDate } from "../platform/frame.js";
import { concatTables, parseCsvText, recordsToTable, withDateColumn } from "./csvTable.js";
import { SOCCER_OUTPUTS } from "./soccerOutputs.js";

export const TRAINING_URL =
  "https://raw.githubusercontent.com/georgedouzas/sports-betting/data/data/soccer/modelling/{league}_{division}_{year}.csv";
export const FIXTURES_URL =
  "https://raw.githubusercontent.com/georgedouzas/sports-betting/data/data/soccer/modelling/fixtures.csv";

async function fetchCsv(url: string, useCache = true): Promise<Record<string, string>[]> {
  const cacheKey = csvCacheKey(url);

  if (useCache) {
    const cached = await cacheGet<string>(cacheKey);
    if (cached) {
      return parseCsvText(cached);
    }
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  const text = await response.text();

  if (useCache) {
    await cacheSet(cacheKey, text);
  }

  return parseCsvText(text);
}

export class SoccerDataLoader extends BaseDataLoader {
  static override SCHEMA: Schema = [];
  static override OUTPUTS = SOCCER_OUTPUTS;
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

  /** Download league CSVs and fixtures from the sports-betting data repository. */
  async loadRemoteData(useCache = true): Promise<Table> {
    if (this.cachedData) return this.cachedData;
    this.checkParamGrid();
    const params = this.paramGrid_;
    const frames: Table[] = [];
    const errors: string[] = [];

    for (const p of params) {
      const league = String(p.league ?? "England");
      const division = String(p.division ?? 1);
      const year = String(p.year ?? 2020);
      const url = TRAINING_URL.replace("{league}", league)
        .replace("{division}", division)
        .replace("{year}", year);
      try {
        const records = await fetchCsv(url, useCache);
        if (records.length > 0) frames.push(recordsToTable(records, false));
      } catch (err) {
        errors.push(`${league} div${division} ${year}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    try {
      const fixRecords = await fetchCsv(FIXTURES_URL, useCache);
      if (fixRecords.length > 0) frames.push(recordsToTable(fixRecords, true));
    } catch (err) {
      errors.push(`fixtures: ${err instanceof Error ? err.message : String(err)}`);
    }

    if (frames.length === 0) {
      const detail = errors.length ? ` Errors: ${errors.join("; ")}` : "";
      throw new Error(`Could not download soccer data from remote repository.${detail}`);
    }

    let combined = frames[0]!;
    for (let i = 1; i < frames.length; i++) {
      combined = concatTables(combined, frames[i]!);
    }
    this.cachedData = withDateColumn(combined);
    return this.cachedData;
  }

  getData(): Table {
    if (this.cachedData) return this.cachedData;
    throw new Error(
      "SoccerDataLoader: call loadRemoteData() first, or use createDataLoader({ source: 'remote' }).",
    );
  }
}
