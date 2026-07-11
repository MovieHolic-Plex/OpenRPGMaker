import { clampElementListCount, resizeElementRecords } from "@/editor/databaseElementList";
import { recordCoalescedSnapshot, recordProjectSnapshot } from "@/editor/mapEditHistory";
import { ordinalLabel } from "@/editor/panels/databaseDisplay";
import { isElementKind, readonlyValue, selectUtilityRecord } from "@/editor/panels/databaseUtilityRecordControls";
import { store } from "@/project/store";
import type { ActorRateGrade, DatabaseElementRecord } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

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
        attrs: { type: "button", title: "속성 목록 개수 변경" },
        dataset: { testid: "db-elements-maximum-number" },
        on: {
          click: () => openElementMaxCountDialog(elements.length, (count) => {
            recordProjectSnapshot();
            store.update((project) => {
              project.database.elements = resizeElementRecords(project.database.elements ?? [], count);
            }, { scope: "database", collection: "elements" });
            selectedElementIndex = clampIndex(selectedElementIndex, store.getCurrent().database.elements ?? []);
            host.replaceChildren();
            renderElementsTab(host);
            toast(`속성 개수를 ${clampElementListCount(count)}개로 맞췄습니다.`, "ok");
          }),
        },
      }),
    ],
  });
}

function openElementMaxCountDialog(current: number, onApply: (count: number) => void): void {
  document.querySelector("[data-testid='db-elements-max-dialog']")?.remove();
  const input = el("input", {
    attrs: { type: "number", min: "1", max: "99" },
    value: current,
    dataset: { testid: "db-elements-max-count-input" },
  }) as HTMLInputElement;
  const backdrop = el("div", {
    class: "db-enemy-dialog-backdrop",
    dataset: { testid: "db-elements-max-dialog" },
  });
  const close = (): void => backdrop.remove();
  backdrop.append(
    el("div", {
      class: "db-enemy-dialog",
      children: [
        el("header", { text: "속성 최대 개수" }),
        el("main", {
          children: [
            el("label", {
              class: "db-field",
              children: [el("span", { text: "개수 (1~99)" }), input],
            }),
          ],
        }),
        el("footer", {
          children: [
            el("button", {
              class: "btn small",
              text: "OK",
              dataset: { testid: "db-elements-max-ok" },
              attrs: { type: "button" },
              on: {
                click: () => {
                  onApply(Number(input.value));
                  close();
                },
              },
            }),
            el("button", {
              class: "btn small",
              text: "Cancel",
              dataset: { testid: "db-elements-max-cancel" },
              attrs: { type: "button" },
              on: { click: close },
            }),
          ],
        }),
      ],
    }),
  );
  document.body.append(backdrop);
  input.focus();
  input.select();
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
    recordCoalescedSnapshot(`db-utility:elements:${index}:name`);
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
    recordProjectSnapshot();
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
    recordCoalescedSnapshot(`db-utility:elements:${index}:damage:${grade}`);
    store.update((project) => {
      const target = project.database.elements?.[index];
      if (target) target.damageMultipliers = { ...target.damageMultipliers, [grade]: value };
    });
  });
  // blur 시 클램프된 저장값을 입력창에 되써서 표시-저장 불일치를 없앤다(P4 계열).
  input.addEventListener("change", () => {
    input.value = String(clampDamageMultiplier(Number(input.value)));
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
