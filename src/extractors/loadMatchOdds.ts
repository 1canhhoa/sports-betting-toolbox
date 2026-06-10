import type {
  FixturesData,
  Param,
  ParamGrid,
  TrainData,
} from "../registry/schema.js";
import type { BaseDataLoader } from "./base.js";
import { CsvFileDataLoader } from "./csvFile.js";
import { DummySoccerDataLoader } from "./dummySoccer.js";
import { SoccerDataLoader } from "./soccerRemote.js";

export type MatchOddsSource = "dummy" | "remote" | "file";

export interface CreateDataLoaderOptions {
  /** `dummy` (default), `remote` (GitHub CSVs), or `file` (local CSV). */
  source?: MatchOddsSource;
  /** Required when `source` is `file`. */
  file?: string;
  /** Narrow training rows, e.g. `{ league: "England", division: 1, year: 2020 }`. */
  params?: Param | ParamGrid;
  /** Cache remote CSV downloads in Redis/memory (default true). */
  useCache?: boolean;
}

export interface LoadMatchOddsOptions extends CreateDataLoaderOptions {
  /** Bookmaker prefix, e.g. `williamhill`, `pinnacle`. */
  oddsType: string;
  /** Drop input columns with fewer than this fraction of non-null values (0–1). */
  dropNaThres?: number;
}

export interface MatchOddsData {
  loader: BaseDataLoader;
  train: TrainData;
  fixtures: FixturesData;
  meta: {
    source: MatchOddsSource;
    oddsTypes: string[];
    trainRows: number;
    fixtureRows: number;
    availableParams: Param[];
  };
}

function normalizeParamGrid(params?: Param | ParamGrid): ParamGrid | null {
  if (params === undefined) return null;
  if (Array.isArray(params)) return params;
  const grid: Record<string, Array<string | number | boolean | null>> = {};
  for (const [key, value] of Object.entries(params)) {
    grid[key] = [value];
  }
  return grid;
}

/** Create a data loader and fetch raw match/odds tables when needed. */
export async function createDataLoader(
  options: CreateDataLoaderOptions = {},
): Promise<BaseDataLoader> {
  const source = options.source ?? "dummy";
  const params = normalizeParamGrid(options.params);

  if (source === "dummy") {
    return new DummySoccerDataLoader(params);
  }

  if (source === "remote") {
    const loader = new SoccerDataLoader(params);
    await loader.loadRemoteData(options.useCache ?? true);
    return loader;
  }

  if (source === "file") {
    if (!options.file) {
      throw new Error("createDataLoader: `file` is required when source is 'file'.");
    }
    return new CsvFileDataLoader(options.file, params);
  }

  throw new Error(
    `createDataLoader: unknown source '${source}'. Use 'dummy', 'remote', or 'file'.`,
  );
}

/**
 * Load match and odds data ready for strategies: training features/outcomes/odds
 * plus upcoming fixtures.
 */
export async function loadMatchOddsData(
  options: LoadMatchOddsOptions,
): Promise<MatchOddsData> {
  const { oddsType, dropNaThres = 0, source = "dummy" } = options;
  const loader = await createDataLoader(options);
  const train = loader.extractTrainData(dropNaThres, oddsType);
  const fixtures = loader.extractFixturesData();
  const oddsTypes = loader.getOddsTypes();
  const LoaderClass = loader.constructor as typeof BaseDataLoader;

  return {
    loader,
    train,
    fixtures,
    meta: {
      source,
      oddsTypes,
      trainRows: train[0].index.length,
      fixtureRows: fixtures[0].index.length,
      availableParams: LoaderClass.getAllParams(),
    },
  };
}

/** @deprecated Use `createDataLoader({ source: "file", file: path })` instead. */
export async function loadDataLoader(
  path: string,
  options?: { params?: Param | ParamGrid },
): Promise<BaseDataLoader> {
  return createDataLoader({ source: "file", file: path, params: options?.params });
}
