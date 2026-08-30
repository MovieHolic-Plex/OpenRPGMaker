// EditScene 의 카메라 양보·재렌더 배선. 씬을 프로토타입 하네스로 세워(editScenePaintHistory
// 와 같은 규약) 프라이빗 메서드를 직접 부른다 — 판정 자체는 순수 함수(shouldDeferCameraFocus,
// planCameraFocus)가 하고, 이 파일은 **씬이 그 판정기에 무엇을 먹이는지**를 고정한다.
//
// 왜 필요한가(실측 결함 3건):
//  1. 카메라 양보 판정이 isPainting + 팬만 봤다. pointerdown 은 beginDragOperation 이 true 를
//     돌려주면 isPainting 을 세우기 전에 반환하고 beginRightRegionGesture 는 오히려 false 로
//     내리므로, 모든 드래그 제스처에서 두 조건이 다 거짓이었다. 조수의 자동 카메라 이동이
//     드래그 중에 끼어들면 finish 가 팬 거리만큼 밀린 타일을 커밋한다(저작 데이터 손상).
//  2. camera.pan 의 6번째 인자는 onComplete 가 아니라 onUpdate 다 — 300ms 동안 매 프레임
//     DOM 마커를 지웠다 다시 만들었다.
//  3. redraw 가 고스트만 다시 그리고 청사진은 두었다 — 맵을 바꾸면 A 맵의 계획 사각형이 B 맵
//     같은 좌표 위에 남았다.

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { CameraPanController } from "@/editor/CameraPanController";
import { editorState } from "@/editor/editorState";
import {
  requestEditorCameraFocus,
  subscribeEditorCameraFocus,
  type CameraFocusTarget,
} from "@/editor/editorCameraFocus";
import { renderSelectionActionChips } from "@/editor/selectionActionChips";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

vi.mock("@/editor/editSceneRender", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/editor/editSceneRender")>();
  // 타일 렌더는 이 파일의 관심이 아니다(전용 스펙: editSceneRender.test.ts). 진짜 Phaser
  // 컨테이너를 요구하므로 하네스에서는 no-op 으로 둔다.
  return { ...actual, renderEditScene: vi.fn(() => ({ tileObjectsUpdated: 0 })) };
});

type PanCall = {
  readonly x: number;
  readonly y: number;
  readonly duration: number;
  /** pan 이 걸린 시점의 에디터 줌 — 줌 제안이 팬보다 **먼저** 적용됐는지 본다. */
  readonly zoomAtPan: number;
  readonly callback: (camera: unknown, progress: number) => void;
};

type CanvasRect = { x: number; y: number; width: number; height: number };

type CameraFocusHarness = {
  panCameraToTile(target: CameraFocusTarget): void;
  replayDeferredCameraFocus(): void;
  redraw(): void;
  isPainting: boolean;
  rightRegionGesture: unknown;
  cameraPanController: { active(): boolean } | null;
  dragOperationHandler: { busy(): boolean } | null;
  cameras: { main: { zoom: number; worldView: CanvasRect } };
  readonly panCalls: PanCall[];
  readonly renderedBlueprints: number[];
  readonly renderedGhosts: number[];
  readonly cameraMovedCalls: number[];
  readonly viewportPublishes: number[];
};

const TILE_SIZE = 16;
let EditSceneCtor: { readonly prototype: object };
const windowListeners = new Map<string, Set<(event: Event) => void>>();

beforeAll(async () => {
  vi.stubGlobal("window", {
    Phaser: { Scene: class Scene {} },
    location: { search: "" },
    addEventListener: (type: string, listener: (event: Event) => void) => {
      const listeners = windowListeners.get(type) ?? new Set<(event: Event) => void>();
      listeners.add(listener);
      windowListeners.set(type, listeners);
    },
    removeEventListener: (type: string, listener: (event: Event) => void) => {
      windowListeners.get(type)?.delete(listener);
    },
    dispatchEvent: (event: Event) => {
      for (const listener of windowListeners.get(event.type) ?? []) listener(event);
      return !event.defaultPrevented;
    },
  });
  vi.stubGlobal("document", {
    querySelector: () => null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
  vi.stubGlobal("HTMLElement", class HTMLElement {});
  vi.stubGlobal("MouseEvent", class MouseEvent {});
  vi.stubGlobal("PointerEvent", class PointerEvent {});

  const { EditScene } = await import("@/editor/EditScene");
  EditSceneCtor = EditScene;
}, 90_000);

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  store.replace(createBlankProject());
  editorState.set({
    currentMapId: store.getCurrent().startMapId,
    layer: "lower",
    tool: "paint",
    // 줌은 기본값으로 되돌린다 — 줌 제안 테스트가 1로 내려놓은 값이 다음 테스트의 fit 판정을 바꾼다.
    zoom: 2,
    pastePreview: null,
    selection: null,
  });
});

