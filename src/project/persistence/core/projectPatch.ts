import { canonicalJsonString } from "./canonicalJson";
import { sharedEntryDigest } from "./contentDigest";

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
 * 왜 (2026-09-25·09-30 실측): 타일셋 한 칸이 수백 KB(문서·그림·타일 속성), 프로젝트 합계 수백 MB다.
 * `sameValue` 는 양쪽을 `JSON.stringify` 하므로 자동저장 한 번에 수백 칸 × 2 번의 직렬화가 돌고,
 * 요약(`jsonContentDigest`)도 신선도 검사(`isFresh`)가 하위 트리를 매번 다시 훑어 1s 이상 걸렸다.
 * 그래서 항목 통째를 `sharedEntryDigest` 로 본다 — 한 번 대조를 마친 항목은 O(1) 이고,
 * 요약의 동일성은 `canonicalJsonOf` 와 같다(`contentDigest.ts` 머리말).
 *
 * 어느 편이든 확실하지 않으면 «바뀌었다»로 기울인다: 거짓 «그대로»는 데이터 손실이고,
 * 거짓 «바뀌었다»는 전송량만 늘린다.
 */
function sameTilesetValue(base: unknown, local: unknown): boolean {
  if (base === local) return true;
  if (!isRecord(base) || !isRecord(local)) return sameValue(base, local);
  // 항목 통째를 요약으로 본다(문서·그림·타일 속성 모두 — 요약의 동일성은 `canonicalJsonOf` 와 같다).
  // 예전에는 문서를 뗀 나머지를 스프레드로 새 객체 둘로 만들어 비교했다 — 새 객체는 기억이 없어 매 저장 전 필드를 글로 만들고 해시했다.
  // `sharedEntryDigest` 는 이미 대조를 마친 항목은 아래 가지를 다시 훑지 않는다(2026-09-30 실측, 타일셋 385칸: 자동저장 diff 1.1s → 한 번 대조한 뒤 O(1)).
  const baseDigest = sharedEntryDigest(base);
  // 어느 한쪽이라도 확실하지 않으면 «바뀌었다»로 기운다(거짓 «바뀌었다»는 전송량만 늘린다).
  return baseDigest !== undefined && baseDigest === sharedEntryDigest(local);
}

/**
 * 비교 본체. 항목 하나를 볼 때마다 한 번씩 멈출 자리(yield)를 내준다 — 동기 판은 그냥 끝까지 돌고,
 * 비동기 판은 그 자리에서 메인 스레드를 잠깐 돌려준다. 같은 코드라 두 판의 결과가 언제나 같다.
 */
function* diffProjectDocumentsSteps(base: unknown, local: unknown): Generator<void, ProjectDocumentPatch> {
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
    const same = key === "tilesets" ? sameTilesetValue : sameValue;
    if ((NESTED_KEYS as readonly string[]).includes(key) && isRecord(baseValue) && isRecord(localValue)) {
      // 사전 가지는 항목별로 본다 — 통째 비교가 같으면 항목별 비교도 모두 같으므로 결과는 그대로다.
      if (baseValue === localValue) continue;
      const childSet: Record<string, unknown> = {};
      const childDel: string[] = [];
      for (const childKey of new Set([...Object.keys(baseValue), ...Object.keys(localValue)])) {
        if (!Object.prototype.hasOwnProperty.call(localValue, childKey)) {
          childDel.push(childKey);
          continue;
        }
        yield;
        if (Object.prototype.hasOwnProperty.call(baseValue, childKey) && same(baseValue[childKey], localValue[childKey])) continue;
        childSet[childKey] = localValue[childKey];
      }
      if (Object.keys(childSet).length > 0 || childDel.length > 0) {
        nested[key as NestedKey] = {
          ...(Object.keys(childSet).length > 0 ? { set: childSet } : {}),
          ...(childDel.length > 0 ? { del: childDel } : {}),
        };
      }
      continue;
    }
    yield;
    if (hasBase && same(baseValue, localValue)) continue;
    set[key] = localValue;
  }
  return {
    ...(Object.keys(set).length > 0 ? { set } : {}),
    ...(del.length > 0 ? { del } : {}),
    ...nested,
  };
}

/** 두 JSON 트리를 병합 단위로 비교한다. 키 순서만 다른 값은 빠진다. */
export function diffProjectDocuments(base: unknown, local: unknown): ProjectDocumentPatch {
  const steps = diffProjectDocumentsSteps(base, local);
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
  }
}

/**
 * `diffProjectDocuments` 와 같은 결과를 내되, `sliceMs` 를 넘게 연달아 돌지 않고 `yieldToMain` 에서 쉰다.
 *
 * 왜 (2026-09-26 실측, 81MB 새 프로젝트): 저장 비교가 타일셋 수십 칸 · DB 를 제자리 수정까지 잡으려고 값으로
 * 대조해 한 번에 약 1.1s 메인 스레드를 막았다(칠하기 직후 화면 정지). 대조 자체는 그대로 두고 잘게 나눈다.
 * 쉬는 동안 스토어는 가지를 **교체**만 하므로(update·updateMap*) 입력이 가리키는 객체는 제출 때 내용 그대로다.
 */
export async function diffProjectDocumentsSliced(
  base: unknown,
  local: unknown,
  yieldToMain: () => Promise<void>,
  sliceMs = 12,
): Promise<ProjectDocumentPatch> {
  const steps = diffProjectDocumentsSteps(base, local);
  let sliceStart = performance.now();
  for (;;) {
    const step = steps.next();
    if (step.done) return step.value;
    if (performance.now() - sliceStart >= sliceMs) {
      await yieldToMain();
      sliceStart = performance.now();
    }
  }
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
 * 저장본은 글(`serialized`) 또는 이미 파싱한 트리를 돌려주는 함수(`document`)로 받는다 — 호스트는 타일셋을
 * 따로 들고 있어 81MB 글을 다시 파싱하지 않는다(electron/local-store/tilesetFold.ts).
 */
export function resolveMapPatchDocuments(
  input: MapPatchWire,
  stored: { readonly serialized?: string | null; readonly document?: () => unknown; readonly sha256: string | null },
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
  } else if ((input.baseSha ?? null) === stored.sha256 && stored.sha256 !== null) {
    baseJson = stored.document ? stored.document() : stored.serialized ? JSON.parse(stored.serialized) as unknown : undefined;
    if (baseJson === undefined || baseJson === null) return { kind: "stale-base" };
  } else {
    return { kind: "stale-base" };
  }
  return { kind: "ready", baseJson, localJson: applyProjectDocumentPatch(baseJson, input.patch) };
}
