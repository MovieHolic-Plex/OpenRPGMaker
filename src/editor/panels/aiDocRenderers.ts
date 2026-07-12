// AI 리치 문서 렌더러 — present_doc 툴이 만든 AiDocument를 DOM으로 그린다.
// 구조화 블록은 살아있는 타일셋(tilesetImageUrl/배경 스타일)에서 그려지므로
// 타일셋이 바뀌면 문서도 따라 바뀐다. html 블록만 샌드박스 iframe.

import { tilesetImageUrl, tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { renderMarkdown } from "@/util/markdown";
import { el } from "@/util/dom";
import type { AiDocBlock, AiDocument, TilesetDef } from "@/project/types";

const ZONE_COLORS = ["#2e8b57", "#4f86c6", "#c68b4f", "#9a6bb0", "#c65f5f", "#5fa8a0"];

export function renderAiDocument(doc: AiDocument, tilesets: Record<string, TilesetDef>): HTMLElement {
  return el("article", {
    class: "ai-doc",
    dataset: { testid: `ai-doc-${doc.id}` },
    children: [
      el("h3", { class: "ai-doc-title", text: doc.title }),
      ...doc.blocks.map((block) => renderBlock(block, tilesets)),
    ],
  });
}

function renderBlock(block: AiDocBlock, tilesets: Record<string, TilesetDef>): HTMLElement {
  try {
    switch (block.kind) {
      case "markdown":
        return wrap("markdown", [renderMarkdown(block.text)]);
      case "table":
        return renderTable(block);
      case "sheetMap":
        return renderSheetMap(block, tilesets);
      case "tileBlockCard":
        return renderTileBlockCard(block, tilesets);
      case "paintDemo":
        return renderPaintDemo(block, tilesets);
      case "html":
        return renderSandboxHtml(block);
      default:
        return blockError(`알 수 없는 블록: ${(block as { kind?: string }).kind ?? "?"}`);
    }
  } catch (error) {
    return blockError(error instanceof Error ? error.message : String(error));
  }
}

function wrap(kind: string, children: HTMLElement[]): HTMLElement {
  return el("section", { class: `ai-doc-block ai-doc-${kind}`, children });
}

function blockError(message: string): HTMLElement {
  return el("section", { class: "ai-doc-block ai-doc-error", text: `블록 렌더 실패: ${message}` });
}

function requireTileset(tilesets: Record<string, TilesetDef>, tilesetId: string): TilesetDef {
  const tileset = tilesets[tilesetId];
  if (!tileset) throw new Error(`타일셋 없음: ${tilesetId}`);
  return tileset;
}

function renderTable(block: Extract<AiDocBlock, { kind: "table" }>): HTMLElement {
  const head = el("tr", { children: block.headers.map((header) => el("th", { text: header })) });
  const rows = block.rows.map((row) =>
    el("tr", { children: block.headers.map((_, index) => el("td", { text: row[index] ?? "" })) })
  );
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.append(head);
  const tbody = document.createElement("tbody");
  rows.forEach((row) => tbody.append(row));
  table.append(thead, tbody);
  return wrap("table", [el("div", { class: "ai-doc-table-scroll", children: [table as unknown as HTMLElement] })]);
}

function renderSheetMap(block: Extract<AiDocBlock, { kind: "sheetMap" }>, tilesets: Record<string, TilesetDef>): HTMLElement {
  const tileset = requireTileset(tilesets, block.tilesetId);
  const scale = 2;
  const cell = tileset.tileSize * scale;
  const cols = tileset.tilesPerRow;
  const rowCount = Math.ceil(tileset.count / cols);
  const sheet = el("div", {
    class: "ai-doc-sheet-inner",
    attrs: {
      style: [
        `width:${cols * cell}px`,
        `height:${rowCount * cell}px`,
        `background-image:url("${tilesetImageUrl(tileset)}")`,
        `background-size:${cols * cell}px auto`,
      ].join(";"),
    },
    children: block.zones.map((zone, index) => {
      const color = zone.color ?? ZONE_COLORS[index % ZONE_COLORS.length]!;
      return el("div", {
        class: "ai-doc-zone",
        attrs: {
          style: [
            `left:${zone.col * cell}px`,
            `top:${zone.row * cell}px`,
            `width:${zone.w * cell}px`,
            `height:${zone.h * cell}px`,
            `border-color:${color}`,
          ].join(";"),
        },
        children: [
          el("span", {
            text: zone.label,
            attrs: { style: `background:${color};${zone.row === 0 ? "top:auto;bottom:-20px;" : ""}` },
          }),
        ],
      });
    }),
  });
  return wrap("sheet", [el("div", { class: "ai-doc-sheet-scroll", children: [sheet] })]);
}

function renderTileBlockCard(
  block: Extract<AiDocBlock, { kind: "tileBlockCard" }>,
  tilesets: Record<string, TilesetDef>,
): HTMLElement {
  const tileset = requireTileset(tilesets, block.tilesetId);
  const size = block.w > 6 || block.h > 6 ? 32 : 44;
  const rows: HTMLElement[] = [];
  for (let dy = 0; dy < block.h; dy += 1) {
    const cells: HTMLElement[] = [];
    for (let dx = 0; dx < block.w; dx += 1) {
      const tile = (block.row + dy) * tileset.tilesPerRow + (block.col + dx);
      cells.push(el("div", {
        class: "ai-doc-card-cell",
        attrs: { style: `width:${size}px;height:${size}px;${tilesetTileBackgroundStyle(tileset, tile, size)}`, title: `tile ${tile}` },
      }));
    }
    rows.push(el("div", { class: "ai-doc-card-row", children: cells }));
  }
  const header: HTMLElement[] = [el("span", { class: "ai-doc-card-title", text: block.title })];
  if (block.badge) header.push(el("span", { class: "ai-doc-badge", text: block.badge }));
  const first = block.row * tileset.tilesPerRow + block.col;
  const last = (block.row + block.h - 1) * tileset.tilesPerRow + (block.col + block.w - 1);
  const children: HTMLElement[] = [
    el("div", { class: "ai-doc-card-head", children: header }),
    el("div", { class: "ai-doc-card-ids", text: `tiles ${first} ~ ${last} · ${block.w}×${block.h}` }),
    el("div", { class: "ai-doc-card-grid", children: rows }),
  ];
  if (block.caption) children.push(el("div", { class: "ai-doc-card-caption", text: block.caption }));
  return wrap("card", children);
}

/**
 * RM2k3 3×4 오토타일 블록 인터랙티브 페인트 데모.
 * 표준 배치 가정: (0,0) 고립 · (1,0) 바탕 · (2,0) 오목 코너 소스 · rows 1-3 = 3×3 본체.
 * 쿼터(8×8)마다 v/h/d 이웃으로 소스를 골라 합성한다 — 다크월 렌더와 같은 원리.
 */
function renderPaintDemo(
  block: Extract<AiDocBlock, { kind: "paintDemo" }>,
  tilesets: Record<string, TilesetDef>,
): HTMLElement {
  const tileset = requireTileset(tilesets, block.tilesetId);
  const GW = 11;
  const GH = 7;
  const S = 40;
  const canvas = document.createElement("canvas");
  canvas.className = "ai-doc-demo-canvas";
  canvas.width = GW * S;
  canvas.height = GH * S;
  canvas.style.touchAction = "none";
  const ctx = canvas.getContext("2d");
  const grid = new Uint8Array(GW * GH);
  const preset = (): void => {
    grid.fill(0);
    for (let x = 1; x < GW - 1; x += 1) grid[3 * GW + x] = 1;
    for (let y = 1; y < GH - 1; y += 1) grid[y * GW + 5] = 1;
    grid[1 * GW + 9] = 1;
  };
  preset();

  const image = new Image();
  image.src = tilesetImageUrl(tileset);
  const ts = tileset.tileSize;
  const half = ts / 2;
  const srcX = (tx: number): number => (block.blockCol + tx) * ts;
  const srcY = (ty: number): number => (block.blockRow + ty) * ts;
  const isBlob = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < GW && y < GH && grid[y * GW + x] === 1;

  const render = (): void => {
    if (!ctx || !image.complete) return;
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < GH; y += 1) {
      for (let x = 0; x < GW; x += 1) {
        const dx = x * S;
        const dy = y * S;
        ctx.drawImage(image, srcX(1), srcY(0), ts, ts, dx, dy, S, S); // 바탕
        if (!isBlob(x, y)) continue;
        const n = isBlob(x, y - 1);
        const e = isBlob(x + 1, y);
        const s = isBlob(x, y + 1);
        const w = isBlob(x - 1, y);
        if (!n && !e && !s && !w) {
          ctx.drawImage(image, srcX(0), srcY(0), ts, ts, dx, dy, S, S); // 고립
          continue;
        }
        const quarters = [
          { qx: 0, qy: 0, vy: -1, hx: -1 },
          { qx: half, qy: 0, vy: -1, hx: 1 },
          { qx: 0, qy: half, vy: 1, hx: -1 },
          { qx: half, qy: half, vy: 1, hx: 1 },
        ];
        for (const q of quarters) {
          const v = isBlob(x, y + q.vy);
          const h = isBlob(x + q.hx, y);
          const d = isBlob(x + q.hx, y + q.vy);
          let tx: number;
          let ty: number;
          if (v && h && d) { tx = 1; ty = 2; }
          else if (v && h) { tx = 2; ty = 0; }
          else if (v) { tx = q.hx < 0 ? 0 : 2; ty = 2; }
          else if (h) { tx = 1; ty = q.vy < 0 ? 1 : 3; }
          else { tx = q.hx < 0 ? 0 : 2; ty = q.vy < 0 ? 1 : 3; }
          ctx.drawImage(image, srcX(tx) + q.qx, srcY(ty) + q.qy, half, half, dx + (q.qx / ts) * S, dy + (q.qy / ts) * S, S / 2, S / 2);
        }
      }
    }
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    for (let lx = 1; lx < GW; lx += 1) { ctx.beginPath(); ctx.moveTo(lx * S, 0); ctx.lineTo(lx * S, GH * S); ctx.stroke(); }
    for (let ly = 1; ly < GH; ly += 1) { ctx.beginPath(); ctx.moveTo(0, ly * S); ctx.lineTo(GW * S, ly * S); ctx.stroke(); }
  };
  image.addEventListener("load", render);

  let tool: "paint" | "erase" = "paint";
  let painting = false;
  const cellFromEvent = (ev: PointerEvent): { x: number; y: number } | null => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((ev.clientX - rect.left) / rect.width) * GW);
    const y = Math.floor(((ev.clientY - rect.top) / rect.height) * GH);
    if (x < 0 || y < 0 || x >= GW || y >= GH) return null;
    return { x, y };
  };
  canvas.addEventListener("pointerdown", (ev) => {
    ev.preventDefault();
    painting = true;
    canvas.setPointerCapture(ev.pointerId);
    const cell = cellFromEvent(ev);
    if (cell) { grid[cell.y * GW + cell.x] = tool === "paint" ? 1 : 0; render(); }
  });
  canvas.addEventListener("pointermove", (ev) => {
    if (!painting) return;
    const cell = cellFromEvent(ev);
    if (cell) { grid[cell.y * GW + cell.x] = tool === "paint" ? 1 : 0; render(); }
  });
  canvas.addEventListener("pointerup", () => { painting = false; });

  const paintBtn = el("button", { class: "ai-doc-demo-btn", text: "칠하기", attrs: { type: "button", "aria-pressed": "true" } });
  const eraseBtn = el("button", { class: "ai-doc-demo-btn", text: "지우기", attrs: { type: "button", "aria-pressed": "false" } });
  const resetBtn = el("button", { class: "ai-doc-demo-btn", text: "초기화", attrs: { type: "button" } });
  paintBtn.addEventListener("click", () => { tool = "paint"; paintBtn.setAttribute("aria-pressed", "true"); eraseBtn.setAttribute("aria-pressed", "false"); });
  eraseBtn.addEventListener("click", () => { tool = "erase"; eraseBtn.setAttribute("aria-pressed", "true"); paintBtn.setAttribute("aria-pressed", "false"); });
  resetBtn.addEventListener("click", () => { preset(); render(); });

  const children: HTMLElement[] = [];
  if (block.title) children.push(el("div", { class: "ai-doc-card-title", text: block.title }));
  children.push(el("div", { class: "ai-doc-demo-toolbar", children: [paintBtn, eraseBtn, resetBtn] }));
  children.push(el("div", { class: "ai-doc-demo-scroll", children: [canvas as unknown as HTMLElement] }));
  return wrap("demo", children);
}

function renderSandboxHtml(block: Extract<AiDocBlock, { kind: "html" }>): HTMLElement {
  const iframe = document.createElement("iframe");
  iframe.className = "ai-doc-iframe";
  // allow-scripts만 — same-origin 불가(부모/스토리지 접근 차단), 네트워크는 CSP 없이도 opaque origin.
  iframe.setAttribute("sandbox", "allow-scripts");
  iframe.setAttribute("referrerpolicy", "no-referrer");
  iframe.srcdoc = block.src;
  return wrap("html", [iframe as unknown as HTMLElement]);
}