/**
 * 캔버스 위에 떠 있는 조수 카드를 흉내내는 오버레이 목록. 씬 헬퍼가 DOM 에서 읽는 것과 같은
 * 선택자를 타지 않고, 실측 사각형을 직접 넣어 기하학만 고정한다(단위 테스트에는 DOM 이 없다).
 */
function createHarness(options?: {
  readonly canvas?: CanvasRect;
  readonly overlays?: readonly CanvasRect[];
  readonly zoom?: number;
  readonly worldView?: CanvasRect;
}): CameraFocusHarness {
  const panCalls: PanCall[] = [];
  const renderedBlueprints: number[] = [];
  const renderedGhosts: number[] = [];
  const cameraMovedCalls: number[] = [];
  const viewportPublishes: number[] = [];
  const canvasRect = options?.canvas ?? null;
  const overlays = options?.overlays ?? [];
  return Object.assign(Object.create(EditSceneCtor.prototype), {
    // 카메라: 빈 맵은 20×15 타일인데 화면에는 (0,0) 부터 10×8 타일만 들어와 있다.
    cameras: {
      main: {
        zoom: options?.zoom ?? 1,
        worldView: options?.worldView ?? { x: 0, y: 0, width: 10 * TILE_SIZE, height: 8 * TILE_SIZE },
        pan: (x: number, y: number, duration: number, _ease: string, _force: boolean, callback: PanCall["callback"]) => {
          panCalls.push({ x, y, duration, zoomAtPan: editorState.get().zoom, callback });
        },
      },
    },
    // 캔버스/오버레이 기하학은 씬의 실제 경로(game.canvas.getBoundingClientRect + 오버레이 조회)를 탄다.
    // 진짜 DOMRect 는 left/top 을 갖는다 — 씬이 그 필드를 읽으니 하네스도 같이 넣어 주어야 한다.
    game: canvasRect
      ? {
        canvas: {
          getBoundingClientRect: () => ({ ...canvasRect, left: canvasRect.x, top: canvasRect.y }),
        },
      }
      : {},
    assistantOverlayRects: () => overlays,
    isPainting: false,
    lastPaintKey: "",
    rightRegionGesture: null,
    cameraPanController: null,
    dragOperationHandler: null,
    // redraw 가 요구하는 레이어/키 상태. 렌더 자체는 스텁이므로 존재만 하면 된다.
    tileLayer: {},
    hoverPreviewLayer: {},
    overlayLayer: {},
    gridGraphics: {},
    tileIndex: new Map(),
    lastRenderedMapId: null,
    lastRenderStateKey: "",
    lastCameraViewKey: "",
    lastPointerTile: null,
    // redraw 의 나머지 협력자는 이 파일의 관심이 아니다.
    renderEventLayerClickFeedback: () => {},
    publishMapViewport: () => viewportPublishes.push(1),
    renderBuildPaletteOverlay: () => {},
    clearHoverPreview: () => {},
    clearAgentFocusHighlight: () => {},
    renderAgentBlueprint: () => renderedBlueprints.push(1),
    renderAgentGhostPreview: () => renderedGhosts.push(1),
    afterCameraMoved: () => cameraMovedCalls.push(1),
    panCalls,
    viewportPublishes,
    renderedBlueprints,
    renderedGhosts,
    cameraMovedCalls,
  }) as CameraFocusHarness;
}

function focusTarget(mapId: string): CameraFocusTarget {
  // 맵 안(20×15)이지만 화면(0..9, 0..7) 밖 — onlyIfOffscreen 이어도 움직여야 하는 요청.
  return { mapId, tileX: 16, tileY: 12, onlyIfOffscreen: true };
}

