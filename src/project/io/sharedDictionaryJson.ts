import type { Project } from "../types";
import { projectWireView } from "./serialize";
import { isBundledTilesetDiffView } from "../bundledTilesetDiff";

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
/**
 * 항목 객체 → 필드별 `"키":글` 조각. 항목 글은 쓸 때마다 조각을 이어 만든다(버려지는 글).
 * 필드 단위로 쥐는 까닭: 저장 왕복 검사의 투영본(참고문서를 뺀 같은 항목, 아래 roundtripTilesetPiece)이 같은 조각을 함께 쓴다.
 * 항목 글과 투영본 글을 따로 쥐면 같은 타일셋 내용이 두 벌 남았다(2026-10-05 실측: 조수 턴 시작 뒤 렌더러 힙에서 약 205MB + 280MB).
 */
const fieldPieces = new WeakMap<object, readonly string[]>();
/** fieldPieces 와 같은 순서·같은 길이의 키 목록(값이 undefined 인 키는 둘 다 건너뛴다). */
const fieldKeys = new WeakMap<object, readonly string[]>();
/** 배열 항목처럼 필드로 나누지 않는 항목의 글. */
const wholePieces = new WeakMap<object, string | null>();

function hasToJson(value: object): boolean {
  return typeof (value as { toJSON?: unknown }).toJSON === "function";
}

function fieldsOf(entry: Record<string, unknown>): readonly string[] {
  const hit = fieldPieces.get(entry);
  if (hit) return hit;
  const fields: string[] = [];
  const keys: string[] = [];
  for (const key of Object.keys(entry)) {
    const text = JSON.stringify(entry[key]) as string | undefined;
    if (text !== undefined) { fields.push(`${JSON.stringify(key)}:${text}`); keys.push(key); }
  }
  fieldPieces.set(entry, fields);
  fieldKeys.set(entry, keys);
  return fields;
}

