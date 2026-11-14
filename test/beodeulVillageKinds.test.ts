// 버들항 마을 종류(editor/tools/beodeulVillageKinds.ts · beodeulVillageScenes.ts): 미리 지어 둔 종류 표, 터에 맞는 종류 고르기(게임 열쇠·씨앗),
// 장면은 통째로 놓이거나 안 놓인다, 조수가 종류를 이름으로 부를 수 있고 장면 이름이 자리 낱말이 된다. 열쇠도 이름도 없으면 전과 같다.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { BEODEUL_VILLAGE_KINDS, VILLAGE_KIND_LIST, chooseVillageKind, villageKindById, villageKindFits, type VillageFacts } from "@/editor/tools/beodeulVillageKinds";
import { brokenVillageScenes, sceneSlot, type PlacedScene } from "@/editor/tools/beodeulVillageScenes";
import { beodeulRouteGuard } from "@/editor/tools/beodeulObjectSets";
import { clearVillageKindPlan, recordVillageKind, villageKindOfMap, villageSceneByWord, villageScenesOfMap } from "@/project/villageKindPlan";
import { VILLAGE_CARD, villageArgs } from "@/ai/v2/place/builders/village";
import { resolveWhere } from "@/ai/v2/place/where";
import { isPassable } from "@/project/collision";
import type { GameMap, Project } from "@/project/types";
import type { PlaceSpec } from "@/ai/v2/shared/types";

const KEYS = ["ashvale", "moonharbor", "thornkeep", "reedwater", "saltmere", "oakhollow"].map((name) => JSON.stringify(["project", `variety-${name}`]));
const TEMPLATE = JSON.stringify(createBlankProject());
const fresh = () => JSON.parse(TEMPLATE) as Project;
const facts = (over: Partial<VillageFacts> = {}): VillageFacts => ({ water: "river", tiers: false, deepWoods: false, houses: 4, walls: false, harbour: false, plaza: false, ...over });

describe("버들항 마을 종류 — 표", () => {
  it("서른 종류가 넘고, 급 셋에 걸치며, 종류마다 장면이 셋 이상이다", () => {
    expect(BEODEUL_VILLAGE_KINDS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(BEODEUL_VILLAGE_KINDS.map((k) => k.id)).size).toBe(BEODEUL_VILLAGE_KINDS.length);
    for (const rank of ["hamlet", "village", "town"] as const) expect(BEODEUL_VILLAGE_KINDS.filter((k) => k.rank === rank).length).toBeGreaterThanOrEqual(5);
    for (const kind of BEODEUL_VILLAGE_KINDS) {
      expect(kind.scenes.length, kind.id).toBeGreaterThanOrEqual(3);
      expect(kind.home.length, kind.id).toBeGreaterThan(0);
      for (const scene of kind.scenes) {
        // 장면은 서너 ~ 여덟 가지의 무더기다: 꼭 있어야 하는 뭍 조각이 셋에서 여덟
        const required = scene.pieces.filter((p) => !p.optional && !p.water).length;
        expect(required, `${kind.id}/${scene.id}`).toBeGreaterThanOrEqual(3);
        expect(required, `${kind.id}/${scene.id}`).toBeLessThanOrEqual(8);
        expect(scene.min, `${kind.id}/${scene.id}`).toBeGreaterThanOrEqual(3);
      }
    }
    // 강자갈 마당은 어느 종류에도 없다
    expect(JSON.stringify(BEODEUL_VILLAGE_KINDS)).not.toMatch(/yard-cobble/);
  });

  it("판석 광장 위에 서는 장면은 장터·읍 종류에만 있다", () => {
    for (const kind of BEODEUL_VILLAGE_KINDS) if (kind.scenes.some((s) => s.at === "plaza")) expect(kind.fit.square, kind.id).toBe(true);
  });
});

