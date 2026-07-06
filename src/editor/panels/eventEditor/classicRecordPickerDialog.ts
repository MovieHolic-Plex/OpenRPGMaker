import { ordinalLabel } from "@/editor/panels/databaseDisplay";
import { clearChildren, el } from "@/util/dom";
import { openEventSubdialog } from "./subdialog";

export type ClassicRecordDef = {
  readonly id: string;
  readonly name: string;
};

export type ClassicRecordPickerRequest = {
  readonly addRecord: () => string;
  readonly currentId: string;
  readonly emptyText: string;
  readonly headerLabel: string;
  readonly records: () => readonly ClassicRecordDef[];
  readonly renameRecord: (id: string, name: string) => void;
  readonly testId: string;
  readonly title: string;
  readonly onSelect: (id: string) => void;
};

type PickerState = {
  blockStart: number;
  draftName: string;
  selectedId: string;
  // [높음-3] 이름/번호 인크리멘털 검색 질의. 비어 있으면 기존 범위(블록) 내비게이션.
  query: string;
};

type PickerHosts = {
  readonly applyButton: HTMLButtonElement;
  readonly blocks: HTMLElement;
  readonly nameInput: HTMLInputElement;
  readonly ordinal: HTMLElement;
  readonly records: HTMLElement;
  readonly searchInput: HTMLInputElement;
};

const BLOCK_SIZE = 20;

export function openClassicRecordPicker(request: ClassicRecordPickerRequest): void {
  openEventSubdialog({
    title: request.title,
    testId: request.testId,
    width: "narrow",
    render: (body, close) => renderClassicRecordPicker({ body, close, request }),
  });
}

function renderClassicRecordPicker(options: {
  readonly body: HTMLElement;
  readonly close: () => void;
  readonly request: ClassicRecordPickerRequest;
}): void {
  const records = options.request.records();
  const initialId = selectedRecordId(records, options.request.currentId);
  const state: PickerState = {
    blockStart: blockStartFor(records, initialId),
    draftName: recordName(records, initialId),
    selectedId: initialId,
    query: "",
  };
  const nameInput = el("input", {
    attrs: { type: "text", "aria-label": "이름" },
    dataset: { testid: "event-record-picker-name" },
  });
  const searchInput = el("input", {
    class: "event-record-picker-search",
    attrs: { type: "search", placeholder: "이름/번호 검색", "aria-label": "레코드 검색" },
    dataset: { testid: "event-record-picker-search" },
  }) as HTMLInputElement;
  const applyButton = footerButton({
    label: "적용",
    testId: "event-record-picker-apply",
    onClick: () => {
      applyDraftName(options.request, state);
      render(hosts, options.request, state);
    },
  });
  const hosts: PickerHosts = {
    applyButton,
    blocks: el("div", { class: "event-record-picker-blocks", attrs: { role: "listbox", "aria-label": "범위" } }),
    nameInput,
    ordinal: el("span", { class: "event-record-picker-name-id" }),
    records: el("div", { class: "event-record-picker-list", attrs: { role: "listbox", "aria-label": options.request.headerLabel } }),
    searchInput,
  };

  nameInput.addEventListener("input", () => {
    state.draftName = nameInput.value;
    updateApplyButton(hosts.applyButton, options.request, state);
  });
  searchInput.addEventListener("input", () => {
    state.query = searchInput.value;
    render(hosts, options.request, state);
  });
  options.body.append(recordPickerShell({
    applyButton,
    close: options.close,
    headerLabel: options.request.headerLabel,
    hosts,
    request: options.request,
    state,
  }));
  render(hosts, options.request, state);
}

function recordPickerShell(options: {
  readonly applyButton: HTMLButtonElement;
  readonly close: () => void;
  readonly headerLabel: string;
  readonly hosts: PickerHosts;
  readonly request: ClassicRecordPickerRequest;
  readonly state: PickerState;
}): HTMLElement {
  return el("div", {
    class: "event-record-picker classic",
    children: [
      el("div", {
        class: "event-record-picker-frame",
        children: [
          el("section", {
            class: "event-record-picker-range-pane",
            children: [
              el("div", { class: "event-record-picker-heading", text: options.headerLabel }),
              options.hosts.blocks,
              el("button", {
                class: "btn event-record-picker-max",
                text: "최대 수",
                attrs: { type: "button" },
                dataset: { testid: "event-record-picker-add" },
                on: {
                  click: () => {
                    const nextId = options.request.addRecord();
                    options.state.selectedId = nextId;
                    options.state.blockStart = blockStartFor(options.request.records(), nextId);
                    options.state.draftName = recordName(options.request.records(), nextId);
                    render(options.hosts, options.request, options.state);
                  },
                },
              }),
            ],
          }),
          el("section", {
            class: "event-record-picker-record-pane",
            children: [
              options.hosts.searchInput,
              options.hosts.records,
              el("fieldset", {
                class: "event-record-picker-name-box",
                children: [
                  el("legend", { text: "이름" }),
                  options.hosts.ordinal,
                  options.hosts.nameInput,
                ],
              }),
            ],
          }),
        ],
      }),
      el("div", {
        class: "event-record-picker-footer",
        children: [
          footerButton({
            label: "확인",
            testId: "event-record-picker-ok",
            primary: true,
            onClick: () => {
              applyDraftName(options.request, options.state);
              if (options.state.selectedId) options.request.onSelect(options.state.selectedId);
              options.close();
            },
          }),
          footerButton({ label: "취소", onClick: options.close }),
          options.applyButton,
        ],
      }),
    ],
  });
}

