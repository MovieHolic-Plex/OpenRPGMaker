// editor/editActivityLog.ts
// 편집 행위 로그 — 사람이 편집기에서 한 행위를 구조화해 남긴다.
//
// 왜 이 파일이 있나 (2026-08-29 관측성 감사 실측) —
// AI 경로에는 성숙한 감사 파이프라인이 있었다(`src/ai/activityLog.ts`: 링버퍼 + Supabase +
// outbox 재시도 + 디스크 미러 + CLI 리더). **사람 편집은 한 줄도 남지 않았다.**
// NPC 하나를 열어 이름·커맨드·조건을 고치는 4단계 편집이 남기는 기록은
//   `mapEditHistory` 엔트리 1건, 라벨 `"이벤트 편집"`, 어떤 NPC 인지도 없음, 새로고침에 소멸
// 이 전부였다. 그래서 "방금 뭘 했더니 이렇게 됐다" 를 사후에 재구성할 수 없었다.
//
// undo 스택과 **의도적으로 분리**한다:
//   - `mapEditHistory` 는 되돌리기용이다 → before 스냅샷을 들고, 연속 중복을 dedup 하고,
//     50건에서 밀어내고, 모달 discard 시 잘라낸다.
//   - 이 로그는 감사용이다 → 무엇이 바뀌었는지(after 포함)를 들고, 전량 보존하고,
//     영속하고, 되돌려도 기록이 남는다.
//   두 요구가 정반대라 한 자료구조로 겸업하면 둘 다 나빠진다.
//
// ⚠ **이 모듈은 `@/project/store` 를 import 하지 않는다.** store 가 이 모듈을 import 하므로
//   순환이 된다. 필요한 값은 전부 인자로 받는다(sink 주입 규약 — applyChangesetToStore 와 동형).
//
// 성능 계약: mutation 마다 호출되는 경로다. **full diff 를 돌리지 않는다.**
//   descriptor 에 이미 담긴 값(scope/mapId/cells/label)만 기록하고, 필드 단위 상세는
//   호출자가 이미 계산해 둔 것(예: 이벤트 편집기의 EventDiff)을 넘겨줄 때만 붙인다.

import { reasonForEditAction } from "@/ai/toolReason";
import { EDIT_ACTIVITY_DISK_ENDPOINT } from "@/editor/editActivityEndpoint";
import { STORAGE_PREFIX } from "@/util/appStorage";
import { createLogger } from "@/util/logger";

const log = createLogger("edit-activity");

const STORAGE_KEY = `${STORAGE_PREFIX}edit-activity`;
/** 링버퍼 상한. 한 작업 세션을 되짚기에 충분하고 localStorage 5MB 안에 넉넉히 들어간다. */
const MAX_ENTRIES = 500;
/** localStorage 로 내보내는 개수 — 전량을 매번 쓰면 드래그마다 직렬화가 돈다. */
const MAX_PERSISTED = 200;
/**
 * 연속 병합 창(ms). 페인트 드래그는 포인터 이동마다 `store.updateMap` 을 부른다 —
 * 100셀 드래그가 100 엔트리가 되면 로그가 스트로크 노이즈로 덮인다.
 * 같은 coalesceKey 가 이 창 안에 연속으로 오면 한 엔트리로 합치고 셀 수만 누적한다.
 */
const COALESCE_MS = 600;
const PERSIST_DEBOUNCE_MS = 800;
/** 디스크 미러 배치 창 — 스트로크마다 POST 하지 않는다. */
const MIRROR_DEBOUNCE_MS = 1500;
const MAX_FIELD_CHANGES = 40;
const MAX_FIELD_VALUE_CHARS = 400;
/**
 * 커밋 row 하나에 실어 보낼 엔트리 상한. 페인트 세션 하나가 row 를 메가바이트로 만들면
 * 그 row 자체가 못 읽는 것이 된다. 넘치면 **최근 것**을 남긴다 — 링버퍼도, localStorage 도
 * 앞쪽부터 버리므로 축이 같고, 저장 시점에 가까운 행위가 그 저장을 설명한다.
 */
const MAX_COMMIT_ATTACHED = 300;
/**
 * 같은 상한의 바이트 축(직렬화 문자 수). 개수만 막으면 부족하다 —
 * 필드 상세가 붙은 엔트리는 최악 40필드 × 400자라 300건이 수 MB 가 될 수 있다.
 * 한글은 UTF-8 로 자당 3바이트이므로 6만 자는 넉넉히 봐도 200KB 미만이다
 * (AI 로그의 `MAX_KEEPALIVE_BYTES` 60KB 와 같은 자릿수).
 */
