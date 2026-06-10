<img width="598" height="336" alt="download" src="https://github.com/user-attachments/assets/812aa544-e42a-4fb4-ad0b-421009f9a9ee" />

# Sports Betting Toolbox

Predict soccer match outcomes from two team names: **home win**, **draw**, and **away win** rates with **confidence**, powered by historical data and an optional AI model.

## Primary workflow

**Input:** two team names  
**Output:** win/draw probabilities + confidence

```bash
# Statistical model (uses built-in historical data)
npm run toolbox -- predict Barcelona "Real Madrid"

# With flags
npm run toolbox -- predict --home Arsenal --away Chelsea

# Richer history from remote GitHub data
npm run toolbox -- predict Liverpool "Man City" --source remote --league England --division 1 --year 2020
```

Example output:

```json
{
  "match": "Barcelona vs Real Madrid",
  "homeWin": "38.2%",
  "draw": "27.4%",
  "awayWin": "34.4%",
  "confidence": "62.5%",
  "model": "statistical",
  "historicalSamples": { "homeMatches": 2, "awayMatches": 2, "headToHeadMatches": 2 }
}
```

### AI model (optional)

Set `OPENAI_API_KEY` in `.env` (see `.env.example`). When present, predictions use an LLM that refines rates using team form, head-to-head, and league draw trends.

```bash
cp .env.example .env
# add OPENAI_API_KEY=sk-...

npm run toolbox -- predict Arsenal Chelsea
# model: "ai" + reasoning field in output
```

Force statistical-only mode: `--no-ai`

## Library

```typescript
import { predictMatch } from "./src/index.js";

const result = await predictMatch("Barcelona", "Real Madrid", {
  source: "dummy",
  useAi: false,
});

console.log(result.homeWin, result.draw, result.awayWin, result.confidence);
```

## Architecture

```
apps/toolbox-cli.ts          CLI — `predict` is the main command
src/predict/                 Match prediction (statistical + AI)
src/extractors/              Historical match/odds data loaders
src/strategies/              Backtesting and value-bet strategies
src/platform/                Frames, validation, cache, edge math
```

## Data sources (for prediction context)

| Source | Flag | Use |
|--------|------|-----|
| Dummy | `--source dummy` (default) | Local sample matches, no network |
| Remote | `--source remote` | GitHub CSVs ([sports-betting data](https://github.com/georgedouzas/sports-betting/tree/data/data/soccer/modelling)) |
| File | `--source file --file ./matches.csv` | Your own CSV |

See [guide/extractors.md](guide/extractors.md) for CSV format and loading details.

## Other CLI commands

```bash
npm run toolbox -- data load
npm run toolbox -- strategy backtest
npm run toolbox -- strategy picks
npm run toolbox -- cache ping
```

## Environment

```bash
OPENAI_API_KEY=...     # enables AI predictions
OPENAI_MODEL=gpt-4o-mini
REDIS_URL=...          # optional cache for remote data
```
