import { deleteSwitch, deleteVariable, renameSwitch, renameVariable } from "@/editor/actions";
import { bulkRenameSwitches, bulkRenameVariables, type DeleteResult } from "@/editor/databaseActions";
import {
  matchesNameOrId,
  textControl,
} from "@/editor/panels/databaseControls";
import { ordinalLabel } from "@/editor/panels/databaseDisplay";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

let switchSearch = "";
let selectedSwitchId = "";
let variableSearch = "";
let selectedVariableId = "";
let utilitySearchTimer: number | null = null;

type UtilityNamedRowsOptions = {
  readonly query: string;
  readonly records: readonly { readonly id: string; readonly name: string }[];
  readonly selectedId: string;
  readonly setSelectedId: (id: string) => void;
};

type UtilityNamedRowOptions = {
  readonly id: string;
  readonly index: number;
  readonly name: string;
  readonly ordinal: string;
  readonly selected: boolean;
  readonly setSelectedId: (id: string) => void;
  readonly total: number;
};

type UtilityDetailOptions = {
  readonly label: string;
  readonly onDelete: (id: string) => DeleteResult;
  readonly onName: (id: string, value: string) => void;
  readonly record?: { readonly id: string; readonly name: string };
  readonly rerender: () => void;
};

type TermFieldOptions = {
  readonly key: "attack" | "gold" | "hp" | "item" | "level" | "mp" | "skill";
  readonly label: string;
  readonly testid?: string;
  readonly value: string;
};

export function renderSwitchesTab(host: HTMLElement, rerender: () => void): void {
  host.append(el("h3", { text: "스위치" }), utilityShell("스위치 목록"));
  const form = detailForm(host);
  if (!form) return;
  const records = store.getCurrent().switches;
  selectedSwitchId = selectedRecordId(records, selectedSwitchId);
  form.append(rangeControls("스위치 범위 이름 변경", "switch", rerender));
  form.append(searchInput("스위치 검색", switchSearch, (value) => {
    switchSearch = value;
    rerender();
  }));
  form.append(numberedRows({ records, query: switchSearch, selectedId: selectedSwitchId, setSelectedId: (id) => {
    selectedSwitchId = id;
    rerender();
  } }));
  form.append(utilityDetail({ label: "스위치 이름", record: records.find((record) => record.id === selectedSwitchId), onName: renameSwitch, onDelete: deleteSwitch, rerender }));
}

export function renderVariablesTab(host: HTMLElement, rerender: () => void): void {
  host.append(el("h3", { text: "변수" }), utilityShell("변수 목록"));
  const form = detailForm(host);
  if (!form) return;
  const records = store.getCurrent().variables;
  selectedVariableId = selectedRecordId(records, selectedVariableId);
  form.append(rangeControls("변수 범위 이름 변경", "variable", rerender));
  form.append(searchInput("변수 검색", variableSearch, (value) => {
    variableSearch = value;
    rerender();
  }));
  form.append(numberedRows({ records, query: variableSearch, selectedId: selectedVariableId, setSelectedId: (id) => {
    selectedVariableId = id;
    rerender();
  } }));
  form.append(utilityDetail({ label: "변수 이름", record: records.find((record) => record.id === selectedVariableId), onName: renameVariable, onDelete: deleteVariable, rerender }));
}

export function renderTermsTab(host: HTMLElement): void {
  const terms = store.getCurrent().meta.terms;
  const form = el("section", { class: "db-detail-form db-terms-form", dataset: { testid: "db-detail-form" } });
  form.append(
    rm2k3Fieldset("기본 용어", [
      termField({ label: "돈", key: "gold", value: terms.gold, testid: "db-field-gold" }),
      termField({ label: "레벨", key: "level", value: terms.level ?? "레벨" }),
      termField({ label: "HP", key: "hp", value: terms.hp ?? "HP" }),
      termField({ label: "MP", key: "mp", value: terms.mp ?? "MP" }),
    ]),
    rm2k3Fieldset("명령 용어", [
      termField({ label: "공격", key: "attack", value: terms.attack ?? "공격" }),
      termField({ label: "스킬", key: "skill", value: terms.skill ?? "스킬", testid: "db-field-skill-term" }),
      termField({ label: "아이템", key: "item", value: terms.item ?? "아이템" }),
    ]),
  );
  host.append(el("h3", { text: "용어" }), form);
}

function detailForm(host: HTMLElement): HTMLElement | null {
  const form = host.querySelector("[data-testid='db-detail-form']");
  return form instanceof HTMLElement ? form : null;
}

function utilityShell(title: string): HTMLElement {
  return el("section", {
    class: "db-detail-form db-utility-form",
    dataset: { testid: "db-detail-form" },
    children: [el("div", { class: "db-utility-heading", text: title })],
  });
}

