// Script commands read like event lines (event list + script edit dialog).
//
// Readability first (2026-10-31, second pass 2026-11-01): a `script` command in the event list is followed by
// read-only lines in the list's own style. When the whole script converts to event commands (scriptToCommands, exact
// subset) the lines are those commands' own summaries; otherwise each statement is one plain line from the flow reader
// (scriptInsight.scriptFlow): a branch is its condition as a sentence (「돈이 총액보다 적으면」) with an 「아니면」 arm
// (else-if chains stay flat: 「아니고 …면」), a loop is 「레버 목록의 각 레버마다」, a comment line in the script is a step
// heading, message holes are «이름» chips, and three or more code-only lines fold into 「계산 N줄」. Each line carries a
// small category icon (no word pill). The code itself stays behind the row's small 「코드」 toggle.
// Wiki: openwiki/script-sandbox.md 「목록에서 읽히는 스크립트」.
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { prepareScriptCompiler } from "@/editor/script/compile";
import { scriptFlow, type ScriptFlowNode, type ScriptFlowStep, type ScriptFlowTone } from "@/editor/script/scriptInsight";
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

/** Branch arm labels of the event list, said the short way: 「그러면」 / 「아니면」. */
export function shortArmLabel(label: string): string {
  if (label === "조건이 맞을 때" || label === "예") return "그러면";
  if (label === "조건이 맞지 않을 때" || label === "아니오") return "아니면";
  return label;
}

function visualFor(kind: string): CategoryVisual {
  return commandCategoryVisual({ kind } as unknown as Command);
}

function stepVisual(step: ScriptFlowStep): CategoryVisual {
  return visualFor(step.like ?? TONE_KIND[step.tone]);
}

function styled<T extends HTMLElement>(node: T, style: Record<string, string>): T {
  for (const [key, value] of Object.entries(style)) node.style.setProperty(key, value);
  return node;
}

/** Text with «이름» holes as quiet chips (message templates, computed values). */
export function richLineText(text: string): HTMLElement {
  const span = el("span", { class: "cmd-script-line-text" });
  const parts = text.split(/(«[^«»]+»)/u);
  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("«") && part.endsWith("»")) {
      span.append(styled(el("span", {
        class: "cmd-script-hole",
        text: part.slice(1, -1),
        attrs: { title: "실행할 때 계산되는 값" },
      }), {
        display: "inline-block",
        padding: "0 3px",
        "border-radius": "4px",
        "font-size": "12px",
        "line-height": "18px",
        color: "var(--accent, #4A57D6)",
        background: "color-mix(in srgb, var(--accent, #4A57D6) 9%, transparent)",
      }));
    } else span.append(document.createTextNode(part));
  }
  return span;
}

type LineStyle = { code?: boolean; arm?: boolean; heading?: boolean };

// Inline styles: these rows live inside the command list, whose late sheets win any shared class rule.
function line(depth: number, visual: CategoryVisual | undefined, body: HTMLElement | string, extra: LineStyle = {}): HTMLElement {
  const row = styled(el("div", {
    class: `cmd-script-line${extra.arm ? " is-arm" : ""}${extra.code ? " is-code" : ""}${extra.heading ? " is-heading" : ""}`,
    dataset: { testid: extra.heading ? "event-command-script-heading" : "event-command-script-line", ...(visual ? { commandCategory: visual.key } : {}) },
  }), {
    display: "flex",
    "align-items": "center",
    gap: "6px",
    "min-height": extra.heading ? "26px" : "22px",
    padding: `1px 8px 1px calc(${depth} * 20px + 8px)`,
    "font-size": extra.arm ? "12px" : "13px",
    "font-weight": extra.heading ? "700" : extra.arm ? "650" : "400",
    "line-height": "1.45",
    color: extra.heading ? "var(--text-1, #2b2620)" : extra.arm ? "var(--text-2, #6b6457)" : extra.code ? "var(--text-2, #6b6457)" : "var(--text-1, #2b2620)",
    ...(depth > 0 ? { "background-image": `repeating-linear-gradient(to right, transparent 0, transparent 13px, color-mix(in srgb, var(--border-default, #d9d0bd) 70%, transparent) 13px, color-mix(in srgb, var(--border-default, #d9d0bd) 70%, transparent) 14px, transparent 14px, transparent 20px)`, "background-size": `calc(${depth} * 20px) 100%`, "background-repeat": "no-repeat", "background-position": "8px 0" } : {}),
    ...(extra.heading ? { "margin-top": "4px" } : {}),
  });
  if (visual) {
    const color = `var(--cmdcat-${visual.key}, var(--text-2, #6b6457))`;
    row.append(styled(el("span", {
      class: "cmd-script-line-cat",
      attrs: { "aria-hidden": "true", title: visual.label },
      dataset: { category: visual.key },
      children: [renderCategoryIcon(visual)],
    }), {
      display: "inline-flex",
      "align-items": "center",
      "justify-content": "center",
      width: "14px",
      height: "14px",
      "flex-shrink": "0",
      color,
    }));
  } else if (!extra.heading && !extra.arm) row.append(styled(el("span", { attrs: { "aria-hidden": "true" } }), { width: "14px", "flex-shrink": "0" }));
  const text = typeof body === "string" ? richLineText(body) : body;
  styled(text, { "min-width": "0", "overflow-wrap": "anywhere" });
  row.append(text);
  return row;
}

