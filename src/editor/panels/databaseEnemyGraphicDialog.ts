import { updateDatabaseRecord } from "@/editor/databaseActions";
import { currentEnemy, enemyGraphicVisual, openDialog } from "@/editor/panels/databaseEnemyRecordSupport";
import type { EnemyRecord } from "@/project/types";
import { el } from "@/util/dom";

const GRAPHIC_OPTIONS: readonly { readonly id: string; readonly name: string }[] = [
  { id: "generated-enemy-ontology-8da61312", name: "온톨로지 위습 <AGY>" },
  { id: "generated-enemy-slime-01", name: "슬라임 <생성>" },
  { id: "generated-enemy-bat-01", name: "박쥐 <생성>" },
  { id: "generated-enemy-golem-01", name: "골렘 <생성>" },
  { id: "generated-enemy-dragon-01", name: "드래곤 <생성>" },
  { id: "easyrpg-monster-hornet", name: "말벌 <RTP>" },
];

export function openGraphicDialog(record: EnemyRecord, rerender: () => void): void {
  const current = currentEnemy(record);
  let selectedId = current.monsterResourceId ?? GRAPHIC_OPTIONS[0]?.id ?? "";
  let hue = current.graphicHue;
  const preview = el("div", { class: "db-enemy-graphic-dialog-preview" });
  const refreshPreview = (): void => {
    preview.replaceChildren(enemyGraphicVisual({ ...currentEnemy(record), monsterResourceId: selectedId, graphicHue: hue }));
  };
  const list = el("div", { class: "db-enemy-graphic-list" });
  for (const option of GRAPHIC_OPTIONS) list.append(graphicButton(option, selectedId, list, () => {
    selectedId = option.id;
    refreshPreview();
  }));
  const hueInput = el("input", { attrs: { type: "range", min: "0", max: "360" }, value: hue, dataset: { testid: "db-enemy-graphic-hue" } }) as HTMLInputElement;
  hueInput.addEventListener("input", () => {
    hue = Number(hueInput.value);
    refreshPreview();
  });
  refreshPreview();
  openDialog("db-enemy-graphic-dialog", "적 그래픽", [
    el("div", { class: "db-enemy-graphic-dialog-grid", children: [list, preview] }),
    el("label", { class: "db-enemy-hue-field", children: [el("span", { text: "색조 변경" }), hueInput] }),
  ], [
    { label: "OK", testid: "db-enemy-graphic-ok", action: () => {
      updateDatabaseRecord("enemies", record.id, { monsterResourceId: selectedId, graphicHue: hue });
      rerender();
    } },
    { label: "Cancel", testid: "db-enemy-graphic-cancel" },
  ]);
}

function graphicButton(option: { readonly id: string; readonly name: string }, selectedId: string, list: HTMLElement, onSelect: () => void): HTMLElement {
  return el("button", {
    class: option.id === selectedId ? "active" : "",
    text: option.name,
    dataset: { testid: `db-enemy-graphic-option-${option.id}` },
    on: {
      click: () => {
        for (const button of list.querySelectorAll("button")) button.classList.toggle("active", button.textContent === option.name);
        onSelect();
      },
    },
  });
}
