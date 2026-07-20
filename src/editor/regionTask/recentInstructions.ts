// 영역 작업 지시어 최근 기록 — localStorage 보관.
// 슬래시 자동완성 소스로 사용. 5개 cap, 중복 제거, 최신 우선.
// localStorage 접근 불가(프라이빗 모드 등)시 조용히 빈 배열 반환.

const STORAGE_KEY = "rpgzzu:region-recent-instructions";
const MAX_RECENT = 5;

export function loadRecentInstructions(): readonly string[] {
  try {
    const raw = globalThis.localStorage?.getItem?.(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function pushRecentInstruction(instruction: string): void {
  const trimmed = instruction.trim();
  if (!trimmed) return;
  try {
    const current = [...loadRecentInstructions()];
    // 중복 제거: 기존에 있으면 제거 후 맨 앞에 추가
    const filtered = current.filter((v) => v !== trimmed);
    filtered.unshift(trimmed);
    const next = filtered.slice(0, MAX_RECENT);
    globalThis.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* localStorage 접근 불가 — 조용히 무시 */
  }
}

export function clearRecentInstructions(): void {
  try {
    globalThis.localStorage?.removeItem?.(STORAGE_KEY);
  } catch {
    /* no-op */
  }
}

/** 테스트 전용. */
export function __setRecentInstructionsForTest(list: readonly string[]): void {
  try {
    globalThis.localStorage?.setItem?.(STORAGE_KEY, JSON.stringify([...list].slice(0, MAX_RECENT)));
  } catch {
    /* no-op */
  }
}
