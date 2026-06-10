<img width="598" height="336" alt="download" src="https://github.com/user-attachments/assets/812aa544-e42a-4fb4-ad0b-421009f9a9ee" />

# Sports Betting Toolbox

Predict soccer match outcomes from two team names using an **AI model**, backed by historical match data.

**Input:** home team + away team  
**Output:** home win %, draw %, away win %, confidence, and AI reasoning

https://github.com/user-attachments/assets/980afff7-64ce-4fe9-9bf9-372a53d52db3
## Setup (one time)

```bash
npm install
cp .env.example .env
```

Add your OpenAI key to `.env`:

```bash
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

## Predict (primary workflow)

```bash
# Defaults: remote England Premier League 2020 data + AI model
npm run toolbox -- predict --home Arsenal --away Chelsea

# Shorthand
npm run toolbox -- predict Arsenal Chelsea

# Other league/year
npm run toolbox -- predict Barcelona "Real Madrid" --source remote --league Spain --division 1 --year 2020
```

Example output:

```json
{
  "match": "Arsenal vs Chelsea",
  "homeWin": "41.2%",
  "draw": "27.5%",
  "awayWin": "31.3%",
  "confidence": "68.0%",
  "model": "ai",
  "aiModel": "gpt-4o-mini",
  "reasoning": "Arsenal's home form and recent head-to-head edge Chelsea slightly..."
}
```

### Statistical fallback (no API key)

```bash
npm run toolbox -- predict Arsenal Chelsea --no-ai --source dummy
```

## How AI integration works

1. **Loads historical data** (`remote` by default for `predict`)
2. **Builds context** — team form, head-to-head, league draw rate
3. **Calls the AI model** via Vercel AI SDK with structured output
4. **Blends** dataset signals with the model's football knowledge (especially when data is sparse)

The AI step is **required by default**. Without `OPENAI_API_KEY`, the CLI prints setup instructions. Use `--no-ai` only if you want the local statistical model.

## Library

```typescript
import { predictMatch } from "./src/index.js";

const result = await predictMatch("Arsenal", "Chelsea", {
  source: "remote",
  params: { league: "England", division: 1, year: 2020 },
});
// result.model === "ai", result.reasoning, result.homeWin, ...
```

## Data sources

| Source | Flag | Use |
|--------|------|-----|
| Remote | `--source remote` (predict default) | Real match history from GitHub |
| Dummy | `--source dummy` | Offline toy data for tests |
| File | `--source file --file ./matches.csv` | Your own CSV |

## Other CLI commands

```bash
npm run toolbox -- data load
npm run toolbox -- strategy backtest
npm run toolbox -- strategy picks
```

## Environment

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | **Required** for AI predictions |
| `OPENAI_MODEL` | Model name (default `gpt-4o-mini`) |
| `OPENAI_BASE_URL` | Optional compatible API gateway |
| `REDIS_URL` | Optional cache for remote CSV downloads |
