/**
 * 설치물(바위)이 **화면에 그려지는지** 본다.
 *
 * 곡괭이 채굴 경로(`tryPlaceableToolHarvest`)는 이미 있었지만 렌더 경로가 없었다 —
 * 저작한 돌은 캘 수는 있어도 보이지 않았다. 밭 오버레이는 `farmPlots` 가 있는 맵에서만
 * 도므로 광산처럼 밭이 없는 맵은 그 경로로 절대 그려지지 않는다.
 */
/** @vitest-environment happy-dom */
import { beforeEach, describe, expect, it } from "vitest";
import { renderPlaceableOverlays } from "@/player/playScenePlaceables";
import { createFarmingDemoProject } from "@/project/defaults/defaultProject";
import type { PlaceableObjectState } from "@/project/placeables";
import { store } from "@/project/store";

type Call = { readonly kind: "sprite" | "rectangle"; readonly args: readonly unknown[] };

const MINE_MAP_ID = "map_mine_1f";

function createStubScene(placeables: Record<string, PlaceableObjectState>, mapId = MINE_MAP_ID) {
  const calls: Call[] = [];
  const added: unknown[] = [];
  const object = () => ({ setOrigin() {}, setDepth() {} });
  const map = store.getCurrent().maps[mapId];
  return {
    calls,
    added,
    map: { id: mapId, width: map?.width, height: map?.height },
    session: { placeables },
    tileLayer: { add: (o: unknown) => added.push(o) },
    add: {
      sprite: (...args: unknown[]) => (calls.push({ kind: "sprite", args }), object()),
      rectangle: (...args: unknown[]) => (calls.push({ kind: "rectangle", args }), object()),
    },
  };
}

const render = (scene: ReturnType<typeof createStubScene>): void => {
  renderPlaceableOverlays(scene as unknown as Parameters<typeof renderPlaceableOverlays>[0]);
};

function rock(id: string, x: number, y: number, mapId = MINE_MAP_ID): PlaceableObjectState {
  return { id, mapId, x, y, kind: "rock", itemId: "item_stone" };
}

describe("renderPlaceableOverlays", () => {
  beforeEach(() => {
    store.replaceProject(createFarmingDemoProject());
  });

  it("draws each rock on the current map as one sprite", () => {
    const scene = createStubScene({
      "map_mine_1f:4,6": rock("r1", 4, 6),
      "map_mine_1f:6,7": rock("r2", 6, 7),
    });
    render(scene);

    expect(scene.calls.filter((call) => call.kind === "sprite")).toHaveLength(2);
    expect(scene.added).toHaveLength(2);
  });

  it("draws only the current map's placeables", () => {
    const scene = createStubScene({
      "map_mine_1f:4,6": rock("r1", 4, 6),
      "map_farming_demo:5,5": rock("r2", 5, 5, "map_farming_demo"),
    });
    render(scene);

    expect(scene.added).toHaveLength(1);
  });

  /** 상자는 이벤트로 저작하는 관행이라, 그래픽 없는 종류에 사각형을 얹으면 유령 상자가 겹친다. */
  it("skips kinds without a bundled graphic instead of drawing a placeholder", () => {
    const scene = createStubScene({
      "map_mine_1f:4,6": { id: "c1", mapId: MINE_MAP_ID, x: 4, y: 6, kind: "chest" },
    });
    render(scene);

    expect(scene.calls).toHaveLength(0);
    expect(scene.added).toHaveLength(0);
  });

  it("skips placeables left outside the map after it shrank", () => {
    const scene = createStubScene({
      "map_mine_1f:4,6": rock("r1", 4, 6),
      "map_mine_1f:99,99": rock("r2", 99, 99),
    });
    render(scene);

    expect(scene.added).toHaveLength(1);
  });

  /** 데모 광산의 돌이 실제로 그려져야 한다 — 저작과 렌더가 같은 좌표계를 쓰는지 확인. */
  it("draws every authored rock of the shipped mine demo", () => {
    const authored = store.getCurrent().session.placeables ?? {};
    const rocks = Object.values(authored).filter((p) => p.kind === "rock");
    expect(rocks.length).toBeGreaterThanOrEqual(2);

    const scene = createStubScene(authored);
    render(scene);
    expect(scene.added).toHaveLength(rocks.length);
  });
});
