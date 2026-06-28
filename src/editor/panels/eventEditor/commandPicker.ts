import { newCommand, newM2Command } from "@/editor/eventActions";
import {
  isM2CatalogEntrySelectableInMap,
  M2_COMMAND_CATALOG,
  type M2CommandCatalogEntry,
  type M2CommandPickerPage,
} from "@/editor/eventCommands/m2Catalog";
import type { Command } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { openEventSubdialog } from "./subdialog";

type CommandKind = Command["kind"];

type CommandEntry = {
  readonly label: string;
  readonly kind?: CommandKind;
  readonly commandId: string;
  readonly testId: string;
  readonly selectable: boolean;
};

type CommandPage = {
  readonly page: M2CommandPickerPage;
  readonly entries: readonly CommandEntry[];
};

const PICKER_PAGES: readonly M2CommandPickerPage[] = [1, 2, 3, 4];

const COMMAND_PAGES: readonly CommandPage[] = PICKER_PAGES.map((page) => ({
  page,
  entries: M2_COMMAND_CATALOG.filter((entry) => entry.pickerPage === page).map(commandEntryFromCatalog),
}));

function commandEntryFromCatalog(entry: M2CommandCatalogEntry): CommandEntry {
  return {
    label: entry.pickerLabel,
    kind: entry.existingKind,
    commandId: entry.id,
    testId: entry.existingKind ? `command-picker-add-${entry.existingKind}` : entry.testId,
    selectable: isM2CatalogEntrySelectableInMap(entry),
  };
}

type EventCommandPickerRequest = {
  readonly title: string;
  readonly onSelect: (command: Command, closePicker: () => void) => EventCommandPickerSelectResult;
};

type EventCommandPickerSelectResult = { readonly closePicker: false } | void;

export function openEventCommandPicker(request: EventCommandPickerRequest): void {
  openEventSubdialog({
    title: request.title,
    testId: "event-command-picker",
    width: "narrow",
    render: (body, close) => {
      let activePage: CommandPage["page"] = 1;
      const tabs = el("div", { class: "event-command-picker-tabs", attrs: { role: "tablist" } });
      const commandArea = el("div", { class: "event-command-picker-panel" });
      const renderActivePage = () => {
        clearChildren(commandArea);
        for (const button of tabs.querySelectorAll<HTMLButtonElement>("button")) {
          button.setAttribute("aria-selected", button.dataset.page === String(activePage) ? "true" : "false");
        }
        const page = COMMAND_PAGES.find((candidate) => candidate.page === activePage) ?? COMMAND_PAGES[0];
        commandArea.append(renderCommandGrid(page, request.onSelect, close));
      };
      for (const page of COMMAND_PAGES) {
        tabs.append(
          el("button", {
            class: "event-command-picker-tab",
            text: String(page.page),
            attrs: { type: "button", role: "tab", "aria-selected": page.page === activePage ? "true" : "false" },
            dataset: { testid: `event-command-picker-tab-${page.page}`, page: String(page.page) },
            on: {
              click: () => {
                activePage = page.page;
                renderActivePage();
              },
            },
          })
        );
      }
      body.append(tabs, commandArea, renderFooter(close));
      renderActivePage();
    },
  });
}

function renderCommandGrid(page: CommandPage, onSelect: EventCommandPickerRequest["onSelect"], close: () => void): HTMLElement {
  const grid = el("div", {
    class: page.page === 4 ? "event-command-picker-grid single-column" : "event-command-picker-grid",
  });
  for (const entry of page.entries) {
    const button = el("button", {
      class: entry.selectable ? "event-command-picker-command" : "event-command-picker-command disabled",
      text: entry.label,
      attrs: { type: "button" },
    });
    button.dataset.testid = entry.testId;
    if (entry.selectable) {
      button.addEventListener("click", () => {
        const result = onSelect(createCommandFromEntry(entry), close);
        if (!result || result.closePicker !== false) close();
      });
    } else {
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    }
    grid.append(button);
  }
  return grid;
}

function createCommandFromEntry(entry: CommandEntry): Command {
  return entry.kind ? newCommand(entry.kind) : newM2Command(entry.commandId);
}

function renderFooter(close: () => void): HTMLElement {
  return el("div", {
    class: "event-command-picker-footer",
    children: [
      el("button", {
        class: "event-command-picker-cancel",
        text: "취소",
        attrs: { type: "button" },
        dataset: { testid: "event-command-picker-cancel" },
        on: { click: close },
      }),
    ],
  });
}

export function commandLabel(kind: CommandKind): string {
  return M2_COMMAND_CATALOG.find((entry) => entry.existingKind === kind)?.label ?? kind;
}
