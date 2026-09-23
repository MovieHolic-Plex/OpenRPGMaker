import { SCHEMA_VERSION } from "../types";
import type { Project } from "../types";
import { ProjectFormatError } from "./errors";
import { requireNumber, requireRecord } from "./guards";
import { migrateV1toV3, migrateV2toV3, migrateV3toV4 } from "./migration";
import { validateProjectV1, validateProjectV2, validateProjectV4 } from "./shape";

function omitRetiredTerrainTemplates(owner: object): Record<string, unknown> {
  return Object.fromEntries(Object.entries(owner).filter(([key]) => key !== "terrainTemplates"));
}

/** Only the project root and tileset records own the retired field, never nested dictionaries. */
function projectJson(project: Project) {
  return {
    ...omitRetiredTerrainTemplates(project),
    tilesets: Object.fromEntries(Object.entries(project.tilesets).map(([id, tileset]) => [id, omitRetiredTerrainTemplates(tileset)])),
  };
}

/**
 * Canonical wire serialization for persistence, hashing, and network bodies.
 * Compact (no pretty indent) — payload size and main-thread stringify cost matter on large maps.
 */
export function serialize(project: Project): string {
  return JSON.stringify(projectJson(project));
}

/**
 * Compare loaded project values, not wire bytes: loading normalizes defaults and
 * JSONB reorders object keys. Array order and non-default authored values remain
 * significant. Keep this separate from serialize() so persisted hashes do not change.
 */
export function serializeForComparison(project: Project): string {
  return JSON.stringify(deserialize(serialize(project)), (_key, value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, Reflect.get(value, key)]));
  });
}

/** Human-readable project.json for .oprn packages and debug dumps only. */
export function serializePretty(project: Project): string {
  return JSON.stringify(projectJson(project), null, 2);
}

export function deserialize(raw: string): Project {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new ProjectFormatError(
      cause instanceof Error ? `JSON 파싱 실패: ${cause.message}` : "JSON 파싱 실패"
    );
  }
  return deserializeParsed(parsed);
}

/**
 * Validate a value that JSON.parse (or a structuredClone of one) already owns.
 * Current-schema loads adopt that tree instead of cloning it again.
 */
export function deserializeParsed(parsed: unknown): Project {
  const data = requireRecord("project", parsed);
  const version = requireNumber("version", data.version);
  if (version === 1) return migrateV1toV3(validateProjectV1(data));
  if (version === 2) return migrateV2toV3(validateProjectV2(data));
  // v3 는 얼굴 짝(시트 id + faceIndex)을 들고 있다 — 낱장 얼굴 id 로 바꾼 뒤 검사한다.
  if (version === 3) return migrateV3toV4(data);
  if (version === SCHEMA_VERSION) return validateProjectV4(data, { adoptParsed: true });
  throw new ProjectFormatError(`지원하지 않는 스키마 버전입니다: ${version} (현재 ${SCHEMA_VERSION})`);
}
