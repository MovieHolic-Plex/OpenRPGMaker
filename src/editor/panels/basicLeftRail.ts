// editor/panels/basicLeftRail.ts
// 기본 모드 좌측 레일 — 레퍼런스(starter) 밀도로 도구·타일·레이어를 단순 표시.
// 이벤트 편집 경로는 유지. 맵 트리는 editor.ts 맵 루트에서 별도 렌더.

import { editorState, type Layer, type Tool } from "@/editor/editorState";
import { TILE_SIZE } from "@/assets/bundled";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

type BasicTool = {
  readonly id: Tool;
  readonly label: string;
  readonly hint: string;
};

// 레퍼런스 밀도의 핵심 도구 + 이벤트(요구사항: basic에서도 이벤트 편집 가능).
const BASIC_TOOLS: readonly BasicTool[] = [
  { id: "select", label: "선택", hint: "영역 선택" },
  { id: "paint", label: "브러시", hint: "타일 칠하기" },
  { id: "erase", label: "지우개", hint: "현재 레이어 지우기" },
  { id: "fill", label: "채우기", hint: "영역 채우기" },
  { id: "event", label: "이벤트", hint: "이벤트 배치·편집" },
  { id: "eyedropper", label: "스포이트", hint: "맵에서 타일 집기" },
] as const;

type BasicLayerRow = {
  readonly id: Layer;
  readonly label: string;
  readonly hint: string;
};

// 레퍼런스 레이어 목록 톤: 타일=하위, 오브젝트=상위, 이벤트 유지.
const BASIC_LAYERS: readonly BasicLayerRow[] = [
  { id: "event", label: "이벤트", hint: "이벤트 레이어" },
  { id: "upper", label: "오브젝트", hint: "상위(오브젝트) 레이어" },
  { id: "lower", label: "타일", hint: "하위(지면) 레이어" },
] as const;

const BASIC_TILE_CAP = 48;

export function renderBasicLeftRail(container: HTMLElement): void {
  clearChildren(container);
  const state = editorState.get();
  const project = store.getCurrent();
  const mapId = state.currentMapId ?? project.startMapId;
  const map = project.maps[mapId];
  const shell = el("div", {
    class: "basic-left-rail",
    dataset: { testid: "basic-left-rail", uiDensity: "basic" },
  });

  shell.append(makeToolsSection(state.tool));
  if (!map) {
    shell.append(el("div", { class: "empty-hint", text: "맵을 선택하세요." }));
    container.append(shell);
    return;
  }
  const tileset = project.tilesets[map.tilesetId];
  if (!tileset) {
    shell.append(el("div", { class: "empty-hint", text: "타일셋이 없습니다." }));
    container.append(shell);
    return;
  }

  if (state.layer === "event") {
    shell.append(
      el("div", {
        class: "basic-rail-hint",
        text: "이벤트 레이어 — 맵에서 이벤트를 클릭하거나 빈 칸에 배치하세요.",
        dataset: { testid: "basic-event-layer-hint" },
      }),
    );
  } else {
    shell.append(makeTilesSection(state.selectedTile, tileset));
  }
  shell.append(makeLayersSection(state.layer));
  container.append(shell);
}

function makeToolsSection(activeTool: Tool): HTMLElement {
  const section = el("section", {
    class: "basic-rail-section",
    dataset: { testid: "basic-tools-section" },
  });
  section.append(el("h3", { class: "basic-rail-title", text: "도구" }));
  const list = el("div", { class: "basic-tool-list", dataset: { testid: "basic-tool-list" } });
  for (const tool of BASIC_TOOLS) {
    const active = activeTool === tool.id;
    list.append(
      el("button", {
        class: "basic-tool-row" + (active ? " is-active" : ""),
        attrs: {
          type: "button",
          title: tool.hint,
          "aria-label": tool.label,
          "aria-pressed": String(active),
        },
        dataset: { testid: `tool-${tool.id}`, basicTool: tool.id },
        on: {
          click: () => {
            if (tool.id === "paint") editorState.set({ tool: "paint", paintShape: "pen" });
            else if (tool.id === "event") editorState.set({ tool: "event", layer: "event" });
            else editorState.set({ tool: tool.id });
          },
        },
        children: [
          el("span", { class: "basic-tool-label", text: tool.label }),
        ],
      }),
    );
  }
  section.append(list);
  return section;
}

