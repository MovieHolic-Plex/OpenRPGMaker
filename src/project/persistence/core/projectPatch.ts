import { canonicalJsonString } from "./canonicalJson";

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

function diffDict(base: Record<string, unknown>, local: Record<string, unknown>): DictPatch {
  const set: Record<string, unknown> = {};
  const del: string[] = [];
  for (const key of new Set([...Object.keys(base), ...Object.keys(local)])) {
    const hasLocal = Object.prototype.hasOwnProperty.call(local, key);
    if (!hasLocal) {
      del.push(key);
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(base, key) && sameValue(base[key], local[key])) continue;
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
    if (hasBase && sameValue(baseValue, localValue)) continue;
    if ((NESTED_KEYS as readonly string[]).includes(key) && isRecord(baseValue) && isRecord(localValue)) {
      const child = diffDict(baseValue, localValue);
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
