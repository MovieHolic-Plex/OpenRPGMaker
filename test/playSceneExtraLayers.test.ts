import { describe, expect, it } from "vitest";
import { renderTiles } from "@/player/playSceneMapRuntime";
import { createBlankProject } from "@/project/defaults";
import { setLayerTileAt, setShadowAt } from "@/project/mapLayers";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { mapTileSize } from "@/project/tileGeometry";
import { passageMarkForTile } from "@/project/tilesetPassage";

type Made = { kind: "image" | "rect"; x: number; y: number; frame?: string; depth?: number; w?: number; alpha?: number };

function sceneFor(map: ReturnType<typeof createBlankProject>["maps"][string], project: ReturnType<typeof createBlankProject>) {
  const made: Made[] = [];
  const obj = (m: Made) => {
    made.push(m);
    const o = { ...m, visible: true, setOrigin: () => o, setDepth: (d: number) => { m.depth = d; return o; }, play: () => o, setVisible: () => o, destroy: () => undefined };
    return o;
  };
  const scene = {
    map, session: startSession(project), eventPositions: {},
    tileLayer: { removeAll: () => undefined, add: () => undefined },
    upperTileLayer: { removeAll: () => undefined, add: () => undefined },
    eventSprites: new Map(),
    runtimeDom: { clearEventMarkers: () => undefined, upsertEventMarker: () => undefined, syncMissingResourceError: () => undefined },
    missingResources: new Set<string>(),
    add: {
      image: (x: number, y: number, _t: string, frame: string) => obj({ kind: "image", x, y, frame }),
      sprite: (x: number, y: number, _t: string, frame: string) => obj({ kind: "image", x, y, frame }),
      rectangle: (x: number, y: number, w: number, _h: number, _c: number, alpha: number) => obj({ kind: "rect", x, y, w, alpha }),
    },
    runEvent: async () => undefined, syncRuntimeState: () => undefined,
  };
  return { scene, made };
}

describe("게임 화면 — 2층·그림자·4층", () => {
  it("깊이: 2층 = y*2+0.01, 그림자 = y*2+0.02, 4층 = 3층 값+0.01", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    const tileset = project.tilesets[map.tilesetId];
    const size = mapTileSize(map);
    const o = [...Array(tileset.count).keys()].filter((t) => passageMarkForTile(tileset, t) === "o");
    const [A, B, C] = [o[1], o[2], o[3]];
    map.upperTiles.fill(-1);
    const y = 2, i = y * map.width + 1;
    setLayerTileAt(map, 2, i, A);
    setLayerTileAt(map, 3, i, B);
    setLayerTileAt(map, 4, i, C);
    setShadowAt(map, i, 0b0001);
    store.replace(project);
    const { scene, made } = sceneFor(map, project);
    renderTiles(scene as never);
    const at = (frame: string) => made.filter((m) => m.frame === frame && m.x === 1 * size && m.y === y * size);
    expect(at(`tile_${A}`).at(-1)?.depth).toBeCloseTo(y * 2 + 0.01);
    expect(at(`tile_${C}`).at(-1)!.depth!).toBeCloseTo(at(`tile_${B}`).at(-1)!.depth! + 0.01);
    const shade = made.filter((m) => m.kind === "rect" && m.alpha === 0.5);
    expect(shade).toHaveLength(1);
    expect(shade[0]).toMatchObject({ x: 1 * size, y: y * size, w: size / 2 });
    expect(shade[0].depth).toBeCloseTo(y * 2 + 0.02);
  });

  it("2층만 바뀌어도 다시 그린다(tilesHash)", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    store.replace(project);
    const { scene, made } = sceneFor(map, project);
    renderTiles(scene as never);
    const first = made.length;
    expect(made.some((m) => m.frame === "tile_1" && m.x === 0 && m.y === 0)).toBe(false);
    setLayerTileAt(map, 2, 0, 1);
    renderTiles(scene as never);
    expect(made.length).toBeGreaterThan(first * 2 - 1);
    // 두 번째 그리기에서 (0,0) 에 2층 타일 1 이 새로 그려졌다.
    const second = made.slice(first);
    expect(second.some((m) => m.kind === "image" && m.frame === "tile_1" && m.x === 0 && m.y === 0)).toBe(true);
  });
});