describe("버들항 마을 종류 — 고르기", () => {
  it("터에 맞는 종류만 고른다 — 바다 마을은 나무꾼 터가 아니고, 성벽 없는 마을은 성읍이 아니다", () => {
    const lumber = villageKindById("lumber-camp")!, cove = villageKindById("fishing-cove")!, garrison = villageKindById("garrison-town")!, harbour = villageKindById("harbour-town")!;
    expect(villageKindFits(lumber, facts({ water: "sea", deepWoods: true }))).toBe(false);
    expect(villageKindFits(lumber, facts({ water: "none", deepWoods: true }))).toBe(true);
    expect(villageKindFits(lumber, facts({ water: "none" }))).toBe(false); // 깊은 숲이 아니다
    expect(villageKindFits(cove, facts({ water: "sea" }))).toBe(true);
    expect(villageKindFits(cove, facts({ water: "river" }))).toBe(false);
    expect(villageKindFits(garrison, facts({ houses: 10 }))).toBe(false);
    expect(villageKindFits(garrison, facts({ houses: 10, walls: true, water: "none" }))).toBe(true);
    expect(villageKindFits(harbour, facts({ water: "sea", houses: 4 }))).toBe(false);
    expect(villageKindFits(harbour, facts({ water: "sea", houses: 4, harbour: true }))).toBe(true);
    for (const key of KEYS) for (const seed of [1, 7, 42]) {
      const sea = chooseVillageKind(facts({ water: "sea" }), key, seed)!;
      expect(sea.fit.water).toContain("sea");
      expect(sea.fit.woods).toBeUndefined();
    }
  });

  it("같은 요청이 게임마다 갈리고, 한 게임의 마을 셋은 세 종류다 — 열쇠가 없으면 고르지 않는다", () => {
    const f = facts();
    const picks = KEYS.map((key) => chooseVillageKind(f, key, 4242)!.id);
    expect(new Set(picks).size).toBeGreaterThanOrEqual(4);
    expect(KEYS.map((key) => chooseVillageKind(f, key, 4242)!.id)).toEqual(picks); // 같은 열쇠·씨앗은 늘 같다
    const taken = new Set<string>();
    for (const seed of [3, 4, 5]) { const kind = chooseVillageKind(f, KEYS[0], seed, undefined, taken)!; expect(taken.has(kind.id)).toBe(false); taken.add(kind.id); }
    expect(taken.size).toBe(3);
    expect(chooseVillageKind(f, undefined, 7)).toBeUndefined();
    // 이름으로 정하면 열쇠 없이도 그 종류다. 표에 없는 이름은 종류가 아니다.
    expect(chooseVillageKind(f, undefined, 7, "smithy-village")?.id).toBe("smithy-village");
    expect(chooseVillageKind(f, KEYS[0], 7, "no-such-kind")).toBeUndefined();
    // 광장을 청했으면 장터 종류가 먼저다
    for (const key of KEYS) expect(chooseVillageKind(facts({ plaza: true, houses: 7 }), key, 9)!.fit.square).toBe(true);
  });
});

describe("버들항 마을 종류 — 장면은 통째로", () => {
  const scene = (required: number, min: number): PlacedScene => ({ id: "s", ko: "장면", en: "scene", at: "work", x: 0, y: 0, w: 3, h: 2, stand: { x: 1, y: 2 }, required, min, pieces: 4 });
  it("필수 조각이 하나라도 빠지거나 남은 조각이 모자라면 깨진 장면이다", () => {
    const scenes = [scene(3, 3), scene(2, 3)];
    const whole = [sceneSlot(0, true), sceneSlot(0, true), sceneSlot(0, true), sceneSlot(0, false), sceneSlot(1, true), sceneSlot(1, true), sceneSlot(1, false)];
    expect(brokenVillageScenes(scenes, whole)).toEqual([]);
    expect(brokenVillageScenes(scenes, whole.slice(1))).toEqual([0]); // 필수 하나 빠짐
    expect(brokenVillageScenes(scenes, whole.slice(0, 6))).toEqual([1]); // 곁들이가 빠져 셋이 안 된다
    expect(brokenVillageScenes(scenes, ["home", "wild"])).toEqual([0, 1]);
    scenes[0]!.lifted = true;
    expect(brokenVillageScenes(scenes, ["home"])).toEqual([1]); // 이미 걷은 장면은 다시 세지 않는다
  });

  it("들를 곳 사이의 길을 두 칸 넘게 돌리는 자리는 받지 않는다", () => {
    // 7×3 복도: 들머리 (0,1) → 문 앞 (6,1). 가운데 줄을 막으면 돌아가야 한다.
    const guard = beodeulRouteGuard(7, 3, { entrance: { x: 0, y: 1 }, gather: null, stops: [{ x: 6, y: 1 }], walkable: () => true, canStep: () => true });
    expect(guard.ok([1 * 7 + 3])).toBe(true); // 한 칸: 위아래로 두 걸음 돌아간다
    expect(guard.ok([0 * 7 + 3, 1 * 7 + 3, 2 * 7 + 3])).toBe(false); // 세 줄을 다 막으면 끊긴다
    guard.take([0 * 7 + 3, 1 * 7 + 3]); // 위 두 줄을 막았다 — 아랫줄로 돌아간다
    expect(guard.added()).toBe(2);
    expect(guard.ok([0 * 7 + 5])).toBe(true); // 길이 더 늘지 않는 칸은 된다
    expect(guard.ok([1 * 7 + 5, 2 * 7 + 5])).toBe(false); // 한 번 더 돌리면 처음보다 두 칸 넘게 멀어진다 — 조금씩 쌓이는 것도 막는다
    // 걷는 땅 한쪽을 가두는 자리도 받지 않는다: 3×3 의 구석 (2,2) 를 두 칸으로 에워싸면 그 칸이 갇힌다
    const pocket = beodeulRouteGuard(3, 3, { entrance: { x: 0, y: 0 }, gather: null, stops: [{ x: 2, y: 0 }], walkable: () => true, canStep: () => true });
    expect(pocket.ok([2 * 3 + 1])).toBe(true);
    expect(pocket.ok([2 * 3 + 1, 1 * 3 + 2])).toBe(false);
    // 들를 곳이 없으면 아무것도 막지 않는다
    expect(beodeulRouteGuard(7, 3, undefined).ok([10])).toBe(true);
  });
});

