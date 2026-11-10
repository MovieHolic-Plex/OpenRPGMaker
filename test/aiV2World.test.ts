import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeGameBlueprint, type GameBlueprint } from "@/project/gameBlueprint";
import { createV2Tools, V2Session } from "@/ai/v2/verbs";
import { buildV2SystemPrompt } from "@/ai/v2/prompt";
import { countMaps } from "@/ai/v2/mapCount";
import { walkGame } from "@/ai/v2/makeGame";
import { builderFor } from "@/ai/v2/builders";
import { WORLDS, parseWorldStyle, pickWorld, pickWorldDoor, repairWorldPlaces, worldById, worldCard, worldKind, worldPlaceProblems, worldPlaceSpec } from "@/ai/v2/world";
import { worldForRequest } from "@/ai/v2/worldRequest";
import type { PiAssistantV2Env } from "@/ai/v2/env";
import type { ToolContext } from "@/editor/tools/types";

// 2026-11-10 오너 「자꾸 '비슷한' 맵을 만들어내는 조수도 문제」: 게임 하나를 만드는 요청이 요청과 상관없이 버들항 마을 + 동굴 + 숲길 4장이었다.
// 게임마다 세계(칩셋 한 벌)를 고르고, 장소를 그 세계의 서로 다른 종류로 build_world 가 짓는다(src/ai/v2/world.ts).
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다). 같은 흐름의 실측은 scripts/qa/assistant-v2/worldProbe.mts.

const key = (n: number) => `["project","p${n}"]`;
const steps = (places: readonly string[]): GameBlueprint["steps"] => places.map((place, i) => ({ id: `s${i + 1}`, place, event: `${place} 단서`, action: "단서를 찾는다", gives: i === places.length - 1 ? "엔딩" : `단서 ${i + 1}`, feeling: "호기심" }));

describe("세계 고르기", () => {
  it("요청이 세계를 말하면 그 세계다", () => {
    const project = createBlankProject();
    expect(pickWorld(project, key(1), "해적 게임 하나 만들어 줘")?.id).toBe("pirate_isles");
    expect(pickWorld(project, key(1), "사막 오아시스 모험 게임을 만들어 줘")?.id).toBe("desert_east");
    expect(pickWorld(project, key(1), "좀비 아포칼립스 게임 만들어 줘")?.id).toBe("wasteland");
  });

  it("다른 테마·장르 낱말이 있으면 고르지 않는다(종전 길)", () => {
    const project = createBlankProject();
    for (const request of ["조선 시대 게임 하나 만들어 줘", "학교 연애 게임 만들어 줘", "숲 속 모험 게임을 만들어 줘"]) expect(pickWorld(project, key(2), request)).toBeUndefined();
  });

  it("낱말이 없으면 프로젝트 열쇠로 고른다 — 같은 열쇠는 같은 세계, 열쇠가 다르면 여러 세계", () => {
    const project = createBlankProject();
    const request = "재밌는 게임 만들어 줘.";
    expect(pickWorld(project, key(7), request)?.id).toBe(pickWorld(project, key(7), request)?.id);
    const picked = new Set(Array.from({ length: 80 }, (_, i) => pickWorld(project, key(i), request)?.id));
    expect(picked.size).toBeGreaterThanOrEqual(6);
    expect(picked.has(undefined)).toBe(false);
    expect(picked.has("wasteland")).toBe(false);   // 황무지는 요청이 말했을 때만
  });

  it("판타지 요청은 판타지 풀에서만, 열쇠가 없으면 고르지 않는다", () => {
    const project = createBlankProject();
    const request = "판타지 RPG 게임 하나 만들어 줘.";
    const picked = new Set(Array.from({ length: 80 }, (_, i) => pickWorld(project, key(i), request)!.id));
    for (const id of picked) expect(worldById(id)!.pool).toBe("fantasy");
    expect(picked.size).toBeGreaterThanOrEqual(4);
    expect(pickWorld(project, undefined, request)).toBeUndefined();
  });

  it("청사진이 있으면 청사진이 정한 세계다(다시 고르지 않는다)", () => {
    const project = createBlankProject();
    const names = ["가", "나", "다", "라", "마", "바"];
    project.gameBlueprint = normalizeGameBlueprint({ title: "t", genre: "g", playerGoal: "p", steps: steps(names), ending: { name: "e", how: "h", feeling: "f" }, setting: "snow_north", places: names.map((name) => ({ name, kind: "village" })) });
    expect(worldForRequest(project, key(1), "해적 게임 하나 만들어 줘")?.id).toBe("snow_north");
    const { setting: _setting, ...noWorld } = project.gameBlueprint;
    project.gameBlueprint = noWorld;
    expect(worldForRequest(project, key(1), "해적 게임 하나 만들어 줘")).toBeUndefined();
  });
});

