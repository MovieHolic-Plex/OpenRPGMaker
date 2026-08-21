// editor/panels/demoTeachCanvas.ts
// "시연으로 가르치기" 샌드박스 캔버스 — AI 추측이 틀렸을 때 말 대신 직접 깔아서 보여준다.
// 실제 맵은 절대 바뀌지 않는다(맵 영역을 복사한 사본 또는 빈 잔디 캔버스).
// 붓질 순서가 그대로 기록되어 설명과 함께 AI에게 전달된다(demonstrationPrompt가 조립).

import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { tileLayerHome } from "@/editor/tileLayerClassification";
import { searchResources } from "@/assets/resourceSearch";
import { knownTileLabel } from "@/editor/tools/tileMetadataTools";
import type { DemonstrationPayload, DemonstrationStroke } from "@/ai/demonstrationPrompt";
import { DEFAULT_TILESET_ID, TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

export interface DemoTeachSeed {
  mapId: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DemoTeachOptions {
  seed?: DemoTeachSeed | null;
  onSend: (payload: DemonstrationPayload) => void;
}

const MAX_W = 16;
const MAX_H = 12;
const DEFAULT_W = 10;
const DEFAULT_H = 8;
const CELL_SIZE = 32;

export function openDemoTeachModal(options: DemoTeachOptions): HTMLElement {
  document.querySelector("[data-testid='demo-teach-modal']")?.remove();
  const project = store.getCurrent();
  const seed = options.seed ?? null;
  const map = seed ? project.maps[seed.mapId] : undefined;
  const tileset = project.tilesets[map?.tilesetId ?? DEFAULT_TILESET_ID] ?? project.tilesets[DEFAULT_TILESET_ID];

  const w = Math.min(MAX_W, Math.max(1, seed?.w ?? DEFAULT_W));
  const h = Math.min(MAX_H, Math.max(1, seed?.h ?? DEFAULT_H));

  // 시드 스냅샷(실행취소의 기준점). 맵 사본 또는 잔디/빈 캔버스.
  const seedLower: number[][] = [];
  const seedUpper: number[][] = [];
  for (let row = 0; row < h; row += 1) {
    const lowerRow: number[] = [];
    const upperRow: number[] = [];
    for (let col = 0; col < w; col += 1) {
      if (seed && map) {
        const index = (seed.y + row) * map.width + (seed.x + col);
        lowerRow.push(map.lowerTiles[index] ?? TILE.GRASS);
        upperRow.push(map.upperTiles[index] ?? TILE.EMPTY);
      } else {
        lowerRow.push(TILE.GRASS);
        upperRow.push(TILE.EMPTY);
      }
    }
    seedLower.push(lowerRow);
    seedUpper.push(upperRow);
  }
  const lower = seedLower.map((row) => [...row]);
  const upper = seedUpper.map((row) => [...row]);
  const strokes: DemonstrationStroke[] = [];

  let currentTile: number = TILE.GRASS;
  let currentLayer: "lower" | "upper" = "lower";

  const labelOf = (tile: number): string => (tile < 0 ? "지우기" : knownTileLabel(tileset, tile) ?? `타일 ${tile}`);

  // ── 현재 붓 표시 ─────────────────────────────────────────────
  const brushPreview = el("div", { class: "demo-teach-brush", dataset: { testid: "demo-teach-brush" } });
  const brushLabel = el("span", { class: "demo-teach-brush-label", text: "" });
  const refreshBrush = (): void => {
    brushPreview.setAttribute("style", currentTile >= 0 ? tilesetTileBackgroundStyle(tileset, currentTile, 28) : "");
    brushLabel.textContent = `${labelOf(currentTile)} · ${currentLayer === "upper" ? "상위" : "하위"} 레이어`;
  };

  // 투명 배경 칩(벤치·사선 지붕·나무 등)은 상위 전용 — 실제 에디터/AI 페인트와 같은 규칙.
  const upperOnlyTile = (tile: number): boolean => tile >= 0 && tileLayerHome(tileset, tile) === "upper";

  const pickTile = (tile: number): void => {
    currentTile = tile;
    if (tile < 0) currentLayer = "upper"; // 지우개는 상위 전용.
    else if (upperOnlyTile(tile)) currentLayer = "upper"; // 투명 칩도 상위 전용.
    refreshLayerButtons();
    refreshBrush();
    rememberRecent(tile);
  };

  // ── 캔버스 그리드 ────────────────────────────────────────────
  const cellRefs: { root: HTMLElement; upperEl: HTMLElement }[][] = [];
  const refreshCell = (row: number, col: number): void => {
    const ref = cellRefs[row][col];
    const lowerTile = lower[row][col];
    const upperTile = upper[row][col];
    ref.root.setAttribute("style", lowerTile >= 0 ? tilesetTileBackgroundStyle(tileset, lowerTile, CELL_SIZE) : "");
    ref.upperEl.setAttribute("style", upperTile >= 0 ? tilesetTileBackgroundStyle(tileset, upperTile, CELL_SIZE) : "");
  };
  const refreshAllCells = (): void => {
    for (let row = 0; row < h; row += 1) {
      for (let col = 0; col < w; col += 1) refreshCell(row, col);
    }
  };

  const paint = (row: number, col: number): void => {
    if (currentLayer === "lower" && currentTile < 0) return; // 하위엔 지우기 없음.
    const layer = upperOnlyTile(currentTile) ? "upper" : currentLayer; // 투명 칩은 항상 상위에.
    if (layer === "lower") lower[row][col] = currentTile;
    else upper[row][col] = currentTile;
    strokes.push({ layer, x: col, y: row, tile: currentTile });
    refreshCell(row, col);
    refreshCount();
  };

  const gridRows: HTMLElement[] = [];
  for (let row = 0; row < h; row += 1) {
    const refs: { root: HTMLElement; upperEl: HTMLElement }[] = [];
    const cells: HTMLElement[] = [];
    for (let col = 0; col < w; col += 1) {
      const upperEl = el("div", { class: "demo-teach-cell-upper" });
      const root = el("div", {
        class: "demo-teach-cell",
        attrs: { title: `(${col},${row})` },
        dataset: { testid: `demo-teach-cell-${col}-${row}` },
        children: [upperEl],
        on: { click: () => paint(row, col) },
      });
      refs.push({ root, upperEl });
      cells.push(root);
    }
    cellRefs.push(refs);
    gridRows.push(el("div", { class: "demo-teach-grid-row", children: cells }));
  }
  const grid = el("div", { class: "demo-teach-grid", dataset: { testid: "demo-teach-grid" }, children: gridRows });

  // ── 팔레트: 검색 + 시드 타일 + 최근 ──────────────────────────
  const paletteResults = el("div", { class: "demo-teach-palette-results", dataset: { testid: "demo-teach-palette-results" } });
  const renderPaletteTiles = (host: HTMLElement, tiles: number[]): void => {
    host.replaceChildren();
    for (const tile of tiles) {
      host.append(
        el("button", {
          class: "demo-teach-palette-tile",
          attrs: {
            type: "button",
            title: labelOf(tile),
            style: tile >= 0 ? tilesetTileBackgroundStyle(tileset, tile, 28) : "",
          },
          dataset: { testid: `demo-teach-pick-${tile}` },
          on: { click: () => pickTile(tile) },
        })
      );
    }
  };
  const searchInput = el("input", {
    class: "demo-teach-search",
    attrs: { type: "text", placeholder: "타일 검색 (예: 나무, 지붕, 울타리)" },
    dataset: { testid: "demo-teach-search" },
  }) as HTMLInputElement;
  searchInput.addEventListener("input", () => {
    const query = searchInput.value.trim();
    if (!query) {
      paletteResults.replaceChildren();
      return;
    }
    const matches = searchResources("tile", query, { tileset }).slice(0, 14);
    renderPaletteTiles(paletteResults, matches.map((match) => Number(match.id.replace("tile:", ""))));
  });

  const seedTiles = [...new Set([...seedLower.flat(), ...seedUpper.flat()])].filter((tile) => tile >= 0).slice(0, 14);
  const seedTilesHost = el("div", { class: "demo-teach-palette-results" });
  renderPaletteTiles(seedTilesHost, seedTiles);

  const recentTiles: number[] = [];
  const recentHost = el("div", { class: "demo-teach-palette-results" });
  const rememberRecent = (tile: number): void => {
    if (tile < 0) return;
    const existing = recentTiles.indexOf(tile);
    if (existing !== -1) recentTiles.splice(existing, 1);
    recentTiles.unshift(tile);
    if (recentTiles.length > 10) recentTiles.pop();
    renderPaletteTiles(recentHost, recentTiles);
  };

  // ── 레이어/지우개/실행취소 ───────────────────────────────────
  const lowerButton = el("button", { class: "ai-assistant-action", text: "바닥", attrs: { type: "button" }, dataset: { testid: "demo-teach-layer-lower" } });
  const upperButton = el("button", { class: "ai-assistant-action", text: "덧그림", attrs: { type: "button" }, dataset: { testid: "demo-teach-layer-upper" } });
  const refreshLayerButtons = (): void => {
    if (currentLayer === "lower") {
      lowerButton.classList.add("is-active");
      upperButton.classList.remove("is-active");
    } else {
      upperButton.classList.add("is-active");
      lowerButton.classList.remove("is-active");
    }
  };
  lowerButton.addEventListener("click", () => {
    currentLayer = "lower";
    if (currentTile < 0 || upperOnlyTile(currentTile)) currentTile = TILE.GRASS; // 지우개/투명 칩은 하위 붓이 될 수 없다.
    refreshLayerButtons();
    refreshBrush();
  });
  upperButton.addEventListener("click", () => {
    currentLayer = "upper";
    refreshLayerButtons();
    refreshBrush();
  });
  const eraserButton = el("button", {
    class: "ai-assistant-action",
    text: "지우개(덧그림)",
    attrs: { type: "button", title: "덧그림 레이어 타일을 지웁니다" },
    dataset: { testid: "demo-teach-eraser" },
    on: { click: () => pickTile(-1) },
  });
  const undoButton = el("button", {
    class: "ai-assistant-action",
    text: "↶ 한 칸 취소",
    attrs: { type: "button" },
    dataset: { testid: "demo-teach-undo" },
    on: {
      click: () => {
        if (strokes.length === 0) return;
        strokes.pop();
        for (let row = 0; row < h; row += 1) {
          lower[row] = [...seedLower[row]];
          upper[row] = [...seedUpper[row]];
        }
        for (const stroke of strokes) {
          if (stroke.layer === "lower") lower[stroke.y][stroke.x] = stroke.tile;
          else upper[stroke.y][stroke.x] = stroke.tile;
        }
        refreshAllCells();
        refreshCount();
      },
    },
  });

  const strokeCount = el("span", { class: "demo-teach-count", dataset: { testid: "demo-teach-count" }, text: "붓질 0회" });
  const refreshCount = (): void => {
    strokeCount.textContent = `붓질 ${strokes.length}회`;
  };

  // ── 설명 + 전송 ──────────────────────────────────────────────
  const explanation = el("textarea", {
    class: "demo-teach-explanation",
    attrs: { rows: "2", placeholder: "무엇을 보여주는 시연인가요? 예: 나무(290)는 이렇게 2×2 이상 뭉쳐야 숲으로 보임" },
    dataset: { testid: "demo-teach-explanation" },
  }) as HTMLTextAreaElement;

  const closeButton = el("button", { class: "database-modal-close", text: "x", attrs: { type: "button", "aria-label": "닫기" }, dataset: { testid: "demo-teach-close" } });
  const cancelButton = el("button", { class: "ai-assistant-action", text: "취소", attrs: { type: "button" }, dataset: { testid: "demo-teach-cancel" } });
  const sendButton = el("button", { class: "ai-assistant-action ai-proposal-accept", text: "AI에게 보내기", attrs: { type: "button" }, dataset: { testid: "demo-teach-send" } });

  const backdrop = el("div", {
    class: "database-modal-backdrop",
    attrs: { role: "presentation" },
    dataset: { testid: "demo-teach-modal" },
    children: [
      el("section", {
        class: "database-modal-window demo-teach-window",
        attrs: { role: "dialog", "aria-modal": "true", "aria-label": "시연으로 가르치기" },
        children: [
          el("header", {
            class: "database-modal-header demo-teach-header",
            children: [
              el("h2", { text: "✍️ 시연으로 가르치기 — 직접 깔아서 보여주세요" }),
              el("span", { class: "demo-teach-origin", text: seed ? `${seed.mapId} (${seed.x},${seed.y}) 사본 · 실제 맵은 안 바뀜` : "빈 캔버스" }),
              closeButton,
            ],
          }),
          el("div", {
            class: "database-modal-body demo-teach-body",
            children: [
              el("div", {
                class: "demo-teach-left",
                children: [
                  el("div", { class: "demo-teach-toolbar", children: [lowerButton, upperButton, eraserButton, undoButton, strokeCount, brushPreview, brushLabel] }),
                  grid,
                ],
              }),
              el("div", {
                class: "demo-teach-palette",
                children: [
                  searchInput,
                  paletteResults,
                  el("p", { class: "demo-teach-palette-caption", text: "이 영역의 타일" }),
                  seedTilesHost,
                  el("p", { class: "demo-teach-palette-caption", text: "최근 사용" }),
                  recentHost,
                ],
              }),
            ],
          }),
          el("footer", {
            class: "structure-review-footer",
            children: [explanation, cancelButton, sendButton],
          }),
        ],
      }),
    ],
  });

  const close = (): void => {
    backdrop.remove();
    document.removeEventListener?.("keydown", onKeyDown);
  };
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") close();
  };
  closeButton.addEventListener("click", close);
  cancelButton.addEventListener("click", close);
  backdrop.addEventListener("mousedown", (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener?.("keydown", onKeyDown);

  sendButton.addEventListener("click", () => {
    if (strokes.length === 0) {
      toast("타일을 한 칸이라도 깔아야 시연이 됩니다.", "error");
      return;
    }
    options.onSend({
      w,
      h,
      seed: seed ? { mapId: seed.mapId, x: seed.x, y: seed.y } : null,
      lower: lower.map((row) => [...row]),
      upper: upper.map((row) => [...row]),
      strokes: [...strokes],
      explanation: explanation.value,
    });
    close();
  });

  refreshLayerButtons();
  refreshBrush();
  refreshAllCells();
  document.body.append(backdrop);
  return backdrop;
}
