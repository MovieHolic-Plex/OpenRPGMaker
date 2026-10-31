// Script commands read like event lines (event list + script edit dialog).
//
// Readability first (2026-10-31): a `script` command in the event list is followed by read-only lines in the
// list's own style. When the whole script converts to event commands (scriptToCommands, exact subset) the lines
// are those commands' own summaries; otherwise each statement is one plain line from the flow reader
// (scriptInsight.scriptFlow): a branch is 「조건 분기」 with 예/아니오 arms, a loop is 「반복」, and code-only
// fragments are 「계산: 가격 = 내림(100 × (1 − 변수 「평판」 ÷ 200))」. The code itself stays behind the row's
// small 「코드」 toggle. Wiki: openwiki/script-sandbox.md 「목록에서 읽히는 스크립트」.
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { prepareScriptCompiler } from "@/editor/script/compile";
import { scriptFlow, type ScriptFlowNode, type ScriptFlowTone } from "@/editor/script/scriptInsight";
import { unwrapScriptForEditor } from "@/editor/script/scriptUnwrapAdapter";
import { scriptCompilerReady } from "@/editor/script/tsEnv";
import type { Command, Project } from "@/project/types";
import { el } from "@/util/dom";
import { commandCategoryVisual, renderCategoryIcon, type CategoryVisual } from "./commandCategoryIcons";
import { commandSummary } from "./commandSummary";

type ScriptCommand = Extract<Command, { kind: "script" }>;

export interface ScriptLinesOptions {
  /** The list's own rich summary renderer (icons, bold parts). Falls back to plain commandSummary text. */
  readonly summarize?: (command: Command) => HTMLElement;
  /** Lines over this count fold behind 「… N줄 더」. */
  readonly maxLines?: number;
}

/** A flow line's look borrows the category of the event command that does the same job. */
const TONE_KIND: Readonly<Record<ScriptFlowTone | "branch" | "loop", string>> = {
  say: "text",
  ask: "choices",
  set: "setVariable",
  fx: "showAnimation",
  move: "moveEvent",
  call: "callCommonEvent",
  calc: "script",
  end: "breakLoop",
  branch: "fork",
  loop: "loop",
};

function visualFor(kind: string): CategoryVisual {
  return commandCategoryVisual({ kind } as unknown as Command);
}

function styled<T extends HTMLElement>(node: T, style: Record<string, string>): T {
  for (const [key, value] of Object.entries(style)) node.style.setProperty(key, value);
  return node;
}

// Inline styles: these rows live inside the command list, whose late sheets win any shared class rule; the
// look copies the list's category pill (command-list-2.css `.cmd-cat-icon`) so a script reads like its neighbours.
function line(depth: number, visual: CategoryVisual | undefined, body: HTMLElement | string, extra: { code?: boolean; arm?: boolean } = {}): HTMLElement {
  const row = styled(el("div", {
    class: `cmd-script-line${extra.arm ? " is-arm" : ""}${extra.code ? " is-code" : ""}`,
    dataset: { testid: "event-command-script-line", ...(visual ? { commandCategory: visual.key } : {}) },
  }), {
    display: "flex",
    "align-items": "center",
    gap: "8px",
    "min-height": "24px",
    padding: `1px 8px 1px calc(${depth} * 18px + 8px)`,
    "font-size": extra.arm ? "12px" : "13px",
    "line-height": "1.45",
    color: extra.arm ? "var(--accent, #4A57D6)" : extra.code ? "var(--text-2, #6b6457)" : "var(--text-1, #2b2620)",
  });
  if (visual) {
    const color = `var(--cmdcat-${visual.key}, var(--text-2, #6b6457))`;
    row.append(styled(el("span", {
      class: "cmd-script-line-cat",
      attrs: { "aria-hidden": "true" },
      dataset: { category: visual.key },
      children: [renderCategoryIcon(visual), el("span", { text: visual.label })],
    }), {
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      gap: "3px",
      "min-width": "46px",
      height: "20px",
      padding: "0 6px",
      "flex-shrink": "0",
      "border-radius": "999px",
      "font-size": "10px",
      "font-weight": "750",
      "white-space": "nowrap",
      color,
      background: `color-mix(in srgb, ${color} 12%, var(--bg-raised, #fffdf7))`,
      border: `1px solid color-mix(in srgb, ${color} 28%, var(--border-subtle, #eee6d6))`,
    }));
  }
  const text = typeof body === "string" ? el("span", { class: "cmd-script-line-text", text: body }) : body;
  styled(text, { "min-width": "0", "overflow-wrap": "anywhere" });
  row.append(text);
  return row;
}

