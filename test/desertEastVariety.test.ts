// desert_east 첫 판 늘리기(2026-11-13): 같은 종류의 다른 그림(변형)·새 집·새 기물·게임마다 고르는 바닥 재질, 그리고 구성기가 그것을 게임 열쇠로 고르는 길.
// 지키는 것: ① 열쇠가 없으면 구성기 사전이 예전과 똑같은 칸을 준다(옛 그림이 기본) ② 변형은 원본 자리에 그대로 들어간다(칸 크기·채운 칸·칸마다 통행·층)
// ③ 열쇠가 다르면 그림이 갈리고 통행은 같다 ④ 열쇠가 있으면 방은 배치가 둘이고 둘 다 문에서 모든 바닥에 닿는다 ⑤ 새 종류는 열쇠가 있을 때 구성기가 실제로 놓는다
// ⑥ 이어 붙는 벽면 가족은 한 게임에서 같은 순번이다(ai.lookWith).
import { describe, expect, it } from "vitest";
import pieces from "@/assets/desertEastPieces.json";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { composeDesertEast, composeDesertRoom, desertLookFor, desertPaletteFromTileset, type DesertKind, type DesertPieces, type DesertRoomKind } from "@/project/desertEastComposer";
import { kitVariants } from "@/project/kitLook";
import type { Project, StructureKitDef, TilesetDef } from "@/project/types";

const blank = createBlankProject() as Project;
const ts = blank.tilesets.desert_east as TilesetDef;
const kits = ts.structureKits as StructureKitDef[];
const P = pieces as unknown as DesertPieces;
const GAMES = Array.from({ length: 12 }, (_, n) => JSON.stringify(["project", `desert-variety-${n}`]));
const tilesOf = (kit: StructureKitDef, x: number, y: number) => [kit.rows[y]!.tiles[x] ?? -1, kit.rows[y]!.upperTiles?.[x] ?? -1] as const;
const walk = (t: number) => t < 0 || !!ts.passability[t]?.up;

describe("desert_east 변형 키트", () => {
  const variants = kits.filter((k) => k.ai?.variantOf);
  it("변형이 여럿 구워졌고 원본마다 kitVariants 가 그대로 받는다(칸 크기·채운 칸)", () => {
    expect(variants.length).toBeGreaterThanOrEqual(60);
    for (const v of variants) expect(kitVariants(ts, v.ai!.variantOf!).map((k) => k.id), v.id).toContain(v.id);
  });
  it("변형의 칸마다 통행·층이 원본과 같다(갈아 끼워도 걷는 칸·가리는 칸이 그대로)", () => {
    for (const v of variants) {
      const base = kits.find((k) => k.id === v.ai!.variantOf)!;
      for (let y = 0; y < base.height; y++) for (let x = 0; x < base.width; x++) {
        const [bl, bu] = tilesOf(base, x, y), [vl, vu] = tilesOf(v, x, y);
        expect([vl >= 0, vu >= 0], `${v.id} (${x},${y}) 층`).toEqual([bl >= 0, bu >= 0]);
        expect(walk(vl) && walk(vu), `${v.id} (${x},${y}) 통행`).toBe(walk(bl) && walk(bu));
        if (bu >= 0) expect(ts.priority[vu], `${v.id} (${x},${y}) 위층 그리기`).toBe(ts.priority[bu]);
      }
      const door = (k: StructureKitDef) => JSON.stringify((k.parts ?? []).filter((p) => p.kind === "entrance").map((p) => [p.dx, p.dy, p.w]));
      expect(door(v), `${v.id} 문 칸`).toBe(door(base));
    }
  });
});

