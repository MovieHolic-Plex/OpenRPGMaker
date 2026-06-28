import { m2CommandById, type M2CommandFieldSpec } from "@/editor/eventCommands/m2Catalog";
import type { Command, M2CommandValue } from "@/project/types";
import { el } from "@/util/dom";
import { field as fieldRow } from "./dom";
import type { CommandEditContext } from "./types";

type M2Command = Extract<Command, { kind: "m2Command" }>;

export function renderM2CommandBody(context: CommandEditContext, cmd: Command): HTMLElement | undefined {
  if (cmd.kind !== "m2Command") return undefined;
  const entry = m2CommandById(cmd.commandId);
  const wrap = el("div", {
    class: "m2-command-body",
    dataset: { testid: `m2-command-body-${cmd.commandId}` },
  });

  if (!entry) {
    wrap.append(el("div", { class: "empty-hint", text: `알 수 없는 M2 명령: ${cmd.commandId}` }));
    return wrap;
  }

  wrap.append(
    el("div", {
      class: "empty-hint",
      text: `${entry.pdfTitle} · ${entry.supportStatus} · runtime: ${entry.runtimeClassification}`,
    })
  );

  if (entry.fields.length === 0) {
    wrap.append(el("div", { class: "empty-hint", text: "추가 설정 없음" }));
    return wrap;
  }

  for (const spec of entry.fields) {
    wrap.append(fieldRow(spec.label, controlForField(context, cmd, spec)));
  }
  return wrap;
}

function controlForField(context: CommandEditContext, cmd: M2Command, spec: M2CommandFieldSpec): HTMLElement {
  const value = cmd.fields[spec.key] ?? spec.defaultValue;
  if (spec.type === "textarea") return textareaControl(context, cmd, spec, String(value));
  if (spec.type === "number") return numberControl(context, cmd, spec, value);
  if (spec.type === "boolean") return booleanControl(context, cmd, spec, value);
  if (spec.type === "select") return selectControl(context, cmd, spec, String(value));
  return textControl(context, cmd, spec, String(value));
}

function textControl(context: CommandEditContext, cmd: M2Command, spec: M2CommandFieldSpec, value: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "text";
  input.value = value;
  input.dataset.testid = `m2-command-${spec.key}-input`;
  input.addEventListener("change", () => updateField(context, cmd, spec.key, input.value));
  return input;
}

function textareaControl(
  context: CommandEditContext,
  cmd: M2Command,
  spec: M2CommandFieldSpec,
  value: string
): HTMLTextAreaElement {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.dataset.testid = `m2-command-${spec.key}-textarea`;
  textarea.addEventListener("change", () => updateField(context, cmd, spec.key, textarea.value));
  return textarea;
}

function numberControl(
  context: CommandEditContext,
  cmd: M2Command,
  spec: M2CommandFieldSpec,
  value: M2CommandValue
): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "number";
  input.value = String(typeof value === "number" ? value : spec.defaultValue);
  input.dataset.testid = `m2-command-${spec.key}-input`;
  input.addEventListener("change", () => updateField(context, cmd, spec.key, parseNumber(input.value)));
  return input;
}

function booleanControl(
  context: CommandEditContext,
  cmd: M2Command,
  spec: M2CommandFieldSpec,
  value: M2CommandValue
): HTMLInputElement {
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = value === true || value === "true";
  checkbox.dataset.testid = `m2-command-${spec.key}-checkbox`;
  checkbox.addEventListener("change", () => updateField(context, cmd, spec.key, checkbox.checked));
  return checkbox;
}

function selectControl(
  context: CommandEditContext,
  cmd: M2Command,
  spec: M2CommandFieldSpec,
  value: string
): HTMLSelectElement {
  const select = document.createElement("select");
  select.dataset.testid = `m2-command-${spec.key}-select`;
  for (const option of spec.options ?? []) {
    const optionElement = document.createElement("option");
    optionElement.value = option.value;
    optionElement.textContent = option.label;
    select.append(optionElement);
  }
  select.value = value;
  select.addEventListener("change", () => updateField(context, cmd, spec.key, select.value));
  return select;
}

function updateField(context: CommandEditContext, cmd: M2Command, key: string, value: M2CommandValue): void {
  context.actions.replaceCommand(context.path, {
    ...cmd,
    fields: {
      ...cmd.fields,
      [key]: value,
    },
  });
}

function parseNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
