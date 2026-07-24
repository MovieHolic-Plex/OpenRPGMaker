import { readFile } from "node:fs/promises";

import {
  ADVENTURE_MAP_ID,
  CANONICAL_MAP_ID,
  DERIVED_MAP_ID,
  PreflightError,
  collectTreeLocations,
  hashValue,
  isRecord,
  normalizeSupabaseOrigin,
  recordAt,
  sha256Bytes,
  treeAt,
} from "./preflightCore.mjs";

type RemoteConfig = { readonly anonKey: string; readonly origin: string };
type RemoteProjectRow = {
  readonly currentJson: Record<string, unknown>;
  readonly currentSha256: string;
  readonly projectId: string;
  readonly title: string;
};
type RemoteMapRow = { readonly mapId: string; readonly mapJson: Record<string, unknown> };

export type ProtectedBaseline = {
  readonly adventure: MapBaseline;
  readonly baseProjectSemanticSha256: string;
  readonly canonical: MapBaseline;
  readonly currentSha256: string;
  readonly ownedArtifactConflicts: readonly string[];
  readonly projectId: string;
  readonly startTupleSha256: string;
  readonly stripOwnedArtifactsSha256: string;
  readonly supabaseOriginSha256: string;
  readonly supabaseTenantSha256: string;
  readonly title: string;
};
type MapBaseline = {
  readonly effectiveGameMapSha256: string;
  readonly height: number;
  readonly lowerLength: number;
  readonly projectRowGameMapSha256: string;
  readonly treeLocationSha256: string;
  readonly treeLocations: readonly { readonly childIndexes: readonly number[]; readonly mapIds: readonly string[] }[];
  readonly upperLength: number;
  readonly width: number;
};

export async function loadRemoteConfig(cwd: string): Promise<RemoteConfig> {
  const fileEnv = { ...(await readEnv(`${cwd}/.env`)), ...(await readEnv(`${cwd}/.env.local`)) };
  const url = process.env.VITE_SUPABASE_URL?.trim() || fileEnv.VITE_SUPABASE_URL || "";
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY?.trim() || fileEnv.VITE_SUPABASE_ANON_KEY || "";
  if (!url || !anonKey) throw new PreflightError("CONFIG_MISSING", "Supabase URL and anon key are required");
  return { anonKey, origin: normalizeSupabaseOrigin(url) };
}

export async function readProtectedBaseline(config: RemoteConfig, projectId: string): Promise<ProtectedBaseline> {
  const row = await readProjectRow(config, projectId);
  if (row.projectId !== projectId) throw new PreflightError("TARGET_IDENTITY_MISMATCH", "Remote project identity changed");
  const maps = recordAt(row.currentJson, "maps");
  const canonicalRaw = recordAt(maps, CANONICAL_MAP_ID);
  const adventureRaw = recordAt(maps, ADVENTURE_MAP_ID);
  const childRows = await readMapRows(config, projectId, [CANONICAL_MAP_ID, ADVENTURE_MAP_ID]);
  const effectiveCanonical = childRows.find((item) => item.mapId === CANONICAL_MAP_ID)?.mapJson ?? canonicalRaw;
  const effectiveAdventure = childRows.find((item) => item.mapId === ADVENTURE_MAP_ID)?.mapJson ?? adventureRaw;
  const tree = treeAt(row.currentJson.mapTree);
  const canonicalLocations = exactSingleLocation(tree, CANONICAL_MAP_ID);
  const adventureLocations = exactSingleLocation(tree, ADVENTURE_MAP_ID);
  const ownedArtifactConflicts = ownedConflicts(row.currentJson, tree);
  const host = new URL(config.origin).hostname.split(".")[0] ?? "";
  return {
    adventure: mapBaseline(adventureRaw, effectiveAdventure, adventureLocations),
    baseProjectSemanticSha256: hashValue(row.currentJson),
    canonical: mapBaseline(canonicalRaw, effectiveCanonical, canonicalLocations),
    currentSha256: row.currentSha256,
    ownedArtifactConflicts,
    projectId: row.projectId,
    startTupleSha256: hashValue({ startMapId: row.currentJson.startMapId, startPos: row.currentJson.startPos }),
    stripOwnedArtifactsSha256: hashValue(stripOwnedArtifacts(row.currentJson)),
    supabaseOriginSha256: sha256Bytes(config.origin),
    supabaseTenantSha256: sha256Bytes(host),
    title: row.title,
  };
}

async function readProjectRow(config: RemoteConfig, projectId: string): Promise<RemoteProjectRow> {
  const query = new URLSearchParams({ project_id: `eq.${projectId}`, select: "project_id,title,current_json,current_sha256" });
  const rows = await fetchRows(`${config.origin}/rest/v1/projects?${query}`, config);
  const value = rows[0];
  if (!value) throw new PreflightError("PROJECT_NOT_FOUND", "Explicit project was not found");
  if (value.project_id !== projectId || typeof value.title !== "string" || !isRecord(value.current_json)) {
    throw new PreflightError("TARGET_IDENTITY_MISMATCH", "Remote project row has an unexpected identity or shape");
  }
  if (typeof value.current_sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(value.current_sha256)) {
    throw new PreflightError("TARGET_IDENTITY_MISMATCH", "Remote project revision is missing or invalid");
  }
  return { currentJson: value.current_json, currentSha256: value.current_sha256, projectId, title: value.title };
}

