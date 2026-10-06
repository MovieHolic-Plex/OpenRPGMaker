import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

export type Db = pg.Pool;
export type Tx = pg.PoolClient;

export function createDb(url: string): Db {
  return new pg.Pool({ connectionString: url, max: 10 });
}

/** migrations/*.sql 를 이름 순으로 한 번씩 적용한다. 각 파일은 다시 돌려도 안전하게 쓴다(if not exists). */
export async function migrate(db: Db, dir: string): Promise<void> {
  const files = readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
  const client = await db.connect();
  try {
    await client.query("select pg_advisory_lock(7461)");
    for (const file of files) await client.query(readFileSync(join(dir, file), "utf8"));
  } finally {
    await client.query("select pg_advisory_unlock(7461)").catch(() => undefined);
    client.release();
  }
}

export async function inTx<T>(db: Db, work: (tx: Tx) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("begin");
    const result = await work(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