describe("세계 표", () => {
  it("종류마다 짓는 길이 있고, 구성기 종류의 명세는 세계 빌더가 받는다", () => {
    for (const world of WORLDS) {
      expect(new Set(world.kinds.map((k) => k.id)).size).toBe(world.kinds.length);
      for (const kind of world.kinds) {
        expect(!!kind.compose || !!kind.spec).toBe(true);
        expect(!!kind.compose).toBe(!!world.composer);
        const spec = worldPlaceSpec(world, kind, kind.ko);
        expect(builderFor(spec)?.id).toBe(kind.compose ? "world" : builderFor({ ...kind.spec!, name: kind.ko })!.id);
        if (kind.compose) {
          expect(parseWorldStyle(spec.style)).toEqual({ world, kind });
          // 세는 맵은 100칸 이상이다 — 표의 방은 모두 넘는다.
          expect(kind.compose.size[0] * kind.compose.size[1]).toBeGreaterThanOrEqual(100);
        }
        if (kind.indoor && world.composer) expect(kind.door).toBeInstanceOf(RegExp);
      }
    }
  });

  it("실내는 그 종류의 문에, 없으면 다른 종류가 찜하지 않은 문에 단다", () => {
    const snow = worldById("snow_north")!;
    const doors = [{ kit: "sn-ice-cave 얼음 동굴" }, { kit: "sn-smithy 대장간" }, { kit: "sn-cabin-m 통나무 오두막" }];
    expect(pickWorldDoor(snow, worldKind(snow, "ice-cave")!, doors)?.kit).toContain("ice-cave");
    expect(pickWorldDoor(snow, worldKind(snow, "cabin")!, doors)?.kit).toContain("cabin");
    expect(pickWorldDoor(snow, worldKind(snow, "longhall")!, doors)?.kit).toContain("smithy");
    expect(pickWorldDoor(snow, worldKind(snow, "longhall")!, [])).toBeUndefined();
  });

  it("카드는 종류를 다 적는다", () => {
    for (const world of WORLDS) { const card = worldCard(world); for (const kind of world.kinds) expect(card).toContain(kind.id); expect(card).toContain("build_world"); }
  });
});

