import type {
  FixturesData,
  OutputDef,
  Param,
  ParamGrid,
  Schema,
  Table,
  TrainData,
} from "../types.js";
import { columnNames, isNull, rowCount } from "../types.js";
import { checkScalar } from "../utils/validation.js";
import {
  colsByPrefix,
  createTable,
  dropColumns,
  dropNaColumnsAll,
  dropNaColumnsThresh,
  dropNaRows,
  filterRows,
  inputCols,
  oddsCols,
  parameterGrid,
  parseDate,
  rowsMatchParams,
  selectColumns,
  setIndexFromColumn,
  sortByIndex,
  targetCols,
  todayUtc,
} from "../utils/table.js";

export abstract class BaseDataLoader {
  paramGrid: ParamGrid | null;
  paramGrid_!: Array<Record<string, string | number | boolean | null>>;
  droppedNaCols_!: string[];
  dropNaThres_!: number;
  oddsType_!: string | null;
  inputCols_!: string[];
  outputCols_!: string[];
  oddsCols_!: string[];
  targetCols_!: string[];
  trainData_?: TrainData;
  fixturesData_?: FixturesData;

  static SCHEMA: Schema = [];
  static OUTPUTS: readonly OutputDef[] = [];

  constructor(paramGrid: ParamGrid | null = null) {
    this.paramGrid = paramGrid;
  }

  static getFullParamGrid(): Array<Record<string, string | number | boolean | null>> {
    return [];
  }

  abstract getData(): Table;

  protected checkParamGrid(): this {
    const fullParamGrid = (this.constructor as typeof BaseDataLoader).getFullParamGrid();
    if (this.paramGrid !== null) {
      const fullNames = new Set(
        fullParamGrid.flatMap((p) => Object.keys(p)),
      );
      const gridList = parameterGrid(this.paramGrid);
      for (const params of gridList) {
        for (const name of Object.keys(params)) {
          if (!fullNames.has(name)) {
            throw new ValueError(
              `Parameter grid includes the parameters name(s) ${JSON.stringify([name])} that are not allowed by available data.`,
            );
          }
        }
        const match = fullParamGrid.some((allowed) =>
          Object.entries(params).every(([k, v]) => allowed[k] === v),
        );
        if (!match) {
          throw new ValueError(
            `Parameter grid includes the parameters value(s) ${JSON.stringify(params)} that are not allowed by available data.`,
          );
        }
      }
      this.paramGrid_ = gridList;
    } else {
      this.paramGrid_ = fullParamGrid;
    }
    return this;
  }

  protected convertDataTypes(data: Table): Table {
    const schema = (this.constructor as typeof BaseDataLoader).SCHEMA;
    const columns = { ...data.columns };
    for (const [col, dtype] of schema) {
      if (!(col in columns)) continue;
      const values = [...(columns[col] ?? [])];
      columns[col] = values.map((v) => {
        if (isNull(v)) return dtype === "int" ? -1 : null;
        if (dtype === "int") return Number(v);
        if (dtype === "float") return typeof v === "number" ? v : Number(v);
        if (dtype === "date") {
          if (v instanceof Date) return v;
          if (typeof v === "string") return parseDate(v) ?? null;
        }
        return v;
      });
    }
    return { index: [...data.index], columns };
  }

