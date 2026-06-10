import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import type { MatchContext } from "./teamContext.js";
import type { OutcomeRates } from "./statistical.js";
import { predictStatistical } from "./statistical.js";

const predictionSchema = z.object({
  homeWin: z.number().min(0).max(1).describe("Probability home team wins"),
  draw: z.number().min(0).max(1).describe("Probability of a draw"),
  awayWin: z.number().min(0).max(1).describe("Probability away team wins"),
  confidence: z.number().min(0).max(1).describe("Overall confidence in the estimate"),
  reasoning: z.string().describe("Short explanation of the prediction"),
});

function formatRecord(label: string, record: MatchContext["homeRecord"]): string {
  if (record.played === 0) return `${label}: no historical matches in dataset`;
  return `${label}: ${record.played} matches, ${record.wins}W-${record.draws}D-${record.losses}L, goals ${record.goalsFor}-${record.goalsAgainst}`;
}

function buildPrompt(context: MatchContext, baseline: OutcomeRates): string {
  return [
    `Predict full-time outcome probabilities for: ${context.homeTeam} (home) vs ${context.awayTeam} (away).`,
    `Resolved names in dataset: home=${context.resolvedHome ?? "unknown"}, away=${context.resolvedAway ?? "unknown"}.`,
    formatRecord("Home team record", context.homeRecord),
    formatRecord("Away team record", context.awayRecord),
    context.headToHead.played > 0
      ? `Head-to-head: ${context.headToHead.played} matches, ${context.headToHead.homeWins} home wins, ${context.headToHead.draws} draws, ${context.headToHead.awayWins} away wins`
      : "Head-to-head: no matches in dataset",
    `League draw rate in dataset: ${(context.leagueDrawRate * 100).toFixed(1)}%`,
    `Statistical baseline: home ${(baseline.homeWin * 100).toFixed(1)}%, draw ${(baseline.draw * 100).toFixed(1)}%, away ${(baseline.awayWin * 100).toFixed(1)}% (confidence ${(baseline.confidence * 100).toFixed(0)}%)`,
    "Return calibrated probabilities that sum to ~1. Confidence should reflect data quality and team familiarity.",
  ].join("\n");
}

function normalizeAiRates(
  rates: z.infer<typeof predictionSchema>,
): OutcomeRates & { reasoning: string } {
  const sum = rates.homeWin + rates.draw + rates.awayWin;
  const scale = sum > 0 ? 1 / sum : 1;
  return {
    homeWin: rates.homeWin * scale,
    draw: rates.draw * scale,
    awayWin: rates.awayWin * scale,
    confidence: Math.min(1, Math.max(0, rates.confidence)),
    reasoning: rates.reasoning,
  };
}

export function isAiModelAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** Refine baseline rates with an LLM using match context. */
export async function predictWithAi(context: MatchContext): Promise<
  OutcomeRates & { reasoning: string }
> {
  if (!isAiModelAvailable()) {
    throw new Error("OPENAI_API_KEY is not set. Copy .env.example to .env and add your key.");
  }

  const baseline = predictStatistical(context);
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const { object } = await generateObject({
    model: openai(model),
    schema: predictionSchema,
    prompt: buildPrompt(context, baseline),
  });

  return normalizeAiRates(object);
}
