import { el } from "@/util/dom";
import { AI_LIVE_CANVAS_EVENT, isAiLiveCanvasEnabled, setAiLiveCanvasEnabled } from "@/editor/aiLiveCanvas";
import { deckIcon, type DeckIconName } from "./aiDeckIcons";
export const ACTIVITY_LEVELS = { none: "생략", brief: "간단히 보기", detail: "자세히 보기", trace: "매우 자세히 보기" } as const;
export type ActivityLevel = keyof typeof ACTIVITY_LEVELS;
// 표시 수준 버튼은 텍스트 대신 아이콘(2026-09-21) — 툴바가 본문 지면을 먹지 않게.
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
export function createActivityLevelControl(): HTMLElement {
  const buttons = Object.entries(ACTIVITY_LEVELS).map(([value, label]) => el("button", {
    attrs: { type: "button", "aria-pressed": "false", title: value === "brief" ? `${label} (기본)` : label, "aria-label": value === "brief" ? `${label} (기본)` : label },
    children: [deckIcon(LEVEL_ICONS[value as ActivityLevel], { size: 15 })],
    dataset: { activityLevel: value },
    on: { click: () => setActivityLevel(value as ActivityLevel) },
  }));
  const group = el("div", { class: "ai-activity-level-buttons", attrs: { role: "group", "aria-label": "작업 표시 수준" }, dataset: { testid: "ai-activity-level" }, children: buttons });
  const heading = el("div", { class: "ai-activity-setting-heading", children: [el("span", { text: "작업 표시" })] });
  const root = el("div", { class: "ai-activity-setting", children: [heading, group, createLiveCanvasControl()] });
  bindActivityLevel(root, level => {
    group.dataset.level = level;
    for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.activityLevel === level));
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
  const sync = (): void => {
    const enabled = isAiLiveCanvasEnabled();
    button.setAttribute("aria-pressed", String(enabled));
    const label = enabled
      ? "실시간 맵 켜짐. 누르면 헤드리스로 맵 연출만 끕니다. 작업은 계속됩니다."
      : "헤드리스. 맵 연출이 꺼져 있습니다. 누르면 다시 실시간으로 보여 줍니다.";
    button.title = label;
    button.setAttribute("aria-label", label);
  };
  button.addEventListener(AI_LIVE_CANVAS_EVENT, sync);
  sync();
  return button;
}
