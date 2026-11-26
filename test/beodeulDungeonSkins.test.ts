// 버들항 던전 겉가죽(2026-11-15 오너 「던전도 해야하고」 「다양하게 만드는 게 중요하니까」): 주제마다 새로 그린 바닥·벽·테·기물을 시공기가 입힌다.
// 지키는 것: ① 표의 칸·킷이 모두 타일셋에 있다 ② 겉가죽 던전 종류마다 주제가 있다(깃발 붙은 주제가 먼저) ③ 한 게임은 한 모습, 게임끼리는 다르다
// ④ 겉모습이 없는 게임(옛 게임)은 옛 그림 그대로 ⑤ 입힌 층도 막힌 길·못 밟는 이동 칸이 없다 ⑥ 주제끼리 벽·바닥 칸이 다르다(동굴의 색만 바꾼 것이 아니다).
import { describe, expect, it } from "vitest";
import table from "@/assets/beodeulDungeonSkins.json";
import { dungeonSkinFor, dungeonSkinLooks } from "@/assets/dungeonSkins";
import { tilesetLookOptions, tilesetLookTableFor, TILESET_LOOK_PARTS } from "@/assets/tilesetLooks";
import { composeDungeon } from "@/editor/dungeonKit/beodeul/compose";
import { AUTHOR_BEODEUL_DUNGEON_ALIAS } from "@/editor/tools/dungeonTools";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { cellPassability } from "@/project/collision";
import { withKitLook } from "@/project/kitLook";
import { passageMarkForTile } from "@/project/tilesetPassage";
import { projectLint } from "@/project/lint/projectLint";
import { chooseTilesetLook } from "@/project/tilesetLook";
import type { TilesetLook } from "@/project/types";

const TS_ID = "beodeul_city";
const NAMES = Object.keys(dungeonSkinLooks(TS_ID));
/** 겉가죽을 입는 던전 종류(숲·늪은 나무 지붕, 마계는 허공이라 옛 그림). */
const CASES: readonly (readonly [string, Record<string, unknown>, string])[] = [
  ["cave", {}, "cave"], ["cave", { lair: true }, "hideout"], ["temple", {}, "ruin"], ["temple", { flooded: true }, "sunken"], ["catacomb", {}, "crypt"], ["labyrinth", {}, "crypt"],
  ["castle", {}, "castle"], ["sewer", {}, "sewer"], ["mine", {}, "mine"], ["volcano", {}, "volcano"], ["ice", {}, "ice"], ["pyramid", {}, "pyramid"], ["tower", {}, "tower"],
];
const lookOf = (name: string): TilesetLook => ({ textureKey: "tex_beodeul_looks", dungeon: name }) as TilesetLook;

function build(type: string, extra: Record<string, unknown>, look: string | undefined, seed: number) {
  const project = createBlankProject();
  const run = () => AUTHOR_BEODEUL_DUNGEON_ALIAS.run(project, { mapId: project.startMapId!, seed, type, name: `${type} ${seed}`, ...extra });
  const res = look ? withKitLook(`game-${look}`, run, () => lookOf(look)) : run();
  const ids = (res.data as { floors: string[] }).floors;
  return { project, maps: ids.map((id) => project.maps[id]!), ids };
}

