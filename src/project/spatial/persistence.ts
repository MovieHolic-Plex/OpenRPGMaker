import { projectWithoutEventDrafts } from "../eventDrafts";
import { serialize } from "../io";
import type { SupabaseProjectConfig } from "../supabaseProjectConfig";
import { requestSpatialJson } from "./persistenceHttp";
import { SpatialPersistenceError, type AcceptedSpatialPublication, type MirrorStatus, type RawLegacyCapture, type RawObject, type RootSnapshot, type SpatialPublication } from "./persistenceTypes";
import { assertTarget, projectPreview, rawObject, serverSHA } from "./persistenceWire";
export * from "./persistenceTypes";

/** Publish once using the loaded token. A failure never refreshes authority or falls back. */
export async function publishSpatialProject(input: SpatialPublication, config: SupabaseProjectConfig, signal?: AbortSignal): Promise<AcceptedSpatialPublication> {
  let project: RawObject;
  let expectedSHA: string | null;
  let baseline: RawObject | null = null;
  switch (input.operation) {
    case "create":
      project = rawObject(JSON.parse(serialize(projectWithoutEventDrafts(input.project))));
      expectedSHA = null;
      break;
    case "update":
      project = rawObject(JSON.parse(serialize(projectWithoutEventDrafts(input.project))));
      expectedSHA = serverSHA(input.serverSHA);
      break;
    case "activate":
      assertTarget(input.capture.projectId, config.projectId);
      // Ordinary JSON only: serialization would remove fields SQL requires to match the baseline.
      project = rawObject(JSON.parse(JSON.stringify(input.project)));
      baseline = rawObject(input.capture.baseline);
      if (baseline.version !== 4) throw new SpatialPersistenceError("unsupported-legacy-version", "Raw activation requires project v4; use an explicit copy/migration for older input.");
      expectedSHA = serverSHA(input.capture.serverSHA);
      break;
    default: return assertNever(input);
  }
  projectPreview(project, true);
  const response = await requestSpatialJson(config, { path: "rpc/publish_spatial_project", signal, body: {
    p_project_id: config.projectId, p_expected_sha256: expectedSHA, p_operation: input.operation,
    p_project: project, p_legacy_baseline: baseline,
  } });
  try {
    const receipt = rawObject(response);
    assertTarget(receipt.project_id, config.projectId);
    if (typeof receipt.revision !== "number" || !Number.isSafeInteger(receipt.revision) || receipt.revision < 1) {
      throw new SpatialPersistenceError("invalid-response", "Publication response requires a positive safe server revision.");
    }
    const accepted = rawObject(receipt.project);
    return { kind: "accepted", projectId: config.projectId, revision: receipt.revision,
      serverSHA: serverSHA(receipt.sha256), project: accepted, preview: projectPreview(accepted, true) };
  } catch (error) {
    if (error instanceof SpatialPersistenceError) throw new SpatialPersistenceError("invalid-response", error.message);
    throw error;
  }
}

/** Root-only snapshot: canonical authority includes an empty library. No registry access. */
export async function readSpatialRootSnapshot(config: SupabaseProjectConfig, signal?: AbortSignal): Promise<RootSnapshot | null> {
  const row = await readRawRoot(config, signal);
  if (!row) return null;
  const canonical = Object.hasOwn(row.rawRoot, "spatialAuthoring");
  const preview = projectPreview(row.rawRoot, canonical);
  const common = { projectId: config.projectId, rawRoot: row.rawRoot, preview };
  return canonical
    ? { ...common, mode: "canonical", serverSHA: serverSHA(row.sha) }
    : { ...common, mode: "legacy", serverSHA: row.sha === null ? null : serverSHA(row.sha) };
}

/** Capture before ANY deserialize/repair. The raw overlay and root SHA are independent CAS inputs. */
export async function captureRawLegacySnapshot(config: SupabaseProjectConfig, signal?: AbortSignal): Promise<RawLegacyCapture | null> {
  const row = await readRawRoot(config, signal);
  if (!row) return null;
  if (Object.hasOwn(row.rawRoot, "spatialAuthoring")) {
    projectPreview(row.rawRoot, true); // Invalid markers must fail as invalid, never become legacy.
    throw new SpatialPersistenceError("already-canonical", "This root is already canonical; activation is not a read operation.");
  }
  if (row.rawRoot.version !== 4) throw new SpatialPersistenceError("unsupported-legacy-version", "Raw activation requires project v4; use an explicit copy/migration for older input.");
  const sha = serverSHA(row.sha);
  const query = new URLSearchParams({ project_id: `eq.${config.projectId}`, select: "map_id,map_json" });
  const rows = await requestSpatialJson(config, { path: `maps?${query}`, signal });
  if (!Array.isArray(rows)) throw new SpatialPersistenceError("invalid-response", "Raw maps response must be an array.");
  const rawMapRows = rows.map(value => {
    const map = rawObject(value);
    if (typeof map.map_id !== "string" || !map.map_id || !Object.hasOwn(map, "map_json")) {
      throw new SpatialPersistenceError("invalid-response", "Raw map row requires map_id and map_json.");
    }
    return { map_id: map.map_id, map_json: map.map_json };
  });
  const maps = { ...rawObject(row.rawRoot.maps), ...Object.fromEntries(rawMapRows.map(map => [map.map_id, map.map_json])) };
  const baseline = { ...row.rawRoot, maps };
  return { projectId: config.projectId, serverSHA: sha, rawRoot: row.rawRoot, rawMapRows, baseline, preview: projectPreview(baseline, false) };
}

/** Separate projection transaction. A warning can never revoke an accepted publication. */
export async function syncSpatialMirrors(accepted: AcceptedSpatialPublication, config: SupabaseProjectConfig, signal?: AbortSignal): Promise<MirrorStatus> {
  try {
    assertTarget(accepted.projectId, config.projectId);
    const response = rawObject(await requestSpatialJson(config, { path: "rpc/sync_spatial_mirrors", signal, body: {
      p_project_id: accepted.projectId, p_expected_sha256: accepted.serverSHA,
    } }));
    assertTarget(response.project_id, accepted.projectId);
    if (response.status !== "synced" || response.sha256 !== accepted.serverSHA) throw new SpatialPersistenceError("invalid-response", "Mirror acknowledgement differs from the accepted revision.");
    return { status: "synced" };
  } catch (error) {
    if (error instanceof Error) return { status: "warning", error };
    throw error;
  }
}

async function readRawRoot(config: SupabaseProjectConfig, signal?: AbortSignal) {
  const query = new URLSearchParams({ select: "project_id,current_json,current_sha256", project_id: `eq.${config.projectId}` });
  const rows = await requestSpatialJson(config, { path: `projects?${query}`, signal });
  if (!Array.isArray(rows) || rows.length > 1) throw new SpatialPersistenceError("invalid-response", "Root response must contain at most one project row.");
  if (rows.length === 0) return null;
  const row = rawObject(rows[0]);
  assertTarget(row.project_id, config.projectId);
  return { rawRoot: rawObject(row.current_json), sha: row.current_sha256 };
}
function assertNever(value: never): never { throw new TypeError(`Unknown publication operation: ${String(value)}`); }
