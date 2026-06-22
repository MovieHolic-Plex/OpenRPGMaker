import { el } from "@/util/dom";
import { selectedOptionValue, selectWithOptions } from "./dom";
import { choicesBody } from "./commandBodyChoices";
import { databasePicker, conditionForm } from "./conditionForm";
import { renderForkBranch } from "./forkBranch";
import {
  BOOLEAN_OPTIONS,
  TIMER_ACTION_OPTIONS,
  VARIABLE_OP_OPTIONS,
} from "./options";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "./types";

export function renderCoreCommandBody(
  context: CommandEditContext,
  cmd: Command
): HTMLElement | undefined {
  switch (cmd.kind) {
    case "text":
      return textBody(context, cmd);
    case "choices":
      return choicesBody(context, cmd);
    case "setFlag":
      return setFlagBody(context, cmd);
    case "fork":
      return forkBody(context, cmd);
    case "setSwitch":
      return setSwitchBody(context, cmd);
    case "setVariable":
      return setVariableBody(context, cmd);
    case "timer":
      return timerBody(context, cmd);
    case "inputWait":
      return el("div", { class: "empty-hint", text: "아무 입력 대기" });
    case "label":
    case "gotoLabel":
      return labelBody(context, cmd);
    default:
      return undefined;
  }
}

function textBody(context: CommandEditContext, cmd: Extract<Command, { kind: "text" }>): HTMLElement {
  const wrap = el("span", {});
  const speaker = el("input", {
    attrs: { type: "text", placeholder: "화자" },
    value: cmd.speaker ?? "",
  }) as HTMLInputElement;
  const body = el("textarea", { attrs: { placeholder: "대화 내용" } }) as HTMLTextAreaElement;
  body.value = cmd.body;
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "text",
      speaker: speaker.value.trim() || undefined,
      body: body.value,
    });
  };
  speaker.addEventListener("change", apply);
  body.addEventListener("change", apply);
  wrap.append(speaker, body);
  return wrap;
}

function setFlagBody(context: CommandEditContext, cmd: Extract<Command, { kind: "setFlag" }>): HTMLElement {
  const wrap = el("span", {});
  const flag = el("input", {
    attrs: { type: "text", placeholder: "플래그 이름" },
    value: cmd.flag,
  }) as HTMLInputElement;
  const val = selectWithOptions(BOOLEAN_OPTIONS, String(cmd.value));
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "setFlag",
      flag: flag.value.trim() || "flag1",
      value: val.value === "true",
    });
  };
  flag.addEventListener("change", apply);
  val.addEventListener("change", apply);
  wrap.append(flag, val);
  return wrap;
}

function forkBody(context: CommandEditContext, cmd: Extract<Command, { kind: "fork" }>): HTMLElement {
  const wrap = el("div", {});
  wrap.append(conditionForm(cmd.condition, (condition) => {
    context.actions.replaceCommand(context.path, { ...cmd, condition });
  }));
  wrap.append(renderForkBranch(context.path, context.actions, cmd, "then", cmd.then));
  if (cmd.else) {
    wrap.append(renderForkBranch(context.path, context.actions, cmd, "else", cmd.else));
  } else {
    wrap.append(el("button", {
      class: "btn",
      text: "+ else 추가",
      on: { click: () => context.actions.replaceCommand(context.path, { ...cmd, else: [] }) },
    }));
  }
  return wrap;
}

function setSwitchBody(context: CommandEditContext, cmd: Extract<Command, { kind: "setSwitch" }>): HTMLElement {
  const wrap = el("span", {});
  const swSel = databasePicker("switch", cmd.switchId, (switchId) => {
    context.actions.replaceCommand(context.path, { ...cmd, switchId });
  });
  const val = selectWithOptions(BOOLEAN_OPTIONS, String(cmd.value));
  val.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, { ...cmd, value: val.value === "true" });
  });
  wrap.append(swSel, val);
  return wrap;
}

function setVariableBody(context: CommandEditContext, cmd: Extract<Command, { kind: "setVariable" }>): HTMLElement {
  const wrap = el("span", {});
  const varSel = databasePicker("variable", cmd.variableId, (variableId) => {
    context.actions.replaceCommand(context.path, { ...cmd, variableId });
  });
  const op = selectWithOptions(VARIABLE_OP_OPTIONS, cmd.op);
  const value = el("input", {
    attrs: { type: "number" },
    value: String(typeof cmd.value === "number" ? cmd.value : 0),
  }) as HTMLInputElement;
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "setVariable",
      variableId: cmd.variableId,
      op: selectedOptionValue(op, VARIABLE_OP_OPTIONS, cmd.op),
      value: parseInt(value.value, 10) || 0,
    });
  };
  op.addEventListener("change", apply);
  value.addEventListener("change", apply);
  wrap.append(varSel, op, value);
  return wrap;
}

function timerBody(context: CommandEditContext, cmd: Extract<Command, { kind: "timer" }>): HTMLElement {
  const wrap = el("span", {});
  const action = selectWithOptions(TIMER_ACTION_OPTIONS, cmd.action);
  const secs = el("input", {
    attrs: { type: "number", min: "0", placeholder: "초" },
    value: String(cmd.seconds ?? 60),
  }) as HTMLInputElement;
  const apply = () => {
    context.actions.replaceCommand(context.path, {
      kind: "timer",
      action: selectedOptionValue(action, TIMER_ACTION_OPTIONS, cmd.action),
      seconds: parseInt(secs.value, 10) || 0,
    });
  };
  action.addEventListener("change", apply);
  secs.addEventListener("change", apply);
  wrap.append(action, secs);
  return wrap;
}

function labelBody(
  context: CommandEditContext,
  cmd: Extract<Command, { kind: "label" | "gotoLabel" }>
): HTMLElement {
  const name = el("input", {
    attrs: { type: "text", placeholder: "라벨 이름" },
    value: cmd.name,
  }) as HTMLInputElement;
  name.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, { kind: cmd.kind, name: name.value });
  });
  return name;
}
