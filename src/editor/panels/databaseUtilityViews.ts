import { addSwitch, addVariable, deleteSwitch, deleteVariable } from "@/editor/actions";
import { bulkRenameSwitches, bulkRenameVariables, type DeleteResult } from "@/editor/databaseActions";
import { recordCoalescedSnapshot } from "@/editor/mapEditHistory";
import {
  field,
  matchesNameOrId,
} from "@/editor/panels/databaseControls";
import { ordinalLabel } from "@/editor/panels/databaseDisplay";
import { storyFlagListLabel } from "@/project/storyFlags";
import { store } from "@/project/store";
import { defaultTermValue, type TermKey } from "@/project/terms";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

const DELETE_CONFIRM_LABEL = "정말 삭제?";
const DELETE_IDLE_LABEL = "삭제";
const DELETE_CONFIRM_WINDOW_MS = 3000;

let switchSearch = "";
let selectedSwitchId = "";
let variableSearch = "";
let selectedVariableId = "";
let utilitySearchTimer: number | null = null;
let pendingUtilityFocusId = "";

// 스위치/변수 이름 입력란은 키 입력마다 호출된다 — editor/actions.ts의 renameSwitch/
// renameVariable을 그대로 쓰면 매번 recordProjectSnapshot()(비-코얼레스)이 실행돼
// 5글자 타이핑에 Ctrl+Z 5번이 필요해진다(qa-system-report.md). terms 필드와 동일하게
// recordCoalescedSnapshot으로 직접 마무리한다.
function renameSwitchCoalesced(id: string, name: string): void {
  recordCoalescedSnapshot(`db-utility:switch-name:${id}`);
  store.update((project) => {
    const record = project.switches.find((entry) => entry.id === id);
    if (record) record.name = name;
  }, { scope: "database", collection: "switches" });
}

function renameVariableCoalesced(id: string, name: string): void {
  recordCoalescedSnapshot(`db-utility:variable-name:${id}`);
  store.update((project) => {
    const record = project.variables.find((entry) => entry.id === id);
    if (record) record.name = name;
  }, { scope: "database", collection: "variables" });
}

// 삭제 자체(참조 가드 + undo 스냅샷)는 기존 deleteSwitch/deleteVariable을 그대로 쓰되,
// 성공한 뒤에는 세션 런타임 값(session.switches[id]/variables[id])도 함께 지운다 — 그러지
// 않으면 슬롯을 "+ 추가"로 재사용할 때 이전 값(true/숫자)을 그대로 물려받는다
// (qa-system-report.md). deleteSwitch가 이미 recordProjectSnapshot을 호출했으므로 이
// 후속 store.update는 별도 스냅샷 없이 같은 undo 묶음에 들어간다.
function deleteSwitchWithCleanup(id: string): DeleteResult {
  const result = deleteSwitch(id);
  if (result.ok) {
    store.update((project) => {
      delete project.session.switches[id];
    }, { scope: "database", collection: "switches" });
  }
  return result;
}

function deleteVariableWithCleanup(id: string): DeleteResult {
  const result = deleteVariable(id);
  if (result.ok) {
    store.update((project) => {
      delete project.session.variables[id];
    }, { scope: "database", collection: "variables" });
  }
  return result;
}

type UtilityNamedRowsOptions = {
  readonly kind: "switch" | "variable";
  readonly emptyMessage: string;
  readonly onDelete: (id: string) => DeleteResult;
  readonly query: string;
  readonly records: readonly { readonly id: string; readonly name: string }[];
  readonly rerender: () => void;
  readonly selectedId: string;
  readonly setSelectedId: (id: string) => void;
};

type UtilityNamedRowOptions = {
  readonly id: string;
  readonly index: number;
  readonly name: string;
  readonly onDelete: (id: string) => DeleteResult;
  readonly ordinal: string;
  readonly rerender: () => void;
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
  readonly key: TermKey;
  readonly label: string;
  readonly testid?: string;
  readonly value?: string;
};

export function renderSwitchesTab(host: HTMLElement, rerender: () => void): void {
  host.append(el("h3", { text: "스위치" }), utilityShell("스위치 목록"));
  const form = detailForm(host);
  if (!form) return;
  const records = store.getCurrent().switches;
  selectedSwitchId = selectedRecordId(records, selectedSwitchId);
  form.append(addUtilityButton("switch", rerender));
  form.append(rangeControls("스위치 범위 이름 변경", "switch", rerender));
  form.append(searchInput("스위치 검색", switchSearch, (value) => {
    switchSearch = value;
    rerender();
  }));
  form.append(numberedRows({ kind: "switch", emptyMessage: "아직 스위치가 없습니다 — + 추가 또는 범위 적용으로 만드세요", onDelete: deleteSwitchWithCleanup, records, query: switchSearch, rerender, selectedId: selectedSwitchId, setSelectedId: (id) => {
    selectedSwitchId = id;
    rerender();
  } }));
  form.append(utilityDetail({ label: "스위치 이름", record: records.find((record) => record.id === selectedSwitchId), onName: renameSwitchCoalesced, onDelete: deleteSwitchWithCleanup, rerender }));
  form.append(storyFlagList());
  focusPendingUtilityName(form);
}

