// Script card pieces (event editor): chips, flow tree, example results, line diff, read-only command list.
// Pure DOM builders over data from editor/script/scriptInsight.ts and editor/script/dryRun.ts — the form
// (commandBodyScript.ts) owns state. Inline styles on cream tokens: the editor's late sheets win any shared
// class rule, and these surfaces have no stylesheet of their own (same choice as the script form, 2026-10-31).
import type { DryRunResult } from "@/editor/script/dryRun";
import { scriptRefName, type ScriptChip, type ScriptFlowNode } from "@/editor/script/scriptInsight";
import type { Command, Project } from "@/project/types";
import { el } from "@/util/dom";
import { commandSummary } from "./commandSummary";
import { eventCommandBranches } from "@/editor/eventCommandBranches";

type Style = Partial<Record<string, string>>;

export function styled<T extends HTMLElement>(node: T, style: Style): T {
  for (const [key, value] of Object.entries(style)) if (value !== undefined) node.style.setProperty(key, value);
  return node;
}

export const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const TONE_COLOR: Readonly<Record<string, string>> = {
  read: "var(--success, #18764F)",
  write: "var(--warning, #B5531F)",
  call: "var(--accent, #4A57D6)",
  dynamic: "var(--text-2, #6b6457)",
};
const ACCESS_LABEL: Readonly<Record<ScriptChip["access"], string>> = { read: "읽음", write: "씀", call: "부름", dynamic: "계산" };

export function chipRow(chips: readonly ScriptChip[], access: ScriptChip["access"]): HTMLElement | undefined {
  const own = chips.filter((chip) => chip.access === access);
  if (!own.length) return undefined;
  const row = styled(el("div", { class: "script-card-chips", dataset: { access } }), { display: "flex", "flex-wrap": "wrap", gap: "6px" });
  for (const chip of own) {
    const color = TONE_COLOR[access] ?? "var(--text-2)";
    const node = styled(el("span", {
      class: "script-card-chip",
      dataset: { testid: "script-card-chip", access },
      attrs: { title: chip.id },
      children: [
        styled(el("span", { text: ACCESS_LABEL[access] }), { "font-weight": "700", color, "margin-right": "4px", "font-size": "11px" }),
        el("span", { text: chip.label }),
      ],
    }), {
      display: "inline-flex",
      "align-items": "center",
      padding: "2px 8px",
      "border-radius": "999px",
      border: access === "dynamic" ? `1px dashed ${color}` : "1px solid var(--border-default, #d9d0bd)",
      background: "var(--bg-raised, #fffdf7)",
      "font-size": "12px",
      color: "var(--text-1, #2b2620)",
    });
    row.append(node);
  }
  return row;
}

export function sectionLabel(text: string): HTMLElement {
  return styled(el("div", { class: "script-card-section-label", text }), {
    "font-size": "12px",
    "font-weight": "700",
    color: "var(--text-2, #6b6457)",
    margin: "10px 0 4px",
  });
}

// ── flow ─────────────────────────────────────────────────────────────────────

const STEP_ICON: Readonly<Record<string, string>> = { say: "💬", set: "•", fx: "✨", move: "➜", call: "↪", calc: "∑", end: "■", ask: "?" };

function stepBox(nodes: readonly ScriptFlowNode[], onLine: (line: number) => void): HTMLElement {
  const box = styled(el("div", { class: "script-flow-steps" }), {
    border: "1px solid var(--border-default, #d9d0bd)",
    "border-radius": "6px",
    background: "var(--bg-raised, #fffdf7)",
    padding: "6px 8px",
    "font-size": "12px",
    "line-height": "1.5",
    "max-width": "320px",
    "min-width": "120px",
  });
  for (const node of nodes) {
    if (node.k !== "step") continue;
    const line = styled(el("div", {
      class: "script-flow-step",
      dataset: { tone: node.tone, line: String(node.line), ...(node.code ? { code: "1" } : {}) },
      attrs: { title: `코드 ${node.line}번째 줄로`, role: "button", tabindex: "0" },
      children: [
        styled(el("span", { text: STEP_ICON[node.tone] ?? "•" }), { "margin-right": "4px", color: "var(--text-2)" }),
        el("span", { text: node.text, ...(node.code ? { attrs: { translate: "no" } } : {}) }),
      ],
    }), {
      cursor: "pointer",
      ...(node.code ? { "font-family": MONO, color: "var(--text-2, #6b6457)", "font-size": "11px" } : {}),
      ...(node.tone === "end" ? { color: "var(--danger, #b42318)" } : {}),
    });
    line.addEventListener("click", () => onLine(node.line));
    line.addEventListener("keydown", (event) => { if (event.key === "Enter") onLine(node.line); });
    box.append(line);
  }
  return box;
}

