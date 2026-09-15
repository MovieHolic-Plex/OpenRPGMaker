import { DatabaseSync } from "node:sqlite";

const PRAGMA_NAMES = ["journal_mode", "synchronous", "foreign_keys", "data_version", "page_count"] as const;
type PragmaName = (typeof PRAGMA_NAMES)[number];

/** Verifies a store file with a second, independent connection instead of trusting the writer's own report. */
export function readPragmaWithForeignConnection(dbPath: string, pragma: PragmaName): string {
  const db = new DatabaseSync(dbPath);
  try {
    const row = db.prepare(`PRAGMA ${pragma}`).get() as Record<string, unknown> | undefined;
    if (!row) throw new Error(`PRAGMA ${pragma} returned no row`);
    const first = Object.values(row)[0];
    return String(first);
  } finally {
    db.close();
  }
}

/** Runs a write from a foreign connection so the open store can observe a changed data_version. */
export function overwriteTitleFromForeignConnection(dbPath: string, title: string): void {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec("PRAGMA busy_timeout=5000");
    db.prepare("UPDATE project SET title = ? WHERE id = 1").run(title);
  } finally {
    db.close();
  }
}
