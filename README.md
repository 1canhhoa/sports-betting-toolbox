<img width="297" height="170" alt="download" src="https://github.com/user-attachments/assets/daf1ebd7-5a1f-4c92-900d-818fd71f028a" />


# sports-betting-toolbox

TypeScript sports betting toolbox for creating, testing, and using predictive betting models.

## Features

- **Dataloaders** — extract historical training data and fixtures (`DummySoccerDataLoader`, `SoccerDataLoader`)
- **Bettors** — backtest strategies and find value bets (`OddsComparisonBettor`, `ClassifierBettor`)
- **Redis cache** — optional Redis-backed caching for remote CSV fetches, backtests, and value bets (in-memory fallback)
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

# Redis health check and cache flush
npm run sportsbet -- redis ping
npm run sportsbet -- redis flush

# Bypass cache for a single command
npm run sportsbet -- bettor backtest --no-cache
```

### Redis

Copy `.env.example` to `.env` and point `REDIS_URL` at your instance. When Redis is unavailable, the toolbox transparently falls back to an in-memory cache.

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_URL` | — | Full Redis connection URL |
| `REDIS_HOST` | `127.0.0.1` | Host when URL not set |
| `REDIS_PORT` | `6379` | Port when URL not set |
| `REDIS_ENABLED` | `true` | Set `false` to force in-memory cache |
| `REDIS_KEY_PREFIX` | `sportsbet:` | Namespace for cached keys |
| `REDIS_CACHE_TTL_SEC` | `3600` | Default TTL in seconds |

Cached data:

- Remote soccer CSV downloads (`SoccerDataLoader`)
- Backtest results (`bettor backtest`)
- Value bet predictions (`bettor bet`)

## Development

```bash
npm run typecheck
npm run build
npm test
```

## License

MIT
