import type { Table } from "../registry/schema.js";
import { rowCount } from "../registry/schema.js";

export interface TeamRecord {
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
}

export interface HeadToHeadRecord {
  played: number;
  homeWins: number;
  draws: number;
  awayWins: number;
}

export interface MatchContext {
  homeTeam: string;
  awayTeam: string;
  resolvedHome: string | null;
  resolvedAway: string | null;
  homeRecord: TeamRecord;
  awayRecord: TeamRecord;
  headToHead: HeadToHeadRecord;
  leagueDrawRate: number;
}

function normalizeTeam(name: string): string {
  return name.trim().toLowerCase();
}

export function teamsMatch(a: string, b: string): boolean {
  const left = normalizeTeam(a);
  const right = normalizeTeam(b);
  return left === right || left.includes(right) || right.includes(left);
}

function emptyRecord(): TeamRecord {
  return { played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 };
}

function emptyH2H(): HeadToHeadRecord {
  return { played: 0, homeWins: 0, draws: 0, awayWins: 0 };
}

function resolveTeamName(query: string, candidates: string[]): string | null {
  const exact = candidates.find((c) => normalizeTeam(c) === normalizeTeam(query));
  if (exact) return exact;
  const partial = candidates.find((c) => teamsMatch(c, query));
  return partial ?? null;
}

function outcome(
  homeGoals: number,
  awayGoals: number,
): "home" | "draw" | "away" {
  if (homeGoals > awayGoals) return "home";
  if (homeGoals < awayGoals) return "away";
  return "draw";
}

function addResult(record: TeamRecord, result: "win" | "draw" | "loss", gf: number, ga: number): void {
  record.played += 1;
  record.goalsFor += gf;
  record.goalsAgainst += ga;
  if (result === "win") record.wins += 1;
  else if (result === "draw") record.draws += 1;
  else record.losses += 1;
}

/** Build team form and head-to-head stats from historical match tables. */
export function buildMatchContext(homeTeam: string, awayTeam: string, data: Table): MatchContext {
  const homeCol = data.columns.home_team ?? [];
  const awayCol = data.columns.away_team ?? [];
  const homeGoalsCol = data.columns.target__home_team__full_time_goals ?? [];
  const awayGoalsCol = data.columns.target__away_team__full_time_goals ?? [];

  const allTeams = [
    ...new Set(
      [...homeCol, ...awayCol]
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  ];

  const resolvedHome = resolveTeamName(homeTeam, allTeams);
  const resolvedAway = resolveTeamName(awayTeam, allTeams);

  const homeRecord = emptyRecord();
  const awayRecord = emptyRecord();
  const headToHead = emptyH2H();
  let draws = 0;
  let finished = 0;

  for (let i = 0; i < rowCount(data); i++) {
    const home = homeCol[i];
    const away = awayCol[i];
    const hg = Number(homeGoalsCol[i]);
    const ag = Number(awayGoalsCol[i]);
    if (typeof home !== "string" || typeof away !== "string") continue;
    if (Number.isNaN(hg) || Number.isNaN(ag)) continue;

    finished += 1;
    const result = outcome(hg, ag);
    if (result === "draw") draws += 1;

    if (resolvedHome && teamsMatch(home, resolvedHome)) {
      addResult(
        homeRecord,
        result === "home" ? "win" : result === "draw" ? "draw" : "loss",
        hg,
        ag,
      );
    }
    if (resolvedAway && teamsMatch(away, resolvedAway)) {
      addResult(
        awayRecord,
        result === "away" ? "win" : result === "draw" ? "draw" : "loss",
        ag,
        hg,
      );
    }

    if (
      resolvedHome &&
      resolvedAway &&
      teamsMatch(home, resolvedHome) &&
      teamsMatch(away, resolvedAway)
    ) {
      headToHead.played += 1;
      if (result === "home") headToHead.homeWins += 1;
      else if (result === "draw") headToHead.draws += 1;
      else headToHead.awayWins += 1;
    }
  }

  return {
    homeTeam,
    awayTeam,
    resolvedHome,
    resolvedAway,
    homeRecord,
    awayRecord,
    headToHead,
    leagueDrawRate: finished > 0 ? draws / finished : 0.25,
  };
}