const MAX_COMMIT_ATTACHED_CHARS = 64_000;

export const EDIT_ACTIVITY_EVENT = "oprn:edit-activity";

export type EditActivityScope = "map" | "database" | "system" | "assets" | "project";
/** 누가 한 편집인가. AI 경로가 사람 편집으로 오귀속되던 문제(실측)를 여기서 갈라 놓는다. */
export type EditActivityOrigin = "human" | "ai" | "tool" | "system";

export type EditActivityField = {
  readonly path: string;
  readonly before?: unknown;
  readonly after?: unknown;
};

export type EditActivityEntry = {
  readonly seq: number;
  readonly at: string;
  readonly scope: EditActivityScope;
  /** 사람이 읽는 행위 이름. 없으면 null — 라벨 없는 mutation 을 세는 근거가 된다. */
  readonly label: string | null;
  readonly origin: EditActivityOrigin;
  readonly mapId?: string;
  readonly collection?: string;
  readonly cellCount?: number;
  /** 병합된 mutation 수(드래그 1회 = N). 1 이면 생략. */
  readonly mergedCount?: number;
  /** store 의 mutationGeneration — 저장 경로 로그와 대조할 수 있는 축. */
  readonly generation: number;
  readonly fields?: readonly EditActivityField[];
  readonly eventId?: string;
  /** 이 편집을 한 한 줄 이유. 예전 행에는 없을 수 있다. */
  readonly reason?: string;
};

export type EditActivityInput = {
  readonly scope: EditActivityScope;
  readonly label?: string | null;
  readonly origin?: EditActivityOrigin;
  readonly mapId?: string;
  readonly collection?: string;
  readonly cellCount?: number;
  readonly generation: number;
  readonly fields?: readonly EditActivityField[];
  readonly eventId?: string;
  readonly reason?: string;
};

let entries: EditActivityEntry[] = [];
let seq = 0;
let hydrated = false;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let mirrorTimer: ReturnType<typeof setTimeout> | null = null;
let mirrorQueue: EditActivityEntry[] = [];
let mirrorState: "unknown" | "enabled" | "disabled" = "unknown";
let mirrorWarned = false;
let unlabeledCount = 0;
const listeners = new Set<(entry: EditActivityEntry) => void>();

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

function isEntry(value: unknown): value is EditActivityEntry {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.seq === "number" && typeof row.at === "string" && typeof row.scope === "string";
}

function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    entries = parsed.filter(isEntry).slice(-MAX_ENTRIES);
    // seq 는 세션을 넘어 단조 증가해야 한다 — 겹치면 이전 세션 엔트리와 구분이 안 된다.
    seq = entries.reduce((max, entry) => Math.max(max, entry.seq + 1), 0);
  } catch {
    entries = [];
  }
}

function schedulePersist(): void {
  const store = storage();
  if (!store) return;
  if (persistTimer !== null) return;
  const run = (): void => {
    persistTimer = null;
    try {
      store.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_PERSISTED)));
    } catch {
      // QuotaExceeded — 절반으로 줄여 재시도. 그래도 실패하면 이번 세션은 메모리로만 산다.
      try {
        store.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-Math.floor(MAX_PERSISTED / 4))));
      } catch {
        /* ignore */
      }
    }
  };
  if (typeof setTimeout !== "function") {
    run();
    return;
  }
  persistTimer = setTimeout(run, PERSIST_DEBOUNCE_MS);
}

/** 큰 값이 로그를 잡아먹지 않게 자른다. 진단에 필요한 건 "무엇이 바뀌었나" 지 전문이 아니다. */
function clipValue(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.length <= MAX_FIELD_VALUE_CHARS ? value : `${value.slice(0, MAX_FIELD_VALUE_CHARS)}…`;
  }
  try {
    const raw = JSON.stringify(value);
    if (raw === undefined) return String(value);
    if (raw.length <= MAX_FIELD_VALUE_CHARS) return value;
    return { _truncated: true, preview: `${raw.slice(0, MAX_FIELD_VALUE_CHARS)}…` };
  } catch {
    return { _unserializable: true };
  }
}

