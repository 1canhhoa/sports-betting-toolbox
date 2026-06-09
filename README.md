# sports-betting

TypeScript sports betting toolbox for creating, testing, and using predictive betting models.

## Features

- **Dataloaders** — extract historical training data and fixtures (`DummySoccerDataLoader`, `SoccerDataLoader`)
- **Bettors** — backtest strategies and find value bets (`OddsComparisonBettor`, `ClassifierBettor`)
- **CLI** — command-line interface for data extraction and backtesting

## Quick start

```bash
npm install
npm test
npm run sportsbet -- dataloader params
```

### API

```typescript
import {
  DummySoccerDataLoader,
  OddsComparisonBettor,
  backtest,
  TimeSeriesSplit,
} from "./src/index.js";

const dataloader = new DummySoccerDataLoader({ league: ["Italy"], year: [2020] });
const [X, Y, O] = dataloader.extractTrainData(0, "market_maximum");

const bettor = new OddsComparisonBettor(null, 0.05);
bettor.fit(X, Y);
if (O) {
  backtest(bettor, X, Y, O, new TimeSeriesSplit(3));
}
```

### CLI

```bash
# Show dataloader parameters
npm run sportsbet -- dataloader params

# Extract training CSVs
npm run sportsbet -- dataloader training --out ./data

# Run backtest
npm run sportsbet -- bettor backtest --out ./results
```

## Development

```bash
npm run typecheck
npm run build
npm test
```

## License

MIT
