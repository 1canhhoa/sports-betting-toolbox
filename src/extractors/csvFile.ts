import type { OutputDef, ParamGrid, Schema, Table } from "../registry/schema.js";
import { BaseDataLoader } from "./base.js";
import { readCsvFile, recordsToTable, withDateColumn } from "./csvTable.js";
import { SOCCER_OUTPUTS } from "./soccerOutputs.js";

export class CsvFileDataLoader extends BaseDataLoader {
  static override SCHEMA: Schema = [];
  static override OUTPUTS: OutputDef[] = SOCCER_OUTPUTS;
  private readonly filePath: string;
  private cachedData: Table | null = null;

  constructor(filePath: string, paramGrid: ParamGrid | null = null) {
    super(paramGrid);
    this.filePath = filePath;
  }

  static override getFullParamGrid() {
    return [];
  }

  loadFromFile(): Table {
    if (this.cachedData) return this.cachedData;
    const records = readCsvFile(this.filePath);
    if (records.length === 0) {
      throw new Error(`CSV file is empty: ${this.filePath}`);
    }
    this.cachedData = withDateColumn(recordsToTable(records));
    return this.cachedData;
  }

  getData(): Table {
    if (this.cachedData) return this.cachedData;
    return this.loadFromFile();
  }
}
