import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createDataLoader,
  loadMatchOddsData,
  loadDataLoader,
} from "../src/extractors/loadMatchOdds.js";
import { columnNames } from "../src/registry/schema.js";

describe("loadMatchOddsData", () => {
  it("loads dummy training and fixtures", async () => {
    const data = await loadMatchOddsData({ source: "dummy", oddsType: "williamhill" });
    expect(data.meta.source).toBe("dummy");
    expect(data.meta.trainRows).toBeGreaterThan(0);
    expect(data.train[2]).not.toBeNull();
    expect(columnNames(data.train[1]).every((c) => c.startsWith("output__"))).toBe(true);
  });

  it("creates a file loader via loadDataLoader", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sbt-"));
    const path = join(dir, "matches.csv");
    writeFileSync(
      path,
      [
        "date,league,division,year,home_team,away_team,target__home_team__full_time_goals,target__away_team__full_time_goals,odds__williamhill__home_win__full_time_goals,odds__williamhill__draw__full_time_goals,odds__williamhill__away_win__full_time_goals,fixtures",
        "17/3/2019,Test,1,2019,A,B,2,1,2.0,3.0,4.0,false",
      ].join("\n"),
    );

    const loader = await loadDataLoader(path);
    const [X] = loader.extractTrainData(0, "williamhill");
    expect(X.index.length).toBe(1);
  });

  it("createDataLoader returns dummy without network", async () => {
    const loader = await createDataLoader({ source: "dummy" });
    expect(loader.getOddsTypes()).toContain("williamhill");
  });
});
