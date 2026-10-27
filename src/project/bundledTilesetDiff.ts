// 저장본의 번들 타일셋을 «번들 정의 + 저자가 바꾼 것»으로 줄여 싣고, 읽을 때 번들 정의에 그 차이를 얹어 되돌린다.
//
// 왜(2026-10-27 실측): 빈 새 프로젝트의 serialize 가 6,420만 자(78MB)였고 그중 6,090만 자가 모든 프로젝트에 복사된 번들 타일셋 정의였다
// (beodeul_city 13.1M · jp_city 11.0M · modern_city 6.3M …, 필드로는 tileMeta 30.7M · referenceDocuments 11.3M · passability 8.1M).
// 같은 바이트를 저장·전송·해시·파싱마다 다시 만졌다. 앱은 같은 정의를 이미 들고 있다(src/assets/*Tileset.json).
//
// 계약(openwiki/runtime-project-schema.md 「번들 타일셋 차이 저장」):
//  - 저장 보기(projectWireView)에서 번들 id 이고 그림이 번들과 같은 타일셋은 머리(id·name·image·count …) + `bundledTilesetDiff` 로 싣는다.
//    차이는 필드 단위다: 번들에 없거나 다른 필드는 통째로(set), 배열은 칸 단위(at: [번호, 값] · tail: 번들 길이 뒤 칸), 없어진 필드는 del.
//  - 같은 앱(같은 번들)으로 되돌리면 저장 전 타일셋과 JSON 값이 같다(키 순서 포함). 저자 편집은 한 칸도 빠지지 않는다.
//  - 다른 판의 번들로 되돌리면(앱 갱신) 저자가 바꾸지 않은 칸은 지금 번들 값이 되고, 저자가 바꾼 칸·필드·덧붙인 칸은 그대로다.
//    칸 표 배열은 저장 때 길이(n)를 지킨다 — 옛 사본과 같은 모양이라 ensureBundledTilesets 의 「옛 사본 맞추기」가 예전처럼 돈다.
//    목록(킷·오토타일·참고문서)은 id 로 맞춘다. 번들에서 사라진 칸을 저자가 안 바꿨으면 채울 값이 없어 마지막 칸을 복제한다(드묾, 세어 보고).
//  - 이 앱에 그 번들 정의가 없으면 되돌릴 수 없다 — 조용히 빈 타일셋을 만들지 않고 ProjectFormatError 로 막는다.
//  - 편집기는 번들 정의 JSON 을 지연으로 읽는다(bundledJson.ts). 읽지 않은 정의로는 차이를 만들지 않고 예전처럼 통째로 싣는다 —
//    저장 보기가 동기 XHR 을 부르지 않는다. 로드는 되돌리기 전에 그 정의를 미리 읽는다(electronRepository).
//  - 내보내기(webExport·.oprn)는 자기완결이어야 하므로 통째로 싣는다(serialize 의 inlineBundledTilesets).
//  - 되돌리기(롤백): WRITE_BUNDLED_TILESET_DIFFS 를 끄면 다음 저장부터 통째로 싣는다. 읽기는 항상 켜 둔다.
import { bundledTilesetById, bundledTilesetDefinitionReady, preloadBundledTilesetDefinitions } from "./defaults/defaultAssets";
import { BUNDLED_TILESET_REF } from "./bundledTilesetRefs";
import { jsonEqual } from "@/util/structuralJson";
import { isPendingLazyTileset, markLazyTilesetMaterialized, markPendingLazyTileset } from "./bundledTilesetLazy";
import type { TilesetDef } from "./types";

export const BUNDLED_TILESET_DIFF = "bundledTilesetDiff";
const FORMAT = 1;

/** 롤백 스위치. false 면 저장 보기가 차이를 만들지 않는다(읽기는 그대로). */
let writeDiffs = true;
export function setBundledTilesetDiffWriting(enabled: boolean): void {
  writeDiffs = enabled;
}

/**
 * 차이 보기에 그대로 싣는 가벼운 머리. 되돌릴 때 이 값이 정본이다(차이에는 다시 싣지 않는다).
 * 시작 화면 표지(electron/local-store/summary.ts → startCover.ts)는 문서를 되돌리지 않고 이 머리만으로 그린다.
 */
