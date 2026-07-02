import { addSwitch, addVariable, renameSwitch, renameVariable } from "@/editor/actions";
import { store } from "@/project/store";
import { openClassicRecordPicker } from "./classicRecordPickerDialog";
import type { ClassicRecordDef } from "./classicRecordPickerDialog";

type RecordPickerKind = "switch" | "variable";

type RecordPickerRequest = {
  readonly kind: RecordPickerKind;
  readonly currentId: string;
  readonly onSelect: (id: string) => void;
};

export function openSwitchVariablePicker(request: RecordPickerRequest): void {
  openClassicRecordPicker({
    addRecord: () => createRecord(request.kind),
    currentId: request.currentId,
    emptyText: "목록이 비어 있습니다.",
    headerLabel: request.kind === "switch" ? "스위치" : "변수",
    records: () => recordsFor(request.kind),
    renameRecord: (id, name) => renameRecord(request.kind, id, name),
    testId: "event-record-picker",
    title: request.kind === "switch" ? "스위치 선택" : "변수 선택",
    onSelect: request.onSelect,
  });
}

function recordsFor(kind: RecordPickerKind): readonly ClassicRecordDef[] {
  const project = store.getCurrent();
  return kind === "switch" ? project.switches : project.variables;
}

function createRecord(kind: RecordPickerKind): string {
  return kind === "switch" ? addSwitch("새 스위치") : addVariable("새 변수");
}

function renameRecord(kind: RecordPickerKind, id: string, name: string): void {
  if (kind === "switch") renameSwitch(id, name);
  else renameVariable(id, name);
}
