// 「스크립트 (TypeScript)」 명령의 편집 창 — 비개발자가 코드를 열지 않고도 읽고 고칠 수 있게 (2026-10-31 시안 A+D+E).
//
// 탭 넷:
//   요약     쉬운 말 문장(모델이 쓴 `explanation`, sourceHash 에 묶임 — 코드가 바뀌면 「옛 코드 기준」 띠) +
//            읽음/씀/부름 칩(컴파일러 effects) + 조정값(최상위 const 리터럴, 그 글자만 바꿔 재컴파일) +
//            예시 표(예시는 「상황」만 저장, 결과는 여기서 헤드리스로 실행해 채운다 — 어긋날 수 없다).
//   흐름     if/else · 선택지 · 반복을 상자로 — 코드에서 기계로 만든다. 상자를 누르면 코드 그 줄.
//   명령 목록 스크립트를 이벤트 명령으로 풀었을 때 모습(읽기 전용). 완전히 풀릴 때만 켜지고 「명령으로 풀기」로 잇는다.
//   코드     예전 코드 상자·진단·game API 목록(고급).
// 아래 「AI에게 고쳐 달라고 하기」: 한 번의 모델 호출로 새 코드 + 새 요약 + 예시 → 바뀐 줄·바뀐 요약·예시 전후 결과를
// 보여 주고 「적용」해야 바뀐다(ai/scriptAssist.ts). 런타임·한도·API 정본은 openwiki/script-sandbox.md.
import { runScriptAssist, type ScriptAssistResult } from "@/ai/scriptAssist";
import { loadAiConfig } from "@/ai/llmClient";
import { editorState } from "@/editor/editorState";
import { isAiConfigReady } from "@/editor/panels/aiChatPanelHelpers";
import { compileScript, prepareScriptCompiler, scriptCommandFields, scriptCompilerReady, type ScriptCompileResult } from "@/editor/script/compile";
import { dryRunCommands, type DryRunResult } from "@/editor/script/dryRun";
import { scriptChips, scriptFlow, scriptFlowStats, scriptTunables, setScriptTunable, type ScriptTunable } from "@/editor/script/scriptInsight";
import { unwrapScriptForEditor } from "@/editor/script/scriptUnwrapAdapter";
import { getLocale } from "@/i18n";
import { preloadScriptEngine, scriptEngineModule } from "@/player/script/engine";
import { SCRIPT_API, SCRIPT_API_GROUP_LABELS, type ScriptApiEntry } from "@/project/script/apiSpec";
import { scriptSourceHash, type ScriptExample, type ScriptExplanation } from "@/project/script/types";
import { store } from "@/project/store";
import type { Command, Project } from "@/project/types";
import { el } from "@/util/dom";
import {
  MONO,
  chipRow,
  exampleOutcome,
  lineDiff,
  renderLineDiff,
  renderReadonlyCommands,
  renderScriptFlow,
  sectionLabel,
  styled,
} from "./scriptCardViews";
import type { CommandEditContext } from "./types";
import { commandSummary } from "./commandSummary";

/** A `game.cmd({...})` passthrough in the flow reads like its row in the command list. */
function describePassthrough(command: Record<string, unknown>): string | undefined {
  if (typeof command.kind !== "string") return undefined;
  try {
    return commandSummary(command as unknown as Command);
  } catch {
    return undefined;
  }
}

type ScriptCommand = Extract<Command, { kind: "script" }>;
type Tab = "card" | "flow" | "list" | "code";

/** Bubbles from the form when the user unwraps the script; the edit dialog replaces the one command with these. */
export const SCRIPT_UNWRAP_EVENT = "oprn-script-unwrap";

const SEVERITY_LABEL = { error: "오류", warning: "경고", info: "참고" } as const;
const PLACEHOLDER = [
  "// 예: 레버 네 개가 정답 순서면 문이 열린다",
  'const order = ["lever_1", "lever_3", "lever_2", "lever_4"];',
  "if (order.every((id) => game.getSwitch(id))) {",
  '  game.setSwitch("door_open", true);',
  '  await game.showMessage("철컥 — 문이 열렸다.");',
  "}",
].join("\n");