const HEADER_KEYS = ["id", "name", "image", "kind", "family", "tileSize", "tilesPerRow", "count", "transparentColor", "tileGrafts"] as const;
const HEADER = new Set<string>(HEADER_KEYS);

type ArrayPatch = {
  /** 저장 때 번들 배열 길이. */
  readonly b: number;
  /** 저장 때 이 배열의 길이. */
  readonly n: number;
  /** 칸 표(번들 길이 == 번들 count). 다른 판에서도 번호로 맞춘다. 없으면 id 목록으로 본다. */
  readonly t?: 1;
  /** 번들 길이 안에서 다른 칸: [번호, 값]. */
  readonly at?: readonly (readonly [number, unknown])[];
  /** 번들 길이 뒤의 칸(공방 칸·덧붙인 킷 등). */
  readonly tail?: readonly unknown[];
};

type TilesetDiff = {
  readonly v: number;
  /** 저장 전 타일셋의 키 순서(값이 JSON 인 것만). */
  readonly keys: readonly string[];
  readonly set?: Readonly<Record<string, unknown>>;
  readonly arrays?: Readonly<Record<string, ArrayPatch>>;
  /** 번들에는 있는데 이 타일셋에는 없는 키. */
  readonly del?: readonly string[];
};

function present(value: unknown): boolean {
  return value !== undefined && typeof value !== "function" && typeof value !== "symbol";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function jsonValue(value: unknown): unknown {
  return value === undefined ? null : value;
}

/** 배열 차이. 절반 넘게 다르면 null(통째로 싣는 편이 작다). */
function arrayPatch(value: readonly unknown[], base: readonly unknown[], baseCount: unknown): ArrayPatch | null {
  const n = value.length;
  const b = base.length;
  const limit = Math.min(n, b);
  const budget = Math.max(8, Math.floor(n / 2));
  const at: [number, unknown][] = [];
  for (let index = 0; index < limit; index += 1) {
    const item = jsonValue(value[index]);
    if (item === base[index] || jsonEqual(item, jsonValue(base[index]))) continue;
    at.push([index, item]);
    if (at.length > budget) return null;
  }
  const patch: { b: number; n: number; t?: 1; at?: [number, unknown][]; tail?: unknown[] } = { b, n };
  if (b === baseCount) patch.t = 1;
  if (at.length > 0) patch.at = at;
  if (n > b) patch.tail = value.slice(b).map(jsonValue);
  return patch;
}

/** 번들 판본 대비 차이. 번들과 같은 모양이 아니면(이미 참조·차이 보기) null. */
function diffAgainst(tileset: Record<string, unknown>, base: Record<string, unknown>): TilesetDiff | null {
  const keys: string[] = [];
  const set: Record<string, unknown> = {};
  const arrays: Record<string, ArrayPatch> = {};
  const del: string[] = [];
  for (const key of Object.keys(tileset)) {
    const value = tileset[key];
    if (!present(value)) continue;
    if (key === BUNDLED_TILESET_DIFF || key === BUNDLED_TILESET_REF) return null;
    keys.push(key);
    if (HEADER.has(key)) continue;
    const baseValue = base[key];
    if (!present(baseValue)) { set[key] = value; continue; }
    if (value === baseValue || jsonEqual(value, baseValue)) continue;
    if (Array.isArray(value) && Array.isArray(baseValue)) {
      const patch = arrayPatch(value, baseValue, base.count);
      if (patch) arrays[key] = patch;
      else set[key] = value;
      continue;
    }
    set[key] = value;
  }
  for (const key of Object.keys(base)) if (present(base[key]) && !present(tileset[key])) del.push(key);
  const diff: { v: number; keys: string[]; set?: Record<string, unknown>; arrays?: Record<string, ArrayPatch>; del?: string[] } = { v: FORMAT, keys };
  if (Object.keys(set).length > 0) diff.set = set;
  if (Object.keys(arrays).length > 0) diff.arrays = arrays;
  if (del.length > 0) diff.del = del;
  return diff;
}

function viewOf(tileset: Record<string, unknown>, diff: TilesetDiff): Record<string, unknown> {
  const view: Record<string, unknown> = {};
  for (const key of HEADER_KEYS) if (present(tileset[key])) view[key] = tileset[key];
  view[BUNDLED_TILESET_DIFF] = diff;
  return view;
}

// ── 보기 기억 ──────────────────────────────────────────────────────────────
// 스토어의 타일셋 항목은 제자리에서 고치지 않는다(projectClone 계약). 그래도 로드 정규화(ensure*)는 되돌린 객체를 제자리에서 고치므로,
// 기억한 보기는 필드 정체 + 배열 필드의 길이·원소 정체가 모두 같을 때만 쓴다(원소 정체 대조는 타일셋 전부 합쳐 수십만 번의 === 다).
// 같은 원소 객체 안의 속성을 제자리에서 바꾸는 것은 잡지 못한다 — 그 경우는 sharedDictionaryJson 의 글 기억도 똑같이 못 잡는다(같은 전제).
type Fingerprint = { readonly fields: readonly (readonly [string, unknown])[]; readonly elements: ReadonlyMap<string, readonly unknown[]> };
type ViewEntry = { readonly fingerprint: Fingerprint; readonly view: Record<string, unknown> | null };
const views = new WeakMap<object, ViewEntry>();

function fingerprintOf(record: Record<string, unknown>): Fingerprint {
  const fields: [string, unknown][] = [];
  const elements = new Map<string, readonly unknown[]>();
  for (const key of Object.keys(record)) {
    const value = record[key];
    fields.push([key, value]);
    if (Array.isArray(value)) elements.set(key, value.slice());
  }
  return { fields, elements };
}

function sameFingerprint(record: Record<string, unknown>, fingerprint: Fingerprint): boolean {
  let count = 0;
  for (const key of Object.keys(record)) {
    const entry = fingerprint.fields[count];
    if (!entry || entry[0] !== key || entry[1] !== record[key]) return false;
    count += 1;
  }
  if (count !== fingerprint.fields.length) return false;
  for (const [key, snapshot] of fingerprint.elements) {
    const value = record[key] as unknown[];
    if (value.length !== snapshot.length) return false;
    for (let index = 0; index < snapshot.length; index += 1) if (value[index] !== snapshot[index]) return false;
  }
  return true;
}

// 비교용 번들 판본. 읽기만 하므로(되돌리기는 새로 만든다) 잠깐 기억해 기준본·현재본 두 벌의 비교가 정의를 두 번 만들지 않게 한다.
// 정의 전부는 수십 MB 객체라 오래 쥐지 않는다 — 마지막 사용 뒤 15초에 놓는다.
const comparisonBases = new Map<string, Record<string, unknown> | undefined>();
let releaseTimer: ReturnType<typeof setTimeout> | null = null;
function comparisonBase(id: string): Record<string, unknown> | undefined {
  if (!comparisonBases.has(id)) comparisonBases.set(id, bundledTilesetById(id) as unknown as Record<string, unknown> | undefined);
  if (releaseTimer) clearTimeout(releaseTimer);
  releaseTimer = setTimeout(() => { comparisonBases.clear(); releaseTimer = null; }, 15_000);
  (releaseTimer as { unref?: () => void }).unref?.();
  return comparisonBases.get(id);
}

/**
 * 저장 보기의 타일셋 한 칸. 번들 차이로 줄일 수 있으면 차이 보기, 아니면 undefined(호출자가 예전 보기를 쓴다).
 * `tileset` 은 스토어 항목, `wire` 는 버려진 필드를 뺀 같은 항목(omitRetiredTerrainTemplates 결과)이다.
 */
export function bundledTilesetDiffView(id: string, tileset: TilesetDef, wire: object): Record<string, unknown> | undefined {
  const lazy = lazyStates.get(tileset);
  if (lazy && isPendingLazyTileset(tileset)) {
    // 아직 되돌리지 않은 지연 타일셋은 받은 차이 그대로가 저장 모양이다(되돌려도 같은 값). 키가 지워지는 등 손을 탔으면 되돌린 뒤 다시 비교한다.
    if (writeDiffs && lazyUntouched(tileset, lazy)) return lazy.view;
    lazy.materialize();
  }
  if (!writeDiffs) return undefined;
  const record = tileset as unknown as Record<string, unknown>;
  const cached = views.get(tileset);
  if (cached && sameFingerprint(record, cached.fingerprint)) return cached.view ?? undefined;
  const ready = bundledTilesetDefinitionReady(id);
  if (ready === undefined) return undefined; // 번들 id 가 아니다.
  if (!ready) {
    // 정의를 아직 읽지 않았다(편집기의 지연 정의). 이 객체는 이번 세션 동안 통째로 싣는다 — 정의가 중간에 읽혀도 같은 객체의
    // 저장 모양이 바뀌지 않게 기억한다. 바뀐 항목(새 객체)은 그때 다시 판단한다.
    views.set(tileset, { fingerprint: fingerprintOf(record), view: null });
    return undefined;
  }
  const base = comparisonBase(id);
  let view: Record<string, unknown> | null = null;
  if (base && jsonEqual(record.image, base.image)) {
    const source = wire as Record<string, unknown>;
    const diff = diffAgainst(source, base);
    if (diff) view = viewOf(source, diff);
  }
  views.set(tileset, { fingerprint: fingerprintOf(record), view });
  return view ?? undefined;
}

/**
 * 저장 보기의 차이를 타일셋 하나씩 양보하며 미리 만든다. 로드 뒤 첫 저장 보기가 번들 정의 수십 개를 한 번에 비교해
 * 메인 스레드를 약 1s 멈추지 않게 한다(store.baselineFrom 의 한가한 예열). 결과는 저장 보기와 같은 기억에 들어간다.
 */
export async function primeBundledTilesetDiffViews(
  project: { readonly tilesets: Readonly<Record<string, TilesetDef>> },
  yieldToTask: () => Promise<void>,
  stale: () => boolean,
): Promise<void> {
  if (!writeDiffs) return;
  for (const [id, tileset] of Object.entries(project.tilesets)) {
    if (stale()) return;
    if (!tileset || Object.hasOwn(tileset, "terrainTemplates") || isPendingLazyTileset(tileset)) continue;
    const cached = views.get(tileset);
    if (cached && sameFingerprint(tileset as unknown as Record<string, unknown>, cached.fingerprint)) continue;
    bundledTilesetDiffView(id, tileset, tileset);
    await yieldToTask();
  }
}

/**
 * 이 프로젝트 타일셋들의 기억한 차이 보기를 버린다. 로드 정규화(ensure*)처럼 타일셋 원소 객체 안을 제자리에서 고칠 수 있는
 * 일 뒤에 부른다 — 기억 대조(필드·원소 정체)는 원소 객체 안의 속성 변경을 못 본다.
 */
export function forgetBundledTilesetDiffViews(project: { readonly tilesets: Readonly<Record<string, TilesetDef>> }): void {
  for (const tileset of Object.values(project.tilesets)) if (tileset && !Object.isFrozen(tileset)) views.delete(tileset);
}

// ── 되돌리기 ──────────────────────────────────────────────────────────────

export class BundledTilesetDiffError extends Error {}

export type BundledTilesetDiffRestore = {
  readonly restored: number;
  /** 다른 판의 번들에 얹은 칸 표·목록 수(앱 갱신). */
  readonly rebased: number;
  /** 다른 판의 번들에서 사라져 채울 값이 없던 칸 수. */
  readonly missing: number;
};

function idOf(value: unknown): string | undefined {
  return isRecord(value) && typeof value.id === "string" ? value.id : undefined;
}

function rebuildArray(patch: ArrayPatch, current: unknown, counters: { rebased: number; missing: number }): unknown[] {
  const base = Array.isArray(current) ? current : [];
  const sameLayout = base.length === patch.b;
  if (patch.t === 1 || sameLayout) {
    if (!sameLayout) counters.rebased += 1;
    const out = new Array<unknown>(patch.n);
    for (let index = 0; index < patch.n; index += 1) {
      if (index < patch.b) {
        if (index < base.length) out[index] = base[index];
        else {
          counters.missing += 1;
          out[index] = base.length > 0 ? structuredClone(base[base.length - 1]) : null;
        }
      } else {
        out[index] = jsonValue(patch.tail?.[index - patch.b]);
      }
    }
    for (const [index, value] of patch.at ?? []) {
      if (index < 0 || index >= patch.n) continue;
      // 같은 판이면 번호가 곧 자리다. 목록에서 그 자리의 id 가 다르면(다른 판) id 로 맞춘다.
      const id = patch.t === 1 ? undefined : idOf(value);
      if (id !== undefined && idOf(out[index]) !== id) {
        const found = out.findIndex((item) => idOf(item) === id);
        if (found >= 0) { out[found] = value; continue; }
      }
      out[index] = value;
    }
    return out;
  }
  // 다른 판의 목록: 지금 번들 목록에 저자 항목을 id 로 얹는다(같은 id 는 바꾸고, 없으면 덧붙인다).
  counters.rebased += 1;
  const out = base.slice();
  const place = (value: unknown, index: number): void => {
    const id = idOf(value);
    if (id !== undefined) {
      const found = out.findIndex((item) => idOf(item) === id);
      if (found >= 0) out[found] = value;
      else out.push(value);
      return;
    }
    if (index < out.length) out[index] = value;
    else out.push(value);
  };
  for (const [index, value] of patch.at ?? []) place(value, index);
  (patch.tail ?? []).forEach((value, offset) => place(jsonValue(value), patch.b + offset));
  return out;
}

function readDiff(id: string, value: unknown): TilesetDiff {
  if (!isRecord(value) || value.v !== FORMAT || !Array.isArray(value.keys) || !value.keys.every((key) => typeof key === "string")) {
    throw new BundledTilesetDiffError(`번들 타일셋 ${id} 의 차이 형식을 읽을 수 없습니다(v=${isRecord(value) ? String(value.v) : "?"}) — 더 새 앱으로 저장한 프로젝트일 수 있습니다.`);
  }
  if (value.set !== undefined && !isRecord(value.set)) throw new BundledTilesetDiffError(`번들 타일셋 ${id} 차이의 set 이 객체가 아닙니다.`);
  if (value.arrays !== undefined && !isRecord(value.arrays)) throw new BundledTilesetDiffError(`번들 타일셋 ${id} 차이의 arrays 가 객체가 아닙니다.`);
  if (value.del !== undefined && !Array.isArray(value.del)) throw new BundledTilesetDiffError(`번들 타일셋 ${id} 차이의 del 이 배열이 아닙니다.`);
  for (const [key, patch] of Object.entries((value.arrays ?? {}) as Record<string, unknown>)) {
    if (!isRecord(patch) || typeof patch.b !== "number" || typeof patch.n !== "number" || !Number.isInteger(patch.n) || patch.n < 0
      || (patch.at !== undefined && !Array.isArray(patch.at)) || (patch.tail !== undefined && !Array.isArray(patch.tail))) {
      throw new BundledTilesetDiffError(`번들 타일셋 ${id} 차이의 배열 ${key} 를 읽을 수 없습니다.`);
    }
  }
  return value as unknown as TilesetDiff;
}

/** 차이 보기 하나 → 타일셋. `base` 는 이 앱의 새 번들 정의(되돌린 결과가 그 객체를 그대로 쓴다). */
function restoreOne(id: string, view: Record<string, unknown>, base: Record<string, unknown>, counters: { rebased: number; missing: number }): Record<string, unknown> {
  const diff = readDiff(id, view[BUNDLED_TILESET_DIFF]);
  const set = (diff.set ?? {}) as Record<string, unknown>;
  const arrays = (diff.arrays ?? {}) as Record<string, ArrayPatch>;
  const deleted = new Set(diff.del ?? []);
  const order = [...diff.keys];
  const listed = new Set(order);
  // 다른 판의 번들이 새로 가진 필드(저장 때 번들에 없었고 저자가 지우지도 않은 것)는 뒤에 붙인다.
  for (const key of Object.keys(base)) if (!listed.has(key) && !deleted.has(key) && present(base[key])) order.push(key);
  const out: Record<string, unknown> = {};
  for (const key of order) {
    if (HEADER.has(key) && present(view[key])) out[key] = view[key];
    else if (Object.hasOwn(set, key)) out[key] = set[key];
    else if (Object.hasOwn(arrays, key)) out[key] = rebuildArray(arrays[key]!, base[key], counters);
    else if (present(base[key])) out[key] = base[key];
  }
  return out;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

// ── 지연 되돌리기 ──────────────────────────────────────────────────────────
// 편집기 로드는 맵이 쓰는 번들 타일셋만 곧바로 되돌린다. 나머지는 머리(id·name·image·count …)만 든 객체로 두고,
// 무거운 필드(칸 표·킷·참고문서 …)를 처음 읽거나 어떤 필드든 쓰면 그때 번들 정의를 읽어 되돌린다(같은 객체가 제자리에서 온전해진다).
// 왜(2026-10-27): 로드마다 번들 정의 JSON 약 47MB 를 모두 읽고 타일셋 수십 개를 되돌렸다 — 맵이 쓰는 것은 대개 서너 개다.
//  - 열거·복제·직렬화(Object.keys·structuredClone·JSON.stringify·펼침)는 모든 키를 읽으므로 되돌린다 — 값은 언제나 온전한 타일셋과 같다.
//  - 저장 보기는 되돌리지 않고 받은 차이를 그대로 싣는다. 검사(validateTileset)는 되돌릴 때까지 미룬다(번들 + 저장된 차이라 이미 통과한 모양).
//  - 되돌리기 전에 지운 키는 되돌린 뒤에도 없다. 다른 판의 번들이 새로 가진 필드는 되돌린 뒤에야 보인다.
type LazyState = { readonly view: Record<string, unknown>; readonly keys: readonly string[]; readonly getters: ReadonlyMap<string, () => unknown>; readonly materialize: () => void };
const lazyStates = new WeakMap<object, LazyState>();
let lazyPolicy: ((id: string) => boolean) | null = null;

/** `run` 동안의 되돌리기에서 `eager` 에 없는 번들 타일셋은 지연으로 둔다(편집기 로드 전용). */
export function withLazyBundledTilesets<T>(eager: ReadonlySet<string>, run: () => T): T {
  const previous = lazyPolicy;
  lazyPolicy = (id) => !eager.has(id);
  try { return run(); } finally { lazyPolicy = previous; }
}

function lazyUntouched(tileset: object, state: LazyState): boolean {
  const keys = Object.keys(tileset);
  if (keys.length !== state.keys.length) return false;
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index]!;
    if (key !== state.keys[index] || Object.getOwnPropertyDescriptor(tileset, key)?.get !== state.getters.get(key)) return false;
  }
  return true;
}

