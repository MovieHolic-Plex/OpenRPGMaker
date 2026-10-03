// 「높이」 막대 — 캔버스 아래 가운데에 뜨는 아이콘 막대와 지형지물 팝업(스타크래프트 에디터의 두데드 창).
// 높이 붓 방식·크기·상한·윗면 풀·절벽 양식을 여기서 고른다(예전 왼쪽 팔레트의 글자 칩 8개를 옮겼다).
// 붓 동작은 TilePaintEngine.applyRelief, 지형지물 판정은 reliefDoodads.ts, 고스트는 editSceneHoverPreview.ts.

import "@/styles/editor/relief-toolbar.css";
import { editorState, type EditorState } from "@/editor/editorState";
import { installDelayedTooltips } from "@/editor/delayedTooltipRollout";
import { hideDelayedTooltip } from "@/editor/delayedTooltip";
import { shouldIgnoreEditorShortcut } from "@/editor/hotkeys";
import { recordMapEditIfChanged } from "@/editor/mapEditHistory";
import { renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { setReliefStyle, reliefTopGrassTile } from "@/editor/reliefActions";
import { reliefInverseMode } from "@/editor/reliefBrushMode";
import {
  RELIEF_DOODAD_HOVER_EVENT, RELIEF_DOODAD_TABS, reliefDoodadCatalog,
  type ReliefDoodad, type ReliefDoodadHoverDetail, type ReliefDoodadTab,
} from "@/editor/reliefDoodads";
import type { ReliefBrushMode } from "@/project/relief/edit";
import { reliefIsFlat } from "@/project/relief/edit";
import { RELIEF_ROUGH_RADII, type ReliefRoughSize } from "@/project/relief/roughBrush";
import { RELIEF_STYLES } from "@/project/relief/styles";
import { RELIEF_MAX_LEVEL } from "@/project/relief/types";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";
import { terrainMaterialTile, MATERIAL_LABEL, type TerrainMaterial } from "@/editor/terrainMaterials";
import { deleteDoodadGroup } from "@/editor/terrainClusters";

const MODES: readonly (readonly [ReliefBrushMode, string, string, string])[] = [
  ["raise", "올리기", "누르고 있으면 계속 쌓인다", '<path d="M4 18h16M7 14l5-8 5 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'],
  ["lower", "내리기", "누르고 있으면 계속 판다", '<path d="M4 6h16M7 10l5 8 5-8" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'],
  ["flatten", "평탄", "처음 누른 칸 높이로 고른다", '<path d="M3 12h18M3 17h18" stroke="currentColor" stroke-width="2"/><path d="M8 7l4-3 4 3" fill="none" stroke="currentColor" stroke-width="1.6"/>'],
  ["set", "단 지정", "상한 단으로 맞춘다", '<rect x="4" y="13" width="16" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 13V9h8v4M10 9V5h4v4" fill="none" stroke="currentColor" stroke-width="1.8"/>'],
  ["mountain", "산", "상한 단 봉우리를 한 번에 — 끌면 능선", '<path d="M2 20l7-12 4 6 3-4 6 10z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'],
  ["canyon", "골짜기", "0단까지 판다 — 끌면 골", '<path d="M2 6h6l3 12h2l3-12h6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'],
  ["smooth", "다듬기", "주변 평균으로 부드럽게", '<path d="M3 15c3-6 6-6 9 0s6 6 9 0" fill="none" stroke="currentColor" stroke-width="2"/>'],
  ["rough", "거칠게", "절벽 가장자리를 들쭉날쭉 깎는다", '<path d="M3 16l3-5 2 3 3-6 2 4 3-5 2 6 3-3" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>'],
];
const MODE_LABEL = Object.fromEntries(MODES.map(([mode, label]) => [mode, label])) as Record<ReliefBrushMode, string>;

/** 오른쪽 버튼이 하는 일 — reliefInverseMode 와 같은 표를 글로 옮긴다. */
function rightButtonLabel(mode: ReliefBrushMode): string {
  const inverse = reliefInverseMode(mode);
  return inverse === "set" ? "0단으로 지우기" : MODE_LABEL[inverse];
}

/** 절벽 양식 이름(RELIEF_STYLES 키 → 사람 말). 모르는 키는 키 그대로. */
const STYLE_LABELS: Readonly<Record<string, string>> = {
  "grass-cliff": "풀 절벽", jungle: "정글", tropical: "열대", skyisle: "하늘섬", swamp: "늪", "swamp-peat": "이탄 늪", "swamp-dead": "죽은 늪",
  plague: "역병", mushroom: "버섯", savanna: "사바나", badlands: "황무지", saltflat: "소금 평원", desert: "사막", sandstone: "사암",
  dune: "모래 언덕", "desert-cut": "사막 깎은 길", "dune-cut": "모래 깎은 길", tundra: "툰드라", "tundra-snow": "눈 덮인 툰드라", taiga: "타이가",
  elf: "엘프", gothic: "고딕", holy: "신전", steampunk: "증기", dwarf: "드워프", blight: "마른 땅", crystal: "수정",
};

const SIZES: readonly ReliefRoughSize[] = ["S", "M", "L", "XL"];

function svgIcon(path: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = path;
  return svg;
}

function currentMapAndTileset(): { readonly mapId: string | null; readonly tileset: TilesetDef | undefined; readonly hasRelief: boolean; readonly style: string | null } {
  const project = store.getCurrent();
  const mapId = editorState.get().currentMapId ?? project.startMapId ?? null;
  const map = mapId ? project.maps[mapId] : undefined;
  return {
    mapId: map ? mapId : null,
    tileset: map ? project.tilesets[map.tilesetId] : undefined,
    hasRelief: !!map?.relief && !reliefIsFlat(map.relief),
    style: map?.relief?.style ?? null,
  };
}

/** 경사로·계단 견본 그림 — 칩셋과 무관하므로 직접 그린다. */
function rampThumb(stairs: boolean): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 48; canvas.height = 36;
  const g = canvas.getContext("2d");
  if (!g) return canvas;
  g.fillStyle = "#6aa845"; g.fillRect(0, 0, 48, 36);
  g.fillStyle = "#7cbc52"; g.fillRect(0, 0, 48, 12);
  g.fillStyle = "#8a5a32"; g.fillRect(0, 12, 48, 12);
  g.fillStyle = "#6e4424"; g.fillRect(0, 21, 48, 3);
  g.fillStyle = stairs ? "#b5b2a8" : "#c49a62"; g.fillRect(14, 10, 20, 26);
  g.fillStyle = stairs ? "#7b786f" : "#a37a45";
  if (stairs) for (let i = 1; i < 5; i++) g.fillRect(14, 10 + i * 5, 20, 2);
  else for (let i = 0; i < 4; i++) { g.fillRect(17 + i, 14 + i * 5, 2, 1); g.fillRect(29 - i, 16 + i * 5, 2, 1); }
  g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(14, 10, 1, 26); g.fillRect(33, 10, 1, 26);
  return canvas;
}