function build(kind: string | undefined, key: string | undefined, args: Record<string, unknown> = {}) {
  const ctx = { project: fresh(), ...(key ? { assistantRun: true, lookKey: key } : {}) };
  const result = runTool(ctx, "author_beodeul_town", { theme: "river", water: "river", seed: 11, width: 56, height: 48, id: "v_kind", ...(kind ? { kind } : {}), ...args } as never);
  expect(result.ok, result.summary).toBe(true);
  const data = result.data as { mapId: string; villageKind?: { id: string }; scenes?: { id: string; ko: string; x: number; y: number; w: number; h: number; stand: { x: number; y: number }; pieces: number }[];
    sceneCount?: { asked: number; placed: number }; doors: { reached: boolean }[]; stampFailed: number; work?: { name: string } | null };
  return { data, summary: result.summary, project: ctx.project, map: ctx.project.maps[data.mapId]! as GameMap };
}

describe("버들항 마을 종류 — 짓기", () => {
  it("이름으로 부른 종류로 짓는다 — 장면이 서고, 맵과 결과에 종류와 장면이 적힌다", () => {
    const built = build("smithy-village", undefined);
    expect(built.data.villageKind?.id).toBe("smithy-village");
    expect(villageKindOfMap(built.map)).toBe("smithy-village");
    expect(built.data.scenes!.length).toBeGreaterThanOrEqual(2);
    expect(built.data.scenes!.map((s) => s.ko)).toContain("대장간 마당");
    expect(built.summary).toMatch(/Kind smithy-village \(Smithy village\); scenes: smithy yard \(\d+,\d+\)/);
    expect(villageScenesOfMap(built.map).map((r) => r.label)).toEqual(built.data.scenes!.map((s) => s.ko));
    // 장면마다 조각이 셋 이상 서 있고(그 네모 안에 3층 그림이 있다), 문 앞 도달은 그대로다
    for (const s of built.data.scenes!) {
      expect(s.pieces, s.ko).toBeGreaterThanOrEqual(3);
      let drawn = 0;
      for (let j = 0; j < s.h; j++) for (let i = 0; i < s.w; i++) if ((built.map.upperTiles[(s.y + j) * built.map.width + s.x + i] ?? -1) >= 0) drawn += 1;
      expect(drawn, s.ko).toBeGreaterThanOrEqual(3);
    }
    expect(built.data.doors.filter((d) => !d.reached).length).toBe(0);
    expect(built.data.stampFailed).toBe(0);
  }, 240_000);

  it("열쇠도 이름도 없으면 종류 없이 전과 같다 — 열쇠가 있으면 터에 맞는 종류 하나가 골라진다", () => {
    const plain = build(undefined, undefined);
    expect(plain.data.villageKind).toBeUndefined();
    expect(villageKindOfMap(plain.map)).toBeUndefined();
    expect(plain.map.layoutPlan).toBeUndefined();
    expect(plain.summary).not.toMatch(/Kind /);
    const a = build(undefined, KEYS[0]), again = build(undefined, KEYS[0]);
    expect(a.data.villageKind?.id).toBeTruthy();
    expect(again.data.villageKind?.id).toBe(a.data.villageKind?.id);
    expect(again.data.scenes).toEqual(a.data.scenes);
    expect(villageKindFits(villageKindById(a.data.villageKind!.id)!, facts({ houses: 7, tiers: true }))).toBe(true);
    // 표에 없는 이름은 거절하지 않고 알린 뒤 그 게임의 종류로 짓는다
    const odd = build("no-such-kind", KEYS[0]);
    expect(odd.data.villageKind?.id).toBe(a.data.villageKind?.id);
  }, 240_000);

  it("장면 이름은 자리 낱말이다 — «대장간 마당» 에 세운 사람은 그 무더기 곁 걷는 칸에 선다", () => {
    const built = build("smithy-village", undefined);
    const yard = built.data.scenes!.find((s) => s.ko === "대장간 마당")!;
    for (const word of ["대장간 마당", "smithy yard", "대장간 마당 근처"]) {
      const hit = resolveWhere(built.project, built.map, word);
      expect(hit.fallback, word).toBeUndefined();
      expect(hit.how, word).toMatch(/대장간 마당/);
      const gap = Math.max(hit.cell.x < yard.x ? yard.x - hit.cell.x : hit.cell.x - (yard.x + yard.w - 1), hit.cell.y < yard.y ? yard.y - hit.cell.y : hit.cell.y - (yard.y + yard.h - 1));
      expect(gap, word).toBeLessThanOrEqual(3);
      expect(isPassable(built.project, built.map, hit.cell.x, hit.cell.y), word).toBe(true);
    }
    // 장면이 아닌 낱말은 전처럼 푼다
    expect(villageSceneByWord(built.map, "광장")).toBeUndefined();
  }, 240_000);
});