function lazyTileset(id: string, view: Record<string, unknown>): Record<string, unknown> {
  const diff = readDiff(id, view[BUNDLED_TILESET_DIFF]);
  const out: Record<string, unknown> = {};
  const getters = new Map<string, () => unknown>();
  const listed = new Set(diff.keys);
  let done = false;
  const materialize = (): void => {
    if (done) return;
    done = true;
    const base = bundledTilesetById(id) as unknown as Record<string, unknown> | undefined;
    if (!base) throw new BundledTilesetDiffError(`번들 타일셋 ${id} 의 정의가 이 앱에 없습니다 — 이 프로젝트를 저장한 앱(같은 판 이상)으로 열어 주세요.`);
    const full = restoreOne(id, view, base, { rebased: 0, missing: 0 });
    for (const key of Object.keys(full)) {
      const descriptor = Object.getOwnPropertyDescriptor(out, key);
      const ours = descriptor ? descriptor.get !== undefined && descriptor.get === getters.get(key) : !listed.has(key);
      if (ours) Object.defineProperty(out, key, { value: full[key], writable: true, enumerable: true, configurable: true });
    }
    markLazyTilesetMaterialized(out, id);
  };
  for (const key of diff.keys) {
    const header = HEADER.has(key) && present(view[key]);
    const get = header ? (): unknown => (done ? out[key] : view[key]) : (): unknown => { materialize(); return out[key]; };
    Object.defineProperty(out, key, {
      get,
      set(value: unknown) { materialize(); out[key] = value; },
      enumerable: true,
      configurable: true,
    });
    getters.set(key, get);
  }
  markPendingLazyTileset(out);
  lazyStates.set(out, { view, keys: diff.keys, getters, materialize });
  return out;
}

