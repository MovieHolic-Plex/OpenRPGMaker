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

import { chatCompletion, loadAiConfig } from "@/ai/llmClient";
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
import { openMapContextMenu } from "@/editor/panels/mapContextMenu";
import { tilesetTileBackgroundStyle } from "@/editor/tilesetImage";
import { PUBLIC_HOUSE_KIT_IDS } from "@/editor/tools/houseKitDomain";
import { unregisterModal } from "@/editor/ui/modalStack";
import { describeChipsetTile, tileDisplayLabelForIndex } from "@/project/defaults/chipsetMapping";
import { TILE } from "@/project/defaults/constants";
import { store } from "@/project/store";
import type {
  SectionStructureKitDef,
  StructureKitAiMeta,
  StructureKitPart,
  StructureKitPartKind,
  TileGroupRole,
  TilesetDef,
  TilesetId,
} from "@/project/types";
import { el } from "@/util/dom";
import { randomUuid } from "@/util/id";
import { toast } from "@/util/toast";

/** 캔버스 영역이 감당하는 최대 폭(px). 다이얼로그 본문 폭에서 팔레트 열을 뺀 값. */
const CANVAS_VIEWPORT_PX = 520;

/** 편집기 다이얼로그의 testid — openDialog 가 이 값을 오버레이 dataset 에 그대로 박는다. */
const EDITOR_DIALOG_TESTID = "structure-kit-editor";

type EditorTool = "paint" | "erase" | "part";

interface EditorSession {
  tilesetId: TilesetId;
  kitId: string;
  tool: EditorTool;
  layer: KitLayer;
  tile: number;
  tab: "shape" | "ai";
  /** AI 메타 폼의 미저장 편집 상태. [초안 수락] 전까지 store 에는 닿지 않는다. */
  draft: StructureKitAiMeta | null;
  /**
   * 지금 편집 중인 킷. 사라졌으면 알리고 편집기를 닫은 뒤 undefined 를 준다.
   * 모든 편집 경로(칠하기·부위·크기·AI)는 findKit 을 직접 부르지 않고 이걸 쓴다 —
   * 조용히 return 하면 그 뒤의 모든 편집이 store 에 닿지 못한 채 무음으로 사라진다.
   */
  readonly requireKit: () => SectionStructureKitDef | undefined;
}

/**
 * 구조물 편집기가 지금 떠 있는가.
 * DB 모달의 문서 레벨 Ctrl+Z 가드가 이걸 본다 — undo 는 store 를 통째로 갈아치우므로
 * 편집기가 보던 킷이 사라지고, 그 뒤 편집이 전부 헛일이 된다.
 * 상태 플래그가 아니라 DOM 부착 여부로 판정한다 — 백드롭 클릭·Escape 처럼
 * 우리 콜백을 거치지 않는 닫기 경로가 있어 플래그는 새기 쉽다.
 */
export function isStructureKitEditorOpen(): boolean {
  if (typeof document === "undefined") return false;
  return document.querySelector(`[data-testid="${EDITOR_DIALOG_TESTID}"]`) !== null;
}

