import { beforeEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { layerTileAt, setLayerTileAt, setShadowAt, shadowAt } from "@/project/mapLayers";
import { store } from "@/project/store";
import { validateMaps } from "@/project/io/shapeEventFields";

beforeEach(() => store.replace(createBlankProject()));

describe("새 층 칸 — 저장 경로", () => {
  it("updateMapTiles 는 2층·4층·그림자를 복사해 보존하고 이전 상태와 공유하지 않는다", () => {
    const id = store.getCurrent().startMapId;
    store.updateMapTiles(id, (m) => { setLayerTileAt(m, 2, 0, 5); setLayerTileAt(m, 4, 1, 6); setShadowAt(m, 2, 3); });
    const before = store.getCurrent().maps[id];
    store.updateMapTiles(id, (m) => { setLayerTileAt(m, 2, 0, 9); });
    const after = store.getCurrent().maps[id];
    expect(layerTileAt(before, 2, 0)).toBe(5);
    expect(layerTileAt(after, 2, 0)).toBe(9);
    expect(layerTileAt(after, 4, 1)).toBe(6);
    expect(shadowAt(after, 2)).toBe(3);
  });

  it("검증은 길이가 틀린 새 칸을 거부하고 맞는 칸은 통과시킨다", () => {
    const project = structuredClone(store.getCurrent());
    const map = project.maps[project.startMapId];
    map.lowerOverlayTiles = new Array(map.width * map.height).fill(-1);
    map.shadowBits = new Array(map.width * map.height).fill(0);
    expect(() => validateMaps(project.maps)).not.toThrow();
    map.upperOverlayTiles = [1, 2, 3];
    expect(() => validateMaps(project.maps)).toThrow(/upperOverlayTiles 길이 불일치/);
  });
});
