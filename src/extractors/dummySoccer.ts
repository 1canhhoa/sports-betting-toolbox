import type { ParamGrid, Schema, Table } from "../registry/schema.js";
import { BaseDataLoader } from "./base.js";
import { createTable, parameterGrid, parseDate, todayUtc } from "../platform/frame.js";

const OVER_UNDER = 2.5;

function fixtureDate(): Date {
  const d = todayUtc();
  d.setUTCDate(d.getUTCDate() + 2);
  return d;
}

function buildDummyData(): Table {
  const fixDate = fixtureDate();
  const fixStr = `${fixDate.getUTCDate()}/${fixDate.getUTCMonth() + 1}/${fixDate.getUTCFullYear()}`;

  const records = [
    {
      division: 1,
      league: "Greece",
      date: "17/3/2017",
      year: 2017,
      home_team: "Olympiakos",
      away_team: "Panathinaikos",
      target__home_team__full_time_goals: 1,
      target__away_team__full_time_goals: 1,
      odds__interwetten__home_win__full_time_goals: 2.0,
      odds__interwetten__draw__full_time_goals: 2,
      odds__interwetten__away_win__full_time_goals: 2,
      odds__williamhill__home_win__full_time_goals: 2,
      odds__williamhill__draw__full_time_goals: 2,
      odds__williamhill__away_win__full_time_goals: 2,
      "odds__pinnacle__over_2.5__full_time_goals": null,
      fixtures: false,
    },
    {
      division: 2,
      league: "Greece",
      date: "NaT",
      year: null,
      home_team: null,
      away_team: null,
      target__home_team__full_time_goals: null,
      target__away_team__full_time_goals: null,
      odds__interwetten__home_win__full_time_goals: 1.5,
      odds__interwetten__draw__full_time_goals: 2,
      odds__interwetten__away_win__full_time_goals: 2,
      odds__williamhill__home_win__full_time_goals: 1.5,
      odds__williamhill__draw__full_time_goals: null,
      odds__williamhill__away_win__full_time_goals: null,
      "odds__pinnacle__over_2.5__full_time_goals": null,
      fixtures: false,
    },
    {
      division: 1,
      league: "Greece",
      date: "17/3/2019",
      year: 2019,
      home_team: "Panathinaikos",
      away_team: "AEK",
      target__home_team__full_time_goals: 1,
      target__away_team__full_time_goals: 0,
      odds__interwetten__home_win__full_time_goals: 2,
      odds__interwetten__draw__full_time_goals: 2,
      odds__interwetten__away_win__full_time_goals: 3,
      odds__williamhill__home_win__full_time_goals: 3.5,
      odds__williamhill__draw__full_time_goals: 1.5,
      odds__williamhill__away_win__full_time_goals: null,
      "odds__pinnacle__over_2.5__full_time_goals": null,
      fixtures: false,
    },
    {
      division: 1,
      league: "Spain",
      date: "5/4/1997",
      year: 1997,
      home_team: "Real Madrid",
      away_team: "Barcelona",
      target__home_team__full_time_goals: 2,
      target__away_team__full_time_goals: 1,
      odds__interwetten__home_win__full_time_goals: 1.5,
      odds__interwetten__draw__full_time_goals: 3.5,
      odds__interwetten__away_win__full_time_goals: 2.5,
      odds__williamhill__home_win__full_time_goals: 2.5,
      odds__williamhill__draw__full_time_goals: 2.5,
      odds__williamhill__away_win__full_time_goals: null,
      "odds__pinnacle__over_2.5__full_time_goals": null,
      fixtures: false,
    },
    {
      division: 2,
      league: "Spain",
      date: "3/4/1999",
      year: 1999,
      home_team: "Barcelona",
      away_team: "Real Madrid",
      target__home_team__full_time_goals: 2,
      target__away_team__full_time_goals: 2,
      odds__interwetten__home_win__full_time_goals: 2.5,
      odds__interwetten__draw__full_time_goals: 4.5,
      odds__interwetten__away_win__full_time_goals: 2,
      odds__williamhill__home_win__full_time_goals: 2.0,
      odds__williamhill__draw__full_time_goals: null,
      odds__williamhill__away_win__full_time_goals: null,
      "odds__pinnacle__over_2.5__full_time_goals": null,
      fixtures: false,
    },
    {
      division: 2,
      league: "England",
      date: "5/7/1997",
      year: 1997,
      home_team: "Arsenal",
      away_team: "Liverpool",
      target__home_team__full_time_goals: null,
      target__away_team__full_time_goals: 2,
      odds__interwetten__home_win__full_time_goals: 3,
      odds__interwetten__draw__full_time_goals: 2.5,
      odds__interwetten__away_win__full_time_goals: 2,
      odds__williamhill__home_win__full_time_goals: 3.0,
      odds__williamhill__draw__full_time_goals: null,
      odds__williamhill__away_win__full_time_goals: null,
      "odds__pinnacle__over_2.5__full_time_goals": null,
      fixtures: false,
    },
    {
      division: 3,
      league: "England",
      date: "3/4/1998",
      year: 1998,
      home_team: "Liverpool",
      away_team: "Arsenal",
      target__home_team__full_time_goals: 1,
      target__away_team__full_time_goals: 3,
      odds__interwetten__home_win__full_time_goals: 2,
      odds__interwetten__draw__full_time_goals: 4.5,
      odds__interwetten__away_win__full_time_goals: 3.5,
      odds__williamhill__home_win__full_time_goals: 2.0,
      odds__williamhill__draw__full_time_goals: null,
      odds__williamhill__away_win__full_time_goals: null,
      "odds__pinnacle__over_2.5__full_time_goals": null,
      fixtures: false,
    },
    {
      division: 1,
      league: null,
      date: "3/4/1998",
      year: 1998,
      home_team: "Liverpool",
      away_team: "Arsenal",
      target__home_team__full_time_goals: 1,
      target__away_team__full_time_goals: 2,
      odds__interwetten__home_win__full_time_goals: null,
      odds__interwetten__draw__full_time_goals: 2.5,
      odds__interwetten__away_win__full_time_goals: 3.5,
      odds__williamhill__home_win__full_time_goals: 4.0,
      odds__williamhill__draw__full_time_goals: null,
      odds__williamhill__away_win__full_time_goals: null,
      "odds__pinnacle__over_2.5__full_time_goals": null,
      fixtures: false,
    },
    {
      division: 4,
      league: null,
      date: fixStr,
      year: fixDate.getUTCFullYear(),
      home_team: "Barcelona",
      away_team: "Real Madrid",
      target__home_team__full_time_goals: null,
      target__away_team__full_time_goals: null,
      odds__interwetten__home_win__full_time_goals: 3,
      odds__interwetten__draw__full_time_goals: 2.5,
      odds__interwetten__away_win__full_time_goals: 2,
      odds__williamhill__home_win__full_time_goals: 3.5,
      odds__williamhill__draw__full_time_goals: 2.5,
      odds__williamhill__away_win__full_time_goals: 2.0,
      "odds__pinnacle__over_2.5__full_time_goals": null,
      fixtures: true,
    },
    {
      division: 3,
      league: "France",
      date: fixStr,
      year: fixDate.getUTCFullYear(),
      home_team: "Monaco",
      away_team: "PSG",
      target__home_team__full_time_goals: null,
      target__away_team__full_time_goals: null,
      odds__interwetten__home_win__full_time_goals: 1.5,
      odds__interwetten__draw__full_time_goals: 3.5,
      odds__interwetten__away_win__full_time_goals: 2.5,
      odds__williamhill__home_win__full_time_goals: 2.5,
      odds__williamhill__draw__full_time_goals: 1.5,
      odds__williamhill__away_win__full_time_goals: 2.5,
      "odds__pinnacle__over_2.5__full_time_goals": null,
      fixtures: true,
    },
    {
      division: 1,
      league: "France",
      date: "3/4/2000",
      year: 2000,
      home_team: "Lens",
      away_team: "Monaco",
      target__home_team__full_time_goals: 2,
      target__away_team__full_time_goals: 1,
      odds__interwetten__home_win__full_time_goals: 2.0,
      odds__interwetten__draw__full_time_goals: 2.5,
      odds__interwetten__away_win__full_time_goals: 3.0,
      odds__williamhill__home_win__full_time_goals: 2.5,
      odds__williamhill__draw__full_time_goals: 2.5,
      odds__williamhill__away_win__full_time_goals: 3.0,
      "odds__pinnacle__over_2.5__full_time_goals": null,
      fixtures: false,
    },
    {
      division: 1,
      league: "France",
      date: "6/4/2001",
      year: 2001,
      home_team: "PSG",
      away_team: "Lens",
      target__home_team__full_time_goals: 1,
      target__away_team__full_time_goals: 2,
      odds__interwetten__home_win__full_time_goals: 3.0,
      odds__interwetten__draw__full_time_goals: 2.5,
      odds__interwetten__away_win__full_time_goals: 2.0,
      odds__williamhill__home_win__full_time_goals: 2.5,
      odds__williamhill__draw__full_time_goals: 3.0,
      odds__williamhill__away_win__full_time_goals: 2.5,
      "odds__pinnacle__over_2.5__full_time_goals": null,
      fixtures: false,
    },
  ];

  const dates = records.map((r) => parseDate(String(r.date)) ?? new Date(NaN));
  const columns: Record<string, Array<string | number | boolean | null>> = {};
  for (const key of Object.keys(records[0]!)) {
    if (key === "date") continue;
    columns[key] = records.map((r) => {
      const v = r[key as keyof typeof r];
      return v === undefined ? null : (v as string | number | boolean | null);
    });
  }
  return createTable(dates, columns);
}