type SceneInputHarness = {
  readonly handlers: Map<string, (event: unknown) => void>;
  readonly keyboardHandlers: Map<string, (event: unknown) => void>;
  on(type: string, handler: (event: unknown) => void): void;
  emit(type: string, event?: unknown): void;
  mouse: { disableContextMenu(): void };
  keyboard: {
    on(type: string, handler: (event: unknown) => void): void;
    emit(type: string, event: unknown): void;
  };
};

function createInputHarness(): SceneInputHarness {
  const handlers = new Map<string, (event: unknown) => void>();
  const keyboardHandlers = new Map<string, (event: unknown) => void>();
  return {
    handlers,
    keyboardHandlers,
    on: (type, handler) => { handlers.set(type, handler); },
    emit: (type, event) => { handlers.get(type)?.(event); },
    mouse: { disableContextMenu: () => undefined },
    keyboard: {
      on: (type, handler) => { keyboardHandlers.set(type, handler); },
      emit: (type, event) => { keyboardHandlers.get(type)?.(event); },
    },
  };
}

function bindSceneInput(
  scene: CameraFocusHarness,
  options: { readonly dragBusy?: boolean } = {},
): SceneInputHarness {
  const input = createInputHarness();
  // 드래그 축은 **상태 있는** 가짜여야 한다. busy 를 상수 false 로 두면 "릴리스가 드래그 상태를 남긴다"
  // 축이 하네스에 고정돼, 캔버스 밖 릴리스가 초점을 가두는 결함을 테스트가 볼 수 없다(2026-08-30 리뷰).
  let dragBusy = options.dragBusy === true;
  // pointerGestureState 는 게터가 아니라 **필드** this.dragOperationHandler 를 읽으므로 둘 다 같은 가짜를 준다.
  const dragHandler = {
    active: () => false,
    busy: () => dragBusy,
    begin: () => false,
    clearEventCandidate: () => { dragBusy = false; },
  };
  Object.assign(scene, {
    input,
    bindCanvasPanGuards: () => undefined,
    bindBrowserContextMenuGuards: () => undefined,
    finishDragOperation: () => { dragBusy = false; },
    dragOperationHandler: dragHandler,
    getDragOperationHandler: () => dragHandler,
    hoverPreviewLayer: { removeAll: () => undefined },
    updateHoverPreview: () => undefined,
    clearHoverPreview: () => undefined,
  });
  (scene as unknown as { bindInput(): void }).bindInput();
  return input;
}

function pointerAt(tileX = 2, tileY = 2, button = 0): unknown {
  return {
    x: tileX * TILE_SIZE,
    y: tileY * TILE_SIZE,
    button,
    isDown: false,
    event: {},
    positionToCamera: () => ({ x: tileX * TILE_SIZE, y: tileY * TILE_SIZE }),
    rightButtonDown: () => button === 2,
    middleButtonDown: () => button === 1,
  };
}

function clipboardFixture() {
  return {
    width: 1,
    height: 1,
    lower: { tiles: [0], stacks: [[]] },
    upper: { tiles: [-1], stacks: [[]] },
  };
}

function nativePanEndEvent(type: string): Event {
  return {
    type,
    preventDefault: () => undefined,
    stopPropagation: () => undefined,
    stopImmediatePropagation: () => undefined,
    defaultPrevented: false,
  } as unknown as Event;
}

