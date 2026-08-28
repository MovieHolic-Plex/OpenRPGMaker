// panels/structureKitEditorDialog.ts
// 구조물 편집기 — DB 모달 위에 뜨는 전용 다이얼로그.
//
// 왜 인스펙터가 아니라 다이얼로그인가:
//   인스펙터 열은 harness-suggestion.css:297 에서 width:352px 고정이고, 패딩을 빼면 324px 다.
//   내장 집 9×8 을 scale 3 으로 그리면 432px 라 들어가지 않는다. 타일 팔레트를 둘 자리는 더 없다.
//
// 저장 버튼이 없는 이유:
//   모든 편집은 store.update() 로 즉시 반영되고, DB 모달을 취소하면
//   createDatabaseModalDirtySession 이 세션 전체를 롤백한다. 이 모달의 기존 규약이다.
//   (같은 이유로 아무것도 저장하지 않던 인스펙터의 [지금 저장] 버튼을 없앴다.)
//
// 타일 팔레트로 renderTilePalette() 를 쓰지 않는 이유:
//   그 함수는 editorState 의 전역 브러시를 바꾼다 — 구조물 편집 중 타일을 고르면
//   맵 붓까지 같이 바뀐다. 순수 헬퍼 tilesetTileBackgroundStyle 로 격자를 직접 그린다.

import { TILE_SIZE } from "@/assets/bundled";
import { renderTileCellsToCanvas } from "@/editor/harnessSuggestion/kitRender";
import { replaceStructureKit } from "@/editor/harnessSuggestion/structureKitActions";
import {
  addPart,
  cellAtPoint,
  normalizeDragRect,
  paintCell,
  removePart,
  resizeKit,
  updatePart,
  type KitLayer,
} from "@/editor/harnessSuggestion/structureKitRasterModel";
import { openDialog } from "@/editor/panels/databaseEnemyRecordSupport";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type { SectionStructureKitDef, StructureKitPartKind, TilesetDef, TilesetId } from "@/project/types";
import { el } from "@/util/dom";
import { randomUuid } from "@/util/id";
import { toast } from "@/util/toast";

/** 캔버스 영역이 감당하는 최대 폭(px). 다이얼로그 본문 폭에서 팔레트 열을 뺀 값. */
const CANVAS_VIEWPORT_PX = 520;

type EditorTool = "paint" | "erase" | "part";

interface EditorSession {
  tilesetId: TilesetId;
  kitId: string;
  tool: EditorTool;
  layer: KitLayer;
  tile: number;
}

export function openStructureKitEditor(tilesetId: TilesetId, kitId: string, onClosed: () => void): void {
  const tileset = store.getCurrent().tilesets[tilesetId];
  const kit = findKit(tilesetId, kitId);
  if (!tileset || !kit) return;

  const session: EditorSession = {
    tilesetId,
    kitId,
    tool: "paint",
    layer: "lower",
    tile: TILE.GRASS,
  };

  const canvasWrap = el("div", {
    class: "structure-kit-editor-canvas-wrap",
    dataset: { testid: "structure-kit-editor-canvas" },
  });
  const paletteWrap = el("div", {
    class: "structure-kit-editor-palette",
    dataset: { testid: "structure-kit-editor-palette" },
  });
  const sizeWrap = el("div", { class: "structure-kit-editor-size" });
  const partsWrap = el("div", {
    class: "structure-kit-editor-parts",
    dataset: { testid: "structure-kit-editor-parts" },
  });

  const redraw = (): void => {
    const current = findKit(session.tilesetId, session.kitId);
    if (!current) return;
    drawCanvas(canvasWrap, tileset, current, session);
    drawPalette(paletteWrap, tileset, session, redraw);
    drawSize(sizeWrap, current, redraw, session);
    drawParts(partsWrap, current, session, redraw);
  };

  let dragStart: { readonly cx: number; readonly cy: number } | null = null;

  const cellFromEvent = (event: PointerEvent, kit: SectionStructureKitDef) =>
    cellAtPoint(canvasWrap.getBoundingClientRect(), canvasScale(kit.width), event.clientX, event.clientY, kit);

  canvasWrap.addEventListener("pointerdown", (event) => {
    const pointer = event as PointerEvent;
    if (pointer.button !== undefined && pointer.button !== 0) return;
    const current = findKit(session.tilesetId, session.kitId);
    if (!current) return;
    const cell = cellFromEvent(pointer, current);
    if (!cell) return;

    if (session.tool === "part") {
      dragStart = cell;
      return;
    }
    const tile = session.tool === "erase" ? TILE.EMPTY : session.tile;
    replaceStructureKit(session.tilesetId, paintCell(current, cell.cx, cell.cy, session.layer, tile));
    redraw();
  });

  canvasWrap.addEventListener("pointerup", (event) => {
    if (session.tool !== "part" || !dragStart) return;
    const current = findKit(session.tilesetId, session.kitId);
    if (!current) {
      dragStart = null;
      return;
    }
    const end = cellFromEvent(event as PointerEvent, current) ?? dragStart;
    // 새 부위의 기본 종류는 입구다 — 워프를 놓을 자리를 지정하는 것이 가장 잦은 용도다.
    replaceStructureKit(
      session.tilesetId,
      addPart(current, normalizeDragRect(dragStart, end), "entrance", `pt_${randomUuid()}`),
    );
    dragStart = null;
    redraw();
  });

  redraw();

  openDialog(
    "structure-kit-editor",
    `${kit.name ?? "구조물"} 편집`,
    [
      el("div", {
        class: "structure-kit-editor-grid",
        children: [
          el("div", { class: "structure-kit-editor-left", children: [canvasWrap, sizeWrap] }),
          el("div", {
            class: "structure-kit-editor-right",
            children: [toolRow(session, redraw), paletteWrap, partsWrap],
          }),
        ],
      }),
    ],
    [{ label: "닫기", testid: "structure-kit-editor-close", action: onClosed }],
  );
}