  protected validateData(): Table {
    let data = this.getData();
    if (rowCount(data) === 0) {
      throw new ValueError("Data should be a table with positive size.");
    }
    if (!("fixtures" in data.columns)) {
      throw new Error(
        "Data should include a boolean column `fixtures` to distinguish between train and fixtures data.",
      );
    }
    if (!("date" in data.columns)) {
      throw new Error("Data should include a datetime column `date` to represent the date.");
    }

    const schema = (this.constructor as typeof BaseDataLoader).SCHEMA;
    const schemaCols = new Set(schema.map(([c]) => c));
    for (const col of columnNames(data)) {
      if (col !== "fixtures" && schema.length > 0 && !schemaCols.has(col)) {
        throw new ValueError("Data contains columns not included in schema.");
      }
    }

    const ordered = schema.map(([c]) => c).filter((c) => c in data.columns);
    data = selectColumns(data, [...ordered, "fixtures"]);
    data = setIndexFromColumn(data, "date");
    data = filterRows(
      data,
      data.index.map((d) => !Number.isNaN(d.getTime())),
    );

    const fixtures = getColumnBool(data, "fixtures");
    const trainMask = fixtures.map((f) => !f);
    const trainData = dropColumns(filterRows(data, trainMask), ["fixtures"]);
    const fullGrid = (this.constructor as typeof BaseDataLoader).getFullParamGrid();
    const paramNames = [...new Set(fullGrid.flatMap((p) => Object.keys(p)))];
    const trainParams = uniqueParamRows(trainData, paramNames);
    for (const row of trainParams) {
      const match = fullGrid.some((allowed) =>
        Object.entries(allowed).every(([k, v]) => row[k] === v),
      );
      if (!match) {
        throw new ValueError("The raw data and available parameters are incompatible.");
      }
    }
    return data;
  }

  protected extractTrainSubset(data: Table): Table {
    const fixtures = getColumnBool(data, "fixtures");
    let subset = dropColumns(filterRows(data, fixtures.map((f) => !f)), ["fixtures"]);
    const matchMask = rowsMatchParams(subset, this.paramGrid_);
    subset = filterRows(subset, matchMask);
    return sortByIndex(subset);
  }

  protected checkDroppedNaCols(data: Table, dropNaThres: number): this {
    const thres = Math.floor(rowCount(data) * dropNaThres);
    const allNa = columnNames(data).filter((col) => {
      const values = data.columns[col] ?? [];
      return values.every((v) => isNull(v));
    });
    const threshNa = columnNames(data).filter((col) => {
      const values = data.columns[col] ?? [];
      return values.filter((v) => !isNull(v)).length < thres;
    });
    const dropped = new Set([...allNa, ...threshNa]);
    const targets = new Set(targetCols(data));
    this.droppedNaCols_ = [...dropped].filter((col) => !targets.has(col));
    const remainingInputs = inputCols(data).filter((c) => !this.droppedNaCols_.includes(c));
    if (remainingInputs.length === 0) {
      throw new ValueError(
        "All input columns were removed. Set `drop_na_thres` parameter to a lower value.",
      );
    }
    return this;
  }

