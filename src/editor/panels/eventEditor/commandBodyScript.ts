// 「스크립트 (TypeScript)」 명령의 편집 창 — 읽기 먼저 (2026-10-31 사용자 방향: 「편집은 AI 가 하고 사람은 읽는다」).
//
// 탭 둘:
//   줄    이벤트 목록과 같은 모양의 읽기 전용 줄(scriptLines.ts) — 명령으로 완전히 풀리면 그 명령들의 줄, 아니면 문장마다
//         한 줄(조건 분기·반복·「계산: …」). 아래 「명령으로 풀기」(풀릴 때만, 아니면 이유 + 「그 줄 보기」).
//   코드  코드 상자·진단·game API 목록.
// 런타임·한도·API 정본은 openwiki/script-sandbox.md.
import { editorState } from "@/editor/editorState";
import { compileScript, prepareScriptCompiler, scriptCommandFields, scriptCompilerReady, type ScriptCompileResult } from "@/editor/script/compile";
import { unwrapScriptForEditor } from "@/editor/script/scriptUnwrapAdapter";
import { SCRIPT_API, SCRIPT_API_GROUP_LABELS, type ScriptApiEntry } from "@/project/script/apiSpec";
import type { ScriptExplanation } from "@/project/script/types";
import { store } from "@/project/store";
import type { Command, Project } from "@/project/types";
import { el } from "@/util/dom";
import { renderScriptLines } from "./scriptLines";
import type { CommandEditContext } from "./types";

type ScriptCommand = Extract<Command, { kind: "script" }>;
type Tab = "lines" | "code";

/** Bubbles from the form when the user unwraps the script; the edit dialog replaces the one command with these. */
export const SCRIPT_UNWRAP_EVENT = "oprn-script-unwrap";

const MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const SEVERITY_LABEL = { error: "오류", warning: "경고", info: "참고" } as const;
const PLACEHOLDER = [
  "// 예: 평판으로 깎은 포션 값을 변수에 둔다 (대사는 이벤트 명령으로)",
  "const BASE = 50;",
  'game.setVar("potion_price", Math.max(35, BASE - game.getVar("reputation")));',
].join("\n");

// The open tab survives the dialog re-rendering the form (staged command updates).
const tabMemory = new Map<string, Tab>();

function styled<T extends HTMLElement>(node: T, style: Partial<Record<string, string>>): T {
  for (const [key, value] of Object.entries(style)) if (value !== undefined) node.style.setProperty(key, value);
  return node;
}

function compileOptions(): { project: Project; mapId: string | undefined } {
  return { project: store.getCurrent(), mapId: editorState.get().currentMapId ?? undefined };
}

function apiReference(): HTMLElement {
  const details = el("details", { class: "script-api-reference", dataset: { testid: "script-api-reference" } });
  details.append(el("summary", { text: "game API 목록" }));
  let group: string | undefined;
  let list: HTMLElement | undefined;
  for (const entry of SCRIPT_API as readonly ScriptApiEntry[]) {
    if (entry.group !== group) {
      group = entry.group;
      details.append(el("div", { class: "script-api-group", text: SCRIPT_API_GROUP_LABELS[entry.group] }));
      list = el("ul", { class: "script-api-list" });
      details.append(list);
    }
    const signature = `${entry.awaits ? "await " : ""}game.${entry.name}(${entry.params})`;
    list?.append(
      el("li", {
        attrs: { title: entry.doc },
        children: [el("code", { text: signature, attrs: { translate: "no" } }), " — ", el("span", { text: entry.ko })],
      })
    );
  }
  return details;
}

function button(text: string, testid: string, onClick: () => void, options: { title?: string } = {}): HTMLButtonElement {
  const node = el("button", {
    class: "btn",
    text,
    attrs: { type: "button", ...(options.title ? { title: options.title } : {}) },
    dataset: { testid },
    on: { click: onClick },
  }) as HTMLButtonElement;
  return styled(node, { padding: "4px 10px", "min-height": "28px", "border-radius": "6px", "font-size": "12px" });
}

