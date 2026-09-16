import { DatabaseSync } from "node:sqlite";
import { LocalStoreError } from "./errors";

export type DriverValue = string | number | bigint | null | Uint8Array;
export type DriverRow = Readonly<Record<string, DriverValue>>;

export type DriverStatement = {
  run(params: readonly DriverValue[]): void;
  get(params: readonly DriverValue[]): DriverRow | undefined;
  all(params: readonly DriverValue[]): readonly DriverRow[];
};

export type Driver = {
  exec(sql: string): void;
  prepare(sql: string): DriverStatement;
  transaction<T>(work: () => T): T;
  pragmaValue(name: string): DriverValue;
  close(): void;
};

const READABLE_PRAGMAS = ["journal_mode", "synchronous", "foreign_keys", "data_version", "user_version"] as const;
export type ReadablePragma = (typeof READABLE_PRAGMAS)[number];

function toDriverRow(value: unknown): DriverRow {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new LocalStoreError("row", "driver returned a non-object row");
  }
  return value as DriverRow;
}

function firstValue(row: DriverRow): DriverValue {
  const values = Object.values(row);
  if (values.length === 0) throw new LocalStoreError("row", "driver returned an empty row");
  const [first] = values;
  return first ?? null;
}

/** The only file that imports node:sqlite — swapping drivers replaces this and nothing else. */
export function openNodeSqliteDriver(path: string): Driver {
  const db = new DatabaseSync(path);
  return {
    exec(sql: string): void {
      db.exec(sql);
    },
    prepare(sql: string): DriverStatement {
      const statement = db.prepare(sql);
      return {
        run(params: readonly DriverValue[]): void {
          statement.run(...params);
        },
        get(params: readonly DriverValue[]): DriverRow | undefined {
          const row: unknown = statement.get(...params);
          return row === undefined ? undefined : toDriverRow(row);
        },
        all(params: readonly DriverValue[]): readonly DriverRow[] {
          const rows: unknown = statement.all(...params);
          if (!Array.isArray(rows)) throw new LocalStoreError("row", "driver returned a non-array result");
          return rows.map(toDriverRow);
        },
      };
    },
    transaction<T>(work: () => T): T {
      db.exec("BEGIN IMMEDIATE");
      try {
        const result = work();
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    pragmaValue(name: string): DriverValue {
      if (!READABLE_PRAGMAS.some((allowed) => allowed === name)) {
        throw new LocalStoreError("format", `refusing to read PRAGMA ${name}`);
      }
      const row = db.prepare(`PRAGMA ${name}`).get();
      return firstValue(toDriverRow(row));
    },
    close(): void {
      db.close();
    },
  };
}

export function applyStorePragmas(driver: Driver): void {
  driver.exec("PRAGMA journal_mode=WAL");
  driver.exec("PRAGMA synchronous=FULL");
  driver.exec("PRAGMA busy_timeout=5000");
  driver.exec("PRAGMA foreign_keys=ON");
}

export function readDataVersion(driver: Driver): number {
  const value = driver.pragmaValue("data_version");
  return typeof value === "number" ? value : Number(value ?? 0);
}
