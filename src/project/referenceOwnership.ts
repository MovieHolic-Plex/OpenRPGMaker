import type { Project, TilesetDef } from "./types";
import { jsonEqual } from "@/util/structuralJson";

/**
 * 번들·공용 라이브러리가 소유한 타일셋 참고문서를 저장·전송 문서에서 뺀다 (2026-09-30 편집기 렉 F).
 *
 * 프로젝트 문서의 referenceDocuments 는 펼치면 42MB, 접어도 22MB 다. 그 대부분(shared_* 15.4MB + 번들 6.5MB)은
 * 라이브러리 판본과 통째로 같은 사본이라 매 로드마다 다시 읽고 다시 해시한다.
 * 원칙:
 *  - 배열 전체가 소유자 판본과 JSON 동치일 때만 뺀다. 저자가 한 글자라도 고쳤거나 문서를 더한 타일셋은 그대로 둔다.
 *  - 뺀 자리에는 `referenceDocumentsOwner`(bundle | shared) 표지만 남긴다. 로드(deserializeParsed)가 이 표지를 보고 같은 판본을 되돌려
 *    메모리의 프로젝트는 예전과 똑같다 — 정규화기(ensure*)가 어차피 넣던 값이다.
 *  - 소유자 판본을 알 수 없으면(해석기 미등록·공용 카탈로그 미설치) 아무것도 빼지 않는다. 즉 편집기 부팅(main.ts)만 켠다.
 *    헤드리스 도구·테스트·플레이어·호스트(Electron main)는 예전 그대로다.
 *  - 표지가 남은 옛 앱은 그 필드를 무시하고, 번들 문서는 ensure*, 공용 문서는 ensureSharedContent 가 다시 채운다.
 */
export type ReferenceOwnerKind = "bundle" | "shared";
type ReferenceDocs = NonNullable<TilesetDef["referenceDocuments"]>;

export const REFERENCE_OWNER_MARKER = "referenceDocumentsOwner";

export interface ReferenceDocumentOwners {
  /** shared_* 타일셋의 라이브러리 판본. 카탈로그가 아직 없으면 undefined. */
  shared(tilesetId: string): ReferenceDocs | undefined;
  /** 새 프로젝트가 번들에서 얻는 판본. */
  bundle(tilesetId: string): ReferenceDocs | undefined;
}

let owners: ReferenceDocumentOwners | null = null;

export function registerReferenceDocumentOwners(next: ReferenceDocumentOwners | null): void {
  owners = next;
}

function ownerDocs(kind: ReferenceOwnerKind, id: string): ReferenceDocs | undefined {
  if (!owners) return undefined;
  const docs = kind === "shared" ? owners.shared(id) : owners.bundle(id);
  return docs && docs.length > 0 ? docs : undefined;
}

// 배열 하나마다 소유자 판단을 한 번만 한다. 저자가 문서를 고치면 새 배열이라 자동으로 다시 판단한다(tilesetReferencePanel 은 copy-on-write).
// 소유자 판본 배열의 정체가 바뀌면(카탈로그 재설치) 캐시는 무효다.
interface Decision { readonly kind: ReferenceOwnerKind | null; readonly owner: ReferenceDocs | undefined; readonly fingerprint: unknown[] }

