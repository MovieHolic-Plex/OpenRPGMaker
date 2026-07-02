import { ordinalLabel } from "@/editor/panels/databaseDisplay";
import { isElementKind, readonlyValue, selectUtilityRecord } from "@/editor/panels/databaseUtilityRecordControls";
import { store } from "@/project/store";
import type { ActorRateGrade, DatabaseElementRecord } from "@/project/types";
import { el } from "@/util/dom";

const ELEMENT_DAMAGE_GRADES: readonly ActorRateGrade[] = ["A", "B", "C", "D", "E"];
let selectedElementIndex = 5;

export function renderElementsTab(host: HTMLElement): void {
  const elements = store.getCurrent().database.elements ?? [];
  selectedElementIndex = clampIndex(selectedElementIndex, elements);
  selectUtilityRecord("elements", selectedElementIndex);

  const form = el("section", {
    class: "db-detail-form db-elements-classic",
    dataset: { testid: "db-detail-form" },
  });
  const classic = el("div", {
    class: "db-elements-classic-inner",
    dataset: { testid: "db-elements-classic" },
  });
  classic.append(renderElementsClassicList(elements, host), renderElementsClassicEditor(elements[selectedElementIndex], selectedElementIndex));
  form.append(classic);
  host.append(form);
}

function renderElementsClassicList(elements: readonly DatabaseElementRecord[], host: HTMLElement): HTMLElement {
  const list = el("div", { class: "db-elements-list", dataset: { testid: "db-elements-list" } });
  for (const [index, element] of elements.entries()) {
    list.append(
      el("button", {
        class: `db-elements-row${index === selectedElementIndex ? " is-selected" : ""}`,
        text: `${ordinalLabel(index)}: ${element.name}`,
        attrs: { type: "button" },
        dataset: { testid: `db-elements-row-${index}` },
        on: {
          click: () => {
            selectedElementIndex = index;
            selectUtilityRecord("elements", index);
            host.replaceChildren();
            renderElementsTab(host);
          },
        },
      }),
    );
  }
  return el("aside", {
    class: "db-elements-list-pane",
    children: [
      el("div", { class: "db-elements-list-title", dataset: { testid: "db-elements-list-title" }, text: "속성" }),
      list,
      el("button", {
        class: "db-elements-maximum",
        text: "최대 개수",
        attrs: { type: "button" },
        dataset: { testid: "db-elements-maximum-number" },
      }),
    ],
  });
}

function renderElementsClassicEditor(element: DatabaseElementRecord | undefined, index: number): HTMLElement {
  if (!element) {
    return el("section", {
      class: "db-elements-editor",
      children: [classicFieldset("이름", [readonlyValue("0001", "속성 레코드 없음")])],
    });
  }
  return el("section", {
    class: "db-elements-editor",
    children: [renderElementNameGroup(element, index), renderElementKindGroup(element, index), renderElementDamageGroup(element, index)],
  });
}

function renderElementNameGroup(element: DatabaseElementRecord, index: number): HTMLElement {
  const input = el("input", {
    class: "db-elements-name-input",
    attrs: { type: "text" },
    dataset: { testid: "db-field-element-name-selected" },
    value: element.name,
  });
  input.addEventListener("focus", () => selectUtilityRecord("elements", index));
  input.addEventListener("input", () => {
    const value = input.value;
    store.update((project) => {
      const target = project.database.elements?.[index];
      if (target) target.name = value;
    });
  });
  return classicFieldset("이름", [input]);
}

function renderElementKindGroup(element: DatabaseElementRecord, index: number): HTMLElement {
  const physical = elementKindRadio("physical", element.kind === "physical", index);
  const magical = elementKindRadio("magical", element.kind === "magical", index);
  return classicFieldset("속성 유형", [
    el("label", { class: "db-elements-radio-row", children: [physical, el("span", { text: "물리" })] }),
    el("label", { class: "db-elements-radio-row", children: [magical, el("span", { text: "마법" })] }),
  ]);
}

function elementKindRadio(kind: DatabaseElementRecord["kind"], checked: boolean, index: number): HTMLInputElement {
  const input = el("input", {
    attrs: { type: "radio", name: "db-elements-attribute-type", value: kind },
    dataset: { testid: `db-field-element-kind-${kind}` },
  });
  input.checked = checked;
  input.addEventListener("focus", () => selectUtilityRecord("elements", index));
  input.addEventListener("change", () => {
    if (!input.checked) return;
    store.update((project) => {
      const target = project.database.elements?.[index];
      if (target) target.kind = isElementKind(input.value) ? input.value : "physical";
    });
  });
  return input;
}

function renderElementDamageGroup(element: DatabaseElementRecord, index: number): HTMLElement {
  return classicFieldset(
    "대미지 배율",
    ELEMENT_DAMAGE_GRADES.map((grade) => renderElementDamageRow(element, index, grade)),
  );
}

function renderElementDamageRow(element: DatabaseElementRecord, index: number, grade: ActorRateGrade): HTMLElement {
  const input = el("input", {
    class: "db-elements-damage-input",
    attrs: { type: "number", step: "1" },
    dataset: { testid: `db-field-element-damage-${grade}` },
    value: element.damageMultipliers[grade],
  });
  input.addEventListener("focus", () => selectUtilityRecord("elements", index));
  input.addEventListener("input", () => {
    const value = clampDamageMultiplier(Number(input.value));
    store.update((project) => {
      const target = project.database.elements?.[index];
      if (target) target.damageMultipliers = { ...target.damageMultipliers, [grade]: value };
    });
  });
  return el("label", {
    class: "db-elements-damage-row",
    children: [
      el("span", { class: `db-elements-grade grade-${grade.toLowerCase()}`, text: grade }),
      input,
      el("span", { class: "db-elements-percent", text: "%" }),
    ],
  });
}

function classicFieldset(title: string, children: readonly HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "db-elements-fieldset", children: [el("legend", { text: title }), ...children] });
}

function clampIndex(index: number, elements: readonly DatabaseElementRecord[]): number {
  if (elements.length === 0) return 0;
  return Math.min(Math.max(index, 0), elements.length - 1);
}

function clampDamageMultiplier(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(99999, Math.max(-9999, Math.trunc(value)));
}