/** 지연 타일셋이면 지금 되돌린다(그렇지 않으면 아무 일도 하지 않는다). */
export function materializeLazyBundledTileset(tileset: unknown): void {
  if (tileset && typeof tileset === "object" && isPendingLazyTileset(tileset)) lazyStates.get(tileset)?.materialize();
}

/** 아직 되돌리지 않은 지연 번들 타일셋의 id. */
export function pendingLazyBundledTilesetIds(tilesets: Readonly<Record<string, unknown>>): string[] {
  return Object.keys(tilesets).filter((id) => isPendingLazyTileset(tilesets[id]));
}

/**
 * 모든 타일셋을 읽을 화면(자료집·조수 턴)이 열리기 전에 지연 타일셋의 번들 정의를 비동기로 읽어 둔다 — 읽지 않으면 되돌리기가
 * 메인 스레드의 동기 요청(bundledJson.ts 대비책)으로 정의를 읽는다. 읽을 것이 없으면 null.
 */
export function preloadPendingLazyBundledTilesets(tilesets: Readonly<Record<string, unknown>>): Promise<void> | null {
  const ids = pendingLazyBundledTilesetIds(tilesets);
  return ids.length > 0 ? preloadBundledTilesetDefinitions(ids) : null;
}

/** 얼린 차이 보기(호스트 문서 트리의 공유 본문) → 얼린 되돌린 타일셋. 같은 본문이면 같은 객체를 돌려준다. */
const frozenRestores = new WeakMap<object, Record<string, unknown>>();

