/** @vitest-environment happy-dom */
// OPRN-OUT-023 — Esc 는 화면 밀기의 **마지막** 소비자, 이벤트 레이어 빈 칸 드래그는 팬.
//
// 왜 이 파일이 필요한가:
//  1. Esc 는 이 저장소에서 세 번 회귀했다. 회귀는 늘 "누가 먼저 가져가는가"에서 났다.
//     여기서 그 순서를 순수 함수(resolveEscapeAction)로 고정한다 — 캡처/버블 + Phaser 의
//     defaultPrevented 가드까지 재현하는 대신, **순서 자체**를 계약으로 잠근다.
//  2. 이벤트 레이어 좌클릭 드래그의 소유권은 두 갈래다(감독 결정): 빈 칸에서 시작하면 팬,
//     이벤트 위에서 시작하면 지금과 똑같이 그 이벤트를 옮긴다. 두 갈래가 한 제스처에서
//     갈리므로 포인터 라우팅을 실제 씬 몸으로 태워야 한다(순수 함수로는 못 잡는다).
//
// 맵 캔버스는 WebGL 이라 픽셀을 못 읽는다 — 도구/카메라/스토어 값으로만 판정한다.

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CameraPanController } from "@/editor/CameraPanController";
import { DragOperationHandler } from "@/editor/DragOperationHandler";
import { editorState } from "@/editor/editorState";
import {
  enterPanTool,
  escapeOwnedByTransientSurface,
  resolveEscapeAction,
  type EscapeSurfaceState,
} from "@/editor/escapeToPan";
import { installToolCursor, resetToolCursorForTest } from "@/editor/toolCursor";
import { registerModal, resetModalStackForTest } from "@/editor/ui/modalStack";
import { createBlankProject, TILE } from "@/project/defaults";
import { store } from "@/project/store";
import { addEvent } from "@/editor/eventActions";

vi.mock("@/editor/editSceneRender", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/editor/editSceneRender")>();
  // 타일 렌더는 진짜 Phaser 컨테이너를 요구한다. 이 파일의 관심은 입력 라우팅이다.
  return { ...actual, renderEditScene: vi.fn(() => ({ tileObjectsUpdated: 0 })) };
});
vi.mock("@/editor/chipsetTileRender", () => ({
  createChipsetTileObject: vi.fn(() => ({ setAlpha: vi.fn(), setOrigin: vi.fn() })),
}));

const TILE_SIZE = 16;
let EditSceneCtor: { readonly prototype: object };

beforeAll(async () => {
  // getLoadedPhaser() 는 모듈 로드 시점에 window.Phaser 를 읽는다.
  (window as unknown as { Phaser: unknown }).Phaser = { Scene: class Scene {} };
  const { EditScene } = await import("@/editor/EditScene");
  EditSceneCtor = EditScene;
}, 90_000);

beforeEach(() => {
  document.body.innerHTML = "";
  resetModalStackForTest();
  resetToolCursorForTest();
  store.replace(createBlankProject());
  editorState.set({
    currentMapId: store.getCurrent().startMapId,
    layer: "lower",
    tool: "paint",
    paintShape: "pen",
    selectedTile: TILE.GRASS,
    activePaletteStamp: null,
    selection: null,
    pastePreview: null,
    pendingEventCoordinate: null,
    selectedEventId: null,
    zoom: 2,
  });
});

afterEach(() => {
  resetToolCursorForTest();
});

