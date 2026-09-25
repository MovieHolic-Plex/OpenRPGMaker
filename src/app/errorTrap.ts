// app/errorTrap.ts
// 전역 오류 트랩 — 아무도 잡지 않은 예외와 거부된 Promise 를 로거 링버퍼에 남긴다.
//
// 왜 이 파일이 있나 (2026-08-29 관측성 감사 실측) —
// `grep -rn "window.onerror|unhandledrejection" src/` → **0건**. `addEventListener("error")`
// 히트는 전부 `<img>/<video>/<audio>` 지역 핸들러였다. 즉 앱 어디서든 예외가 터지면
// 콘솔에 한 줄 뜨고 끝이었고, 콘솔을 열어두지 않았으면 그마저 사라졌다.
// 하필 가장 큰 표면이 무방비였다: `src/editor/EditScene.ts`(1,606줄)·
// `src/editor/editSceneRender.ts`(329줄) 의 try/catch 가 **0건**이라
// 편집 캔버스가 검게 죽어도 링버퍼·감사 로그·e2e 어디에도 남는 게 없었다.
//
// 설계 결정 넷:
//  1. **`preventDefault()` 를 부르지 않는다.** 브라우저 기본 리포팅(콘솔 빨간 스택,
//     Sentry 류, Playwright 의 pageerror)을 그대로 살려둔다. 이 트랩은 관측을
//     *추가*하는 것이고, 기존 신호를 삼키면 오히려 디버깅이 나빠진다.
//  2. **리소스 로드 실패는 레벨을 낮춘다.** 에셋 404(타일셋·아이콘·오디오)는 편집 세션에서
//     수십~수백 건이 흔하다. 이걸 error 로 적재하면 링버퍼(1000) 가 404 로 덮여서
//     정작 찾아야 할 예외가 밀려 나간다. 그래서 `warn` + 별도 kind 로 분리한다.
//  3. **capture 단계로 듣는다.** 리소스 오류 이벤트는 버블하지 않는다 —
//     `window.addEventListener("error", fn, true)` 여야 `<img>` 실패가 잡힌다.
//     window 자신이 타깃인 uncaught 예외는 AT_TARGET 이라 capture 여부와 무관하게 들어온다.
//  4. **같은 서명은 집계만 올린다.** 렌더 루프(EditScene 의 프레임 콜백)에서 던지면
//     초당 60건이 같은 스택으로 쏟아진다. 실측 함정: 링버퍼가 1000이라 한 번의 렌더
//     사고가 16초면 버퍼 전체를 지워버린다. message+stack 서명으로 창 안에서 접어
//     로그는 첫 1건만 남기고 count 만 누적한다.
//
// 브라우저 없는 환경(vitest node, 노드 스크립트)에서도 import 만으로 터지지 않아야 한다 —
// window 접근은 전부 가드한다.

import { createLogger } from "@/util/logger";

const log = createLogger("error-trap");

/**
 * 같은 서명을 접는 창(ms). 렌더 루프 폭주를 접기에 충분하고, 사용자가 같은 버튼을
 * 다시 눌러 재현한 건(보통 수 초 뒤)은 새 엔트리로 남을 만큼 짧다.
 */
const DEDUPE_WINDOW_MS = 3000;
/** 서명 테이블 상한. 서로 다른 오류가 계속 나와도 맵이 무한히 자라지 않게 한다. */
const MAX_SIGNATURES = 200;
/** 트랩이 들고 있는 오류 엔트리 상한. 로거 링버퍼와 별개로 "오류만" 빨리 보기 위한 목록. */
const MAX_TRAPPED = 100;
/** 스택 전문은 링버퍼를 잡아먹는다. 원인 프레임은 앞쪽에 있다. */
const MAX_STACK_CHARS = 2000;

/** 무엇이 터졌나. 리소스 404 와 코드 예외를 섞으면 필터가 불가능해진다. */
export type TrappedErrorKind = "exception" | "rejection" | "resource";

