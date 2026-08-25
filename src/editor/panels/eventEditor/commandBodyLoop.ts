import { newCommand } from "@/editor/eventActions";
import { clearChildren, el } from "@/util/dom";
import { commandKindSelect, selectedOptionValue } from "./dom";
import { COMMAND_KIND_OPTIONS, commandKindLabel } from "./options";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "./types";

type LoopCommand = Extract<Command, { kind: "loop" }>;

export function loopBody(context: CommandEditContext, cmd: LoopCommand): HTMLElement {
  const wrap = el("div", {
    class: "loop-body-editor cream-command-form",
    attrs: { style: "border:1px solid var(--border);padding:4px;margin-top:4px;border-radius:3px;" },
    dataset: { testid: "event-loop-body" },
  });

  const getCurrentLoop = (): LoopCommand => {
    const current = context.getCurrentCommand?.() as LoopCommand | undefined;
    if (current?.kind === "loop") return current;
    return cmd;
  };

  const headerLabel = el("div", { class: "cream-command-form-head", text: `반복 · ${cmd.body.length}개 명령` });
  wrap.append(headerLabel);

  const working: Command[] = structuredClone(getCurrentLoop().body);
  const listEl = el("div", { class: "cmd-list", dataset: { testid: "event-loop-body-list" } });

  const emptyWarning = el("p", {
    class: "event-loop-empty-warning",
    text: "반복 내용이 비어 있습니다 — 아무 일도 일어나지 않습니다.",
    dataset: { testid: "event-loop-empty-warning" },
  });
  const noBreakWarning = el("p", {
    class: "event-loop-no-break-warning",
    text: "반복 탈출이 없습니다 — 무한 반복이 될 수 있습니다.",
    dataset: { testid: "event-loop-no-break-warning" },
  });

  const syncWarnings = (): void => {
    const currentBody = working;
    emptyWarning.hidden = currentBody.length > 0;
    const hasBreak = currentBody.some((entry) => entry.kind === "breakLoop")
      || walkHasBreak(currentBody);
    noBreakWarning.hidden = currentBody.length === 0 || hasBreak;
    headerLabel.textContent = `반복 내용 (${currentBody.length} 명령)`;
  };

  const commit = (): void => {
    const latest = getCurrentLoop();
    context.actions.replaceCommand(context.path, { ...latest, body: structuredClone(working) });
    syncWarnings();
  };

  const rerender = (): void => {
    clearChildren(listEl);
    if (working.length === 0) {
      listEl.append(
        el("div", { class: "event-loop-empty", text: "명령이 없습니다. 아래에서 추가하세요.", dataset: { testid: "event-loop-empty" } })
      );
      syncWarnings();
      return;
    }
    working.forEach((_, index) => {
      listEl.append(renderLoopItem(working, index, commit, rerender));
    });
    syncWarnings();
  };

  rerender();
  syncWarnings();
  wrap.append(emptyWarning, noBreakWarning, listEl, renderLoopAddRow(working, commit, rerender));
  return wrap;
}

function walkHasBreak(commands: readonly Command[]): boolean {
  for (const c of commands) {
    if (c.kind === "breakLoop") return true;
    if (c.kind === "loop" && walkHasBreak(c.body)) return true;
    if (c.kind === "fork" && (c.then.some((x) => walkHasBreak([x])) || (c.else?.some((x) => walkHasBreak([x])) ?? false))) return true;
  }
  return false;
}

function renderLoopItem(working: Command[], index: number, commit: () => void, rerender: () => void): HTMLElement {
  const command = working[index];
  const item = el("div", { class: "cmd-item", dataset: { testid: `event-loop-body-item-${index}` } });
  if (!command) return item;
  const badge = el("span", { class: "cmd-kind", text: commandKindLabel(command.kind) });
  if (command.kind === "breakLoop") {
    badge.textContent = `${commandKindLabel(command.kind)}  ↳ 이 반복 탈출`;
    badge.classList.add("cmd-kind-break");
  }
  item.append(badge);
  if (command.kind === "text") {
    const body = el("textarea", { dataset: { testid: `event-loop-body-text-${index}` } }) as HTMLTextAreaElement;
    body.value = command.body;
    body.addEventListener("change", () => {
      working[index] = { kind: "text", body: body.value };
      commit();
    });
    item.append(body);
  }
  if (command.kind === "breakLoop") {
    item.append(el("span", { class: "event-loop-break-badge", text: "↳ 가장 가까운 반복을 탈출", dataset: { testid: `event-loop-break-badge-${index}` } }));
  }
  item.append(
    el("button", {
      class: "btn danger",
      dataset: { testid: `event-loop-body-delete-${index}` },
      text: "×",
      on: {
        click: () => {
          const nextFocus = index > 0 ? index - 1 : 0;
          working.splice(index, 1);
          commit();
          rerender();
          const nextEl = document.querySelector(`[data-testid=\"event-loop-body-delete-${nextFocus}\"]`) as HTMLElement | null;
          nextEl?.focus();
        },
      },
    }),
  );
  return item;
}

function renderLoopAddRow(working: Command[], commit: () => void, rerender: () => void): HTMLElement {
  const addRow = el("div", { dataset: { testid: "event-loop-body-add-row" } });
  const sel = commandKindSelect("text");
  sel.dataset.testid = "event-loop-body-add-kind";
  addRow.append(
    sel,
    el("button", {
      class: "btn",
      dataset: { testid: "event-loop-body-add" },
      text: "+ 명령",
      on: {
        click: () => {
          working.push(newCommand(selectedOptionValue(sel, COMMAND_KIND_OPTIONS, "text")));
          commit();
          rerender();
        },
      },
    }),
  );
  return addRow;
}
