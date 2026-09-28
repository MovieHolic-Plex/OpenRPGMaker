import type { Project } from "../types";
import { projectWireView } from "./serialize";

/**
 * 타일셋·업로드 자산 사전의 JSON 을 항목별로 기억해 조립한다. 결과는 `JSON.stringify` 와 글자까지 같다.
 *
 * 전제(projectClone 계약): 스토어의 타일셋 항목과 업로드 자산 항목은 **제자리에서 고치지 않는다** — 바꿀 때는 사전 자리에
 * 새 객체를 대입한다. 그래서 항목 객체 → 글 기억은 객체가 살아 있는 동안 유효하다. 같은 전제를 저장 diff
 * (`projectPatch.sameTilesetValue` 의 `base === local` 단축)·레거시 스프라이트 청소(`cleanSharedEntries`)가 이미 쓴다.
 * 다른 사전(데이터베이스 등)은 제자리 수정이 있어 여기에 넣지 않는다.
 *
 * 왜(2026-09-28 실측, 새 프로젝트 기본 자료 149MB · 타일셋 82MB · 업로드 66MB): AI 체크포인트 적용 한 번의 저장 왕복 검사가
 * 문서 전체를 직렬화해 약 1.4s, 턴마다 무거운 키 해시가 또 한 번 타일셋 전체를 직렬화했다. 체크포인트 사이에 바뀌는 타일셋은 거의 없다.
 */
const pieces = new WeakMap<object, string | null>();

function hasToJson(value: object): boolean {
  return typeof (value as { toJSON?: unknown }).toJSON === "function";
}

function pieceOf(entry: unknown): string | undefined {
  if (entry === null || typeof entry !== "object" || hasToJson(entry)) return JSON.stringify(entry);
  const hit = pieces.get(entry);
  if (hit !== undefined) return hit ?? undefined;
  const text = JSON.stringify(entry) as string | undefined;
  pieces.set(entry, text ?? null);
  return text;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && !hasToJson(value);
}

/** `JSON.stringify(dictionary)` 와 같은 글. 항목 객체의 글을 기억한다(위 전제). */
export function stringifySharedDictionary(dictionary: unknown): string | undefined {
  if (!isPlainRecord(dictionary)) return JSON.stringify(dictionary);
  const parts: string[] = [];
  for (const key of Object.keys(dictionary)) {
    const piece = pieceOf(dictionary[key]);
    if (piece !== undefined) parts.push(`${JSON.stringify(key)}:${piece}`);
  }
  return `{${parts.join(",")}}`;
}

/** `JSON.stringify(project.assets)` 와 같은 글. 업로드 사전만 항목별로 기억한다. */
export function stringifyAssets(assets: unknown): string | undefined {
  if (!isPlainRecord(assets)) return JSON.stringify(assets);
  const parts: string[] = [];
  for (const key of Object.keys(assets)) {
    const piece = key === "uploaded" ? stringifySharedDictionary(assets[key]) : JSON.stringify(assets[key]);
    if (piece !== undefined) parts.push(`${JSON.stringify(key)}:${piece}`);
  }
  return `{${parts.join(",")}}`;
}

/** `serialize(project)` 와 글자까지 같은 직렬화. 타일셋·업로드 자산 항목의 글을 재사용한다. */
export function serializeReusingSharedDictionaries(project: Project): string {
  const view = projectWireView(project) as Record<string, unknown>;
  if (hasToJson(view)) return JSON.stringify(view);
  const parts: string[] = [];
  for (const key of Object.keys(view)) {
    const value = view[key];
    const piece = key === "tilesets" ? stringifySharedDictionary(value)
      : key === "assets" ? stringifyAssets(value)
        : JSON.stringify(value);
    if (piece !== undefined) parts.push(`${JSON.stringify(key)}:${piece}`);
  }
  return `{${parts.join(",")}}`;
}
