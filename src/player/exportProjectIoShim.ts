import { SCHEMA_VERSION, type Project } from "@/project/types";
import { ProjectFormatError } from "@/project/io/errors";
import { resolveEventPage } from "@/project/io/pageResolution";

export { ProjectFormatError, resolveEventPage };

export function serialize(project: Project): string {
  return JSON.stringify(project, (key, value) => key === "terrainTemplates" ? undefined : value, 2);
}

export function deserialize(raw: string): Project {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch (cause) {
    throw new ProjectFormatError(cause instanceof Error ? `JSON 파싱 실패: ${cause.message}` : "JSON 파싱 실패");
  }

  if (!isRecord(parsed)) throw new ProjectFormatError("project가 객체가 아닙니다.");
  if (parsed.version !== SCHEMA_VERSION) {
    throw new ProjectFormatError(`웹 플레이어는 현재 스키마만 지원합니다: ${parsed.version}`);
  }
  return cloneProject(parsed);
}

function cloneProject(value: Record<string, unknown>): Project {
  if (typeof structuredClone === "function") return structuredClone(value) as unknown as Project;
  return JSON.parse(JSON.stringify(value)) as Project;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
