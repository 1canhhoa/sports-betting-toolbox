export {
  BaseDataLoader,
  DummySoccerDataLoader,
  SoccerDataLoader,
  loadDataLoader,
} from "./extractors/index.js";
export {
  BaseBettor,
  ClassifierBettor,
  OddsComparisonBettor,
  backtest,
  saveBettor,
  loadBettor,
} from "./strategies/index.js";
export type { BacktestRow } from "./strategies/index.js";
export type {
  Param,
  ParamGrid,
  Table,
  TrainData,
  FixturesData,
  Classifier,
} from "./registry/schema.js";
export {
  impliedProbability,
  isValueBet,
  expectedReturn,
  sharpeRatio,
} from "./platform/edge.js";
export { TimeSeriesSplit } from "./platform/chrono.js";
export { getRedisClient, closeRedisClient, pingRedis, isRedisEnabled } from "./platform/cache/redis.js";
export {
  cacheGet,
  cacheSet,
  cacheDelete,
  cacheFlushNamespace,
  isRedisConfigured,
} from "./platform/cache/store.js";
export { csvCacheKey, backtestCacheKey, valueBetsCacheKey } from "./platform/cache/keys.js";
