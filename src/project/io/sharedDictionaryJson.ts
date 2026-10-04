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

/**
 * 저장 왕복을 이미 통과한 공유 항목(같은 객체). 항목의 왕복 결과는 그 객체의 글만의 함수이고(위 전제), 항목 되읽기 검사
 * (`validateTileset` · 업로드 자산은 사전이 객체인지만 본다)는 항목마다 독립이다 — 그래서 통과한 객체는 다시 통과한다.
 */
const roundtripPassed = new WeakSet<object>();

/** 왕복을 통과한 문서의 타일셋·업로드 자산 항목을 기억한다. 검사가 통과한 **뒤에만** 부른다. */
export function markRoundtripPassed(project: Project): void {
  for (const entry of Object.values(project.tilesets ?? {})) if (isPlainRecord(entry)) roundtripPassed.add(entry);
  for (const entry of Object.values(project.assets?.uploaded ?? {})) if (isPlainRecord(entry)) roundtripPassed.add(entry);
}

/**
 * 통과한 타일셋 항목의 뼈대 — 되읽기 검사가 **이웃을 보는** 자리에서 읽는 필드만 남긴 최소 통과본.
 * 이웃 검사: `referenceOwner`(참고문서 원본 id), 맵의 `tilesetId` 존재, 리소스 id 목록(`image.id`), 공간 저작의
 * 타일셋 `count`·`tileSize`·`structureKits`(kit id 로 찾는다 — 공간 저작이 있으면 원래 글을 쓴다, 아래).
 */
function tilesetSkeleton(entry: Record<string, unknown>): string {
  const count = entry.count as number;
  const head: Record<string, unknown> = { id: entry.id, name: entry.name, image: entry.image, count, tileSize: entry.tileSize, tilesPerRow: entry.tilesPerRow };
  if (entry.referenceSourceTilesetId !== undefined) head.referenceSourceTilesetId = entry.referenceSourceTilesetId;
  const fill = (value: string): string => (count > 0 ? `[${new Array<string>(count).fill(value).join(",")}]` : "[]");
  return `${JSON.stringify(head).slice(0, -1)},"passability":${fill("{}")},"priority":${fill('"lower"')},"terrain":${fill("0")}}`;
}

function skeletonable(project: Project): boolean {
  // 공간 저작은 타일셋 structureKits·tileGrafts 까지 읽는다 — 그 문서는 원래 글로 검사한다.
  if (project.spatialAuthoring !== undefined) return false;
  for (const entry of Object.values(project.tilesets ?? {})) {
    if (!isPlainRecord(entry) || !roundtripPassed.has(entry)) return false;
    const count = entry.count;
    if (typeof count !== "number" || !Number.isInteger(count) || count < 0 || count > 1_000_000) return false;
  }
  for (const entry of Object.values(project.assets?.uploaded ?? {})) if (!isPlainRecord(entry) || !roundtripPassed.has(entry)) return false;
  return true;
}

/**
 * 저장 왕복 검사(`projectLint.checkRoundtrip`)의 입력 글. 타일셋·업로드 자산 항목이 모두 이미 통과한 객체면 그 자리에 뼈대를 넣는다 —
 * 공유 사전 밖(맵·DB·시스템·세션…)은 글자까지 `serialize` 와 같아 그 부분의 되읽기 검사는 그대로 돈다. 아니면 `serialize` 와 같은 글이다.
 *
 * 왜(2026-09-28 실측, 새 프로젝트 기본 자료 149MB): 글 재사용 뒤에도 되읽기(`JSON.parse` + 검사)가 AI 체크포인트마다 약 0.8s,
 * 버려지는 수십 MB 트리의 GC 가 그만큼 더 들었다. 체크포인트 사이에 바뀌는 타일셋·업로드 자산은 거의 없다.
 */
export function serializeForRoundtripCheck(project: Project): string {
  if (!skeletonable(project)) return serializeReusingSharedDictionaries(project);
  const view = projectWireView(project) as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of Object.keys(view)) {
    const value = view[key];
    let piece: string | undefined;
    if (key === "tilesets" && isPlainRecord(value)) {
      piece = `{${Object.keys(value).map((id) => `${JSON.stringify(id)}:${tilesetSkeleton(value[id] as Record<string, unknown>)}`).join(",")}}`;
    } else if (key === "assets" && isPlainRecord(value)) {
      const inner: string[] = [];
      for (const assetKey of Object.keys(value)) {
        const uploaded = value[assetKey];
        // 업로드 자산 항목은 되읽기에서 모양 검사를 받지 않는다. 참조 검사가 보는 필드(id·kind·name·meta)만 남긴다.
        const assetPiece = assetKey === "uploaded" && isPlainRecord(uploaded)
          ? `{${Object.keys(uploaded).map((id) => {
            const entry = uploaded[id] as Record<string, unknown>;
            return `${JSON.stringify(id)}:${JSON.stringify({ id: entry.id, kind: entry.kind, name: entry.name, meta: entry.meta })}`;
          }).join(",")}}`
          : JSON.stringify(uploaded);
        if (assetPiece !== undefined) inner.push(`${JSON.stringify(assetKey)}:${assetPiece}`);
      }
      piece = `{${inner.join(",")}}`;
    } else piece = JSON.stringify(value);
    if (piece !== undefined) parts.push(`${JSON.stringify(key)}:${piece}`);
  }
  return `{${parts.join(",")}}`;
}