export type TrappedError = {
  readonly seq: number;
  readonly at: string;
  readonly kind: TrappedErrorKind;
  readonly message: string;
  readonly stack?: string;
  /** 스크립트 오류의 발생 위치. `event.error` 가 없을 때(cross-origin 등) 유일한 단서다. */
  readonly source?: string;
  readonly line?: number;
  readonly column?: number;
  /** 리소스 오류일 때 실패한 요소 — `IMG src=/tiles/a.png` 형태. */
  readonly resource?: string;
  /** 같은 서명이 창 안에서 몇 번 났나. 1 이면 생략. */
  readonly count?: number;
};

let trapped: TrappedError[] = [];
let seq = 0;
let installed = false;
let errorListener: ((event: Event) => void) | null = null;
let rejectionListener: ((event: Event) => void) | null = null;

/** 서명 → 마지막 발생 시각 + 그 서명으로 적재된 엔트리 인덱스. */
type SignatureState = { lastMs: number; index: number };
const signatures = new Map<string, SignatureState>();

function clipStack(stack: unknown): string | undefined {
  if (typeof stack !== "string" || stack === "") return undefined;
  return stack.length <= MAX_STACK_CHARS ? stack : `${stack.slice(0, MAX_STACK_CHARS)}…`;
}

/**
 * 던져진 값을 사람이 읽는 한 줄로. `throw "문자열"` 이나 `Promise.reject({code:…})` 처럼
 * Error 가 아닌 값도 실제로 나온다 — 그때 "[object Object]" 만 남으면 쓸모가 없다.
 */
function describeThrown(value: unknown): string {
  if (value instanceof Error) {
    return value.name === "Error" ? value.message : `${value.name}: ${value.message}`;
  }
  if (value === null) return "null 이 던져졌다";
  if (value === undefined) return "undefined 가 던져졌다";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    // DOMException·fetch Response 등은 message/statusText 를 들고 있다.
    const row = value as Record<string, unknown>;
    if (typeof row.message === "string" && row.message !== "") return row.message;
    try {
      const raw = JSON.stringify(value);
      if (typeof raw === "string" && raw !== "{}") return raw.slice(0, 400);
    } catch {
      /* 순환 참조 — String() 으로 떨어진다 */
    }
  }
  return String(value);
}

/** 실패한 리소스 식별자. src/href 가 없으면 태그만이라도 남긴다. */
function describeResource(target: Element): string {
  const row = target as unknown as Record<string, unknown>;
  const url = typeof row.src === "string" && row.src !== "" ? row.src : typeof row.href === "string" ? row.href : "";
  return url === "" ? target.tagName : `${target.tagName} ${url}`;
}

/**
 * 중복 접기 키. 위치(source:line:col)까지 넣어야 같은 message 의 서로 다른 호출부가
 * 하나로 뭉치지 않는다. 스택이 있으면 첫 두 프레임만 쓴다 — 전문을 키로 쓰면
 * 프레임마다 주소가 미세하게 달라지는 경우 접히지 않는다.
 */
function signatureOf(entry: TrappedError): string {
  const head = entry.stack === undefined ? "" : entry.stack.split("\n").slice(0, 3).join("|");
  return [entry.kind, entry.message, head, entry.source ?? "", entry.line ?? "", entry.resource ?? ""].join("§");
}

function levelFor(kind: TrappedErrorKind): "warn" | "error" {
  // 설계 결정 2 — 리소스 404 는 error 가 아니다. 링버퍼 자리를 예외에 양보한다.
  return kind === "resource" ? "warn" : "error";
}

function describeEntry(entry: TrappedError): string {
  const parts: string[] = [];
  if (entry.kind === "rejection") parts.push("처리되지 않은 Promise 거부");
  else if (entry.kind === "resource") parts.push("리소스 로드 실패");
  else parts.push("잡히지 않은 예외");
  parts.push(entry.message);
  if (entry.resource !== undefined) parts.push(entry.resource);
  else if (entry.source !== undefined) {
    parts.push(entry.line === undefined ? entry.source : `${entry.source}:${entry.line}:${entry.column ?? 0}`);
  }
  return parts.join(" — ");
}