function rangeControls(label: string, kind: "switch" | "variable", rerender: () => void): HTMLElement {
  const start = el("input", { attrs: { type: "number", min: "1" }, value: 1 });
  const count = el("input", { attrs: { type: "number", min: "1" }, value: 10 });
  const prefix = el("input", { attrs: { type: "text" }, value: kind === "switch" ? "스위치" : "변수" });
  const button = el("button", {
    class: "btn small",
    text: "범위 적용",
    on: {
      click: () => {
        const startNumber = Number(start.value);
        if (kind === "switch") {
          bulkRenameSwitches(startNumber, Number(count.value), prefix.value);
          selectedSwitchId = store.getCurrent().switches[startNumber - 1]?.id ?? selectedSwitchId;
        } else {
          bulkRenameVariables(startNumber, Number(count.value), prefix.value);
          selectedVariableId = store.getCurrent().variables[startNumber - 1]?.id ?? selectedVariableId;
        }
        rerender();
      },
    },
  });
  return el("div", { class: "db-range", children: [el("span", { text: label }), start, count, prefix, button] });
}

function numberedRows(options: UtilityNamedRowsOptions): HTMLElement {
  const list = el("div", { class: "db-utility-list" });
  let visibleCount = 0;
  for (const [index, record] of options.records.entries()) {
    if (options.query && !matchesNameOrId(record.name, record.id, options.query)) continue;
    visibleCount += 1;
    list.append(namedRow({
      index,
      ordinal: ordinalLabel(index),
      id: record.id,
      name: record.name,
      selected: record.id === options.selectedId,
      setSelectedId: options.setSelectedId,
      total: options.records.length,
    }));
  }
  if (list.childElementCount === 0) {
    list.classList.add("empty");
    for (let index = 0; index < 30; index += 1) list.append(emptyNumberedRow(ordinalLabel(index)));
    return list;
  }
  if (!options.query) {
    const minimumVisibleRows = 30;
    for (let index = visibleCount; index < minimumVisibleRows; index += 1) {
      list.append(emptyNumberedRow(ordinalLabel(index)));
    }
  }
  return list;
}

function namedRow(options: UtilityNamedRowOptions): HTMLElement {
  return el("button", {
    class: `db-row db-utility-row${options.selected ? " active" : ""}`,
    attrs: { type: "button" },
    dataset: {
      recordId: options.id,
      recordIndex: String(options.index + 1),
      recordName: options.name,
      recordTotal: String(options.total),
    },
    on: { click: () => options.setSelectedId(options.id) },
    children: [
      el("span", { class: "db-id", text: `${options.ordinal}:` }),
      el("span", { class: "db-list-name", text: options.name }),
    ],
  });
}

function emptyNumberedRow(ordinal: string): HTMLElement {
  return el("div", {
    class: "db-row db-empty-row",
    children: [
      el("span", { class: "db-id", text: `${ordinal}:` }),
      el("span", { class: "db-list-name", text: "" }),
    ],
  });
}

function searchInput(placeholder: string, value: string, onInput: (value: string) => void): HTMLElement {
  const input = el("input", { attrs: { type: "search", placeholder }, value });
  input.addEventListener("input", () => {
    const cursor = input.selectionStart ?? input.value.length;
    const nextValue = input.value;
    if (utilitySearchTimer !== null) window.clearTimeout(utilitySearchTimer);
    utilitySearchTimer = window.setTimeout(() => {
      utilitySearchTimer = null;
      onInput(nextValue);
      const next = document.querySelector<HTMLInputElement>(".db-body .db-search input");
      if (!next) return;
      next.focus();
      next.setSelectionRange(cursor, cursor);
    }, 80);
  });
  return el("div", { class: "db-search", children: [input] });
}

function selectedRecordId(records: readonly { readonly id: string }[], currentId: string): string {
  if (records.some((record) => record.id === currentId)) return currentId;
  return records[0]?.id ?? "";
}

function utilityDetail(options: UtilityDetailOptions): HTMLElement {
  if (!options.record) {
    return el("div", { class: "db-utility-detail", children: [el("span", { text: "선택된 항목 없음" })] });
  }
  const record = options.record;
  const input = el("input", {
    attrs: { type: "text" },
    dataset: { testid: "db-utility-selected-name" },
    value: record.name,
  });
  input.addEventListener("input", () => options.onName(record.id, input.value));
  return el("div", {
    class: "db-utility-detail",
    children: [
      el("label", { children: [el("span", { text: options.label }), input] }),
      el("button", {
        class: "btn danger small",
        text: "삭제",
        on: {
          click: () => {
            const result = options.onDelete(record.id);
            if (!result.ok) {
              toast(result.message, "error");
              return;
            }
            options.rerender();
          },
        },
      }),
    ],
  });
}

function rm2k3Fieldset(title: string, children: readonly HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "rm2k3-db-fieldset", children: [el("legend", { text: title }), ...children] });
}

function termField(options: TermFieldOptions): HTMLElement {
  return textControl(options.label, options.value, (next) => {
    store.update((project) => {
      project.meta.terms[options.key] = next;
    });
  }, options.testid);
}
