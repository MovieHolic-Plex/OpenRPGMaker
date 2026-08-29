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
import { editorState } from "@/editor/editorState";
import {
  requestEditorCameraFocus,
  subscribeEditorCameraFocus,
  type CameraFocusTarget,
} from "@/editor/editorCameraFocus";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";

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
  readonly callback: (camera: unknown, progress: number) => void;
};

type CameraFocusHarness = {
  panCameraToTile(target: CameraFocusTarget): void;
  redraw(): void;
  isPainting: boolean;
  rightRegionGesture: unknown;
  cameraPanController: { active(): boolean } | null;
  dragOperationHandler: { busy(): boolean } | null;
  readonly panCalls: PanCall[];
  readonly renderedBlueprints: number[];
  readonly renderedGhosts: number[];
  readonly cameraMovedCalls: number[];
};

const TILE_SIZE = 16;
let EditSceneCtor: { readonly prototype: object };

beforeAll(async () => {
  vi.stubGlobal("window", {
    Phaser: { Scene: class Scene {} },
    location: { search: "" },
  });
  vi.stubGlobal("document", { querySelector: () => null });
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
    pastePreview: null,
    selection: null,
  });
});

function createHarness(): CameraFocusHarness {
  const panCalls: PanCall[] = [];
  const renderedBlueprints: number[] = [];
  const renderedGhosts: number[] = [];
  const cameraMovedCalls: number[] = [];
  return Object.assign(Object.create(EditSceneCtor.prototype), {
    // 카메라: 빈 맵은 20×15 타일인데 화면에는 (0,0) 부터 10×8 타일만 들어와 있다.
    cameras: {
      main: {
        zoom: 1,
        worldView: { x: 0, y: 0, width: 10 * TILE_SIZE, height: 8 * TILE_SIZE },
        pan: (x: number, y: number, duration: number, _ease: string, _force: boolean, callback: PanCall["callback"]) => {
          panCalls.push({ x, y, duration, callback });
        },
      },
    },
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
    publishMapViewport: () => {},
    renderBuildPaletteOverlay: () => {},
    clearHoverPreview: () => {},
    clearAgentFocusHighlight: () => {},
    renderAgentBlueprint: () => renderedBlueprints.push(1),
    renderAgentGhostPreview: () => renderedGhosts.push(1),
    afterCameraMoved: () => cameraMovedCalls.push(1),
    panCalls,
    renderedBlueprints,
    renderedGhosts,
    cameraMovedCalls,
  }) as CameraFocusHarness;
}

function focusTarget(mapId: string): CameraFocusTarget {
  // 맵 안(20×15)이지만 화면(0..9, 0..7) 밖 — onlyIfOffscreen 이어도 움직여야 하는 요청.
  return { mapId, tileX: 16, tileY: 12, onlyIfOffscreen: true };
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
