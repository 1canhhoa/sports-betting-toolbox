# Loading match & odds data

The toolbox turns raw soccer rows into three tables used by strategies:

| Table | Role | Example columns |
|-------|------|-----------------|
| `X` | Features (match info + odds as inputs) | `home_team`, `odds__williamhill__home_win__full_time_goals` |
| `Y` | Outcomes (boolean targets) | `output__home_win__full_time_goals` |
| `O` | Odds for betting | `odds__williamhill__home_win__full_time_goals` |

Use **`loadMatchOddsData()`** for the full pipeline (recommended), or **`createDataLoader()`** when you only need the loader instance.

## 1. Dummy data (local, no network)

Good for tests and learning the API.

```typescript
import { loadMatchOddsData } from "../src/index.js";

const data = await loadMatchOddsData({
  source: "dummy",
  oddsType: "williamhill",
});

const [X, Y, O] = data.train;
```

CLI:

```bash
npm run toolbox -- data load
npm run toolbox -- data odds
npm run toolbox -- data export --out ./out
```

## 2. Remote data (GitHub CSVs)

Downloads historical matches and upcoming fixtures from the [sports-betting data repo](https://github.com/georgedouzas/sports-betting/tree/data/data/soccer/modelling).

URL pattern for training files:

```
https://raw.githubusercontent.com/georgedouzas/sports-betting/data/data/soccer/modelling/{league}_{division}_{year}.csv
```

Fixtures file:

```
.../fixtures.csv
```

```typescript
const data = await loadMatchOddsData({
  source: "remote",
  params: { league: "England", division: 1, year: 2020 },
  oddsType: "williamhill",
  useCache: true, // Redis or in-memory
});
```

CLI:

```bash
npm run toolbox -- data load --source remote --league England --division 1 --year 2020
npm run toolbox -- data params --source remote
npm run toolbox -- strategy backtest --source remote --league Spain --division 1 --year 2020
```

Available remote parameter combos (defaults when `--league` / `--division` / `--year` are omitted):

- England div 1 & 2, year 2020
- Spain, Italy, Germany, France div 1, year 2020

List bookmakers present in the loaded slice:

```bash
npm run toolbox -- data odds --source remote --league England --division 1 --year 2020
```

## 3. Local CSV file

Export a CSV in the same shape as the remote files, then:

```typescript
const data = await loadMatchOddsData({
  source: "file",
  file: "./data/england_1_2020.csv",
  oddsType: "pinnacle",
});
```

Or the legacy alias:

```typescript
import { loadDataLoader } from "../src/index.js";
const loader = await loadDataLoader("./data/england_1_2020.csv");
const [X, Y, O] = loader.extractTrainData(0, "pinnacle");
```

### Expected CSV columns

**Required**

- `date` — match date (`DD/MM/YYYY` or ISO)
- `fixtures` — `true`/`false` (or omit; rows with empty goal targets are treated as fixtures)

**Match metadata** (typical)

- `league`, `division`, `year`, `home_team`, `away_team`

**Results** (training rows only)

- `target__home_team__full_time_goals`
- `target__away_team__full_time_goals`

**Odds** (one column per bookmaker × market)

- `odds__{bookmaker}__{market}__full_time_goals`

Examples:

```
odds__williamhill__home_win__full_time_goals
odds__williamhill__draw__full_time_goals
odds__williamhill__away_win__full_time_goals
odds__pinnacle__over_2.5__full_time_goals
```

Use `-` or empty cells for missing odds.

### Minimal example row

```csv
date,league,division,year,home_team,away_team,target__home_team__full_time_goals,target__away_team__full_time_goals,odds__williamhill__home_win__full_time_goals,odds__williamhill__draw__full_time_goals,odds__williamhill__away_win__full_time_goals,fixtures
17/3/2019,England,1,2019,Arsenal,Chelsea,2,1,2.1,3.4,3.2,false
12/6/2026,England,1,2026,Liverpool,Man City,,,2.5,3.1,2.8,true
```

## Options reference

### `loadMatchOddsData(options)`

| Option | Default | Description |
|--------|---------|-------------|
| `source` | `"dummy"` | `dummy`, `remote`, or `file` |
| `file` | — | Path when `source` is `file` |
| `params` | all combos | Filter training rows, e.g. `{ league: "Spain", division: 1, year: 2020 }` |
| `oddsType` | *(required)* | Bookmaker prefix: `williamhill`, `pinnacle`, `interwetten`, … |
| `dropNaThres` | `0` | Drop sparse input columns (0–1 fraction of non-null values required) |
| `useCache` | `true` | Cache remote CSV bodies (Redis if configured) |

### Return value `MatchOddsData`

```typescript
{
  loader: BaseDataLoader,
  train: [X, Y, O],      // O is null if oddsType omitted in lower-level API
  fixtures: [XFix, null, OFix],
  meta: {
    source, oddsTypes, trainRows, fixtureRows, availableParams
  }
}
```

## Lower-level loader API

When you need more control (e.g. call `extractTrainData` with different `dropNaThres` per run):

```typescript
import { createDataLoader } from "../src/index.js";

const loader = await createDataLoader({
  source: "remote",
  params: { league: "Germany", division: 1, year: 2020 },
});

const oddsTypes = loader.getOddsTypes();
const [X, Y, O] = loader.extractTrainData(0.1, "williamhill");
const fixtures = loader.extractFixturesData();
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `SoccerDataLoader: call loadRemoteData() first` | Use `createDataLoader({ source: "remote" })` or `loadMatchOddsData()` instead of `new SoccerDataLoader()` alone |
| `Parameter odds_type should be a prefix...` | Run `data odds` to list bookmakers in your slice; pass a valid `--odds-type` |
| `Could not download soccer data` | Check network; verify league/division/year exists in the remote repo |
| `CSV file is empty` | Ensure `date` column and at least one odds column exist |
| All input columns removed | Lower `dropNaThres` or use a bookmaker with more complete odds |

## Custom loaders

Subclass `BaseDataLoader`, implement `getData()` returning a `Table` with `date` and `fixtures` columns, and register outputs in `static OUTPUTS`. See `DummySoccerDataLoader` and `CsvFileDataLoader` in `src/extractors/`.