describe("버들항 마을 종류 — 기록과 조수 글", () => {
  it("종류 기록은 다시 지을 때 걷히고, 남의 설계 기록은 건드리지 않는다", () => {
    const map = { layoutPlan: { version: 1, kind: "houses", regions: [{ id: "house_1", role: "house", label: "집", x: 1, y: 1, w: 3, h: 3 }] } } as unknown as GameMap;
    recordVillageKind(map, { id: "mill-hamlet", ko: "물방앗간 마을", en: "Mill hamlet", rank: "hamlet" }, 7, [{ id: "mill-yard", ko: "방앗간 마당", en: "mill yard", at: "work", x: 5, y: 5, w: 4, h: 3, stand: { x: 6, y: 8 } }]);
    expect(villageKindOfMap(map)).toBe("mill-hamlet");
    expect(map.layoutPlan!.regions.map((r) => r.role)).toEqual(["house", "scene"]);
    expect(villageSceneByWord(map, "방앗간 마당 옆")?.id).toBe("scene_mill-yard");
    expect(villageSceneByWord(map, "the mill yard")?.id).toBe("scene_mill-yard");
    clearVillageKindPlan(map);
    expect(villageKindOfMap(map)).toBeUndefined();
    expect(map.layoutPlan!.regions.map((r) => r.id)).toEqual(["house_1"]);
    const bare = {} as GameMap; clearVillageKindPlan(bare); expect(bare.layoutPlan).toBeUndefined();
  });

  it("마을 카드가 종류 id 를 모두 싣고, kind 힌트는 표에 있는 id 만 도구로 간다", () => {
    for (const kind of BEODEUL_VILLAGE_KINDS) expect(VILLAGE_CARD).toContain(`${kind.id} (`);
    expect(VILLAGE_CARD.endsWith(`${VILLAGE_KIND_LIST}.`)).toBe(true);
    const spec = (hints: Record<string, unknown>) => ({ type: "village", name: "버들 마을", hints } as PlaceSpec);
    expect(villageArgs(spec({ kind: "smithy-village" })).args.kind).toBe("smithy-village");
    const odd = villageArgs(spec({ kind: "대장간" }));
    expect(odd.args.kind).toBeUndefined();
    expect(odd.warnings.join(" ")).toMatch(/not a village kind id/);
    expect(villageArgs(spec({})).args.kind).toBeUndefined();
  });
});