/** 서명 테이블이 무한히 자라지 않게 창 밖의 항목을 버린다. */
function pruneSignatures(nowMs: number): void {
  if (signatures.size <= MAX_SIGNATURES) return;
  for (const [key, state] of signatures) {
    if (nowMs - state.lastMs > DEDUPE_WINDOW_MS) signatures.delete(key);
  }
  // 전부 창 안이면(폭주 중) 가장 오래된 것부터 버린다. Map 은 삽입 순서를 지킨다.
  while (signatures.size > MAX_SIGNATURES) {
    const oldest = signatures.keys().next();
    if (oldest.done === true) break;
    signatures.delete(oldest.value);
  }
}

function record(partial: Omit<TrappedError, "seq" | "at">): void {
  const nowMs = Date.now();
  const entry: TrappedError = { seq: seq++, at: new Date(nowMs).toISOString(), ...partial };
  const key = signatureOf(entry);
  const known = signatures.get(key);

  if (known !== undefined && nowMs - known.lastMs <= DEDUPE_WINDOW_MS) {
    // 폭주 구간: 로그는 더 남기지 않고 기존 엔트리의 count 만 올린다.
    const existing = trapped[known.index];
    if (existing !== undefined) {
      trapped[known.index] = { ...existing, count: (existing.count ?? 1) + 1 };
      signatures.set(key, { lastMs: nowMs, index: known.index });
      return;
    }
    // 링버퍼에서 밀려났다 — 새 엔트리로 다시 남긴다.
  }

  trapped.push(entry);
  if (trapped.length > MAX_TRAPPED) {
    const dropped = trapped.length - MAX_TRAPPED;
    // 첫 오류는 원인인 경우가 많다. 앞에서 통째로 밀지 않고, 첫 건을 남긴 채 그 다음을 버린다.
    const tailStart = dropped + 1;
    const first = trapped[0];
    if (first) trapped = [first, ...trapped.slice(tailStart)];
    for (const [sigKey, state] of signatures) {
      if (state.index === 0) continue;
      const shifted = state.index - dropped;
      if (shifted < 1) signatures.delete(sigKey);
      else signatures.set(sigKey, { ...state, index: shifted });
    }
  }
  signatures.set(key, { lastMs: nowMs, index: trapped.length - 1 });
  pruneSignatures(nowMs);

  const detail = {
    kind: entry.kind,
    ...(entry.stack === undefined ? {} : { stack: entry.stack }),
    ...(entry.source === undefined ? {} : { source: entry.source }),
    ...(entry.line === undefined ? {} : { line: entry.line }),
    ...(entry.column === undefined ? {} : { column: entry.column }),
    ...(entry.resource === undefined ? {} : { resource: entry.resource }),
  };
  if (levelFor(entry.kind) === "warn") log.warn(describeEntry(entry), detail);
  else log.error(describeEntry(entry), detail);
}

function handleErrorEvent(event: Event): void {
  // 리소스 로드 실패: 타깃이 window 가 아닌 Element 다. capture 단계로 내려오는 길에 잡힌다.
  const target = event.target;
  if (target instanceof Element) {
    record({ kind: "resource", message: "에셋을 불러오지 못했다", resource: describeResource(target) });
    return;
  }

  const row = event as unknown as Record<string, unknown>;
  // 위치 정보는 두 경로 공통이다. `event.error` 가 없을 때는 이게 유일한 단서가 된다
  // (cross-origin 스크립트는 브라우저가 error 를 비우고 "Script error." 만 준다).
  const where = {
    ...(typeof row.filename === "string" && row.filename !== "" ? { source: row.filename } : {}),
    ...(typeof row.lineno === "number" && row.lineno > 0 ? { line: row.lineno } : {}),
    ...(typeof row.colno === "number" && row.colno > 0 ? { column: row.colno } : {}),
  };

  const thrown = row.error;
  if (thrown !== undefined && thrown !== null) {
    const stack = clipStack((thrown as { stack?: unknown }).stack);
    record({
      kind: "exception",
      message: describeThrown(thrown),
      ...(stack === undefined ? {} : { stack }),
      ...where,
    });
    return;
  }

  record({
    kind: "exception",
    message: typeof row.message === "string" && row.message !== "" ? row.message : "알 수 없는 오류",
    ...where,
  });
}

function handleRejectionEvent(event: Event): void {
  const reason = (event as unknown as Record<string, unknown>).reason;
  const stack = clipStack((reason as { stack?: unknown } | undefined)?.stack);
  record({
    kind: "rejection",
    message: describeThrown(reason),
    ...(stack === undefined ? {} : { stack }),
  });
}

