import initSqlJs from "sql.js";
import type { Project } from "@/project/types";
import { clearSqliteBytes, readSqliteBytes, writeSqliteBytes } from "./tileMetadataDbIdb";
import { readProjectSnapshot, TILE_METADATA_PROJECT_ID, writeProjectSnapshot, type StoredProject } from "./tileMetadataDbProject";
import { migrateTileMetadataDb } from "./tileMetadataDbSchema";

type SqlDatabase = initSqlJs.Database;

export async function loadProjectFromSqlite(): Promise<StoredProject> {
  return withDatabase((db) => readProjectSnapshot(db));
}

export async function saveProjectToSqlite(project: Project): Promise<void> {
  await withDatabase((db) => {
    db.run("BEGIN");
    try {
      writeProjectSnapshot(db, project);
      db.run("COMMIT");
    } catch (error) {
      db.run("ROLLBACK");
      throw error;
    }
  });
}

export async function clearTileMetadataSqlite(): Promise<void> {
  await clearSqliteBytes();
}

export async function recordAiAnalysisRun(input: {
  readonly tilesetId: string;
  readonly selectedTiles: readonly number[];
  readonly promptContext: unknown;
  readonly result: unknown;
}): Promise<void> {
  await withDatabase((db) => {
    db.run(
      "INSERT INTO ai_analysis_runs(id, project_id, tileset_id, selected_tile_ids_json, prompt_context_json, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        crypto.randomUUID(),
        TILE_METADATA_PROJECT_ID,
        input.tilesetId,
        JSON.stringify(input.selectedTiles),
        JSON.stringify(input.promptContext),
        JSON.stringify(input.result),
        Date.now(),
      ],
    );
  });
}

async function withDatabase<T>(operation: (db: SqlDatabase) => T): Promise<T> {
  const SQL = await initSqlJs({ locateFile: () => sqliteWasmPath() });
  const bytes = await readSqliteBytes();
  const db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  try {
    migrateTileMetadataDb(db);
    const result = operation(db);
    await writeSqliteBytes(db.export());
    return result;
  } finally {
    db.close();
  }
}

function sqliteWasmPath(): string {
  return typeof window === "undefined" ? "public/vendor/sql-wasm.wasm" : "/vendor/sql-wasm.wasm";
}
