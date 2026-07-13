// editor/panels/aiPanelLayout.ts
// AI 채팅 패널의 크기/도킹/글자 크기/접힘 상태 지속 헬퍼.

const PANEL_COLLAPSED_KEY = "rpg-zzu:ai-panel-collapsed";
const PANEL_SIZE_KEY = "rpg-zzu:ai-panel-size";

// 패널 크기 커스텀 — 좌상단 코너 드래그로 조절하고 localStorage에 유지한다.
export interface PanelSize {
  width: number;
  height: number;
}

export const PANEL_SIZE_LIMITS = { minWidth: 280, maxWidth: 960, minHeight: 320, maxHeight: 940 } as const;

export function clampPanelSize(size: PanelSize): PanelSize {
  return {
    width: Math.round(Math.min(PANEL_SIZE_LIMITS.maxWidth, Math.max(PANEL_SIZE_LIMITS.minWidth, size.width))),
    height: Math.round(Math.min(PANEL_SIZE_LIMITS.maxHeight, Math.max(PANEL_SIZE_LIMITS.minHeight, size.height))),
  };
}

export function loadPanelSize(): PanelSize | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PANEL_SIZE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PanelSize>;
    if (typeof parsed.width !== "number" || typeof parsed.height !== "number") return null;
    return clampPanelSize({ width: parsed.width, height: parsed.height });
  } catch {
    return null;
  }
}

export function savePanelSize(size: PanelSize): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PANEL_SIZE_KEY, JSON.stringify(clampPanelSize(size)));
}

// ── 도킹 사이드바 폭(§2.3 — G4) ──────────────────────────────────
// fixed 오버레이(is-docked / 기록 패널)용 폭. 좌측 리사이저로 조절해 localStorage에 유지한다.
const DOCK_WIDTH_KEY = "rpg-zzu:ai-dock-width";
export const DOCK_WIDTH_LIMITS = { min: 320, max: 900, default: 520 } as const;

export function clampDockWidth(width: number): number {
  if (!Number.isFinite(width)) return DOCK_WIDTH_LIMITS.default;
  return Math.round(Math.min(DOCK_WIDTH_LIMITS.max, Math.max(DOCK_WIDTH_LIMITS.min, width)));
}

export function loadDockWidth(): number {
  if (typeof localStorage === "undefined") return DOCK_WIDTH_LIMITS.default;
  const raw = Number(localStorage.getItem(DOCK_WIDTH_KEY));
  return raw > 0 ? clampDockWidth(raw) : DOCK_WIDTH_LIMITS.default;
}

export function saveDockWidth(width: number): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(DOCK_WIDTH_KEY, String(clampDockWidth(width)));
}

// ── 사이드 flex 도크 폭 (chatDock: "side") ───────────────────────
// 에디터 레이아웃 사용 가능 폭의 1/3. 캔버스 최소 폭을 위해 max를 상한으로 묶는다.
export const SIDE_CHAT_WIDTH = {
  ratio: 1 / 3,
  min: 320,
  max: 720,
  /** CSS 변수 미적용 시 폴백 (넓은 모니터 ~1/3 근처). */
  cssFallback: 480,
} as const;

/**
 * side dock 컬럼 폭(px). `usableWidth`는 레이아웃 content 폭(패딩 제외).
 * `reservedForCanvas`는 좌패널+리사이저+캔버스 최소 등 사이드 외 예산.
 */
export function computeSideChatWidth(usableWidth: number, reservedForCanvas = 0): number {
  if (!Number.isFinite(usableWidth) || usableWidth <= 0) return SIDE_CHAT_WIDTH.min;
  const third = Math.floor(usableWidth * SIDE_CHAT_WIDTH.ratio);
  const maxByCanvas =
    reservedForCanvas > 0
      ? Math.max(SIDE_CHAT_WIDTH.min, Math.floor(usableWidth - reservedForCanvas))
      : SIDE_CHAT_WIDTH.max;
  const upper = Math.min(SIDE_CHAT_WIDTH.max, maxByCanvas);
  return Math.round(Math.min(upper, Math.max(SIDE_CHAT_WIDTH.min, third)));
}

// ── 글자 크기 3단(V3C 채팅 관측성) ──────────────────────────────
// 채팅 로그·프로포절 카드·도구 로그가 패널의 data-ai-font-size + CSS 변수(--ai-font-scale)로 함께 스케일된다.
export const AI_FONT_SIZE_KEY = "rpg-zzu:ai-font-size";
export type AiFontSize = "small" | "normal" | "large";
export const AI_FONT_SIZE_SCALE: Record<AiFontSize, string> = { small: "0.85", normal: "1", large: "1.2" };

export function loadAiFontSize(): AiFontSize {
  if (typeof localStorage === "undefined") return "normal";
  const raw = localStorage.getItem(AI_FONT_SIZE_KEY);
  return raw === "small" || raw === "large" ? raw : "normal";
}

export function saveAiFontSize(size: AiFontSize): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(AI_FONT_SIZE_KEY, size);
}

export function applyAiFontSize(target: HTMLElement, size: AiFontSize): void {
  target.dataset.aiFontSize = size;
  target.style.setProperty("--ai-font-scale", AI_FONT_SIZE_SCALE[size]);
}

/**
 * 접힘 상태.
 * 첫 방문(저장값 없음)은 **펼침** — AI 어시스턴트가 제품의 주 진입점인데
 * 접힌 세로 띠만 보이면 초보는 존재 자체를 모른다.
 * 이후에는 사용자가 마지막으로 명시한 접힘/펼침을 복원한다.
 * 자동 펼침/재접기(맵 우선)는 세션 안에서만 동작하고 저장값을 건드리지 않는다.
 */
export const MAP_FIRST_MIGRATION_KEY = "rpg-zzu:ai-map-first-collapse-v1"; // 레거시 키(테스트/정리용)

export function loadPanelCollapsed(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    return localStorage.getItem(PANEL_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function savePanelCollapsed(collapsed: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PANEL_COLLAPSED_KEY, collapsed ? "1" : "0");
}

/** AI 작업으로 자동 펼친 뒤, 검토 대기 없이 턴이 끝나면 다시 접기까지 대기(ms). */
export const AUTO_COLLAPSE_AFTER_AI_MS = 1200;
