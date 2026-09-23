import { MAP_EDIT_HISTORY_EVENT } from "@/editor/mapEditHistory";
import { runWhenPointerReleased } from "@/editor/pointerStrokeGate";
import { clusterRuleLintIssues } from "@/project/lint/clusterRuleLint";
import type { LintIssue } from "@/project/lint/projectLint";
import { store } from "@/project/store";
import { el } from "@/util/dom";

/** Emitted when the deferred toolbar badge calculation finishes. */
export const RULE_AUDIT_UPDATED_EVENT = "oprn:rule-audit-updated";

type RuleAuditStrength = "hard" | "medium" | "soft";

interface RuleAuditIssue {
  readonly code: string;
  readonly mapId?: string;
  readonly message: string;
  readonly severity: string;
  readonly x?: number;
  readonly y?: number;
}

interface RuleAuditGroup {
  readonly count: number;
  readonly issue: RuleAuditIssue;
  readonly locations: readonly string[];
  readonly strength: RuleAuditStrength;
}

let autoMountInstalled = false;
let mountQueued = false;
let observedPaletteRoot: HTMLElement | null = null;
let paletteRootObserver: MutationObserver | null = null;
// 패널이 재마운트될 때마다(팔레트 재구축 → MutationObserver 재마운트) 이전 구독을 반드시 해제한다.
// 과거엔 마운트마다 store.subscribe가 누적되어, 편집 1회당 전체 projectLint가 N번 돌며
// 세션이 길수록 렉이 심해지는 누수가 있었다(대량 편집 렉 보고의 원인 중 하나).
let disposeActivePanel: (() => void) | null = null;

export function renderRuleAuditPanel(): HTMLElement {
  disposeActivePanel?.();
  const root = el("details", {
    class: "rule-audit-panel panel-section",
    attrs: { open: "", "aria-label": "규칙 감사" },
    dataset: { testid: "rule-audit-panel" },
  });

  const refresh = (): void => {
    const groups = groupedClusterIssues(clusterRuleIssues());
    root.replaceChildren(
      el("summary", { text: "🔎 규칙 감사" }),
      groups.length === 0
        ? el("div", { class: "rule-audit-empty", text: "규칙 위반 없음" })
        : el("ol", { class: "rule-audit-list", children: groups.map(renderRuleAuditItem) })
    );
  };

  // 전체 projectLint는 비싸다 — 연속 편집(페인트 드래그)을 trailing 디바운스로 합치고,
  // 패널이 접혀 있으면 펼칠 때까지 미룬다.
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  let staleWhileClosed = false;
  const scheduleRefresh = (): void => {
    if (root.getAttribute("open") === null) {
      staleWhileClosed = true;
      return;
    }
    if (refreshTimer) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      // 칠하는 도중에는 감사하지 않는다 — 뗄 때 한 번(pointerStrokeGate).
      runWhenPointerReleased(refresh);
    }, 250);
  };
  root.addEventListener("toggle", () => {
    if (root.getAttribute("open") !== null && staleWhileClosed) {
      staleWhileClosed = false;
      refresh();
    }
  });

  refresh();
  if (typeof window !== "undefined") window.addEventListener(MAP_EDIT_HISTORY_EVENT, scheduleRefresh);
  const unsubscribeStore = store.subscribe(scheduleRefresh);
  disposeActivePanel = () => {
    disposeActivePanel = null;
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = null;
    if (typeof window !== "undefined") window.removeEventListener(MAP_EDIT_HISTORY_EVENT, scheduleRefresh);
    unsubscribeStore();
  };
  return root;
}

export function ruleAuditViolationCount(): number {
  return groupedClusterIssues(clusterRuleIssues()).reduce((total, group) => total + group.count, 0);
}

let deferredAuditQueued = false;

/**
 * Toolbar construction happens before the first editor frame. A synchronous projectLint there
 * serializes and walks the whole hosted project just to paint a badge. Return a known cache value
 * when available and calculate a cold badge after the browser gets a paint opportunity instead.
 * Opening the audit panel still uses the synchronous contract above, so diagnostics are never lost.
 */
export function ruleAuditViolationCountCached(): number {
  const project = store.getCurrent();
  const { lineage, generation } = store.getVersionToken();
  if (cachedRuleIssues?.project === project
    && cachedRuleIssues.lineage === lineage && cachedRuleIssues.generation === generation) {
    return groupedClusterIssues(cachedRuleIssues.issues).reduce((total, group) => total + group.count, 0);
  }
  if (!deferredAuditQueued && typeof window !== "undefined") {
    deferredAuditQueued = true;
    window.setTimeout(() => {
      runWhenPointerReleased(() => {
        deferredAuditQueued = false;
        clusterRuleIssues();
        window.dispatchEvent(new Event(RULE_AUDIT_UPDATED_EVENT));
      });
    }, 250);
  }
  return 0;
}

export function installRuleAuditPanelAutoMount(): void {
  if (autoMountInstalled) return;
  autoMountInstalled = true;
  const schedule = (): void => scheduleRuleAuditPanelMount();
  if (typeof window !== "undefined") window.addEventListener(MAP_EDIT_HISTORY_EVENT, schedule);
  store.subscribe(schedule);
  schedule();
}