async function readMapRows(config: RemoteConfig, projectId: string, mapIds: readonly string[]): Promise<readonly RemoteMapRow[]> {
  const filter = `in.(${mapIds.join(",")})`;
  const query = new URLSearchParams({ map_id: filter, project_id: `eq.${projectId}`, select: "project_id,map_id,map_json" });
  const rows = await fetchRows(`${config.origin}/rest/v1/maps?${query}`, config);
  return rows.flatMap((row) => row.project_id === projectId && typeof row.map_id === "string" && isRecord(row.map_json)
    ? [{ mapId: row.map_id, mapJson: row.map_json }]
    : []);
}

async function fetchRows(url: string, config: RemoteConfig): Promise<readonly Record<string, unknown>[]> {
  let response: Response;
  try {
    response = await fetch(url, { headers: remoteHeaders(config), signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    if (error instanceof Error) throw new PreflightError("REMOTE_READ_FAILED", "Remote read failed or timed out");
    throw error;
  }
  if (!response.ok) throw new PreflightError("REMOTE_READ_FAILED", `Remote read returned HTTP ${response.status}`);
  const parsed: unknown = await response.json();
  if (!Array.isArray(parsed) || !parsed.every(isRecord)) {
    throw new PreflightError("REMOTE_READ_FAILED", "Remote read returned an invalid row set");
  }
  return parsed;
}

function remoteHeaders(config: RemoteConfig): Readonly<Record<string, string>> {
  return { "Accept-Profile": "rpg_zzu", Authorization: `Bearer ${config.anonKey}`, apikey: config.anonKey };
}

function exactSingleLocation(tree: ReturnType<typeof treeAt>, mapId: string) {
  const locations = collectTreeLocations(tree, mapId);
  if (locations.length !== 1) throw new PreflightError("TREE_DUPLICATE", `${mapId} must occur exactly once in the map tree`);
  return locations;
}

function mapBaseline(raw: Record<string, unknown>, effective: Record<string, unknown>, locations: ReturnType<typeof collectTreeLocations>): MapBaseline {
  if (typeof effective.width !== "number" || typeof effective.height !== "number") {
    throw new PreflightError("PROTECTED_MAP_MISSING", "Protected map dimensions are missing");
  }
  const lower = effective.lowerTiles;
  const upper = effective.upperTiles;
  if (!Array.isArray(lower) || !Array.isArray(upper)) throw new PreflightError("PROTECTED_MAP_MISSING", "Protected map layers are missing");
  return {
    effectiveGameMapSha256: hashValue(effective),
    height: effective.height,
    lowerLength: lower.length,
    projectRowGameMapSha256: hashValue(raw),
    treeLocationSha256: hashValue(locations),
    treeLocations: locations,
    upperLength: upper.length,
    width: effective.width,
  };
}

function ownedConflicts(project: Record<string, unknown>, tree: ReturnType<typeof treeAt>): readonly string[] {
  const conflicts: string[] = [];
  if (isRecord(project.maps) && DERIVED_MAP_ID in project.maps) conflicts.push(`map:${DERIVED_MAP_ID}`);
  if (collectTreeLocations(tree, DERIVED_MAP_ID).length > 0) conflicts.push(`tree:${DERIVED_MAP_ID}`);
  return conflicts;
}

function stripOwnedArtifacts(project: Record<string, unknown>): Record<string, unknown> {
  const copy: unknown = JSON.parse(JSON.stringify(project));
  if (!isRecord(copy)) throw new PreflightError("TARGET_IDENTITY_MISMATCH", "Project clone failed");
  if (isRecord(copy.maps)) delete copy.maps[DERIVED_MAP_ID];
  if (Array.isArray(copy.switches)) copy.switches = copy.switches.filter((item) => !isRecord(item) || !ownedSwitchIds.has(String(item.id)));
  if (isRecord(copy.mapTree)) copy.mapTree = stripTree(copy.mapTree);
  return copy;
}

function stripTree(value: Record<string, unknown>): Record<string, unknown> {
  const children = Array.isArray(value.children) ? value.children.filter(isRecord).filter((child) => child.mapId !== DERIVED_MAP_ID).map(stripTree) : [];
  return { ...value, children };
}

const ownedSwitchIds = new Set([
  "sw_ice_expanse_seal_west", "sw_ice_expanse_seal_east", "sw_ice_expanse_gate_open", "sw_ice_expanse_boss_clear",
  "sw_ice_expanse_guard_01_clear", "sw_ice_expanse_guard_02_clear", "sw_ice_expanse_guard_03_clear",
  "sw_ice_expanse_guard_04_clear", "sw_ice_expanse_checkpoint_summit",
]);

async function readEnv(file: string): Promise<Record<string, string>> {
  try {
    const text = await readFile(file, "utf8");
    return Object.fromEntries(text.split(/\r?\n/u).flatMap((line) => {
      const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u.exec(line.trim());
      if (!match) return [];
      const key = match[1];
      const raw = match[2];
      if (!key || raw === undefined) return [];
      return [[key, raw.replace(/^['"]|['"]$/gu, "")]];
    }));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return {};
    throw error;
  }
}