function render(hosts: PickerHosts, request: ClassicRecordPickerRequest, state: PickerState): void {
  const records = request.records();
  clearChildren(hosts.blocks);
  clearChildren(hosts.records);
  renderBlocks({ host: hosts.blocks, records, state, onSelect: (blockStart) => {
    state.blockStart = blockStart;
    // 범위를 직접 고르면 검색을 해제하고 RM2003 블록 내비게이션으로 돌아간다.
    state.query = "";
    hosts.searchInput.value = "";
    render(hosts, request, state);
  } });
  // [높음-3] 검색 중이면 전체 레코드에서 이름/번호 부분일치로 필터. 범위 리스트는 유지(정체성).
  const visibleRecords = visibleRecordEntries(records, state);
  if (visibleRecords.length === 0) {
    hosts.records.append(el("div", {
      class: "empty-hint",
      text: state.query.trim() ? `"${state.query.trim()}" 와 일치하는 레코드가 없습니다.` : request.emptyText,
      dataset: { testid: "event-record-picker-no-result" },
    }));
  }
  for (const { index, record } of visibleRecords) {
    hosts.records.append(recordButton({
      index,
      record,
      selected: record.id === state.selectedId,
      onSelect: () => {
        state.selectedId = record.id;
        state.draftName = record.name;
        state.blockStart = blockStartFor(request.records(), record.id);
        render(hosts, request, state);
      },
    }));
  }
  const selectedIndex = Math.max(0, records.findIndex((record) => record.id === state.selectedId));
  hosts.ordinal.textContent = `${ordinalLabel(selectedIndex)}:`;
  hosts.nameInput.value = state.draftName;
  updateApplyButton(hosts.applyButton, request, state);
}

const SEARCH_RESULT_LIMIT = 60;

type VisibleRecordEntry = { readonly index: number; readonly record: ClassicRecordDef };

function visibleRecordEntries(records: readonly ClassicRecordDef[], state: PickerState): VisibleRecordEntry[] {
  const needle = state.query.trim().toLowerCase();
  if (!needle) {
    return records
      .slice(state.blockStart, state.blockStart + BLOCK_SIZE)
      .map((record, offset) => ({ index: state.blockStart + offset, record }));
  }
  const matches: VisibleRecordEntry[] = [];
  for (const [index, record] of records.entries()) {
    const ordinal = ordinalLabel(index);
    if (record.name.toLowerCase().includes(needle) || ordinal.includes(needle) || String(index + 1).includes(needle)) {
      matches.push({ index, record });
      if (matches.length >= SEARCH_RESULT_LIMIT) break;
    }
  }
  return matches;
}

function renderBlocks(options: {
  readonly host: HTMLElement;
  readonly records: readonly ClassicRecordDef[];
  readonly state: PickerState;
  readonly onSelect: (blockStart: number) => void;
}): void {
  const blockCount = Math.max(1, Math.ceil(options.records.length / BLOCK_SIZE));
  for (let block = 0; block < blockCount; block += 1) {
    const start = block * BLOCK_SIZE;
    const end = Math.min(options.records.length, start + BLOCK_SIZE);
    const endIndex = Math.max(start, end - 1);
    options.host.append(el("button", {
      class: "event-record-picker-block" + (start === options.state.blockStart ? " active" : ""),
      text: `[ ${ordinalLabel(start)} - ${ordinalLabel(endIndex)} ]`,
      attrs: { type: "button", role: "option", "aria-selected": start === options.state.blockStart ? "true" : "false" },
      on: { click: () => options.onSelect(start) },
    }));
  }
}

function recordButton(options: {
  readonly index: number;
  readonly record: ClassicRecordDef;
  readonly selected: boolean;
  readonly onSelect: () => void;
}): HTMLButtonElement {
  return el("button", {
    class: "event-record-picker-row" + (options.selected ? " selected" : ""),
    text: `${ordinalLabel(options.index)}: ${options.record.name}`,
    attrs: { type: "button", role: "option", "aria-selected": options.selected ? "true" : "false" },
    dataset: { testid: `event-record-picker-row-${options.index + 1}` },
    on: { click: options.onSelect, dblclick: options.onSelect },
  });
}

function footerButton(options: {
  readonly label: string;
  readonly onClick: () => void;
  readonly primary?: boolean;
  readonly testId?: string;
}): HTMLButtonElement {
  const button = el("button", {
    class: "btn" + (options.primary ? " primary" : ""),
    text: options.label,
    attrs: { type: "button" },
    on: { click: options.onClick },
  });
  if (options.testId) button.dataset.testid = options.testId;
  return button;
}

function applyDraftName(request: ClassicRecordPickerRequest, state: PickerState): void {
  if (!state.selectedId) return;
  if (recordName(request.records(), state.selectedId) === state.draftName) return;
  request.renameRecord(state.selectedId, state.draftName);
}

function updateApplyButton(button: HTMLButtonElement, request: ClassicRecordPickerRequest, state: PickerState): void {
  button.disabled = recordName(request.records(), state.selectedId) === state.draftName;
}

function selectedRecordId(records: readonly ClassicRecordDef[], currentId: string): string {
  if (records.some((record) => record.id === currentId)) return currentId;
  return records[0]?.id ?? "";
}

function blockStartFor(records: readonly ClassicRecordDef[], selectedId: string): number {
  const index = records.findIndex((record) => record.id === selectedId);
  return index >= 0 ? Math.floor(index / BLOCK_SIZE) * BLOCK_SIZE : 0;
}

function recordName(records: readonly ClassicRecordDef[], selectedId: string): string {
  return records.find((record) => record.id === selectedId)?.name ?? "";
}
