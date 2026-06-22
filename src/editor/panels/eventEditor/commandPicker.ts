import { newCommand } from "@/editor/eventActions";
import type { Command } from "@/project/types";
import { el } from "@/util/dom";
import { COMMAND_KIND_OPTIONS } from "./options";
import { openEventSubdialog } from "./subdialog";

type CommandKind = Command["kind"];

type CommandGroup = {
  readonly title: string;
  readonly kinds: readonly CommandKind[];
};

const COMMAND_GROUPS = [
  { title: "Message", kinds: ["text", "choices", "inputWait", "wait"] },
  { title: "Flow", kinds: ["fork", "label", "gotoLabel", "callCommonEvent"] },
  { title: "State", kinds: ["setSwitch", "setVariable", "timer", "setFlag"] },
  { title: "Map", kinds: ["transfer", "moveEvent", "changeTile", "showPicture", "erasePicture"] },
  { title: "Audio", kinds: ["playAudio", "stopAudio"] },
  { title: "Scene", kinds: ["battleProcessing", "shop", "inn", "learnSkill", "gameOver", "returnToTitle"] },
] as const satisfies readonly CommandGroup[];

type EventCommandPickerRequest = {
  readonly title: string;
  readonly onSelect: (command: Command) => void;
};

export function openEventCommandPicker(request: EventCommandPickerRequest): void {
  openEventSubdialog({
    title: request.title,
    subtitle: "Insert an event command into the current page.",
    testId: "event-command-picker",
    width: "wide",
    render: (body, close) => {
      const grid = el("div", { class: "event-command-picker-grid" });
      for (const group of COMMAND_GROUPS) {
        grid.append(renderGroup(group, request.onSelect, close));
      }
      body.append(grid);
    },
  });
}

function renderGroup(group: CommandGroup, onSelect: (command: Command) => void, close: () => void): HTMLElement {
  const section = el("section", { class: "event-command-picker-group" });
  section.append(el("h4", { text: group.title }));
  const buttons = el("div", { class: "event-command-picker-buttons" });
  for (const kind of group.kinds) {
    buttons.append(
      el("button", {
        class: "btn",
        text: commandLabel(kind),
        dataset: { testid: `command-picker-add-${kind}` },
        on: {
          click: () => {
            onSelect(newCommand(kind));
            close();
          },
        },
      })
    );
  }
  section.append(buttons);
  return section;
}

export function commandLabel(kind: CommandKind): string {
  return COMMAND_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}