export function openStructureKitEditor(tilesetId: TilesetId, kitId: string, onClosed: () => void): void {
  const tileset = store.getCurrent().tilesets[tilesetId];
  const kit = findKit(tilesetId, kitId);
  if (!tileset || !kit) return;

  let overlay: Element | null = null;
  let closed = false;

  // DB 모달을 취소로 닫거나 Ctrl+Z 로 store 가 교체되면 이 킷이 사라진다.
  // 예전에는 조용히 return 해서, 사용자는 계속 칠하는데 아무것도 저장되지 않았다.
  const closeBecauseKitVanished = (): void => {
    if (closed) return;
    closed = true;
    toast("이 구조물이 사라졌습니다 (되돌리기 때문일 수 있어요)", "error");
    if (overlay) {
      unregisterModal(overlay);
      overlay.remove();
    }
    onClosed();
  };

  const session: EditorSession = {
    tilesetId,
    kitId,
    tool: "paint",
    layer: "lower",
    tile: TILE.GRASS,
    tab: "shape",
    draft: null,
    requireKit: () => {
      const current = findKit(tilesetId, kitId);
      if (!current) closeBecauseKitVanished();
      return current;
    },
  };

  const canvasWrap = el("div", {
    class: "structure-kit-editor-canvas-wrap",
    dataset: { testid: "structure-kit-editor-canvas" },
  });
  const tabsWrap = el("div", { class: "structure-kit-editor-tools" });
  const rightWrap = el("div", { class: "structure-kit-editor-right" });
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
  const aiWrap = el("div", { class: "structure-kit-editor-ai" });

  const redraw = (): void => {
    const current = session.requireKit();
    if (!current) return;
    drawCanvas(canvasWrap, tileset, current, session);
    drawSize(sizeWrap, current, redraw, session);
    drawTabs(tabsWrap, session, redraw);
    if (session.tab === "ai") {
      drawAiTab(aiWrap, current, tileset, session, redraw);
      rightWrap.replaceChildren(tabsWrap, aiWrap);
    } else {
      drawTools(toolsWrap, session, redraw);
      drawPalette(paletteWrap, tileset, session, redraw);
      drawParts(partsWrap, current, session, redraw);
      rightWrap.replaceChildren(tabsWrap, toolsWrap, paletteWrap, partsWrap);
    }
  };

  let dragStart: { readonly cx: number; readonly cy: number } | null = null;

  const cellFromEvent = (event: PointerEvent, kit: SectionStructureKitDef) =>
    cellAtPoint(canvasWrap.getBoundingClientRect(), canvasScale(kit.width), event.clientX, event.clientY, kit);

  canvasWrap.addEventListener("pointerdown", (event) => {
    const pointer = event as PointerEvent;
    if (pointer.button !== undefined && pointer.button !== 0) return;
    const current = session.requireKit();
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
    const current = session.requireKit();
    if (!current) return;
    const end = cellFromEvent(pointer, current) ?? start;
    const rect = normalizeDragRect(start, end);
    const commit = (kind: StructureKitPartKind): void => {
      const target = session.requireKit();
      if (!target) return;
      replaceStructureKit(session.tilesetId, addPart(target, rect, kind, `pt_${randomUuid()}`));
      redraw();
    };
    // 예전에는 종류가 언제나 "입구" 로 굳어 창문·간판·자리를 그릴 방법이 아예 없었다.
    // 팝오버를 못 띄우는 환경이면 가장 잦은 용도인 입구로 만든다(옛 동작).
    if (!openPartKindMenu({ x: pointer.clientX, y: pointer.clientY }, null, commit)) commit("entrance");
  });

  openDialog(
    EDITOR_DIALOG_TESTID,
    `${kit.name ?? "구조물"} 편집`,
    [
      el("div", {
        class: "structure-kit-editor-grid",
        children: [
          el("div", { class: "structure-kit-editor-left", children: [canvasWrap, sizeWrap] }),
          rightWrap,
        ],
      }),
    ],
    [{
      label: "닫기",
      testid: "structure-kit-editor-close",
      action: () => {
        closed = true;
        onClosed();
      },
    }],
  );
  // openDialog 는 오버레이를 돌려주지 않는다 — 자기가 박은 testid 로 되찾아 둔다.
  // 킷이 사라졌을 때 이 노드를 직접 떼어 내야 하기 때문이다.
  overlay = typeof document !== "undefined"
    ? document.querySelector(`[data-testid="${EDITOR_DIALOG_TESTID}"]`)
    : null;

  redraw();
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

const AI_ROLES: readonly TileGroupRole[] = ["building", "castle", "fence", "roof", "terrain", "water", "wall", "prop"];

const AI_ROLE_LABELS: Record<TileGroupRole, string> = {
  building: "건물",
  castle: "성",
  fence: "울타리",
  roof: "지붕",
  terrain: "지형",
  water: "물",
  wall: "벽",
  prop: "소품",
};

/** 분류(TileGroupRole)의 한글 라벨 — 인스펙터의 AI 메타 요약도 이 라벨을 그대로 쓴다. */
export function aiRoleLabel(role: TileGroupRole): string {
  return AI_ROLE_LABELS[role];
}

const REPEATABILITY_OPTIONS: readonly { readonly value: "" | "repeat" | "fixed"; readonly label: string }[] = [
  { value: "", label: "미지정" },
  { value: "repeat", label: "반복 가능" },
  { value: "fixed", label: "한 채 완결" },
];

/**
 * 초안 프롬프트. 모델에 넘기는 것은 이것뿐이다 —
 * 크기·타일 행렬·각 타일의 사람 읽는 라벨·기존 이름 목록.
 * 라벨을 함께 주는 이유: 모델이 타일 번호의 의미를 추측하지 않게 한다.
 */
export function buildAiMetaDraftPrompt(
  kit: SectionStructureKitDef,
  tileset: TilesetDef,
  existingNames: readonly string[],
): string {
  const used = new Set<number>();
  for (const row of kit.rows) {
    for (const tile of row.tiles) if (tile !== TILE.EMPTY) used.add(tile);
    for (const tile of row.upperTiles ?? []) if (tile !== TILE.EMPTY) used.add(tile);
  }
  const legend = [...used]
    .sort((a, b) => a - b)
    .map((tile) => {
      // describeChipsetTile 의 label/aiLabel 은 AI 내부용 영문("Wood door top")이라 한글 단서가
      // 없다 — tileDisplayLabelForIndex 의 한글 표시명("116 나무 문 상")을 앞에 붙여야 실제로
      // "사람이 읽는 라벨"이 된다. aiLabel 은 배치 힌트(예: "146 바로 위")로 그대로 덧붙인다.
      const readable = tileDisplayLabelForIndex(tile);
      const described = describeChipsetTile(tile);
      return `  ${readable}${described.aiLabel ? ` (${described.aiLabel})` : ""}`;
    })
    .join("\n");

  const matrix = kit.rows
    .map((row) => row.tiles.map((tile) => (tile === TILE.EMPTY ? "." : String(tile))).join(" "))
    .join("\n");

  return [
    `타일셋: ${tileset.name}`,
    `구조물 이름: ${kit.name ?? "구조물"}`,
    `크기: ${kit.width}×${kit.height}`,
    "",
    "타일 행렬(하층):",
    matrix,
    "",
    "타일 뜻:",
    legend,
    "",
    `이미 쓰는 이름(중복 피할 것): ${existingNames.join(", ") || "없음"}`,
    "",
    "이 구조물의 description(무엇인지), placementRules(어디에 어떻게 놓는지),",
    `tags(검색어 배열), role(${AI_ROLES.join("|")}), repeatability(repeat|fixed)를`,
    "JSON 한 덩어리로만 답하라. repeatability 는 가로로 이어 찍어도 되면 repeat, 한 채로 완결이면 fixed.",
  ].join("\n");
}

/** 초안 응답 → 메타. origin 은 언제나 "ai" 다 — 사람이 수락해야 "user" 가 된다. */
export function parseAiMetaDraft(text: string): StructureKitAiMeta | null {
  let parsed: unknown;
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  const description = typeof record.description === "string" ? record.description : "";
  const placementRules = typeof record.placementRules === "string" ? record.placementRules : "";
  // 공백뿐인 문자열은 "내용 있음"으로 치지 않는다 — 그렇지 않으면 모델이 빈 프롬프트를
  // 돌려줘도 이 함수가 non-null 을 반환해 session.draft 를 덮어써, 사람이 요청 전에
  // 이미 입력해 두었던 값(반복·분류 포함)을 조용히 지워 버린다.
  if (!description.trim() && !placementRules.trim()) return null;

  const role = AI_ROLES.find((candidate) => candidate === record.role);
  const repeatability = record.repeatability === "repeat" || record.repeatability === "fixed"
    ? record.repeatability
    : undefined;
  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === "string")
    : undefined;

  return {
    description,
    placementRules,
    ...(tags && tags.length > 0 ? { tags } : {}),
    ...(role ? { role } : {}),
    ...(repeatability ? { repeatability } : {}),
    origin: "ai",
  };
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

function drawTabs(host: HTMLElement, session: EditorSession, redraw: () => void): void {
  const button = (label: string, testid: string, tab: EditorSession["tab"]): HTMLElement =>
    el("button", {
      class: `btn small${session.tab === tab ? " primary" : ""}`,
      attrs: { type: "button" },
      text: label,
      dataset: { testid },
      on: { click: () => { session.tab = tab; redraw(); } },
    });

  host.replaceChildren(
    button("모양", "structure-kit-editor-tab-shape", "shape"),
    button("AI 메타", "structure-kit-editor-tab-ai", "ai"),
  );
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
              const current = session.requireKit();
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

/** 팝오버 항목의 글리프. 툴 레일이 이미 쓰는 아이콘 이름만 고른다(없는 이름은 빈 칸이 된다). */
const PART_KIND_ICONS: Readonly<Record<StructureKitPartKind, string>> = {
  entrance: "link",
  window: "window",
  sign: "title",
  anchor: "pin",
};

function partKindLabel(kind: StructureKitPartKind): string {
  return PART_KIND_OPTIONS.find((option) => option.value === kind)?.label ?? kind;
}

/**
 * 부위 종류 팝오버. 맵 컨텍스트 메뉴 위젯을 그대로 빌린다 —
 * 클릭 지점 배치·바깥클릭/Esc 닫기·화살표 키 이동이 이미 들어 있다.
 * 그 파일은 건드리지 않고, 이 쓰임에 맞게 라벨과 testid 만 뒤에서 덮어쓴다.
 *
 * window 가 없는 환경(노드 유닛 테스트)에서는 그 위젯이 resize/scroll 리스너를 못 붙여
 * 던진다 — false 를 돌려주고 호출부가 팝오버 없는 경로로 넘어가게 한다.
 */
function openPartKindMenu(
  point: { readonly x: number; readonly y: number },
  currentKind: StructureKitPartKind | null,
  pick: (kind: StructureKitPartKind) => void,
): boolean {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  openMapContextMenu({
    mapId: "structure-kit-part-kind",
    mapName: "부위 종류",
    point,
    items: PART_KIND_OPTIONS.map((option) => ({
      action: () => pick(option.value),
      icon: PART_KIND_ICONS[option.value],
      id: `part-kind-${option.value}`,
      label: option.value === currentKind ? `${option.label} (현재)` : option.label,
      testId: `structure-kit-part-kind-option-${option.value}`,
    })),
  });
  const menu = document.querySelector<HTMLElement>('[data-testid="map-context-menu-structure-kit-part-kind"]');
  if (menu) {
    menu.dataset.testid = "structure-kit-part-kind-menu";
    menu.setAttribute("aria-label", "부위 종류 고르기");
    // `.map-context-menu` 의 층(z-index: --z-status)은 맵 셸 기준이라 편집기
    // 다이얼로그(--z-popover-high) 뒤에 깔린다. 이 쓰임만 한 층 올린다.
    menu.classList.add("structure-kit-part-kind-menu");
  }
  return true;
}

/** 아이콘 한 글자 버튼 — 부위 행의 ✎ · ✕. */
function partActionButton(
  glyph: string,
  label: string,
  testid: string,
  onClick: (event: Event) => void,
): HTMLElement {
  return el("button", {
    class: "structure-kit-editor-part-action",
    attrs: { type: "button", title: label, "aria-label": label },
    text: glyph,
    dataset: { testid },
    on: { click: onClick },
  });
}

/** 버튼에서 뜨는 팝오버의 기준점 — 키보드로 눌렀으면 clientX 가 0 이라 버튼 아래를 쓴다. */
function pointFromButtonEvent(event: Event): { readonly x: number; readonly y: number } {
  const mouse = event as MouseEvent;
  if (mouse.clientX || mouse.clientY) return { x: mouse.clientX, y: mouse.clientY };
  const target = event.currentTarget;
  if (target instanceof HTMLElement) {
    const rect = target.getBoundingClientRect();
    return { x: rect.left, y: rect.bottom };
  }
  return { x: 0, y: 0 };
}

function drawParts(
  host: HTMLElement,
  kit: SectionStructureKitDef,
  session: EditorSession,
  redraw: () => void,
): void {
  const parts = kit.parts ?? [];
  const rows: HTMLElement[] = [
    el("div", {
      class: "structure-kit-editor-parts-head",
      children: [
        el("div", { class: "structure-kit-editor-parts-title", text: `부위 (${parts.length})` }),
        // 인스펙터에 있던 [문에서 입구 추정]이 여기로 왔다 — 부위를 고치는 자리가 편집기다.
        el("button", {
          class: "btn small structure-kit-estimate",
          attrs: { type: "button" },
          text: "문에서 추정",
          dataset: { testid: "structure-kit-estimate-entrance" },
          on: {
            click: () => {
              const current = session.requireKit();
              if (!current) return;
              const estimated = autoEstimateEntranceParts(current);
              if (estimated.length === 0) {
                toast("문 타일을 찾지 못했습니다.", "info");
                return;
              }
              const merged = [
                ...(current.parts ?? []).filter((part) => part.kind !== "entrance"),
                ...estimated,
              ];
              replaceStructureKit(session.tilesetId, { ...current, parts: merged });
              toast(`입구 ${estimated.length}곳 추정 완료`, "ok");
              redraw();
            },
          },
        }),
      ],
    }),
  ];

  if (parts.length === 0) {
    rows.push(
      el("p", {
        class: "structure-kit-quiet",
        text: "[부위 그리기]로 캔버스를 끌면 종류를 고르는 창이 뜹니다.",
      }),
    );
  }

  parts.forEach((part, index) => {
    rows.push(
      el("div", {
        class: "structure-kit-editor-part-row",
        children: [
          el("span", { class: "structure-kit-editor-part-index", text: String(index + 1) }),
          el("span", { class: "structure-kit-editor-part-kind", text: partKindLabel(part.kind) }),
          el("span", {
            class: "structure-kit-editor-part-range",
            text: `(${part.dx},${part.dy}) ${part.w}×${part.h}`,
          }),
          partActionButton("✎", "부위 편집", `structure-kit-editor-part-edit-${part.id}`, (event) => {
            openPartKindMenu(pointFromButtonEvent(event), part.kind, (kind) => {
              const current = session.requireKit();
              if (!current) return;
              replaceStructureKit(session.tilesetId, updatePart(current, part.id, { kind }));
              redraw();
            });
          }),
          partActionButton("✕", "부위 삭제", `structure-kit-editor-part-delete-${part.id}`, () => {
            const current = session.requireKit();
            if (!current) return;
            replaceStructureKit(session.tilesetId, removePart(current, part.id));
            redraw();
          }),
        ],
      }),
    );
  });

  host.replaceChildren(...rows);
}

/**
 * 문 타일을 찾아 입구 부위를 추정한다. 인스펙터에서 옮겨 왔다 —
 * 부위를 만드는 자리와 고치는 자리가 갈려 있으면 사용자가 어디를 봐야 할지 모른다.
 */
function autoEstimateEntranceParts(kit: SectionStructureKitDef): StructureKitPart[] {
  const estimated: StructureKitPart[] = [];
  // 문 타일 id 예: 116, 146, 360 등 (RM2k3 도어 패턴)
  const DOOR_TILES = new Set([116, 146, 117, 147, 360, 361]);

  for (let y = 0; y < kit.rows.length; y += 1) {
    const row = kit.rows[y];
    if (!row) continue;
    for (let x = 0; x < kit.width; x += 1) {
      const tile = row.tiles[x] ?? -1;
      const upper = row.upperTiles?.[x] ?? -1;
      if (DOOR_TILES.has(tile) || DOOR_TILES.has(upper)) {
        estimated.push({
          id: `pt_${randomUuid()}`,
          kind: "entrance",
          dx: x,
          dy: Math.max(0, y - 1),
          w: 1,
          h: 3,
          note: "문 2칸 + 앞 1칸",
        });
      }
    }
  }
  return estimated;
}

function drawAiTab(
  host: HTMLElement,
  kit: SectionStructureKitDef,
  tileset: TilesetDef,
  session: EditorSession,
  redraw: () => void,
): void {
  const current = session.draft ?? kit.ai ?? { description: "", placementRules: "", origin: "ai" as const };
  const pendingApproval = current.origin !== "user";

  const area = (label: string, testid: string, value: string, apply: (next: string) => void): HTMLElement =>
    el("label", {
      class: "structure-kit-editor-ai-field",
      children: [
        el("span", { text: label }),
        el("textarea", {
          value,
          dataset: { testid },
          on: {
            change: (event: Event) => {
              const target = event.currentTarget;
              if (!(target instanceof HTMLTextAreaElement)) return;
              apply(target.value);
            },
          },
        }),
      ],
    });

  const draft: StructureKitAiMeta = { ...current };
  session.draft = draft;

  const repeatabilitySelect = el("select", {
    dataset: { testid: "structure-kit-editor-ai-repeatability" },
    children: REPEATABILITY_OPTIONS.map((option) =>
      el("option", {
        attrs: (draft.repeatability ?? "") === option.value
          ? { value: option.value, selected: "" }
          : { value: option.value },
        text: option.label,
      }),
    ),
    on: {
      change: (event: Event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLSelectElement)) return;
        // "미지정" 은 undefined 를 저장하는 게 아니라 키 자체를 지운다 — 다른 optional 메타
        // 필드와 같은 규약(예: bakeStructureKit 의 tags 처리)이다.
        if (target.value === "repeat" || target.value === "fixed") draft.repeatability = target.value;
        else delete draft.repeatability;
      },
    },
  });

  const roleSelect = el("select", {
    dataset: { testid: "structure-kit-editor-ai-role" },
    children: [
      el("option", {
        attrs: draft.role === undefined ? { value: "", selected: "" } : { value: "" },
        text: "미지정",
      }),
      ...AI_ROLES.map((role) =>
        el("option", {
          attrs: draft.role === role ? { value: role, selected: "" } : { value: role },
          text: aiRoleLabel(role),
        }),
      ),
    ],
    on: {
      change: (event: Event) => {
        const target = event.currentTarget;
        if (!(target instanceof HTMLSelectElement)) return;
        if (target.value) draft.role = target.value as TileGroupRole;
        else delete draft.role;
      },
    },
  });

  const selectField = (label: string, select: HTMLElement): HTMLElement =>
    el("label", {
      class: "structure-kit-editor-ai-field",
      children: [el("span", { text: label }), select],
    });

  host.replaceChildren(
    el("div", {
      class: "structure-kit-editor-ai-head",
      children: [
        el("button", {
          class: "btn small",
          attrs: { type: "button" },
          text: "✨ AI 초안 받기",
          dataset: { testid: "structure-kit-editor-ai-draft" },
          on: { click: () => { void requestAiMetaDraft(kit, tileset, session, redraw); } },
        }),
        ...(pendingApproval
          ? [el("span", { class: "structure-kit-editor-ai-badge", text: "미승인" })]
          : []),
      ],
    }),
    area("설명", "structure-kit-editor-ai-description", draft.description, (next) => { draft.description = next; }),
    area("배치 규칙", "structure-kit-editor-ai-placement", draft.placementRules, (next) => { draft.placementRules = next; }),
    selectField("반복", repeatabilitySelect),
    selectField("분류", roleSelect),
    el("button", {
      class: "btn primary",
      attrs: { type: "button" },
      text: "초안 수락 — 내가 보증",
      dataset: { testid: "structure-kit-editor-ai-accept" },
      on: {
        click: () => {
          const target = session.requireKit();
          if (!target) return;
          // 제로 부트스트랩: 여기가 origin 을 "user" 로 만드는 유일한 지점이다.
          replaceStructureKit(session.tilesetId, { ...target, ai: { ...draft, origin: "user" } });
          session.draft = null;
          toast("AI 메타를 승인했습니다", "ok");
          redraw();
        },
      },
    }),
  );
}