describe("버들항 던전 겉가죽 표", () => {
  it("겉모습 갈래: dungeon 이 맨 뒤에 붙고 «원래 그림» 선택지가 없다 — 새 게임은 늘 하나를 받는다", () => {
    expect(TILESET_LOOK_PARTS.at(-1)).toBe("dungeon");
    const looks = tilesetLookTableFor(TS_ID)!;
    expect(tilesetLookOptions(looks, "dungeon")).toEqual(NAMES);
    expect(NAMES.length).toBeGreaterThanOrEqual(2);
    const picked = new Set(Array.from({ length: 60 }, (_, n) => chooseTilesetLook(looks, JSON.stringify(["project", `g-${n}`]))?.dungeon));
    expect([...picked].sort()).toEqual([...NAMES].sort());
  });

  it("칸과 킷: 주제마다 바닥 판·벽 앞면 조각·테가 제 토막 안의 칸이고, 갈아 끼우는 킷·덧놓는 킷·빛 킷이 모두 타일셋에 있다", () => {
    const ts = createBlankProject().tilesets[TS_ID]!;
    const kits = new Set((ts.structureKits ?? []).map((k) => k.id));
    expect(ts.count).toBeGreaterThanOrEqual(table.end);
    const inBlock = (n: number) => n === -1 || (n >= table.base && n < table.end);
    for (const theme of table.themes) {
      expect(theme.looks.length, theme.id).toBeGreaterThanOrEqual(2);
      for (const look of theme.looks) {
        expect(look.floor.length, theme.id).toBeGreaterThanOrEqual(2);
        for (const plate of look.floor) expect(plate).toHaveLength(16);
        expect(look.face.length, theme.id).toBeGreaterThanOrEqual(3);
        for (const piece of look.face) { expect(piece).toHaveLength(4); for (const col of piece) expect(col).toHaveLength(3); }
        for (const key of ["N", "E", "W", "Ef", "Wf", "NE", "NW", "cE", "cW"]) expect((look.rim as Record<string, number[]>)[key], `${theme.id} ${key}`).toHaveLength(4);
        // 표에 적힌 칸 번호(값만 — 열쇠와 바닥 몫은 칸 번호가 아니다)는 모두 제 토막 안이다
        const tiles: number[] = [];
        const walk = (v: unknown): void => { if (typeof v === "number") tiles.push(v); else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) if (k !== "floorWeights") walk(x); };
        walk(look);
        expect(tiles.length, `${theme.id}/${look.id}`).toBeGreaterThan(100);
        expect(tiles.filter((t) => !inBlock(t)), `${theme.id}/${look.id}`).toEqual([]);
        // 벽 앞면은 막힌 칸, 바닥은 걷는 칸
        for (const t of look.face.flat(2)) expect(Object.values(ts.passability[t]!).some(Boolean)).toBe(false);
        for (const t of look.floor.flat()) expect(Object.values(ts.passability[t]!).every(Boolean)).toBe(true);
      }
      for (const [old, to] of Object.entries(theme.swap)) { expect(kits.has(old), `${theme.id} 옛 킷 ${old}`).toBe(true); for (const k of to) expect(kits.has(k), `${theme.id} ${k}`).toBe(true); }
      for (const ex of theme.extras) expect(kits.has(ex.kit), `${theme.id} ${ex.kit}`).toBe(true);
      for (const [k, glow] of Object.entries(theme.glowOf)) { expect(kits.has(k)).toBe(true); expect((table.glow as Record<string, unknown>)[glow], glow).toBeTruthy(); }
      // 그 층에 하나뿐인 볼거리가 주제마다 하나는 있다
      expect(theme.extras.some((ex) => (ex as { once?: boolean }).once), `${theme.id} 볼거리`).toBe(true);
    }
  });

  it("덧칸: 2층에 깔리는 빛 띠·입술은 ★ 라 칸의 통행을 정하지 않고, 물가는 막힌 칸이다 — 벽 칸에 깔린 빛이 벽을 걷는 칸으로 만들던 자리(여러 씨앗 훑기에서 관문을 돌아가는 길이 됐다)", () => {
    const ts = createBlankProject().tilesets[TS_ID]!;
    const glow = Object.values(table.glow as Record<string, { rows: number[][] }>).flatMap((g) => g.rows.flat()).filter((t) => t >= 0);
    expect(glow.length).toBeGreaterThan(50);
    for (const t of glow) expect(passageMarkForTile(ts, t), `빛 ${t}`).toBe("star");
    for (const theme of table.themes) for (const look of theme.looks) {
      const over = look.lip.flat().filter((t) => t >= 0);
      // 물가·물줄기 덧칸은 막힌 칸이다 — 그 밑 1층은 걷는 바닥 그림이라 덧칸이 통행을 정한다
      const bank = [...((look as { shore?: number[] }).shore ?? []), ...((look as { shoreIn?: number[] }).shoreIn ?? [])].filter((t) => t >= 0);
      for (const t of bank) expect(passageMarkForTile(ts, t), `${theme.id} 물가 ${t}`).toBe((theme as { wade?: boolean }).wade ? "star" : "x");
      for (const t of over) expect(passageMarkForTile(ts, t), `${theme.id} 덧칸 ${t}`).toBe("star");
    }
  });

  it("주제 고르기: 던전 종류마다 제 주제, 깃발(소굴·물에 잠김)이 붙은 주제가 먼저다. 겉모습이 없으면 입히지 않는다", () => {
    const ts = createBlankProject().tilesets[TS_ID]!;
    for (const [type, extra, theme] of CASES) {
      const flags = Object.keys(extra);
      expect(dungeonSkinFor(ts, type, lookOf(NAMES[0]!), flags)?.theme.id, `${type}+${flags}`).toBe(theme);
      expect(dungeonSkinFor(ts, type, undefined, flags)).toBeUndefined();
      expect(dungeonSkinFor(ts, type, { textureKey: "tex_beodeul_looks" } as TilesetLook, flags)).toBeUndefined();
    }
    for (const type of ["forest", "swamp", "otherworld"]) expect(composeDungeon({ ...ts, look: lookOf(NAMES[0]!) }, { type, seed: 3 } as never).skin).toBeUndefined();
  });

  it("주제끼리 다른 곳이다: 벽 앞면·바닥 칸을 서로 나눠 쓰지 않는다(소굴만 동굴의 바위를 쓴다)", () => {
    const own = (id: string) => { const l = table.themes.find((t) => t.id === id)!.looks[0]!; return new Set([...l.face.flat(2), ...l.floor.flat()]); };
    const ids = table.themes.map((t) => t.id).filter((id) => id !== "hideout");
    for (const a of ids) for (const b of ids) if (a < b) { const A = own(a); expect([...own(b)].filter((t) => A.has(t)), `${a}·${b}`).toEqual([]); }
    // 한 주제의 겉모습들은 벽 앞면이 다르다
    for (const theme of table.themes) expect(new Set(theme.looks.map((l) => JSON.stringify(l.face))).size, theme.id).toBe(theme.looks.length);
  });
});

