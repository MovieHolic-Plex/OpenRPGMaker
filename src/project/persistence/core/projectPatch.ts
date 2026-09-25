import { canonicalJsonString } from "./canonicalJson";
import { jsonContentDigest } from "./contentDigest";

/**
 * 맵 패치 전송 본문.
 *
 * 호스트 브리지는 요청 본문을 64MB에서 자른다. 자동 저장이 기준 문서와 현재 문서를
 * 통째로 실으면, 타일셋 참고 그림이 들어 있는 프로젝트는 그 한도 아래에서 400이 난다.
 * 병합 단위(최상위 키, 그리고 maps/database/tilesets 한 단계)만 바꾼 값을 보낸다.
 */
const NESTED_KEYS = ["maps", "database", "tilesets"] as const;
type NestedKey = (typeof NESTED_KEYS)[number];

export type DictPatch = {
  readonly set?: Readonly<Record<string, unknown>>;
  readonly del?: readonly string[];
};

export type ProjectDocumentPatch = DictPatch & {
  readonly maps?: DictPatch;
  readonly database?: DictPatch;
  readonly tilesets?: DictPatch;
};

export type MapPatchWire = {
  readonly baseSerialized?: string;
  readonly serialized?: string;
  readonly baseSha?: string | null;
  readonly patch?: ProjectDocumentPatch;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  const leftText = JSON.stringify(left);
  const rightText = JSON.stringify(right);
  if (leftText === rightText) return true;
  return canonicalJsonString(left) === canonicalJsonString(right);
}

/**
 * 타일셋 한 칸의 변경 여부. 타일셋 만 이 바깥 문단을 쓴다.
 *
 * 왜 (2026-09-25 실측): `referenceDocuments`(AI 학습 문서)가 타일셋 한 칸에 수백 KB · 프로젝트 합계 42MB다.
 * `sameValue` 는 문서 본모까지 포함해 양쪽을 `JSON.stringify` 하므로 자동저장 한 번에 322칸 × 2 번의
 * 직렬화가 돈다(상위 diff 자체 1,535ms). 문서는 «통째로 교잴만 하고 원소를 고쳤지 않는다»는 계약을
 * 가지므로(`projectClone.cloneProjectSharingReferenceDocuments`), 문서 부분은 배열 실체가 같으면 그리면
 * 끝이고, 달라도 노드당 기억을 가진 요약(`jsonContentDigest`)으로 한 번만 본다.
 * 문서 밖 필드는 지금도 `sameValue` 가 보므로 변경 판정은 그대로다 — 요약의 동일성은
 * `canonicalJsonOf` 와 같다(`contentDigest.ts` 머리말).
 *
 * 어느 편이든 확실하지 않으면 «바눴다»로 기울인다: 거짓 «그대로»는 문서 소십이고, 거짓 «바눴다»는
 * 전송량만 늨다.
 */
function sameTilesetValue(base: unknown, local: unknown): boolean {
  if (base === local) return true;
  if (!isRecord(base) || !isRecord(local)) return sameValue(base, local);
  const baseDocuments = base.referenceDocuments;
  const localDocuments = local.referenceDocuments;
  if (baseDocuments !== localDocuments
    && jsonContentDigest(baseDocuments, "referenceDocuments") !== jsonContentDigest(localDocuments, "referenceDocuments")) {
    return false;
  }
  const { referenceDocuments: _baseDocuments, ...baseRest } = base;
  const { referenceDocuments: _localDocuments, ...localRest } = local;
  // 문서 밖 필드도 요약으로 본다. `projectWireView` 가 타일셋마다 버려진 키를 떼며 **새 객체**를
  // 만들어 `base === local` 단축이 언제나 깨지므로(실측: 공유 기준본이어도 diff 1,571ms),
  // 여기서 `sameValue` 를 쓰면 매번 두 번의 전체 `JSON.stringify` 가 돈다 — 타일셋 한 칸은
  // passability/priority/terrain 배열만으로도 수백 칸이다. 요약은 같은 객체를 만나면 노드 기억을
  // 재사용하므로(WeakMap) 공유 기준본에서는 두 번째 저장부터 거의 공짜다.
  return jsonContentDigest(baseRest) === jsonContentDigest(localRest);
}

function diffDict(
  base: Record<string, unknown>,
  local: Record<string, unknown>,
  same: (base: unknown, local: unknown) => boolean = sameValue,
): DictPatch {
  const set: Record<string, unknown> = {};
  const del: string[] = [];
  for (const key of new Set([...Object.keys(base), ...Object.keys(local)])) {
    const hasLocal = Object.prototype.hasOwnProperty.call(local, key);
    if (!hasLocal) {
      del.push(key);
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(base, key) && same(base[key], local[key])) continue;
    set[key] = local[key];
  }
  return {
    ...(Object.keys(set).length > 0 ? { set } : {}),
    ...(del.length > 0 ? { del } : {}),
  };
}

