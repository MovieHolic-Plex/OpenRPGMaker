import type { ProjectV1 } from "@/project/types";

export function makeV1(): ProjectV1 {
  return {
    version: 1,
    meta: { title: "구버전", author: "테스터" },
    assets: {
      tilesets: {
        tiles_default: {
          id: "tiles_default",
          image: { type: "bundled", id: "tex_tiles_default" },
          tileSize: 32,
          tilesPerRow: 8,
          count: 8,
        },
      },
      sprites: {
        hero: {
          id: "hero",
          image: { type: "bundled", id: "tex_easyrpg_charset_people1" },
          frames: 8,
          frameWidth: 32,
          frameHeight: 32,
        },
      },
    },
    maps: {
      map_a: {
        id: "map_a",
        name: "마을",
        width: 2,
        height: 2,
        tileset: { type: "bundled", id: "tex_tiles_default" },
        tileSize: 32,
        tiles: [0, 1, 2, 3],
        collisions: [false, true, true, false],
        events: [
          {
            id: "ev1",
            x: 0,
            y: 0,
            sprite: { type: "bundled", id: "hero" },
            trigger: { kind: "action" },
            condition: { kind: "flag", flag: "met_king", value: true },
            commands: [
              { kind: "text", body: "안녕" },
              {
                kind: "choices",
                prompt: "p",
                options: [{ text: "a", branch: [{ kind: "setFlag", flag: "done", value: true }] }],
              },
              { kind: "setFlag", flag: "met_king", value: true },
              { kind: "transfer", mapId: "map_a", x: 1, y: 1 },
              { kind: "wait", ms: 100 },
            ],
          },
        ],
      },
    },
    startMapId: "map_a",
    startPos: { x: 0, y: 0 },
    flags: { met_king: false, done: false },
  };
}

export function cloneJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value));
}