describe("panCameraToTile 은 사용자 제스처 중에 카메라를 빼앗지 않는다", () => {
  it("아무 제스처도 없으면 대상 타일 중심으로 팬한다", () => {
    const scene = createHarness();
    scene.panCameraToTile(focusTarget(store.getCurrent().startMapId));

    expect(scene.panCalls).toHaveLength(1);
    expect(scene.panCalls[0]).toMatchObject({ x: 16.5 * TILE_SIZE, y: 12.5 * TILE_SIZE, duration: 300 });
  });

  it.each([
    ["페인트 스트로크", (scene: CameraFocusHarness) => { scene.isPainting = true; }],
    ["손 팬", (scene: CameraFocusHarness) => { scene.cameraPanController = { active: () => true }; }],
    ["도형·선택·이벤트 드래그", (scene: CameraFocusHarness) => { scene.dragOperationHandler = { busy: () => true }; }],
    ["우클릭 영역 제스처", (scene: CameraFocusHarness) => { scene.rightRegionGesture = { mapId: "m", start: { x: 1, y: 1 }, screen: { x: 0, y: 0 }, moved: true }; }],
    ["붙여넣기 미리보기", () => { editorState.set({ pastePreview: { x: 3, y: 3 } }); }],
  ])("%s 중에는 움직이지 않는다", (_label, arrange) => {
    const scene = createHarness();
    arrange(scene);

    scene.panCameraToTile(focusTarget(store.getCurrent().startMapId));

    expect(scene.panCalls).toEqual([]);
  });

  it("보고 있는 맵이 아니면 무시한다", () => {
    const scene = createHarness();
    scene.panCameraToTile(focusTarget("map_not_open"));
    expect(scene.panCalls).toEqual([]);
  });

  it("조수 카메라 요청은 pub/sub 을 통해 이 판정을 지난다", () => {
    const scene = createHarness();
    scene.dragOperationHandler = { busy: () => true };
    // 실제 배선과 같은 경로: subscribeEditorCameraFocus → panCameraToTile.
    const unsubscribe = subscribeEditorCameraFocus((target) => scene.panCameraToTile(target));
    requestEditorCameraFocus(focusTarget(store.getCurrent().startMapId));
    unsubscribe();

    expect(scene.panCalls).toEqual([]);
  });
});

describe("프로그램 팬 뒷정리는 마지막 프레임에만 한다", () => {
  it("pan 콜백은 onUpdate 라 매 프레임 불린다 — progress 1 에서만 뒷정리한다", () => {
    const scene = createHarness();
    scene.panCameraToTile(focusTarget(store.getCurrent().startMapId));
    const { callback } = scene.panCalls[0];

    for (const progress of [0, 0.2, 0.55, 0.99]) callback({}, progress);
    expect(scene.cameraMovedCalls).toEqual([]);

    callback({}, 1);
    expect(scene.cameraMovedCalls).toEqual([1]);
  });

  it("뷰포트 스냅샷은 팬이 도는 동안 매 프레임 게시한다 — 조수가 300ms 낡은 화면을 읽지 않는다", () => {
    const scene = createHarness();
    scene.panCameraToTile(focusTarget(store.getCurrent().startMapId));
    const publishedBeforeTween = scene.viewportPublishes.length;
    const { callback } = scene.panCalls[0];

    callback({}, 0.4);
    // 중간 프레임: 스냅샷만 갱신하고 DOM 마커/팔레트는 건드리지 않는다(인라인 승인 툴바가 갈린다).
    expect(scene.viewportPublishes.length).toBe(publishedBeforeTween + 1);
    expect(scene.cameraMovedCalls).toEqual([]);

    callback({}, 1);
    expect(scene.cameraMovedCalls).toEqual([1]);
  });
});