describe("desert_east 구성기 사전 — 게임 열쇠", () => {
  it("열쇠가 없으면 원본 키트와 원래 바닥 칸 그대로", () => {
    const pal = desertPaletteFromTileset(ts, P, undefined);
    for (const k of kits) expect(pal.kit(k.id)!.rows, k.id).toBe(k.rows);
    for (const [piece, t] of Object.entries(P.tiles)) expect(pal.tile(piece), piece).toBe(t);
    for (const [set, row] of Object.entries(P.wang)) row.forEach((t, i) => expect(pal.wang(set, i), `${set}#${i}`).toBe(t));
    expect(desertLookFor(P, undefined)).toEqual({});
  });
  it("열쇠가 있으면 원본 id 로 물은 키트가 그 게임의 그림이고(크기 같음) 게임마다 갈린다", () => {
    const base = kits.find((k) => k.id === "de-well")!;
    const seen = new Set<string>();
    for (const key of GAMES) {
      const got = desertPaletteFromTileset(ts, P, key).kit("de-well")!;
      expect([got.id, got.width, got.height]).toEqual([base.id, base.width, base.height]);
      seen.add(JSON.stringify(got.rows));
    }
    expect(seen.size).toBeGreaterThanOrEqual(2);
  });
  it("바닥 재질: 갈래마다 고른 재질의 한 칸 바닥·왕 타일을 주고, 모든 칸은 걸을 수 있는 아래층 바닥이다", () => {
    expect(P.looks, "겉모습 표").toBeTruthy();
    const looks = new Set<string>();
    for (const key of GAMES) {
      const look = desertLookFor(P, key);
      looks.add(JSON.stringify(look));
      const pal = desertPaletteFromTileset(ts, P, key);
      for (const piece of ["de-sand", "de-sand-b", "de-sand-ripple", "de-road", "de-road-b", "de-flag", "de-flag-b"]) {
        const t = pal.tile(piece);
        expect(t, piece).toBeGreaterThanOrEqual(0);
        expect(ts.passability[t]!.up && ts.priority[t] === "lower", `${piece} → ${t}`).toBe(true);
      }
      for (const set of ["road", "grass", "dune", "flag", "water"]) for (let i = 0; i < 16; i++) {
        const t = pal.wang(set, i), old = P.wang[set]![i]!;
        expect(t, `${set}#${i}`).toBeGreaterThanOrEqual(0);
        expect(!!ts.passability[t]!.up, `${set}#${i} 통행`).toBe(!!ts.passability[old]!.up);
      }
      if (!look.ground && !look.road && !look.plaza) expect(pal.tile("de-sand")).toBe(P.tiles["de-sand"]);
      if (look.ground) expect(pal.tile("de-sand")).not.toBe(P.tiles["de-sand"]);
    }
    expect(looks.size).toBeGreaterThanOrEqual(4);
  });
});

describe("desert_east 구성 — 같은 씨앗, 다른 게임", () => {
  const compose = (kind: DesertKind, key: string | undefined) => composeDesertEast({ width: 56, height: 44, kind, seed: 3 }, desertPaletteFromTileset(ts, P, key));
  const NEW_KINDS = ["de-notice-board", "de-house-wide-5", "de-house-hut-2", "de-barrel", "de-barrels"];
  it("같은 씨앗이면 게임이 달라도 건물·소품 자리와 걷는 칸은 같고 그림만 다르다", () => {
    const pass = (r: { lower: number[]; upper: number[] }) => r.lower.map((lo, i) => (walk(lo) && walk(r.upper[i]!) ? 1 : 0)).join("");
    for (const kind of ["oasis", "bazaar"] as const) {
      const a = compose(kind, GAMES[1]), b = compose(kind, GAMES[2]);
      expect(JSON.stringify(a.props), kind).toBe(JSON.stringify(b.props));
      expect(JSON.stringify(a.buildings.map((d) => [d.kit, d.rect, d.doors]))).toBe(JSON.stringify(b.buildings.map((d) => [d.kit, d.rect, d.doors])));
      expect(pass(a), `${kind} 통행`).toBe(pass(b));
      expect(a.upper.join(",") === b.upper.join(",") && a.lower.join(",") === b.lower.join(","), `${kind}: 두 게임의 그림이 같다`).toBe(false);
    }
  });
  it("열쇠가 없으면 구성기가 새 종류를 스스로 섞지 않는다(옛 구성 그대로) — 열쇠가 있으면 통·게시판·새 집 둘을 실제로 놓는다", () => {
    const placed = (key: (seed: number) => string | undefined) => {
      const ids = new Set<string>();
      for (const kind of ["oasis", "bazaar", "caravanserai"] as const) for (let seed = 1; seed <= 8; seed++) {
        const r = composeDesertEast({ width: 56, height: 44, kind, seed }, desertPaletteFromTileset(ts, P, key(seed)));
        for (const p of r.props) ids.add(p.kit);
        for (const d of r.buildings) ids.add(d.kit);
      }
      return ids;
    };
    const plain = placed(() => undefined);
    for (const id of NEW_KINDS) expect(plain.has(id), `열쇠 없음: ${id}`).toBe(false);
    const keyed = placed((seed) => GAMES[seed]);
    for (const id of ["de-notice-board", "de-house-wide-5", "de-house-hut-2"]) expect(keyed.has(id), id).toBe(true);
    expect(keyed.has("de-barrel") || keyed.has("de-barrels"), "통").toBe(true);
  });
  it("도구로 지은 맵: 열쇠가 있어도 시작 칸에서 모든 문 접근칸에 닿는다(도구가 엔진 통행으로 다시 본다)", () => {
    for (const key of GAMES.slice(0, 4)) {
      const ctx = { project: structuredClone(blank), currentMapId: "m", assistantRun: true, lookKey: key };
      expect(runTool(ctx, "create_map", { id: "m", name: "사막", width: 56, height: 44, tilesetId: "desert_east" }).ok).toBe(true);
      const r = runTool(ctx, "compose_desert_east_map", { mapId: "m", kind: "bazaar", seed: 2 });
      expect(r.ok, String((r as { error?: string }).error)).toBe(true);
      const map = ctx.project.maps.m!;
      expect(isPassable(ctx.project, map, ctx.project.startPos.x, ctx.project.startPos.y)).toBe(true);
    }
  }, 60_000);
});

