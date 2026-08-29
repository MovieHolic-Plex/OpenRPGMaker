// util/logger.ts
// 레벨·네임스페이스·링버퍼를 가진 로거. 편집기/런타임 공용.
//
// 왜 이 파일이 있나 —
// 2026-08-29 관측성 감사 실측: src/ 의 로그 103건(warn 63 / error 36 / info 3 / log 1)이
// 전부 raw `console.*` 였다. 레벨도 네임스페이스도 버퍼도 없으니
//   1) 사고가 난 뒤에 "직전에 무슨 로그가 찍혔나" 를 물을 데가 없고 (콘솔을 안 열고 있었으면 끝),
//   2) 특정 서브시스템만 시끄럽게/조용하게 만들 수단이 없고,
//   3) e2e·에이전트가 로그를 근거로 쓸 수 없었다.
//
// 설계 결정 두 개:
//  - **링버퍼는 레벨과 무관하게 전량 담는다.** 콘솔 출력만 임계값으로 막는다. 사고 조사에서
//    필요한 건 "그때 debug 로그" 인데, 임계값으로 링버퍼까지 막으면 정작 필요한 순간에 비어 있다.
//    링버퍼 적재는 객체 하나 push 이므로 비용이 콘솔 포맷팅보다 싸다.
//  - **detail 은 그대로 들고 있는다(복사·직렬화하지 않는다).** 직렬화는 조회 시점에 한다.
//    mutation 마다 JSON.stringify 를 돌리면 그게 새 병목이 된다.
//
// 브라우저 없는 환경(vitest·headless)에서도 동작해야 한다 — window/localStorage 접근은 전부 가드.

import { STORAGE_PREFIX } from "@/util/appStorage";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEntry = {
  readonly seq: number;
  /** ISO 8601. 링버퍼가 오래된 걸 밀어내므로 절대 시각이 있어야 사고 시각과 맞출 수 있다. */
  readonly at: string;
  readonly level: LogLevel;
  /** 서브시스템 이름(`store`, `edit-activity`, `event-editor` …). 필터 축. */
  readonly ns: string;
  readonly message: string;
  readonly detail?: unknown;
};

export type Logger = {
  readonly ns: string;
  debug(message: string, detail?: unknown): void;
  info(message: string, detail?: unknown): void;
  warn(message: string, detail?: unknown): void;
  error(message: string, detail?: unknown): void;
};

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const LEVELS = Object.keys(LEVEL_ORDER) as readonly LogLevel[];

/** 링버퍼 상한. 사고 하나를 되짚기에 충분하고 localStorage 로 내보내도 부담 없는 크기. */
const MAX_ENTRIES = 1000;
const LOG_LEVEL_KEY = `${STORAGE_PREFIX}log-level`;
export const LOG_ENTRY_EVENT = "oprn:log-entry";

let entries: LogEntry[] = [];
let seq = 0;
let consoleLevel: LogLevel | null = null;
const listeners = new Set<(entry: LogEntry) => void>();

function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value);
}

/**
 * 콘솔 임계값 결정 순서: URL `?logLevel=` → localStorage → 빌드 모드 기본값.
 * URL 을 최우선으로 두는 이유는 QA/에이전트가 저장소를 건드리지 않고 한 세션만 시끄럽게
 * 만들 수 있어야 하기 때문이다.
 */
function resolveConsoleLevel(): LogLevel {
  try {
    if (typeof window !== "undefined" && window.location) {
      const fromUrl = new URLSearchParams(window.location.search).get("logLevel");
      if (isLogLevel(fromUrl)) return fromUrl;
    }
  } catch {
    /* location 스텁 환경 — 다음 소스로 */
  }
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(LOG_LEVEL_KEY);
      if (isLogLevel(stored)) return stored;
    }
  } catch {
    /* private mode / quota — 다음 소스로 */
  }
  return import.meta.env?.DEV ? "debug" : "info";
}

function currentConsoleLevel(): LogLevel {
  if (consoleLevel === null) consoleLevel = resolveConsoleLevel();
  return consoleLevel;
}

export function getLogLevel(): LogLevel {
  return currentConsoleLevel();
}

