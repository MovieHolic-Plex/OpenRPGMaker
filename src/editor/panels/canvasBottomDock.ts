// editor/panels/canvasBottomDock.ts
// Phase 2 (안 5 × SCMDraft 2):
// 캔버스 좌하단 모드 독 [유닛 U | 두댓 D | 지형 | 1칸] + 각각 정돈된 SCMDraft 2 플로팅 팔레트 창.
// - 유닛: 위로 길게 뜨는 드래그 가능 「유닛 팔레트」 창 (실제 캐릭터 스프라이트 · 분류 탭 · 클릭 점프 · 편집)
// - 두댓: 드래그 가능 SCMDraft 2 「두댓 팔레트」 창 (그리드/분할 · 검색 · 5분류)
// - 지형: 구조화된 스타크래프트식 지형 붓 카드 (땅 칸 4종 + 길 + 붓 크기 1·3·5·7 + 통행 보기)
// - 1칸: 구조화된 부분 보정 카드 (스포이트 · 지우개 · 최근 타일 · 원본 시트)

import { editorState, type EditorState } from "@/editor/editorState";
import { resolveCurrentMapId } from "@/editor/mapSelection";
import { mountFloatingDoodadWindow, type FloatingDoodadWindowMount } from "@/editor/panels/floatingDoodadWindow";
import { mountFloatingUnitWindow, type FloatingUnitWindowMount } from "@/editor/panels/floatingUnitWindow";
import { toggleLeftColumn } from "@/editor/panels/leftColumnDrawer";
import { selectSidebarLayer } from "@/editor/panels/leftLayerSwitcher";
import { recentTilesView, TILE_SHORTCUTS_CHANGED_EVENT } from "@/editor/panels/tileBrushTools";
import { selectEyedropperTool, selectMapModeTool, selectTileTool } from "@/editor/panels/tileToolbarActions";
import { selectTerrainDesignTool } from "@/editor/terrainDesignActions";
import { brushSizePatch, TERRAIN_BRUSH_SIZES, TERRAIN_LANDS, type TerrainBrushSize, type TerrainLand } from "@/editor/terrainLandBrush";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

type CompactCardId = "terrain" | "spot" | null;

