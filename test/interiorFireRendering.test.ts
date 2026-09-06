import { expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import { store } from "@/project/store";
import { renderTiles } from "@/player/playSceneMapRuntime";
import { mockSprite, mockTileImage } from "./runtimeEventPageFixtures";

for (const layer of ["lower", "upper"] as const) it(`animates interior fire on the ${layer} layer but leaves the cold hearth static`, () => {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("Map missing");
  map.tilesetId = "easyrpg_chipset_interior";
  map.lowerTiles.fill(72);
  map.upperTiles.fill(-1);
  map.events = [];
  const tiles = layer === "lower" ? map.lowerTiles : map.upperTiles;
  tiles[map.width + 1] = 124;
  tiles[map.width + 2] = 463;
  store.replace(project);
  const played: string[] = [];
  const staticFrames: (string | number | undefined)[] = [];
  renderTiles({
    map, session: startSession(project), eventPositions: {},
    tileLayer: { removeAll() {}, add() {} },
    upperTileLayer: { removeAll() {}, add() {} },
    eventSprites: new Map(),
    runtimeDom: { clearEventMarkers() {}, upsertEventMarker() {}, syncMissingResourceError() {} },
    missingResources: new Set(),
    add: {
      image(_x, _y, _texture, frame) { staticFrames.push(frame); return mockTileImage(); },
      sprite(x, y, texture) {
        const sprite = mockSprite(x, y, texture);
        sprite.play = key => { played.push(key); return sprite; };
        return sprite;
      },
    },
    async runEvent() {}, syncRuntimeState() {},
  });
  expect(played).toContain("tex_easyrpg_chipset_interior:chipset_waterfall_124_4fps");
  expect(staticFrames).toContain("tile_463");
  expect(staticFrames).not.toContain("tile_124");
});
