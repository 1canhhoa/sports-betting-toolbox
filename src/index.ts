export {
  BaseDataLoader,
  DummySoccerDataLoader,
  SoccerDataLoader,
  loadDataLoader,
} from "./datasets/index.js";
export {
  BaseBettor,
  ClassifierBettor,
  OddsComparisonBettor,
  backtest,
  saveBettor,
  loadBettor,
} from "./evaluation/index.js";
export type { BacktestRow } from "./evaluation/index.js";
export type {
  Param,
  ParamGrid,
  Table,
  TrainData,
  FixturesData,
  Classifier,
} from "./types.js";
export {
  impliedProbability,
  isValueBet,
  expectedReturn,
  sharpeRatio,
} from "./utils/betting.js";
export { TimeSeriesSplit } from "./utils/timeSeriesSplit.js";