function makeTilesSection(selectedTile: number, tileset: TilesetDef): HTMLElement {
  const section = el("section", {
    class: "basic-rail-section",
    dataset: { testid: "basic-tiles-section" },
  });
  const head = el("div", { class: "basic-rail-head" });
  head.append(el("h3", { class: "basic-rail-title", text: "타일" }));
  head.append(
    el("span", {
      class: "basic-tileset-name",
      text: tileset.name,
      attrs: { title: tileset.name },
      dataset: { testid: "palette-tileset-name" },
    }),
  );
  section.append(head);

  const selectedLabel =
    selectedTile >= 0 && selectedTile < tileset.count
      ? `${selectedTile} ${tileDisplayLabelForIndex(selectedTile)}`
      : "없음";
  section.append(
    el("div", {
      class: "basic-selected-tile",
      text: selectedLabel,
      dataset: { testid: "selected-tile-status" },
    }),
  );

  const grid = el("div", { class: "basic-tile-grid", dataset: { testid: "basic-tile-grid" } });
  const indexes = pickBasicTileIndexes(tileset, selectedTile);
  for (const index of indexes) {
    const active = index === selectedTile;
    const cellSize = TILE_SIZE * 2;
    const cell = el("button", {
      class: "basic-tile-cell" + (active ? " is-active" : ""),
      attrs: {
        type: "button",
        title: `${index} ${tileDisplayLabelForIndex(index)}`,
        "aria-label": `타일 ${index}`,
        "aria-pressed": String(active),
        style: `width:${cellSize}px;height:${cellSize}px;${tilesetTileBackgroundStyle(tileset, index, cellSize)}`,
      },
      dataset: { testid: `basic-tile-${index}`, tileIndex: String(index) },
      on: {
        click: () => {
          const layer = editorState.get().layer === "event" ? "lower" : editorState.get().layer;
          editorState.set({ selectedTile: index, tool: "paint", paintShape: "pen", layer });
        },
      },
    });
    grid.append(cell);
  }
  if (indexes.length === 0) {
    grid.append(el("div", { class: "empty-hint", text: "표시할 타일이 없습니다." }));
  }
  section.append(grid);
  return section;
}

function makeLayersSection(activeLayer: Layer): HTMLElement {
  const section = el("section", {
    class: "basic-rail-section",
    dataset: { testid: "basic-layers-section" },
  });
  section.append(el("h3", { class: "basic-rail-title", text: "레이어" }));
  const list = el("div", { class: "basic-layer-list", dataset: { testid: "basic-layer-list" } });
  for (const layer of BASIC_LAYERS) {
    const active = activeLayer === layer.id;
    list.append(
      el("button", {
        class: "basic-layer-row" + (active ? " is-active" : ""),
        attrs: {
          type: "button",
          title: layer.hint,
          "aria-label": layer.label,
          "aria-pressed": String(active),
        },
        dataset: {
          testid: layer.id === "lower" ? "layer-lower" : layer.id === "upper" ? "layer-upper" : "layer-event",
          basicLayer: layer.id,
        },
        on: {
          click: () => {
            if (layer.id === "event") editorState.set({ layer: "event", tool: "event" });
            else editorState.set({ layer: layer.id, tool: editorState.get().tool === "event" ? "paint" : editorState.get().tool });
          },
        },
        children: [el("span", { class: "basic-layer-label", text: layer.label })],
      }),
    );
  }
  section.append(list);
  return section;
}

/** Prefer terrain-looking low indexes + keep current selection visible. */
function pickBasicTileIndexes(tileset: TilesetDef, selectedTile: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const push = (n: number): void => {
    if (n < 0 || n >= tileset.count || seen.has(n)) return;
    seen.add(n);
    out.push(n);
  };
  if (selectedTile >= 0) push(selectedTile);
  // Common grass/path/water-ish early ids first, then stride sample.
  for (let i = 0; i < Math.min(tileset.count, 80); i += 1) push(i);
  for (let i = 80; i < tileset.count && out.length < BASIC_TILE_CAP; i += 8) push(i);
  return out.slice(0, BASIC_TILE_CAP);
}