function doodadThumb(doodad: ReliefDoodad, tileset: TilesetDef | undefined): HTMLCanvasElement {
  if (doodad.kind === "bridge") {
    const canvas = rampThumb(false);
    const g = canvas.getContext("2d");
    if (g) {
      g.fillStyle = "#6e4424"; g.fillRect(0, 12, 48, 24);
      g.fillStyle = "#b79361";
      if (doodad.axis === "horizontal") {
        g.fillRect(0, 16, 48, 12);
        g.fillStyle = "#795637";
        for (let x = 3; x < 48; x += 6) g.fillRect(x, 16, 1, 12);
      } else {
        g.fillRect(14, 0, 20, 36);
        g.fillStyle = "#795637";
        for (let y = 3; y < 36; y += 6) g.fillRect(14, y, 20, 1);
      }
    }
    return canvas;
  }
  if (doodad.kind === "ramp" || !tileset) return rampThumb(doodad.kind === "ramp" && doodad.stairs);
  const { kit } = doodad;
  const cells = [];
  for (let dy = 0; dy < kit.height; dy++) for (let dx = 0; dx < kit.width; dx++) {
    const tile = kit.rows[dy]?.upperTiles?.[dx] ?? -1;
    if (tile >= 0) cells.push({ dx, dy, layer: "upper" as const, tile });
  }
  const canvas = renderTileCellsToCanvas({
    tileset, widthTiles: kit.width, heightTiles: kit.height, cells, scale: 1,
    backgroundTile: doodad.kind === "wall" ? null : reliefTopGrassTile(tileset) ?? null,
  });
  return canvas;
}

