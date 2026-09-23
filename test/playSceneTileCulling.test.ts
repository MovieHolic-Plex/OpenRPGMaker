import { describe, expect, it } from "vitest";
import { TILE_SIZE } from "@/assets/bundled";
import { renderTiles } from "@/player/playSceneMapRuntime";
import {
  resetCullableTiles,
  syncTileCulling,
  trackCullableTile,
  type CullableImage,
} from "@/player/playSceneTileCulling";
import { createBlankProject, TILE } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";

type CullTile = CullableImage & { visible: boolean; writes: number };

function cullTile(): CullTile {
  return {
    visible: true,
    writes: 0,
    setVisible(value: boolean) {
      this.visible = value;
      this.writes += 1;
      return this;
    },
  };
}

/** 320x240 화면이 (0,0) 에 있을 때의 월드 뷰. */
const ORIGIN_VIEW = { x: 0, y: 0, width: 320, height: 240 };

describe("playSceneTileCulling", () => {
  it("화면 밖 타일만 숨기고 여유 타일은 남긴다", () => {
    const host = {};
    const inside = cullTile();
    const margin = cullTile();
    const outside = cullTile();
    // 320x240 / 16 = 20x15 칸. 여유 2칸이라 최대 x=22, y=17 까지 살린다.
    trackCullableTile(host, inside, 5, 5);
    trackCullableTile(host, margin, 22, 17);
    trackCullableTile(host, outside, 23, 17);

    syncTileCulling(host, ORIGIN_VIEW);

    expect(inside.visible).toBe(true);
    expect(margin.visible).toBe(true);
    expect(outside.visible).toBe(false);
  });

  it("같은 타일 창이면 두 번째 호출에서 아무것도 쓰지 않는다", () => {
    const host = {};
    const tile = cullTile();
    trackCullableTile(host, tile, 60, 60);

    syncTileCulling(host, ORIGIN_VIEW);
    expect(tile.visible).toBe(false);
    const writesAfterFirst = tile.writes;

    // 카메라가 타일 경계를 넘지 않은 이동(8px)은 창을 바꾸지 않는다.
    syncTileCulling(host, { ...ORIGIN_VIEW, x: 8 });
    expect(tile.writes).toBe(writesAfterFirst);

    // 타일 경계를 넘어가야 다시 계산한다.
    syncTileCulling(host, { ...ORIGIN_VIEW, x: 60 * TILE_SIZE, y: 60 * TILE_SIZE });
    expect(tile.visible).toBe(true);
    expect(tile.writes).toBe(writesAfterFirst + 1);
  });

  it("타일 창이 한 칸 움직여도 먼 타일은 다시 쓰지 않고, 경계 타일과 물 애니메이션만 갱신한다", () => {
    const host = {};
    const far = cullTile();
    const edge = cullTile();
    let paused = 0;
    let resumed = 0;
    edge.anims = {
      pause() { paused += 1; },
      resume() { resumed += 1; },
    };
    trackCullableTile(host, far, 80, 80);
    // 320/16+여유 2 = x 22 까지 보인다. 23 은 창 바로 밖.
    trackCullableTile(host, edge, 23, 2);

    syncTileCulling(host, ORIGIN_VIEW);
    expect(far.visible).toBe(false);
    expect(edge.visible).toBe(false);
    expect(paused).toBe(1);
    const farWrites = far.writes;
    const edgeWrites = edge.writes;

    syncTileCulling(host, { ...ORIGIN_VIEW, x: TILE_SIZE });
    expect(far.writes).toBe(farWrites);
    expect(far.visible).toBe(false);
    expect(edge.visible).toBe(true);
    expect(edge.writes).toBe(edgeWrites + 1);
    expect(resumed).toBe(1);
  });

  it("카메라가 멀어지면 앞서 보였던 타일을 다시 숨긴다", () => {
    const host = {};
    const near = cullTile();
    trackCullableTile(host, near, 1, 1);

    syncTileCulling(host, ORIGIN_VIEW);
    expect(near.visible).toBe(true);

    syncTileCulling(host, { ...ORIGIN_VIEW, x: 80 * TILE_SIZE, y: 80 * TILE_SIZE });
    expect(near.visible).toBe(false);
  });

  it("setVisible 이 없는 오브젝트는 추적하지 않는다", () => {
    const host = {};
    const plain = { visible: true } as CullableImage;
    trackCullableTile(host, plain, 99, 99);
    // 추적된 타일이 없으면 syncTileCulling 은 즉시 끝난다 — 오브젝트를 만지지 않는다.
    syncTileCulling(host, ORIGIN_VIEW);
    expect(plain.visible).toBe(true);
  });

  it("망가진 viewport 로는 아무것도 숨기지 않는다", () => {
    const host = {};
    const tile = cullTile();
    trackCullableTile(host, tile, 99, 99);

    syncTileCulling(host, undefined);
    syncTileCulling(host, { x: 0, y: 0, width: 0, height: 240 });
    syncTileCulling(host, { x: 0, y: 0, width: Number.NaN, height: 240 });

    expect(tile.writes).toBe(0);
  });

  it("resetCullableTiles 는 추적 목록과 적용된 창을 함께 버린다", () => {
    const host = {};
    const stale = cullTile();
    trackCullableTile(host, stale, 99, 99);
    syncTileCulling(host, ORIGIN_VIEW);
    expect(stale.visible).toBe(false);

    resetCullableTiles(host);
    const fresh = cullTile();
    trackCullableTile(host, fresh, 99, 99);
    // 창을 버렸으므로 같은 viewport 로도 새 타일에 다시 적용된다.
    syncTileCulling(host, ORIGIN_VIEW);
    expect(fresh.visible).toBe(false);
    // 버려진 타일은 더 만지지 않는다.
    expect(stale.writes).toBe(1);
  });

  it("renderTiles 가 만든 타일은 화면 밖이면 숨는다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.lowerTiles.fill(TILE.GRASS);
    map.upperTiles.fill(-1);
    store.replace(project);

    const created: Array<CullTile & { tx: number; ty: number }> = [];
    const makeImage = (x: number, y: number) => {
      const image = {
        ...cullTile(),
        tx: Math.floor(x / TILE_SIZE),
        ty: Math.floor(y / TILE_SIZE),
        setOrigin: () => undefined,
        setDepth: () => undefined,
        play() {
          return this;
        },
      };
      created.push(image as unknown as CullTile & { tx: number; ty: number });
      return image;
    };
    const scene = {
      map,
      session: startSession(project),
      eventPositions: {},
      tileLayer: { removeAll: () => undefined, add: () => undefined },
      upperTileLayer: { removeAll: () => undefined, add: () => undefined },
      eventSprites: new Map(),
      runtimeDom: {
        clearEventMarkers: () => undefined,
        upsertEventMarker: () => undefined,
        syncMissingResourceError: () => undefined,
      },
      missingResources: new Set<string>(),
      add: { image: makeImage, sprite: makeImage },
      runEvent: async () => undefined,
      syncRuntimeState: () => undefined,
    };

    renderTiles(scene as never);
    expect(created.length).toBeGreaterThan(0);

    syncTileCulling(scene, ORIGIN_VIEW);

    const visibleFar = created.filter((image) => image.visible && image.tx > 22);
    expect(visibleFar).toEqual([]);
    expect(created.some((image) => image.visible && image.tx <= 22)).toBe(true);
  });

  // 내려간 씬을 놓았는지는 GC 를 강제할 수 없어 단위 테스트로 관찰할 수 없다. 대신
  // resetCullableTiles 를 부른 뒤 추적이 처음부터 다시 시작되는지(=기억을 실제로 버렸는지)
  // 확인한다. 씬 종료 시 이 함수를 부르는 것은 PlayScene 의 shutdown/destroy 훅이다.
  it("resetCullableTiles 뒤에는 추적이 처음부터 다시 시작된다", () => {
    const host = { name: "씬" };
    const before = cullTile();
    trackCullableTile(host, before, 5, 5);
    resetCullableTiles(host);

    const after = cullTile();
    trackCullableTile(host, after, 5, 5);
    syncTileCulling(host, { x: 1000, y: 1000, width: 320, height: 240 });

    expect(after.visible, "새로 추적한 타일이 컬링되지 않았다").toBe(false);
    expect(before.writes, "버린 타일이 아직 추적 목록에 남아 있다").toBe(0);
  });
});
