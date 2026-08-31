// editor/panels/aiPanelLayout.ts
// AI 채팅 패널의 크기/도킹/글자 크기/접힘 상태 지속 헬퍼.

const PANEL_COLLAPSED_KEY = "oprn:ai-panel-collapsed";
const PANEL_SIZE_KEY = "oprn:ai-panel-size";

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

// ── 컴포저 캡슐 폭 ──────────────────────────────────────────────
// 예전에는 도크(glass/side/float)마다 `oprn:ai-panel-size:<dock>` 키를 따로 두고, 누락 시
// 글로벌 값으로 폴백했다. 도크가 하나(입력줄)라서 저장할 표면도 하나 — 캡슐 폭이다.
// 낡은 per-dock 키는 읽지 않는다. 대신 최초 1회는 옛 float 값을 그대로 물려받아
// 사용자가 맞춰 둔 폭을 잃지 않게 한다.
const LEGACY_FLOAT_SIZE_KEY = "oprn:ai-panel-size:float";

export function loadPanelBarSize(): PanelSize | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PANEL_SIZE_KEY) ?? localStorage.getItem(LEGACY_FLOAT_SIZE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PanelSize>;
    if (typeof parsed.width !== "number" || typeof parsed.height !== "number") return null;
    return clampPanelSize({ width: parsed.width, height: parsed.height });
  } catch {
    return null;
  }
}

export function savePanelBarSize(size: PanelSize): void {
  savePanelSize(size);
}

/**
 * 뷰포트에 반응형으로 크기를 제한한다. PANEL_SIZE_LIMITS로 1차 클램프한 뒤,
 * 뷰포트의 90%를 폭/높이 상한으로 추가로 적용한다 (최소 한계는 유지).
 * 비유효(비유한/0 이하) 뷰포트 수치는 "뷰포트 상한 없음"으로 취급해 그냥 clampPanelSize를 쓴다.
 */
export function clampPanelSizeToViewport(
  size: PanelSize,
  viewport: { readonly width: number; readonly height: number }
): PanelSize {
  const clamped = clampPanelSize(size);
  const capWidth =
    Number.isFinite(viewport.width) && viewport.width > 0
      ? Math.max(PANEL_SIZE_LIMITS.minWidth, Math.round(viewport.width * 0.9))
      : Infinity;
  const capHeight =
    Number.isFinite(viewport.height) && viewport.height > 0
      ? Math.max(PANEL_SIZE_LIMITS.minHeight, Math.round(viewport.height * 0.9))
      : Infinity;
  return {
    width: Math.min(clamped.width, capWidth),
    height: Math.min(clamped.height, capHeight),
  };
}

// ── 도킹 사이드바 폭(§2.3 — G4) ──────────────────────────────────
// fixed 오버레이(is-docked / 기록 패널)용 폭. 좌측 리사이저로 조절해 localStorage에 유지한다.
const DOCK_WIDTH_KEY = "oprn:ai-dock-width";
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
export const AI_FONT_SIZE_KEY = "oprn:ai-font-size";
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
 * 첫 방문(저장값 없음 / localStorage 없음 / 읽기 실패)은 **펼침**.
 * 사용자가 마지막으로 명시한 값만 복원한다 (`"1"` 접힘, 그 외 펼침).
 * 첫 부팅에서는 키를 쓰지 않는다. 자동 펼침/재접기는 저장값을 건드리지 않는다.
 */
export const MAP_FIRST_MIGRATION_KEY = "oprn:ai-map-first-collapse-v1"; // 레거시 키(테스트/정리용)

export function loadPanelCollapsed(): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    const raw = localStorage.getItem(PANEL_COLLAPSED_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}

export function savePanelCollapsed(collapsed: boolean): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(PANEL_COLLAPSED_KEY, collapsed ? "1" : "0");
}

/** AI 작업으로 자동 펼친 뒤 턴이 끝나면 다시 접기까지 대기(ms). */
export const AUTO_COLLAPSE_AFTER_AI_MS = 0;
