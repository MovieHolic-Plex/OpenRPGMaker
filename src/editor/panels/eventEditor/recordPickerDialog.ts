import { addSwitch, addVariable } from "@/editor/actions";
import { numberedName } from "@/editor/panels/databaseDisplay";
import { store } from "@/project/store";
import { clearChildren, el } from "@/util/dom";
import { openEventSubdialog } from "./subdialog";

type RecordPickerKind = "switch" | "variable";
type RecordDef = { readonly id: string; readonly name: string };

type RecordPickerRequest = {
  readonly kind: RecordPickerKind;
  readonly currentId: string;
  readonly onSelect: (id: string) => void;
};

const BLOCK_SIZE = 20;

export function openSwitchVariablePicker(request: RecordPickerRequest): void {
  openEventSubdialog({
    title: request.kind === "switch" ? "스위치 선택" : "변수 선택",
    testId: "event-record-picker",
    width: "narrow",
    render: (body, close) => renderRecordPicker(body, request, close),
  });
}

function renderRecordPicker(body: HTMLElement, request: RecordPickerRequest, close: () => void): void {
  let selectedId = request.currentId;
  let blockStart = blockStartFor(recordsFor(request.kind), selectedId);
  const recordsHost = el("div", { class: "event-record-picker-list", attrs: { role: "listbox" } });
  const blocksHost = el("div", { class: "event-record-picker-blocks" });
  const search = el("input", {
    attrs: { type: "search", placeholder: "이름 검색" },
    dataset: { testid: "event-record-picker-search" },
  }) as HTMLInputElement;

  const rerender = () => {
    const records = recordsFor(request.kind);
    clearChildren(blocksHost);
    clearChildren(recordsHost);
    renderBlocks(blocksHost, records, blockStart, (nextStart) => {
      blockStart = nextStart;
      rerender();
    });
    const visible = filteredBlock(records, blockStart, search.value);
    if (!visible.length) {
      recordsHost.append(el("div", { class: "empty-hint", text: "목록이 비어 있습니다." }));
    }
    visible.forEach((record, index) => {
      const absoluteIndex = records.findIndex((candidate) => candidate.id === record.id);
      recordsHost.append(recordButton(record, absoluteIndex >= 0 ? absoluteIndex : blockStart + index, selectedId, (id) => {
        selectedId = id;
        rerender();
      }));
    });
  };

  search.addEventListener("input", rerender);
  body.append(
    el("div", { class: "event-record-picker-toolbar", children: [search, createRecordButton(request.kind, rerender)] }),
    blocksHost,
    recordsHost,
    el("div", {
      class: "event-record-picker-footer",
      children: [
        el("button", {
          class: "btn",
          text: "확인",
          dataset: { testid: "event-record-picker-ok" },
          attrs: { type: "button" },
          on: {
            click: () => {
              if (selectedId) request.onSelect(selectedId);
              close();
            },
          },
        }),
        el("button", {
          class: "btn",
          text: "취소",
          attrs: { type: "button" },
          on: { click: close },
        }),
      ],
    })
  );
  rerender();
}

function recordsFor(kind: RecordPickerKind): readonly RecordDef[] {
  const project = store.getCurrent();
  return kind === "switch" ? project.switches : project.variables;
}

function blockStartFor(records: readonly RecordDef[], selectedId: string): number {
  const index = records.findIndex((record) => record.id === selectedId);
  return index >= 0 ? Math.floor(index / BLOCK_SIZE) * BLOCK_SIZE : 0;
}

function renderBlocks(host: HTMLElement, records: readonly RecordDef[], activeStart: number, onSelect: (start: number) => void): void {
  const blockCount = Math.max(1, Math.ceil(records.length / BLOCK_SIZE));
  for (let block = 0; block < blockCount; block += 1) {
    const start = block * BLOCK_SIZE;
    const end = Math.min(records.length, start + BLOCK_SIZE);
    host.append(el("button", {
      class: "btn small" + (start === activeStart ? " active" : ""),
      text: `${String(start + 1).padStart(4, "0")}-${String(Math.max(start + 1, end)).padStart(4, "0")}`,
      attrs: { type: "button" },
      on: { click: () => onSelect(start) },
    }));
  }
}

function filteredBlock(records: readonly RecordDef[], blockStart: number, query: string): readonly RecordDef[] {
  const block = records.slice(blockStart, blockStart + BLOCK_SIZE);
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return block;
  return block.filter((record) => record.name.toLocaleLowerCase().includes(normalized) || record.id.includes(normalized));
}

function recordButton(record: RecordDef, index: number, selectedId: string, onSelect: (id: string) => void): HTMLButtonElement {
  return el("button", {
    class: "event-record-picker-row" + (record.id === selectedId ? " selected" : ""),
    text: numberedName(index, record.name),
    attrs: { type: "button", role: "option", "aria-selected": record.id === selectedId ? "true" : "false" },
    dataset: { testid: `event-record-picker-row-${index + 1}` },
    on: { click: () => onSelect(record.id), dblclick: () => onSelect(record.id) },
  }) as HTMLButtonElement;
}

function createRecordButton(kind: RecordPickerKind, rerender: () => void): HTMLButtonElement {
  return el("button", {
    class: "btn",
    text: kind === "switch" ? "스위치 추가" : "변수 추가",
    dataset: { testid: "event-record-picker-add" },
    attrs: { type: "button" },
    on: {
      click: () => {
        if (kind === "switch") addSwitch("새 스위치");
        else addVariable("새 변수");
        rerender();
      },
    },
  }) as HTMLButtonElement;
}
