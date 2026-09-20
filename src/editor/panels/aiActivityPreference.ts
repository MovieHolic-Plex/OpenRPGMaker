import { el } from "@/util/dom";
export const ACTIVITY_LEVELS = { none: "생략", brief: "간단히 보기", detail: "자세히 보기", trace: "매우 자세히 보기" } as const;
export type ActivityLevel = keyof typeof ACTIVITY_LEVELS;
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
  const select = el("select", { attrs: { "aria-label": "작업 표시 수준" }, dataset: { testid: "ai-activity-level" } }) as HTMLSelectElement;
  for (const [value, label] of Object.entries(ACTIVITY_LEVELS)) select.append(el("option", { attrs: { value }, text: label + (value === "brief" ? " (기본)" : "") }));
  select.addEventListener("change", () => setActivityLevel(select.value as ActivityLevel));
  const root = el("label", { class: "ai-activity-setting", children: [el("span", { text: "작업 표시" }), select] });
  bindActivityLevel(root, level => { select.value = level; });
  return root;
}