/** 두 JSON 트리를 병합 단위로 비교한다. 키 순서만 다른 값은 빠진다. */
export function diffProjectDocuments(base: unknown, local: unknown): ProjectDocumentPatch {
  const baseRecord = isRecord(base) ? base : {};
  const localRecord = isRecord(local) ? local : {};
  const set: Record<string, unknown> = {};
  const del: string[] = [];
  const nested: Partial<Record<NestedKey, DictPatch>> = {};
  for (const key of new Set([...Object.keys(baseRecord), ...Object.keys(localRecord)])) {
    const hasLocal = Object.prototype.hasOwnProperty.call(localRecord, key);
    if (!hasLocal) {
      del.push(key);
      continue;
    }
    const localValue = localRecord[key];
    const hasBase = Object.prototype.hasOwnProperty.call(baseRecord, key);
    const baseValue = hasBase ? baseRecord[key] : undefined;
    const sameForKey = key === "tilesets" ? sameTilesetValue : sameValue;
    if (hasBase && sameForKey(baseValue, localValue)) continue;
    if ((NESTED_KEYS as readonly string[]).includes(key) && isRecord(baseValue) && isRecord(localValue)) {
      const child = diffDict(baseValue, localValue, key === "tilesets" ? sameTilesetValue : sameValue);
      if (child.set || child.del) nested[key as NestedKey] = child;
      continue;
    }
    set[key] = localValue;
  }
  return {
    ...(Object.keys(set).length > 0 ? { set } : {}),
    ...(del.length > 0 ? { del } : {}),
    ...nested,
  };
}

/**
 * 패치 값만 와이어 JSON 으로 맞춘다. 푸로젝트 전체가 아니라 **지금 실려 보내는 항목만** 왕부한다.
 *
 * 왜: diff 는 이제 생산 메모리 보기를 읽으므로, `undefined` 값을 가진 키나 `toJSON` 을 가진 값이
 * 패치에 그대로 실릴 수 있다. 호스트는 이 패치를 기준 문서 위에 얹어 저장문을 만들므로
 * (`applyProjectDocumentPatch`), 값은 `serialize` 가 쓴 바이트와 동듈해야 한다. 왕부 범위가
 * 변경량(칠하기 한 번 = 바뀜 맵 하나, 수십 KB)에 밀척 붙는다.
 */
export function withWirePatchValues(patch: ProjectDocumentPatch): ProjectDocumentPatch {
  const wireDict = (dict: DictPatch | undefined): DictPatch | undefined => {
    if (!dict?.set) return dict;
    const set: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dict.set)) set[key] = toWireValue(value);
    return { ...dict, set };
  };
  const next: ProjectDocumentPatch = {
    ...patch,
    ...(patch.set ? { set: Object.fromEntries(Object.entries(patch.set).map(([key, value]) => [key, toWireValue(value)])) } : {}),
  };
  const withNested: Record<string, unknown> = { ...next };
  for (const key of NESTED_KEYS) {
    const child = wireDict(patch[key]);
    if (child) withNested[key] = child;
  }
  return withNested as ProjectDocumentPatch;
}

function toWireValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function applyDict(base: Record<string, unknown>, patch: DictPatch | undefined): Record<string, unknown> {
  const next: Record<string, unknown> = { ...base };
  if (!patch) return next;
  for (const key of patch.del ?? []) delete next[key];
  for (const [key, value] of Object.entries(patch.set ?? {})) next[key] = value;
  return next;
}

/** 기준 JSON 위에 패치를 얹어 편집기 문서를 복원한다. 기준 객체는 바꾸지 않는다. */
export function applyProjectDocumentPatch(base: unknown, patch: ProjectDocumentPatch): unknown {
  const next = applyDict(isRecord(base) ? base : {}, patch);
  for (const key of NESTED_KEYS) {
    const child = patch[key];
    if (!child) continue;
    next[key] = applyDict(isRecord(next[key]) ? next[key] as Record<string, unknown> : {}, child);
  }
  return next;
}

/**
 * 브리지가 받은 맵 패치 본문을 기준/현재 JSON으로 푼다.
 * 기준 해시가 저장본과 같으면 기준 문서는 서버가 가진 것을 쓴다.
 * 해시가 다르면 클라이언트가 기준 문서를 다시 보내야 한다.
 */
export function resolveMapPatchDocuments(
  input: MapPatchWire,
  stored: { readonly serialized: string | null; readonly sha256: string | null },
): { readonly kind: "stale-base" } | { readonly kind: "ready"; readonly baseJson: unknown; readonly localJson: unknown } {
  if (input.baseSerialized !== undefined && input.serialized !== undefined && input.patch === undefined) {
    return {
      kind: "ready",
      baseJson: JSON.parse(input.baseSerialized) as unknown,
      localJson: JSON.parse(input.serialized) as unknown,
    };
  }
  if (!input.patch) throw new Error("맵 패치 본문이 비어 있습니다");
  let baseJson: unknown;
  if (input.baseSerialized !== undefined) {
    baseJson = JSON.parse(input.baseSerialized) as unknown;
  } else if ((input.baseSha ?? null) === stored.sha256 && stored.serialized) {
    baseJson = JSON.parse(stored.serialized) as unknown;
  } else {
    return { kind: "stale-base" };
  }
  return { kind: "ready", baseJson, localJson: applyProjectDocumentPatch(baseJson, input.patch) };
}
