import { addMapFolder, createMapFromSpec } from "@/editor/actions";
import { selectEditorMap } from "@/editor/mapSelection";
import { openEventSubdialog } from "@/editor/panels/eventEditor/subdialog";
import { appendGroupedTilesetOptions } from "@/editor/tilesetSelectOptions";
import {
  clampMapSize,
  resolveMapCreateDefaults,
  type MapCreatePreset,
  type MapCreateRequest,
} from "@/project/mapCreateSpec";
import { findParentMapId, isMapTreeFolder, mapTreeNodeLabel } from "@/project/mapTree";
import { store } from "@/project/store";
import type { MapId, MapTreeNode } from "@/project/types";
import { el } from "@/util/dom";

export function openMapCreateDialog(request: MapCreateRequest = {}): void {
  const project = store.getCurrent();
  let spec = resolveMapCreateDefaults(project, request);
  openEventSubdialog({
    title: spec.parentId ? "하위 맵 만들기" : "맵 만들기",
    subtitle: "이름·크기·칩셋을 정한 뒤 만듭니다. 트리 계층은 이동 문이 아닙니다.",
    testId: "map-create-dialog",
    width: "narrow",
    render: (body, close) => {
      const name = el("input", {
        attrs: { type: "text", "aria-label": "맵 이름" },
        value: spec.name,
        dataset: { testid: "map-create-name" },
      }) as HTMLInputElement;
      const width = el("input", {
        attrs: { type: "number", min: "4", max: "256", "aria-label": "가로" },
        value: spec.width,
        dataset: { testid: "map-create-width" },
      }) as HTMLInputElement;
      const height = el("input", {
        attrs: { type: "number", min: "4", max: "256", "aria-label": "세로" },
        value: spec.height,
        dataset: { testid: "map-create-height" },
      }) as HTMLInputElement;
      const tileset = el("select", {
        attrs: { "aria-label": "칩셋" },
        dataset: { testid: "map-create-tileset" },
      }) as HTMLSelectElement;
      appendGroupedTilesetOptions(tileset, Object.values(project.tilesets));
      tileset.value = spec.tilesetId;
      const parent = el("select", {
        attrs: { "aria-label": "상위 맵" },
        dataset: { testid: "map-create-parent" },
      }) as HTMLSelectElement;
      parent.append(el("option", { text: "(루트)", attrs: { value: "" } }));
      appendTreeParentOptions(parent, project.mapTree, project.maps, 0);
      parent.value = spec.parentId;

      const applyPreset = (preset: MapCreatePreset): void => {
        spec = resolveMapCreateDefaults(store.getCurrent(), {
          parentId: parent.value as MapId | "",
          preset,
          name: name.value,
        });
        width.value = String(spec.width);
        height.value = String(spec.height);
        tileset.value = spec.tilesetId;
      };

      const presets = el("div", { class: "map-create-presets" });
      for (const [value, label] of [
        ["blank", "빈 맵"],
        ["inherit-parent", "부모와 같게"],
        ["interior", "실내"],
      ] as const) {
        presets.append(el("button", {
          class: "btn",
          text: label,
          attrs: { type: "button" },
          dataset: { testid: `map-create-preset-${value}` },
          on: { click: () => applyPreset(value) },
        }));
      }

      const submit = (): void => {
        const id = createMapFromSpec({
          name: name.value,
          width: clampMapSize(Number(width.value), spec.width),
          height: clampMapSize(Number(height.value), spec.height),
          tilesetId: tileset.value,
          parentId: parent.value as MapId | "",
          preset: spec.preset,
        });
        if (!id) return;
        selectEditorMap(id);
        close();
      };

      body.append(
        el("div", { class: "map-create-form", children: [
          presets,
          field("이름", name),
          field("가로", width),
          field("세로", height),
          field("칩셋", tileset),
          field("상위", parent),
          el("p", {
            class: "map-create-hint",
            text: "상위에 넣는 것만으로는 문이 생기지 않습니다. 만든 뒤 메뉴에서 왕복 이동을 넣을 수 있습니다.",
          }),
          el("button", {
            class: "btn primary",
            text: "만들기",
            attrs: { type: "button" },
            dataset: { testid: "map-create-confirm" },
            on: { click: submit },
          }),
          el("button", {
            class: "btn",
            text: "분류만 만들기",
            attrs: { type: "button" },
            dataset: { testid: "map-create-folder" },
            on: {
              click: () => {
                addMapFolder(parent.value as MapId | "", name.value.trim() || "새 분류");
                close();
              },
            },
          }),
        ] }),
      );
      name.focus();
      name.select();
    },
  });
}

export function openMapCreateUnder(parentId: MapId): void {
  const project = store.getCurrent();
  const parentOfParent = findParentMapId(project.mapTree, parentId);
  openMapCreateDialog({
    parentId,
    preset: parentOfParent === null ? "inherit-parent" : "interior",
  });
}

function appendTreeParentOptions(
  select: HTMLSelectElement,
  node: MapTreeNode,
  maps: ReturnType<typeof store.getCurrent>["maps"],
  depth: number,
): void {
  const prefix = depth > 0 ? `${"— ".repeat(depth)}` : "";
  const label = isMapTreeFolder(node) ? `[분류] ${mapTreeNodeLabel(node, maps)}` : mapTreeNodeLabel(node, maps);
  select.append(el("option", { text: `${prefix}${label}`, attrs: { value: node.mapId } }));
  for (const child of node.children) appendTreeParentOptions(select, child, maps, depth + 1);
}

function field(label: string, control: HTMLElement): HTMLElement {
  return el("label", { class: "map-create-field", children: [el("span", { text: label }), control] });
}
