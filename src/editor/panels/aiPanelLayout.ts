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
// 기본 폭을 400→520px로 상향하고, 좌측 리사이저로 조절해 localStorage에 유지한다.
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

export function loadPanelCollapsed(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(PANEL_COLLAPSED_KEY) === "1";
}

export function savePanelCollapsed(collapsed: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PANEL_COLLAPSED_KEY, collapsed ? "1" : "0");
}
