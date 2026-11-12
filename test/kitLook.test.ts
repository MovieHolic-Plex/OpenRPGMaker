// 게임마다 한 가지 모습(project/kitLook.ts): 같은 종류의 다른 그림(킷 ai.variantOf)을 게임 열쇠로 고른다.
// 고르는 자리는 킷 id 를 푸는 놓기 도구 둘(stamp_object · stamp_tileset_object) — 조수 실행(ctx.lookKey)만, 사람 편집은 고른 킷 그대로.
// 원본·변형 모두 이 시험이 만든 킷이다(번들에 구운 변형이 몇 장이든 이 시험은 같다): 벤치 2×1 사본이 원본, 꽃상자·꽃밭 2×1 의 칸이 변형.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { isPassable } from "@/project/collision";
import { activeKitLook, kitVariants, lookKit, withKitLook } from "@/project/kitLook";
import type { Project, StructureKitDef } from "@/project/types";

const BASE = "test-bench", VARIANT = "test-bench-variant", VARIANT2 = "test-bench-variant-2", LONE = "test-lone";
const PAIR_A = "test-pair-a", PAIR_B = "test-pair-b";
const GAMES = Array.from({ length: 40 }, (_, n) => JSON.stringify(["project", `game-${n}`]));

function projectWithVariants(): { project: Project; mapId: string; tilesetId: string } {
  const project = createBlankProject() as Project;
  const mapId = project.startMapId;
  const tilesetId = project.maps[mapId]!.tilesetId;
  const ts = project.tilesets[tilesetId]!;
  const kit = (id: string) => ts.structureKits!.find((k) => k.id === id)!;
  const aiOf = (donor: StructureKitDef, of?: string): NonNullable<StructureKitDef["ai"]> => {
    const ai = structuredClone(donor.ai ?? { description: "", placementRules: "" });
    if (of) ai.variantOf = of; else delete ai.variantOf;
    return ai;
  };
  const plain = (id: string, donor: StructureKitDef): StructureKitDef => ({ ...structuredClone(donor), id, name: `시험 ${id}`, ai: aiOf(donor) });
  const variant = (id: string, donor: StructureKitDef, of: string): StructureKitDef => ({ ...plain(id, donor), ai: aiOf(kit("bd-prop-bench_wood"), of) });
  ts.structureKits = [...ts.structureKits!,
    plain(BASE, kit("bd-prop-bench_wood")), variant(VARIANT, kit("bd-prop-flowerbox_long"), BASE), variant(VARIANT2, kit("bd-prop-flowerbed"), BASE),
    // 칸 크기가 다른 킷은 변형으로 치지 않는다(갈아 끼우면 발밑이 달라진다)
    variant("test-wrong-size", kit("bd-prop-well_roofed"), BASE),
    plain(LONE, kit("bd-prop-well_roofed")),
    // 변형이 한 장씩인 종류 둘 — 서로 따로 갈려야 한다
    plain(PAIR_A, kit("bd-prop-bench_wood")), variant(`${PAIR_A}-v`, kit("bd-prop-flowerbox_long"), PAIR_A),
    plain(PAIR_B, kit("bd-prop-bench_wood")), variant(`${PAIR_B}-v`, kit("bd-prop-flowerbed"), PAIR_B)];
  return { project, mapId, tilesetId };
}
const upperAt = (project: Project, mapId: string, x: number, y: number) => project.maps[mapId]!.upperTiles[y * project.maps[mapId]!.width + x];