async function requestAiMetaDraft(
  kit: SectionStructureKitDef,
  tileset: TilesetDef,
  session: EditorSession,
  redraw: () => void,
): Promise<void> {
  const existingNames = (store.getCurrent().tilesets[session.tilesetId]?.structureKits ?? [])
    .filter((candidate) => candidate.id !== kit.id)
    .map((candidate) => candidate.name ?? "구조물");

  toast("AI 초안을 요청하는 중...", "info");
  try {
    const result = await chatCompletion(loadAiConfig(), {
      messages: [
        {
          role: "system",
          content:
            "너는 2D 타일 RPG 편집기의 구조물 어휘 사서다."
            + " 주어진 타일 행렬을 보고 이 구조물이 무엇이고 어디에 놓아야 하는지 기술한다."
            + " JSON 한 덩어리로만 답하고 다른 말은 붙이지 않는다.",
        },
        { role: "user", content: buildAiMetaDraftPrompt(kit, tileset, existingNames) },
      ],
    });
    const text = typeof result.message.content === "string"
      ? result.message.content
      : (result.message.content ?? [])
          .map((part) => (part.type === "text" ? part.text : ""))
          .join("");
    const draft = parseAiMetaDraft(text);
    if (!draft) {
      // 폼을 비우지 않는다 — 사람이 쓰던 내용을 모델 실패로 날리지 않는다.
      toast("초안을 읽지 못했습니다. 직접 적어 주세요.", "error");
      return;
    }
    session.draft = draft;
    redraw();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    toast(`초안 요청 실패: ${message}`, "error");
  }
}