/**
 * 전역 트랩 설치. 재호출은 무시한다(HMR·중복 import 로 핸들러가 두 번 붙으면
 * 모든 오류가 두 줄로 적재돼 집계가 거짓말을 한다).
 */
export function installGlobalErrorTrap(): void {
  if (installed) return;
  if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
  installed = true;
  errorListener = handleErrorEvent;
  rejectionListener = handleRejectionEvent;
  // capture:true — 설계 결정 3. 리소스 오류는 버블하지 않는다.
  window.addEventListener("error", errorListener, true);
  window.addEventListener("unhandledrejection", rejectionListener);
  publishErrorTrapApi();
  log.debug("전역 오류 트랩 설치 완료");
}

/** 테스트 전용 — 핸들러를 떼고 상태를 비운다. */
export function _uninstallGlobalErrorTrap(): void {
  if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
    if (errorListener !== null) window.removeEventListener("error", errorListener, true);
    if (rejectionListener !== null) window.removeEventListener("unhandledrejection", rejectionListener);
  }
  errorListener = null;
  rejectionListener = null;
  installed = false;
  trapped = [];
  seq = 0;
  signatures.clear();
}

export function isGlobalErrorTrapInstalled(): boolean {
  return installed;
}

export type TrappedErrorQuery = {
  readonly limit?: number;
  readonly kind?: TrappedErrorKind;
  /** 리소스 404 를 뺀 진짜 예외만 — 사고 조사의 기본 시야. */
  readonly excludeResource?: boolean;
};

/** 최신순. 사고 조사는 거의 항상 "방금 뭐가 터졌나" 다. */
export function getTrappedErrors(query: TrappedErrorQuery = {}): readonly TrappedError[] {
  const filtered = trapped.filter((entry) => {
    if (query.kind !== undefined && entry.kind !== query.kind) return false;
    if (query.excludeResource === true && entry.kind === "resource") return false;
    return true;
  });
  const limit = query.limit === undefined ? MAX_TRAPPED : Math.max(1, Math.floor(query.limit));
  return filtered.slice(-limit).reverse();
}

/** 접힌 발생 횟수까지 합친 총계. 엔트리 수만 보면 폭주를 놓친다. */
export function trappedErrorCount(query: TrappedErrorQuery = {}): number {
  return getTrappedErrors(query).reduce((sum, entry) => sum + (entry.count ?? 1), 0);
}

export function serializeTrappedErrors(query: TrappedErrorQuery = {}): string {
  return getTrappedErrors(query)
    .map((entry) => {
      const head = `${entry.at} ${describeEntry(entry)}`;
      const tail = entry.count !== undefined && entry.count > 1 ? ` (×${entry.count})` : "";
      return entry.stack === undefined ? `${head}${tail}` : `${head}${tail}\n${entry.stack}`;
    })
    .join("\n");
}

export function publishErrorTrapApi(): void {
  if (typeof window === "undefined") return;
  const api = window as unknown as Record<string, unknown>;
  api.__oprnErrors = (query?: TrappedErrorQuery) => getTrappedErrors(query);
  api.__oprnErrorText = (query?: TrappedErrorQuery) => serializeTrappedErrors(query);
  api.__oprnErrorCount = (query?: TrappedErrorQuery) => trappedErrorCount(query);
}

// ── import 시점 자동 설치 ──────────────────────────────────────────
// ES 모듈의 `import` 는 호이스팅되므로 진입점 **본문**에서 installGlobalErrorTrap() 을
// 불러도 `@/app/mode` → 편집기 모듈 트리의 top-level 평가가 이미 끝난 뒤다.
// 그 평가 중에 던지는 예외(모듈 초기화 실패)가 정확히 우리가 놓치고 있던 종류이므로,
// 진입점이 이 모듈을 **첫 import** 로 두면 바로 설치되도록 여기서 부수효과로 건다.
// `src/storageBoot.ts` 가 같은 이유로 부수효과 전용 모듈이 된 것과 동일한 판단이다.
// idempotent 하므로 진입점의 명시적 호출과 겹쳐도 핸들러는 하나다.
installGlobalErrorTrap();