describe("desert_east 방 — 배치 둘", () => {
  const SIZE: Record<DesertRoomKind, [number, number]> = { teahouse: [16, 12], shop: [14, 10], palace_hall: [20, 14], tomb: [15, 16], hammam: [14, 11], inn: [16, 11] };
  const ALT_ONLY = ["de-barrel", "de-barrels"];
  it("열쇠가 있으면 방 종류마다 씨앗에 따라 가구 자리가 두 가지 이상이다", () => {
    const pal = desertPaletteFromTileset(ts, P, GAMES[0]);
    for (const kind of Object.keys(SIZE) as DesertRoomKind[]) {
      const layouts = new Set<string>();
      for (let seed = 1; seed <= 10; seed++) {
        const r = composeDesertRoom({ width: SIZE[kind][0], height: SIZE[kind][1], kind, seed }, pal);
        layouts.add(JSON.stringify(r.props.map((p) => [p.kit, p.x, p.y])));
        expect(r.doors.length, `${kind} 문`).toBeGreaterThan(0);
      }
      expect(layouts.size, `${kind} 배치 가짓수`).toBeGreaterThanOrEqual(2);
    }
  });
  it("열쇠가 없으면 둘째 배치를 쓰지 않는다(통이 놓이지 않는다) · 찻집은 16×12·24×16 에서도 짜인다(막는 가구를 걷어 낸다)", () => {
    const pal = desertPaletteFromTileset(ts, P, undefined);
    for (const kind of Object.keys(SIZE) as DesertRoomKind[]) for (let seed = 1; seed <= 6; seed++) {
      const r = composeDesertRoom({ width: SIZE[kind][0], height: SIZE[kind][1], kind, seed }, pal);
      for (const p of r.props) expect(ALT_ONLY.includes(p.kit), `${kind} 씨앗 ${seed}: ${p.kit}`).toBe(false);
    }
    for (const [w, h] of [[16, 12], [20, 14], [24, 16]] as const) for (let seed = 1; seed <= 4; seed++) {
      for (const key of [undefined, GAMES[seed]]) expect(() => composeDesertRoom({ width: w, height: h, kind: "teahouse", seed }, desertPaletteFromTileset(ts, P, key)), `찻집 ${w}×${h} 씨앗 ${seed}`).not.toThrow();
    }
  });
});

describe("desert_east 벽면 가족 — 함께 바뀐다(ai.lookWith)", () => {
  it("창 난 벽·벽감 벽의 변형은 벽면 원본을 가리키고, 어느 게임에서나 벽면과 같은 순번의 그림이다", () => {
    const rowsOf = (id: string) => JSON.stringify(kits.find((k) => k.id === id)!.rows);
    for (const [accent, wall] of [["de-wall-window-plaster", "de-wall-plaster"], ["de-wall-niche-stone", "de-wall-stone"]] as const) {
      const av = kitVariants(ts, accent), wv = kitVariants(ts, wall);
      expect(av.length, accent).toBe(wv.length);
      expect(av.length).toBeGreaterThan(0);
      for (const v of av) expect(v.ai?.lookWith, v.id).toBe(wall);
      const picks = new Set<string>();
      for (const key of GAMES) {
        const pal = desertPaletteFromTileset(ts, P, key);
        const a = [rowsOf(accent), ...av.map((k) => JSON.stringify(k.rows))].indexOf(JSON.stringify(pal.kit(accent)!.rows));
        const w = [rowsOf(wall), ...wv.map((k) => JSON.stringify(k.rows))].indexOf(JSON.stringify(pal.kit(wall)!.rows));
        expect(a, `${accent} @ ${key}`).toBe(w);
        picks.add(String(w));
      }
      expect(picks.size, `${wall}: 열두 게임이 두 그림으로 갈린다`).toBe(2);
    }
  });
});