/** 차이 보기인가. */
export function isBundledTilesetDiffView(value: unknown): boolean {
  return isRecord(value) && Object.hasOwn(value, BUNDLED_TILESET_DIFF);
}

/**
 * 읽은 JSON(검사 전)의 차이 보기 타일셋을 되돌린다(제자리, `data.tilesets` 의 칸을 바꾼다). 이미 온전한 타일셋은 건드리지 않는다.
 * 얼린 보기(호스트 문서 트리)는 얼린 결과를 기억해 같은 객체로 돌려준다 — 호스트의 패치 저장이 매번 번들 정의를 다시 만들지 않는다.
 */
export function restoreBundledTilesetDiffs(data: { tilesets?: unknown }): BundledTilesetDiffRestore {
  const tilesets = data.tilesets;
  const counters = { rebased: 0, missing: 0 };
  let restored = 0;
  if (!isRecord(tilesets)) return { restored, ...counters };
  for (const [id, value] of Object.entries(tilesets)) {
    if (!isRecord(value) || !Object.hasOwn(value, BUNDLED_TILESET_DIFF)) continue;
    const frozen = Object.isFrozen(value);
    let tileset = frozen ? frozenRestores.get(value) : undefined;
    if (!tileset && !frozen && lazyPolicy?.(id)) tileset = lazyTileset(id, value);
    if (!tileset) {
      const base = bundledTilesetById(id) as unknown as Record<string, unknown> | undefined;
      if (!base) throw new BundledTilesetDiffError(`번들 타일셋 ${id} 의 정의가 이 앱에 없습니다 — 이 프로젝트를 저장한 앱(같은 판 이상)으로 열어 주세요.`);
      tileset = restoreOne(id, value, base, counters);
      if (frozen) {
        // 번들 정의 생성자가 정의 JSON 기억과 원소를 공유할 수 있다 — 그 기억까지 얼리지 않게 떼어 낸 사본을 얼린다.
        tileset = deepFreeze(structuredClone(tileset));
        frozenRestores.set(value, tileset);
        // 얼린 결과는 바뀌지 않으므로 저장 보기는 받은 본문 그대로다(호스트가 같은 본문 글을 다시 쓴다).
        views.set(tileset, { fingerprint: fingerprintOf(tileset), view: value });
      }
    }
    tilesets[id] = tileset;
    restored += 1;
  }
  return { restored, ...counters };
}

/** 차이 보기의 번들 id 들(로드 전에 정의 JSON 을 미리 읽을 때 쓴다). */
export function bundledTilesetDiffIds(data: { tilesets?: unknown }): string[] {
  const tilesets = data.tilesets;
  if (!isRecord(tilesets)) return [];
  return Object.entries(tilesets).filter(([, value]) => isBundledTilesetDiffView(value)).map(([id]) => id);
}

/** 계약 시험 전용 — 임의의 번들 판본(옛 판 흉내)에 대한 차이를 만들고 되돌린다. */
export const bundledTilesetDiffForTest = {
  diff(tileset: object, base: object): Record<string, unknown> | null {
    const diff = diffAgainst(tileset as Record<string, unknown>, base as Record<string, unknown>);
    return diff ? viewOf(tileset as Record<string, unknown>, diff) : null;
  },
  restore(id: string, view: object, base: object): { tileset: Record<string, unknown>; rebased: number; missing: number } {
    const counters = { rebased: 0, missing: 0 };
    const tileset = restoreOne(id, view as Record<string, unknown>, base as Record<string, unknown>, counters);
    return { tileset, ...counters };
  },
};
