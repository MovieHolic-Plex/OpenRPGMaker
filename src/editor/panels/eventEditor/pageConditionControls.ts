import { numberedName } from "@/editor/panels/databaseDisplay";
import { store } from "@/project/store";
import { storyFlagOptionLabel } from "@/project/storyFlags";
import { el } from "@/util/dom";
import { openSwitchVariablePicker } from "./recordPickerDialog";

type SwitchVariableKind = "switch" | "variable";
type DatabaseRecordKind = "item" | "actor";
type NamedRecord = { readonly id: string; readonly name: string };

type IdPickerParams = {
  readonly kind: SwitchVariableKind;
  readonly currentId: string;
  readonly inputTestId: string;
  readonly pickerTestId: string;
  readonly onChange: (id: string) => void;
};

type RecordSelectParams = {
  readonly kind: DatabaseRecordKind;
  readonly currentId: string;
  readonly testId: string;
  readonly onChange: (id: string) => void;
};

export function switchVariableIdPicker(params: IdPickerParams): HTMLElement {
  const project = store.getCurrent();
  const records = switchVariableRecords(params.kind);
  const select = el("select", {
    dataset: { testid: params.inputTestId },
  }) as HTMLSelectElement;
  select.append(el("option", { text: "(선택)", attrs: { value: "" } }));
  for (const [index, record] of records.entries()) {
    select.append(el("option", { text: storyFlagOptionLabel(project, params.kind, record, index), attrs: { value: record.id } }));
  }
  if (params.currentId && !records.some((record) => record.id === params.currentId)) {
    select.append(el("option", { text: params.currentId, attrs: { value: params.currentId } }));
  }
  select.value = params.currentId;
  select.addEventListener("change", () => params.onChange(select.value));
  const picker = el("button", {
    class: "btn small",
    text: "...",
    attrs: { type: "button", title: params.kind === "switch" ? "스위치 선택" : "변수 선택" },
    dataset: { testid: params.pickerTestId },
    on: {
      click: () => openSwitchVariablePicker({
        kind: params.kind,
        currentId: select.value,
        onSelect: (id) => {
          select.value = id;
          params.onChange(id);
        },
      }),
    },
  });
  return el("div", { class: "event-condition-id-picker", children: [select, picker] });
}

export function databaseRecordSelect(params: RecordSelectParams): HTMLSelectElement {
  const records = databaseRecords(params.kind);
  const select = el("select", { dataset: { testid: params.testId } }) as HTMLSelectElement;
  select.append(el("option", { text: "(선택)", attrs: { value: "" } }));
  for (const [index, record] of records.entries()) {
    select.append(el("option", { text: numberedName(index, record.name), attrs: { value: record.id } }));
  }
  // 삭제된/유령 itemId·actorId도 선택 상태로 보이게 한다(스위치 피커와 동일).
  // 없으면 select.value가 조용히 첫 옵션("(선택)")으로 떨어져 조건이 비어 보이는 착시가 난다.
  if (params.currentId && !records.some((record) => record.id === params.currentId)) {
    select.append(el("option", { text: `${params.currentId} (없음)`, attrs: { value: params.currentId } }));
  }
  select.value = params.currentId;
  select.addEventListener("change", () => params.onChange(select.value));
  return select;
}

function databaseRecords(kind: DatabaseRecordKind): readonly NamedRecord[] {
  const project = store.getCurrent();
  return kind === "item" ? project.database.items : project.database.actors;
}

function switchVariableRecords(kind: SwitchVariableKind): readonly NamedRecord[] {
  const project = store.getCurrent();
  return kind === "switch" ? project.switches : project.variables;
}