function commandLines(commands: readonly Command[], depth: number, out: HTMLElement[], options: ScriptLinesOptions): void {
  for (const command of commands) {
    const body = options.summarize ? options.summarize(command) : el("span", { class: "cmd-script-line-text", text: commandSummary(command) });
    out.push(line(depth, commandCategoryVisual(command), body));
    for (const branch of eventCommandBranches(command)) {
      out.push(line(depth, undefined, shortArmLabel(branch.label), { arm: true }));
      commandLines(branch.commands, depth + 1, out, options);
    }
  }
}

/** A run of code-only lines folds into one 「계산 N줄」 line that opens on click. */
function foldedCode(depth: number, steps: readonly ScriptFlowStep[]): HTMLElement[] {
  const lines = steps.map((step) => line(depth, stepVisual(step), `계산: ${step.text}`, { code: true }));
  const toggle = styled(el("button", {
    class: "cmd-script-fold",
    text: `계산 ${steps.length}줄 — 펼치기`,
    attrs: { type: "button", title: "코드로만 적힌 계산 줄 보기" },
    dataset: { testid: "event-command-script-fold" },
  }), { border: "0", padding: "0", background: "transparent", color: "var(--text-2, #6b6457)", "font-size": "12px", cursor: "pointer", "text-align": "left" });
  const row = line(depth, visualFor("script"), toggle, { code: true });
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    row.replaceWith(...lines);
  });
  return [row];
}

function flowLines(nodes: readonly ScriptFlowNode[], depth: number, out: HTMLElement[]): void {
  let codeRun: ScriptFlowStep[] = [];
  const flush = (): void => {
    if (codeRun.length >= 3) out.push(...foldedCode(depth, codeRun));
    else for (const step of codeRun) out.push(line(depth, stepVisual(step), `계산: ${step.text}`, { code: true }));
    codeRun = [];
  };
  for (const node of nodes) {
    if (node.k === "step" && node.code) {
      codeRun.push(node);
      continue;
    }
    flush();
    if (node.k === "heading") {
      out.push(line(depth, undefined, node.text, { heading: true }));
      continue;
    }
    if (node.k === "step") {
      out.push(line(depth, stepVisual(node), node.text));
      continue;
    }
    if (node.k === "loop") {
      out.push(line(depth, visualFor(TONE_KIND.loop), node.head));
      flowLines(node.body, depth + 1, out);
      continue;
    }
    branchLines(node, depth, out, "");
  }
  flush();
}

/** if / else-if / else, flat: 「…면」 · 「아니고 …면」 · 「아니면」. */
function branchLines(node: Extract<ScriptFlowNode, { k: "branch" }>, depth: number, out: HTMLElement[], prefix: string): void {
  const [yes, no] = node.arms;
  out.push(line(depth, visualFor(TONE_KIND.branch), `${prefix}${node.sentence}`, node.code ? { code: true } : {}));
  flowLines(yes?.body ?? [], depth + 1, out);
  const otherwise = no?.body ?? [];
  if (!otherwise.length) return;
  const [only] = otherwise;
  if (otherwise.length === 1 && only?.k === "branch") {
    branchLines(only, depth, out, "아니고 ");
    return;
  }
  out.push(line(depth, undefined, "아니면", { arm: true }));
  flowLines(otherwise, depth + 1, out);
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
