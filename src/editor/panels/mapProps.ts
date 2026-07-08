import { resizeMap, renameMap, setMapEncounterTable, setMapFieldSpawns, setMapTileset, setStartMap, setStartPos } from "@/editor/actions";
import { editorState } from "@/editor/editorState";
import { store } from "@/project/store";
import type { EncounterTableEntry, FieldSpawnDef } from "@/project/types";
import { clearChildren, el } from "@/util/dom";
import { toast } from "@/util/toast";

export function renderMapProps(container: HTMLElement): void {
  clearChildren(container);
  const state = editorState.get();
  const mapId = state.currentMapId ?? store.getCurrent().startMapId;
  const map = store.getCurrent().maps[mapId];
  if (!map) {
    container.append(el("div", { class: "empty-hint", text: "맵을 선택하세요." }));
    return;
  }

  const section = el("div", { class: "panel-section" });
  section.append(el("h3", { text: "맵 속성" }));

  const nameRow = el("div", { class: "field" });
  nameRow.append(el("label", { text: "이름" }));
  const nameInput = el("input", {
    attrs: { type: "text" },
    value: map.name,
    dataset: { testid: "map-name-input" },
  });
  const applyName = (): void => {
    renameMap(map.id, nameInput.value);
  };
  nameInput.addEventListener("change", () => {
    applyName();
  });
  nameRow.append(nameInput);
  section.append(nameRow);

  const tilesetRow = el("div", { class: "field" });
  tilesetRow.append(el("label", { text: "칩셋" }));
  const tilesetSelect = el("select", {
    attrs: { "aria-label": `${map.name} 칩셋` },
    dataset: { testid: "map-props-tileset-select" },
  }) as HTMLSelectElement;
  for (const tileset of Object.values(store.getCurrent().tilesets)) {
    tilesetSelect.append(
      el("option", {
        text: tileset.name,
        value: tileset.id,
        attrs: { value: tileset.id },
      })
    );
  }
  tilesetSelect.value = map.tilesetId;
  tilesetSelect.addEventListener("change", () => {
    setMapTileset(map.id, tilesetSelect.value);
    renderMapProps(container);
  });
  tilesetRow.append(tilesetSelect);
  section.append(tilesetRow);

  const sizeRow = el("div", { class: "field" });
  sizeRow.append(el("label", { text: "크기 (가로 x 세로)" }));
  const wInput = el("input", {
    attrs: { type: "number", min: "4", max: "128" },
    value: String(map.width),
    dataset: { testid: "map-width-input" },
  });
  const hInput = el("input", {
    attrs: { type: "number", min: "4", max: "128" },
    value: String(map.height),
    dataset: { testid: "map-height-input" },
  });
  const applyBtn = el("button", {
    class: "btn",
    text: "적용",
    dataset: { testid: "map-resize-apply" },
    on: {
      click: () => {
        applyName();
        const w = Math.max(4, Math.min(128, parseInt(wInput.value, 10) || map.width));
        const h = Math.max(4, Math.min(128, parseInt(hInput.value, 10) || map.height));
        resizeMap(map.id, w, h);
      },
    },
  });
  const sizeLine = el("div", {});
  sizeLine.style.display = "flex";
  sizeLine.style.gap = "4px";
  sizeLine.append(wInput, hInput, applyBtn);
  sizeRow.append(sizeLine);
  section.append(sizeRow);

  section.append(jsonArrayField(
    "인카운터 테이블",
    "map-encounter-table-input",
    map.encounterTable ?? [],
    (entries) => {
      setMapEncounterTable(map.id, entries as EncounterTableEntry[]);
      renderMapProps(container);
    }
  ));

  section.append(jsonArrayField(
    "필드 스폰",
    "map-field-spawns-input",
    map.fieldSpawns ?? [],
    (entries) => {
      setMapFieldSpawns(map.id, entries as FieldSpawnDef[]);
      renderMapProps(container);
    }
  ));

  section.append(
    el("button", {
      class: "btn",
      text: "선택 칸을 시작 위치로",
      dataset: { testid: "map-start-pos-button" },
      on: {
        click: () => {
          const selection = editorState.get().selection;
          if (!selection || selection.mapId !== map.id) return;
          setStartMap(map.id);
          setStartPos(selection.x, selection.y);
        },
      },
    })
  );

  container.append(section);
}

function jsonArrayField(
  label: string,
  testid: string,
  value: readonly unknown[],
  onApply: (entries: unknown[]) => void
): HTMLElement {
  const row = el("div", { class: "field" });
  row.append(el("label", { text: label }));
  const textarea = el("textarea", {
    value: JSON.stringify(value, null, 2),
    attrs: { rows: "6", spellcheck: "false" },
    dataset: { testid },
  }) as HTMLTextAreaElement;
  const button = el("button", {
    class: "btn",
    text: "적용",
    dataset: { testid: `${testid}-apply` },
    on: {
      click: () => {
        try {
          const parsed = JSON.parse(textarea.value) as unknown;
          if (!Array.isArray(parsed)) throw new Error("배열 JSON이 필요합니다.");
          onApply(parsed);
        } catch (error) {
          toast(error instanceof Error ? error.message : "JSON을 해석할 수 없습니다.", "error");
        }
      },
    },
  });
  const stack = el("div", { class: "map-json-field" });
  stack.append(textarea, button);
  row.append(stack);
  return row;
}
