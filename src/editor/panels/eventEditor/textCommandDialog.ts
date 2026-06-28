import type { Command } from "@/project/types";
import { el } from "@/util/dom";
import { openEventSubdialog } from "./subdialog";

type TextCommand = Extract<Command, { kind: "text" }>;

type TextValidation = {
  readonly isValid: boolean;
  readonly lineCount: number;
  readonly longestLine: number;
  readonly reasons: readonly string[];
};

const MAX_MESSAGE_LINES = 4;
const FACELESS_LINE_LIMIT = 50;
const FACE_LINE_LIMIT = 38;

const CONTROL_CHARACTER_ROWS: readonly { readonly code: string; readonly label: string }[] = [
  { code: "\\\\", label: "\\ 문자 표시" },
  { code: "\\c[n]", label: "n번 색상으로 이후 문장 표시" },
  { code: "\\s[n]", label: "문장 표시 속도 1-20 지정" },
  { code: "\\n[n]", label: "n번 주인공 이름 표시" },
  { code: "\\v[n]", label: "n번 변수 값 표시" },
  { code: "\\$", label: "소지금 창 표시" },
  { code: "\\!", label: "키 입력 전까지 문장 표시 일시 정지" },
  { code: "\\.", label: "1/4초 지연" },
  { code: "\\|", label: "1초 지연" },
  { code: "\\> ... \\<", label: "사이 문장을 즉시 표시" },
  { code: "\\^", label: "키 입력 대기 없이 닫기" },
  { code: "\\_", label: "반각 공백 표시" },
] as const;

export function openTextCommandDialog(initial: TextCommand, onApply: (command: TextCommand) => void): void {
  openEventSubdialog({
    title: "문장 표시",
    testId: "event-command-text-dialog",
    width: "wide",
    render: (body, close) => {
      const form = document.createElement("form");
      form.className = "event-command-text-dialog";
      form.dataset.testid = "event-command-text-form";

      const speaker = document.createElement("input");
      speaker.type = "text";
      speaker.placeholder = "화자";
      speaker.value = initial.speaker ?? "";
      speaker.dataset.testid = "event-command-text-speaker";

      const text = document.createElement("textarea");
      text.placeholder = "대화 내용";
      text.value = initial.body;
      text.rows = MAX_MESSAGE_LINES;
      text.dataset.testid = "event-command-text-body";

      const lineGuide = el("div", {
        class: "event-command-text-line-guide",
        text: `한 창은 최대 ${MAX_MESSAGE_LINES}줄, 줄당 ${FACELESS_LINE_LIMIT}자(얼굴 표시 시 ${FACE_LINE_LIMIT}자)`,
        dataset: { testid: "event-command-text-line-guide" },
      });
      const lineCount = el("div", {
        class: "event-command-text-line-count",
        dataset: { testid: "event-command-text-line-count" },
      });
      const helpPanel = controlCharacterHelp();

      const ok = document.createElement("button");
      ok.type = "submit";
      ok.className = "event-command-text-action primary";
      ok.textContent = "OK";
      ok.dataset.testid = "event-command-text-ok";

      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "event-command-text-action";
      cancel.textContent = "Cancel";
      cancel.dataset.testid = "event-command-text-cancel";
      cancel.addEventListener("click", close);

      const help = document.createElement("button");
      help.type = "button";
      help.className = "event-command-text-action";
      help.textContent = "Help";
      help.dataset.testid = "event-command-text-help";
      help.addEventListener("click", () => {
        helpPanel.toggleAttribute("hidden");
      });

      const updateValidation = () => {
        const validation = validateText(text.value);
        ok.disabled = !validation.isValid;
        lineCount.textContent = validation.isValid
          ? `${validation.lineCount}/${MAX_MESSAGE_LINES}줄, 최장 ${validation.longestLine}/${FACELESS_LINE_LIMIT}자`
          : validation.reasons.join(" / ");
        lineCount.classList.toggle("invalid", !validation.isValid);
      };

      text.addEventListener("input", updateValidation);
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const validation = validateText(text.value);
        if (!validation.isValid) {
          updateValidation();
          return;
        }
        onApply({
          kind: "text",
          speaker: speaker.value.trim() || undefined,
          body: text.value,
        });
        close();
      });

      form.append(
        el("label", {
          class: "event-command-text-label",
          children: [el("span", { text: "화자" }), speaker],
        }),
        el("label", {
          class: "event-command-text-label event-command-text-body-label",
          children: [el("span", { text: "내용" }), text],
        }),
        lineGuide,
        lineCount,
        helpPanel,
        el("div", {
          class: "event-command-text-actions",
          children: [ok, cancel, help],
        })
      );
      body.append(form);
      updateValidation();
      text.focus();
    },
  });
}

function validateText(value: string): TextValidation {
  const lines = value.split(/\r?\n/);
  const longestLine = lines.reduce((longest, line) => Math.max(longest, characterCount(line)), 0);
  const reasons: string[] = [];
  if (lines.length > MAX_MESSAGE_LINES) {
    reasons.push(`최대 ${MAX_MESSAGE_LINES}줄까지만 입력할 수 있습니다`);
  }
  if (longestLine > FACELESS_LINE_LIMIT) {
    reasons.push(`줄당 ${FACELESS_LINE_LIMIT}자를 넘을 수 없습니다`);
  }
  return {
    isValid: reasons.length === 0,
    lineCount: lines.length,
    longestLine,
    reasons,
  };
}

function characterCount(value: string): number {
  return Array.from(value).length;
}

function controlCharacterHelp(): HTMLElement {
  const panel = el("div", {
    class: "event-command-text-help-panel",
    attrs: { hidden: "" },
    dataset: { testid: "event-command-text-control-help" },
  });
  const list = el("dl", { class: "event-command-text-control-list" });
  for (const row of CONTROL_CHARACTER_ROWS) {
    list.append(el("dt", { text: row.code }), el("dd", { text: row.label }));
  }
  panel.append(el("div", { class: "event-command-text-help-title", text: "제어 문자" }), list);
  return panel;
}