describe("버들항 던전 겉가죽 입히기", () => {
  // 던전 한 판을 짓는 데 1~2초가 든다 — 경우마다 한 시험으로 쪼개고 제한 시간을 그 일에 맞게 준다(한 시험에 다 넣으면 기본 15초를 넘는다).
  it.each(CASES.map(([type, extra]) => [`${type}${Object.keys(extra).map((k) => `+${k}`).join("")}`, type, extra] as const))("옛 게임(겉모습 없음)은 옛 그림 그대로다 — 겉가죽 칸이 한 칸도 없다: %s", (_name, type, extra) => {
    const { maps } = build(type, extra, undefined, 5);
    for (const m of maps) for (const layer of [m.lowerTiles, m.lowerOverlayTiles ?? [], m.upperTiles]) expect(Array.from(layer).some((t) => t >= table.base && t < table.end), type).toBe(false);
  }, 30_000);

  it.each(CASES.flatMap(([type, extra, themeId]) => NAMES.map((name, at) => [`${type}${Object.keys(extra).map((k) => `+${k}`).join("")} ${name}`, type, extra, themeId, name, at] as const)))(
    "입힌 층: 바닥·벽이 그 주제의 칸이고, 막힌 길·못 밟는 이동 칸이 없다 — 씨앗 하나: %s", (_name, type, extra, themeId, name, at) => {
      const theme = table.themes.find((t) => t.id === themeId)!;
      const look = theme.looks[at % theme.looks.length]!;
      const mine = new Set([...look.floor.flat(), ...look.face.flat(2)]);
      // 벽 앞면·벽 너머 칸은 무엇이 덧깔려도 막힌 칸이다
      const solid = new Set([...look.face.flat(2), ...look.top.flat(2), ...Object.values(look.rim as Record<string, number[]>).flat()]);
      for (const seed of [2]) {
        const { project, maps, ids } = build(type, extra, name, seed);
        const skinned = maps.filter((m) => Array.from(m.lowerTiles).some((t) => mine.has(t)));
        expect(skinned.length, `${type} ${name} ${seed}`).toBeGreaterThan(0);
        const tsNow = project.tilesets[TS_ID]!;
        for (const m of skinned) for (let i = 0; i < m.lowerTiles.length; i += 1) {
          if (!solid.has(m.lowerTiles[i]!)) continue;
          if (Object.values(cellPassability(tsNow, m, i)).some(Boolean)) throw new Error(`${type} ${name} ${seed}: 벽 칸 ${i % m.width},${Math.floor(i / m.width)} 이 걷는 칸이다`);
        }
        const issues = projectLint(project).filter((i) => i.severity === "error" && (!i.mapId || ids.includes(i.mapId)));
        expect(issues.map((i) => `${i.code}: ${String(i.message).slice(0, 80)}`), `${type} ${name} ${seed}`).toEqual([]);
      }
    }, 90_000);

  it("갈아 끼운 그림이 길을 막지 않는다: 옛 것이 «길을 안 막는 바닥 그림» 이라 검사 없이 놓이던 자리도 새 그림으로는 길을 다시 본다(물에 잠긴 신전 씨앗 1·3 — 우거진 풀 자리의 석상이 회랑을 막아 방 셋이 끊겼다)", () => {
    for (const seed of [1, 3]) for (const name of NAMES) expect(() => build("temple", { flooded: true }, name, seed), `${name} ${seed}`).not.toThrow();
  }, 60_000);

  it("한 게임은 한 모습: 같은 겉모습 이름이면 층마다 같은 벽, 다른 이름이면 다른 벽", () => {
    const wall = (name: string, seed: number) => {
      const { maps } = build("catacomb", {}, name, seed);
      const theme = table.themes.find((t) => t.id === "crypt")!;
      return theme.looks.findIndex((l) => { const f = new Set(l.face.flat(2)); return Array.from(maps[0]!.lowerTiles).some((t) => f.has(t)); });
    };
    expect(wall(NAMES[0]!, 3)).toBe(wall(NAMES[0]!, 9));
    expect(wall(NAMES[0]!, 3)).not.toBe(wall(NAMES[1]!, 3));
  }, 30_000);
});