export function mountCanvasBottomDock(canvasArea: HTMLElement): () => void {
  let openCard: CompactCardId = null;
  let unitWin: FloatingUnitWindowMount | null = null;
  let doodadWin: FloatingDoodadWindowMount | null = null;

  const compactCard = el("section", {
    class: "cbd-card",
    attrs: { role: "dialog", "aria-label": "빠른 도구 패널" },
    dataset: { testid: "canvas-bottom-tray" },
  });
  compactCard.hidden = true;

  const makeDockButton = (id: string, label: string, hotkey: string | null, title: string, onClick: () => void): HTMLButtonElement =>
    el("button", {
      class: "cbd-btn",
      attrs: { type: "button", title, "aria-pressed": "false" },
      dataset: { testid: `canvas-dock-${id}` },
      children: [
        el("span", { text: label }),
        ...(hotkey ? [el("kbd", { class: "cbd-btn-kbd", text: hotkey })] : []),
      ],
      on: { click: onClick },
    }) as HTMLButtonElement;

  const unitBtn = makeDockButton("unit", "유닛", "U", "유닛 팔레트 열기/닫기 (U)", () => {
    openCard = null;
    doodadWin?.setOpen(false);
    selectSidebarLayer("event");
    unitWin?.toggle();
    sync();
  });

  const doodadBtn = makeDockButton("doodad", "두댓", "D", "SCMDraft 2 두댓 팔레트 열기/닫기 (D)", () => {
    openCard = null;
    unitWin?.setOpen(false);
    doodadWin?.toggle();
    sync();
  });

  const terrainBtn = makeDockButton("terrain", "지형", null, "스타크래프트식 땅 칸 · 길 · 붓 크기", () => {
    unitWin?.setOpen(false);
    doodadWin?.setOpen(false);
    selectMapModeTool("relief");
    editorState.set({ layer: "lower", reliefDoodad: null, reliefDoodadOpen: false });
    openCard = openCard === "terrain" ? null : "terrain";
    sync();
  });

  const spotBtn = makeDockButton("spot", "1칸", null, "스포이트 · 최근 타일 · 지우개 · 원본 시트", () => {
    unitWin?.setOpen(false);
    doodadWin?.setOpen(false);
    openCard = openCard === "spot" ? null : "spot";
    sync();
  });

  const dock = el("nav", {
    class: "canvas-bottom-dock",
    attrs: { "aria-label": "캔버스 빠른 도구 독" },
    dataset: { testid: "canvas-bottom-dock" },
    children: [
      compactCard,
      el("div", {
        class: "cbd-bar",
        children: [
          unitBtn,
          doodadBtn,
          terrainBtn,
          el("span", { class: "cbd-sep", attrs: { "aria-hidden": "true" } }),
          spotBtn,
        ],
      }),
    ],
  });

  unitWin = mountFloatingUnitWindow(canvasArea, (isOpen) => {
    if (isOpen) {
      openCard = null;
      doodadWin?.setOpen(false);
    }
    sync();
  });

  doodadWin = mountFloatingDoodadWindow(canvasArea, (isOpen) => {
    if (isOpen) {
      openCard = null;
      unitWin?.setOpen(false);
    }
    sync();
  });

  function currentTileset(): TilesetDef | undefined {
    const project = store.getCurrent();
    const mapId = resolveCurrentMapId();
    const map = mapId ? project.maps[mapId] : undefined;
    return map ? project.tilesets[map.tilesetId] : undefined;
  }

  function renderTerrainCard(state: EditorState): void {
    clearChildren(compactCard);
    const pickLand = (land: TerrainLand): void => {
      selectMapModeTool("relief");
      editorState.set({
        layer: "lower",
        terrainBrush: "land",
        terrainLand: land,
        terrainLandStep: null,
        terrainPreset: null,
        reliefDoodad: null,
        reliefDoodadOpen: false,
        reliefBridgeStart: null,
        terrainDesignOpen: false,
      });
    };

    const head = el("div", {
      class: "cbd-card-head",
      children: [
        el("span", { class: "cbd-card-title", text: "지형 붓" }),
        el("button", {
          class: "fdw-head-btn",
          attrs: { type: "button", "aria-label": "닫기" },
          text: "✕",
          on: { click: () => { openCard = null; sync(); } },
        }),
      ],
    });

    const landGrid = el("div", { class: "cbd-land-grid" });
    for (const { land, label, key, color } of TERRAIN_LANDS) {
      const active = state.tool === "relief" && state.terrainBrush === "land" && state.terrainLand === land;
      landGrid.append(el("button", {
        class: "cbd-land-tile" + (active ? " is-active" : ""),
        attrs: { type: "button", title: `${label} (${key}) — 끌면 그 높이/물로 맞춤` },
        dataset: { testid: `canvas-tray-land-${land}` },
        children: [
          el("span", { class: "cbd-land-swatch", attrs: { style: `background:${color}`, "aria-hidden": "true" } }),
          el("span", { class: "cbd-land-label", text: label }),
          el("kbd", { class: "cbd-land-key", text: key }),
        ],
        on: { click: () => pickLand(land) },
      }));
    }

    const roadActive = state.tool === "relief" && state.terrainBrush === "road";
    const controlsRow = el("div", {
      class: "cbd-card-row",
      children: [
        el("div", {
          class: "cbd-size-group",
          attrs: { role: "group", "aria-label": "붓 크기" },
          children: [
            el("span", { class: "cbd-row-label", text: "크기" }),
            ...TERRAIN_BRUSH_SIZES.map((size) => el("button", {
              class: "cbd-size-btn" + (state.terrainLandSize === size ? " is-active" : ""),
              attrs: { type: "button", title: `붓 크기 ${size}×${size}` },
              text: String(size),
              on: { click: () => editorState.set(brushSizePatch(size as TerrainBrushSize)) },
            })),
          ],
        }),
        el("div", {
          class: "cbd-action-group",
          children: [
            el("button", {
              class: "cbd-chip" + (roadActive ? " is-active" : ""),
              attrs: { type: "button", title: "길 긋기 붓" },
              text: "길 붓",
              on: {
                click: () => {
                  selectMapModeTool("relief");
                  selectTerrainDesignTool("road");
                  editorState.set({ terrainRoadDrag: true, terrainDesignOpen: false });
                },
              },
            }),
            el("button", {
              class: "cbd-chip" + (state.terrainReachability ? " is-active" : ""),
              attrs: { type: "button", title: "시작 위치에서 걸어서 닿는 땅 표시" },
              text: "통행 보기",
              on: { click: () => editorState.set({ terrainReachability: !editorState.get().terrainReachability }) },
            }),
          ],
        }),
      ],
    });

    const foot = el("div", {
      class: "cbd-card-foot",
      text: "우클릭: 낮은 땅 · Shift+끌기: 사각형 · [ ] 크기",
    });

    compactCard.append(head, el("div", { class: "cbd-card-body", children: [landGrid, controlsRow] }), foot);
  }

  function renderSpotCard(state: EditorState): void {
    const tileset = currentTileset();
    clearChildren(compactCard);

    const head = el("div", {
      class: "cbd-card-head",
      children: [
        el("span", { class: "cbd-card-title", text: "1칸 부분 보정" }),
        el("button", {
          class: "fdw-head-btn",
          attrs: { type: "button", "aria-label": "닫기" },
          text: "✕",
          on: { click: () => { openCard = null; sync(); } },
        }),
      ],
    });

    const toolsRow = el("div", {
      class: "cbd-card-row",
      children: [
        el("button", {
          class: "cbd-chip" + (state.tool === "eyedropper" ? " is-active" : ""),
          attrs: { type: "button", title: "타일 스포이트 (I)" },
          text: "스포이트 (I)",
          on: { click: () => selectEyedropperTool() },
        }),
        el("button", {
          class: "cbd-chip" + (state.tool === "erase" ? " is-active" : ""),
          attrs: { type: "button", title: "지우개 (E)" },
          text: "지우개 (E)",
          on: { click: () => selectTileTool("erase") },
        }),
        el("button", {
          class: "cbd-chip",
          attrs: { type: "button", title: "기존 전체 타일 팔레트(왼쪽 열) 열기/닫기" },
          text: "원본 시트 ◧",
          on: { click: () => { openCard = null; toggleLeftColumn(); sync(); } },
        }),
      ],
    });

    const recents = recentTilesView().slice(0, 8);
    const recentBlock = el("div", { class: "cbd-recent-block" });
    recentBlock.append(el("span", { class: "cbd-row-label", text: "최근 타일" }));
    if (tileset && recents.length > 0) {
      const strip = el("div", { class: "cbd-recent-strip" });
      for (const tileIndex of recents) {
        strip.append(el("button", {
          class: "cbd-tile-swatch" + (state.tool === "paint" && state.selectedTile === tileIndex ? " is-active" : ""),
          attrs: { type: "button", title: `최근 타일 #${tileIndex}`, style: tilesetTileBackgroundStyle(tileset, tileIndex, 28) },
          on: { click: () => editorState.set({ selectedTile: tileIndex, tool: "paint", activePaletteStamp: null }) },
        }));
      }
      recentBlock.append(strip);
    } else {
      recentBlock.append(el("span", { class: "cbd-more", text: "스포이트(I)로 맵 타일을 찍으면 여기 모입니다" }));
    }

    compactCard.append(head, el("div", { class: "cbd-card-body", children: [toolsRow, recentBlock] }));
  }

  function sync(): void {
    const state = editorState.get();
    const unitOpen = unitWin?.isOpen() ?? false;
    const doodadOpen = doodadWin?.isOpen() ?? false;
    const isUnit = unitOpen || (!doodadOpen && openCard === null && state.layer === "event");
    const isTerrain = openCard === "terrain" || (!unitOpen && !doodadOpen && state.tool === "relief" && !state.reliefDoodad);
    const isSpot = openCard === "spot";

    unitBtn.classList.toggle("is-active", isUnit);
    unitBtn.setAttribute("aria-pressed", String(unitOpen));
    doodadBtn.classList.toggle("is-active", doodadOpen || Boolean(state.activePaletteStamp) || Boolean(state.reliefDoodad));
    doodadBtn.setAttribute("aria-pressed", String(doodadOpen));
    terrainBtn.classList.toggle("is-active", isTerrain);
    terrainBtn.setAttribute("aria-pressed", String(openCard === "terrain"));
    spotBtn.classList.toggle("is-active", isSpot);
    spotBtn.setAttribute("aria-pressed", String(isSpot));

    compactCard.hidden = openCard === null;
    if (openCard === "terrain") renderTerrainCard(state);
    else if (openCard === "spot") renderSpotCard(state);
  }

  const unsubEditor = editorState.subscribe(() => sync());
  const unsubStore = store.subscribe(() => {
    if (openCard === "spot") sync();
  });
  const onRecentChange = (): void => {
    if (openCard === "spot") sync();
  };
  window.addEventListener(TILE_SHORTCUTS_CHANGED_EVENT, onRecentChange);

  canvasArea.append(dock);
  sync();

  return () => {
    unsubEditor();
    unsubStore();
    window.removeEventListener(TILE_SHORTCUTS_CHANGED_EVENT, onRecentChange);
    unitWin?.dispose();
    unitWin = null;
    doodadWin?.dispose();
    doodadWin = null;
    dock.remove();
  };
}
