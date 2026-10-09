import { encodeCinematicWire, decodeCinematicWire } from "../cinematicWire";
import { SCHEMA_VERSION } from "../types";
import type { Project } from "../types";
import { ProjectFormatError } from "./errors";
import { requireNumber, requireRecord } from "./guards";
import { migrateV1toV3, migrateV2toV3, migrateV3toV4 } from "./migration";
import { validateProjectV1, validateProjectV2, validateProjectV4 } from "./shape";
import { restoreOwnedReferenceDocuments, reuseTilesetsView, withoutOwnedReferenceDocuments } from "../referenceOwnership";

function omitRetiredTerrainTemplates<T extends object>(owner: T): T | Record<string, unknown> {
  // 버려진 키가 없으면 같은 객체를 돌려준다 — 매번 새 객체를 만들면 저장 비교의 같은-객체 단축이 깨져
  // 타일셋 수십 칸을 매 저장 다시 요약했다(2026-09-26 실측, 81MB 새 프로젝트 diff 1.0s).
  if (!Object.prototype.hasOwnProperty.call(owner, "terrainTemplates")) return owner;
  return Object.fromEntries(Object.entries(owner).filter(([key]) => key !== "terrainTemplates"));
}

/**
 * Only the project root and tileset records own the retired field, never nested dictionaries.
 * The returned view shares everything below those records with `project` — read it, never mutate it.
 *
 * 번들·공용 라이브러리가 소유한 참고문서(배열 전체가 소유자 판본과 같은 것)는 표지로 바꿔 뺀다 — referenceOwnership.ts.
 * 소유자 해석기가 등록되지 않은 곳(헤드리스·플레이어·Electron main)에서는 예전과 똑같이 아무것도 빼지 않는다.
 * `keepReferenceDocuments` 는 .oprn 내보내기처럼 문서가 자기완결이어야 하는 곳용이다.
 */
export function projectWireView(project: Project, options?: { readonly keepReferenceDocuments?: boolean }) {
  project = encodeCinematicWire(project);
  const strip = options?.keepReferenceDocuments !== true;
  let tilesets: Record<string, unknown> | null = null;
  let parts: Map<string, unknown> | null = null;
  const entries = Object.entries(project.tilesets);
  for (let index = 0; index < entries.length; index += 1) {
    const [id, tileset] = entries[index];
    const base = omitRetiredTerrainTemplates(tileset);
    const view = strip ? withoutOwnedReferenceDocuments(id, tileset, base) : base;
    if (view === tileset) { if (parts) parts.set(id, view); continue; }
    if (!parts) {
      parts = new Map();
      for (let earlier = 0; earlier < index; earlier += 1) parts.set(entries[earlier][0], entries[earlier][1]);
    }
    parts.set(id, view);
  }
  if (parts) tilesets = reuseTilesetsView(project.tilesets as Record<string, unknown>, parts);
  return {
    ...omitRetiredTerrainTemplates(project),
    tilesets: tilesets ?? project.tilesets,
  };
}

/**
 * Canonical wire serialization for persistence, hashing, and network bodies.
 * Compact (no pretty indent) — payload size and main-thread stringify cost matter on large maps.
 */
export function serialize(project: Project): string {
  return JSON.stringify(projectWireView(project));
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
  return JSON.stringify(projectWireView(project, { keepReferenceDocuments: true }), null, 2);
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
  if (version === SCHEMA_VERSION) {
    const project = validateProjectV4(decodeCinematicWire(data as unknown as Project) as unknown as typeof data, { adoptParsed: true });
    // 저장본에서 뺀 번들·공용 참고문서를 되돌린다 — 정규화 전에 되돌려야 「로드가 프로젝트를 바꿨다」로 세지 않는다.
    restoreOwnedReferenceDocuments(project);
    return project;
  }
  throw new ProjectFormatError(`지원하지 않는 스키마 버전입니다: ${version} (현재 ${SCHEMA_VERSION})`);
}
