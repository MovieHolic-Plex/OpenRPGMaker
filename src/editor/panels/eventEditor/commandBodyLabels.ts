import { el } from "@/util/dom";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "./types";

type LabelCommand = Extract<Command, { kind: "label" | "gotoLabel" }>;

export function labelBody(context: CommandEditContext, cmd: LabelCommand): HTMLElement {
  const name = el("input", {
    attrs: { type: "text", placeholder: "라벨 이름" },
    value: cmd.name,
    dataset: { testid: cmd.kind === "label" ? "event-command-label-name" : "event-command-goto-label-name" },
  }) as HTMLInputElement;
  name.addEventListener("change", () => {
    context.actions.replaceCommand(context.path, { kind: cmd.kind, name: name.value });
  });
  return el("div", {
    class: "cream-command-form",
    children: [
      el("div", { class: "cream-command-form-head", text: cmd.kind === "label" ? "라벨" : "라벨로 이동" }),
      name,
    ],
  });
}
