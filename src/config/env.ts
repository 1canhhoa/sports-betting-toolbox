import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config } from "dotenv";

let loaded = false;

/** Load `.env` from the project root (once). */
export function loadEnv(): void {
  if (loaded) return;
  const root = resolve(process.cwd(), ".env");
  if (existsSync(root)) {
    config({ path: root });
  }
  loaded = true;
}