// 정규화기가 배열·범주를 제자리에서 고쳐도(문서를 push 하는 등) 캐시를 못 믿게 하는 얕은 지문: 배열 길이와 범주·문서 목록의 정체.
function fingerprint(docs: ReferenceDocs): unknown[] {
  const out: unknown[] = [docs.length];
  for (const category of docs) out.push(category, category.documents, category.documents?.length, category.images, category.images?.length);
  return out;
}
function sameFingerprint(a: unknown[], b: unknown[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}
const decisions = new WeakMap<object, Decision>();

function stripKind(id: string, docs: ReferenceDocs): ReferenceOwnerKind | null {
  const kinds: ReferenceOwnerKind[] = id.startsWith("shared_") ? ["shared", "bundle"] : ["bundle"];
  const cached = decisions.get(docs);
  if (cached && sameFingerprint(cached.fingerprint, fingerprint(docs))) {
    const current = cached.kind ? ownerDocs(cached.kind, id) : kinds.map((k) => ownerDocs(k, id)).find(Boolean);
    if (current === cached.owner) return cached.kind;
  }
  for (const kind of kinds) {
    const owner = ownerDocs(kind, id);
    if (owner && (owner === docs || jsonEqual(owner, docs))) {
      decisions.set(docs, { kind, owner, fingerprint: fingerprint(docs) });
      return kind;
    }
  }
  // 소유자가 있는데 다르면 다음에도 다르다고 기억한다(배열 정체가 같으면 내용도 같다). 소유자가 없으면 기억하지 않는다.
  const anyOwner = kinds.map((k) => ownerDocs(k, id)).find(Boolean);
  if (anyOwner) decisions.set(docs, { kind: null, owner: anyOwner, fingerprint: fingerprint(docs) });
  return null;
}

interface ViewEntry { readonly source: [string, unknown][]; readonly docs: ReferenceDocs; readonly kind: ReferenceOwnerKind; readonly view: Record<string, unknown> }
const views = new WeakMap<object, ViewEntry>();

function sameShallow(tileset: Record<string, unknown>, source: [string, unknown][]): boolean {
  let count = 0;
  for (const key in tileset) {
    if (!Object.hasOwn(tileset, key)) continue;
    const entry = source[count];
    if (!entry || entry[0] !== key || entry[1] !== tileset[key]) return false;
    count += 1;
  }
  return count === source.length;
}

/**
 * 타일셋 한 칸의 저장용 모습. 뺄 것이 없으면 base 를 그대로 돌려준다.
 * 뺀 모습은 타일셋 객체별로 기억하되, 얕은 사본이라 타일셋 필드가 제자리에서 바뀌면 다시 만든다.
 */
export function withoutOwnedReferenceDocuments(id: string, tileset: TilesetDef, base: object): object {
  if (!owners) return base;
  const docs = tileset.referenceDocuments;
  if (!docs || docs.length === 0) return base;
  const kind = stripKind(id, docs);
  if (!kind) return base;
  const record = tileset as unknown as Record<string, unknown>;
  const cached = views.get(tileset);
  if (cached && cached.docs === docs && cached.kind === kind && sameShallow(record, cached.source)) return cached.view;
  const view: Record<string, unknown> = {};
  const source: [string, unknown][] = [];
  for (const key in record) {
    if (!Object.hasOwn(record, key)) continue;
    source.push([key, record[key]]);
    if (key === "referenceDocuments" || key === "terrainTemplates") continue;
    view[key] = record[key];
  }
  view[REFERENCE_OWNER_MARKER] = kind;
  views.set(tileset, { source, docs, kind, view });
  return view;
}

const containers = new WeakMap<object, { readonly out: Record<string, unknown>; readonly parts: Map<string, unknown> }>();

/** 타일셋 사전의 저장용 모습. 칸별 모습이 전과 모두 같은 객체면 이전 사전을 그대로 돌려준다(같은-객체 단축 유지). */
export function reuseTilesetsView(source: Record<string, unknown>, parts: Map<string, unknown>): Record<string, unknown> {
  const cached = containers.get(source);
  if (cached && cached.parts.size === parts.size) {
    let same = true;
    for (const [id, part] of parts) if (cached.parts.get(id) !== part) { same = false; break; }
    if (same) return cached.out;
  }
  const out: Record<string, unknown> = {};
  for (const [id, part] of parts) out[id] = part;
  containers.set(source, { out, parts });
  return out;
}

/**
 * 표지가 붙은 타일셋에 소유자 판본을 되돌린다. 로드 직후(정규화 전) 한 번 부른다.
 * 소유자를 아직 모르면 표지를 남겨 둔다 — 정규화기가 나중에 같은 값을 채운다.
 * 되돌린 뒤의 프로젝트는 저장 전과 JSON 동치다.
 */
export function restoreOwnedReferenceDocuments(project: Project): number {
  let restored = 0;
  for (const [id, tileset] of Object.entries(project.tilesets ?? {})) {
    const record = tileset as unknown as Record<string, unknown> | null;
    const kind = record?.[REFERENCE_OWNER_MARKER];
    if (kind !== "bundle" && kind !== "shared") { continue; }
    if (tileset.referenceDocuments && tileset.referenceDocuments.length > 0) { delete record![REFERENCE_OWNER_MARKER]; continue; }
    const docs = ownerDocs(kind, id);
    if (!docs) continue;
    tileset.referenceDocuments = structuredClone(docs);
    delete record![REFERENCE_OWNER_MARKER];
    restored += 1;
  }
  return restored;
}
