import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHmac, randomBytes } from "node:crypto";
import { EventEmitter, once } from "node:events";
import { appendFile, writeFile } from "node:fs/promises";
import { createServer, request as httpRequest } from "node:http";
import { resolve } from "node:path";
import { ownedConnection, SqlSession } from "./spatial-db-session.mts";
import { rawObject } from "../../src/project/spatial/persistenceWire";

/** Real PostgREST with a byte-preserving loopback recorder; no SQL or HTTP-result emulation. */
export async function postgrest(evidence: string) {
  const connection = ownedConnection();
  const owned = connection.slice(5).split("/socket ")[0];
  assert(owned);
  const binary = process.env["SPATIAL_TEST_POSTGREST_BIN"];
  assert(binary?.startsWith("/") && binary.endsWith("/postgrest"), "Explicit local PostgREST binary required");
  const socket = `${owned}/postgrest.sock`;
  const secret = randomBytes(32).toString("hex");
  const encoded = [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
    Buffer.from('{"role":"anon"}').toString("base64url")].join(".");
  const token = `${encoded}.${createHmac("sha256", secret).update(encoded).digest("base64url")}`;
  const child = spawn(binary, [], { env: { PATH: process.env["PATH"], LC_ALL: "C",
    PGRST_DB_URI: `postgresql://authenticator@/postgres?host=${owned}/socket&application_name=task20-postgrest`,
    PGRST_DB_SCHEMAS: "rpg_zzu", PGRST_DB_ANON_ROLE: "anon", PGRST_DB_POOL: "1", PGRST_DB_CHANNEL_ENABLED: "false",
    PGRST_SERVER_UNIX_SOCKET: socket, PGRST_JWT_SECRET: secret, PGRST_LOG_LEVEL: "info" }, stdio: ["ignore", "pipe", "pipe"] });
  const closed = once(child, "close");
  const errors: Error[] = [];
  const events = new EventEmitter();
  const trace: { readonly method: string; readonly path: string; readonly requestHeaders: readonly string[];
    readonly requestBody: string; readonly status: number; readonly statusMessage: string;
    readonly responseHeaders: readonly string[]; readonly responseBody: string }[] = [];
  const server = createServer((incoming, outgoing) => {
    // Test boundary catches become fatal at disposal, never successful fake SQL responses.
    const handle = async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) { assert(Buffer.isBuffer(chunk)); chunks.push(chunk); }
      const body = Buffer.concat(chunks);
      const path = (incoming.url ?? "/").replace(/^\/rest\/v1/, "");
      const received = await new Promise<{ readonly status: number; readonly statusMessage: string;
        readonly headers: readonly string[]; readonly body: Buffer }>((resolveResponse, reject) => {
        const request = httpRequest({ socketPath: socket, path, method: incoming.method,
          headers: incoming.headers, signal: AbortSignal.timeout(30_000) }, response => {
          const parts: Buffer[] = [];
          response.on("data", (part: Buffer) => parts.push(part));
          response.on("error", reject);
          response.on("end", () => resolveResponse({ status: response.statusCode ?? 500,
            statusMessage: response.statusMessage ?? "", headers: response.rawHeaders, body: Buffer.concat(parts) }));
        });
        request.on("error", reject);
        request.end(body);
      });
      const headers: string[] = [];
      for (let index = 0; index < incoming.rawHeaders.length; index += 2) {
        const name = incoming.rawHeaders[index]; const value = incoming.rawHeaders[index + 1];
        assert(name && value !== undefined);
        headers.push(name, /^(authorization|apikey)$/i.test(name) ? "[run-owned JWT redacted]" : value);
      }
      trace.push({ method: incoming.method ?? "GET", path: incoming.url ?? "/", requestHeaders: headers,
        requestBody: body.toString("utf8"), status: received.status, statusMessage: received.statusMessage,
        responseHeaders: received.headers, responseBody: received.body.toString("utf8") });
      outgoing.writeHead(received.status, received.statusMessage, [...received.headers]);
      outgoing.end(received.body);
      events.emit(`completed:${path.split("?")[0]}`);
    };
    void handle().catch(error => {
      if (!(error instanceof Error)) throw error;
      errors.push(error); outgoing.destroy(error);
    });
  });
  let logs = "";
  let disposed = false;
  const dispose = async () => {
    if (disposed) return;
    disposed = true;
    if (server.listening) {
      const stopped = new Promise<void>((accept, reject) => server.close(error => error ? reject(error) : accept()));
      server.closeAllConnections(); await stopped;
    }
    const deadline = AbortSignal.timeout(5000);
    const kill = () => { child.kill("SIGKILL"); };
    deadline.addEventListener("abort", kill, { once: true });
    child.kill("SIGTERM");
    const [status, signal] = await closed.finally(() => deadline.removeEventListener("abort", kill));
    await writeFile(resolve(evidence, "postgrest.log"), logs);
    await writeFile(resolve(evidence, "http.json"), JSON.stringify({ implementation: "PostgREST 13.0.7 / PostgreSQL 16",
      localJwtOnly: true, deploymentProven: false, exchanges: trace }, null, 2));
    await writeFile(resolve(evidence, "process-cleanup.json"), JSON.stringify({ pid: child.pid, status, signal,
      proxyClosed: !server.listening, remoteCalls: 0, errors: errors.map(error => error.message) }, null, 2));
    // The pinned PostgREST binary translates requested TERM shutdown to SIGINT.
    assert(status === 0 || signal === "SIGTERM" || signal === "SIGINT", logs);
    assert.deepEqual(errors, []);
  };
  try {
    await new Promise<void>((accept, reject) => {
      const signal = AbortSignal.timeout(15_000);
      const finish = () => { signal.removeEventListener("abort", abort); child.off("close", earlyClose); };
      const abort = () => { finish(); reject(new TypeError(`PostgREST readiness deadline: ${logs}`)); };
      const earlyClose = () => { finish(); reject(new TypeError(`PostgREST exited before schema readiness: ${logs}`)); };
      const output = (chunk: Buffer) => {
        logs += chunk.toString("utf8");
        if (logs.includes("Schema cache loaded") && logs.includes("API server listening on unix socket")) { finish(); accept(); }
      };
      child.stdout.on("data", output); child.stderr.on("data", output);
      child.once("close", earlyClose); child.once("error", reject);
      signal.addEventListener("abort", abort, { once: true });
    });
    const listening = once(server, "listening", { signal: AbortSignal.timeout(5000) });
    server.listen(0, "127.0.0.1"); await listening;
    const address = server.address(); assert(address && typeof address !== "string");
    const url = `http://127.0.0.1:${address.port}`;
    const identity = await fetch(`${url}/rest/v1/rpc/task20_session`, { headers: {
      Authorization: `Bearer ${token}`, "Accept-Profile": "rpg_zzu" }, signal: AbortSignal.timeout(5000) });
    assert.equal(identity.status, 200);
    const session = rawObject(await identity.json());
    assert.equal(session.caller, "anon"); assert.equal(session.session, "authenticator"); assert.equal(session.writerMember, false);
    assert(typeof session.pid === "number" && Number.isSafeInteger(session.pid) && session.pid > 0);
    const pid = String(session.pid);
    await using observer = new SqlSession();
    await appendFile(resolve(evidence, "roles.json"), JSON.stringify(await observer.query(
      "SELECT jsonb_build_object('rolname',rolname,'rolsuper',rolsuper,'rolcanlogin',rolcanlogin,'memberships',(SELECT count(*) FROM pg_auth_members WHERE member=r.oid)) FROM pg_roles r WHERE rolname IN ('authenticator','anon','spatial_project_writer');")));
    return { config: { url, anonKey: token, projectId: "task20" }, pid, trace,
      completed: (path: string) => once(events, `completed:${path}`, { signal: AbortSignal.timeout(30_000) }),
      [Symbol.asyncDispose]: dispose };
  } catch (error) { await dispose(); throw error; }
}