function connector(label?: string, tone?: "yes" | "no"): HTMLElement {
  const wrap = styled(el("div", { class: "script-flow-connector" }), { display: "flex", "flex-direction": "column", "align-items": "center", gap: "2px", margin: "2px 0" });
  if (label) {
    wrap.append(styled(el("span", { text: label }), {
      "font-size": "11px",
      "font-weight": "700",
      padding: "0 6px",
      "border-radius": "999px",
      color: tone === "no" ? "var(--danger, #b42318)" : tone === "yes" ? "var(--success, #18764F)" : "var(--text-2)",
      background: "var(--bg-inset, #f4efe4)",
    }));
  }
  wrap.append(styled(el("span", { text: "↓" }), { "font-size": "10px", color: "var(--text-2)" }));
  return wrap;
}

function flowColumn(nodes: readonly ScriptFlowNode[], onLine: (line: number) => void, depth: number): HTMLElement {
  const column = styled(el("div", { class: "script-flow-column" }), { display: "flex", "flex-direction": "column", "align-items": "center", gap: "4px", width: "max-content", "min-width": "100%" });
  if (!nodes.length) {
    column.append(styled(el("div", { text: "(아무것도 안 함)" }), { "font-size": "11px", color: "var(--text-2)" }));
    return column;
  }
  let run: ScriptFlowNode[] = [];
  const flush = (): void => {
    if (!run.length) return;
    column.append(stepBox(run, onLine));
    run = [];
  };
  for (const node of nodes) {
    if (node.k === "step") {
      run.push(node);
      continue;
    }
    flush();
    if (node.k === "loop") {
      const loop = styled(el("div", { class: "script-flow-loop", dataset: { line: String(node.line) } }), {
        border: "1px dashed var(--accent, #4A57D6)",
        "border-radius": "8px",
        padding: "6px",
        display: "flex",
        "flex-direction": "column",
        "align-items": "center",
        gap: "4px",
      });
      const head = styled(el("div", { text: `↻ ${node.head}`, attrs: { role: "button", tabindex: "0", title: `코드 ${node.line}번째 줄로` } }), { "font-size": "12px", "font-weight": "700", color: "var(--accent)", cursor: "pointer" });
      head.addEventListener("click", () => onLine(node.line));
      loop.append(head, depth > 6 ? styled(el("div", { text: "…" }), {}) : flowColumn(node.body, onLine, depth + 1));
      column.append(loop);
      continue;
    }
    const head = styled(el("div", {
      class: "script-flow-condition",
      dataset: { line: String(node.line), ...(node.code ? { code: "1" } : {}) },
      attrs: { role: "button", tabindex: "0", title: `코드 ${node.line}번째 줄로` },
      text: `${node.head}?`,
    }), {
      padding: "4px 12px",
      "border-radius": "6px",
      background: node.code ? "var(--bg-inset, #f4efe4)" : "color-mix(in srgb, var(--warning, #c98a1b) 18%, var(--bg-raised, #fffdf7))",
      border: node.code ? "1px dashed var(--border-default)" : "1px solid color-mix(in srgb, var(--warning, #c98a1b) 45%, transparent)",
      "font-size": "12px",
      "font-weight": "700",
      "max-width": "360px",
      "text-align": "center",
      cursor: "pointer",
      ...(node.code ? { "font-family": MONO, "font-weight": "500" } : {}),
    });
    if (node.code) head.setAttribute("translate", "no");
    head.addEventListener("click", () => onLine(node.line));
    column.append(head);
    const arms = styled(el("div", { class: "script-flow-arms" }), {
      display: "grid",
      "grid-template-columns": `repeat(${node.arms.length}, minmax(150px, max-content))`,
      "justify-content": "space-around",
      gap: "12px",
      width: "max-content",
      "min-width": "100%",
      "border-top": "1px solid var(--border-default, #d9d0bd)",
      "padding-top": "2px",
    });
    for (const arm of node.arms) {
      const cell = styled(el("div", { class: "script-flow-arm" }), { display: "flex", "flex-direction": "column", "align-items": "center", "min-width": "150px" });
      cell.append(connector(arm.label, arm.label === "예" ? "yes" : arm.label === "아니오" ? "no" : undefined));
      cell.append(depth > 6 ? styled(el("div", { text: "…" }), {}) : flowColumn(arm.body, onLine, depth + 1));
      arms.append(cell);
    }
    column.append(arms);
  }
  flush();
  return column;
}

