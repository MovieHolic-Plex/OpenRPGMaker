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
import {
  createBlankStructureKit,
  createStructureKitFromHouse,
  replaceStructureKit,
} from "@/editor/harnessSuggestion/structureKitActions";
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
import { HOUSE_KITS } from "@/editor/houseKit";
import { openDialog } from "@/editor/panels/databaseEnemyRecordSupport";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { PUBLIC_HOUSE_KIT_IDS } from "@/editor/tools/houseKitDomain";
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
  const toolsWrap = el("div", { class: "structure-kit-editor-tools" });
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
    drawTools(toolsWrap, session, redraw);
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
      // 드래그 도중 포인터가 캔버스 밖(도구 줄·팔레트·부위 목록)으로 나가도 pointerup 이
      // 이 리스너에 도착하도록 캡처한다 — 캡처가 없으면 밖에서 뗀 제스처는 dragStart 를
      // 영영 못 지우고, 나중에 엉뚱한 pointerup 과 짝지어져 유령 부위를 만든다.
      if (pointer.pointerId !== undefined) canvasWrap.setPointerCapture(pointer.pointerId);
      return;
    }
    const tile = session.tool === "erase" ? TILE.EMPTY : session.tile;
    replaceStructureKit(session.tilesetId, paintCell(current, cell.cx, cell.cy, session.layer, tile));
    redraw();
  });

  canvasWrap.addEventListener("pointerup", (event) => {
    const pointer = event as PointerEvent;
    if (pointer.button !== undefined && pointer.button !== 0) return;
    if (pointer.pointerId !== undefined && canvasWrap.hasPointerCapture(pointer.pointerId)) {
      canvasWrap.releasePointerCapture(pointer.pointerId);
    }
    // dragStart 는 도구 전환·리사이즈를 거쳐도 여기서 반드시 비운다 — 성공 경로에서만
    // 지우면 도구를 바꾼 채로 뗀 제스처가 dragStart 를 남기고, 나중에 도구를 part 로
    // 되돌린 뒤의 무관한 pointerup 이 그 낡은 시작점으로 유령 부위를 만든다.
    const start = dragStart;
    dragStart = null;
    if (session.tool !== "part" || !start) return;
    const current = findKit(session.tilesetId, session.kitId);
    if (!current) return;
    const end = cellFromEvent(pointer, current) ?? start;
    // 새 부위의 기본 종류는 입구다 — 워프를 놓을 자리를 지정하는 것이 가장 잦은 용도다.
    replaceStructureKit(
      session.tilesetId,
      addPart(current, normalizeDragRect(start, end), "entrance", `pt_${randomUuid()}`),
    );
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
            children: [toolsWrap, paletteWrap, partsWrap],
          }),
        ],
      }),
    ],
    [{ label: "닫기", testid: "structure-kit-editor-close", action: onClosed }],
  );
}

/** 시작점 선택 — 빈 칸이냐, 집 한 채냐. 집 갈래는 combined_town 앨범에서만 열린다. */
export function openNewStructureKitDialog(tilesetId: TilesetId, onCreated: (kitId: string) => void): void {
  let houseKitId: string = PUBLIC_HOUSE_KIT_IDS[0]!;
  let width = 9;
  let height = 8;

  const kitSelect = el("select", {
    dataset: { testid: "structure-kit-new-house-kit" },
    children: PUBLIC_HOUSE_KIT_IDS.map((id) =>
      el("option", { attrs: { value: id }, text: HOUSE_KITS[id]?.name ?? id }),
    ),
    on: {
      change: (event: Event) => {
        const target = event.currentTarget;
        if (target instanceof HTMLSelectElement) houseKitId = target.value;
      },
    },
  });

  const numberField = (label: string, testid: string, value: number, apply: (next: number) => void): HTMLElement =>
    el("label", {
      class: "structure-kit-editor-size-field",
      children: [
        el("span", { text: label }),
        el("input", {
          attrs: { type: "number", min: "3", max: "32" },
          value: String(value),
          dataset: { testid },
          on: {
            change: (event: Event) => {
              const target = event.currentTarget;
              if (target instanceof HTMLInputElement) apply(Number(target.value));
            },
          },
        }),
      ],
    });

  openDialog(
    "structure-kit-new",
    "새 구조물",
    [
      el("p", { class: "structure-kit-quiet", text: "빈 칸에서 시작하거나, 집 한 채를 놓고 고쳐 나갈 수 있습니다." }),
      el("div", {
        class: "structure-kit-new-house",
        children: [kitSelect, numberField("폭", "structure-kit-new-width", width, (n) => { width = n; }),
          numberField("높이", "structure-kit-new-height", height, (n) => { height = n; })],
      }),
    ],
    [
      {
        label: "빈 3×3 으로 시작",
        testid: "structure-kit-new-blank",
        action: () => onCreated(createBlankStructureKit(tilesetId).id),
      },
      {
        label: "이 집으로 시작",
        testid: "structure-kit-new-house-confirm",
        action: () => {
          const kit = createStructureKitFromHouse(tilesetId, houseKitId, { width, height });
          if (!kit) {
            const kitLabel = HOUSE_KITS[houseKitId as keyof typeof HOUSE_KITS]?.name ?? houseKitId;
            toast(`'${kitLabel}' 은 ${width}×${height} 크기로 지어지지 않습니다 — 폭·높이를 바꿔 보세요.`, "info");
            return;
          }
          onCreated(kit.id);
        },
      },
      { label: "취소", testid: "structure-kit-new-cancel" },
    ],
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

function drawTools(host: HTMLElement, session: EditorSession, redraw: () => void): void {
  const button = (label: string, testid: string, active: boolean, onClick: () => void): HTMLElement =>
    el("button", {
      class: `btn small${active ? " primary" : ""}`,
      attrs: { type: "button" },
      text: label,
      dataset: { testid },
      on: { click: () => { onClick(); redraw(); } },
    });

  host.replaceChildren(
    button("칠하기", "structure-kit-editor-tool-paint", session.tool === "paint", () => { session.tool = "paint"; }),
    button("지우기", "structure-kit-editor-tool-erase", session.tool === "erase", () => { session.tool = "erase"; }),
    button("하층", "structure-kit-editor-layer-lower", session.layer === "lower", () => { session.layer = "lower"; }),
    button("상층", "structure-kit-editor-layer-upper", session.layer === "upper", () => { session.layer = "upper"; }),
    button("부위 그리기", "structure-kit-editor-tool-part", session.tool === "part", () => { session.tool = "part"; }),
  );
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
