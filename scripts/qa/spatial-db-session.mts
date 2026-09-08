import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";

export function ownedConnection(): string {
  const connection = process.env["SPATIAL_TEST_DATABASE_URL"];
  assert(connection && /^host=\/tmp\/spatial-sql-st_01a07acd\.[A-Za-z0-9]+\/socket dbname=postgres user=[a-z_][a-z0-9_-]*$/.test(connection),
    "Only a run-owned socket database is permitted");
  return connection;
}
export function literal(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  assert(text !== undefined);
  return `'${text.replaceAll("'", "''")}'`;
}
class SqlProcessError extends Error {
  constructor(readonly status: number | null, readonly stderr: string) { super(`psql exited ${status}: ${stderr}`); }
}
/** Mutable single-query psql protocol, shared by holders and observers. */
export class SqlSession implements AsyncDisposable {
  readonly process = spawn("psql", [ownedConnection(), "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1"], { stdio: "pipe" });
  readonly lines = createInterface({ input: this.process.stdout });
  readonly closed = once(this.process, "close");
  private serial = 0;
  private stderr = "";
  constructor() {
    this.process.stderr.setEncoding("utf8");
    this.process.stderr.on("data", (text: string) => { this.stderr += text; });
  }
  query(sql: string): Promise<readonly string[]> {
    const marker = `SQL_DONE_${++this.serial}`;
    const signal = AbortSignal.timeout(15_000);
    const complete = new Promise<readonly string[]>((resolve, reject) => {
      const output: string[] = [];
      const cleanup = () => {
        this.lines.off("line", onLine);
        this.process.off("close", onClose);
        signal.removeEventListener("abort", onAbort);
      };
      const onLine = (line: string) => {
        if (line === marker) { cleanup(); resolve(output); }
        else output.push(line);
      };
      const onClose = (status: number | null) => { cleanup(); reject(new SqlProcessError(status, this.stderr)); };
      const onAbort = () => { cleanup(); reject(new SqlProcessError(null, `barrier ${marker} timed out; ${this.stderr}`)); };
      this.lines.on("line", onLine);
      this.process.once("close", onClose);
      signal.addEventListener("abort", onAbort, { once: true });
    });
    this.process.stdin.write(`${sql}\n\\echo ${marker}\n`);
    return complete;
  }
  async [Symbol.asyncDispose](): Promise<void> {
    if (this.process.exitCode === null) this.process.stdin.end("ROLLBACK;\n\\q\n");
    const signal = AbortSignal.timeout(5_000);
    const terminate = () => { this.process.kill("SIGKILL"); };
    signal.addEventListener("abort", terminate, { once: true });
    try {
      const [status] = await this.closed;
      assert.equal(status, 0, this.stderr);
    } finally {
      signal.removeEventListener("abort", terminate);
      this.lines.close();
    }
  }
}