function scheduleRuleAuditPanelMount(): void {
  if (mountQueued) return;
  mountQueued = true;
  const run = (): void => {
    mountQueued = false;
    mountRuleAuditPanel();
  };
  if (typeof queueMicrotask === "function") queueMicrotask(run);
  else setTimeout(run, 0);
}

function mountRuleAuditPanel(): void {
  if (typeof document === "undefined") return;
  const root = document.querySelector<HTMLElement>('[data-testid="left-palette-root"]');
  if (!root) return;
  installPaletteRootObserver(root);
  if (root.querySelector('[data-testid="rule-audit-panel"]')) return;
  root.append(renderRuleAuditPanel());
}

function installPaletteRootObserver(root: HTMLElement): void {
  if (observedPaletteRoot === root || typeof MutationObserver === "undefined") return;
  paletteRootObserver?.disconnect();
  observedPaletteRoot = root;
  paletteRootObserver = new MutationObserver(() => {
    if (!root.querySelector('[data-testid="rule-audit-panel"]')) mountRuleAuditPanel();
  });
  paletteRootObserver.observe(root, { childList: true });
}

let cachedRuleIssues: {
  readonly project: ReturnType<typeof store.getCurrent>;
  readonly lineage: number;
  readonly generation: number;
  readonly issues: readonly RuleAuditIssue[];
} | null = null;

function clusterRuleIssues(): readonly RuleAuditIssue[] {
  const project = store.getCurrent();
  const { lineage, generation } = store.getVersionToken();
  // Map selection, zoom and toolbar remounts do not change project validation.
  // Include the store revision so edits/undo/reloads cannot retain stale badges.
  if (cachedRuleIssues?.project === project
    && cachedRuleIssues.lineage === lineage && cachedRuleIssues.generation === generation) {
    return cachedRuleIssues.issues;
  }
  // projectLint 전체가 아니라 cluster-rule 만 — 전체는 직렬화 왕복까지 돌아 칠하기 드래그 중
  // 한 번에 ~800ms 로 메인 스레드를 세웠다(기본 100×100 마을, 2026-09-23).
  const issues: RuleAuditIssue[] = [];
  for (const issue of clusterRuleLintIssues(project)) {
    if (issue.code.startsWith("cluster-rule")) issues.push(toRuleAuditIssue(issue));
  }
  cachedRuleIssues = { project, lineage, generation, issues };
  return issues;
}

function toRuleAuditIssue(issue: LintIssue): RuleAuditIssue {
  return issue;
}

function groupedClusterIssues(issues: readonly RuleAuditIssue[]): readonly RuleAuditGroup[] {
  const groups = new Map<string, RuleAuditGroup>();
  for (const issue of issues) {
    const strength = strengthFromSeverity(issue.severity);
    const key = `${strength}\n${issue.code}\n${issue.message}`;
    const previous = groups.get(key);
    const location = locationText(issue);
    if (previous) {
      groups.set(key, {
        count: previous.count + 1,
        issue: previous.issue,
        locations: location ? [...previous.locations, location] : previous.locations,
        strength: previous.strength,
      });
      continue;
    }
    groups.set(key, {
      count: 1,
      issue,
      locations: location ? [location] : [],
      strength,
    });
  }
  return [...groups.values()].sort((a, b) => strengthRank(a.strength) - strengthRank(b.strength));
}

function renderRuleAuditItem(group: RuleAuditGroup): HTMLElement {
  const meta = strengthMeta(group.strength);
  const location = group.locations.length > 0 ? `위치: ${group.locations.slice(0, 3).join(", ")}` : "";
  return el("li", {
    class: `rule-audit-item is-${group.strength}`,
    dataset: { testid: "rule-audit-item" },
    children: [
      el("span", { class: `rule-audit-badge is-${group.strength}`, text: meta.badge }),
      el("div", {
        class: "rule-audit-content",
        children: [
          el("div", { class: "rule-audit-message", text: group.issue.message }),
          el("div", {
            class: "rule-audit-meta",
            text: [meta.label, `위반 ${group.count}건`, location].filter((part) => part.length > 0).join(" · "),
          }),
        ],
      }),
    ],
  });
}

function strengthFromSeverity(severity: string): RuleAuditStrength {
  switch (severity) {
    case "error":
      return "hard";
    case "warning":
      return "medium";
    case "info":
      return "soft";
    default:
      return "soft";
  }
}

function strengthRank(strength: RuleAuditStrength): number {
  switch (strength) {
    case "hard":
      return 0;
    case "medium":
      return 1;
    case "soft":
      return 2;
  }
}

function strengthMeta(strength: RuleAuditStrength): { readonly badge: string; readonly label: string } {
  switch (strength) {
    case "hard":
      return { badge: "반드시", label: "강함" };
    case "medium":
      return { badge: "권장", label: "중간" };
    case "soft":
      return { badge: "참고", label: "느슨함" };
  }
}

function locationText(issue: RuleAuditIssue): string {
  if (issue.x === undefined || issue.y === undefined) return "";
  return issue.mapId ? `${issue.mapId} (${issue.x}, ${issue.y})` : `(${issue.x}, ${issue.y})`;
}
