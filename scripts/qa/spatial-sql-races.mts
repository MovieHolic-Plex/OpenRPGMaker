import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createInterface } from "node:readline";

const configuredConnection = process.env["SPATIAL_TEST_DATABASE_URL"];
assert(configuredConnection && /^host=\/tmp\/spatial-sql-st_01a07acd\.[A-Za-z0-9]+\/socket dbname=postgres user=[a-z_][a-z0-9_-]*$/.test(configuredConnection),
  "Harness accepts only its task-owned disposable socket database");
const connection = configuredConnection;

class SqlProcessError extends Error {
  readonly name = "SqlProcessError";
  constructor(readonly status: number | null, readonly stderr: string) {
    super(`psql exited ${status}: ${stderr}`);
  }
}

// Mutable process protocol state; each connection has at most one active query.
class SqlSession implements AsyncDisposable {
  readonly process = spawn("psql", [connection, "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1"], { stdio: "pipe" });
  readonly lines = createInterface({ input: this.process.stdout });
  readonly closed = once(this.process, "close");
  private serial = 0;
  private stderr = "";

  constructor() {
    this.process.stderr.setEncoding("utf8");
    this.process.stderr.on("data", (text: string) => { this.stderr += text; });
  }

  waitLine(marker: string): Promise<readonly string[]> {
    const signal = AbortSignal.timeout(15_000);
    return new Promise((resolve, reject) => {
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
  }

  query(sql: string): Promise<readonly string[]> {
    const marker = `SQL_DONE_${++this.serial}`;
    const complete = this.waitLine(marker); // Subscribe before triggering SQL.
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

await using a = new SqlSession();
await using b = new SqlSession();
await a.query("SET SESSION AUTHORIZATION authenticator; SET ROLE anon;");
await b.query("SET SESSION AUTHORIZATION authenticator; SET ROLE anon;");
const results: { readonly scenario: string; readonly result: string }[] = [];

// Given: activation has accepted its root but holds the transaction open.
await a.query(`BEGIN; SELECT rpg_zzu.publish_spatial_project('race-activation-first','raw-sha',
 qa.raw_snapshot('race-activation-first') || jsonb_build_object('spatialAuthoring',qa.document(qa.raw_snapshot('race-activation-first'))),
 'activate',qa.raw_snapshot('race-activation-first'));`);
// When: the old writer starts while activation still owns the parent lock.
const oldWriterStarted = b.waitLine("OLD_WRITER_STARTED");
const oldWriter = b.query(`\\echo OLD_WRITER_STARTED
SELECT qa.reject($q$UPDATE rpg_zzu.maps SET map_json='{}' WHERE project_id='race-activation-first'$q$,'42501');`);
await oldWriterStarted;
await a.query("COMMIT;");
await oldWriter;
// Then: old writer rejects; the accepted raw overlay is preserved.
assert.deepEqual(await a.query("SELECT current_json#>>'{maps,m,name}' FROM rpg_zzu.projects WHERE project_id='race-activation-first';"), ["raw overlay"]);
results.push({ scenario: "activation-first rejects concurrent legacy mirror writer", result: "passed/42501" });

// Given: retain the raw activation baseline before the legacy writer changes it.
await a.query("CREATE TEMP TABLE baseline AS SELECT qa.raw_snapshot('race-writer-first') AS raw;");
await b.query("BEGIN; UPDATE rpg_zzu.maps SET map_json=jsonb_set(map_json,'{name}','\"legacy B\"') WHERE project_id='race-writer-first';");
// The NOWAIT probe proves the mirror guard owns the parent lock, without timing luck.
await a.query("SELECT qa.reject($q$SELECT FROM rpg_zzu.projects WHERE project_id='race-writer-first' FOR UPDATE NOWAIT$q$,'55P03');");
// When: activation begins before the legacy writer releases its parent lock.
const activationStarted = a.waitLine("ACTIVATION_STARTED");
const activation = a.query(`\\echo ACTIVATION_STARTED
SELECT qa.reject(format('SELECT rpg_zzu.publish_spatial_project(%L,%L,%L::jsonb,%L,%L::jsonb)',
 'race-writer-first','raw-sha',raw || jsonb_build_object('spatialAuthoring',qa.document(raw)),'activate',raw),'PT409') FROM baseline;`);
await activationStarted;
await b.query("COMMIT;");
await activation;
// Then: newer legacy overlay survives; activation left no marker/fence.
assert.deepEqual(await a.query("SELECT current_json ? 'spatialAuthoring' FROM rpg_zzu.projects WHERE project_id='race-writer-first';"), ["f"]);
assert.deepEqual(await b.query("SELECT map_json->>'name' FROM rpg_zzu.maps WHERE project_id='race-writer-first';"), ["legacy B"]);
results.push({ scenario: "legacy-mirror-first invalidates raw activation baseline", result: "passed/PT409" });

// Given: a root writer changes the hash while a converter holds the old raw baseline.
await a.query("CREATE TEMP TABLE root_baseline AS SELECT qa.raw_snapshot('race-root-first') AS raw;");
await b.query("BEGIN; UPDATE rpg_zzu.projects SET current_sha256='new-legacy-sha',current_json=current_json || '{\"authored\":\"B\"}' WHERE project_id='race-root-first';");
// When: conversion overlaps that root writer's transaction.
const rootActivationStarted = a.waitLine("ROOT_ACTIVATION_STARTED");
const rootActivation = a.query(`\\echo ROOT_ACTIVATION_STARTED
SELECT qa.reject(format('SELECT rpg_zzu.publish_spatial_project(%L,%L,%L::jsonb,%L,%L::jsonb)',
 'race-root-first','raw-sha',raw || jsonb_build_object('spatialAuthoring',qa.document(raw)),'activate',raw),'PT409') FROM root_baseline;`);
await rootActivationStarted;
await b.query("COMMIT;");
await rootActivation;
assert.deepEqual(await a.query("SELECT current_json->>'authored' FROM rpg_zzu.projects WHERE project_id='race-root-first';"), ["B"]);
results.push({ scenario: "legacy-root-first invalidates activation SHA", result: "passed/PT409" });

// Given: A publishes with the loaded SHA but has not committed yet.
await a.query(`BEGIN; SELECT rpg_zzu.publish_spatial_project('created',receipt->>'sha256',
 jsonb_set(receipt->'project','{meta,title}','"concurrent A"'),'update') FROM qa.accepted WHERE id='updated';`);
// When: stale B starts a publication during A's open transaction.
const staleStarted = b.waitLine("STALE_STARTED");
const stale = b.query(`\\echo STALE_STARTED
SELECT qa.reject(format('SELECT rpg_zzu.publish_spatial_project(%L,%L,qa.canonical(),%L)',
 'created',receipt->>'sha256','update'),'PT409') FROM qa.accepted WHERE id='updated';`);
await staleStarted;
await a.query("COMMIT;");
await stale;
assert.deepEqual(await a.query("SELECT current_json#>>'{meta,title}' FROM rpg_zzu.projects WHERE project_id='created';"), ["concurrent A"]);
results.push({ scenario: "concurrent loaded-SHA update rejects stale B", result: "passed/PT409" });

// Given: A reserves a new project ID in an uncommitted insert-only publication.
await a.query("BEGIN; SELECT rpg_zzu.publish_spatial_project('race-create',NULL,qa.canonical(),'create');");
// When: B races for the same ID before A releases the uniqueness lock.
const createStarted = b.waitLine("CREATE_STARTED");
const create = b.query(`\\echo CREATE_STARTED
SELECT qa.reject($q$SELECT rpg_zzu.publish_spatial_project('race-create',NULL,qa.canonical(),'create')$q$,'PT409');`);
await createStarted;
await a.query("COMMIT;");
await create;
assert.deepEqual(await a.query("SELECT count(*) FROM rpg_zzu.projects WHERE project_id='race-create';"), ["1"]);
results.push({ scenario: "concurrent insert-only create collision", result: "passed/PT409" });
console.log(JSON.stringify({ exit: 0, barrier: "subscribed psql protocol events with open transactions; no sleeps or polling", results }, null, 2));