function clipFields(fields: readonly EditActivityField[]): readonly EditActivityField[] {
  return fields.slice(0, MAX_FIELD_CHANGES).map((field) => ({
    path: field.path,
    ...(field.before === undefined ? {} : { before: clipValue(field.before) }),
    ...(field.after === undefined ? {} : { after: clipValue(field.after) }),
  }));
}

/**
 * 병합 키. 같은 맵의 같은 라벨 편집이 연달아 오면 하나로 본다.
 * 필드 상세가 붙은 엔트리(이벤트 편집 등)는 병합하지 않는다 — 상세가 섞이면 못 읽는다.
 */
function coalesceKey(input: EditActivityInput): string | null {
  if (input.fields && input.fields.length > 0) return null;
  return `${input.scope}:${input.mapId ?? "-"}:${input.collection ?? "-"}:${input.label ?? "-"}`;
}

function withinCoalesceWindow(entry: EditActivityEntry, nowMs: number): boolean {
  const previous = Date.parse(entry.at);
  return Number.isFinite(previous) && nowMs - previous <= COALESCE_MS;
}

/** 편집 행위 1건 기록. store 의 mutation 초크포인트에서 호출된다. */
export function recordEditActivity(input: EditActivityInput): EditActivityEntry {
  hydrate();
  const nowMs = Date.now();
  const label = input.label ?? null;
  if (label === null) unlabeledCount += 1;

  const key = coalesceKey(input);
  const last = entries[entries.length - 1];
  if (key !== null && last && coalesceKeyOf(last) === key && withinCoalesceWindow(last, nowMs)) {
    const merged: EditActivityEntry = {
      ...last,
      at: new Date(nowMs).toISOString(),
      generation: input.generation,
      mergedCount: (last.mergedCount ?? 1) + 1,
      ...(input.cellCount === undefined && last.cellCount === undefined
        ? {}
        : { cellCount: (last.cellCount ?? 0) + (input.cellCount ?? 0) }),
    };
    entries[entries.length - 1] = merged;
    schedulePersist();
    queueMirror(merged);
    notify(merged);
    return merged;
  }

  const entry: EditActivityEntry = {
    seq: seq++,
    at: new Date(nowMs).toISOString(),
    scope: input.scope,
    label,
    origin: input.origin ?? "human",
    generation: input.generation,
    ...(input.mapId === undefined ? {} : { mapId: input.mapId }),
    ...(input.collection === undefined ? {} : { collection: input.collection }),
    ...(input.cellCount === undefined ? {} : { cellCount: input.cellCount }),
    ...(input.eventId === undefined ? {} : { eventId: input.eventId }),
    ...(input.fields && input.fields.length > 0 ? { fields: clipFields(input.fields) } : {}),
    reason: reasonForEditAction({
      reason: input.reason,
      label: input.label,
      origin: input.origin,
    }),
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
  log.debug(describeEditActivity(entry), entry.fields);
  schedulePersist();
  queueMirror(entry);
  notify(entry);
  return entry;
}

/** 병합 판정용 — 저장된 엔트리에서 키를 되만든다. */
function coalesceKeyOf(entry: EditActivityEntry): string | null {
  if (entry.fields && entry.fields.length > 0) return null;
  return `${entry.scope}:${entry.mapId ?? "-"}:${entry.collection ?? "-"}:${entry.label ?? "-"}`;
}

function notify(entry: EditActivityEntry): void {
  for (const listener of listeners) {
    try {
      listener(entry);
    } catch {
      // 구독자가 던져서 기록 경로를 죽이면 안 된다.
    }
  }
  if (typeof window === "undefined") return;
  if (typeof window.dispatchEvent !== "function" || typeof CustomEvent === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(EDIT_ACTIVITY_EVENT, { detail: entry }));
  } catch {
    /* 스텁 window */
  }
}

/** 사람이 읽는 한 줄 요약. 패널·로그·CLI 가 같은 문구를 쓰게 한다. */
export function describeEditActivity(entry: EditActivityEntry): string {
  const parts: string[] = [entry.label ?? `(라벨 없음: ${entry.scope})`];
  if (entry.mapId) parts.push(entry.mapId);
  if (entry.collection) parts.push(entry.collection);
  if (entry.cellCount !== undefined && entry.cellCount > 0) parts.push(`${entry.cellCount}셀`);
  if (entry.mergedCount !== undefined && entry.mergedCount > 1) parts.push(`×${entry.mergedCount}`);
  if (entry.fields && entry.fields.length > 0) {
    parts.push(`[${entry.fields.map((field) => field.path).slice(0, 4).join(", ")}${entry.fields.length > 4 ? ", …" : ""}]`);
  }
  if (entry.origin !== "human") parts.push(`(${entry.origin})`);
  return parts.join(" · ");
}

