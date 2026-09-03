import { clearChildren, el } from "@/util/dom";
import { renderEditorIcon } from "./editorIcons";
import type { Command } from "@/project/types";
import { commandKindLabel } from "./options";

export function renderEventEditorInline(
  host: HTMLElement,
  commands: Command[],
  onChange: (next: Command[]) => void
): void {
  clearChildren(host);
  const working: Command[] = structuredClone(commands);
  const rerender = () => {
    clearChildren(host);
    working.forEach((_, index) => {
      host.append(renderInlineItem(working, index, onChange, rerender));
    });
    host.append(
      el("button", {
        class: "btn",
        text: `+ ${commandKindLabel("text")}`,
        on: {
          click: () => {
            working.push({ kind: "text", body: "" });
            onChange(structuredClone(working));
            rerender();
          },
        },
      })
    );
  };
  rerender();
}

function renderInlineItem(
  working: Command[],
  index: number,
  onChange: (next: Command[]) => void,
  rerender: () => void
): HTMLElement {
  const cmd = working[index];
  const item = el("div", { class: "cmd-item" });
  if (!cmd) return item;
  item.append(
    el("span", { class: "cmd-kind-mark", attrs: { "aria-hidden": "true" } }),
    el("span", { class: "cmd-kind", text: commandKindLabel(cmd.kind) }),
    el("button", {
      class: "btn danger",
      children: [renderEditorIcon("trash")],
      attrs: { type: "button", title: "삭제", "aria-label": "삭제" },
      on: {
        click: () => {
          working.splice(index, 1);
          onChange(structuredClone(working));
          rerender();
        },
      },
    })
  );
  if (cmd.kind === "text") {
    const body = el("textarea", {}) as HTMLTextAreaElement;
    body.value = cmd.body;
    body.addEventListener("change", () => {
      working[index] = { kind: "text", body: body.value };
      onChange(structuredClone(working));
    });
    item.append(body);
  } else {
    item.append(el("div", { class: "empty-hint", text: "(상세 편집은 이벤트 에디터에서)" }));
  }
  return item;
}