describe("킷 변형 고르기", () => {
  it("열쇠가 없으면 그대로, 있으면 같은 게임은 늘 같은 그림 · 게임이 다르면 갈린다", () => {
    const { project, tilesetId } = projectWithVariants();
    const ts = project.tilesets[tilesetId]!;
    const base = ts.structureKits!.find((k) => k.id === BASE)!;
    expect(kitVariants(ts, BASE).map((k) => k.id)).toEqual([VARIANT, VARIANT2]);
    expect(lookKit(ts, base, undefined)).toBe(base);
    expect(lookKit(ts, base)).toBe(base); // 실행 구간 밖
    const picks = GAMES.map((key) => lookKit(ts, base, key).id);
    expect(GAMES.map((key) => lookKit(ts, base, key).id)).toEqual(picks);
    expect(new Set(picks)).toEqual(new Set([BASE, VARIANT, VARIANT2]));
    // 변형 id 를 직접 댄 요청은 바꾸지 않는다
    const explicit = ts.structureKits!.find((k) => k.id === VARIANT)!;
    for (const key of GAMES) expect(lookKit(ts, explicit, key)).toBe(explicit);
    // 변형이 없는 킷은 그대로
    const lone = ts.structureKits!.find((k) => k.id === LONE)!;
    for (const key of GAMES) expect(lookKit(ts, lone, key)).toBe(lone);
  });

  it("종류마다 따로 갈린다 — 변형 수가 같은 두 종류가 게임마다 같은 짝으로 묶이지 않는다", () => {
    const { project, tilesetId } = projectWithVariants();
    const ts = project.tilesets[tilesetId]!;
    const a = ts.structureKits!.find((k) => k.id === PAIR_A)!, b = ts.structureKits!.find((k) => k.id === PAIR_B)!;
    // 둘 다 2장 가운데 하나: 따로 갈리면 짝이 넷 다 나온다(해시의 낮은 비트만 쓰면 둘뿐이다)
    const pairs = new Set(GAMES.map((key) => `${lookKit(ts, a, key).id}+${lookKit(ts, b, key).id}`));
    expect(pairs.size).toBe(4);
  });

  it("실행 구간이 끝나면 열쇠가 꺼진다(중첩 포함)", () => {
    expect(activeKitLook()).toBeUndefined();
    withKitLook("a", () => {
      expect(activeKitLook()).toBe("a");
      withKitLook(undefined, () => expect(activeKitLook()).toBeUndefined());
      expect(activeKitLook()).toBe("a");
    });
    expect(() => withKitLook("b", () => { throw new Error("x"); })).toThrow();
    expect(activeKitLook()).toBeUndefined();
  });

  it("stamp_object: 조수 실행은 그 게임의 변형을 찍고, 통행은 원본과 같다 — 사람 편집·열쇠 없는 실행은 원본", () => {
    const seen = new Set<number>();
    let passable: string | undefined;
    for (const key of GAMES.slice(0, 12)) {
      const { project, mapId, tilesetId } = projectWithVariants();
      const ctx = { project, currentMapId: mapId, assistantRun: true, lookKey: key };
      const expected = lookKit(project.tilesets[tilesetId], project.tilesets[tilesetId]!.structureKits!.find((k) => k.id === BASE)!, key);
      expect(runTool(ctx, "stamp_object", { objectId: `kit:${tilesetId}/${BASE}`, mapId, x: 4, y: 4 }).ok).toBe(true);
      expect(upperAt(ctx.project, mapId, 4, 4)).toBe(expected.rows[0]!.upperTiles![0]);
      seen.add(upperAt(ctx.project, mapId, 4, 4)!);
      const map = ctx.project.maps[mapId]!;
      const grid = [3, 4, 5, 6].map((x) => (isPassable(ctx.project, map, x, 4) ? "." : "X")).join("");
      passable ??= grid;
      expect(grid).toBe(passable);
      // 같은 게임이 또 찍으면 같은 그림
      expect(runTool(ctx, "stamp_object", { objectId: `kit:${tilesetId}/${BASE}`, mapId, x: 8, y: 8 }).ok).toBe(true);
      expect(upperAt(ctx.project, mapId, 8, 8)).toBe(upperAt(ctx.project, mapId, 4, 4));
      // 실행이 끝나면 열쇠가 남지 않는다
      expect(activeKitLook()).toBeUndefined();
    }
    expect(seen.size).toBeGreaterThan(1);
    for (const ctxExtra of [{ assistantRun: true }, { assistantRun: false, lookKey: GAMES[1]! }, { lookKey: GAMES[2]! }]) {
      const { project, mapId, tilesetId } = projectWithVariants();
      const ctx = { project, currentMapId: mapId, ...ctxExtra };
      const base = project.tilesets[tilesetId]!.structureKits!.find((k) => k.id === BASE)!;
      expect(runTool(ctx, "stamp_object", { objectId: `kit:${tilesetId}/${BASE}`, mapId, x: 4, y: 4 }).ok).toBe(true);
      expect(upperAt(ctx.project, mapId, 4, 4)).toBe(base.rows[0]!.upperTiles![0]);
    }
  });

  it("stamp_tileset_object(이름으로 찾은 기물의 놓기 길)도 같은 변형을 찍는다", () => {
    for (const key of GAMES.slice(0, 8)) {
      const { project, mapId, tilesetId } = projectWithVariants();
      const ctx = { project, currentMapId: mapId, assistantRun: true, lookKey: key };
      const expected = lookKit(project.tilesets[tilesetId], project.tilesets[tilesetId]!.structureKits!.find((k) => k.id === BASE)!, key);
      const res = runTool(ctx, "stamp_tileset_object", { mapId, objectId: BASE, base: { x: 5, y: 6 } });
      expect(res.ok).toBe(true);
      expect(upperAt(ctx.project, mapId, 5, 6)).toBe(expected.rows[0]!.upperTiles![0]);
      expect((res.data as { objectId?: string }).objectId).toBe(expected.id);
    }
  });
});
