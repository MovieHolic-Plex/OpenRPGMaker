import { el } from "@/util/dom";
import { store } from "@/project/store";
import { editorState } from "../editorState";
import { quickHouseCatalog, quickHouseKit, quickHouseStyles, quickHouseStyleName, quickHouseMinWidth } from "../quickHouse";
import { structureKitUnitCells } from "../harnessSuggestion/structureKitModel";
import { renderTileCellsToCanvas } from "../harnessSuggestion/kitRender";

export function mountQuickBuildPanel(host: HTMLElement): () => void {
  const root = el("div", { class: "quick-build-controls" }); host.append(root);
  const house = el("section", { dataset: { testid: "quick-house-options" } }), road = el("section", { dataset: { testid: "quick-road-options" } }); root.append(house, road);
  house.append(el("strong", { text: "집 외관" }));
  const cards = el("div", { class: "terrain-stamp-cards", dataset: { testid: "quick-house-styles" } }); house.append(cards);
  const choice = (key: string, label: string, options: readonly (readonly [string, string])[], change: (v: string) => void) => {
    const select = el("select", { attrs: { "aria-label": label }, dataset: { testid: `quick-house-${key}` }, on: { change: e => change((e.target as HTMLSelectElement).value) } }) as HTMLSelectElement;
    for (const [value, text] of options) select.append(el("option", { value, text }));
    house.append(el("label", { class: "terrain-design-field", children: [el("span", { text: label }), select] })); return select;
  };
  const saved = choice("catalog", "저장된 집", [], v => editorState.set({ terrainHouseKitId: v || null }));
  const width = choice("width", "집 너비", Array.from({ length: 20 }, (_, i) => i + 5).map(n => [String(n), `${n}칸`] as const), v => editorState.set({ terrainHouseWidth: Number(v) }));
  const stories = choice("stories", "집 층수", [["1", "1층"], ["2", "2층"]], v => editorState.set({ terrainHouseStories: Number(v) as 1 | 2 }));
  const instructions = el("p"); house.append(instructions);
  const drag = el("input", { attrs: { type: "checkbox" }, dataset: { testid: "quick-road-drag" }, on: { change: e => editorState.set({ terrainRoadDrag: (e.target as HTMLInputElement).checked, terrainPoints: null, terrainFeatureId: null }) } }) as HTMLInputElement;
  road.append(el("label", { class: "terrain-design-check", children: [drag, el("span", { text: "끌고 놓으면 도로 적용" })] }), el("p", { text: "길 폭을 고르고 캔버스를 끌어 그리세요. 기존 길과 연결되고, 높이 차이는 경사로로 이어집니다." }));
  let rendered = "";
  function sync(): void {
    const s = editorState.get(), p = store.getCurrent(), map = s.currentMapId ? p.maps[s.currentMapId] : undefined, tileset = map ? p.tilesets[map.tilesetId] : undefined;
    house.hidden = s.terrainBrush !== "house"; road.hidden = s.terrainBrush !== "road"; drag.checked = s.terrainRoadDrag;
    width.value = String(s.terrainHouseWidth); stories.value = String(s.terrainHouseStories);
    const styles = tileset ? quickHouseStyles(tileset) : [], catalog = tileset ? quickHouseCatalog(tileset) : [];
    const effectiveKit = catalog.some(k => k.id === s.terrainHouseKitId) ? s.terrainHouseKitId : !styles.length ? catalog[0]?.id : null;
    width.closest("label")!.hidden = stories.closest("label")!.hidden = !!effectiveKit;
    saved.closest("label")!.hidden = !catalog.length;
    const effectiveStyle = styles.includes(s.terrainHouseStyle) ? s.terrainHouseStyle : styles[0];
    for (const option of width.options) option.disabled = !!effectiveStyle && Number(option.value) < quickHouseMinWidth(effectiveStyle);
    instructions.textContent = effectiveKit ? "저장된 집은 원본 크기로 배치합니다. 끌어서 위치를 잡거나 문 위치를 한 번 누르세요." : "끌어서 집 너비·높이를 정하고 놓으세요. 한 번 클릭하면 선택한 크기로 문 위치에 놓습니다. 초록은 배치 가능 · 빨강은 불가 · Esc는 취소.";
    if (!effectiveKit && tileset?.id === "beodeul_city" && styles.length) instructions.textContent = "버들항 집 · 끌어서 너비·높이를 정하고 놓으세요. 높이는 창·문을 보존하며 층 단위로 맞춥니다. 초록은 가능 · 빨강은 불가 · Esc는 취소.";
    if (!styles.length && !catalog.length) instructions.textContent = "이 지도 타일셋에 집 부품이 없습니다. 타일의 구조물에 입구가 있는 집을 등록해 주세요.";
    if (house.hidden) return;
    const key = `${tileset?.id}:${tileset?.count}:${s.terrainHouseWidth}:${s.terrainHouseStories}:${catalog.map(k => k.id).join(",")}`;
    if (key !== rendered) {
      rendered = key; cards.replaceChildren(); saved.replaceChildren();
      if (styles.length) saved.append(el("option", { value: "", text: "크기 조절하는 기본 집" }));
      for (const kit of catalog) saved.append(el("option", { value: kit.id, text: `${kit.name ?? kit.id} · ${kit.width}×${kit.height}` }));
      for (const style of tileset ? quickHouseStyles(tileset) : []) {
        const kit = quickHouseKit(tileset!, { style, width: s.terrainHouseWidth, stories: s.terrainHouseStories }); if (!kit) continue;
        const card = el("button", { class: "terrain-stamp-card", attrs: { type: "button", "aria-pressed": "false", "aria-label": quickHouseStyleName(style) }, dataset: { houseStyle: style }, on: { click: () => editorState.set({ terrainHouseStyle: style, terrainHouseKitId: null, terrainHouseWidth: Math.max(s.terrainHouseWidth, quickHouseMinWidth(style)) }) } });
        card.append(renderTileCellsToCanvas({ tileset: tileset!, widthTiles: kit.width, heightTiles: kit.height, scale: Math.min(1, 6 / Math.max(kit.width, kit.height)), backgroundTile: null, cells: structureKitUnitCells(kit) }), el("span", { text: quickHouseStyleName(style) })); cards.append(card);
      }
      for (const kit of catalog.slice(0, 12)) {
        const card = el("button", { class: "terrain-stamp-card", attrs: { type: "button", "aria-pressed": "false" }, dataset: { houseKit: kit.id }, on: { click: () => editorState.set({ terrainHouseKitId: kit.id }) } });
        card.append(renderTileCellsToCanvas({ tileset: tileset!, widthTiles: kit.width, heightTiles: kit.height, scale: Math.min(1, 6 / Math.max(kit.width, kit.height)), backgroundTile: null, cells: structureKitUnitCells(kit) }), el("span", { text: kit.name ?? kit.id })); cards.append(card);
      }
      if (!cards.childElementCount) cards.append(el("p", { text: "타일의 구조물에 입구가 있는 집을 등록하면 여기서 고를 수 있습니다." }));
    }
    saved.value = effectiveKit ?? "";
    for (const card of cards.querySelectorAll<HTMLButtonElement>("[data-house-style]")) card.setAttribute("aria-pressed", String(!effectiveKit && card.dataset.houseStyle === effectiveStyle));
    for (const card of cards.querySelectorAll<HTMLButtonElement>("[data-house-kit]")) card.setAttribute("aria-pressed", String(card.dataset.houseKit === effectiveKit));
  }
  const offState = editorState.subscribe(sync), offStore = store.subscribe(sync); sync();
  return () => { offState(); offStore(); root.remove(); };
}
