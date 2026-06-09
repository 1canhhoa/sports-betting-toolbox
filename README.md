# Sports Betting Toolbox

A modular TypeScript toolkit for building and validating soccer betting models.

## Architecture

```
apps/toolbox-cli.ts          CLI entry
src/registry/                Shared schema types
src/extractors/              Historical + fixture data loaders
src/strategies/              Bettors and walk-forward backtests
src/platform/                Frames, validation, cache, edge math
```

## CLI (unique vocabulary)

```bash
npm run toolbox -- data params
npm run toolbox -- data odds
npm run toolbox -- data export [--out dir]
npm run toolbox -- strategy backtest [--out dir]
npm run toolbox -- strategy picks
npm run toolbox -- cache ping
```

## Library

```typescript
import { DummySoccerDataLoader, OddsComparisonBettor, backtest } from "./src/index.js";
```