  extractTrainData(dropNaThres = 0, oddsType: string | null = null): TrainData {
    this.checkParamGrid();
    let data = this.validateData();
    data = this.extractTrainSubset(data);

    this.dropNaThres_ = checkScalar(dropNaThres, "drop_na_thres", { min: 0, max: 1 });
    this.checkDroppedNaCols(data, dropNaThres);

    const noAllNa = dropNaColumnsAll(data);
    const availableOddsTypes = [
      ...new Set(
        oddsCols(noAllNa)
          .map((c) => c.split("__")[1]!)
          .filter(Boolean),
      ),
    ].sort();

    if (oddsType !== null && !availableOddsTypes.includes(oddsType)) {
      if (typeof oddsType === "string") {
        throw new ValueError(
          `Parameter \`odds_type\` should be a prefix of available odds columns. Got \`${oddsType}\` instead.`,
        );
      }
      throw new TypeError(
        `Parameter \`odds_type\` should be a prefix of available odds columns. Got \`${oddsType}\` instead.`,
      );
    }
    this.oddsType_ = oddsType;

    const outputs = (this.constructor as typeof BaseDataLoader).OUTPUTS;
    const outputKeysFromDefs = outputs.map(([name]) => name.split("__").slice(1));
    const targetKeysList = targetCols(data).map((c) => c.split("__").slice(2));
    const oddsKeys = oddsCols(data)
      .filter((c) => c.split("__")[1] === oddsType)
      .map((c) => c.split("__").slice(2));
    const sourceKeys = oddsType !== null ? oddsKeys : outputKeysFromDefs;
    const finalKeys = sourceKeys.filter(
      (key) =>
        outputKeysFromDefs.some(
          (ok) => ok.length === key.length && ok.every((v, i) => v === key[i]),
        ) &&
        targetKeysList.some(
          (tk) => tk.length > 0 && key.slice(-1)[0] === tk.slice(-1)[0],
        ),
    );

    this.inputCols_ = inputCols(data).filter((c) => !this.droppedNaCols_.includes(c));
    this.oddsCols_ =
      oddsType !== null
        ? finalKeys.map(([k1, k2]) => `odds__${oddsType}__${k1}__${k2}`)
        : [];
    this.outputCols_ = finalKeys.map(([k1, k2]) => `output__${k1}__${k2}`);
    this.targetCols_ = targetCols(data);

    data = dropNaRows(data, this.targetCols_);
    data = this.convertDataTypes(data);

    const yColumns: Record<string, boolean[]> = {};
    const outputMap = Object.fromEntries(outputs);
    for (const col of this.outputCols_) {
      const fn = outputMap[col];
      if (!fn) continue;
      const targetTable = selectColumns(data, this.targetCols_);
      yColumns[col] = fn(targetTable);
    }
    const Y = createTable(data.index, yColumns);
    const X = selectColumns(data, this.inputCols_);
    const O =
      oddsType !== null ? selectColumns(data, this.oddsCols_) : null;

    this.trainData_ = [X, Y, O];
    delete this.fixturesData_;
    return this.trainData_;
  }

  extractFixturesData(): FixturesData {
    if (!this.trainData_) {
      throw new Error("Extract the training data before extracting the fixtures data.");
    }
    let data = this.validateData();
    const fixtures = getColumnBool(data, "fixtures");
    data = dropColumns(filterRows(data, fixtures), ["fixtures"]);
    data = this.convertDataTypes(data);
    const today = todayUtc();
    data = filterRows(
      data,
      data.index.map((d) => d >= today),
    );
    const O = this.oddsType_ !== null ? selectColumns(data, this.oddsCols_) : null;
    const X = selectColumns(data, this.inputCols_);
    this.fixturesData_ = [X, null, O];
    return this.fixturesData_;
  }

  static getAllParams(): Param[] {
    const full = this.getFullParamGrid();
    return full as Param[];
  }

  getOddsTypes(): string[] {
    this.checkParamGrid();
    let data = this.validateData();
    data = this.extractTrainSubset(data);
    const noAllNa = dropNaColumnsAll(data);
    return [
      ...new Set(
        oddsCols(noAllNa)
          .map((c) => c.split("__")[1]!)
          .filter(Boolean),
      ),
    ].sort();
  }
}

export class ValueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValueError";
  }
}

function getColumnBool(table: Table, name: string): boolean[] {
  return (table.columns[name] ?? []).map((v) => Boolean(v));
}

function uniqueParamRows(
  data: Table,
  paramNames: string[],
): Array<Record<string, string | number | boolean | null>> {
  const seen = new Set<string>();
  const rows: Array<Record<string, string | number | boolean | null>> = [];
  for (let i = 0; i < rowCount(data); i++) {
    const row: Record<string, string | number | boolean | null> = {};
    for (const name of paramNames) {
      if (name in data.columns) {
        row[name] = (data.columns[name]?.[i] ?? null) as string | number | boolean | null;
      }
    }
    const key = JSON.stringify(row);
    if (!seen.has(key)) {
      seen.add(key);
      rows.push(row);
    }
  }
  return rows;
}

export async function loadDataLoader(_path: string): Promise<BaseDataLoader> {
  throw new Error("loadDataLoader requires serialized bettor support (use JSON export in CLI).");
}