export type EditActivityQuery = {
  readonly limit?: number;
  readonly scope?: EditActivityScope;
  readonly mapId?: string;
  readonly labeledOnly?: boolean;
};

/** 최신순. */
export function getEditActivityEntries(query: EditActivityQuery = {}): readonly EditActivityEntry[] {
  hydrate();
  const filtered = entries.filter((entry) => {
    if (query.scope !== undefined && entry.scope !== query.scope) return false;
    if (query.mapId !== undefined && entry.mapId !== query.mapId) return false;
    if (query.labeledOnly === true && entry.label === null) return false;
    return true;
  });
  const limit = query.limit === undefined ? MAX_ENTRIES : Math.max(1, Math.floor(query.limit));
  return filtered.slice(-limit).reverse();
}

export function editActivityEntryCount(): number {
  hydrate();
  return entries.length;
}

/** 커밋 row 에 실리는 형태. `project_changes.patch_json.edits` 로 들어간다. */
export type EditActivityCommitAttachment = {
  readonly entries: readonly EditActivityEntry[];
  /** 링버퍼 밀림 + 상한 절단으로 빠진 건수. 0 이면 전량이다. */
  readonly omitted: number;
};

export type EditActivitySlice = EditActivityCommitAttachment & {
  /** 다음 호출에 그대로 넘길 커서. */
  readonly cursor: number;
};

/**
 * `sinceSeq` 이후의 행위 기록을 잘라 낸다 — 저장 경계에서 커밋 row 에 실을 몫.
 *
 * 왜 저장 경계인가 (2026-08-29 관측성 감사): 이 로그는 브라우저 링버퍼 + localStorage 200건에만
 * 살고 DB 에는 한 줄도 없었다. 그래서 "그 세션에 무슨 행위가 있었나" 를 나중에 조사할 수 없었다.
 * mutation 마다 DB 로 밀면 페인트 드래그 하나가 수백 행이 되므로, 이미 있는 커밋 row 에
 * 묶는다 — 조사 단위(`무엇을 저장했더니 이렇게 됐다`)와 경계가 일치한다.
 *
 * 커서를 쓰는 이유: 커밋마다 "지난 커밋 이후"만 실어야 같은 엔트리가 매 저장에 반복되지 않는다.
 * 알려진 경계 — 이미 드레인된 마지막 엔트리가 병합 창(600ms) 안에서 한 번 더 병합되면
 * 그 갱신분(`mergedCount`/`cellCount` 증가)은 다음 커밋에 실리지 않는다. 엔트리 자체는
 * 이미 실렸으므로 기록이 사라지는 것이 아니라 셀 수가 조금 적게 잡히는 종류의 오차다.
 */
export function takeEditActivitySince(sinceSeq: number, limit = MAX_COMMIT_ATTACHED): EditActivitySlice {
  hydrate();
  const cap = Math.max(1, Math.floor(limit));
  const fresh = entries.filter((entry) => entry.seq >= sinceSeq);
  // 버퍼가 앞쪽을 밀어냈으면 그 몫은 영원히 못 싣는다 — 숫자로라도 남긴다.
  // 안 남기면 "이 저장에는 편집이 3건뿐이었다" 로 읽혀 조사가 엉뚱한 곳으로 간다.
  const oldestKept = entries.length > 0 ? entries[0]!.seq : seq;
  const evicted = Math.max(0, oldestKept - sinceSeq);
  const kept = fitWithinCharBudget(fresh.slice(-cap));
  return {
    entries: kept,
    cursor: Math.max(sinceSeq, seq),
    omitted: evicted + (fresh.length - kept.length),
  };
}

/**
 * 뒤(최신)에서부터 예산 안에 들어가는 만큼만 담는다. 개수 상한과 절단 방향이 같다.
 * 한 건이 혼자 예산을 넘겨도 그 한 건은 남긴다 — 전부 `omitted` 로 사라지면 커밋에
 * "무언가 있었다" 조차 안 남는다.
 */