describe("팬 목표는 가림을 뺀 가시 영역의 중앙이다", () => {
  it("짝수 크기 bounds 는 정확한 중심으로 간다 — 반 타일이 더 붙지 않는다", () => {
    const scene = createHarness();
    // {4,4,2,2} 의 참 중심은 (5,5) 다. 예전처럼 내림 뒤 +0.5 를 붙이면 (5.5,5.5) 로 8px 밀렸다.
    scene.panCameraToTile({
      mapId: store.getCurrent().startMapId,
      tileX: 4,
      tileY: 4,
      bounds: { x: 4, y: 4, width: 2, height: 2 },
    });

    expect(scene.panCalls).toHaveLength(1);
    expect(scene.panCalls[0]).toMatchObject({ x: 5 * TILE_SIZE, y: 5 * TILE_SIZE });
  });

  it("조수 카드가 왼쪽 432px 을 덮으면 그만큼 lookAt 을 왼쪽으로 민다", () => {
    // 실측 기준: 캔버스 1133×700, 줌 2 → worldView 566.5×350. 카드가 왼쪽 432px 을 덮는다.
    const scene = createHarness({
      canvas: { x: 0, y: 0, width: 1133, height: 700 },
      overlays: [{ x: 0, y: 0, width: 432, height: 700 }],
      zoom: 2,
      worldView: { x: 0, y: 0, width: 566.5, height: 350 },
    });

    scene.panCameraToTile({ mapId: store.getCurrent().startMapId, tileX: 16, tileY: 12 });

    expect(scene.panCalls).toHaveLength(1);
    // 가시 중앙 x = 432 + 701/2 = 782.5, 캔버스 중앙 = 566.5 → lookAt = 16.5*16 - (782.5-566.5)/2 = 156.
    expect(scene.panCalls[0]).toMatchObject({ x: 156, y: 12.5 * TILE_SIZE });
  });

  it("줌 제안이 붙은 계획은 팬보다 먼저 editorState 줌을 적용한다", () => {
    const scene = createHarness();
    expect(editorState.get().zoom).toBe(2);

    // 18×14 대상 + 여유 1칸은 화면(10×8 타일 @ 줌 2)에 안 들어온다 → 줌 1 로 물러나야 다 보인다.
    scene.panCameraToTile({
      mapId: store.getCurrent().startMapId,
      tileX: 9,
      tileY: 7,
      bounds: { x: 0, y: 0, width: 18, height: 14 },
    });

    expect(editorState.get().zoom).toBe(1);
    expect(scene.panCalls).toHaveLength(1);
    expect(scene.panCalls[0].zoomAtPan).toBe(1);
  });
});