function pieceOf(entry: unknown): string | undefined {
  if (entry === null || typeof entry !== "object" || hasToJson(entry)) return JSON.stringify(entry);
  if (isPlainRecord(entry)) return `{${fieldsOf(entry).join(",")}}`;
  const hit = wholePieces.get(entry);
  if (hit !== undefined) return hit ?? undefined;
  const text = JSON.stringify(entry) as string | undefined;
  wholePieces.set(entry, text ?? null);
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
 * 저장 왕복을 이미 통과한 공유 항목(같은 객체). 독립 자료의 검사는 같은 immutable 항목에 한해 재사용한다.
 * 공간·graft 등 교차 참조 검사가 읽는 필드는 아래 투영본에도 그대로 남겨 매번 현재 문맥에서 검사한다.
 */
const roundtripPassed = new WeakSet<object>();

/** 왕복을 통과한 문서의 타일셋·업로드 자산 항목을 기억한다. 검사가 통과한 **뒤에만** 부른다. */
export function markRoundtripPassed(project: Project): void {
  for (const entry of Object.values(project.tilesets ?? {})) if (isPlainRecord(entry)) roundtripPassed.add(entry);
  // Owned-reference wire views have their own immutable identity. They passed
  // the same boundary and must not disable reuse solely because of that wrapper.
  for (const entry of Object.values(projectWireView(project).tilesets)) if (isPlainRecord(entry)) roundtripPassed.add(entry);
  for (const entry of Object.values(project.assets?.uploaded ?? {})) if (isPlainRecord(entry)) roundtripPassed.add(entry);
}

/** Passed immutable entries omit only independently validated reference documents.
 * Keep ALL other fields (including kind, structure-kit geometry/interior metadata,
 * tileGrafts, count, rules and group knowledge): spatial validation and reference
 * repair read these across entries. A replacement entry takes the full path once.
 */
/** 참고문서를 뺀 structureKits 조각 — 키트에 참고문서가 있을 때만 따로 쥔다(없으면 항목 조각을 그대로 쓴다). */
const strippedKitPieces = new WeakMap<object, string | null>();
const STRUCTURE_KITS_FIELD = `${JSON.stringify("structureKits")}:`;
function strippedKitsField(entry: Record<string, unknown>, field: string): string {
  let hit = strippedKitPieces.get(entry);
  if (hit === undefined) {
    const kits = entry.structureKits;
    const withDocs = Array.isArray(kits) && kits.some(kit => isPlainRecord(kit) && Object.hasOwn(kit, "referenceDocuments"));
    hit = withDocs ? `${STRUCTURE_KITS_FIELD}${JSON.stringify((kits as unknown[]).map(kit => {
      if (!isPlainRecord(kit)) return kit;
      const { referenceDocuments: _kitDocuments, ...fields } = kit;
      return fields;
    }))}` : null;
    strippedKitPieces.set(entry, hit);
  }
  return hit ?? field;
}
/**
 * 칸 수(`count`)와 길이만 대조되는 칸별 배열. 통과한 항목에서는 같은 길이의 `null` 배열로 갈아 끼운다.
 *
 * 왜(2026-10-15 실측, 새 프로젝트 기본 자료 · 타일셋 46개 · 왕복 글 49.7MB 의 대부분이 tileMeta·passability·priority·terrain):
 * 되읽기(`validateTileset`)는 이 넷을 «길이 == count» 로만 본다(tileMeta 는 null 칸을 건너뛴다). 같은 불변 객체는 이미 실제 내용으로
 * 그 검사를 통과했고(roundtripPassed), 되읽은 프로젝트는 던지는지만 보고 버려진다. 되읽기 경로에서 이 넷을 읽는 곳은 validateTileset 뿐이다 —
 * 실측(2026-10-15): `deserializeParsed` 가 도는 동안 타일셋 항목의 속성 읽기를 Proxy 로 가로채 호출 모듈을 집계하니 passability·priority·terrain·tileMeta 는
 * `io/shapeResourceFields.ts`(validateTileset)만 읽었다. spatial 쪽은 `structureKits`·`count` 같은 다른 필드를 읽고 그 필드들은 그대로 둔다.
 * 새 되읽기 단계가 이 넷을 읽게 되면 이 투영을 함께 고쳐야 한다. 새 항목·바뀐 항목(통과 기록 없음)은 전부 실제 글이다.
 */
const PER_TILE_ARRAY_FIELDS = new Set(["tileMeta", "passability", "priority", "terrain"]);
/** 통과한 항목의 왕복 글 투영본. 항목이 불변이라 객체 하나에 글 하나다(항목 글 조각 `fieldPieces` 와 달리 큰 배열을 쥐지 않는다). */
const roundtripPieces = new WeakMap<object, string>();
function roundtripTilesetPiece(entry: unknown): string | undefined {
  if (!isPlainRecord(entry) || !roundtripPassed.has(entry)) return pieceOf(entry);
  const hit = roundtripPieces.get(entry);
  if (hit !== undefined) return hit;
  const parts: string[] = [];
  const fields = fieldsOf(entry);
  const keys = fieldKeys.get(entry)!; // fieldsOf 가 채웠다 — 키와 조각이 한 쌍이다.
  for (let index = 0; index < fields.length; index += 1) {
    const key = keys[index]!;
    const field = fields[index]!;
    if (key === "referenceDocuments") continue;
    const value = entry[key];
    if (PER_TILE_ARRAY_FIELDS.has(key) && Array.isArray(value)) {
      parts.push(`${JSON.stringify(key)}:[${new Array<string>(value.length).fill("null").join(",")}]`);
      continue;
    }
    parts.push(key === "structureKits" ? strippedKitsField(entry, field) : field);
  }
  const piece = `{${parts.join(",")}}`;
  roundtripPieces.set(entry, piece);
  return piece;
}

/**
 * 저장 왕복 검사(`projectLint.checkRoundtrip`)의 입력 글. 이미 통과한 타일셋·업로드 자산 항목만 그 자리에 투영본을 넣는다 —
 * 공유 사전 밖(맵·DB·시스템·세션…)은 글자까지 `serialize` 와 같아 그 부분의 되읽기 검사는 그대로 돈다. 새 항목은 `serialize` 와 같은 글이다. 공간 저작 유무와 무관하게 교차 참조 필드는 보존한다.
 *
 * 왜(2026-09-28 실측, 새 프로젝트 기본 자료 149MB): 글 재사용 뒤에도 되읽기(`JSON.parse` + 검사)가 AI 체크포인트마다 약 0.8s,
 * 버려지는 수십 MB 트리의 GC 가 그만큼 더 들었다. 체크포인트 사이에 바뀌는 타일셋·업로드 자산은 거의 없다.
 */
export function serializeForRoundtripCheck(project: Project): string {
  const view = projectWireView(project) as Record<string, unknown>;
  if (hasToJson(view)) return JSON.stringify(view);
  const parts: string[] = [];
  for (const key of Object.keys(view)) {
    const value = view[key];
    let piece: string | undefined;
    if (key === "tilesets" && isPlainRecord(value)) {
      // 번들 차이 보기(bundledTilesetDiff.ts)는 되읽으면 번들 정의를 다시 만든다(체크포인트마다 수십 MB). 같은 내용인 온전한 항목의
      // 투영본을 대신 넣는다 — 차이 되돌리기 자체의 왕복은 bundledTilesetDiff 가 같은 판에서 값 동치로 보장한다.
      const tilesetEntry = (id: string): unknown => {
        const entry = value[id];
        if (!isBundledTilesetDiffView(entry)) return entry;
        const full = (project.tilesets as Record<string, unknown>)[id];
        return isPlainRecord(full) && !Object.hasOwn(full, "terrainTemplates") ? full : entry;
      };
      piece = `{${Object.keys(value).flatMap((id) => { const text = roundtripTilesetPiece(tilesetEntry(id)); return text === undefined ? [] : [`${JSON.stringify(id)}:${text}`]; }).join(",")}}`;
    } else if (key === "assets" && isPlainRecord(value)) {
      const inner: string[] = [];
      for (const assetKey of Object.keys(value)) {
        const uploaded = value[assetKey];
        // 업로드 자산 항목은 되읽기에서 모양 검사를 받지 않는다. 참조 검사가 보는 필드(id·kind·name·meta)만 남긴다.
        const assetPiece = assetKey === "uploaded" && isPlainRecord(uploaded)
          ? `{${Object.keys(uploaded).flatMap((id) => {
            const entry = uploaded[id] as Record<string, unknown>;
            const text = isPlainRecord(entry) && roundtripPassed.has(entry)
              ? JSON.stringify({ id: entry.id, kind: entry.kind, name: entry.name, meta: entry.meta, ref: entry.ref })
              : pieceOf(entry);
            return text === undefined ? [] : [`${JSON.stringify(id)}:${text}`];
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