describe("청사진 장소 검사", () => {
  const snow = worldById("snow_north")!;
  const good = [{ name: "눈마을", kind: "village" }, { name: "장터", kind: "market" }, { name: "호수", kind: "lake" }, { name: "절벽", kind: "ice-cliff" }, { name: "오두막", kind: "cabin" }, { name: "동굴", kind: "ice-cave" }];

  it("고르게 퍼진 장소는 통과한다", () => {
    expect(worldPlaceProblems({ places: good, steps: steps(["눈마을", "호수", "절벽", "동굴"]) }, snow)).toEqual([]);
  });

  it("장소가 없거나·모르는 종류·같은 종류 되풀이·두 곳에만 머무는 단계를 짚는다", () => {
    expect(worldPlaceProblems({ steps: steps(["눈마을"]) }, snow)[0]).toContain("places is missing");
    expect(worldPlaceProblems({ places: [...good.slice(0, 5), { name: "숲길", kind: "forest" }], steps: steps(["눈마을", "호수", "절벽", "장터"]) }, snow).join(" ")).toContain("unknown kind «forest»");
    const same = Array.from({ length: 6 }, (_, i) => ({ name: `마을 ${i}`, kind: "village" }));
    expect(worldPlaceProblems({ places: same, steps: steps(same.map((p) => p.name)) }, snow).join(" ")).toContain("more than 2 times");
    expect(worldPlaceProblems({ places: good, steps: steps(["눈마을", "동굴"]) }, snow).join(" ")).toContain("only 2 place(s)");
    expect(worldPlaceProblems({ places: good, steps: steps(["눈마을", "호수", "절벽", "없는 곳"]) }, snow).join(" ")).toContain("«없는 곳»");
  });

  it("메우기는 모르는 종류를 남는 종류로, 단계의 없는 장소를 장소로 더한다", () => {
    const fixed = repairWorldPlaces({ places: [{ name: "눈마을", kind: "village" }, { name: "숲길", kind: "forest" }], steps: steps(["눈마을", "얼음 굴"]) }, snow);
    expect(fixed.places.map((p) => p.name)).toEqual(["눈마을", "숲길", "얼음 굴"]);
    for (const place of fixed.places) expect(worldKind(snow, place.kind)).toBeDefined();
    expect(new Set(fixed.places.map((p) => p.kind)).size).toBe(3);
    expect(fixed.notes).toHaveLength(2);
  });

  it("청사진은 장소·세계를 저장하고 빈 칸을 걷는다", () => {
    const bp = normalizeGameBlueprint({ title: "t", genre: "g", playerGoal: "p", steps: steps(["가", "나"]), ending: { name: "e", how: "h", feeling: "f" }, setting: "snow_north",
      places: [{ name: "가", kind: "village" }, { name: "", kind: "lake" }, { name: "나", kind: "lake", from: "가" }, { name: "가", kind: "market" }, { name: "다", kind: "", from: "없는 곳" }] });
    expect(bp.setting).toBe("snow_north");
    expect(bp.places).toEqual([{ name: "가", kind: "village" }, { name: "나", kind: "lake", from: "가" }]);
    expect(normalizeGameBlueprint(JSON.parse(JSON.stringify(bp)))).toEqual(bp);
  });
});

