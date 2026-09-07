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
/** Mutable server row, isolated per target and per ephemeral server. */
type FixtureRow = {
  root: Record<string, unknown> | null;
  sha: string | null;
  revision: number;
  maps: { map_id: string; map_json: unknown }[];
};

/** Stateful wire fixture, NOT a PostgreSQL authorization/locking implementation. */
export async function spatialPersistenceHttp() {
  const events = new EventEmitter();
  const trace: HttpExchange[] = [];
  const errors: Error[] = [];
  const lifecycle = { closed: false };
  const state: FixtureRow & {
    missingRpc: boolean;
    mirrorFailure: boolean;
    previewTilesets: { tileset_id: string; tileset_json: unknown }[];
    enforceFences: boolean;
    responseOverride: unknown;
    heldPath: string;
  } = {
    root: null, sha: "1".repeat(64), revision: 0, maps: [],
    missingRpc: false, mirrorFailure: false, previewTilesets: [], enforceFences: false, responseOverride: undefined, heldPath: "",
  };
  const targets = new Map<string, FixtureRow>([["transport-fixture", state]]);
  const fenced = new Set<string>();
  const server = createServer((request, response) => {
    const handle = async () => {
      request.setEncoding("utf8");
      let text = "";
      for await (const chunk of request) text += String(chunk);
      const body: unknown = text ? JSON.parse(text) : null;
      const input = body && !Array.isArray(body) ? requireRecord("body", body) : {};
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const path = url.pathname;
      const projectId = String(input.p_project_id ?? input.project_id ?? url.searchParams.get("project_id")?.replace(/^eq\./, "") ?? "transport-fixture");
      let row = targets.get(projectId);
      if (!row) {
        row = { root: null, sha: null, revision: 0, maps: [] };
        targets.set(projectId, row);
      }
      if (row.root && Object.hasOwn(row.root, "spatialAuthoring")) fenced.add(projectId);
      const release = state.heldPath === path ? once(events, "release", { signal: AbortSignal.timeout(5000) }) : undefined;
      events.emit("request", path);
      events.emit(`request:${path}`);
      if (release) await release;
      let status = 200;
      let result: unknown;
      const protectedWrite = request.method !== "GET" && ["/rest/v1/projects", "/rest/v1/maps", "/rest/v1/tilesets", "/rest/v1/terrain_templates"].includes(path);
      if (state.enforceFences && fenced.has(projectId) && protectedWrite) {
        status = 403; result = { code: "42501", message: "Fixture canonical fence" };
      } else if (request.method === "GET" && path === "/rest/v1/projects") {
        result = row.root ? [{ project_id: projectId, current_json: row.root, current_sha256: row.sha }] : [];
      } else if (request.method === "GET" && path === "/rest/v1/maps") {
        const selected = url.searchParams.get("map_id");
        const maps = selected ? row.maps.filter(map => `eq.${map.map_id}` === selected) : row.maps;
        result = url.searchParams.get("select") === "map_id,tileset_id,width,height"
          ? maps.map(map => { const value = requireRecord("preview map", map.map_json); return { map_id: map.map_id, tileset_id: value.tilesetId, width: value.width, height: value.height }; })
          : maps;
      } else if (request.method === "GET" && path === "/rest/v1/tilesets") {
        result = state.previewTilesets;
      } else if ((request.method === "POST" || request.method === "PATCH") && path === "/rest/v1/projects") {
        const collision = request.method === "POST" && !String(request.headers.prefer).includes("merge-duplicates") && row.root !== null;
        const stale = request.method === "PATCH" && url.searchParams.get("current_sha256") !== `eq.${row.sha}`;
        if (collision) { status = 409; result = { code: "23505" }; }
        else if (stale) { result = []; }
        else {
          row.root = requireRecord("current_json", input.current_json);
          row.sha = String(input.current_sha256);
          status = 201; result = request.method === "PATCH" ? [input] : null;
        }
      } else if (path === "/rest/v1/project_commits" || path === "/rest/v1/project_changes") {
        result = [];
      } else if (request.method === "DELETE") {
        if (path === "/rest/v1/maps") row.maps = [];
        status = 204; result = null;
      } else if (request.method === "POST" && path === "/rest/v1/maps") {
        assert(Array.isArray(body));
        row.maps = body.map(value => {
          const map = requireRecord("map row", value);
          return { map_id: String(map.map_id), map_json: map.map_json };
        });
        status = 201; result = null;
      } else if (request.method === "POST" && path === "/rest/v1/tilesets") {
        status = 201; result = null;
      } else if (path.startsWith("/rest/v1/rpc/") && state.missingRpc) {
        status = 404; result = { code: "PGRST202", message: "Function absent from schema cache" };
      } else if (path === "/rest/v1/rpc/publish_spatial_project") {
        const project = requireRecord("project", input.p_project);
        const baseline: unknown = row.root ? JSON.parse(JSON.stringify({ ...row.root, maps: { ...requireRecord("maps", row.root.maps), ...Object.fromEntries(row.maps.map(map => [map.map_id, map.map_json])) } })) : null;
        const stale = input.p_operation === "create" ? row.root !== null : row.root === null || input.p_expected_sha256 !== row.sha;
        if (stale || (input.p_operation === "activate" && (fenced.has(projectId) || !isDeepStrictEqual(input.p_legacy_baseline, baseline)))) {
          status = 409; result = { code: "PT409", message: "Stale root or raw overlay baseline" };
        } else {
          row.root = project;
          row.revision += 1;
          row.sha = row.revision.toString(16).padStart(64, "0");
          fenced.add(projectId);
          result = { project_id: projectId, revision: row.revision, sha256: row.sha, project };
        }
      } else if (path === "/rest/v1/rpc/sync_spatial_mirrors") {
        if (state.mirrorFailure) {
          status = 503; result = { code: "fixture-projection-failure" };
        } else if (input.p_expected_sha256 !== row.sha) {
          status = 409; result = { code: "PT409" };
        } else {
          assert(row.root);
          row.maps = Object.entries(requireRecord("maps", row.root.maps)).map(([map_id, map_json]) => ({ map_id, map_json }));
          result = { project_id: projectId, sha256: row.sha, status: "synced" };
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
      events.emit(`completed:${path}`);
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
    config, state, trace, lifecycle, targets,
    requested: (path?: string) => once(events, path ? `request:${path}` : "request", { signal: AbortSignal.timeout(5000) }),
    completed: (path: string) => once(events, `completed:${path}`, { signal: AbortSignal.timeout(5000) }),
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
