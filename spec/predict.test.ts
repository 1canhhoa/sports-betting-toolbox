import { describe, expect, it } from "vitest";
import { predictMatch } from "../src/predict/matchPredictor.js";
import { buildMatchContext } from "../src/predict/teamContext.js";
import { predictStatistical } from "../src/predict/statistical.js";
import { DummySoccerDataLoader } from "../src/extractors/dummySoccer.js";

describe("predictMatch", () => {
  it("predicts outcome rates for two known teams", async () => {
    const result = await predictMatch("Barcelona", "Real Madrid", {
      source: "dummy",
      useAi: false,
    });

    expect(result.homeTeam).toBe("Barcelona");
    expect(result.awayTeam).toBe("Real Madrid");
    expect(result.model).toBe("statistical");
    expect(result.homeWin + result.draw + result.awayWin).toBeCloseTo(1, 2);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.resolvedHome).toBe("Barcelona");
    expect(result.resolvedAway).toBe("Real Madrid");
  });

  it("requires AI setup when useAi is true and no API key", async () => {
    const prev = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    await expect(
      predictMatch("Arsenal", "Chelsea", { source: "dummy", useAi: true }),
    ).rejects.toThrow(/OPENAI_API_KEY/);
    if (prev) process.env.OPENAI_API_KEY = prev;
  });

  it("returns normalized statistical rates from context", () => {
    const loader = new DummySoccerDataLoader();
    const data = loader.getData();
    const context = buildMatchContext("Olympiakos", "Panathinaikos", data);
    const rates = predictStatistical(context);

    expect(rates.homeWin + rates.draw + rates.awayWin).toBeCloseTo(1, 5);
    expect(rates.confidence).toBeGreaterThan(0);
  });
});