function surfaces(patch: Partial<EscapeSurfaceState> = {}): EscapeSurfaceState {
  return {
    regionTaskModalOpen: false,
    modalLayerOpen: false,
    transientOwnerOpen: false,
    pastePreviewActive: false,
    selectionActive: false,
    panToolActive: false,
    ...patch,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// (a) Esc 소유권 사슬
// ─────────────────────────────────────────────────────────────────────────────

describe("Esc 소유권 순서", () => {
  it("영역 작업 창이 떠 있으면 EditScene 은 손대지 않는다", () => {
    expect(resolveEscapeAction(surfaces({ regionTaskModalOpen: true, selectionActive: true })))
      .toBe("defer-to-owner");
  });

  it("모달 계층이 살아 있으면 모달이 이긴다 — 붙여넣기 미리보기·선택보다 먼저", () => {
    expect(resolveEscapeAction(surfaces({ modalLayerOpen: true, pastePreviewActive: true, selectionActive: true })))
      .toBe("defer-to-owner");
  });

  it("preventDefault 를 안 하는 팝오버/플라이아웃이 떠 있으면 양보한다", () => {
    expect(resolveEscapeAction(surfaces({ transientOwnerOpen: true, selectionActive: true })))
      .toBe("defer-to-owner");
  });

  it("붙여넣기 미리보기 취소가 선택 해제보다 먼저다", () => {
    expect(resolveEscapeAction(surfaces({ pastePreviewActive: true, selectionActive: true })))
      .toBe("cancel-paste-preview");
  });

  it("선택만 있으면 선택 해제다 — 화면 밀기로 넘어가지 않는다", () => {
    expect(resolveEscapeAction(surfaces({ selectionActive: true }))).toBe("clear-selection");
  });

  it("아무도 가져가지 않으면 마지막 소비자가 화면 밀기다", () => {
    expect(resolveEscapeAction(surfaces())).toBe("enter-pan");
  });

  it("이미 화면 밀기면 두 번째 Esc 를 조용히 삼키지 않는다", () => {
    expect(resolveEscapeAction(surfaces({ panToolActive: true }))).toBe("none");
  });
});

describe("escapeOwnedByTransientSurface", () => {
  it("아무것도 없으면 거짓", () => {
    expect(escapeOwnedByTransientSurface()).toBe(false);
  });

  it.each([
    ["조수 하네스/툴 브라우저/마을 정보 모달", '<div class="database-modal-backdrop"></div>'],
    ["변경 비교 오버레이", '<div data-testid="ai-change-wide"></div>'],
    ["열린 컴포저 팝오버", '<div class="ai-composer-popover"></div>'],
    ["열린 ☰ 더보기 메뉴", '<div class="ai-more-menu"></div>'],
  ])("%s 가 떠 있으면 참", (_label, html) => {
    document.body.innerHTML = html;
    expect(escapeOwnedByTransientSurface()).toBe(true);
  });

  it("hidden 으로 닫힌 팝오버·메뉴는 소유자가 아니다", () => {
    document.body.innerHTML = '<div class="ai-composer-popover" hidden></div><div class="ai-more-menu" hidden></div>';
    expect(escapeOwnedByTransientSurface()).toBe(false);
  });
});

describe("enterPanTool", () => {
  it("기존 화면 밀기 도구를 켜고 커서·상태로 눈에 보이게 만든다", () => {
    installToolCursor();
    enterPanTool();
    expect(editorState.get().tool).toBe("pan");
    // body[data-editor-tool="pan"] → core.part-1.css 가 grab 커서를 준다.
    expect(document.body.dataset.editorTool).toBe("pan");
  });

  it("레이어와 들고 있던 도장을 건드리지 않는다", () => {
    const stamp = {
      width: 1, height: 1,
      cells: [{ dx: 0, dy: 0, layer: "lower" as const, tile: TILE.GRASS }],
      source: { startTile: TILE.GRASS, endTile: TILE.GRASS },
    };
    editorState.set({ layer: "event", tool: "event", activePaletteStamp: stamp });
    enterPanTool();
    expect(editorState.get().tool).toBe("pan");
    expect(editorState.get().layer).toBe("event");
    expect(editorState.get().activePaletteStamp).toBe(stamp);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EditScene 결선 — handleEscapeKey 가 위 판정기를 실제로 태우는가
// ─────────────────────────────────────────────────────────────────────────────

type EscapeHarness = {
  handleEscapeKey(): boolean;
  clearPastePreviewGhost(): void;
  replayDeferredCameraFocus(): void;
};

function escapeHarness(): EscapeHarness {
  return Object.assign(Object.create(EditSceneCtor.prototype), {
    hoverPreviewLayer: { removeAll: () => undefined },
    clearPastePreviewGhost: () => undefined,
    replayDeferredCameraFocus: () => undefined,
    deferredCameraFocus: null,
    cameraPanController: null,
    dragOperationHandler: null,
    isPainting: false,
    rightRegionGesture: null,
  }) as EscapeHarness;
}

describe("EditScene.handleEscapeKey", () => {
  it("취소할 게 없으면 화면 밀기를 켠다", () => {
    installToolCursor();
    expect(escapeHarness().handleEscapeKey()).toBe(true);
    expect(editorState.get().tool).toBe("pan");
    expect(document.body.dataset.editorTool).toBe("pan");
  });

  it("선택이 있으면 선택만 지우고 도구는 그대로 둔다", () => {
    const mapId = store.getCurrent().startMapId;
    editorState.set({ selection: { mapId, x: 1, y: 1, width: 3, height: 3 } });
    expect(escapeHarness().handleEscapeKey()).toBe(true);
    expect(editorState.get().selection).toBeNull();
    expect(editorState.get().tool).toBe("paint");
  });

  it("붙여넣기 미리보기가 있으면 미리보기만 취소한다", () => {
    editorState.set({
      clipboard: { width: 1, height: 1, lower: { tiles: [0], stacks: [[]] }, upper: { tiles: [-1], stacks: [[]] } },
      pastePreview: { x: 2, y: 2 },
    });
    expect(escapeHarness().handleEscapeKey()).toBe(true);
    expect(editorState.get().pastePreview).toBeNull();
    expect(editorState.get().tool).toBe("paint");
  });

  it("팝오버가 떠 있으면 도구를 바꾸지 않는다 — 한 Esc 로 두 가지가 일어나면 안 된다", () => {
    document.body.innerHTML = '<div class="ai-composer-popover"></div>';
    expect(escapeHarness().handleEscapeKey()).toBe(false);
    expect(editorState.get().tool).toBe("paint");
  });

  it("모달 계층이 살아 있으면 도구를 바꾸지 않는다", () => {
    const card = document.createElement("div");
    document.body.append(card);
    registerModal(card, () => undefined);
    expect(escapeHarness().handleEscapeKey()).toBe(false);
    expect(editorState.get().tool).toBe("paint");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// (b) 이벤트 레이어 좌클릭 드래그
// ─────────────────────────────────────────────────────────────────────────────

type PointerLike = {
  x: number;
  y: number;
  button: number;
  isDown: boolean;
  event: { clientX: number; clientY: number };
  positionToCamera(): { x: number; y: number };
  rightButtonDown(): boolean;
  middleButtonDown(): boolean;
};

function pointerAt(tileX: number, tileY: number, options: { readonly isDown?: boolean } = {}): PointerLike {
  const clientX = tileX * TILE_SIZE;
  const clientY = tileY * TILE_SIZE;
  return {
    x: clientX,
    y: clientY,
    button: 0,
    isDown: options.isDown ?? false,
    // pointerScreenPosition 은 MouseEvent/PointerEvent 인스턴스만 신뢰하므로,
    // happy-dom 의 진짜 MouseEvent 를 만들어 clientX/clientY 를 흘린다.
    event: new MouseEvent("pointermove", { clientX, clientY }) as unknown as { clientX: number; clientY: number },
    positionToCamera: () => ({ x: clientX, y: clientY }),
    rightButtonDown: () => false,
    middleButtonDown: () => false,
  };
}

type DragHarness = {
  readonly input: {
    emit(type: string, event?: unknown): void;
  };
  readonly camera: { scrollX: number; scrollY: number; zoom: number };
};

/**
 * 이벤트 레이어 포인터 라우팅 하네스. 카메라·드래그 축은 **진짜 협력자**를 쓴다
 * (CameraPanController / DragOperationHandler) — 팬이 실제로 스크롤을 옮기는지,
 * 이벤트 이동이 실제로 스토어를 고치는지가 이 스펙의 전부다.
 */
function dragHarness(): DragHarness {
  const handlers = new Map<string, (event: unknown) => void>();
  const camera = {
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    width: 320,
    height: 240,
    worldView: { x: 0, y: 0, width: 320, height: 240 },
    panEffect: { reset: vi.fn() },
    setScroll(x: number, y: number) { this.scrollX = x; this.scrollY = y; },
    setZoom(value: number) { this.zoom = value; },
    getWorldPoint(x: number, y: number) { return { x, y }; },
    centerOn() { /* 이 스펙은 프로그램 팬을 쓰지 않는다 */ },
    preRender() { /* worldView 고정 */ },
    pan: () => undefined,
  };
  const scene = Object.assign(Object.create(EditSceneCtor.prototype), {
    cameras: { main: camera },
    game: { canvas: { getBoundingClientRect: () => ({ x: 0, y: 0, left: 0, top: 0, width: 320, height: 240 }) } },
    input: {
      on: (type: string, handler: (event: unknown) => void) => { handlers.set(type, handler); },
      mouse: { disableContextMenu: () => undefined },
      keyboard: { on: () => undefined },
    },
    hoverPreviewLayer: { removeAll: () => undefined, add: () => undefined },
    tileLayer: {},
    overlayLayer: {},
    gridGraphics: {},
    tileIndex: new Map(),
    isPainting: false,
    lastPaintKey: "",
    lastPointerTile: null,
    rightRegionGesture: null,
    eventLayerClickFeedback: null,
    deferredCameraFocus: null,
    activeCameraFocus: null,
    // 렌더·오버레이 협력자는 이 파일의 관심이 아니다.
    bindCanvasPanGuards: () => undefined,
    bindBrowserContextMenuGuards: () => undefined,
    updatePointerStatus: () => undefined,
    updateHoverPreview: () => undefined,
    clearHoverPreview: () => undefined,
    suppressPaintHoverPreview: () => undefined,
    clearPastePreviewGhost: () => undefined,
    renderPastePreviewGhost: () => undefined,
    renderEventLayerClickFeedback: () => undefined,
    showEventLayerClickFeedback: () => undefined,
    renderBuildPaletteOverlay: () => undefined,
    refreshAgentGhostDomMarkers: () => undefined,
    syncNavigationGeometry: () => undefined,
    publishMapViewport: () => undefined,
    cancelCameraFocus: () => undefined,
    replayDeferredCameraFocus: () => undefined,
    updateEventMarkerTooltip: () => undefined,
    clearEventMarkerTooltip: () => undefined,
    tryOfferEventLayerSwitchFromPointer: () => false,
  });
  scene.cameraPanController = new CameraPanController(scene as never, {
    onPanStart: () => undefined,
    onPanMove: () => undefined,
    onPanEnd: () => undefined,
  });
  scene.dragOperationHandler = new DragOperationHandler(scene as never, {
    mapId: () => editorState.get().currentMapId,
    pointerToTile: (ptr) => ({ x: Math.floor(ptr.x / TILE_SIZE), y: Math.floor(ptr.y / TILE_SIZE) }),
    hoverPreviewLayer: () => null,
    clearHoverPreview: () => undefined,
    showEventLayerClickFeedback: () => undefined,
    setLastPointerTile: () => undefined,
    setPaintState: (state: { isPainting?: boolean; lastPaintKey?: string }) => Object.assign(scene, state),
  });
  scene.getDragOperationHandler = () => scene.dragOperationHandler;
  (scene as unknown as { bindInput(): void }).bindInput();
  return {
    input: { emit: (type, event) => handlers.get(type)?.(event) },
    camera,
  };
}

describe("이벤트 레이어 좌클릭 드래그 소유권", () => {
  beforeEach(() => {
    editorState.set({ layer: "event", tool: "event" });
  });

  it("빈 칸에서 시작한 드래그는 카메라를 민다", () => {
    const harness = dragHarness();
    harness.input.emit("pointerdown", pointerAt(4, 4, { isDown: true }));
    harness.input.emit("pointermove", pointerAt(9, 7, { isDown: true }));
    // 오른쪽·아래로 끌면 카메라는 왼쪽·위로 간다(내용이 손을 따라온다).
    expect(harness.camera.scrollX).toBe(-(9 - 4) * TILE_SIZE);
    expect(harness.camera.scrollY).toBe(-(7 - 4) * TILE_SIZE);
    harness.input.emit("pointerup", pointerAt(9, 7));
  });

  it("승격 후에도 계속 따라온다 — 두 번째 이동이 기준점을 잃지 않는다", () => {
    const harness = dragHarness();
    harness.input.emit("pointerdown", pointerAt(4, 4, { isDown: true }));
    harness.input.emit("pointermove", pointerAt(6, 4, { isDown: true }));
    harness.input.emit("pointermove", pointerAt(10, 4, { isDown: true }));
    expect(harness.camera.scrollX).toBe(-(10 - 4) * TILE_SIZE);
    harness.input.emit("pointerup", pointerAt(10, 4));
    // 릴리스 뒤의 단순 호버가 카메라를 더 밀지 않는다.
    harness.input.emit("pointermove", pointerAt(2, 4));
    expect(harness.camera.scrollX).toBe(-(10 - 4) * TILE_SIZE);
  });

  it("빈 칸 드래그는 이벤트를 만들지도 옮기지도 않는다", () => {
    const mapId = store.getCurrent().startMapId;
    const before = store.getCurrent().maps[mapId].events.length;
    const harness = dragHarness();
    harness.input.emit("pointerdown", pointerAt(4, 4, { isDown: true }));
    harness.input.emit("pointermove", pointerAt(9, 7, { isDown: true }));
    harness.input.emit("pointerup", pointerAt(9, 7));
    expect(store.getCurrent().maps[mapId].events.length).toBe(before);
    // 팬으로 승격된 제스처는 「여기에 새 이벤트」 예약도 남기지 않는다.
    expect(editorState.get().pendingEventCoordinate).toBeNull();
  });

  it("문턱(4px) 아래로 흔들린 클릭은 팬이 아니다 — 새 이벤트 자리 예약이 살아남는다", () => {
    const harness = dragHarness();
    harness.input.emit("pointerdown", pointerAt(4, 4, { isDown: true }));
    const nudged = pointerAt(4, 4, { isDown: true });
    nudged.event = new MouseEvent("pointermove", { clientX: 4 * TILE_SIZE + 2, clientY: 4 * TILE_SIZE + 1 }) as never;
    harness.input.emit("pointermove", nudged);
    expect(harness.camera.scrollX).toBe(0);
    expect(harness.camera.scrollY).toBe(0);
    expect(editorState.get().pendingEventCoordinate).toEqual({ mapId: store.getCurrent().startMapId, x: 4, y: 4 });
    harness.input.emit("pointerup", pointerAt(4, 4));
  });

  it("이벤트 위에서 시작한 드래그는 지금처럼 그 이벤트를 옮긴다(카메라는 가만히)", () => {
    const mapId = store.getCurrent().startMapId;
    const created = addEvent(mapId, 4, 4);
    expect(created).toBeTruthy();
    const harness = dragHarness();
    harness.input.emit("pointerdown", pointerAt(4, 4, { isDown: true }));
    harness.input.emit("pointermove", pointerAt(9, 7, { isDown: true }));
    harness.input.emit("pointerup", pointerAt(9, 7));
    const moved = store.getCurrent().maps[mapId].events.find((entry) => entry.id === created);
    expect(moved).toBeTruthy();
    expect([moved!.x, moved!.y]).toEqual([9, 7]);
    expect(harness.camera.scrollX).toBe(0);
    expect(harness.camera.scrollY).toBe(0);
  });

  it("맵 경계 밖에서 시작한 드래그도 팬이다(옮길 이벤트가 없다)", () => {
    const harness = dragHarness();
    const map = store.getCurrent().maps[store.getCurrent().startMapId];
    const outside = map.width + 3;
    harness.input.emit("pointerdown", pointerAt(outside, 2, { isDown: true }));
    harness.input.emit("pointermove", pointerAt(outside - 4, 2, { isDown: true }));
    expect(harness.camera.scrollX).toBe(4 * TILE_SIZE);
    harness.input.emit("pointerup", pointerAt(outside - 4, 2));
  });

  it("타일 레이어에서는 좌클릭 드래그가 여전히 칠하기다 — 팬으로 바뀌지 않는다", () => {
    editorState.set({ layer: "lower", tool: "paint", paintShape: "pen", selectedTile: TILE.GRASS });
    const harness = dragHarness();
    harness.input.emit("pointerdown", pointerAt(4, 4, { isDown: true }));
    harness.input.emit("pointermove", pointerAt(9, 7, { isDown: true }));
    harness.input.emit("pointerup", pointerAt(9, 7));
    expect(harness.camera.scrollX).toBe(0);
    expect(harness.camera.scrollY).toBe(0);
  });
});

describe("Esc 로 들어간 화면 밀기의 다음 드래그", () => {
  it("타일을 고치지 않고 카메라만 민다", () => {
    const mapId = store.getCurrent().startMapId;
    editorState.set({ layer: "lower", tool: "paint", paintShape: "pen", selectedTile: TILE.GRASS });
    // Esc 는 문턱을 넘은 도구 전환이다 — pointerdown 전에 이미 pan 이어야 한다.
    expect(escapeHarness().handleEscapeKey()).toBe(true);
    expect(editorState.get().tool).toBe("pan");

    const before = [...store.getCurrent().maps[mapId].lowerTiles];
    const harness = dragHarness();
    harness.input.emit("pointerdown", pointerAt(4, 4, { isDown: true }));
    harness.input.emit("pointermove", pointerAt(1, 2, { isDown: true }));
    harness.input.emit("pointerup", pointerAt(1, 2));
    expect(harness.camera.scrollX).toBe(3 * TILE_SIZE);
    expect(harness.camera.scrollY).toBe(2 * TILE_SIZE);
    expect(store.getCurrent().maps[mapId].lowerTiles).toEqual(before);
    expect(editorState.get().selection).toBeNull();
  });
});
