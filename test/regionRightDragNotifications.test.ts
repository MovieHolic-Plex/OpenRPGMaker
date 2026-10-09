// 우클릭 영역 드래그의 통지량 — editorState 통지 하나가 좌측 독 전체 재구축이라
// (editor.ts refreshPanels) 드래그 중 통지 수가 그대로 렉이 된다.
// 실측 배경: selectTileRegion 이 매번 새 객체 리터럴을 만들고 editorState.set 의 무변경
// 판정은 참조 비교라, 같은 칸 안에서 움직이는 pointermove 가 전부 통지로 새어 나갔다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.resetModules();
});

async function setup(): Promise<{
  readonly mapId: string;
  readonly selectTileRegion: (
    mapId: string,
    selection: { mapId: string; x: number; y: number; width: number; height: number },
  ) => boolean;
  readonly countNotifications: () => number;
}> {
  const { editorState } = await import("@/editor/editorState");
  const { selectTileRegion } = await import("@/editor/mapClipboard");
  const { createBlankProject } = await import("@/project/defaults");
  const { store } = await import("@/project/store");

  store.replace(createBlankProject());
  editorState.set({ selection: null, clipboard: null, pastePreview: null });
  const mapId = store.getCurrent().startMapId;

  let notifications = 0;
  editorState.subscribe(() => {
    notifications += 1;
  });
  return { mapId, selectTileRegion, countNotifications: () => notifications };
}

describe("selectTileRegion 통지량", () => {
  it("같은 사각형을 다시 넣으면 통지하지 않는다", async () => {
    const { mapId, selectTileRegion, countNotifications } = await setup();
    const rect = { mapId, x: 2, y: 2, width: 4, height: 3 };

    expect(selectTileRegion(mapId, rect)).toBe(true);
    expect(countNotifications()).toBe(1);

    // 같은 칸 안에서 포인터만 움직이는 프레임 — 사각형은 그대로다.
    for (let i = 0; i < 20; i += 1) expect(selectTileRegion(mapId, rect)).toBe(true);
    expect(countNotifications()).toBe(1);
  });

  it("맵 경계로 잘린 뒤의 사각형이 같아도 통지하지 않는다", async () => {
    const { mapId, selectTileRegion, countNotifications } = await setup();
    const { store } = await import("@/project/store");
    const map = store.getCurrent().maps[mapId]!;

    // width 를 맵 밖까지 요구하면 selectTileRegion 이 잘라서 저장한다. 잘린 값끼리
    // 비교해야 한다 — 요청값으로 비교하면 매번 다르게 보여 통지가 계속 샌다.
    const overflowing = { mapId, x: map.width - 2, y: 0, width: 99, height: 1 };
    expect(selectTileRegion(mapId, overflowing)).toBe(true);
    expect(countNotifications()).toBe(1);

    expect(selectTileRegion(mapId, overflowing)).toBe(true);
    expect(selectTileRegion(mapId, { ...overflowing, width: 50 })).toBe(true);
    expect(countNotifications()).toBe(1);
  });

  it("드래그로 사각형이 실제로 커지면 그 단계마다 한 번씩만 통지한다", async () => {
    const { mapId, selectTileRegion, countNotifications } = await setup();

    // (2,2) 에서 시작해 가로로 4칸 늘리는 드래그. 칸마다 pointermove 가 5번씩 온다고 본다.
    for (let width = 1; width <= 4; width += 1) {
      for (let frame = 0; frame < 5; frame += 1) {
        selectTileRegion(mapId, { mapId, x: 2, y: 2, width, height: 1 });
      }
    }
    expect(countNotifications()).toBe(4);
  });
});
