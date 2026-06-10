import type { OutputDef, Table } from "../registry/schema.js";

export const SOCCER_OUTPUTS: OutputDef[] = [
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
];