/** 폭에 맞춘 배율. 9×8 킷은 scale 3(432px)이 나온다. */
export function canvasScale(widthTiles: number): number {
  const raw = Math.floor(CANVAS_VIEWPORT_PX / (Math.max(1, widthTiles) * TILE_SIZE));
  return Math.min(4, Math.max(1, raw));
}

function findKit(tilesetId: TilesetId, kitId: string): SectionStructureKitDef | undefined {
  const kit = store.getCurrent().tilesets[tilesetId]?.structureKits?.find((candidate) => candidate.id === kitId);
  return kit?.kind === "section" ? kit : undefined;
}

function drawCanvas(
  host: HTMLElement,
  tileset: TilesetDef,
  kit: SectionStructureKitDef,
  session: EditorSession,
): void {
  const scale = canvasScale(kit.width);
  const cells = [];
  for (let y = 0; y < kit.height; y += 1) {
    for (let x = 0; x < kit.width; x += 1) {
      const lower = kit.rows[y]?.tiles[x] ?? TILE.EMPTY;
      const upper = kit.rows[y]?.upperTiles?.[x] ?? TILE.EMPTY;
      if (lower !== TILE.EMPTY) cells.push({ dx: x, dy: y, layer: "lower" as const, tile: lower });
      if (upper !== TILE.EMPTY) cells.push({ dx: x, dy: y, layer: "upper" as const, tile: upper });
    }
  }
  const canvas = renderTileCellsToCanvas({
    tileset,
    widthTiles: kit.width,
    heightTiles: kit.height,
    cells,
    scale,
    backgroundTile: null,
  });
  canvas.className = `structure-kit-editor-canvas layer-${session.layer}`;
  host.replaceChildren(canvas);
}

function drawPalette(
  host: HTMLElement,
  tileset: TilesetDef,
  session: EditorSession,
  redraw: () => void,
): void {
  const swatches = [];
  for (let tile = 0; tile < tileset.count; tile += 1) {
    swatches.push(
      el("button", {
        class: `structure-kit-editor-swatch${tile === session.tile ? " active" : ""}`,
        attrs: { type: "button", style: tilesetTileBackgroundStyle(tileset, tile, 20), title: String(tile) },
        dataset: { testid: `structure-kit-editor-tile-${tile}` },
        on: {
          click: () => {
            session.tile = tile;
            session.tool = "paint";
            redraw();
          },
        },
      }),
    );
  }
  host.replaceChildren(...swatches);
}

function toolRow(session: EditorSession, redraw: () => void): HTMLElement {
  const button = (label: string, testid: string, active: boolean, onClick: () => void): HTMLElement =>
    el("button", {
      class: `btn small${active ? " primary" : ""}`,
      attrs: { type: "button" },
      text: label,
      dataset: { testid },
      on: { click: () => { onClick(); redraw(); } },
    });

  return el("div", {
    class: "structure-kit-editor-tools",
    children: [
      button("칠하기", "structure-kit-editor-tool-paint", session.tool === "paint", () => { session.tool = "paint"; }),
      button("지우기", "structure-kit-editor-tool-erase", session.tool === "erase", () => { session.tool = "erase"; }),
      button("하층", "structure-kit-editor-layer-lower", session.layer === "lower", () => { session.layer = "lower"; }),
      button("상층", "structure-kit-editor-layer-upper", session.layer === "upper", () => { session.layer = "upper"; }),
      button("부위 그리기", "structure-kit-editor-tool-part", session.tool === "part", () => { session.tool = "part"; }),
    ],
  });
}