export function renderScriptFlow(nodes: readonly ScriptFlowNode[], onLine: (line: number) => void, trigger = "실행되면"): HTMLElement {
  const root = styled(el("div", { class: "script-flow", dataset: { testid: "script-flow" } }), {
    display: "flex",
    "flex-direction": "column",
    // `safe`: a tree wider than the panel starts at the left edge and scrolls, instead of being cut off on the left.
    "align-items": "safe center",
    gap: "4px",
    padding: "8px",
    overflow: "auto",
  });
  root.append(styled(el("div", { text: trigger }), {
    padding: "2px 12px",
    "border-radius": "999px",
    background: "var(--accent, #4A57D6)",
    color: "var(--on-accent, #fff)",
    "font-size": "12px",
    "font-weight": "700",
  }), connector(), flowColumn(nodes, onLine, 0));
  return root;
}

// ── example results ──────────────────────────────────────────────────────────

const clip = (text: string, limit = 34): string => (text.length > limit ? `${text.slice(0, limit - 1)}…` : text);

/** Plain one-line outcome of a dry run for the example table. */
export function exampleOutcome(result: DryRunResult, project: Project | undefined): string {
  const parts: string[] = [];
  if (result.errors.length) parts.push(`오류: ${clip(result.errors[0]!, 60)}`);
  const messages = result.steps.filter((step) => step.kind === "message");
  const last = messages.at(-1);
  if (last && last.kind === "message") parts.push(`「${clip(last.body)}」${messages.length > 1 ? ` (대사 ${messages.length})` : ""}`);
  const changes = result.changes;
  for (const [id, change] of Object.entries(changes.switches ?? {})) parts.push(`스위치 「${scriptRefName(project, "switch", id)}」 ${change.to ? "켬" : "끔"}`);
  for (const [id, change] of Object.entries(changes.variables ?? {})) parts.push(`「${scriptRefName(project, "variable", id)}」 ${change.from} → ${change.to}`);
  for (const [key, change] of Object.entries(changes.selfSwitches ?? {})) parts.push(`셀프 스위치 ${key.split(".").pop()} ${change.to ? "켬" : "끔"}`);
  if (changes.gold) parts.push(`돈 ${changes.gold.from} → ${changes.gold.to}`);
  for (const [id, change] of Object.entries(changes.items ?? {})) parts.push(`「${scriptRefName(project, "item", id)}」 ${change.from} → ${change.to}`);
  for (const step of result.steps) {
    if (step.kind === "transfer") parts.push("맵 이동");
    else if (step.kind === "sound") parts.push(`♪ ${step.resourceId}`);
    else if (step.kind === "fx") parts.push(step.effect === "shake" ? "화면 흔들림" : "화면 번쩍");
  }
  if (result.endedBy === "maxSteps") parts.push("끝나지 않음(반복?)");
  return parts.length ? parts.join(" · ") : "아무 변화 없음";
}

