import { SCHEMA_VERSION } from "../types";
import type { Project } from "../types";
import { ProjectFormatError } from "./errors";
import { requireNumber, requireRecord } from "./guards";
import { migrateV1toV3, migrateV2toV3 } from "./migration";
import { validateProjectV1, validateProjectV2, validateProjectV3 } from "./shape";

export function serialize(project: Project): string {
  return JSON.stringify(project, null, 2);
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
  if (version === SCHEMA_VERSION) return validateProjectV3(data);
  throw new ProjectFormatError(`지원하지 않는 스키마 버전입니다: ${version} (현재 ${SCHEMA_VERSION})`);
}
