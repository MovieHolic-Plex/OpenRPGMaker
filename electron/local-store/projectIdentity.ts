import { randomUUID } from "node:crypto";
import type { Driver } from "./driver";
import { META_KEYS } from "./schema";

/** A folder copy needs its own ID because the desktop asset protocol routes by project ID. */
export function assignCopiedProjectId(db: Driver, sourceId: string): string {
  const id = randomUUID();
  db.transaction(() => {
    db.prepare("UPDATE meta SET value = ? WHERE key = ?").run([id, META_KEYS.projectId]);
    const tables = new Set(db.prepare("SELECT name FROM sqlite_schema WHERE type = 'table'").all([]).map((row) => row.name));
    for (const table of ["project", "maps", "commits", "ai_activity_logs", "ai_conversations", "ai_analysis_runs"]) {
      if (tables.has(table)) db.prepare(`UPDATE ${table} SET project_id = ? WHERE project_id = ?`).run([id, sourceId]);
    }
  });
  return id;
}