/**
 * 캔버스 영역에 높이 막대를 붙인다. 「높이」 도구일 때만 보인다. 해제 함수를 돌려준다.
 */
export function mountReliefToolbar(canvasArea: HTMLElement): () => void {
  const hint = el("div", { class: "relief-bar-hint", dataset: { testid: "relief-brush-hint" } });
  const modes = el("div", { class: "relief-bar-group", attrs: { role: "group", "aria-label": "높이 붓 방식" } });
  const modeButtons = new Map<ReliefBrushMode, HTMLButtonElement>();
  for (const [mode, label, help, path] of MODES) {
    const button = el("button", {
      class: "relief-bar-icon",
      attrs: { type: "button", "aria-label": label, "aria-pressed": "false", title: `${label} · ${help} · 오른쪽 버튼: ${rightButtonLabel(mode)}` },
      dataset: { testid: `relief-mode-${mode}` },
      children: [svgIcon(path)],
      on: { click: () => editorState.set({ reliefMode: mode, reliefDoodad: null, terrainBrush: "height", reliefBridgeStart: null }) },
    }) as HTMLButtonElement;
    modeButtons.set(mode, button);
    modes.append(button);
  }
  const sizes = el("div", { class: "relief-bar-group", attrs: { role: "group", "aria-label": "높이 붓 크기" } });
  const sizeButtons = new Map<ReliefRoughSize, HTMLButtonElement>();
  for (const size of SIZES) {
    const button = el("button", {
      class: "relief-bar-size", text: size,
      attrs: { type: "button", title: `붓 반지름 ${RELIEF_ROUGH_RADII[size]}칸`, "aria-pressed": "false" },
      dataset: { testid: `relief-size-${size}` },
      on: { click: () => editorState.set({ reliefRoughSize: size }) },
    }) as HTMLButtonElement;
    sizeButtons.set(size, button);
    sizes.append(button);
  }
  const levelValue = el("b", { class: "relief-bar-level-value", dataset: { testid: "relief-level-value" } });
  const level = el("div", {
    class: "relief-bar-level",
    attrs: { title: "이 단까지 쌓는다 — 산·단 지정은 이 단이 봉우리" },
    children: [
      el("span", { text: "상한" }),
      el("button", { text: "−", attrs: { type: "button", "aria-label": "상한 한 단 낮추기" }, dataset: { testid: "relief-level-down" },
        on: { click: () => editorState.set({ reliefLevel: Math.max(1, editorState.get().reliefLevel - 1) }) } }),
      levelValue,
      el("button", { text: "+", attrs: { type: "button", "aria-label": "상한 한 단 높이기" }, dataset: { testid: "relief-level-up" },
        on: { click: () => editorState.set({ reliefLevel: Math.min(RELIEF_MAX_LEVEL, editorState.get().reliefLevel + 1) }) } }),
    ],
  });
  const grass = el("button", {
    class: "relief-bar-toggle", text: "윗면 풀",
    attrs: { type: "button", title: "올린 칸 윗면을 칩셋의 기본 풀로 덮는다 — 0단으로 내리면 원래 바닥으로 돌린다", "aria-pressed": "true" },
    dataset: { testid: "relief-top-grass" },
    on: { click: () => editorState.set({ reliefTopGrass: !editorState.get().reliefTopGrass }) },
  }) as HTMLButtonElement;
  const style = el("select", {
    class: "relief-bar-style",
    attrs: { "aria-label": "절벽 양식", title: "절벽 양식 — 높이를 칠한 뒤에 고른다" },
    dataset: { testid: "relief-style-select" },
    on: { change: (event) => {
      const { mapId } = currentMapAndTileset();
      if (!mapId || !(event.currentTarget instanceof HTMLSelectElement)) return;
      const value = event.currentTarget.value || null;
      recordMapEditIfChanged(mapId, () => { setReliefStyle(mapId, value); });
    } },
  }) as HTMLSelectElement;
  style.append(el("option", { value: "", text: "흙벽(기본)" }));
  for (const key of Object.keys(RELIEF_STYLES)) style.append(el("option", { value: key, text: STYLE_LABELS[key] ?? key }));
  const doodadButton = el("button", {
    class: "relief-bar-doodad", text: "◆ 지형지물",
    attrs: { type: "button", title: "경사로·계단·덩굴·나무·바위·다리를 골라 놓는다 (D)", "aria-pressed": "false", "aria-haspopup": "dialog", "aria-controls": "relief-doodad-popup", "aria-expanded": "false" },
    dataset: { testid: "relief-doodad-toggle" },
    on: { click: () => {
      const open = !editorState.get().reliefDoodadOpen;
      editorState.set({ reliefDoodadOpen: open, ...(open ? {} : { reliefDoodad: null, reliefBridgeStart:null }) });
    } },
  }) as HTMLButtonElement;
  const sep = () => el("span", { class: "relief-bar-sep", attrs: { "aria-hidden": "true" } });
  const terrainTools=el("div",{class:"relief-bar-group",attrs:{role:"group","aria-label":"지형 설치 방식"}});
  const terrainButtons=new Map<string,HTMLButtonElement>();
  for(const [value,label] of [["height","높이"],["surface","표면"],["river","강"],["group","군집 선택"]] as const){
    const b=el("button",{class:"relief-bar-size",text:label,attrs:{type:"button","aria-pressed":"false"},dataset:{testid:`terrain-tool-${value}`},
      on:{click:()=>editorState.set({terrainBrush:value,reliefDoodad:null,reliefBridgeStart:null,terrainMoveGroup:false})}}) as HTMLButtonElement;
    terrainButtons.set(value,b);terrainTools.append(b);
  }
  const material=el("select",{class:"relief-bar-style",attrs:{"aria-label":"표면 재질"},dataset:{testid:"terrain-material"},on:{change:e=>editorState.set({terrainMaterial:(e.target as HTMLSelectElement).value as "grass"|"dirt"|"stone"})}}) as HTMLSelectElement;
  for(const key of ["grass","dirt","stone"] as const)material.append(el("option",{value:key,text:MATERIAL_LABEL[key]}));
  const brushWidth=el("select",{class:"relief-bar-style",attrs:{"aria-label":"표면·강 붓 폭"},dataset:{testid:"terrain-width"},on:{change:e=>editorState.set({terrainWidth:Number((e.target as HTMLSelectElement).value)})}}) as HTMLSelectElement;
  for(const width of [1,3,5,7])brushWidth.append(el("option",{value:String(width),text:`폭 ${width}칸`}));
  const moveGroup=el("button",{class:"relief-bar-size",text:"옮기기",attrs:{type:"button"},dataset:{testid:"terrain-group-move"},on:{click:()=>editorState.set({terrainMoveGroup:true})}}) as HTMLButtonElement;
  const deleteGroup=el("button",{class:"relief-bar-size",text:"군집 지우기",attrs:{type:"button"},dataset:{testid:"terrain-group-delete"},on:{click:()=>{
    const selection=editorState.get().terrainSelectedGroup;if(!selection)return;
    const map=store.getCurrent().maps[selection.mapId],group=map?.doodadGroups?.find(g=>g.id===selection.id);if(!map||!group)return;
    const cells=group.cells.map(c=>({x:c.index%map.width,y:Math.floor(c.index/map.width),layer:"upper" as const}));
    recordMapEditIfChanged(selection.mapId,()=>store.updateMapTiles(selection.mapId,draft=>deleteDoodadGroup(draft,selection.id),{label:"군집 지우기",relief:true,cells}));
    editorState.set({terrainSelectedGroup:null,terrainMoveGroup:false});
  }}}) as HTMLButtonElement;
  const reachable=el("button",{class:"relief-bar-toggle",text:"통행 미리보기",attrs:{type:"button","aria-pressed":"false",title:"시작 지점에서 닿는 땅은 초록, 닿지 못하는 땅은 붉게 표시한다"},dataset:{testid:"terrain-reachability"},on:{click:()=>editorState.set({terrainReachability:!editorState.get().terrainReachability})}}) as HTMLButtonElement;
  const bar = el("div", {
    class: "relief-bar",
    attrs: { role: "toolbar", "aria-label": "높이 붓" },
    dataset: { testid: "relief-brush-controls" },
    children: [terrainTools, sep(), modes, sizes, level, grass, style, material, brushWidth, moveGroup, deleteGroup, sep(), doodadButton, reachable],
  });

  // ── 지형지물 팝업 ──
  const tabs = el("div", { class: "relief-pop-tabs", attrs: { role: "tablist", "aria-label": "지형지물 종류" } });
  const grid = el("div", { class: "relief-pop-grid", attrs: { id: "relief-doodad-grid", role: "tabpanel" }, dataset: { testid: "relief-doodad-grid" } });
  const foot = el("div", { class: "relief-pop-foot" });
  const options=el("div",{class:"relief-pop-options"});
  const rampWidth=el("select",{class:"relief-bar-style",attrs:{"aria-label":"경사로 폭"},dataset:{testid:"relief-ramp-width"},on:{change:e=>editorState.set({reliefRampWidth:Number((e.target as HTMLSelectElement).value) as 2|4|6})}}) as HTMLSelectElement;
  for(const width of [2,4,6])rampWidth.append(el("option",{value:String(width),text:`폭 ${width}칸`}));
  const clusterToggle=el("button",{class:"relief-bar-toggle",text:"군집 배치",attrs:{type:"button","aria-pressed":"true"},dataset:{testid:"relief-cluster-toggle"},on:{click:()=>editorState.set({reliefClusterEnabled:!editorState.get().reliefClusterEnabled})}}) as HTMLButtonElement;
  const density=el("select",{class:"relief-bar-style",attrs:{"aria-label":"군집 밀도"},dataset:{testid:"relief-cluster-density"},on:{change:e=>editorState.set({reliefClusterDensity:Number((e.target as HTMLSelectElement).value)})}}) as HTMLSelectElement;
  for(const [value,label] of [[15,"성김"],[35,"보통"],[70,"빽빽"]] as const)density.append(el("option",{value:String(value),text:label}));
  options.append(rampWidth,clusterToggle,density);
  const head = el("div", {
    class: "relief-pop-head",
    children: [
      el("b", { text: "◆ 지형지물" }),
      el("span", { text: "언덕·절벽에 붙는 것들" }),
      el("button", { text: "✕", attrs: { type: "button", "aria-label": "지형지물 닫기" }, dataset: { testid: "relief-doodad-close" },
        on: { click: () => editorState.set({ reliefDoodadOpen: false, reliefDoodad: null, reliefBridgeStart:null }) } }),
    ],
  });
  const pop = el("div", {
    class: "relief-pop",
    attrs: { id: "relief-doodad-popup", role: "dialog", "aria-label": "지형지물" },
    dataset: { testid: "relief-doodad-popup" },
    children: [head, tabs, options, grid, foot],
  });
  let activeTab: ReliefDoodadTab = "ramp";
  let gridKey = "";
  const FOOT: Record<ReliefDoodadTab, string> = {
    ramp: "절벽 아래 평지에 놓아 언덕 위로 오르는 길을 만든다.",
    wall: "남쪽 절벽 면에 덩굴·담쟁이를 건다.",
    tree: "같은 높이의 땅이나 언덕 윗면에 놓는다.",
    rock: "같은 높이의 땅이나 언덕 윗면에 놓는다.",
    bridge: "첫 둑 클릭 → 같은 줄의 반대 둑 클릭. 폭 2칸. Esc: 시작점 취소.",
  };
  const renderTabs = (): void => {
    tabs.replaceChildren(...RELIEF_DOODAD_TABS.map(({ id, label }) => el("button", {
      class: "relief-pop-tab" + (id === activeTab ? " is-active" : ""), text: label,
      attrs: { id: `relief-tab-${id}`, type: "button", role: "tab", "aria-controls": "relief-doodad-grid", "aria-selected": String(id === activeTab) },
      dataset: { testid: `relief-doodad-tab-${id}` },
      on: { click: () => { activeTab = id; gridKey = ""; renderTabs(); renderGrid(); } },
    })));
  };
  const renderGrid = (): void => {
    grid.setAttribute("aria-labelledby", `relief-tab-${activeTab}`);
    rampWidth.hidden=activeTab!=="ramp";
    clusterToggle.hidden=density.hidden=activeTab!=="tree" && activeTab!=="rock";
    const { tileset } = currentMapAndTileset();
    const key = `${tileset?.id ?? ""}|${activeTab}`;
    if (key !== gridKey) {
      gridKey = key;
      const items = reliefDoodadCatalog(tileset).filter((doodad) => doodad.tab === activeTab);
      grid.replaceChildren(...items.map((doodad) => {
        const thumb = doodadThumb(doodad, tileset);
        thumb.classList.add("relief-pop-thumb");
        return el("button", {
          class: "relief-pop-item",
          attrs: { type: "button", title: doodad.kind === "ramp" || doodad.kind === "bridge" ? doodad.label : `${doodad.label} (${doodad.kit.id})`, "aria-pressed": "false" },
          dataset: { testid: `relief-doodad-${doodad.id}`, doodadId: doodad.id },
          children: [thumb, el("span", { text: doodad.label })],
          on: { click: () => editorState.set({ reliefDoodad: editorState.get().reliefDoodad === doodad.id ? null : doodad.id, terrainBrush:"height", reliefBridgeStart:null }) },
        });
      }));
      if (items.length === 0) grid.append(el("p", { class: "relief-pop-empty", text: "이 칩셋에는 이 탭에 맞는 키트가 없다." }));
      foot.textContent = FOOT[activeTab];
    }
    const picked = editorState.get().reliefDoodad;
    for (const item of grid.querySelectorAll<HTMLElement>(".relief-pop-item")) {
      const on = item.dataset.doodadId === picked;
      item.classList.toggle("is-active", on);
      item.setAttribute("aria-pressed", String(on));
    }
  };
  // 머리를 잡고 끌어 옮긴다 — 캔버스를 가리는 자리면 비켜 둔다.
  let drag: { readonly sx: number; readonly sy: number; readonly ox: number; readonly oy: number } | null = null;
  head.addEventListener("pointerdown", (event) => {
    if ((event.target as HTMLElement).closest("button")) return;
    const area = canvasArea.getBoundingClientRect(), rect = pop.getBoundingClientRect();
    drag = { sx: event.clientX, sy: event.clientY, ox: rect.left - area.left, oy: rect.top - area.top };
    head.setPointerCapture(event.pointerId);
  });
  head.addEventListener("pointermove", (event) => {
    if (!drag) return;
    pop.style.left = `${Math.min(Math.max(0, canvasArea.clientWidth - pop.offsetWidth), Math.max(0, drag.ox + event.clientX - drag.sx))}px`;
    pop.style.top = `${Math.min(Math.max(0, canvasArea.clientHeight - pop.offsetHeight), Math.max(0, drag.oy + event.clientY - drag.sy))}px`;
    pop.style.right = "auto";
  });
  head.addEventListener("pointerup", () => { drag = null; });
  head.addEventListener("pointercancel", () => { drag = null; });

  const dock = el("div", { class: "relief-bar-dock", children: [hint, bar] });
  const host = el("div", { class: "relief-toolbar-host", dataset: { testid: "relief-toolbar" }, children: [pop, dock] });
  canvasArea.append(host);
  installDelayedTooltips(host);

  let hover: ReliefDoodadHoverDetail = null;
  const sync = (state: EditorState): void => {
    const visible = state.tool === "relief" && state.layer !== "event";
    host.hidden = !visible;
    if (!visible) return;
    for(const [value,b] of terrainButtons){const on=value===state.terrainBrush;b.classList.toggle("is-active",on);b.setAttribute("aria-pressed",String(on));}
    const heightMode=state.terrainBrush==="height";
    modes.hidden=level.hidden=grass.hidden=style.hidden=!heightMode;
    sizes.hidden=!(heightMode||state.reliefDoodad);
    material.hidden=state.terrainBrush!=="surface";brushWidth.hidden=state.terrainBrush!=="surface"&&state.terrainBrush!=="river";
    moveGroup.hidden=deleteGroup.hidden=state.terrainBrush!=="group";
    const selection=state.terrainSelectedGroup;
    const selectedExists=!!selection&&selection.mapId===editorState.get().currentMapId&&!!store.getCurrent().maps[selection.mapId]?.doodadGroups?.some(g=>g.id===selection.id);
    moveGroup.disabled=deleteGroup.disabled=!selectedExists;
    moveGroup.classList.toggle("is-active",state.terrainMoveGroup);
    material.value=state.terrainMaterial;brushWidth.value=String(state.terrainWidth);rampWidth.value=String(state.reliefRampWidth);density.value=String(state.reliefClusterDensity);
    clusterToggle.setAttribute("aria-pressed",String(state.reliefClusterEnabled));clusterToggle.classList.toggle("is-active",state.reliefClusterEnabled);
    reachable.setAttribute("aria-pressed",String(state.terrainReachability));reachable.classList.toggle("is-active",state.terrainReachability);
    for (const [mode, button] of modeButtons) {
      const on = mode === state.reliefMode && !state.reliefDoodad;
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-pressed", String(on));
    }
    for (const [size, button] of sizeButtons) {
      const on = size === state.reliefRoughSize;
      button.classList.toggle("is-active", on);
      button.setAttribute("aria-pressed", String(on));
    }
    levelValue.textContent = `${state.reliefLevel}단`;
    grass.classList.toggle("is-active", state.reliefTopGrass);
    grass.setAttribute("aria-pressed", String(state.reliefTopGrass));
    const { tileset, hasRelief, style: currentStyle } = currentMapAndTileset();
    for(const option of material.options)option.disabled=(terrainMaterialTile(tileset,option.value as TerrainMaterial)??-1)<0;
    terrainButtons.get("river")!.disabled=(terrainMaterialTile(tileset,"water")??-1)<0;
    grass.disabled = reliefTopGrassTile(tileset) === undefined;
    style.disabled = !hasRelief;
    style.value = currentStyle ?? "";
    doodadButton.classList.toggle("is-active", state.reliefDoodadOpen);
    doodadButton.setAttribute("aria-pressed", String(state.reliefDoodadOpen));
    doodadButton.setAttribute("aria-expanded", String(state.reliefDoodadOpen));
    pop.hidden = !state.reliefDoodadOpen;
    if (state.reliefDoodadOpen) renderGrid();
    const picked = state.reliefDoodad ? reliefDoodadCatalog(tileset).find((doodad) => doodad.id === state.reliefDoodad) : undefined;
    hint.classList.toggle("is-bad", !!picked && hover?.ok === false);
    hint.classList.toggle("is-ok", !!picked && hover?.ok === true);
    hint.textContent = picked
      ? hover && hover.label === picked.label
        ? `${picked.label} — ${hover.ok ? "✓" : "✕"} ${hover.reason} · 오른쪽 버튼·Esc: 그만 놓기`
        : `${picked.label} — 언덕 가장자리에 대 보라 · 오른쪽 버튼·Esc: 그만 놓기`
      : `왼쪽: ${MODE_LABEL[state.reliefMode]} · 오른쪽: ${rightButtonLabel(state.reliefMode)} · 누르고 있으면 계속 · Shift: 작은 정밀 붓`;
    if(state.reliefBridgeStart?.mapId===state.currentMapId)hint.textContent="첫 둑 선택됨 — 같은 줄의 반대편 둑을 누른다 · Esc: 시작점 취소";
    if(state.terrainBrush==="surface")hint.textContent=(terrainMaterialTile(tileset,state.terrainMaterial)??-1)<0?"이 칩셋에 선택한 재질이 없다 — 다른 재질을 고르라":`표면 ${MATERIAL_LABEL[state.terrainMaterial]} · 높이 유지 · 폭 ${state.terrainWidth}칸`;
    if(state.terrainBrush==="river")hint.textContent=`강 · 폭 ${state.terrainWidth}칸 · 첫 칸 높이로 강바닥 · 물가 자동 접합 · 통로·물체 보호`;
    if(state.terrainBrush==="group")hint.textContent=state.terrainMoveGroup?"옮길 자리를 누른다 · 오른쪽 버튼·Esc: 취소":selectedExists?"군집 선택됨 — 옮기기·군집 지우기":"나무·바위 군집을 눌러 선택한다";
    if(state.terrainReachability && store.getCurrent().startMapId!==state.currentMapId)hint.textContent+=" · 시작 맵에서 통행을 확인한다";
  };
  renderTabs();
  sync(editorState.get());
  const offState = editorState.subscribe(sync);
  // 칠하면 절벽 양식 칸(높이가 생겨야 켜진다)과 지형지물 탭(맵·칩셋)이 달라진다.
  const offStore = store.subscribe(() => { if (!host.hidden) sync(editorState.get()); });
  const onHover = (event: Event): void => {
    hover = (event as CustomEvent<ReliefDoodadHoverDetail>).detail ?? null;
    if (!host.hidden) sync(editorState.get());
  };
  const onKey = (event: KeyboardEvent): void => {
    if (host.hidden || event.defaultPrevented || shouldIgnoreEditorShortcut(event)) return;
    const state = editorState.get();
    if (event.code === "KeyD" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const open = !state.reliefDoodadOpen;
      editorState.set({ reliefDoodadOpen: open, ...(open ? {} : { reliefDoodad: null, reliefBridgeStart:null }) });
      return;
    }
    if (event.key !== "Escape") return;
    if (document.querySelector('[data-testid="delayed-tooltip"]')) hideDelayedTooltip();
    else if (state.reliefBridgeStart) editorState.set({ reliefBridgeStart: null });
    else if (state.terrainMoveGroup || state.terrainSelectedGroup) editorState.set({terrainMoveGroup:false,terrainSelectedGroup:null});
    else if (state.reliefDoodad) editorState.set({ reliefDoodad: null, reliefBridgeStart:null });
    else if (state.reliefDoodadOpen) editorState.set({ reliefDoodadOpen: false });
    else return;
    event.preventDefault();
    event.stopPropagation();
  };
  window.addEventListener(RELIEF_DOODAD_HOVER_EVENT, onHover);
  document.addEventListener("keydown", onKey, true);
  return () => {
    offState();
    offStore();
    window.removeEventListener(RELIEF_DOODAD_HOVER_EVENT, onHover);
    document.removeEventListener("keydown", onKey, true);
    host.remove();
  };
}
