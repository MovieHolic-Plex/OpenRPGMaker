// editor/panels/canvasBottomDock.ts
// Phase 2 (안 5 × SCMDraft 2):
// 캔버스 좌하단 모드 독 [유닛 U | 오브젝트 O | 지형 T | 1칸] + 각각 정돈된 SCMDraft 2 플로팅 팔레트 창.
// - 유닛: 위로 길게 뜨는 드래그 가능 「유닛 팔레트」 창 (실제 캐릭터 스프라이트 · 분류 탭 · 클릭 점프 · 편집)
// - 오브젝트: 드래그 가능 SCMDraft 2 「오브젝트 팔레트」 창 (그리드/분할 · 검색 · 6분류)
// - 지형: 맥락 적응형 5-크레용 개략도 팔레트 (자연 야외 / 도시 거리 / 실내 / 던전 자동 전환 + 실제 타일 썸네일)
// - 1칸: 구조화된 부분 보정 카드 (스포이트 · 지우개 · 최근 타일 · 원본 시트)

import { editorState, type EditorState } from "@/editor/editorState";
import { shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { recordMapEditIfChanged } from "@/editor/mapEditHistory";
import { resolveCurrentMapId } from "@/editor/mapSelection";
import { mountFloatingDoodadWindow, type FloatingDoodadWindowMount } from "@/editor/panels/floatingDoodadWindow";
import { mountFloatingUnitWindow, type FloatingUnitWindowMount } from "@/editor/panels/floatingUnitWindow";
import { toggleLeftColumn } from "@/editor/panels/leftColumnDrawer";
import { selectSidebarLayer } from "@/editor/panels/leftLayerSwitcher";
import { recentTilesView, TILE_SHORTCUTS_CHANGED_EVENT } from "@/editor/panels/tileBrushTools";
import { selectEyedropperTool, selectMapModeTool, selectTileTool } from "@/editor/panels/tileToolbarActions";
import {
  crayonsForContext,
  detectTerrainContext,
  resolveActiveCrayon,
  TERRAIN_CONTEXT_META,
  TERRAIN_CONTEXT_ORDER,
  type TerrainContextKind,
  type TerrainCrayonDef,
  type TerrainCrayonIconKind,
} from "@/editor/terrainCrayons";
import { brushSizePatch, type TerrainBrushSize, type TerrainLandSize } from "@/editor/terrainLandBrush";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { hasOpenModalLayer } from "@/editor/ui/modalStack";
import { store } from "@/project/store";
import type { GameMap, TilesetDef } from "@/project/types";
import { clearChildren, el } from "@/util/dom";

export const FLOATING_TERRAIN_PALETTE_OPEN_EVENT = "oprn:floating-terrain-palette-open";

type CompactCardId = "terrain" | "spot" | null;

const CRAYON_SIZES: readonly { readonly value: TerrainLandSize; readonly label: string; readonly title: string }[] = [
  { value: 1, label: "작게", title: "작은 붓 (1×1칸) · [ ] 로 조절" },
  { value: 3, label: "보통", title: "보통 붓 (3×3칸) · [ ] 로 조절" },
  { value: 5, label: "크게", title: "큰 붓 (5×5칸) · [ ] 로 조절" },
  { value: "rect", label: "사각형", title: "끌어서 사각형 영역을 한 번에 채우기 (Shift+끌기)" },
];

function crayonSvgMarkup(kind: TerrainCrayonIconKind): string {
  switch (kind) {
    case "hill":
      return '<rect width="48" height="34" fill="#4f883b"/><rect x="4" y="4" width="40" height="12" rx="1" fill="#7ec15a"/><rect x="4" y="16" width="40" height="13" fill="#8b5c34"/><rect x="19" y="16" width="10" height="13" fill="#d4d8de"/><line x1="20" y1="19" x2="28" y2="19" stroke="#5d6470" stroke-width="1.5"/><line x1="20" y1="23" x2="28" y2="23" stroke="#5d6470" stroke-width="1.5"/><line x1="20" y1="27" x2="28" y2="27" stroke="#5d6470" stroke-width="1.5"/>';
    case "forest":
      return '<rect width="48" height="34" fill="#548f3e"/><circle cx="15" cy="14" r="8" fill="#2b672b"/><circle cx="30" cy="11" r="9" fill="#3a8035"/><circle cx="24" cy="21" r="8" fill="#255825"/><circle cx="37" cy="22" r="7" fill="#33732f"/>';
    case "water":
      return '<rect width="48" height="34" fill="#2d74bc"/><rect x="0" y="0" width="48" height="5" fill="#5da652"/><rect x="6" y="12" width="14" height="3" rx="1" fill="#77bffa"/><rect x="24" y="22" width="16" height="3" rx="1" fill="#77bffa"/>';
    case "road":
      return '<rect width="48" height="34" fill="#629e47"/><path d="M5 34 C12 18, 34 16, 43 0" stroke="#c89d66" stroke-width="11" fill="none"/><path d="M5 34 C12 18, 34 16, 43 0" stroke="#e0bd88" stroke-width="4" stroke-dasharray="4 4" fill="none"/>';
    case "asphalt":
      return '<rect width="48" height="34" fill="#464b54"/><line x1="0" y1="17" x2="48" y2="17" stroke="#e8b83d" stroke-width="2" stroke-dasharray="6 4"/><line x1="0" y1="3" x2="48" y2="3" stroke="#9aa3b0" stroke-width="1.5"/><line x1="0" y1="31" x2="48" y2="31" stroke="#9aa3b0" stroke-width="1.5"/>';
    case "sidewalk":
      return '<rect width="48" height="34" fill="#b7b4ac"/><rect x="2" y="2" width="14" height="10" fill="#c7c4bc"/><rect x="18" y="2" width="14" height="10" fill="#aca9a1"/><rect x="34" y="2" width="12" height="10" fill="#c7c4bc"/><rect x="0" y="28" width="48" height="6" fill="#8b8d94"/>';
    case "plaza":
      return '<rect width="48" height="34" fill="#9a7f6c"/><rect x="2" y="2" width="10" height="7" fill="#b3957f"/><rect x="14" y="2" width="10" height="7" fill="#8d7260"/><rect x="26" y="2" width="10" height="7" fill="#b3957f"/><rect x="8" y="12" width="10" height="7" fill="#b3957f"/><rect x="20" y="12" width="10" height="7" fill="#8d7260"/><rect x="32" y="12" width="12" height="7" fill="#b3957f"/>';
    case "park":
      return '<rect width="48" height="34" fill="#5e9a47"/><rect x="0" y="0" width="48" height="4" fill="#3a6e32"/><rect x="0" y="30" width="48" height="4" fill="#3a6e32"/><circle cx="15" cy="17" r="5" fill="#78b85c"/><circle cx="34" cy="17" r="6" fill="#467f37"/>';
    case "wall":
      return '<rect width="48" height="34" fill="#464a54"/><rect x="2" y="2" width="20" height="9" fill="#636976"/><rect x="24" y="2" width="22" height="9" fill="#555b67"/><rect x="10" y="13" width="22" height="9" fill="#636976"/><rect x="2" y="24" width="18" height="8" fill="#555b67"/><rect x="22" y="24" width="24" height="8" fill="#636976"/>';
    case "floor":
      return '<rect width="48" height="34" fill="#b98e59"/><line x1="0" y1="11" x2="48" y2="11" stroke="#8e683b" stroke-width="1.5"/><line x1="0" y1="22" x2="48" y2="22" stroke="#8e683b" stroke-width="1.5"/><line x1="18" y1="0" x2="18" y2="11" stroke="#8e683b" stroke-width="1.5"/><line x1="32" y1="11" x2="32" y2="22" stroke="#8e683b" stroke-width="1.5"/>';
    case "accent":
      return '<rect width="48" height="34" fill="#8f4640"/><rect x="5" y="5" width="38" height="24" fill="none" stroke="#d9a86c" stroke-width="2"/>';
    case "hazard":
      return '<rect width="48" height="34" fill="#c95628"/><rect x="6" y="9" width="14" height="4" rx="2" fill="#f7b249"/><rect x="24" y="21" width="16" height="4" rx="2" fill="#f7b249"/>';
    case "void":
      return '<rect width="48" height="34" fill="#1e222a"/><rect x="5" y="5" width="38" height="24" rx="2" fill="none" stroke="#6c7484" stroke-width="1.5" stroke-dasharray="4 3"/>';
    case "ground":
    default:
      return '<rect width="48" height="34" fill="#68a64b"/><rect x="8" y="8" width="5" height="3" fill="#82c260"/><rect x="28" y="19" width="6" height="3" fill="#82c260"/><rect x="16" y="25" width="5" height="2" fill="#4f8838"/>';
  }
}

function makeCrayonThumb(crayon: TerrainCrayonDef, tileset: TilesetDef | undefined): HTMLElement {
  if (tileset && crayon.previewTile !== null && crayon.previewTile >= 0) {
    return el("span", {
      class: "cbd-crayon-thumb is-tile",
      attrs: { style: tilesetTileBackgroundStyle(tileset, crayon.previewTile, 36), "aria-hidden": "true" },
    });
  }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 48 34");
  svg.setAttribute("class", "cbd-crayon-thumb is-svg");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = crayonSvgMarkup(crayon.iconKind);
  return svg as unknown as HTMLElement;
}

export function mountCanvasBottomDock(canvasArea: HTMLElement): () => void {
  let openCard: CompactCardId = null;
  let contextPickerOpen = false;
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
    contextPickerOpen = false;
    doodadWin?.setOpen(false);
    selectSidebarLayer("event");
    unitWin?.toggle();
    sync();
  });

  const doodadBtn = makeDockButton("doodad", "오브젝트", "O", "플로팅 오브젝트 팔레트 열기/닫기 (O / D)", () => {
    openCard = null;
    contextPickerOpen = false;
    unitWin?.setOpen(false);
    doodadWin?.toggle();
    sync();
  });

  const openTerrainCard = (toggle = true): void => {
    unitWin?.setOpen(false);
    doodadWin?.setOpen(false);
    const nextOpen = toggle ? (openCard === "terrain" ? null : "terrain") : "terrain";
    if (nextOpen === "terrain") {
      selectMapModeTool("relief");
      editorState.set({
        layer: "lower",
        terrainBrush: "crayon",
        reliefDoodad: null,
        reliefDoodadOpen: false,
        terrainDesignOpen: false,
      });
    }
    openCard = nextOpen;
    if (openCard !== "terrain") contextPickerOpen = false;
    sync();
  };

  const terrainBtn = makeDockButton("terrain", "지형", "T", "지형 개략도 5-크레용 팔레트 열기/닫기 (T)", () => {
    openTerrainCard(true);
  });

  const spotBtn = makeDockButton("spot", "1칸", null, "스포이트 · 최근 타일 · 지우개 · 원본 시트", () => {
    unitWin?.setOpen(false);
    doodadWin?.setOpen(false);
    contextPickerOpen = false;
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
      contextPickerOpen = false;
      doodadWin?.setOpen(false);
    }
    sync();
  });

  doodadWin = mountFloatingDoodadWindow(canvasArea, (isOpen) => {
    if (isOpen) {
      openCard = null;
      contextPickerOpen = false;
      unitWin?.setOpen(false);
    }
    sync();
  });

  function currentMapAndTileset(): { map: GameMap | undefined; tileset: TilesetDef | undefined } {
    const project = store.getCurrent();
    const mapId = resolveCurrentMapId();
    const map = mapId ? project.maps[mapId] : undefined;
    return { map, tileset: map ? project.tilesets[map.tilesetId] : undefined };
  }

  function renderTerrainCard(state: EditorState): void {
    clearChildren(compactCard);
    compactCard.classList.add("is-terrain-wide");
    const { map, tileset } = currentMapAndTileset();
    const detected = detectTerrainContext(map, tileset);
    const context: TerrainContextKind = state.terrainContextOverride ?? detected;
    const ctxMeta = TERRAIN_CONTEXT_META[context];
    const crayons = crayonsForContext(context, tileset);
    const active = resolveActiveCrayon(context, tileset, state.terrainCrayonId);

    const pickCrayon = (crayon: TerrainCrayonDef): void => {
      selectMapModeTool("relief");
      editorState.set({
        layer: "lower",
        terrainBrush: "crayon",
        terrainCrayonId: crayon.id,
        terrainPreset: null,
        reliefDoodad: null,
        reliefDoodadOpen: false,
        reliefBridgeStart: null,
        terrainDesignOpen: false,
        terrainPoints: null,
        terrainLandRect: null,
      });
    };

    const ctxButton = el("button", {
      class: "cbd-ctx-pill" + (contextPickerOpen ? " is-active" : ""),
      attrs: {
        type: "button",
        title: "현재 맵 유형에 맞는 지형 크레용 세트(클릭해서 야외·도시·실내·던전 전환)",
        "aria-expanded": String(contextPickerOpen),
      },
      dataset: { testid: "canvas-tray-context-toggle" },
      children: [
        el("span", { text: `${ctxMeta.icon} ${ctxMeta.label}` }),
        el("span", { class: "cbd-ctx-caret", text: contextPickerOpen ? "▴" : "▾" }),
      ],
      on: {
        click: () => {
          contextPickerOpen = !contextPickerOpen;
          sync();
        },
      },
    });

    const SYMMETRY_CYCLE: readonly { readonly value: EditorState["terrainSymmetry"]; readonly label: string; readonly title: string }[] = [
      { value: "none", label: "대칭", title: "대칭 그리기 (클릭할 때마다 없음 → 좌우 → 상하 → 4방향 순환)" },
      { value: "mirrorX", label: "좌우 대칭", title: "좌우 대칭 활성 (클릭 시 상하 대칭으로 전환)" },
      { value: "mirrorY", label: "상하 대칭", title: "상하 대칭 활성 (클릭 시 4방향 대칭으로 전환)" },
      { value: "both", label: "4방향 대칭", title: "좌우·상하 4방향 대칭 활성 (클릭 시 대칭 해제)" },
    ];
    const currentSymIdx = Math.max(0, SYMMETRY_CYCLE.findIndex((s) => s.value === state.terrainSymmetry));
    const currentSym = SYMMETRY_CYCLE[currentSymIdx]!;
    const aiLocked = map?.terrainDesign?.frameLock === true;

    const head = el("div", {
      class: "cbd-card-head",
      children: [
        el("div", {
          class: "cbd-card-head-left",
          children: [
            el("span", { class: "cbd-card-title", text: "지형 개략도" }),
            ctxButton,
          ],
        }),
        el("button", {
          class: "fdw-head-btn",
          attrs: { type: "button", "aria-label": "닫기" },
          text: "✕",
          on: { click: () => { openCard = null; contextPickerOpen = false; sync(); } },
        }),
      ],
    });

    const bodyChildren: HTMLElement[] = [];

    if (contextPickerOpen) {
      const ctxRow = el("div", {
        class: "cbd-ctx-menu",
        attrs: { role: "group", "aria-label": "지형 세트 선택" },
        dataset: { testid: "canvas-tray-context-menu" },
        children: TERRAIN_CONTEXT_ORDER.map((kind) => {
          const meta = TERRAIN_CONTEXT_META[kind];
          const selected = kind === context;
          const isAuto = kind === detected;
          return el("button", {
            class: "cbd-ctx-option" + (selected ? " is-active" : ""),
            attrs: { type: "button", "aria-pressed": String(selected) },
            dataset: { testid: `canvas-tray-context-${kind}` },
            text: isAuto ? `${meta.icon} ${meta.label} (자동)` : `${meta.icon} ${meta.label}`,
            on: {
              click: () => {
                contextPickerOpen = false;
                editorState.set({
                  terrainContextOverride: kind === detected ? null : kind,
                  terrainCrayonId: null,
                  terrainBrush: "crayon",
                });
              },
            },
          });
        }),
      });
      bodyChildren.push(ctxRow);
    }

    const crayonGrid = el("div", {
      class: "cbd-crayon-grid",
      attrs: { role: "group", "aria-label": "지형 크레용 5종" },
    });
    for (const crayon of crayons) {
      const isActive = state.tool === "relief" && state.terrainBrush === "crayon" && !state.reliefDoodad && active.id === crayon.id;
      const unavailable = crayon.kind === "tile" && !crayon.isVoid && (crayon.tileId === null || crayon.tileId < 0);
      crayonGrid.append(el("button", {
        class: "cbd-crayon-card" + (isActive ? " is-active" : ""),
        attrs: {
          type: "button",
          title: `${crayon.label} (${crayon.hotkey}) — ${crayon.hint}`,
          "aria-pressed": String(isActive),
          ...(unavailable ? { disabled: "true" } : {}),
        },
        dataset: { testid: `canvas-tray-crayon-${crayon.id}` },
        children: [
          el("kbd", { class: "cbd-crayon-key", text: crayon.hotkey }),
          makeCrayonThumb(crayon, tileset),
          el("span", { class: "cbd-crayon-name", text: crayon.label }),
          el("span", { class: "cbd-crayon-badge", text: crayon.badge }),
        ],
        on: { click: () => pickCrayon(crayon) },
      }));
    }
    bodyChildren.push(crayonGrid);

    const controlsRow = el("div", {
      class: "cbd-card-row",
      children: [
        el("div", {
          class: "cbd-size-group",
          attrs: { role: "group", "aria-label": "붓 크기" },
          children: [
            el("span", { class: "cbd-row-label", text: "크기" }),
            ...CRAYON_SIZES.map(({ value, label, title }) => el("button", {
              class: "cbd-size-pill" + (state.terrainLandSize === value ? " is-active" : ""),
              attrs: { type: "button", title, "aria-pressed": String(state.terrainLandSize === value) },
              dataset: { testid: `canvas-tray-size-${value}` },
              text: label,
              on: {
                click: () => {
                  if (value === "rect") editorState.set({ terrainLandSize: "rect" });
                  else editorState.set(brushSizePatch(value as TerrainBrushSize));
                },
              },
            })),
          ],
        }),
        el("div", {
          class: "cbd-action-group",
          children: [
            el("button", {
              class: "cbd-chip" + (state.terrainSymmetry !== "none" ? " is-active" : ""),
              attrs: { type: "button", title: currentSym.title, "aria-pressed": String(state.terrainSymmetry !== "none") },
              dataset: { testid: "canvas-tray-symmetry" },
              text: currentSym.label,
              on: {
                click: () => {
                  const next = SYMMETRY_CYCLE[(currentSymIdx + 1) % SYMMETRY_CYCLE.length]!;
                  editorState.set({ terrainSymmetry: next.value });
                },
              },
            }),
            el("button", {
              class: "cbd-chip" + (aiLocked ? " is-active" : ""),
              attrs: {
                type: "button",
                title: "내가 그린 지형 골격을 조수(AI)가 덮어쓰지 못하게 잠급니다 (내 브러시는 그대로 편집 가능)",
                "aria-pressed": String(aiLocked),
              },
              dataset: { testid: "canvas-tray-ai-lock" },
              text: aiLocked ? "🔒 AI잠금" : "AI잠금",
              on: {
                click: () => {
                  if (!map) return;
                  const nextOn = map.terrainDesign?.frameLock !== true;
                  recordMapEditIfChanged(
                    map.id,
                    () => store.updateMap(map.id, (draft) => {
                      const nextDesign = { ...draft.terrainDesign };
                      if (nextOn) nextDesign.frameLock = true;
                      else delete nextDesign.frameLock;
                      draft.terrainDesign = Object.keys(nextDesign).length ? nextDesign : undefined;
                    }, { label: nextOn ? "AI 지형 잠금" : "AI 지형 잠금 해제" }),
                    { label: nextOn ? "AI 지형 잠금" : "AI 지형 잠금 해제" },
                  );
                },
              },
            }),
            el("button", {
              class: "cbd-chip" + (state.terrainReachability ? " is-active" : ""),
              attrs: { type: "button", title: "시작 위치에서 걸어서 갈 수 있는 땅을 초록·빨강으로 확인", "aria-pressed": String(state.terrainReachability) },
              dataset: { testid: "canvas-tray-reachability" },
              text: "통행 확인",
              on: { click: () => editorState.set({ terrainReachability: !editorState.get().terrainReachability }) },
            }),
          ],
        }),
      ],
    });
    bodyChildren.push(controlsRow);

    const foot = el("div", {
      class: "cbd-card-foot",
      children: [
        el("span", { class: "cbd-foot-main", text: active.hint }),
        el("span", { class: "cbd-foot-sub", text: `우클릭: ${ctxMeta.eraserLabel}` }),
      ],
    });

    compactCard.append(head, el("div", { class: "cbd-card-body", children: bodyChildren }), foot);
  }

  function renderSpotCard(state: EditorState): void {
    const { tileset } = currentMapAndTileset();
    clearChildren(compactCard);
    compactCard.classList.remove("is-terrain-wide");

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

    // 지형 크레용 카드가 열려 있을 때는 중복된 하단 힌트 띠를 숨긴다.
    const hintDock = canvasArea.querySelector<HTMLElement>(".relief-bar-dock");
    if (hintDock) hintDock.hidden = openCard === "terrain";
  }

  const onOpenTerrainEvent = (): void => {
    openTerrainCard(false);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented || hasOpenModalLayer() || shouldIgnoreEditorShortcut(event)) return;
    if (!event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.code === "KeyT") {
      event.preventDefault();
      openTerrainCard(true);
    }
  };

  const unsubEditor = editorState.subscribe(() => sync());
  const unsubStore = store.subscribe(() => {
    if (openCard === "spot" || openCard === "terrain") sync();
  });
  const onRecentChange = (): void => {
    if (openCard === "spot") sync();
  };
  window.addEventListener(TILE_SHORTCUTS_CHANGED_EVENT, onRecentChange);
  window.addEventListener(FLOATING_TERRAIN_PALETTE_OPEN_EVENT, onOpenTerrainEvent);
  document.addEventListener("keydown", onKeyDown);

  canvasArea.append(dock);
  sync();

  return () => {
    unsubEditor();
    unsubStore();
    window.removeEventListener(TILE_SHORTCUTS_CHANGED_EVENT, onRecentChange);
    window.removeEventListener(FLOATING_TERRAIN_PALETTE_OPEN_EVENT, onOpenTerrainEvent);
    document.removeEventListener("keydown", onKeyDown);
    unitWin?.dispose();
    unitWin = null;
    doodadWin?.dispose();
    doodadWin = null;
    dock.remove();
  };
}
