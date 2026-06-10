import type { CreateDataLoaderOptions } from "../extractors/loadMatchOdds.js";
import { createDataLoader } from "../extractors/loadMatchOdds.js";
import { BaseDataLoader } from "../extractors/base.js";
import { buildMatchContext } from "./teamContext.js";
import { predictStatistical } from "./statistical.js";
import { isAiModelAvailable, predictWithAi } from "./aiModel.js";

export type PredictionModel = "ai" | "statistical";

export interface PredictMatchOptions extends CreateDataLoaderOptions {
  /** Prefer AI when OPENAI_API_KEY is set (default true). */
  useAi?: boolean;
}

export interface MatchPrediction {
  homeTeam: string;
  awayTeam: string;
  homeWin: number;
  draw: number;
  awayWin: number;
  confidence: number;
  model: PredictionModel;
  resolvedHome: string | null;
  resolvedAway: string | null;
  context: {
    homeMatches: number;
    awayMatches: number;
    headToHeadMatches: number;
    leagueDrawRate: number;
  };
  reasoning?: string;
}

function rawTrainingTable(loader: BaseDataLoader) {
  const data = loader.getData();
  const fixtures = (data.columns.fixtures ?? []).map((v) => Boolean(v));
  const trainMask = fixtures.map((f) => !f);
  const columns: typeof data.columns = {};
  for (const [key, values] of Object.entries(data.columns)) {
    if (key === "fixtures") continue;
    columns[key] = values.filter((_, i) => trainMask[i]);
  }
  return {
    index: data.index.filter((_, i) => trainMask[i]),
    columns,
  };
}

/**
 * Primary workflow: two team names in → home win, draw, away win rates + confidence out.
 */
export async function predictMatch(
  homeTeam: string,
  awayTeam: string,
  options: PredictMatchOptions = {},
): Promise<MatchPrediction> {
  if (!homeTeam?.trim() || !awayTeam?.trim()) {
    throw new Error("predictMatch requires both home and away team names.");
  }

  const loader = await createDataLoader(options);
  const context = buildMatchContext(homeTeam, awayTeam, rawTrainingTable(loader));

  const useAi = options.useAi !== false && isAiModelAvailable();
  let reasoning: string | undefined;
  const rates = useAi
    ? await predictWithAi(context).then((r) => {
        reasoning = r.reasoning;
        return r;
      })
    : predictStatistical(context);

  return {
    homeTeam: homeTeam.trim(),
    awayTeam: awayTeam.trim(),
    homeWin: roundRate(rates.homeWin),
    draw: roundRate(rates.draw),
    awayWin: roundRate(rates.awayWin),
    confidence: roundRate(rates.confidence),
    model: useAi ? "ai" : "statistical",
    resolvedHome: context.resolvedHome,
    resolvedAway: context.resolvedAway,
    context: {
      homeMatches: context.homeRecord.played,
      awayMatches: context.awayRecord.played,
      headToHeadMatches: context.headToHead.played,
      leagueDrawRate: roundRate(context.leagueDrawRate),
    },
    reasoning,
  };
}

function roundRate(value: number): number {
  return Math.round(value * 1000) / 1000;
}