function commandLines(commands: readonly Command[], depth: number, out: HTMLElement[], options: ScriptLinesOptions): void {
  for (const command of commands) {
    const body = options.summarize ? options.summarize(command) : el("span", { class: "cmd-script-line-text", text: commandSummary(command) });
    out.push(line(depth, commandCategoryVisual(command), body));
    for (const branch of eventCommandBranches(command)) {
      out.push(line(depth + 1, undefined, `: ${branch.label}`, { arm: true }));
      commandLines(branch.commands, depth + 2, out, options);
    }
  }
}

function flowLines(nodes: readonly ScriptFlowNode[], depth: number, out: HTMLElement[]): void {
  for (const node of nodes) {
    if (node.k === "step") {
      out.push(line(depth, visualFor(TONE_KIND[node.tone]), node.code ? `계산: ${node.text}` : node.text, node.code ? { code: true } : {}));
      continue;
    }
    if (node.k === "loop") {
      out.push(line(depth, visualFor(TONE_KIND.loop), node.head.startsWith("반복") ? node.head : `반복: ${node.head}`));
      flowLines(node.body, depth + 1, out);
      continue;
    }
    out.push(line(depth, visualFor(TONE_KIND.branch), `조건 분기: ${node.head}`, node.code ? { code: true } : {}));
    for (const arm of node.arms) {
      if (!arm.body.length && arm.label === "아니오") continue;
      out.push(line(depth + 1, undefined, `: ${arm.label === "예" ? "조건이 맞을 때" : arm.label === "아니오" ? "조건이 맞지 않을 때" : arm.label}`, { arm: true }));
      flowLines(arm.body, depth + 2, out);
    }
  }
}

/** Read-only event-style lines for one script command (empty list for an empty script). */
export function scriptLineNodes(command: Pick<ScriptCommand, "source">, project: Project, options: ScriptLinesOptions = {}): HTMLElement[] {
  const out: HTMLElement[] = [];
  if (!command.source.trim()) return out;
  const unwrap = unwrapScriptForEditor(command.source, project);
  if (unwrap.status === "ok") commandLines(unwrap.commands, 0, out, options);
  else flowLines(scriptFlow(command.source, project, undefined, (raw) => {
    if (typeof raw.kind !== "string") return undefined;
    try {
      return commandSummary(raw as unknown as Command);
    } catch {
      return undefined;
    }
  }), 0, out);
  return out;
}

/**
 * Container with the lines. Loads the TypeScript reader on first use (the list shows 「읽는 중…」 for that
 * moment and fills itself in place — no list re-render).
 */
export function renderScriptLines(command: Pick<ScriptCommand, "source">, project: () => Project, options: ScriptLinesOptions = {}): HTMLElement {
  const box = el("div", { class: "cmd-script-lines", dataset: { testid: "event-command-script-lines" } });
  const fill = (): void => {
    let nodes: HTMLElement[];
    try {
      nodes = scriptLineNodes(command, project(), options);
    } catch {
      nodes = [line(0, undefined, "이 스크립트는 줄로 읽을 수 없습니다 — 「코드」로 보세요.")];
    }
    const limit = options.maxLines ?? 40;
    if (nodes.length > limit) {
      const rest = nodes.slice(limit);
      const more = styled(el("button", {
        class: "cmd-script-lines-more",
        text: `… ${rest.length}줄 더`,
        attrs: { type: "button" },
        dataset: { testid: "event-command-script-lines-more" },
      }), { margin: "2px 0 2px 8px", border: "0", background: "transparent", color: "var(--accent, #4A57D6)", "font-size": "12px", cursor: "pointer" });
      more.addEventListener("click", (event) => {
        event.stopPropagation();
        more.replaceWith(...rest);
      });
      box.replaceChildren(...nodes.slice(0, limit), more);
      return;
    }
    box.replaceChildren(...nodes);
  };
  if (scriptCompilerReady()) fill();
  else {
    box.append(line(0, undefined, "읽는 중…"));
    void prepareScriptCompiler().then(fill).catch(() => box.replaceChildren(line(0, undefined, "스크립트 읽기 도구를 불러오지 못했습니다.")));
  }
  return box;
}
