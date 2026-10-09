import { el } from "@/util/dom";
import { AI_LIVE_CANVAS_EVENT, isAiLiveCanvasEnabled, setAiLiveCanvasEnabled } from "@/editor/aiLiveCanvas";
import { deckIcon, type DeckIconName } from "./aiDeckIcons";
export const ACTIVITY_LEVELS = { none: "생략", brief: "간단히 보기", detail: "자세히 보기", trace: "매우 자세히 보기" } as const;
export type ActivityLevel = keyof typeof ACTIVITY_LEVELS;
const LEVEL_ICONS: Readonly<Record<ActivityLevel, DeckIconName>> = { none: "x", brief: "list", detail: "eye", trace: "expand" };
const KEY = "oprn:ai-activity-level";
let fallback: ActivityLevel = "brief";
let sessionOverride: ActivityLevel | undefined;
export function getActivityLevel(): ActivityLevel {
  if (sessionOverride) return sessionOverride;
  try { const value = localStorage.getItem(KEY); return value && Object.hasOwn(ACTIVITY_LEVELS, value) ? value as ActivityLevel : "brief"; }
  catch { return fallback; }
}
export function setActivityLevel(level: ActivityLevel): void {
  fallback = level;
  try { localStorage.setItem(KEY, level); sessionOverride = undefined; } catch { sessionOverride = level; }
  // Only attached surfaces; no global listener retains removed request cards.
  document.querySelectorAll<HTMLElement>("[data-ai-activity-surface]").forEach(node => node.dispatchEvent(new Event("ai-activity-level")));
}
export function bindActivityLevel(root: HTMLElement, update: (level: ActivityLevel) => void): void {
  root.dataset.aiActivitySurface = "true";
  root.addEventListener("ai-activity-level", () => update(getActivityLevel()));
  update(getActivityLevel());
}
/** 접힌 줄에 보이는 짧은 이름. */
const LEVEL_SHORT: Readonly<Record<ActivityLevel, string>> = { none: "숨김", brief: "간단히", detail: "자세히", trace: "전체 기록" };
const LEVEL_HINT: Readonly<Record<ActivityLevel, string>> = {
  none: "작업 과정을 숨기고 결과만 봅니다.",
  brief: "지금 하는 일과 마지막 그림만 봅니다.",
  detail: "모든 단계를 펼쳐 봅니다.",
  trace: "도구 입력·결과까지 전부 봅니다.",
};

/**
 * 표시 수준 + 실시간 맵. 한 줄짜리 «작업 표시 · 간단히 ▾» 로 접는다.
 * 2026-09-21 에 지면을 아끼려 글 없는 아이콘 넷(×·목록·눈·확대)과 지도 아이콘을 늘어놨는데, 무엇을
 * 하는 버튼인지 아무도 알 수 없었다(2026-09-23 리뷰). 지면은 접어서 아끼고, 펼친 안쪽은 글로 쓴다.
 */
export function createActivityLevelControl(): HTMLElement {
  const buttons = Object.entries(ACTIVITY_LEVELS).map(([value, label]) => {
    const level = value as ActivityLevel;
    return el("button", {
      class: "ai-activity-level-option",
      attrs: { type: "button", "aria-pressed": "false", title: LEVEL_HINT[level], "aria-label": level === "brief" ? `${label} (기본)` : label },
      children: [deckIcon(LEVEL_ICONS[level], { size: 15 }), el("span", { text: LEVEL_SHORT[level] })],
      dataset: { activityLevel: value },
      on: { click: () => { setActivityLevel(level); root.open = false; } },
    });
  });
  const group = el("div", { class: "ai-activity-level-buttons", attrs: { role: "group", "aria-label": "작업 표시 수준" }, dataset: { testid: "ai-activity-level" }, children: buttons });
  const current = el("span", { class: "ai-activity-setting-current" });
  const summary = el("summary", { class: "ai-activity-setting-summary", attrs: { title: "작업 과정을 얼마나 보여 줄지 고릅니다" }, children: [el("span", { text: "작업 표시" }), current, deckIcon("chevron-down", { size: 15 })] });
  const panel = el("div", { class: "ai-activity-setting-panel", children: [group, createLiveCanvasControl()] });
  const root = el("details", { class: "ai-activity-setting", children: [summary, panel] }) as HTMLDetailsElement;
  bindActivityLevel(root, level => {
    group.dataset.level = level;
    current.textContent = LEVEL_SHORT[level];
    for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.activityLevel === level));
  });
  root.addEventListener("keydown", event => { if (event.key === "Escape" && root.open) { root.open = false; summary.focus(); } });
  // 펼친 동안만 바깥 누름을 듣는다 — 닫힌 컨트롤이 문서 전역 리스너를 붙잡지 않게.
  const outside = (event: PointerEvent): void => { if (!root.contains(event.target as Node)) root.open = false; };
  root.addEventListener("toggle", () => {
    if (root.open) document.addEventListener("pointerdown", outside, true);
    else document.removeEventListener("pointerdown", outside, true);
  });
  return root;
}

function createLiveCanvasControl(): HTMLElement {
  const button = el("button", {
    class: "ai-live-canvas-toggle",
    attrs: { type: "button" },
    dataset: { testid: "ai-live-canvas", aiLiveCanvasSurface: "true" },
    children: [deckIcon("map", { size: 15 })],
    on: { click: () => setAiLiveCanvasEnabled(!isAiLiveCanvasEnabled()) },
  });
  const text = el("span");
  button.append(text);
  const sync = (): void => {
    const enabled = isAiLiveCanvasEnabled();
    button.setAttribute("aria-pressed", String(enabled));
    const label = enabled
      ? "실시간 맵 켜짐. 누르면 헤드리스로 맵 연출만 끕니다. 작업은 계속됩니다."
      : "헤드리스. 맵 연출이 꺼져 있습니다. 누르면 다시 실시간으로 보여 줍니다.";
    button.title = label;
    button.setAttribute("aria-label", label);
    text.textContent = enabled ? "맵에 시공 보이기 · 켜짐" : "맵에 시공 보이기 · 꺼짐";
  };
  button.addEventListener(AI_LIVE_CANVAS_EVENT, sync);
  sync();
  return button;
}
