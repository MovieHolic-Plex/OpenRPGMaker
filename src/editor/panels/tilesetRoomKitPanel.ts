/**
 * 타일셋 「방 짓기」 탭 — 올린 칩셋에 방 짓기 역할표(roomKit)를 만든다.
 * 바닥 무늬·벽면 두 줄·천장 칸을 시트에서 끌어 고르면 견본 방(네모·ㄱ자)을 바로 지어 보여 주고, 저장하면
 * 변형 칸(그림자·천장 테두리)을 칩셋 끝에 이식하고 tileset.roomKit.spec 을 단다(src/project/roomKit.ts).
 * 그다음부터 조수의 build_hand_interior_room 이 이 칩셋으로 방을 짓는다. 위키: openwiki/atlas-biome-interior.md 「역할표」.
 */
import { keyedTilesetImage, loadTilesetImage } from "@/ai/toolImageCanvas";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { buildHandInteriorLayers, roomSpecOf, type HandInteriorSpec } from "@/editor/handInterior/builder";
import { requestTilesetMapping } from "@/editor/panels/tilesetAiClient";
import {
  compileRoomKit, installRoomKit, kitHandObjects, parseRoomKitDraft, roomKitAssetId, roomKitBase, roomKitDraftPrompt, roomKitPicksProblem, roomKitSpec,
  rpgMakerAutotileSheet, rpgMakerBlockPicks, savedRoomKitPicks, type CompiledRoomKit, type RoomKitCell, type RoomKitPicks,
} from "@/project/roomKit";
import { store } from "@/project/store";
import type { TilesetDef } from "@/project/types";
import { el } from "@/util/dom";

type Slot = "floor" | "wallTop" | "wallBottom" | "ceiling";
interface Draft {
  floor?: RoomKitCell[][]; wallTop?: RoomKitCell[]; wallBottom?: RoomKitCell[]; ceiling?: RoomKitCell; slot: Slot;
  /** RPG Maker 오토타일 시트(A2·A4)면 누른 칸의 블록에서 이음매 없는 가운데를 뗀다. 끄면 칸 그대로 고른다. */
  rmBlocks?: boolean;
  /** AI 초안 진행·결과 문장(다시 그려도 남긴다). */
  note?: string; busy?: boolean;
  /** 다시 그려도 시트·패널 스크롤을 그대로 둔다(고를 때마다 맨 위로 튀지 않게). */
  scroll?: { sheet: [number, number]; panel: number };
}

const SLOTS: readonly { readonly id: Slot; readonly label: string; readonly hint: string; readonly color: string }[] = [
  { id: "floor", label: "바닥 무늬", hint: "바닥이 되풀이되는 판을 사각형으로 끌어 고릅니다(1~8칸).", color: "#5ad19a" },
  { id: "wallTop", label: "벽면 위 줄", hint: "방 북쪽 벽 앞면의 위 줄을 가로로 끌어 고릅니다(1~8칸). 시트에서 벽이 세로로 놓였으면 위·아래를 한 번씩 고르면 됩니다.", color: "#f2b84b" },
  { id: "wallBottom", label: "벽면 아래 줄", hint: "벽 앞면의 아래 줄(바닥에 닿는 줄)을 위 줄과 같은 칸 수로 끌어 고릅니다.", color: "#e07a3f" },
  { id: "ceiling", label: "천장", hint: "방 밖(벽 위·천장)을 채울 칸 하나. 무늬가 적은 칸이 좋습니다.", color: "#7aa7ff" },
];
const SAMPLE_PLANS: readonly { readonly title: string; readonly plan: readonly string[] }[] = [
  { title: "네모 방", plan: ["##########", "#........#", "#........#", "#........#", "#........#", "####..####"] },
  { title: "ㄱ자 방", plan: ["##############", "#.....########", "#.....########", "#.....########", "#............#", "#............#", "######..######"] },
];
const SHEET_SCALE = 2;
const PANEL_STYLE = "overflow:auto;height:100%;box-sizing:border-box;padding:12px 16px;display:flex;flex-direction:column;gap:8px";
const drafts = new Map<string, Draft>();

