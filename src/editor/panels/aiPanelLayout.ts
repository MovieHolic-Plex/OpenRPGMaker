// editor/panels/aiPanelLayout.ts
// 조수 띠의 유일한 영속 레이아웃 값: **글자 크기 3단**.
//
// 2026-08-29 조수 띠로 넘어오면서 이 파일의 나머지 전부가 사라졌다. 무엇이 있었고 왜
// 없어졌는지 적어 둔다 — 같은 값을 다시 만들려는 다음 사람을 위해서다:
//
//   PanelSize · clampPanelSize · load/savePanelSize          패널 리사이즈 핸들이 없어졌다.
//   PanelDock · load/save/clearDockPanelSize · clampToViewport  도크 3종이 없어졌다.
//   DOCK_WIDTH_LIMITS · load/saveDockWidth                   기록 폭은 CSS 가 정한다
//                                                            (`--ai-history-width: 520px`).
//   SIDE_CHAT_WIDTH · computeSideChatWidth                   사이드 도크가 캔버스를 밀어내던
//                                                            계산. 띠는 reflow 가 없다.
//   load/savePanelCollapsed · AUTO_COLLAPSE_AFTER_AI_MS      유휴가 56px 이면 접을 이유가
//   MAP_FIRST_MIGRATION_KEY                                  없다(스펙 §3 작성자 판단).
//
// 띠 기하는 전부 CSS 가 소유한다(`src/styles/database/assistant/shell.css`). 저장할 값이
// 하나뿐이면 이 파일도 하나만 든다.

// ── 글자 크기 3단(V3C 채팅 관측성) ──────────────────────────────
// 로그·제안 카드·도구 로그가 패널의 data-ai-font-size + CSS 변수(--ai-font-scale)로 함께 스케일된다.
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