describe("제스처가 미룬 초점은 실제 종료 진입점에서 한 번 재생한다", () => {
  it("pointerup은 페인트 상태를 내린 뒤 정확히 한 번 재생한다", () => {
    const scene = createHarness();
    const input = bindSceneInput(scene);
    scene.isPainting = true;
    scene.panCameraToTile(focusTarget(store.getCurrent().startMapId));

    input.emit("pointerup", pointerAt());
    input.emit("pointerup", pointerAt());

    expect(scene.isPainting).toBe(false);
    expect(scene.panCalls).toHaveLength(1);
  });

  it("pointerupoutside는 페인트 상태를 내린 뒤 정확히 한 번 재생한다", () => {
    const scene = createHarness();
    const input = bindSceneInput(scene);
    scene.isPainting = true;
    scene.panCameraToTile(focusTarget(store.getCurrent().startMapId));

    input.emit("pointerupoutside", pointerAt());
    input.emit("pointerupoutside", pointerAt());

    expect(scene.isPainting).toBe(false);
    expect(scene.panCalls).toHaveLength(1);
  });

  it("캔버스 밖에서 끝난 드래그도 상태를 내려 초점을 갚는다 — busy 가 남으면 영구히 갇힌다", () => {
    const scene = createHarness();
    const input = bindSceneInput(scene, { dragBusy: true });
    scene.panCameraToTile(focusTarget(store.getCurrent().startMapId));
    // 드래그 중이라 요청은 미뤄져 있다.
    expect(scene.panCalls).toHaveLength(0);

    input.emit("pointerupoutside", pointerAt());
    input.emit("pointerupoutside", pointerAt());

    expect(scene.panCalls).toHaveLength(1);
  });

  it("우클릭 영역 pointerup은 영역 제스처를 지운 뒤 정확히 한 번 재생한다", () => {
    const scene = createHarness();
    const input = bindSceneInput(scene);
    scene.rightRegionGesture = {
      mapId: store.getCurrent().startMapId,
      start: { x: 1, y: 1 },
      screen: { x: TILE_SIZE, y: TILE_SIZE },
      moved: true,
    };
    Object.assign(scene, { openRegionAiPopover: () => undefined });
    scene.panCameraToTile(focusTarget(store.getCurrent().startMapId));

    input.emit("pointerup", pointerAt(2, 2, 2));
    input.emit("pointerup", pointerAt(2, 2, 2));

    expect(scene.rightRegionGesture).toBeNull();
    expect(scene.panCalls).toHaveLength(1);
  });

  it("붙여넣기 확정 pointerdown은 미리보기를 지운 뒤 정확히 한 번 재생한다", () => {
    const scene = createHarness();
    const input = bindSceneInput(scene);
    editorState.set({ clipboard: clipboardFixture(), pastePreview: { x: 2, y: 2 } });
    scene.panCameraToTile(focusTarget(store.getCurrent().startMapId));

    input.emit("pointerdown", pointerAt(2, 2));

    expect(editorState.get().pastePreview).toBeNull();
    expect(scene.panCalls).toHaveLength(1);
  });

  it("붙여넣기 취소 pointerdown은 미리보기를 지운 뒤 정확히 한 번 재생한다", () => {
    const scene = createHarness();
    const input = bindSceneInput(scene);
    editorState.set({ clipboard: clipboardFixture(), pastePreview: { x: 2, y: 2 } });
    scene.panCameraToTile(focusTarget(store.getCurrent().startMapId));

    input.emit("pointerdown", pointerAt(2, 2, 2));

    expect(editorState.get().pastePreview).toBeNull();
    expect(scene.panCalls).toHaveLength(1);
  });

  it("Escape은 붙여넣기 미리보기를 취소한 뒤 정확히 한 번 재생한다", () => {
    const scene = createHarness();
    const input = bindSceneInput(scene);
    editorState.set({ clipboard: clipboardFixture(), pastePreview: { x: 2, y: 2 } });
    scene.panCameraToTile(focusTarget(store.getCurrent().startMapId));
    const escape = {
      key: "Escape",
      code: "Escape",
      ctrlKey: false,
      metaKey: false,
      preventDefault: () => undefined,
    };

    input.keyboard.emit("keydown", escape);
    input.keyboard.emit("keydown", escape);

    expect(editorState.get().pastePreview).toBeNull();
    expect(scene.panCalls).toHaveLength(1);
  });

  it("선택 칩 닫기는 붙여넣기 미리보기를 취소한 뒤 정확히 한 번 재생한다", () => {
    const restoreDom = installFakeDom();
    try {
      const scene = createHarness();
      const selection = { mapId: store.getCurrent().startMapId, x: 2, y: 2, width: 1, height: 1 };
      editorState.set({ clipboard: clipboardFixture(), pastePreview: { x: 2, y: 2 }, selection });
      scene.panCameraToTile(focusTarget(store.getCurrent().startMapId));
      const bar = renderSelectionActionChips(
        selection,
        (() => document.createElement("div")) as never,
        () => scene.replayDeferredCameraFocus(),
      );
      document.body.append(bar);
      const dismiss = findByTestId(document.body as unknown as FakeElement, "selection-chip-dismiss");

      dismiss?.click();
      dismiss?.click();

      expect(editorState.get().pastePreview).toBeNull();
      expect(scene.panCalls).toHaveLength(1);
    } finally {
      restoreDom();
    }
  });

  it("스페이스 키를 놓아 팬이 끝나면 정확히 한 번 재생한다", () => {
    const scene = createHarness();
    const canvas = {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      closest: () => null,
    };
    const controller = new CameraPanController(
      {
        cameras: { main: { scrollX: 0, scrollY: 0, zoom: 1, setScroll: () => undefined } },
        game: { canvas },
      } as never,
      {
        onPanStart: () => undefined,
        onPanMove: () => undefined,
        onPanEnd: () => scene.replayDeferredCameraFocus(),
      } as never,
    );
    scene.cameraPanController = controller;
    controller.handleSpaceKeyDown({ code: "Space", preventDefault: () => undefined } as KeyboardEvent);
    controller.start(pointerAt() as never);
    scene.panCameraToTile(focusTarget(store.getCurrent().startMapId));

    controller.handleSpaceKeyUp({ code: "Space", preventDefault: () => undefined } as KeyboardEvent);
    controller.handleSpaceKeyUp({ code: "Space", preventDefault: () => undefined } as KeyboardEvent);

    expect(scene.panCalls).toHaveLength(1);
  });

  it.each(["pointerup", "mouseup"])("window %s guard가 팬을 끝내면 정확히 한 번 재생한다", (eventType) => {
    const scene = createHarness();
    const canvas = {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      closest: () => null,
    };
    const controller = new CameraPanController(
      {
        cameras: { main: { scrollX: 0, scrollY: 0, zoom: 1, setScroll: () => undefined } },
        game: { canvas },
      } as never,
      {
        onPanStart: () => undefined,
        onPanMove: () => undefined,
        onPanEnd: () => scene.replayDeferredCameraFocus(),
      } as never,
    );
    scene.cameraPanController = controller;
    controller.start(pointerAt() as never);
    scene.panCameraToTile(focusTarget(store.getCurrent().startMapId));

    window.dispatchEvent(nativePanEndEvent(eventType));
    window.dispatchEvent(nativePanEndEvent(eventType));

    expect(scene.panCalls).toHaveLength(1);
  });

  it("다른 제스처가 남아 있으면 종료 진입점에서도 재생하지 않는다", () => {
    const scene = createHarness();
    const input = bindSceneInput(scene);
    scene.isPainting = true;
    editorState.set({ clipboard: clipboardFixture(), pastePreview: { x: 2, y: 2 } });
    scene.panCameraToTile(focusTarget(store.getCurrent().startMapId));

    input.emit("pointerupoutside");

    expect(scene.isPainting).toBe(false);
    expect(scene.panCalls).toEqual([]);
  });

  it("cleanup 뒤에는 종료 진입점이 와도 재생하지 않는다", () => {
    const scene = createHarness();
    const input = bindSceneInput(scene);
    scene.isPainting = true;
    scene.panCameraToTile(focusTarget(store.getCurrent().startMapId));
    Object.assign(scene, {
      unbindCanvasPanGuards: () => undefined,
      unbindBrowserContextMenuGuards: () => undefined,
      clearAgentGhostPreviewLayer: () => undefined,
      clearAgentBlueprintLayer: () => undefined,
      clearAgentFocusHighlight: () => undefined,
      clearBuildPaletteOverlay: () => undefined,
    });

    (scene as unknown as { cleanup(): void }).cleanup();
    input.emit("pointerupoutside");

    expect(scene.panCalls).toEqual([]);
  });
});