/** 콘솔 임계값을 바꾸고 저장한다. 링버퍼 적재량에는 영향이 없다. */
export function setLogLevel(level: LogLevel): void {
  consoleLevel = level;
  try {
    localStorage?.setItem(LOG_LEVEL_KEY, level);
  } catch {
    /* 저장 못 해도 이번 세션에는 적용된다 */
  }
}

function emitToConsole(entry: LogEntry): void {
  if (LEVEL_ORDER[entry.level] < LEVEL_ORDER[currentConsoleLevel()]) return;
  if (typeof console === "undefined") return;
  const tag = `[${entry.ns}]`;
  // console.debug 는 일부 브라우저에서 기본 숨김이라 info 로 보낸다 — 임계값은 위에서 이미 봤다.
  const sink = entry.level === "error" ? console.error : entry.level === "warn" ? console.warn : console.info;
  if (typeof sink !== "function") return;
  if (entry.detail === undefined) sink(`${tag} ${entry.message}`);
  else sink(`${tag} ${entry.message}`, entry.detail);
}

function notify(entry: LogEntry): void {
  for (const listener of listeners) {
    try {
      listener(entry);
    } catch {
      // 로그 구독자가 던져서 로그 경로를 죽이면 관측 수단 자체가 사라진다.
    }
  }
  if (typeof window === "undefined") return;
  if (typeof window.dispatchEvent !== "function" || typeof CustomEvent === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(LOG_ENTRY_EVENT, { detail: entry }));
  } catch {
    /* 스텁 window */
  }
}

function record(level: LogLevel, ns: string, message: string, detail?: unknown): void {
  const entry: LogEntry = {
    seq: seq++,
    at: new Date().toISOString(),
    level,
    ns,
    message,
    ...(detail === undefined ? {} : { detail }),
  };
  entries.push(entry);
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
  emitToConsole(entry);
  notify(entry);
}

export function createLogger(ns: string): Logger {
  return {
    ns,
    debug: (message, detail) => record("debug", ns, message, detail),
    info: (message, detail) => record("info", ns, message, detail),
    warn: (message, detail) => record("warn", ns, message, detail),
    error: (message, detail) => record("error", ns, message, detail),
  };
}

export type LogQuery = {
  readonly limit?: number;
  readonly ns?: string;
  readonly minLevel?: LogLevel;
};

/** 최신순. 사고 조사는 거의 항상 "방금 뭐가 찍혔나" 이므로 역순이 기본이다. */
export function getLogEntries(query: LogQuery = {}): readonly LogEntry[] {
  const min = query.minLevel ? LEVEL_ORDER[query.minLevel] : 0;
  const filtered = entries.filter(
    (entry) => LEVEL_ORDER[entry.level] >= min && (query.ns === undefined || entry.ns === query.ns),
  );
  const limit = query.limit === undefined ? MAX_ENTRIES : Math.max(1, Math.floor(query.limit));
  return filtered.slice(-limit).reverse();
}

export function clearLogEntries(): void {
  entries = [];
}

export function subscribeLogs(listener: (entry: LogEntry) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * 사람이 읽을 텍스트 덤프. detail 직렬화 실패는 자리표시자로 대체한다 —
 * 순환 참조 하나 때문에 덤프 전체를 잃는 건 관측 도구로서 최악이다.
 */
export function serializeLogEntries(query: LogQuery = {}): string {
  return getLogEntries(query)
    .map((entry) => {
      const head = `${entry.at} ${entry.level.toUpperCase().padEnd(5)} [${entry.ns}] ${entry.message}`;
      if (entry.detail === undefined) return head;
      let detail: string;
      try {
        detail = JSON.stringify(entry.detail);
      } catch {
        detail = String(entry.detail);
      }
      return `${head} ${detail}`;
    })
    .join("\n");
}

/** 테스트 전용 — 링버퍼와 임계값 캐시를 초기화한다. */
export function _resetLoggerForTest(): void {
  entries = [];
  seq = 0;
  consoleLevel = null;
  listeners.clear();
}

export function publishLoggerApi(): void {
  if (typeof window === "undefined") return;
  const api = window as unknown as Record<string, unknown>;
  api.__oprnLogs = (query?: LogQuery) => getLogEntries(query);
  api.__oprnLogText = (query?: LogQuery) => serializeLogEntries(query);
  api.__oprnClearLogs = () => clearLogEntries();
  api.__oprnSetLogLevel = (level: LogLevel) => setLogLevel(level);
}

publishLoggerApi();
