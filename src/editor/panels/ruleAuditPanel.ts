import { MAP_EDIT_HISTORY_EVENT } from "@/editor/mapEditHistory";
import { projectLint, type LintIssue } from "@/project/lint/projectLint";
import { store } from "@/project/store";
import { el } from "@/util/dom";

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

export function renderRuleAuditPanel(): HTMLElement {
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

  refresh();
  if (typeof window !== "undefined") window.addEventListener(MAP_EDIT_HISTORY_EVENT, refresh);
  store.subscribe(refresh);
  return root;
}

export function ruleAuditViolationCount(): number {
  return groupedClusterIssues(clusterRuleIssues()).reduce((total, group) => total + group.count, 0);
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

function clusterRuleIssues(): readonly RuleAuditIssue[] {
  const issues: RuleAuditIssue[] = [];
  for (const issue of projectLint(store.getCurrent())) {
    if (issue.code.startsWith("cluster-rule")) issues.push(toRuleAuditIssue(issue));
  }
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
