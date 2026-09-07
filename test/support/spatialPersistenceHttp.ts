import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { createServer } from "node:http";
import { isDeepStrictEqual } from "node:util";
import { requireRecord } from "../../src/project/io/guards";
import type { SupabaseProjectConfig } from "../../src/project/supabaseProjectConfig";

export type HttpExchange = {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  readonly body: unknown;
  readonly status: number;
  readonly response: unknown;
};

/** Stateful wire fixture, NOT a PostgreSQL authorization/locking implementation. */
export async function spatialPersistenceHttp() {
  const events = new EventEmitter();
  const trace: HttpExchange[] = [];
  const errors: Error[] = [];
  const lifecycle = { closed: false };
  // The fixture owns mutation and issues deliberately opaque, non-client-derived tokens.
  const state: {
    root: Record<string, unknown> | null;
    sha: string | null;
    revision: number;
    maps: { map_id: string; map_json: unknown }[];
    missingRpc: boolean;
    mirrorFailure: boolean;
    responseOverride: unknown;
    heldPath: string;
  } = {
    root: null, sha: "1".repeat(64), revision: 0, maps: [],
    missingRpc: false, mirrorFailure: false, responseOverride: undefined, heldPath: "",
  };
  const server = createServer((request, response) => {
    const handle = async () => {
      request.setEncoding("utf8");
      let text = "";
      for await (const chunk of request) text += String(chunk);
      const body: unknown = text ? JSON.parse(text) : null;
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const path = url.pathname;
      const release = state.heldPath === path ? once(events, "release", { signal: AbortSignal.timeout(5000) }) : undefined;
      events.emit("request", path);
      if (release) await release;
      let status = 200;
      let result: unknown;
      if (request.method === "GET" && path === "/rest/v1/projects") {
        result = state.root ? [{ project_id: "transport-fixture", current_json: state.root, current_sha256: state.sha }] : [];
      } else if (request.method === "GET" && path === "/rest/v1/maps") {
        result = state.maps;
      } else if (request.method === "POST" && path === "/rest/v1/projects") {
        const input = requireRecord("legacy upsert", body);
        state.root = requireRecord("current_json", input.current_json);
        state.sha = String(input.current_sha256);
        status = 201; result = null;
      } else if (request.method === "DELETE") {
        if (path === "/rest/v1/maps") state.maps = [];
        status = 204; result = null;
      } else if (request.method === "POST" && path === "/rest/v1/maps") {
        assert(Array.isArray(body));
        state.maps = body.map(value => {
          const row = requireRecord("map row", value);
          return { map_id: String(row.map_id), map_json: row.map_json };
        });
        status = 201; result = null;
      } else if (request.method === "POST" && path === "/rest/v1/tilesets") {
        status = 201; result = null;
      } else if (path.startsWith("/rest/v1/rpc/") && state.missingRpc) {
        status = 404; result = { code: "PGRST202", message: "Function absent from schema cache" };
      } else if (path === "/rest/v1/rpc/publish_spatial_project") {
        const input = requireRecord("publication", body);
        const project = requireRecord("project", input.p_project);
        // The service compares JSON values, not fixture-only undefined properties lost on the wire.
        const baseline: unknown = state.root ? JSON.parse(JSON.stringify({ ...state.root, maps: { ...requireRecord("maps", state.root.maps), ...Object.fromEntries(state.maps.map(row => [row.map_id, row.map_json])) } })) : null;
        const stale = input.p_operation === "create" ? state.root !== null : state.root === null || input.p_expected_sha256 !== state.sha;
        if (stale || (input.p_operation === "activate" && !isDeepStrictEqual(input.p_legacy_baseline, baseline))) {
          status = 409; result = { code: "PT409", message: "Stale root or raw overlay baseline" };
        } else {
          state.root = project;
          state.revision += 1;
          state.sha = state.revision.toString(16).padStart(64, "0");
          result = { project_id: "transport-fixture", revision: state.revision, sha256: state.sha, project };
        }
      } else if (path === "/rest/v1/rpc/sync_spatial_mirrors") {
        const input = requireRecord("mirror", body);
        if (state.mirrorFailure) {
          status = 503; result = { code: "fixture-projection-failure" };
        } else if (input.p_expected_sha256 !== state.sha) {
          status = 409; result = { code: "PT409" };
        } else {
          assert(state.root);
          state.maps = Object.entries(requireRecord("maps", state.root.maps)).map(([map_id, map_json]) => ({ map_id, map_json }));
          result = { project_id: "transport-fixture", sha256: state.sha, status: "synced" };
        }
      } else {
        status = 404; result = { code: "fixture-unhandled-route" };
      }
      if (state.responseOverride !== undefined) result = state.responseOverride;
      const headers = { ...request.headers };
      delete headers.authorization;
      delete headers.apikey;
      trace.push({ method: request.method ?? "GET", path: request.url ?? path, headers, body, status, response: structuredClone(result) });
      response.writeHead(status, { "Content-Type": "application/json" });
      response.end(status === 204 ? undefined : JSON.stringify(result));
    };
    void handle().catch(error => {
      if (!(error instanceof Error)) throw error;
      errors.push(error);
      response.writeHead(500); response.end(JSON.stringify({ code: "fixture-error", message: error.message }));
    });
  });
  const listening = once(server, "listening", { signal: AbortSignal.timeout(5000) });
  server.listen(0, "127.0.0.1");
  await listening;
  const address = server.address();
  assert(address && typeof address !== "string");
  const config: SupabaseProjectConfig = { url: `http://127.0.0.1:${address.port}`, anonKey: "local-fixture-only", projectId: "transport-fixture" };
  return {
    config, state, trace, lifecycle,
    requested: () => once(events, "request", { signal: AbortSignal.timeout(5000) }),
    release: () => events.emit("release"),
    async [Symbol.asyncDispose]() {
      events.emit("release");
      const closed = new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      server.closeAllConnections();
      await closed;
      lifecycle.closed = true;
      assert.deepEqual(errors, []);
    },
  };
}