// Tab and AI-box drafts survive the dialog re-rendering the form (staged command updates).
const uiMemory = new Map<string, { tab: Tab; aiDraft: string }>();

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

function button(text: string, testid: string, onClick: () => void, options: { primary?: boolean; title?: string } = {}): HTMLButtonElement {
  const node = el("button", {
    class: `btn${options.primary ? " primary" : ""}`,
    text,
    attrs: { type: "button", ...(options.title ? { title: options.title } : {}) },
    dataset: { testid },
    on: { click: onClick },
  }) as HTMLButtonElement;
  return styled(node, {
    padding: "4px 10px",
    "min-height": "28px",
    "border-radius": "6px",
    "font-size": "12px",
    ...(options.primary ? { background: "var(--accent, #4A57D6)", color: "var(--on-accent, #fff)", border: "1px solid var(--accent, #4A57D6)" } : {}),
  });
}

/** Shallow project copy whose current map is cloned — enough isolation for a dry run (scripts only touch the live map). */
function runProject(project: Project, mapId: string | undefined): Project {
  const map = mapId ? project.maps[mapId] : undefined;
  return map ? { ...project, maps: { ...project.maps, [map.id]: structuredClone(map) } } : { ...project, maps: { ...project.maps } };
}

function runExample(command: ScriptCommand, example: ScriptExample): DryRunResult {
  const { project, mapId } = compileOptions();
  const eventId = editorState.get().selectedEventId ?? undefined;
  const { label: _label, ...setup } = example;
  return dryRunCommands(runProject(project, mapId), [command], { ...(mapId ? { mapId } : {}), ...(eventId ? { eventId } : {}), setup });
}