function draftFor(tileset: TilesetDef): Draft {
  let d = drafts.get(tileset.id);
  if (!d) {
    const saved = savedRoomKitPicks(tileset);
    d = saved
      ? { floor: saved.floor.map((r) => [...r]), wallTop: [...saved.wall[0]], wallBottom: [...saved.wall[1]], ceiling: saved.ceiling, slot: "floor" }
      : { slot: "floor" };
    drafts.set(tileset.id, d);
  }
  return d;
}

function isPicked(d: Draft, slot: Slot): boolean {
  return slot === "ceiling" ? d.ceiling !== undefined : !!d[slot];
}

function picksOf(d: Draft): RoomKitPicks | null {
  if (!d.floor || !d.wallTop || !d.wallBottom || d.ceiling === undefined) return null;
  return { floor: d.floor, wall: [d.wallTop, d.wallBottom], ceiling: d.ceiling };
}

/** 이식 칸까지 구운 칩셋 그림 → 캔버스(투명색 처리 포함). */
async function sheetCanvas(tileset: TilesetDef): Promise<HTMLCanvasElement> {
  const image = keyedTilesetImage(tileset, await loadTilesetImage(tileset, store.getCurrent()));
  const canvas = document.createElement("canvas");
  canvas.width = image.width; canvas.height = image.height;
  canvas.getContext("2d")!.drawImage(image, 0, 0);
  return canvas;
}

function variantCanvas(compiled: CompiledRoomKit): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = compiled.sheet.width; canvas.height = compiled.sheet.height;
  canvas.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(compiled.sheet.data), compiled.sheet.width, compiled.sheet.height), 0, 0);
  return canvas;
}

/** 견본 방 한 장. 변형 칸은 base 뒤 번호 — 아직 이식 전이라 변형 시트에서 직접 그린다. */
function renderSample(plan: readonly string[], spec: HandInteriorSpec, base: number, T: number, sheet: HTMLCanvasElement, variants: HTMLCanvasElement): HTMLCanvasElement {
  const layers = buildHandInteriorLayers({ plan, floor: "floor", wall: "wall" }, undefined, spec);
  const canvas = document.createElement("canvas");
  canvas.width = layers.width * T * SHEET_SCALE; canvas.height = layers.height * T * SHEET_SCALE;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const sheetCols = Math.max(1, Math.floor(sheet.width / T));
  const draw = (tile: number, i: number) => {
    if (tile < 0) return;
    const [src, id, cols] = tile >= base ? [variants, tile - base, 16] as const : [sheet, tile, sheetCols] as const;
    const x = (i % layers.width) * T * SHEET_SCALE, y = Math.floor(i / layers.width) * T * SHEET_SCALE;
    ctx.drawImage(src, (id % cols) * T, Math.floor(id / cols) * T, T, T, x, y, T * SHEET_SCALE, T * SHEET_SCALE);
  };
  for (const layer of [layers.lowerTiles, layers.lowerOverlayTiles, layers.upperTiles, layers.upperOverlayTiles]) layer.forEach(draw);
  return canvas;
}

