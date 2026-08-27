import { SCHEMA_VERSION } from "../types";
import type { Project } from "../types";
import { ProjectFormatError } from "./errors";
import { requireNumber, requireRecord } from "./guards";
import { migrateV1toV3, migrateV2toV3, migrateV3toV4 } from "./migration";
import { validateProjectV1, validateProjectV2, validateProjectV4 } from "./shape";

/** Drop legacy terrainTemplates from wire format (field removed from product model). */
function projectJsonReplacer(key: string, value: unknown): unknown {
  return key === "terrainTemplates" ? undefined : value;
}

/**
 * Canonical wire serialization for persistence, hashing, and network bodies.
 * Compact (no pretty indent) — payload size and main-thread stringify cost matter on large maps.
 */
export function serialize(project: Project): string {
  return JSON.stringify(project, projectJsonReplacer);
}

/** Human-readable project.json for .rpgzzu packages and debug dumps only. */
export function serializePretty(project: Project): string {
  return JSON.stringify(project, projectJsonReplacer, 2);
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

  const data = requireRecord("project", parsed);
  const version = requireNumber("version", data.version);
  if (version === 1) return migrateV1toV3(validateProjectV1(data));
  if (version === 2) return migrateV2toV3(validateProjectV2(data));
  // v3 는 얼굴 짝(시트 id + faceIndex)을 들고 있다 — 낱장 얼굴 id 로 바꾼 뒤 검사한다.
  if (version === 3) return migrateV3toV4(data);
  if (version === SCHEMA_VERSION) return validateProjectV4(data);
  throw new ProjectFormatError(`지원하지 않는 스키마 버전입니다: ${version} (현재 ${SCHEMA_VERSION})`);
}