export function scriptCommandBody(context: CommandEditContext, cmd: ScriptCommand): HTMLElement {
  void prepareScriptCompiler().catch(() => undefined);
  const memoryKey = `${editorState.get().currentMapId ?? ""}:${editorState.get().selectedEventId ?? ""}:${context.path.join(".")}`;
  const memory = uiMemory.get(memoryKey) ?? { tab: "card" as Tab, aiDraft: "" };
  uiMemory.set(memoryKey, memory);

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

  // ── card tab ───────────────────────────────────────────────────────────────
  const cardPanel = styled(el("div", { class: "script-card-panel", dataset: { panel: "card", testid: "script-card" } }), { display: "flex", "flex-direction": "column", gap: "2px" });
  const flowPanel = styled(el("div", { class: "script-card-panel", dataset: { panel: "flow", testid: "script-flow-panel" } }), { display: "grid", "grid-template-columns": "200px minmax(0, 1fr)", gap: "12px", "align-items": "start" });
  const listPanel = styled(el("div", { class: "script-card-panel", dataset: { panel: "list", testid: "script-list-panel" } }), { display: "flex", "flex-direction": "column", gap: "8px" });

  const aiReady = (): boolean => {
    try {
      return isAiConfigReady(loadAiConfig());
    } catch {
      return false;
    }
  };

  let exampleRunToken = 0;
  const renderExamples = (host: HTMLElement, command: ScriptCommand, examples: readonly ScriptExample[]): void => {
    const table = styled(el("table", { class: "script-card-examples", dataset: { testid: "script-card-examples" } }), {
      width: "100%",
      "border-collapse": "collapse",
      "font-size": "12px",
    });
    const head = el("tr", { children: [el("th", { text: "상황" }), el("th", { text: "결과 (지금 코드로 실행)" })] });
    for (const th of Array.from(head.children) as HTMLElement[]) styled(th, { "text-align": "left", color: "var(--text-2)", "font-weight": "600", padding: "4px 6px", "border-bottom": "1px solid var(--border-default)" });
    table.append(head);
    const cells: HTMLElement[] = [];
    for (const example of examples) {
      const outcome = styled(el("td", { text: "실행 중…", dataset: { testid: "script-card-example-result" } }), { padding: "4px 6px", "border-bottom": "1px solid var(--border-subtle, #eee6d6)" });
      cells.push(outcome);
      table.append(el("tr", {
        children: [
          styled(el("td", { text: example.label }), { padding: "4px 6px", "border-bottom": "1px solid var(--border-subtle, #eee6d6)", "white-space": "nowrap", "vertical-align": "top" }),
          outcome,
        ],
      }));
    }
    host.append(table);
    const token = ++exampleRunToken;
    void (async () => {
      await preloadScriptEngine().catch(() => undefined);
      if (token !== exampleRunToken) return;
      if (!scriptEngineModule()) {
        for (const cell of cells) cell.textContent = "스크립트 엔진을 불러오지 못했습니다.";
        return;
      }
      examples.forEach((example, index) => {
        const cell = cells[index]!;
        try {
          cell.textContent = exampleOutcome(runExample(command, example), store.getCurrent());
        } catch (error) {
          cell.textContent = `실행 실패: ${error instanceof Error ? error.message : String(error)}`;
        }
      });
    })();
  };

  const renderTunables = (host: HTMLElement, tunables: readonly ScriptTunable[]): void => {
    const grid = styled(el("div", { class: "script-card-tunables", dataset: { testid: "script-card-tunables" } }), {
      display: "grid",
      "grid-template-columns": "minmax(120px, max-content) minmax(0, 260px) 1fr",
      gap: "4px 8px",
      "align-items": "center",
    });
    for (const tunable of tunables) {
      const input = el("input", {
        attrs: { type: "text", "aria-label": tunable.comment ?? tunable.name, translate: "no" },
        value: tunable.value,
        dataset: { testid: "script-card-tunable", name: tunable.name },
      }) as HTMLInputElement;
      styled(input, { width: "100%", "box-sizing": "border-box", "font-family": tunable.kind === "string" ? "inherit" : MONO, "font-size": "12px", padding: "3px 6px" });
      const error = styled(el("span", { class: "script-card-tunable-error" }), { "font-size": "11px", color: "var(--danger, #b42318)" });
      input.addEventListener("change", () => {
        const next = setScriptTunable(latest().source, tunable, input.value);
        if ("error" in next) {
          error.textContent = next.error;
          return;
        }
        error.textContent = "";
        void commit(next.source);
      });
      grid.append(
        el("label", {
          children: [
            el("span", { text: tunable.comment ?? tunable.name }),
            ...(tunable.comment ? [styled(el("code", { text: ` ${tunable.name}`, attrs: { translate: "no" } }), { "font-size": "11px", color: "var(--text-2)", "font-family": MONO })] : []),
          ],
        }),
        input,
        error,
      );
    }
    host.append(grid);
  };

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

  const renderCard = (): void => {
    const command = latest();
    cardPanel.replaceChildren();
    const project = store.getCurrent();
    const explanation = command.explanation;
    const fresh = !!explanation && explanation.sourceHash === scriptSourceHash(command.source);
    const head = styled(el("div", { class: "script-card-head" }), { display: "flex", "align-items": "center", gap: "8px", "margin-bottom": "4px" });
    head.append(
      styled(el("strong", { text: command.name?.trim() || "스크립트" }), { "font-size": "14px" }),
      styled(el("span", {
        text: explanation ? (fresh ? "요약 = 지금 코드" : "옛 코드 기준 요약") : "요약 없음",
        dataset: { testid: "script-card-summary-state", state: explanation ? (fresh ? "fresh" : "stale") : "none" },
      }), {
        "font-size": "11px",
        "font-weight": "700",
        padding: "1px 8px",
        "border-radius": "999px",
        background: fresh ? "color-mix(in srgb, var(--success, #18764F) 14%, transparent)" : "var(--bg-inset, #f4efe4)",
        color: fresh ? "var(--success, #18764F)" : "var(--text-2)",
      }),
    );
    cardPanel.append(head);

    const summaryBox = styled(el("div", { class: "script-card-summary", dataset: { testid: "script-card-summary" } }), {
      border: "1px solid var(--border-default, #d9d0bd)",
      "border-radius": "8px",
      background: "var(--bg-raised, #fffdf7)",
      padding: "8px 12px",
      "font-size": "14px",
      "line-height": "1.65",
      ...(explanation && !fresh ? { opacity: "0.7" } : {}),
    });
    if (explanation) {
      for (const line of explanation.lines) summaryBox.append(el("div", { text: line, attrs: { translate: "no" } }));
    } else {
      summaryBox.append(styled(el("div", { text: result?.summary || command.summary ? `하는 일(자동): ${result?.summary || command.summary}` : "아직 요약이 없습니다." }), { color: "var(--text-2)", "font-size": "13px" }));
    }
    cardPanel.append(summaryBox);
    if (!fresh) {
      const band = styled(el("div", { class: "script-card-stale", dataset: { testid: "script-card-stale" } }), {
        display: "flex",
        "align-items": "center",
        gap: "8px",
        "flex-wrap": "wrap",
        "margin-top": "6px",
        padding: "6px 10px",
        "border-radius": "6px",
        border: "1px dashed var(--warning, #c98a1b)",
        background: "color-mix(in srgb, var(--warning, #c98a1b) 8%, transparent)",
        "font-size": "12px",
      });
      band.append(el("span", {
        text: explanation ? "코드가 바뀐 뒤로 요약을 다시 쓰지 않았습니다 — 위 문장은 옛 코드 기준입니다." : "쉬운 말 요약과 예시는 AI가 코드를 읽고 씁니다. 칩·조정값·흐름은 코드에서 바로 뽑습니다.",
      }));
      band.append(button(explanation ? "요약 다시 쓰기" : "AI로 요약·예시 만들기", "script-card-explain", () => void explain(), { title: aiReady() ? undefined : "AI 연결이 필요합니다." }));
      cardPanel.append(band);
    }

    const chips = scriptChips(result?.effects ?? command.effects, project);
    const groups: [string, "read" | "write" | "call" | "dynamic"][] = [["읽는 것", "read"], ["바꾸는 것", "write"], ["부르는 것", "call"], ["검사기가 못 보는 것", "dynamic"]];
    for (const [label, access] of groups) {
      const row = chipRow(chips, access);
      if (row) cardPanel.append(sectionLabel(label), row);
    }

    if (scriptCompilerReady()) {
      const tunables = scriptTunables(command.source);
      if (tunables.length) {
        cardPanel.append(sectionLabel("조정값 — 여기서 바로 고친다"));
        renderTunables(cardPanel, tunables);
      }
    }

    const examples = explanation?.examples ?? [];
    cardPanel.append(sectionLabel("이렇게 된다 — 시험 실행 결과"));
    if (examples.length) renderExamples(cardPanel, command, examples);
    else cardPanel.append(styled(el("div", { text: "예시가 없습니다. 「AI로 요약·예시 만들기」를 누르면 상황을 만들고, 결과는 여기서 실제로 실행해 채웁니다." }), { "font-size": "12px", color: "var(--text-2)" }));

    const actions = styled(el("div", { class: "script-card-actions" }), { display: "flex", gap: "6px", "flex-wrap": "wrap", "margin-top": "10px", "align-items": "center" });
    actions.append(
      button("AI에게 고쳐 달라고 하기", "script-card-ask-ai", () => { aiInput.focus(); aiInput.scrollIntoView({ block: "nearest" }); }, { primary: true }),
      button("흐름 보기", "script-card-open-flow", () => switchTab("flow")),
      button("코드 보기", "script-card-open-code", () => switchTab("code")),
      unwrapButton(),
    );
    cardPanel.append(actions);
  };

  const renderFlow = (): void => {
    flowPanel.replaceChildren();
    if (!scriptCompilerReady()) {
      flowPanel.append(el("div", { text: "불러오는 중…" }));
      return;
    }
    const command = latest();
    const chips = scriptChips(result?.effects ?? command.effects, store.getCurrent());
    const pillar = styled(el("div", { class: "script-flow-pillar" }), {
      border: "1px solid var(--border-default)",
      "border-radius": "8px",
      padding: "6px 8px",
      background: "var(--bg-raised, #fffdf7)",
      "font-size": "12px",
    });
    for (const [label, access] of [["읽음", "read"], ["씀", "write"], ["부름", "call"], ["검사기 밖", "dynamic"]] as const) {
      const own = chips.filter((chip) => chip.access === access);
      if (!own.length) continue;
      pillar.append(sectionLabel(label));
      for (const chip of own) pillar.append(styled(el("div", { text: chip.label }), { padding: "1px 0" }));
    }
    const nodes = scriptFlow(command.source, store.getCurrent(), undefined, describePassthrough);
    const stats = scriptFlowStats(nodes);
    const main = styled(el("div"), { "min-width": "0" });
    main.append(
      styled(el("div", { text: `갈래는 코드에서 기계로 만듭니다 · 상자를 누르면 그 코드 줄로 · 회색 글씨 = 계산(코드로만 뜻을 안다): ${stats.code}칸 / 전체 ${stats.steps}칸` }), { "font-size": "11px", color: "var(--text-2)", "margin-bottom": "4px" }),
      renderScriptFlow(nodes, selectLine),
    );
    flowPanel.append(pillar, main);
  };

  const renderList = (): void => {
    listPanel.replaceChildren();
    const state = unwrapState();
    if (state.status !== "ok") {
      listPanel.append(styled(el("div", { text: state.reason }), { "font-size": "12px", color: "var(--text-2)" }));
      return;
    }
    listPanel.append(
      styled(el("div", { text: "읽기 전용 — 이 스크립트를 이벤트 명령으로 풀면 이렇게 됩니다. 동작은 같습니다." }), { "font-size": "12px", color: "var(--text-2)" }),
      renderReadonlyCommands(state.commands),
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
  const panels: Record<Tab, HTMLElement> = { card: cardPanel, flow: flowPanel, list: listPanel, code: codePanel };
  const tabLabel: Record<Tab, string> = { card: "요약", flow: "흐름", list: "명령 목록", code: "코드" };
  for (const tab of ["card", "flow", "list", "code"] as const) {
    const node = el("button", {
      text: tabLabel[tab],
      attrs: { type: "button", role: "tab" },
      dataset: { testid: `script-tab-${tab}` },
      on: { click: () => switchTab(tab) },
    }) as HTMLButtonElement;
    styled(node, { border: "0", background: "transparent", padding: "4px 12px", "border-radius": "6px", "font-size": "12px", cursor: "pointer" });
    tabButtons.set(tab, node);
    tabBar.append(node);
  }
  const syncListTab = (): void => {
    const node = tabButtons.get("list")!;
    const state = unwrapState();
    const enabled = state.status === "ok";
    node.disabled = !enabled;
    node.title = enabled ? "스크립트를 이벤트 명령 줄로 풀어 본 모습(읽기 전용)" : state.reason;
    node.style.opacity = enabled ? "1" : "0.45";
    if (!enabled && memory.tab === "list") memory.tab = "card";
  };
  function switchTab(tab: Tab): void {
    memory.tab = tab;
    for (const [key, node] of tabButtons) {
      const on = key === tab;
      node.setAttribute("aria-selected", String(on));
      node.style.background = on ? "var(--bg-raised, #fffdf7)" : "transparent";
      node.style.fontWeight = on ? "700" : "500";
      node.style.color = on ? "var(--accent, #4A57D6)" : "var(--text-1)";
    }
    // `hidden` loses to the inline display these panels need, so the display itself switches.
    for (const [key, panel] of Object.entries(panels) as [Tab, HTMLElement][]) {
      panel.hidden = key !== tab;
      panel.style.display = key !== tab ? "none" : key === "flow" ? "grid" : "flex";
    }
    if (tab === "flow") renderFlow();
    if (tab === "list") renderList();
  }

  function refresh(): void {
    showDiagnostics(result);
    syncListTab();
    renderCard();
    if (memory.tab === "flow") renderFlow();
    if (memory.tab === "list") renderList();
    switchTab(memory.tab);
  }

  // ── AI box ─────────────────────────────────────────────────────────────────
  const aiInput = el("textarea", {
    attrs: { rows: "2", placeholder: "예: 틀리면 원위치되기 전에 「삐걱」 효과음도 넣어 줘", "aria-label": "AI에게 고쳐 달라고 하기" },
    value: memory.aiDraft,
    dataset: { testid: "script-ai-input" },
  }) as HTMLTextAreaElement;
  styled(aiInput, { flex: "1", "min-width": "0", "box-sizing": "border-box", "font-size": "13px", padding: "6px 8px", resize: "vertical", height: "56px", "min-height": "40px" });
  aiInput.addEventListener("input", () => { memory.aiDraft = aiInput.value; });
  const aiStatus = styled(el("div", { class: "script-ai-status", dataset: { testid: "script-ai-status" }, attrs: { role: "status", "aria-live": "polite" } }), { "font-size": "12px", color: "var(--text-2)", "min-height": "16px" });
  const aiResult = styled(el("div", { class: "script-ai-result", dataset: { testid: "script-ai-result" } }), { display: "flex", "flex-direction": "column", gap: "6px" });
  let aiAbort: AbortController | undefined;

  const showProposal = (before: ScriptCommand, proposal: ScriptAssistResult): void => {
    aiResult.replaceChildren();
    const explanation: ScriptExplanation = { sourceHash: scriptSourceHash(proposal.source), lines: proposal.lines, ...(proposal.examples.length ? { examples: proposal.examples } : {}) };
    const next = scriptCommandFields(proposal.source, proposal.compile, name.value, explanation);
    const diff = lineDiff(before.source, proposal.source);
    const changed = diff.filter((line) => line.kind !== "same").length;
    aiResult.append(
      sectionLabel(changed ? `바뀐 코드 (${changed}줄)` : "코드는 그대로입니다"),
      ...(changed ? [renderLineDiff(diff)] : []),
      sectionLabel("바뀐 요약"),
      styled(el("div", { children: proposal.lines.map((line) => el("div", { text: line, attrs: { translate: "no" } })) }), {
        border: "1px solid var(--border-default)",
        "border-radius": "6px",
        padding: "6px 10px",
        background: "var(--bg-raised, #fffdf7)",
        "font-size": "13px",
      }),
    );
    if (proposal.examples.length) {
      aiResult.append(sectionLabel("예시 다시 실행 — 지금 코드 → 바뀐 코드"));
      const table = styled(el("table", { dataset: { testid: "script-ai-examples" } }), { width: "100%", "border-collapse": "collapse", "font-size": "12px" });
      table.append(el("tr", { children: ["상황", "지금", "바뀐 뒤"].map((text) => styled(el("th", { text }), { "text-align": "left", color: "var(--text-2)", padding: "3px 6px", "border-bottom": "1px solid var(--border-default)" })) }));
      const cells: [HTMLElement, HTMLElement][] = [];
      for (const example of proposal.examples) {
        const a = styled(el("td", { text: "…" }), { padding: "3px 6px", "border-bottom": "1px solid var(--border-subtle, #eee6d6)" });
        const b = styled(el("td", { text: "…" }), { padding: "3px 6px", "border-bottom": "1px solid var(--border-subtle, #eee6d6)" });
        cells.push([a, b]);
        table.append(el("tr", { children: [styled(el("td", { text: example.label }), { padding: "3px 6px", "white-space": "nowrap", "vertical-align": "top", "border-bottom": "1px solid var(--border-subtle, #eee6d6)" }), a, b] }));
      }
      aiResult.append(table);
      void preloadScriptEngine().then(() => {
        proposal.examples.forEach((example, index) => {
          const [a, b] = cells[index]!;
          const project = store.getCurrent();
          try { a.textContent = exampleOutcome(runExample(before, example), project); } catch (error) { a.textContent = String(error); }
          try { b.textContent = exampleOutcome(runExample(next, example), project); } catch (error) { b.textContent = String(error); }
          if (a.textContent !== b.textContent) b.style.fontWeight = "700";
        });
      }).catch(() => undefined);
    }
    const buttons = styled(el("div"), { display: "flex", gap: "6px" });
    buttons.append(
      button("적용", "script-ai-apply", () => {
        aiResult.replaceChildren();
        aiStatus.textContent = "적용했습니다. 되돌리려면 이 창의 「취소」 또는 편집기 되돌리기.";
        aiInput.value = "";
        memory.aiDraft = "";
        void commit(proposal.source, explanation);
      }, { primary: true }),
      button("버리기", "script-ai-discard", () => {
        aiResult.replaceChildren();
        aiStatus.textContent = "버렸습니다.";
      }),
    );
    aiResult.append(buttons);
    // The proposal lands under the fold of the card; bring the diff into view.
    aiResult.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const ask = async (mode: "edit" | "explain"): Promise<void> => {
    const text = aiInput.value.trim();
    if (mode === "edit" && !text) {
      aiStatus.textContent = "무엇을 바꿀지 적어 주세요.";
      aiInput.focus();
      return;
    }
    const config = loadAiConfig();
    if (!aiReady()) {
      aiStatus.textContent = "AI 연결이 필요합니다. 오른쪽 위 연결 설정에서 AI를 연결하세요.";
      return;
    }
    aiAbort?.abort();
    aiAbort = new AbortController();
    const before = latest();
    aiStatus.textContent = mode === "edit" ? "AI가 고치는 중…" : "AI가 요약을 쓰는 중…";
    aiResult.replaceChildren();
    try {
      const locale = getLocale();
      const proposal = await runScriptAssist({
        config,
        project: store.getCurrent(),
        ...(editorState.get().currentMapId ? { mapId: editorState.get().currentMapId! } : {}),
        source: before.source,
        request: text,
        mode,
        locale: locale === "en" || locale === "ja" || locale === "zh" ? locale : "ko",
        signal: aiAbort.signal,
      });
      if (mode === "explain") {
        aiStatus.textContent = "요약과 예시를 새로 썼습니다.";
        await commit(before.source, { sourceHash: scriptSourceHash(before.source), lines: proposal.lines, ...(proposal.examples.length ? { examples: proposal.examples } : {}) });
        return;
      }
      aiStatus.textContent = proposal.attempts > 1 ? `제안이 왔습니다 (컴파일 오류를 ${proposal.attempts - 1}번 고침). 확인하고 「적용」하세요.` : "제안이 왔습니다. 확인하고 「적용」하세요.";
      showProposal(before, proposal);
    } catch (error) {
      if (aiAbort.signal.aborted) return;
      aiStatus.textContent = `실패: ${error instanceof Error ? error.message : String(error)}`;
    }
  };
  const explain = (): Promise<void> => ask("explain");

  const aiBox = styled(el("div", { class: "script-ai-box", dataset: { testid: "script-ai-box" } }), {
    "margin-top": "12px",
    padding: "8px 10px",
    border: "1px solid var(--border-default, #d9d0bd)",
    "border-radius": "8px",
    background: "var(--bg-inset, #f4efe4)",
    display: "flex",
    "flex-direction": "column",
    gap: "6px",
  });
  const aiRow = styled(el("div"), { display: "flex", gap: "6px", "align-items": "flex-end" });
  aiRow.append(aiInput, button("보내기", "script-ai-send", () => void ask("edit"), { primary: true }));
  aiInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void ask("edit");
    }
  });
  aiBox.append(
    styled(el("div", { text: "AI에게 고쳐 달라고 하기 — 바뀐 코드·바뀐 요약·예시 결과를 보고 「적용」해야 바뀝니다." }), { "font-size": "12px", "font-weight": "700" }),
    aiRow,
    aiStatus,
    aiResult,
  );

  // ── assemble ───────────────────────────────────────────────────────────────
  styled(name, { flex: "1", "min-width": "0", "box-sizing": "border-box", "font-size": "13px", padding: "4px 8px" });
  const header = styled(el("div", { class: "script-card-header" }), { display: "flex", gap: "8px", "align-items": "center", "flex-wrap": "wrap" });
  header.append(name, statusPill, tabBar);
  const root = el("span", {
    class: "rich-command-form cream-command-form script-command-form",
    children: [header, cardPanel, flowPanel, listPanel, codePanel, aiBox],
  });
  styled(root, { display: "flex", "flex-direction": "column", "align-items": "stretch", gap: "8px", width: "100%", "grid-column": "1 / -1" });

  // The dialog title already names the command; the generic kind line above the form only pushed the card down
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