function fitWithinCharBudget(candidates: readonly EditActivityEntry[]): readonly EditActivityEntry[] {
  let used = 2; // "[]"
  let index = candidates.length;
  while (index > 0) {
    const size = JSON.stringify(candidates[index - 1]).length + 1;
    if (used + size > MAX_COMMIT_ATTACHED_CHARS && index < candidates.length) break;
    used += size;
    index -= 1;
  }
  return candidates.slice(index);
}

/**
 * 라벨 없이 들어온 mutation 수. 153개 descriptor-less 호출부를 의미화하는 진척을
 * 수치로 볼 수 있게 노출한다(감으로 정리하면 끝을 모른다).
 */
export function unlabeledEditActivityCount(): number {
  return unlabeledCount;
}

export function clearEditActivity(): void {
  entries = [];
  unlabeledCount = 0;
  hydrated = true;
  try {
    storage()?.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function subscribeEditActivity(listener: (entry: EditActivityEntry) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function serializeEditActivity(query: EditActivityQuery = {}): string {
  return JSON.stringify(getEditActivityEntries(query), null, 2);
}

// ── DEV 디스크 미러 ────────────────────────────────────────────────
// 배치로 보낸다. 스트로크마다 POST 하면 dev 서버가 요청 폭풍을 맞는다.
// 미들웨어가 없는 환경(진짜 배포)에서는 첫 실패로 끈다 — activityLog.ts 와 같은 전략.

function initialMirrorState(): "unknown" | "disabled" {
  const flag = import.meta.env?.VITE_EDIT_ACTIVITY_DISK_MIRROR;
  return flag === "0" || flag === "false" ? "disabled" : "unknown";
}
mirrorState = initialMirrorState();

function queueMirror(entry: EditActivityEntry): void {
  if (mirrorState === "disabled" || typeof fetch === "undefined") return;
  // 병합 엔트리는 마지막 상태만 보내면 되므로 같은 seq 는 교체한다.
  mirrorQueue = [...mirrorQueue.filter((row) => row.seq !== entry.seq), entry];
  if (mirrorTimer !== null || typeof setTimeout !== "function") return;
  mirrorTimer = setTimeout(() => {
    mirrorTimer = null;
    void flushEditActivityMirror();
  }, MIRROR_DEBOUNCE_MS);
}

export async function flushEditActivityMirror(): Promise<void> {
  if (mirrorState === "disabled" || mirrorQueue.length === 0 || typeof fetch === "undefined") return;
  const batch = mirrorQueue;
  mirrorQueue = [];
  try {
    const res = await fetch(EDIT_ACTIVITY_DISK_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: batch }),
    });
    if (res.ok) {
      mirrorState = "enabled";
      return;
    }
    disableMirror(`${res.status} ${res.statusText}`);
  } catch (error) {
    disableMirror(error instanceof Error ? error.message : String(error));
  }
}

function disableMirror(reason: string): void {
  if (mirrorState !== "enabled") mirrorState = "disabled";
  if (mirrorWarned) return;
  mirrorWarned = true;
  log.warn(`디스크 미러 실패 (${EDIT_ACTIVITY_DISK_ENDPOINT}: ${reason}) — output/edit-activity/ 가 갱신되지 않는다.`);
}

/** 테스트 전용. */
export function _resetEditActivityForTest(): void {
  entries = [];
  seq = 0;
  hydrated = false;
  unlabeledCount = 0;
  mirrorQueue = [];
  mirrorState = "disabled";
  mirrorWarned = false;
  listeners.clear();
  if (persistTimer !== null) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (mirrorTimer !== null) {
    clearTimeout(mirrorTimer);
    mirrorTimer = null;
  }
}

export function publishEditActivityApi(): void {
  if (typeof window === "undefined") return;
  const api = window as unknown as Record<string, unknown>;
  api.__oprnEditActivity = (query?: EditActivityQuery) => getEditActivityEntries(query);
  api.__oprnEditActivityText = (query?: EditActivityQuery) =>
    getEditActivityEntries(query).map(describeEditActivity).join("\n");
  api.__oprnExportEditActivity = (query?: EditActivityQuery) => serializeEditActivity(query);
  api.__oprnClearEditActivity = () => clearEditActivity();
  api.__oprnUnlabeledEditCount = () => unlabeledEditActivityCount();
  api.__oprnFlushEditActivityMirror = () => flushEditActivityMirror();
}

publishEditActivityApi();