describe("미뤄진 초점 슬롯 자체의 규약", () => {
  it("제스처 중에는 재생하지 않고, 끝난 뒤 정확히 한 번만 간다", () => {
    const scene = createHarness();
    scene.dragOperationHandler = { busy: () => true };
    scene.panCameraToTile(focusTarget(store.getCurrent().startMapId));
    expect(scene.panCalls).toEqual([]);

    // 아직 드래그 중이면 재생하지 않는다 — 커밋 타일이 팬 거리만큼 밀린다.
    scene.replayDeferredCameraFocus();
    expect(scene.panCalls).toEqual([]);

    scene.dragOperationHandler = { busy: () => false };
    scene.replayDeferredCameraFocus();
    expect(scene.panCalls).toHaveLength(1);
    expect(scene.panCalls[0]).toMatchObject({ x: 16.5 * TILE_SIZE, y: 12.5 * TILE_SIZE });

    // 슬롯은 재생과 함께 비워진다 — 두 번째 pointerup 이 카메라를 또 데려가면 안 된다.
    scene.replayDeferredCameraFocus();
    expect(scene.panCalls).toHaveLength(1);
  });

  it("미뤄진 요청이 여러 번 오면 마지막 것만 남는다", () => {
    const scene = createHarness();
    scene.isPainting = true;
    scene.panCameraToTile({ mapId: store.getCurrent().startMapId, tileX: 3, tileY: 3 });
    scene.panCameraToTile({ mapId: store.getCurrent().startMapId, tileX: 16, tileY: 12 });

    scene.isPainting = false;
    scene.replayDeferredCameraFocus();

    expect(scene.panCalls).toHaveLength(1);
    expect(scene.panCalls[0]).toMatchObject({ x: 16.5 * TILE_SIZE, y: 12.5 * TILE_SIZE });
  });
});

describe("redraw 는 청사진도 다시 그린다", () => {
  it("맵 전환·재렌더에서 고스트와 청사진을 같이 갱신한다", () => {
    const scene = createHarness();
    scene.redraw();

    expect(scene.renderedGhosts).toHaveLength(1);
    // 청사진 레이어는 맵을 따라 비워지지 않으므로, 여기서 다시 그리지 않으면 옛 맵의 계획
    // 사각형이 새 맵 같은 타일 좌표 위에 남는다.
    expect(scene.renderedBlueprints).toHaveLength(1);
  });
});
