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
import { exceedsMapDimensionLimit, MAX_TOOL_MAP_DIMENSION, mapSizeLimitMessage } from "@/project/mapSizeLimits";
import { findParentMapId, isMapTreeFolder, mapTreeNodeLabel } from "@/project/mapTree";
import { store } from "@/project/store";
import type { MapId, MapTreeNode, Project } from "@/project/types";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

export function openMapCreateDialog(request: MapCreateRequest = {}): void {
  const project = store.getCurrent();
  let spec = resolveMapCreateDefaults(project, request);
  openEventSubdialog({
    title: spec.parentId ? "하위 맵 만들기" : "맵 만들기",
    subtitle: "이름·크기·타일 그림판을 정한 뒤 만듭니다. 트리 계층은 이동 문이 아닙니다.",
    testId: "map-create-dialog",
    width: "narrow",
    render: (body, close) => {
      const name = el("input", {
        attrs: { type: "text", "aria-label": "맵 이름" },
        value: spec.name,
        dataset: { testid: "map-create-name" },
      }) as HTMLInputElement;
      const width = el("input", {
        attrs: { type: "number", min: "4", max: String(MAX_TOOL_MAP_DIMENSION), "aria-label": "가로" },
        value: spec.width,
        dataset: { testid: "map-create-width" },
      }) as HTMLInputElement;
      const height = el("input", {
        attrs: { type: "number", min: "4", max: String(MAX_TOOL_MAP_DIMENSION), "aria-label": "세로" },
        value: spec.height,
        dataset: { testid: "map-create-height" },
      }) as HTMLInputElement;
      const tileset = el("select", {
        attrs: { "aria-label": "타일 그림판" },
        dataset: { testid: "map-create-tileset" },
      }) as HTMLSelectElement;
      appendGroupedTilesetOptions(tileset, Object.values(project.tilesets));
      tileset.value = spec.tilesetId;
      const parent = el("select", {
        attrs: { "aria-label": "상위 맵" },
        dataset: { testid: "map-create-parent" },
      }) as HTMLSelectElement;
      // 빈 상위는 프로젝트 루트가 아니라 **트리 최상위 노드의 자식**으로 들어간다
      // (mapTree.insertTreeNode: parentId "" → root). 이 저장소의 최상위는 언제나 실제 맵
      // 하나라서 예전 「(루트)」는 없는 계층(형제 최상위 맵)을 약속했다 — 실제로 부모가 되는
      // 맵을 이름으로 밝힌다(OPRN-OUT-027). 저장 구조는 그대로다.
      parent.append(el("option", { text: `${rootParentPrefix(project)}의 하위`, attrs: { value: "" } }));
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
        // 상한 초과는 조용히 줄이지 않고 여기서 거부한다 — 입력 max 속성은 직접 입력·붙여넣기로
        // 넘길 수 있어서 값만 클램프하면 요청과 다른 크기의 맵이 말없이 생겼다(OPRN-OUT-018).
        const requestedWidth = Number(width.value);
        const requestedHeight = Number(height.value);
        if (exceedsMapDimensionLimit(requestedWidth, requestedHeight)) {
          toast(mapSizeLimitMessage(), "error");
          return;
        }
        const id = createMapFromSpec({
          name: name.value,
          width: clampMapSize(requestedWidth, spec.width),
          height: clampMapSize(requestedHeight, spec.height),
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
          field("타일 그림판", tileset),
          field("상위", parent),
          el("p", {
            class: "map-create-hint",
            text: `상위를 고르지 않은 맵은 ${rootParentPrefix(project)}의 하위로 들어갑니다. 나란히 서는 최상위 맵은 만들 수 없습니다.`,
          }),
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

/**
 * 트리 최상위 노드를 사람 말로 — 「(루트)」가 감췄던 실제 부모다.
 * 최상위는 보통 실제 맵이지만 합성 분류가 앉을 수도 있어(mapInspection 의 같은 방어) 낱말을 가른다.
 */
function rootParentPrefix(project: Pick<Project, "mapTree" | "maps">): string {
  const noun = isMapTreeFolder(project.mapTree) ? "분류" : "맵";
  return `최상위 ${noun} 「${mapTreeNodeLabel(project.mapTree, project.maps)}」`;
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