describe("build_world — 한 세계의 장소를 짓고 잇는다", () => {
  function harness(task: string, projectKey: string) {
    const project = createBlankProject();
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const env: PiAssistantV2Env = {
      ctx, request: { task, provider: "local-cli:claude", mapIds: [], project, projectKey } as never,
      emit: () => {}, record: () => {},
      sideChat: async () => JSON.stringify({ imagesSeen: 0, axes: {}, score: 7, majors: [] }),
      render: async () => "", checkpoint: async () => {},
    };
    const tools = createV2Tools(env, new V2Session());
    const call = async (name: string, args: unknown): Promise<{ ok?: boolean; summary?: string }> => {
      const res = await tools.find((t) => t.name === name)!.execute(`c-${name}`, args);
      return JSON.parse((res.content as { type: string; text?: string }[]).find((c) => c.type === "text")!.text!) as { ok?: boolean; summary?: string };
    };
    return { ctx, tools, call };
  }
  const task = "북방 설원에서 벌어지는 게임 하나 만들어 줘.";
  const places = [{ name: "눈마을", kind: "village" }, { name: "겨울 장터", kind: "market" }, { name: "얼어붙은 호수", kind: "lake" }, { name: "얼음 절벽", kind: "ice-cliff" }, { name: "촌장 회관", kind: "longhall" }, { name: "얼음 동굴", kind: "ice-cave" }];
  const blueprint = { title: "설원 시험", genre: "모험", playerGoal: "단서를 따라 얼음 동굴까지 가자.", places, steps: steps(["눈마을", "촌장 회관", "겨울 장터", "얼어붙은 호수", "얼음 절벽", "얼음 동굴"]), ending: { name: "끝", how: "끝났다.", feeling: "안도" } };

  it("세계 카드가 지시문에 있고 장소 설계 카드는 없다", () => {
    const project = createBlankProject();
    const sys = buildV2SystemPrompt(project, project.startMapId, task, undefined, key(1)).join("\n");
    expect(sys).toContain("[World of this game — Snowbound North]");
    expect(sys).not.toContain("[Village type:village]");
    // 열쇠가 없어도 요청이 세계를 말하면 카드가 실린다. 낱말 없는 요청은 열쇠가 없으면 종전 지시문이다.
    expect(buildV2SystemPrompt(project, project.startMapId, "판타지 RPG 게임 하나 만들어 줘.").join("\n")).toContain("[Village type:village]");
  });

  it("장소가 안 맞는 청사진은 두 번 돌려보내고, 그 뒤에는 메워서 건다", async () => {
    const { ctx, call } = harness(task, key(1));
    const bad = { ...blueprint, places: [{ name: "눈마을", kind: "village" }], steps: steps(["눈마을", "얼음 굴", "눈마을 광장", "호숫가", "절벽 길", "굴 안쪽"]).map((s, i) => ({ ...s, event: `단서 ${i}` })) };
    expect((await call("write_blueprint", bad)).ok).toBe(false);
    expect((await call("write_blueprint", bad)).ok).toBe(false);
    expect((await call("write_blueprint", bad)).ok).toBe(true);
    expect(ctx.project.gameBlueprint?.setting).toBe("snow_north");
    expect(ctx.project.gameBlueprint?.places).toHaveLength(6);
  });

  it("build_world 한 번으로 모든 장소가 서고, 한 칩셋이고, 시작에서 왕복으로 닿고, 다 센다", async () => {
    const { ctx, tools, call } = harness(task, key(1));
    expect(tools.some((t) => t.name === "build_world")).toBe(true);
    expect((await call("write_blueprint", blueprint)).ok).toBe(true);
    const built = await call("build_world", {});
    expect(built.ok).toBe(true);
    const project = ctx.project;
    const maps = places.map((p) => Object.values(project.maps).find((m) => m.name === p.name));
    expect(maps.every(Boolean)).toBe(true);
    expect(new Set(Object.values(project.maps).map((m) => m.tilesetId))).toEqual(new Set(["snow_north"]));
    expect(project.maps[project.startMapId]?.name).toBe("눈마을");
    const walk = walkGame(project, maps.map((m) => m!.id));
    expect(walk.unreached).toEqual([]);
    expect(walk.noWayBack).toEqual([]);
    expect(countMaps(project).counted).toHaveLength(places.length);
    // 얼음 동굴 방은 얼음 절벽의 동굴 입구에서 들어간다.
    const cliff = maps[3]!, cave = maps[5]!;
    expect(JSON.stringify(cliff.events)).toContain(`"mapId":"${cave.id}"`);
    // 다시 불러도 다시 짓지 않는다. add 는 장소를 더한다(모르는 종류는 남는 종류로).
    const again = await call("build_world", { add: [{ name: "낚시 오두막", kind: "hut" }] });
    expect(again.ok).toBe(true);
    expect(Object.keys(ctx.project.maps)).toHaveLength(places.length + 1);
    expect(ctx.project.gameBlueprint?.places).toHaveLength(places.length + 1);
  });

  it("구성기 세계에서 make_place 는 세계 장소로 짓는다(버들항 맵이 섞이지 않는다)", async () => {
    const { ctx, call } = harness(task, key(1));
    await call("write_blueprint", blueprint);
    const res = await call("make_place", { spec: { type: "cave", name: "숨은 굴" } });
    expect(res.ok).toBe(true);
    expect(new Set(Object.values(ctx.project.maps).map((m) => m.tilesetId))).toEqual(new Set(["snow_north"]));
    expect(ctx.project.gameBlueprint?.places?.some((p) => p.name === "숨은 굴")).toBe(true);
  });
});