export function scriptCommandBody(context: CommandEditContext, cmd: ScriptCommand): HTMLElement {
  void prepareScriptCompiler().catch(() => undefined);
  const memoryKey = `${editorState.get().currentMapId ?? ""}:${editorState.get().selectedEventId ?? ""}:${context.path.join(".")}`;
  let tab: Tab = tabMemory.get(memoryKey) ?? "lines";

  let current: ScriptCommand = cmd;
  let result: ScriptCompileResult | undefined;
  const latest = (): ScriptCommand => {
    const staged = context.getCurrentCommand?.();
    return staged && staged.kind === "script" ? staged : current;
  };

  // ── code tab (the original editor) ─────────────────────────────────────────
  const name = el("input", {
    attrs: { type: "text", placeholder: "이름 (예: 레버 퍼즐 판정)", "aria-label": "스크립트 이름" },
    value: cmd.name ?? "",
    dataset: { testid: "script-name-input" },
  }) as HTMLInputElement;
  const source = el("textarea", {
    class: "script-editor-source",
    attrs: { spellcheck: "false", rows: "14", placeholder: PLACEHOLDER, translate: "no", autocapitalize: "off", autocomplete: "off" },
    value: cmd.source,
    dataset: { testid: "script-source-input" },
  }) as HTMLTextAreaElement;
  styled(source, {
    "font-family": MONO,
    width: "100%",
    "tab-size": "2",
    "min-height": "320px",
    "box-sizing": "border-box",
    "font-size": "13px",
    "line-height": "1.5",
    "white-space": "pre",
    overflow: "auto",
  });
  const status = el("div", { class: "script-compile-status", dataset: { testid: "script-compile-status" } });
  const problems = el("ul", { class: "script-diagnostics", dataset: { testid: "script-diagnostics" } });
  const statusPill = styled(el("span", { class: "script-card-status", dataset: { testid: "script-card-status" } }), {
    "font-size": "11px",
    "font-weight": "700",
    padding: "2px 8px",
    "border-radius": "999px",
    background: "var(--bg-inset, #f4efe4)",
    color: "var(--text-2)",
    "white-space": "nowrap",
  });

  const selectLine = (line: number): void => {
    switchTab("code");
    const lines = source.value.split("\n");
    const start = lines.slice(0, line - 1).reduce((sum, text) => sum + text.length + 1, 0);
    source.focus();
    source.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
    const lineHeight = 13 * 1.5;
    source.scrollTop = Math.max(0, (line - 4) * lineHeight);
  };

  const showDiagnostics = (compiled: ScriptCompileResult | undefined, pending = false): void => {
    problems.replaceChildren();
    if (pending) {
      status.textContent = "검사 중…";
      statusPill.textContent = "검사 중…";
      return;
    }
    if (!compiled) {
      status.textContent = latest().summary ? `요약: ${latest().summary}` : "아직 검사하지 않았습니다.";
      statusPill.textContent = "";
      return;
    }
    const errors = compiled.diagnostics.filter((entry) => entry.severity === "error").length;
    const warnings = compiled.diagnostics.filter((entry) => entry.severity === "warning").length;
    status.textContent = errors
      ? `오류 ${errors}개 · 경고 ${warnings}개 — 고치기 전에는 게임에서 오류 대사가 납니다.`
      : warnings
        ? `경고 ${warnings}개 — 실행은 됩니다.`
        : compiled.summary
          ? `문제 없음 — ${compiled.summary}`
          : "문제 없음";
    status.dataset.state = errors ? "error" : warnings ? "warning" : "ok";
    statusPill.textContent = errors ? `오류 ${errors}개` : warnings ? `경고 ${warnings}개` : "문제 없음";
    statusPill.dataset.state = status.dataset.state;
    statusPill.style.color = errors ? "var(--danger, #b42318)" : warnings ? "var(--warning, #8A6B2F)" : "var(--success, #18764F)";
    for (const entry of compiled.diagnostics.slice(0, 40)) {
      const item = el("li", {
        class: `script-diagnostic script-diagnostic-${entry.severity}`,
        children: [
          el("span", { class: "script-diagnostic-severity", text: SEVERITY_LABEL[entry.severity] }),
          el("span", { attrs: { translate: "no" }, text: ` ${entry.line}:${entry.column} ${entry.message}` }),
        ],
      });
      item.addEventListener("click", () => selectLine(entry.line));
      problems.append(item);
    }
  };

  const check = (): ScriptCompileResult | undefined => (scriptCompilerReady() ? compileScript(source.value, compileOptions()) : undefined);

  /** Compile `text` and write it (with an explanation, kept stale by default) as the staged command. */
  const commit = async (text: string, explanation: ScriptExplanation | undefined = latest().explanation): Promise<void> => {
    await Promise.resolve();
    const label = name.value;
    if (!scriptCompilerReady()) {
      showDiagnostics(undefined, true);
      await prepareScriptCompiler();
    }
    const compiled = compileScript(text, compileOptions());
    if (source.value !== text) source.value = text;
    result = compiled;
    current = scriptCommandFields(text, compiled, label, explanation);
    context.actions.replaceCommand(context.path, current);
    refresh();
  };

  let typingTimer: ReturnType<typeof setTimeout> | undefined;
  source.addEventListener("input", () => {
    if (typingTimer) clearTimeout(typingTimer);
    typingTimer = setTimeout(() => showDiagnostics(check()), 600);
  });
  source.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const start = source.selectionStart;
    source.setRangeText("  ", start, source.selectionEnd, "end");
    source.dispatchEvent(new Event("input"));
  });
  source.addEventListener("change", () => void commit(source.value));
  name.addEventListener("change", () => void commit(source.value));

  const codePanel = styled(el("div", {
    class: "script-card-panel",
    dataset: { panel: "code" },
    children: [
      source,
      status,
      problems,
      apiReference(),
      el("span", {
        class: "empty-hint",
        text: "TypeScript 로 이벤트 로직을 씁니다. await 가 붙은 호출(대사·선택지·전투…)은 이벤트 명령처럼 차례로 실행됩니다. 지역 변수는 세이브되지 않으니 남길 값은 스위치·변수에 두세요.",
        dataset: { testid: "script-help" },
      }),
    ],
  }), { display: "flex", "flex-direction": "column", gap: "8px" });

  const unwrapState = (): ReturnType<typeof unwrapScriptForEditor> => unwrapScriptForEditor(latest().source, store.getCurrent());

  const unwrapButton = (): HTMLElement => {
    const state = unwrapState();
    const node = button("명령으로 풀기", "script-unwrap", () => {
      const fresh = unwrapState();
      if (fresh.status !== "ok") return;
      root.dispatchEvent(new CustomEvent(SCRIPT_UNWRAP_EVENT, { bubbles: true, detail: { commands: fresh.commands } }));
    }, { title: state.status === "ok" ? "이 스크립트를 같은 동작의 이벤트 명령으로 바꿉니다." : state.reason });
    if (state.status !== "ok") {
      node.setAttribute("disabled", "");
      node.setAttribute("aria-disabled", "true");
    }
    const wrap = styled(el("span", { class: "script-card-unwrap" }), { display: "inline-flex", "align-items": "center", gap: "6px" });
    wrap.append(node);
    if (state.status === "blocked") {
      wrap.append(styled(el("span", { text: state.reason, dataset: { testid: "script-unwrap-reason" } }), { "font-size": "11px", color: "var(--text-2)" }));
      const line = state.line;
      if (line) {
        const jump = button("그 줄 보기", "script-unwrap-line", () => { switchTab("code"); selectLine(line); }, { title: `코드 ${line}번째 줄` });
        styled(jump, { "font-size": "11px", padding: "1px 8px" });
        wrap.append(jump);
      }
    }
    return wrap;
  };

  // ── lines tab ──────────────────────────────────────────────────────────────
  const linesPanel = styled(el("div", { class: "script-card-panel", dataset: { panel: "lines", testid: "script-lines-panel" } }), { display: "flex", "flex-direction": "column", gap: "8px" });
  const renderLinesPanel = (): void => {
    const command = latest();
    const lines = renderScriptLines(command, () => store.getCurrent(), { maxLines: 200 });
    styled(lines, {
      border: "1px solid var(--border-default, #d9d0bd)",
      "border-radius": "6px",
      background: "var(--bg-raised, #fffdf7)",
      padding: "6px 0",
      "max-height": "420px",
      overflow: "auto",
    });
    linesPanel.replaceChildren(
      command.source.trim() ? lines : styled(el("div", { text: "아직 코드가 없습니다. 「코드」에서 쓰거나 조수에게 맡기세요." }), { "font-size": "12px", color: "var(--text-2)" }),
      unwrapButton(),
    );
  };

  // ── tabs ───────────────────────────────────────────────────────────────────
  const tabBar = styled(el("div", { class: "script-card-tabs", attrs: { role: "tablist", "aria-label": "스크립트 보기" } }), {
    display: "inline-flex",
    gap: "2px",
    padding: "2px",
    "border-radius": "8px",
    background: "var(--bg-inset, #f4efe4)",
  });
  const tabButtons = new Map<Tab, HTMLButtonElement>();
  const panels: Record<Tab, HTMLElement> = { lines: linesPanel, code: codePanel };
  const tabLabel: Record<Tab, string> = { lines: "줄", code: "코드" };
  for (const key of ["lines", "code"] as const) {
    const node = el("button", {
      text: tabLabel[key],
      attrs: { type: "button", role: "tab" },
      dataset: { testid: `script-tab-${key}` },
      on: { click: () => switchTab(key) },
    }) as HTMLButtonElement;
    styled(node, { border: "0", background: "transparent", padding: "4px 12px", "border-radius": "6px", "font-size": "12px", cursor: "pointer" });
    tabButtons.set(key, node);
    tabBar.append(node);
  }
  function switchTab(next: Tab): void {
    tab = next;
    tabMemory.set(memoryKey, next);
    for (const [key, node] of tabButtons) {
      const on = key === next;
      node.setAttribute("aria-selected", String(on));
      node.style.background = on ? "var(--bg-raised, #fffdf7)" : "transparent";
      node.style.fontWeight = on ? "700" : "500";
      node.style.color = on ? "var(--accent, #4A57D6)" : "var(--text-1)";
    }
    // `hidden` loses to the inline display these panels need, so the display itself switches.
    for (const [key, panel] of Object.entries(panels) as [Tab, HTMLElement][]) {
      panel.hidden = key !== next;
      panel.style.display = key !== next ? "none" : "flex";
    }
  }

  function refresh(): void {
    showDiagnostics(result);
    renderLinesPanel();
    switchTab(tab);
  }

  // ── assemble ───────────────────────────────────────────────────────────────
  styled(name, { flex: "1", "min-width": "0", "box-sizing": "border-box", "font-size": "13px", padding: "4px 8px" });
  const header = styled(el("div", { class: "script-card-header" }), { display: "flex", gap: "8px", "align-items": "center", "flex-wrap": "wrap" });
  header.append(name, statusPill, tabBar);
  const root = el("span", {
    class: "rich-command-form cream-command-form script-command-form",
    children: [header, linesPanel, codePanel],
  });
  styled(root, { display: "flex", "flex-direction": "column", "align-items": "stretch", gap: "8px", width: "100%", "grid-column": "1 / -1" });

  // The dialog title already names the command; the generic kind line above the form only pushed the form down
  // (it sits in an auto-fit grid row that stretched to ~100px). Rows pack to the top.
  queueMicrotask(() => {
    const head = root.previousElementSibling;
    if (head instanceof HTMLElement && head.classList.contains("cream-command-form-head")) head.style.display = "none";
    if (root.parentElement) root.parentElement.style.alignContent = "start";
  });

  showDiagnostics(undefined);
  refresh();
  if (cmd.source.trim()) {
    void prepareScriptCompiler().then(() => {
      result = check();
      refresh();
    }).catch(() => undefined);
  }
  return root;
}