export function renderVariablesTab(host: HTMLElement, rerender: () => void): void {
  host.append(el("h3", { text: "변수" }), utilityShell("변수 목록"));
  const form = detailForm(host);
  if (!form) return;
  const records = store.getCurrent().variables;
  selectedVariableId = selectedRecordId(records, selectedVariableId);
  form.append(addUtilityButton("variable", rerender));
  form.append(rangeControls("변수 범위 이름 변경", "variable", rerender));
  form.append(searchInput("변수 검색", variableSearch, (value) => {
    variableSearch = value;
    rerender();
  }));
  form.append(numberedRows({ kind: "variable", emptyMessage: "아직 변수가 없습니다 — + 추가 또는 범위 적용으로 만드세요", onDelete: deleteVariableWithCleanup, records, query: variableSearch, rerender, selectedId: selectedVariableId, setSelectedId: (id) => {
    selectedVariableId = id;
    rerender();
  } }));
  form.append(utilityDetail({ label: "변수 이름", record: records.find((record) => record.id === selectedVariableId), onName: renameVariableCoalesced, onDelete: deleteVariableWithCleanup, rerender }));
  form.append(storyFlagList());
  focusPendingUtilityName(form);
}

export function renderTermsTab(host: HTMLElement): void {
  const terms = store.getCurrent().meta.terms;
  const form = el("section", { class: "db-detail-form db-terms-form", dataset: { testid: "db-detail-form" } });
  form.append(
    rm2k3Fieldset("전투", [
      termField({ label: "공격", key: "attack", value: terms.attack }),
      termField({ label: "스킬", key: "skill", value: terms.skill, testid: "db-field-skill-term" }),
      termField({ label: "아이템", key: "item", value: terms.item }),
      termField({ label: "포획", key: "capture", value: terms.capture }),
      termField({ label: "뒤로", key: "back", value: terms.back }),
      termField({ label: "대상", key: "target", value: terms.target }),
    ]),
    rm2k3Fieldset("상점", [
      termField({ label: "인사", key: "shopGreeting", value: terms.shopGreeting }),
      termField({ label: "구입", key: "shopBuy", value: terms.shopBuy }),
      termField({ label: "판매", key: "shopSell", value: terms.shopSell }),
      termField({ label: "취소", key: "shopCancel", value: terms.shopCancel }),
      termField({ label: "판매 질문", key: "shopSellPrompt", value: terms.shopSellPrompt }),
    ]),
    rm2k3Fieldset("여관", [
      termField({ label: "제목", key: "innTitle", value: terms.innTitle }),
      termField({ label: "예", key: "yes", value: terms.yes }),
      termField({ label: "아니오", key: "no", value: terms.no }),
      termField({ label: "소지금 부족", key: "notEnoughGold", value: terms.notEnoughGold }),
    ]),
    rm2k3Fieldset("공통", [
      termField({ label: "돈 단위", key: "gold", value: terms.gold, testid: "db-field-gold" }),
      termField({ label: "돈 접두사", key: "goldPrefix", value: terms.goldPrefix }),
      termField({ label: "레벨", key: "level", value: terms.level }),
      termField({ label: "HP", key: "hp", value: terms.hp }),
      termField({ label: "MP", key: "mp", value: terms.mp }),
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

function addUtilityButton(kind: "switch" | "variable", rerender: () => void): HTMLElement {
  return el("div", {
    class: "db-utility-toolbar",
    children: [el("button", {
      class: "btn small",
      text: "+ 추가",
      attrs: { type: "button" },
      dataset: { testid: kind === "switch" ? "db-add-switch" : "db-add-variable" },
      on: {
        click: () => {
          const id = kind === "switch" ? addSwitch("새 스위치") : addVariable("새 변수");
          if (kind === "switch") selectedSwitchId = id;
          else selectedVariableId = id;
          pendingUtilityFocusId = id;
          rerender();
        },
      },
    })],
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
    if (record.name.trim().length === 0) continue;
    if (options.query && !matchesNameOrId(record.name, record.id, options.query)) continue;
    visibleCount += 1;
    list.append(namedRow({
      index,
      ordinal: ordinalLabel(index),
      id: record.id,
      name: record.name,
      onDelete: options.onDelete,
      rerender: options.rerender,
      selected: record.id === options.selectedId,
      setSelectedId: options.setSelectedId,
      total: options.records.length,
    }));
  }
  if (visibleCount === 0) {
    list.classList.add("empty");
    list.append(emptyListHint(options.query ? "검색 결과가 없습니다." : options.emptyMessage));
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
  const row = el("button", {
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
  const deleteButton = twoStepDeleteButton({
    className: "btn danger tiny db-utility-row-delete",
    ariaLabel: `${options.name} 삭제`,
    testid: `db-delete-${options.id}`,
    onDelete: () => options.onDelete(options.id),
    onDeleted: () => {
      if (selectedSwitchId === options.id) selectedSwitchId = "";
      if (selectedVariableId === options.id) selectedVariableId = "";
      options.rerender();
    },
  });
  return el("div", { class: "db-utility-row-wrap", children: [row, deleteButton] });
}

type TwoStepDeleteButtonOptions = {
  readonly ariaLabel?: string;
  readonly className: string;
  readonly onDelete: () => DeleteResult;
  readonly onDeleted: () => void;
  readonly testid: string;
};

// 다른 레코드 탭과 동일한 2단계 확인 패턴 — 스위치/변수는 DatabaseCollection 밖이라
// 공용 deleteButton(databaseAdvancedRecordViews.ts)을 재사용할 수 없으므로 여기서
// 같은 계약을 재현한다(qa-system-report.md Minor: 2단계 확인 없음).
function twoStepDeleteButton(options: TwoStepDeleteButtonOptions): HTMLElement {
  let armedUntil = 0;
  let resetTimer: number | null = null;
  const button = el("button", {
    class: options.className,
    text: DELETE_IDLE_LABEL,
    attrs: { type: "button", ...(options.ariaLabel ? { "aria-label": options.ariaLabel } : {}) },
    dataset: { testid: options.testid },
    on: {
      click: () => {
        const now = Date.now();
        if (now > armedUntil) {
          armedUntil = now + DELETE_CONFIRM_WINDOW_MS;
          button.textContent = DELETE_CONFIRM_LABEL;
          button.classList.add("confirming");
          if (resetTimer !== null) window.clearTimeout(resetTimer);
          resetTimer = window.setTimeout(() => {
            resetTimer = null;
            if (Date.now() >= armedUntil) {
              armedUntil = 0;
              button.textContent = DELETE_IDLE_LABEL;
              button.classList.remove("confirming");
            }
          }, DELETE_CONFIRM_WINDOW_MS + 100);
          return;
        }
        armedUntil = 0;
        button.textContent = DELETE_IDLE_LABEL;
        button.classList.remove("confirming");
        const result = options.onDelete();
        if (!result.ok) {
          toast(result.message, "error");
          return;
        }
        toast("삭제했습니다 — Ctrl+Z로 되돌릴 수 있습니다.", "ok");
        options.onDeleted();
      },
    },
  });
  return button;
}

function storyFlagList(): HTMLElement {
  const project = store.getCurrent();
  const flags = project.storyFlags ?? [];
  return el("section", {
    class: "db-story-flag-list",
    children: [
      el("div", { class: "db-utility-heading", text: "스토리 플래그 (읽기 전용)" }),
      ...(flags.length > 0
        ? flags.map((flag) => el("div", {
          class: "db-row db-story-flag-row",
          children: [
            el("span", { class: "db-id", text: storyFlagListLabel(project, flag) }),
            el("span", { class: "db-list-name", text: flag.description }),
          ],
        }))
        : [el("div", { class: "empty-hint", text: "등록된 스토리 플래그 없음" })]),
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

function emptyListHint(text: string): HTMLElement {
  return el("div", { class: "db-row db-empty-list-hint", text });
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

function selectedRecordId(records: readonly { readonly id: string; readonly name: string }[], currentId: string): string {
  if (records.some((record) => record.id === currentId && record.name.trim().length > 0)) return currentId;
  return records.find((record) => record.name.trim().length > 0)?.id ?? "";
}

function focusPendingUtilityName(form: HTMLElement): void {
  if (!pendingUtilityFocusId) return;
  const input = form.querySelector<HTMLInputElement>("[data-testid='db-utility-selected-name']");
  input?.focus();
  pendingUtilityFocusId = "";
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
  const deleteButton = twoStepDeleteButton({
    className: "btn danger small",
    testid: "db-utility-selected-delete",
    onDelete: () => options.onDelete(record.id),
    onDeleted: () => {
      if (selectedSwitchId === record.id) selectedSwitchId = "";
      if (selectedVariableId === record.id) selectedVariableId = "";
      options.rerender();
    },
  });
  return el("div", {
    class: "db-utility-detail",
    children: [
      el("label", { children: [el("span", { text: options.label }), input] }),
      deleteButton,
    ],
  });
}

function rm2k3Fieldset(title: string, children: readonly HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "oprn-db-fieldset", children: [el("legend", { text: title }), ...children] });
}

function termField(options: TermFieldOptions): HTMLElement {
  const input = el("input", {
    attrs: { type: "text", placeholder: defaultTermValue(options.key) },
    value: options.value ?? "",
  });
  if (options.testid) input.dataset.testid = options.testid;
  input.addEventListener("input", () => {
    const next = input.value;
    recordCoalescedSnapshot(`db-utility:term:${options.key}`);
    store.update((project) => {
      if (next.trim().length === 0) delete project.meta.terms[options.key];
      else project.meta.terms[options.key] = next;
    });
  });
  return field(options.label, input);
}
