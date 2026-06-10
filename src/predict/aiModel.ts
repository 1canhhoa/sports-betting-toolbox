import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import type { MatchContext } from "./teamContext.js";
import type { OutcomeRates } from "./statistical.js";
import { predictStatistical } from "./statistical.js";
import { loadEnv } from "../config/env.js";

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
  const sparseData =
    !context.resolvedHome ||
    !context.resolvedAway ||
    context.homeRecord.played + context.awayRecord.played < 4;

  return [
    `You are a soccer match analyst. Predict full-time outcome probabilities for: ${context.homeTeam} (home) vs ${context.awayTeam} (away).`,
    `Resolved names in dataset: home=${context.resolvedHome ?? "unknown"}, away=${context.resolvedAway ?? "unknown"}.`,
    formatRecord("Home team record", context.homeRecord),
    formatRecord("Away team record", context.awayRecord),
    context.headToHead.played > 0
      ? `Head-to-head: ${context.headToHead.played} matches, ${context.headToHead.homeWins} home wins, ${context.headToHead.draws} draws, ${context.headToHead.awayWins} away wins`
      : "Head-to-head: no matches in dataset",
    `League draw rate in dataset: ${(context.leagueDrawRate * 100).toFixed(1)}%`,
    `Statistical baseline: home ${(baseline.homeWin * 100).toFixed(1)}%, draw ${(baseline.draw * 100).toFixed(1)}%, away ${(baseline.awayWin * 100).toFixed(1)}% (confidence ${(baseline.confidence * 100).toFixed(0)}%)`,
    sparseData
      ? "Historical data is sparse or incomplete. Combine the baseline with your knowledge of team strength, typical home advantage, and league context. Lower confidence when data is thin."
      : "Use the historical signals as primary evidence. Adjust only when there is a clear reason.",
    "Return calibrated probabilities that sum to ~1. Confidence should reflect data quality and how well you know both teams.",
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

function openAiProvider() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const baseURL = process.env.OPENAI_BASE_URL?.trim();
  return createOpenAI({
    apiKey: apiKey ?? "",
    baseURL: baseURL || undefined,
  });
}

export function isAiModelAvailable(): boolean {
  loadEnv();
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function aiSetupInstructions(): string {
  return [
    "AI model is required for predict (use --no-ai to skip).",
    "Setup:",
    "  1. cp .env.example .env",
    "  2. Set OPENAI_API_KEY=sk-... in .env",
    "  3. Optional: OPENAI_MODEL=gpt-4o-mini",
    "  4. Optional: OPENAI_BASE_URL for compatible API gateways",
  ].join("\n");
}

/** Predict win/draw rates with an LLM using match context + football knowledge. */
export async function predictWithAi(context: MatchContext): Promise<
  OutcomeRates & { reasoning: string }
> {
  loadEnv();
  if (!isAiModelAvailable()) {
    throw new Error(aiSetupInstructions());
  }

  const baseline = predictStatistical(context);
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  const { object } = await generateObject({
    model: openAiProvider()(model),
    schema: predictionSchema,
    prompt: buildPrompt(context, baseline),
  });

  return normalizeAiRates(object);
}