// ── diff ─────────────────────────────────────────────────────────────────────

export type DiffLine = { readonly kind: "same" | "add" | "del"; readonly text: string };

/** Line LCS diff (scripts are small: ≤ a few hundred lines). */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  if (a.length * b.length > 400_000) return [...a.map((text) => ({ kind: "del" as const, text })), ...b.map((text) => ({ kind: "add" as const, text }))];
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { out.push({ kind: "same", text: a[i]! }); i += 1; j += 1; }
    else if (j < b.length && (i >= a.length || dp[i]![j + 1]! >= dp[i + 1]![j]!)) { out.push({ kind: "add", text: b[j]! }); j += 1; }
    else { out.push({ kind: "del", text: a[i]! }); i += 1; }
  }
  return out;
}

/** Diff with unchanged runs folded to 2 lines of context. */
export function renderLineDiff(lines: readonly DiffLine[]): HTMLElement {
  const box = styled(el("pre", { class: "script-diff", dataset: { testid: "script-ai-diff" }, attrs: { translate: "no" } }), {
    margin: "0",
    padding: "6px 0",
    background: "var(--bg-inset, #f4efe4)",
    border: "1px solid var(--border-default)",
    "border-radius": "6px",
    "font-family": MONO,
    "font-size": "12px",
    "line-height": "1.5",
    "max-height": "260px",
    overflow: "auto",
    "white-space": "pre",
  });
  const keep = new Set<number>();
  lines.forEach((line, index) => {
    if (line.kind === "same") return;
    for (let k = Math.max(0, index - 2); k <= Math.min(lines.length - 1, index + 2); k += 1) keep.add(k);
  });
  let skipped = false;
  lines.forEach((line, index) => {
    if (!keep.has(index)) {
      if (!skipped) box.append(styled(el("div", { text: "  ⋯" }), { color: "var(--text-2)", padding: "0 8px" }));
      skipped = true;
      return;
    }
    skipped = false;
    box.append(styled(el("div", { text: `${line.kind === "add" ? "+" : line.kind === "del" ? "-" : " "} ${line.text}` }), {
      padding: "0 8px",
      ...(line.kind === "add" ? { background: "color-mix(in srgb, var(--success, #18764F) 16%, transparent)" } : {}),
      ...(line.kind === "del" ? { background: "color-mix(in srgb, var(--danger, #b42318) 14%, transparent)", "text-decoration": "line-through", color: "var(--text-2)" } : {}),
    }));
  });
  return box;
}

// ── read-only command list (B) ───────────────────────────────────────────────

export function renderReadonlyCommands(commands: readonly Command[]): HTMLElement {
  const list = styled(el("div", { class: "script-unwrapped-list", dataset: { testid: "script-unwrapped-list" } }), {
    border: "1px solid var(--border-default)",
    "border-radius": "6px",
    background: "var(--bg-raised, #fffdf7)",
    padding: "6px 0",
    "font-size": "13px",
    "max-height": "340px",
    overflow: "auto",
  });
  let counter = 0;
  const walk = (items: readonly Command[], depth: number): void => {
    for (const command of items) {
      counter += 1;
      list.append(styled(el("div", {
        class: "script-unwrapped-row",
        children: [
          styled(el("span", { text: String(counter) }), { width: "28px", "text-align": "right", color: "var(--text-2)", "font-size": "11px", "flex-shrink": "0" }),
          styled(el("span", { text: commandSummary(command) }), { "padding-left": `${depth * 16}px` }),
        ],
      }), { display: "flex", gap: "8px", padding: "1px 8px" }));
      for (const branch of eventCommandBranches(command)) {
        list.append(styled(el("div", { text: `: ${branch.label}` }), { "padding-left": `${36 + depth * 16}px`, color: "var(--accent)", "font-size": "12px" }));
        walk(branch.commands, depth + 1);
      }
    }
  };
  walk(commands, 0);
  return list;
}