/** AI 초안용 — 시트 가장자리에 열·줄 번호를 단 그림(긴 변 2048px 이하로 맞춘다). */
function labeledSheet(sheet: HTMLCanvasElement, T: number, cols: number, rows: number): string {
  const scale = Math.max(1, Math.min(4, Math.floor(2048 / Math.max(sheet.width, sheet.height))));
  const cell = T * scale, pad = 28;
  const canvas = document.createElement("canvas");
  canvas.width = pad + cols * cell; canvas.height = pad + rows * cell;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sheet, pad, pad, cols * cell, rows * cell);
  ctx.fillStyle = "#000"; ctx.font = `${Math.min(14, Math.max(9, cell - 4))}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let c = 0; c < cols; c++) ctx.fillText(String(c), pad + c * cell + cell / 2, pad / 2);
  for (let r = 0; r < rows; r++) ctx.fillText(String(r), pad / 2, pad + r * cell + cell / 2);
  ctx.strokeStyle = "rgba(255,0,255,0.35)"; ctx.lineWidth = 1;
  for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(pad + c * cell + 0.5, pad); ctx.lineTo(pad + c * cell + 0.5, canvas.height); ctx.stroke(); }
  for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(pad, pad + r * cell + 0.5); ctx.lineTo(canvas.width, pad + r * cell + 0.5); ctx.stroke(); }
  return canvas.toDataURL("image/png");
}

export function renderTilesetRoomKitPanel(tileset: TilesetDef, rerender: () => void): HTMLElement {
  const kit = tileset.roomKit;
  const builtin = !!(kit?.builtin || (!kit?.spec && roomSpecOf(tileset)));
  const intro = el("p", {
    class: "tileset-roomkit-intro",
    text: "조수가 이 칩셋으로 방(네모·ㄱ자·ㄷ자)을 지으려면 어느 칸이 바닥·벽면·천장인지 알아야 합니다. 바닥·벽면 두 줄·천장을 고르면 견본 방을 지어 보여 주고, 저장하면 조수가 「방 지어 줘」에 이 칩셋을 씁니다.",
  });
  if (builtin) {
    return el("section", {
      class: "tileset-roomkit", dataset: { testid: "tileset-roomkit" }, attrs: { style: PANEL_STYLE },
      children: [intro, el("p", { class: "tileset-roomkit-status", text: "이 칩셋은 번들 역할표를 갖고 있습니다 — 바닥·벽면·천장과 가구까지 이미 정해져 있어 따로 만들 필요가 없습니다." })],
    });
  }
  // 번들 칩셋은 번들이 칸 표를 소유한다 — 여기서 칸을 덧붙이면 번들 갱신(ensure…)이 멈춘다. 역할표는 굽기 스크립트로 번들에 넣는다.
  if (tileset.image.type !== "uploaded") {
    return el("section", {
      class: "tileset-roomkit", dataset: { testid: "tileset-roomkit" }, attrs: { style: PANEL_STYLE },
      children: [intro, el("p", { class: "tileset-roomkit-status", text: "번들 칩셋의 역할표는 번들이 정합니다. 이 칩셋은 아직 없습니다 — 직접 올린 칩셋만 여기서 만듭니다." })],
    });
  }
  const draft = draftFor(tileset);
  const furniture = Object.keys(kitHandObjects(tileset)).length;
  const furnitureNote = el("p", {
    class: "tileset-roomkit-hint",
    text: furniture
      ? `가구는 이 칩셋의 조립 부품 ${furniture}종을 씁니다(자료집 → 오브젝트에서 더하면 늘어납니다).`
      : "가구로 쓸 조립 부품이 아직 없습니다 — 방 뼈대만 짓습니다. 자료집 → 오브젝트에서 침대·탁자 같은 부품을 등록하면 조수가 가구로 놓습니다.",
  });
  const status = el("p", {
    class: "tileset-roomkit-status", dataset: { testid: "tileset-roomkit-status" },
    text: kit?.spec ? "저장된 역할표가 있습니다. 다시 고르고 저장하면 새 역할표로 바뀝니다(이미 지은 맵은 그대로)." : "아직 역할표가 없습니다 — 조수가 이 칩셋으로 방을 짓지 못합니다.",
  });
  const slotButtons = el("div", {
    class: "tileset-roomkit-slots", attrs: { role: "radiogroup", "aria-label": "고를 역할", style: "display:flex;gap:6px;flex-wrap:wrap" },
    children: SLOTS.map((slot) => {
      const picked = isPicked(draft, slot.id);
      return el("button", {
        class: `database-footer-button tileset-roomkit-slot${draft.slot === slot.id ? " active" : ""}`,
        text: `${slot.label}${picked ? " ✓" : ""}`,
        attrs: { type: "button", role: "radio", "aria-checked": String(draft.slot === slot.id), title: slot.hint, style: `border-left: 4px solid ${slot.color}` },
        dataset: { testid: `tileset-roomkit-slot-${slot.id}` },
        on: { click: () => { draft.slot = slot.id; rerender(); } },
      });
    }),
  });
  const hint = el("p", { class: "tileset-roomkit-hint", text: SLOTS.find((s) => s.id === draft.slot)!.hint });
  const sheetHost = el("div", { class: "tileset-roomkit-sheet", attrs: { style: "overflow:auto;max-height:420px;min-height:200px;flex:none;border:1px solid #444" } });
  const previewHost = el("div", { class: "tileset-roomkit-preview", dataset: { testid: "tileset-roomkit-preview" }, attrs: { style: "display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start" } });
  const message = el("p", { class: "tileset-roomkit-message", dataset: { testid: "tileset-roomkit-message" } });
  const save = el("button", {
    class: "database-footer-button primary", text: "역할표 저장", attrs: { type: "button", disabled: "", style: "align-self:flex-start" },
    dataset: { testid: "tileset-roomkit-save" },
  });
  const aiButton = el("button", {
    class: "database-footer-button", text: draft.busy ? "AI 가 보는 중…" : "AI 초안",
    attrs: { type: "button", title: "칩셋 그림을 AI 에게 보여 주고 바닥·벽면·천장 자리를 먼저 골라 달라고 합니다. 견본 방을 보고 고치세요.", ...(draft.busy ? { disabled: "" } : {}) },
    dataset: { testid: "tileset-roomkit-ai" },
  });
  const tools = el("div", { class: "tileset-roomkit-tools", attrs: { style: "display:flex;gap:10px;align-items:center;flex-wrap:wrap" }, children: [aiButton] });
  const note = el("p", { class: "tileset-roomkit-note", dataset: { testid: "tileset-roomkit-note" }, text: draft.note ?? "" });
  const panel = el("section", {
    class: "tileset-roomkit", dataset: { testid: "tileset-roomkit" }, attrs: { style: PANEL_STYLE },
    children: [intro, status, furnitureNote, tools, note, slotButtons, hint, sheetHost, el("h4", { text: "견본 방" }), previewHost, message, save],
  });

  void (async () => {
    let sheet: HTMLCanvasElement;
    try { sheet = await sheetCanvas(tileset); } catch (e) { message.textContent = `칩셋 그림을 읽지 못했습니다: ${(e as Error).message}`; return; }
    const T = tileset.tileSize, cols = Math.max(1, Math.floor(sheet.width / T)), rows = Math.floor(sheet.height / T);
    const view = document.createElement("canvas");
    view.width = sheet.width * SHEET_SCALE; view.height = sheet.height * SHEET_SCALE;
    view.style.cursor = "crosshair";
    view.dataset.testid = "tileset-roomkit-sheet-canvas";
    const ctx = view.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const tileAt = (ev: MouseEvent) => {
      const r = view.getBoundingClientRect();
      const x = Math.floor(((ev.clientX - r.left) * (view.width / r.width)) / (T * SHEET_SCALE));
      const y = Math.floor(((ev.clientY - r.top) * (view.height / r.height)) / (T * SHEET_SCALE));
      return { x: Math.max(0, Math.min(cols - 1, x)), y: Math.max(0, Math.min(rows - 1, y)) };
    };
    let drag: { x0: number; y0: number; x1: number; y1: number } | null = null;
    const rmKind = rpgMakerAutotileSheet(cols, rows);
    const outline = (cells: readonly RoomKitCell[], color: string) => {
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      for (const c of cells) {
        const [px, py] = typeof c === "number" ? [(c % cols) * T, Math.floor(c / cols) * T] : [c.px, c.py];
        ctx.strokeRect(px * SHEET_SCALE + 1, py * SHEET_SCALE + 1, T * SHEET_SCALE - 2, T * SHEET_SCALE - 2);
      }
    };
    const paint = () => {
      ctx.clearRect(0, 0, view.width, view.height);
      ctx.drawImage(sheet, 0, 0, view.width, view.height);
      outline(draft.floor?.flat() ?? [], SLOTS[0]!.color);
      outline(draft.wallTop ?? [], SLOTS[1]!.color);
      outline(draft.wallBottom ?? [], SLOTS[2]!.color);
      if (draft.ceiling !== undefined) outline([draft.ceiling], SLOTS[3]!.color);
      if (drag) {
        const x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1);
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.setLineDash([4, 3]);
        ctx.strokeRect(x * T * SHEET_SCALE, y * T * SHEET_SCALE, (Math.abs(drag.x1 - drag.x0) + 1) * T * SHEET_SCALE, (Math.abs(drag.y1 - drag.y0) + 1) * T * SHEET_SCALE);
        ctx.setLineDash([]);
      }
    };
    const commit = () => {
      if (!drag) return;
      const x0 = Math.min(drag.x0, drag.x1), x1 = Math.max(drag.x0, drag.x1), y0 = Math.min(drag.y0, drag.y1), y1 = Math.max(drag.y0, drag.y1);
      drag = null;
      const grid = Array.from({ length: y1 - y0 + 1 }, (_, dy) => Array.from({ length: x1 - x0 + 1 }, (_, dx) => (y0 + dy) * cols + x0 + dx));
      if (rmKind && draft.rmBlocks !== false) {
        const b = rpgMakerBlockPicks(rmKind, x0, y0, T);
        if (draft.slot === "floor" || draft.slot === "ceiling") {
          if (!b?.surface) { message.textContent = "바닥·천장은 윗면 블록(2×3칸)을 누릅니다."; paint(); return; }
          if (draft.slot === "floor") draft.floor = [[b.surface]]; else draft.ceiling = b.surface;
        } else {
          if (!b?.wallTop || !b.wallBottom) { message.textContent = "벽면은 벽 블록(2×2칸, A4 의 둘째·넷째·여섯째 띠)을 누릅니다."; paint(); return; }
          draft.wallTop = [b.wallTop]; draft.wallBottom = [b.wallBottom];
        }
      } else if (draft.slot === "ceiling") draft.ceiling = grid[0]![0]!;
      else if (draft.slot === "floor") draft.floor = grid;
      else if (grid.length !== 1) { message.textContent = "벽면은 한 줄씩(가로로) 끌어 고릅니다."; paint(); return; }
      else draft[draft.slot] = grid[0]!;
      const next = SLOTS.find((s) => !isPicked(draft, s.id));
      if (next) draft.slot = next.id;
      rerender();
    };
    view.addEventListener("mousedown", (ev) => { const t = tileAt(ev); drag = { x0: t.x, y0: t.y, x1: t.x, y1: t.y }; paint(); ev.preventDefault(); });
    view.addEventListener("mousemove", (ev) => { if (!drag) return; const t = tileAt(ev); drag.x1 = t.x; drag.y1 = t.y; paint(); });
    view.addEventListener("mouseup", commit);
    view.addEventListener("mouseleave", () => { if (drag) commit(); });
    if (rmKind) {
      const box = el("input", { attrs: { type: "checkbox", ...(draft.rmBlocks !== false ? { checked: "" } : {}) }, dataset: { testid: "tileset-roomkit-rm-blocks" },
        on: { change: (ev) => { draft.rmBlocks = (ev.target as HTMLInputElement).checked; rerender(); } } });
      tools.append(el("label", { attrs: { style: "display:flex;gap:6px;align-items:center" },
        children: [box, el("span", { text: `RPG Maker ${rmKind} 오토타일 시트로 보입니다 — 블록을 한 번 누르면 이음매 없는 가운데를 뗍니다${rmKind === "A4" ? "(벽 블록 → 벽면 두 줄)" : ""}.` })] }));
    }
    sheetHost.append(view);
    paint();
    aiButton.addEventListener("click", () => {
      draft.busy = true; draft.note = "AI 가 칩셋을 보는 중입니다…"; rerender();
      void (async () => {
        try {
          const text = await requestTilesetMapping({ prompt: roomKitDraftPrompt(cols, rows), imageDataUrl: labeledSheet(sheet, T, cols, rows) });
          const got = parseRoomKitDraft(text, cols, rows);
          if (typeof got === "string") draft.note = got;
          else if (rmKind && draft.rmBlocks !== false) {
            // 오토타일 시트: AI 가 짚은 칸의 블록에서 이음매 없는 가운데를 뗀다(직접 누른 것과 같다).
            const at = (c: RoomKitCell) => (typeof c === "number" ? rpgMakerBlockPicks(rmKind, c % cols, Math.floor(c / cols), T) : null);
            const f = at(got.picks.floor[0]![0]!), w = at(got.picks.wall[0][0]!), c = at(got.picks.ceiling);
            if (f?.surface) draft.floor = [[f.surface]];
            if (w?.wallTop && w.wallBottom) { draft.wallTop = [w.wallTop]; draft.wallBottom = [w.wallBottom]; }
            if (c?.surface) draft.ceiling = c.surface;
            draft.note = `AI 초안${got.reason ? ` — ${got.reason}` : ""}. 견본 방을 보고 이상한 역할만 다시 고르세요.`;
          } else {
            draft.floor = got.picks.floor.map((r) => [...r]); draft.wallTop = [...got.picks.wall[0]]; draft.wallBottom = [...got.picks.wall[1]];
            draft.ceiling = got.picks.ceiling;
            draft.note = `AI 초안${got.reason ? ` — ${got.reason}` : ""}. 견본 방을 보고 이상한 역할만 다시 고르세요.`;
          }
        } catch (e) { draft.note = `AI 초안 실패: ${(e as Error).message}`; }
        draft.busy = false; rerender();
      })();
    });
    const keepScroll = () => { draft.scroll = { sheet: [sheetHost.scrollLeft, sheetHost.scrollTop], panel: panel.scrollTop }; };
    if (draft.scroll) { [sheetHost.scrollLeft, sheetHost.scrollTop] = draft.scroll.sheet; panel.scrollTop = draft.scroll.panel; }
    sheetHost.addEventListener("scroll", keepScroll);
    panel.addEventListener("scroll", keepScroll);

    const picks = picksOf(draft);
    if (!picks) { message.textContent = "네 가지를 다 고르면 견본 방이 나옵니다."; return; }
    const problem = roomKitPicksProblem(picks, cols * rows, { width: sheet.width, height: sheet.height, tileSize: T });
    if (problem) { message.textContent = problem; return; }
    const image = sheet.getContext("2d")!.getImageData(0, 0, sheet.width, sheet.height);
    const compiled = compileRoomKit({ width: image.width, height: image.height, data: image.data }, T, picks);
    const variants = variantCanvas(compiled);
    const base = roomKitBase(tileset);
    const spec = roomKitSpec(compiled, base) as unknown as HandInteriorSpec;
    for (const sample of SAMPLE_PLANS) {
      previewHost.append(el("figure", {
        attrs: { style: "margin:0" },
        children: [renderSample(sample.plan, spec, base, T, sheet, variants), el("figcaption", { text: sample.title })],
      }));
    }
    message.textContent = "견본이 이상하면 해당 역할을 다시 고르세요. 바닥은 이음매 없이 되풀이되는 판, 벽면은 위·아래가 이어지는 두 줄이어야 자연스럽습니다.";
    save.removeAttribute("disabled");
    save.addEventListener("click", () => {
      const dataUrl = variants.toDataURL("image/png");
      recordProjectSnapshot();
      store.update((project) => installRoomKit(project, tileset.id, compiled, { id: roomKitAssetId(T, dataUrl), dataUrl }, picks));
      drafts.delete(tileset.id);
      rerender();
    });
  })();
  return panel;
}
