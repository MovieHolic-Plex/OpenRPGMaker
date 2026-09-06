import { newCommand } from "@/editor/eventActions";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { openEventCommandEditDialog } from "./commandEditDialog";
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

  let draft = cmd;
  const getCurrentLoop = (): LoopCommand => {
    const current = context.getCurrentCommand?.();
    if (current?.kind === "loop") return current;
    return draft;
  };

  const headerLabel = el("div", { class: "cream-command-form-head", text: `반복 · ${cmd.body.length}개 명령` });
  wrap.append(headerLabel);

  const getBody = (): Command[] => structuredClone(getCurrentLoop().body);
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
    const currentBody = getBody();
    emptyWarning.hidden = currentBody.length > 0;
    const hasBreak = currentBody.some((entry) => entry.kind === "breakLoop")
      || walkHasBreak(currentBody);
    noBreakWarning.hidden = currentBody.length === 0 || hasBreak;
    headerLabel.textContent = `반복 내용 (${currentBody.length} 명령)`;
  };

  const commit = (body: Command[]): void => {
    draft = { ...getCurrentLoop(), body };
    context.actions.replaceCommand(context.path, draft);
    syncWarnings();
  };

  const rerender = (): void => {
    clearChildren(listEl);
    const working = getBody();
    if (working.length === 0) {
      listEl.append(
        el("div", { class: "event-loop-empty", text: "명령이 없습니다. 아래에서 추가하세요.", dataset: { testid: "event-loop-empty" } })
      );
      syncWarnings();
      return;
    }
    working.forEach((_, index) => {
      listEl.append(renderLoopItem(getBody, index, commit, rerender, context));
    });
    syncWarnings();
  };

  rerender();
  syncWarnings();
  wrap.append(emptyWarning, noBreakWarning, listEl, renderLoopAddRow(getBody, commit, rerender));
  return wrap;
}

function walkHasBreak(commands: readonly Command[]): boolean {
  for (const c of commands) {
    if (c.kind === "breakLoop") return true;
    if (c.kind !== "loop" && eventCommandBranches(c).some(({ commands }) => walkHasBreak(commands))) return true;
  }
  return false;
}

function renderLoopItem(getBody: () => Command[], index: number, commit: (body: Command[]) => void, rerender: () => void, context: CommandEditContext): HTMLElement {
  const command = getBody()[index];
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
      const working = getBody();
      const current = working[index];
      if (current?.kind !== "text") return;
      working[index] = { ...current, body: body.value };
      commit(working);
    });
    item.append(body);
  }
  item.append(el("button", {
    class: "btn", text: "편집", attrs: { type: "button" },
    dataset: { testid: `event-loop-body-edit-${index}` },
    on: { click: () => openEventCommandEditDialog({
      initial: getBody()[index]!,
      previewFace: context.previewFace,
      onApply: (edited) => {
        const working = getBody();
        working[index] = edited;
        commit(working);
        rerender();
      },
    }) },
  }));
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
          const working = getBody();
          working.splice(index, 1);
          commit(working);
          rerender();
          const nextEl = document.querySelector(`[data-testid=\"event-loop-body-delete-${nextFocus}\"]`) as HTMLElement | null;
          nextEl?.focus();
        },
      },
    }),
  );
  return item;
}

function renderLoopAddRow(getBody: () => Command[], commit: (body: Command[]) => void, rerender: () => void): HTMLElement {
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
          const working = getBody();
          working.push(newCommand(selectedOptionValue(sel, COMMAND_KIND_OPTIONS, "text")));
          commit(working);
          rerender();
        },
      },
    }),
  );
  return addRow;
}