function drawSize(host: HTMLElement, kit: SectionStructureKitDef, redraw: () => void, session: EditorSession): void {
  const field = (
    label: string,
    testid: string,
    value: number,
    apply: (next: number) => { width: number; height: number },
  ): HTMLElement =>
    el("label", {
      class: "structure-kit-editor-size-field",
      children: [
        el("span", { text: label }),
        el("input", {
          attrs: { type: "number", min: "1", max: "64" },
          value: String(value),
          dataset: { testid },
          on: {
            change: (event: Event) => {
              const target = event.currentTarget;
              if (!(target instanceof HTMLInputElement)) return;
              const current = findKit(session.tilesetId, session.kitId);
              if (!current) return;
              const next = apply(Number(target.value));
              const result = resizeKit(current, next.width, next.height);
              replaceStructureKit(session.tilesetId, result.kit);
              if (result.clamped > 0 || result.dropped > 0) {
                // 조용히 지우지 않는다 — 사용자가 입구가 사라진 걸 나중에야 알게 하면 안 된다.
                const parts = [
                  result.clamped > 0 ? `부위 ${result.clamped}개 잘림` : "",
                  result.dropped > 0 ? `${result.dropped}개 삭제` : "",
                ].filter(Boolean);
                toast(parts.join(", "), "info");
              }
              redraw();
            },
          },
        }),
      ],
    });

  host.replaceChildren(
    field("폭", "structure-kit-editor-width", kit.width, (value) => ({ width: value, height: kit.height })),
    field("높이", "structure-kit-editor-height", kit.height, (value) => ({ width: kit.width, height: value })),
  );
}

const PART_KIND_OPTIONS: readonly { readonly value: StructureKitPartKind; readonly label: string }[] = [
  { value: "entrance", label: "입구" },
  { value: "window", label: "창문" },
  { value: "sign", label: "간판" },
  { value: "anchor", label: "자리" },
];

function drawParts(
  host: HTMLElement,
  kit: SectionStructureKitDef,
  session: EditorSession,
  redraw: () => void,
): void {
  const parts = kit.parts ?? [];
  const rows: HTMLElement[] = [
    el("div", { class: "structure-kit-editor-parts-title", text: `부위 (${parts.length})` }),
  ];

  if (parts.length === 0) {
    rows.push(
      el("p", {
        class: "structure-kit-quiet",
        text: "[부위 그리기]로 캔버스를 끌면 입구·창문 자리가 생깁니다.",
      }),
    );
  }

  parts.forEach((part, index) => {
    const select = el("select", {
      dataset: { testid: `structure-kit-editor-part-kind-${part.id}` },
      children: PART_KIND_OPTIONS.map((option) =>
        el("option", {
          attrs: part.kind === option.value ? { value: option.value, selected: "" } : { value: option.value },
          text: option.label,
        }),
      ),
      on: {
        change: (event: Event) => {
          const target = event.currentTarget;
          if (!(target instanceof HTMLSelectElement)) return;
          const current = findKit(session.tilesetId, session.kitId);
          if (!current) return;
          replaceStructureKit(
            session.tilesetId,
            updatePart(current, part.id, { kind: target.value as StructureKitPartKind }),
          );
          redraw();
        },
      },
    });

    rows.push(
      el("div", {
        class: "structure-kit-editor-part-row",
        children: [
          el("span", { class: "structure-kit-editor-part-index", text: String(index + 1) }),
          select,
          el("span", {
            class: "structure-kit-editor-part-range",
            text: `(${part.dx},${part.dy}) ${part.w}×${part.h}`,
          }),
          el("button", {
            class: "btn small ghost",
            attrs: { type: "button" },
            text: "삭제",
            dataset: { testid: `structure-kit-editor-part-delete-${part.id}` },
            on: {
              click: () => {
                const current = findKit(session.tilesetId, session.kitId);
                if (!current) return;
                replaceStructureKit(session.tilesetId, removePart(current, part.id));
                redraw();
              },
            },
          }),
        ],
      }),
    );
  });

  host.replaceChildren(...rows);
}
