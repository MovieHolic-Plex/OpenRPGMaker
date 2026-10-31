// 「스크립트 (TypeScript)」 명령의 입력 폼 — 가벼운 코드 편집기(번들에 CodeMirror/Monaco 가 없다).
//
// - 입력하는 동안(잠깐 멈추면) 타입 검사 결과를 아래 목록에 보인다. 줄을 누르면 그 줄로 간다.
// - 칸을 벗어나면(change) 컴파일해 명령에 source·compiled·effects·summary 를 함께 쓴다 — 저장 = 컴파일.
//   컴파일러(typescript5)는 폼을 처음 열 때 받기 시작하므로 보통 이 시점엔 동기로 끝난다.
// - 「game API」 접이 목록이 쓸 수 있는 호출을 한국어 동사와 함께 보여 준다(비개발자용).
// 런타임·한도·API 정본은 openwiki/script-sandbox.md.
import { editorState } from "@/editor/editorState";
import { compileScript, prepareScriptCompiler, scriptCommandFields, scriptCompilerReady, type ScriptCompileResult } from "@/editor/script/compile";
import { SCRIPT_API, SCRIPT_API_GROUP_LABELS, type ScriptApiEntry } from "@/project/script/apiSpec";
import { store } from "@/project/store";
import type { Command } from "@/project/types";
import { el } from "@/util/dom";
import type { CommandEditContext } from "./types";

type ScriptCommand = Extract<Command, { kind: "script" }>;

const SEVERITY_LABEL = { error: "오류", warning: "경고", info: "참고" } as const;
const PLACEHOLDER = [
  "// 예: 레버 네 개가 정답 순서면 문이 열린다",
  'const order = ["lever_1", "lever_3", "lever_2", "lever_4"];',
  "if (order.every((id) => game.getSwitch(id))) {",
  '  game.setSwitch("door_open", true);',
  '  await game.showMessage("철컥 — 문이 열렸다.");',
  "}",
].join("\n");

function compileOptions(): { project: ReturnType<typeof store.getCurrent>; mapId: string | undefined } {
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

export function scriptCommandBody(context: CommandEditContext, cmd: ScriptCommand): HTMLElement {
  void prepareScriptCompiler().catch(() => undefined);
  const name = el("input", {
    attrs: { type: "text", placeholder: "이름 (예: 레버 퍼즐 판정)" },
    value: cmd.name ?? "",
    dataset: { testid: "script-name-input" },
  }) as HTMLInputElement;
  const source = el("textarea", {
    class: "script-editor-source",
    attrs: { spellcheck: "false", rows: "14", placeholder: PLACEHOLDER, translate: "no", autocapitalize: "off", autocomplete: "off" },
    value: cmd.source,
    dataset: { testid: "script-source-input" },
  }) as HTMLTextAreaElement;
  source.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  source.style.width = "100%";
  source.style.tabSize = "2";
  const status = el("div", { class: "script-compile-status", dataset: { testid: "script-compile-status" } });
  const problems = el("ul", { class: "script-diagnostics", dataset: { testid: "script-diagnostics" } });

  const showResult = (result: ScriptCompileResult | undefined, pending = false): void => {
    problems.replaceChildren();
    if (pending) {
      status.textContent = "검사 중…";
      return;
    }
    if (!result) {
      status.textContent = cmd.summary ? `요약: ${cmd.summary}` : "아직 검사하지 않았습니다.";
      return;
    }
    const errors = result.diagnostics.filter((entry) => entry.severity === "error").length;
    const warnings = result.diagnostics.filter((entry) => entry.severity === "warning").length;
    status.textContent = errors
      ? `오류 ${errors}개 · 경고 ${warnings}개 — 고치기 전에는 게임에서 오류 대사가 납니다.`
      : warnings
        ? `경고 ${warnings}개 — 실행은 됩니다.`
        : result.summary
          ? `문제 없음 — ${result.summary}`
          : "문제 없음";
    status.dataset.state = errors ? "error" : warnings ? "warning" : "ok";
    for (const entry of result.diagnostics.slice(0, 40)) {
      const item = el("li", {
        class: `script-diagnostic script-diagnostic-${entry.severity}`,
        children: [
          el("span", { class: "script-diagnostic-severity", text: SEVERITY_LABEL[entry.severity] }),
          el("span", { attrs: { translate: "no" }, text: ` ${entry.line}:${entry.column} ${entry.message}` }),
        ],
      });
      item.addEventListener("click", () => {
        const lines = source.value.split("\n");
        const start = lines.slice(0, entry.line - 1).reduce((sum, line) => sum + line.length + 1, 0) + Math.max(0, entry.column - 1);
        source.focus();
        source.setSelectionRange(start, start + (lines[entry.line - 1]?.length ?? 0) - Math.max(0, entry.column - 1));
      });
      problems.append(item);
    }
  };

  const check = (): ScriptCompileResult | undefined => (scriptCompilerReady() ? compileScript(source.value, compileOptions()) : undefined);

  const commit = async (): Promise<void> => {
    // Always after the change event returns: the form never re-renders mid-event (same timing whether or not
    // the compiler is already loaded).
    await Promise.resolve();
    const text = source.value;
    const label = name.value;
    if (!scriptCompilerReady()) {
      showResult(undefined, true);
      await prepareScriptCompiler();
    }
    const result = compileScript(text, compileOptions());
    showResult(result);
    if (source.value !== text) return; // typed again meanwhile; the next change commits
    context.actions.replaceCommand(context.path, scriptCommandFields(text, result, label));
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  source.addEventListener("input", () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => showResult(check()), 600);
  });
  source.addEventListener("keydown", (event) => {
    if (event.key !== "Tab" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const start = source.selectionStart;
    source.setRangeText("  ", start, source.selectionEnd, "end");
    source.dispatchEvent(new Event("input"));
  });
  source.addEventListener("change", () => void commit());
  name.addEventListener("change", () => void commit());

  showResult(undefined);
  if (cmd.source.trim()) {
    void prepareScriptCompiler().then(() => showResult(check())).catch(() => undefined);
  }

  // One column, full width (2026-10-31 live capture: the shared rich-form grid squeezed the code into a ~240px
  // column next to the name). Inline styles, not a stylesheet rule — the editor's late sheets win the cascade.
  const row = (...children: (HTMLElement | string)[]): HTMLElement => {
    const node = el("span", { class: "rich-form-row", children });
    node.style.display = "block";
    node.style.width = "100%";
    return node;
  };
  source.style.minHeight = "320px";
  source.style.boxSizing = "border-box";
  source.style.fontSize = "13px";
  source.style.lineHeight = "1.5";
  source.style.whiteSpace = "pre";
  source.style.overflow = "auto";
  name.style.width = "100%";
  name.style.boxSizing = "border-box";
  const root = el("span", {
    class: "rich-command-form cream-command-form script-command-form",
    children: [
      row(name),
      row(source),
      row(status),
      row(problems),
      row(apiReference()),
      el("span", {
        class: "empty-hint",
        text: "TypeScript 로 이벤트 로직을 씁니다. await 가 붙은 호출(대사·선택지·전투…)은 이벤트 명령처럼 차례로 실행됩니다. 지역 변수는 세이브되지 않으니 남길 값은 스위치·변수에 두세요.",
        dataset: { testid: "script-help" },
      }),
    ],
  });
  root.style.display = "flex";
  root.style.flexDirection = "column";
  root.style.alignItems = "stretch";
  root.style.gap = "8px";
  root.style.width = "100%";
  root.style.gridColumn = "1 / -1";
  return root;
}
