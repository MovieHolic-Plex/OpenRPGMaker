import { el } from "@/util/dom";
import { randomUuid } from "@/util/id";
import { designNode, spatialId } from "@/project/spatial/domain";
import { COMPOSITION_KINDS, paintComposition } from "@/project/spatial/composition";
import type { SpatialComposition, SpatialDesignReference, SpatialKind, SpatialPoint } from "@/project/spatial/types";
import { visibleAuthoringProject } from "./spatialAuthoringAccess";
import { spatialProjectKey, selectSpatialDesign, type SpatialAuthoringSession } from "./spatialAuthoringSession";
import { listSpatialGalleryCards, type SpatialGalleryCard } from "./spatialCatalog";
import { renderSpatialCardThumb } from "./spatialGallery";
import { renderSpatialChrome, renderSpatialInspector } from "./spatialStage";
import { cellsFromMapRect, renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { openTilesetTileBrowser } from "./tilesetTileBrowser";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { COMPOSITION_COLLECTIONS, COMPOSITION_NAMES, compositionPreview, currentComposition, defaultComposition, editComposition, editExistingComponent } from "./spatialCompositionAccess";

type State = { material: "tile" | SpatialKind; query: string; brush: number; layer: "lower" | "upper"; tool: "select" | "paint" | "erase" | "restore"; source?: SpatialDesignReference; selected?: string; zoom: number; error: string | null; undo: SpatialComposition[] };
const states = new Map<string, State>();
const PX = 24;
export function renderSpatialCompositionWorkspace(session: SpatialAuthoringSession, card: SpatialGalleryCard, rerender: () => void): HTMLElement {
  const source = card.canonicalSource!;
  const composition = currentComposition(source);
  const key = `${spatialProjectKey()}:${source.kind}:${source.id}`;
  let saved = states.get(key);
  if (!saved) { saved = { material: "tile", query: "", brush: 0, layer: "lower", tool: "select", zoom: Math.min(1, 480 / (composition.width * PX), 420 / (composition.height * PX)), error: null, undo: [] }; states.set(key, saved); }
  const state = saved;
  const redrawBoard = (): void => { rerender(); document.querySelector<HTMLElement>('[data-testid="composition-board"]')?.focus({ preventScroll: true }); };
  const project = visibleAuthoringProject();
  const tileset = project.tilesets[composition.tilesetId];
  const set = (change: (value: SpatialComposition) => SpatialComposition): void => {
    const before = currentComposition(source);
    const error = editComposition(source, change);
    state.error = error;
    if (!error) { state.undo.push(before); if (state.undo.length > 40) state.undo.shift(); }
    redrawBoard();
  };
  const place = (ref: SpatialDesignReference, point: SpatialPoint): void => {
    if (point.x < 0 || point.y < 0 || point.x >= composition.width || point.y >= composition.height) return;
    try {
      const raster = compositionPreview(project, ref);
      if (point.x + raster.map.width > composition.width || point.y + raster.map.height > composition.height) { state.error = "재료가 캔버스 밖으로 나갑니다. 위치를 옮기거나 캔버스 크기를 늘려 주세요."; rerender(); return; }
    } catch (error) { state.error = error instanceof Error ? error.message : String(error); rerender(); return; }
    const id = spatialId(`member_${randomUuid()}`);
    state.selected = JSON.stringify(["direct", id]);
    set(value => ({ ...value, members: [...value.members, { id, source: ref, ...point, level: 0 }] }));
  };
  const palette = el("div", { class: "spatial-mixed-palette" });
  const results = el("div", { class: "spatial-mixed-assets", dataset: { testid: "composition-assets" } });
  const tabs = el("div", { class: "spatial-mixed-tabs", attrs: { role: "group", "aria-label": "배치할 재료" } });
  for (const kind of ["tile", ...COMPOSITION_KINDS[source.kind]] as const) tabs.append(button(kind === "tile" ? "타일" : COMPOSITION_NAMES[kind], () => {
    state.material = kind; state.source = undefined; state.tool = kind === "tile" ? "paint" : "select"; rerender();
  }, `composition-material-${kind}`, state.material === kind));
  const search = el("input", { class: "asset-browser-search", value: state.query, attrs: { type: "search", placeholder: "재료 이름 검색", "aria-label": "재료 이름 검색" }, dataset: { testid: "composition-search" }, on: {
    input: event => { state.query = (event.currentTarget as HTMLInputElement).value; renderAssets(); },
  } });
  function renderAssets(): void {
    if (state.material === "tile") {
      results.replaceChildren(el("div", { class: "spatial-mixed-brush", attrs: { style: tilesetTileBackgroundStyle(tileset, state.brush, 96) } }),
        el("p", { text: `${tileset.name} · 타일 ${state.brush}` }),
        button("타일 브라우저 열기", () => openTilesetTileBrowser(tileset, state.brush, tile => { state.brush = tile; state.tool = "paint"; rerender(); }), "composition-tile-browser"),
        el("p", { class: "spatial-mixed-hint", text: "캔버스를 누르거나 끌어서 칠하세요. 지우개는 바탕 타일도 지우고, 원래대로는 직접 칠한 변경만 없앱니다." }));
      return;
    }
    const material = state.material;
    const entries = Object.values(project.spatialAuthoring!.library[COMPOSITION_COLLECTIONS[material]]).filter(value => value.name.toLocaleLowerCase().includes(state.query.toLocaleLowerCase()));
    results.replaceChildren(...entries.map(value => {
      const ref = { kind: material, id: value.id };
      const child = designNode(project.spatialAuthoring!.library, ref);
      const atlas = child.kind === "object" ? child.design.graphic.tilesetId : defaultComposition(project, child).tilesetId;
      const compatible = atlas === composition.tilesetId;
      const gallery: SpatialGalleryCard = { id: value.id, localId: value.id, canonicalSource: ref, name: value.name, kind: COMPOSITION_COLLECTIONS[material], source: "own", usage: 0, tilesetId: atlas,
        ...(child.kind === "object" ? { objectId: child.design.graphic.kitId } : {}) };
      return el("button", { class: `spatial-mixed-asset${state.source?.id === value.id ? " is-selected" : ""}`, attrs: { type: "button", draggable: String(compatible), ...(compatible ? {} : { disabled: "" }), title: compatible ? value.name : "캔버스와 같은 타일셋을 사용하는 재료를 선택하세요." }, dataset: { testid: `composition-asset-${value.id}` },
        children: [el("div", { children: [renderSpatialCardThumb(gallery)] }), el("strong", { text: value.name }), ...(compatible ? [] : [el("small", { text: "다른 타일셋" })])], on: {
          click: () => { state.source = ref; state.tool = "select"; rerender(); },
          dragstart: event => { if (event instanceof DragEvent) event.dataTransfer?.setData("application/x-spatial-member", JSON.stringify(ref)); },
        } });
    }));
    if (!entries.length) results.append(el("p", { text: `${COMPOSITION_NAMES[material]} 탭에서 만든 항목이 여기에 표시됩니다.` }));
  }
  renderAssets();
  palette.append(el("h3", { text: "재료" }), tabs, search, results);
  const board = el("div", { class: "spatial-mixed-board", attrs: { tabindex: "0", "aria-label": "복합 배치 캔버스", style: `width:${composition.width * PX}px;height:${composition.height * PX}px;--mixed-cell:${PX}px` }, dataset: { testid: "composition-board" } });
  let preview: ReturnType<typeof compositionPreview> | undefined;
  try {
    const raster = compositionPreview(project, source); preview = raster;
    board.append(renderTileCellsToCanvas({ tileset: project.tilesets[raster.map.tilesetId], widthTiles: raster.map.width, heightTiles: raster.map.height,
      cells: cellsFromMapRect(raster.map, { x: 0, y: 0, width: raster.map.width, height: raster.map.height }), scale: PX / 16, backgroundTile: null, transparentBackground: true }));
  } catch (error) { board.append(el("p", { class: "spatial-mixed-error", text: `미리보기: ${error instanceof Error ? error.message : String(error)}` })); }
  const point = (event: MouseEvent): SpatialPoint => { const bounds = board.getBoundingClientRect(); return { x: Math.floor((event.clientX - bounds.left) / (PX * state.zoom)), y: Math.floor((event.clientY - bounds.top) / (PX * state.zoom)) }; };
  const visualMembers = preview ? preview.projections.filter(item => item.occurrence.parentId === preview!.projections[0]?.occurrence.id).map(item => ({
    id: composition.members.some(member => member.id === item.occurrence.parentSlot?.slotId) ? JSON.stringify(["direct", item.occurrence.parentSlot!.slotId]) : JSON.stringify(["legacy", item.occurrence.parentSlot!.slotId, item.occurrence.parentSlot!.index]),
    slotId: item.occurrence.parentSlot!.slotId, source: item.occurrence.source, x: item.rect.x, y: item.rect.y, width: item.rect.width, height: item.rect.height,
    direct: composition.members.some(member => member.id === item.occurrence.parentSlot?.slotId),
  })) : composition.members.map(member => ({ ...member, id: JSON.stringify(["direct", member.id]), slotId: member.id, width: 1, height: 1, direct: true }));
  const moveMember = (id: string, at: SpatialPoint | null): void => {
    const member = visualMembers.find(item => item.id === id); if (!member) return;
    if (at && (at.x < 0 || at.y < 0 || at.x + member.width > composition.width || at.y + member.height > composition.height)) { state.error = "캔버스 안에 배치해 주세요."; rerender(); return; }
    if (!member.direct) { state.error = editExistingComponent(source, member.slotId, at); redrawBoard(); return; }
    set(value => ({ ...value, members: at ? value.members.map(item => item.id === member.slotId ? { ...item, ...at } : item) : value.members.filter(item => item.id !== member.slotId) }));
  };
  for (const member of visualMembers) {
    const child = designNode(project.spatialAuthoring!.library, member.source);
    const { width, height } = member;
    board.append(el("button", { class: `spatial-mixed-member${state.selected === member.id ? " is-selected" : ""}`, attrs: { type: "button", draggable: "true", title: `${COMPOSITION_NAMES[member.source.kind]} · ${child.design.name}`, "aria-label": child.design.name,
      style: `left:${member.x * PX}px;top:${member.y * PX}px;width:${width * PX}px;height:${height * PX}px;${state.tool === "select" ? "" : "pointer-events:none"}` }, dataset: { testid: `composition-member-${member.id}`, memberId: member.id }, on: {
        click: event => { event.stopPropagation(); state.selected = member.id; redrawBoard(); },
        dragstart: event => { if (event instanceof DragEvent) event.dataTransfer?.setData("application/x-spatial-move", member.id); },
      } }));
  }
  let stroke: SpatialPoint[] | null = null;
  board.addEventListener("pointerdown", event => {
    if (state.tool === "select") return;
    event.preventDefault(); board.setPointerCapture?.(event.pointerId); stroke = [point(event)];
  });
  board.addEventListener("pointermove", event => {
    if (!stroke) return;
    const to = point(event), from = stroke[stroke.length - 1];
    const count = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
    for (let i = 1; i <= Math.min(count, 1024); i++) stroke.push({ x: Math.round(from.x + (to.x - from.x) * i / count), y: Math.round(from.y + (to.y - from.y) * i / count) });
  });
  board.addEventListener("pointerup", () => {
    if (!stroke) return;
    const points = stroke; stroke = null;
    set(value => points.reduce((next, p) => paintComposition(next, p, state.layer, state.tool === "restore" ? null : state.tool === "erase" ? -1 : state.brush), value));
  });
  board.addEventListener("pointercancel", () => { stroke = null; });
  board.addEventListener("click", event => { if (state.tool === "select" && state.source && (event.target === board || event.target instanceof HTMLCanvasElement)) place(state.source, point(event)); });
  board.addEventListener("dragover", event => event.preventDefault());
  board.addEventListener("drop", event => {
    event.preventDefault(); const at = point(event);
    const id = event.dataTransfer?.getData("application/x-spatial-move");
    if (id) { moveMember(id, at); return; }
    const raw = event.dataTransfer?.getData("application/x-spatial-member");
    if (!raw) return;
    try { const ref = JSON.parse(raw) as SpatialDesignReference; if (COMPOSITION_KINDS[source.kind].includes(ref.kind)) { designNode(project.spatialAuthoring!.library, ref); place(ref, at); } } catch { state.error = "배치할 재료를 확인할 수 없습니다."; rerender(); }
  });
  board.addEventListener("keydown", event => {
    if (event.key === "Escape") { stroke = null; state.source = undefined; state.selected = undefined; event.stopPropagation(); rerender(); return; }
    const selected = state.selected; if (!selected) return;
    if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); moveMember(selected, null); return; }
    const directions: Record<string, SpatialPoint> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } };
    const delta = directions[event.key]; if (!delta) return;
    const member = visualMembers.find(item => item.id === selected);
    if (member) { event.preventDefault(); moveMember(selected, { x: member.x + delta.x, y: member.y + delta.y }); }
  });
  const tools = el("div", { class: "spatial-mixed-tools", children: [
    ...([['select','선택'],['paint','붓'],['erase','지우개'],['restore','원래대로']] as const).map(([tool,label]) => button(label, () => { state.tool = tool; rerender(); }, `composition-tool-${tool}`, state.tool === tool)),
    ...([['lower','바닥'],['upper','덧그림']] as const).map(([layer,label]) => button(label, () => { state.layer = layer; rerender(); }, `composition-layer-${layer}`, state.layer === layer)),
    button('편집 취소', () => { const previous = state.undo.pop(); if (previous) { state.error = editComposition(source, () => previous); rerender(); } }, 'composition-undo'),
    button('맞춤', () => { state.zoom = Math.min(1, (camera.clientWidth - 48) / (composition.width * PX), (camera.clientHeight - 48) / (composition.height * PX)); rerender(); }, 'composition-fit'),
    ...[0.5,1,2].map(zoom => button(`${zoom * 100}%`, () => { state.zoom = zoom; rerender(); }, undefined, state.zoom === zoom)),
  ] });
  const camera = el("div", { class: "spatial-mixed-camera", children: [el("div", { attrs: { style: `width:${composition.width * PX * state.zoom}px;height:${composition.height * PX * state.zoom}px` }, children: [el("div", { attrs: { style: `transform:scale(${state.zoom});transform-origin:top left` }, children: [board] })] })] });
  const size = el("div", { class: "spatial-mixed-size", children: (["width", "height"] as const).map(axis => el("label", { children: [el("span", { text: axis === "width" ? "캔버스 너비" : "캔버스 높이" }), el("input", { value: String(composition[axis]), attrs: { type: "number", min: "1", max: "256" }, dataset: { testid: `composition-${axis}` }, on: { change: event => {
    const value = Number((event.currentTarget as HTMLInputElement).value); set(current => ({ ...current, [axis]: value }));
  } } })] })) });
  const atlasSelect = el("select", { attrs: { "aria-label": "캔버스 타일셋", ...(source.kind === "space" || visualMembers.length || composition.tiles.length || composition.members.length ? { disabled: "" } : {}) }, children: Object.values(project.tilesets).map(atlas => el("option", { text: atlas.name, attrs: { value: atlas.id, ...(atlas.id === composition.tilesetId ? { selected: "" } : {}) } })), on: { change: event => set(value => ({ ...value, tilesetId: (event.currentTarget as HTMLSelectElement).value })) } });
  const selectedMember = visualMembers.find(member => member.id === state.selected);
  const memberControls = selectedMember ? el("div", { class: "spatial-mixed-selection", children: [
    el("strong", { text: designNode(project.spatialAuthoring!.library, selectedMember.source).design.name }),
    button("선택 삭제", () => moveMember(selectedMember.id, null), "composition-remove"),
    el("p", { text: "끌어서 이동 · 방향키로 한 칸 이동 · Delete로 삭제" }),
  ] }) : el("p", { text: "배치한 항목을 선택하면 이동하거나 삭제할 수 있습니다." });
  const cards = listSpatialGalleryCards({ ...session, source: "all" });
  const picker = el("select", { attrs: { "aria-label": `${COMPOSITION_NAMES[source.kind]} 선택` }, children: cards.map(item => el("option", { text: item.name, attrs: { value: item.id, ...(item.id === card.id ? { selected: "" } : {}) } })), on: { change: event => { selectSpatialDesign((event.currentTarget as HTMLSelectElement).value); rerender(); } } });
  return el("div", { class: "spatial-shell spatial-mixed-workspace", dataset: { testid: `spatial-shell-${session.tab}` }, attrs: { tabindex: "0" }, children: [
    el("header", { class: "asset-browser-top", children: [el("div", { class: "asset-browser-heading", children: [el("h2", { text: `${COMPOSITION_NAMES[source.kind]} 편집` }), el("p", { text: `타일과 ${COMPOSITION_KINDS[source.kind].map(kind => COMPOSITION_NAMES[kind]).join("·")}을 함께 배치하세요.` })] }), picker, renderSpatialChrome(session, rerender, { browser: true })] }),
    el("div", { class: "spatial-mixed-body", children: [palette, el("section", { class: "spatial-mixed-stage", children: [tools, ...(state.error ? [el("p", { class: "spatial-mixed-error", attrs: { role: "alert" }, text: state.error })] : []), camera] }),
      el("aside", { class: "asset-browser-detail", children: [el("h3", { text: "배치 속성" }), atlasSelect, size, memberControls,
        el("details", { children: [el("summary", { text: "기존 설계와 생성 규칙" }), renderSpatialInspector(card, true, rerender)] })] })] }),
  ] });
}
function button(text: string, click: () => void, testid?: string, active = false): HTMLButtonElement {
  return el("button", { class: `asset-browser-button${active ? " is-selected" : ""}`, text, attrs: { type: "button", "aria-pressed": String(active) }, ...(testid ? { dataset: { testid } } : {}), on: { click } });
}