export class DummySoccerDataLoader extends BaseDataLoader {
  static override SCHEMA: Schema = [
    ["division", "float"],
    ["league", "string"],
    ["date", "date"],
    ["year", "float"],
    ["home_team", "string"],
    ["away_team", "string"],
    ["target__home_team__full_time_goals", "float"],
    ["target__away_team__full_time_goals", "float"],
    ["odds__interwetten__home_win__full_time_goals", "float"],
    ["odds__interwetten__draw__full_time_goals", "float"],
    ["odds__interwetten__away_win__full_time_goals", "float"],
    ["odds__williamhill__home_win__full_time_goals", "float"],
    ["odds__williamhill__draw__full_time_goals", "float"],
    ["odds__williamhill__away_win__full_time_goals", "float"],
    [`odds__pinnacle__over_${OVER_UNDER}__full_time_goals`, "float"],
  ];

  static override OUTPUTS: import("../registry/schema.js").OutputDef[] = [
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
    [
      `output__over_${OVER_UNDER}__full_time_goals`,
      (t: Table) =>
        t.index.map((_, i) => {
          const h = Number(t.columns["target__home_team__full_time_goals"]?.[i]);
          const a = Number(t.columns["target__away_team__full_time_goals"]?.[i]);
          return h + a > OVER_UNDER;
        }),
    ],
    [
      `output__under_${OVER_UNDER}__full_time_goals`,
      (t: Table) =>
        t.index.map((_, i) => {
          const h = Number(t.columns["target__home_team__full_time_goals"]?.[i]);
          const a = Number(t.columns["target__away_team__full_time_goals"]?.[i]);
          return h + a < OVER_UNDER;
        }),
    ],
  ] ;

  constructor(paramGrid: ParamGrid | null = null) {
    super(paramGrid);
  }

  static override getFullParamGrid() {
    return parameterGrid([
      { league: ["Greece"], division: [1], year: [2017, 2019] },
      { league: ["Spain"], division: [1], year: [1997] },
      { league: ["Spain"], division: [2], year: [1999] },
      { league: ["England"], division: [2], year: [1997] },
      { league: ["England"], division: [3], year: [1998] },
      { league: ["France"], division: [1], year: [2000] },
      { league: ["France"], division: [1], year: [2001] },
      { division: [1], year: [1998] },
    ]);
  }

  getData(): Table {
    const data = buildDummyData();
    return {
      index: [...data.index],
      columns: { ...data.columns, date: data.index.map((d) => d) },
    };
  }
}
