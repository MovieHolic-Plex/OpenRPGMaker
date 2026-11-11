import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeGameBlueprint, type GameBlueprint } from "@/project/gameBlueprint";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { V2Session } from "@/ai/v2/turn/session";
import { buildV2SystemPrompt } from "@/ai/v2/prompt/systemPrompt";
import { countMaps } from "@/ai/v2/judge/mapCount";
import { walkGame } from "@/ai/v2/story/makeGame";
import { battleStepBypass, stepMixProblems, walkBlueprint } from "@/ai/v2/story/blueprint";
import { foeGraphic } from "@/ai/v2/story/blueprintPath";
import { sceneCraftFindings } from "@/ai/v2/judge/sceneCraft";
import { isMysteryBlueprint } from "@/ai/v2/story/mysteryCaseRead";
import { parseAdvisorReply } from "@/ai/v2/judge/advisor";
import { builderFor } from "@/ai/v2/place/builders";
import { WORLDS, parseWorldStyle, pickWorld, pickWorldDoor, repairWorldPlaces, worldById, worldCard, worldKind, worldPlaceProblems, worldPlaceSpec } from "@/ai/v2/place/world";
import { fitsAnyWorld } from "@/ai/v2/request/genre";
import { worldForRequest } from "@/ai/v2/request/world";
import { exposeV2Tools } from "@/ai/v2/tools/toolExposure";
import { isRegistryTool } from "@/ai/v2/loop/argGuard";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import type { ToolContext } from "@/editor/tools/types";

// 2026-11-10 오너 「자꾸 '비슷한' 맵을 만들어내는 조수도 문제」: 게임 하나를 만드는 요청이 요청과 상관없이 버들항 마을 + 동굴 + 숲길 4장이었다.
// 게임마다 세계(칩셋 한 벌)를 고르고, 장소를 그 세계의 서로 다른 종류로 build_places 가 짓는다(src/ai/v2/place/world.ts).
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다). 같은 흐름의 실측은 scripts/qa/assistant-v2/worldProbe.mts.

const key = (n: number) => `["project","p${n}"]`;
const steps = (places: readonly string[]): GameBlueprint["steps"] => places.map((place, i) => ({ id: `s${i + 1}`, place, event: `${place} 단서`, action: "단서를 찾는다", gives: i === places.length - 1 ? "엔딩" : `단서 ${i + 1}`, feeling: "호기심" }));

// 단계 종류를 섞은 청사진(사람·고르기·번호 자물쇠·싸움) — 2026-11-10 오너 「재미도 재민데」: 38판 눈가림 판정에서 단계가 전부 «살펴보았다» 였다.
const KINDS = [{ kind: "talk", who: "촌장 하르" }, { kind: "find" }, { kind: "choice", who: "떠돌이 상인 미라" }, { kind: "puzzle" }, { kind: "battle", who: "얼음 문지기" }, { kind: "find" }] as const;
const mixed = (places: readonly string[]): GameBlueprint["steps"] => steps(places).map((st, i) => {
  const k = KINDS[i % KINDS.length]!;
  return { ...st, ...k, event: "who" in k ? k.who : k.kind === "puzzle" ? `${st.place}의 번호 자물쇠` : `${st.place}의 낡은 상자`, action: k.kind === "battle" ? "문지기와 싸워 이긴다" : k.kind === "puzzle" ? "번호를 맞춘다" : st.action };
});
const STEP_TEXT = [
  { id: "s1", lines: ["어서 오게. 밤마다 종이 저절로 울린다네.", "(촌장이 한숨을 쉰다.)"] },
  { id: "s3", lines: ["뭘로 하시겠어요?"], choices: [{ text: "등불을 산다", lines: ["밤길엔 등불이죠."], later: "미라의 등불이 마지막 길을 밝혔다." }, { text: "지도를 산다", lines: ["길은 안 잃겠네요."], later: "미라의 지도 덕에 지름길로 왔다." }] },
  { id: "s5", lines: ["여기부터는 못 지나간다."], winLines: ["…강하군. 지나가라."] },
];

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
    for (const world of WORLDS) { const card = worldCard(world); for (const kind of world.kinds) expect(card).toContain(kind.id); expect(card).toContain("build_places"); }
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

describe("build_places — 한 세계의 장소를 짓고 잇는다", () => {
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
    return { ctx, env, tools, call };
  }
  const task = "북방 설원에서 벌어지는 게임 하나 만들어 줘.";
  const places = [{ name: "눈마을", kind: "village" }, { name: "겨울 장터", kind: "market" }, { name: "얼어붙은 호수", kind: "lake" }, { name: "얼음 절벽", kind: "ice-cliff" }, { name: "촌장 회관", kind: "longhall" }, { name: "얼음 동굴", kind: "ice-cave" }];
  const blueprint = { title: "설원 시험", genre: "모험", playerGoal: "단서를 따라 얼음 동굴까지 가자.", places, steps: mixed(["눈마을", "촌장 회관", "겨울 장터", "얼어붙은 호수", "얼음 절벽", "얼음 동굴"]), ending: { name: "끝", how: "끝났다.", feeling: "안도" } };

  it("세계 짓기 동사는 처음부터 실린다 — 레지스트리 도구와 이름이 겹치지 않는다", () => {
    // 2026-11-10 Terra 네 판: 동사 이름이 v1 월드 그래프 도구(build_world)와 같아 «필요할 때 싣는 도구» 로 밀렸고, 모델이 load_tools 로 찾아 실은 뒤에야 불렀다.
    const { env, tools } = harness(task, "world-up-front");
    const exposure = exposeV2Tools(env, tools);
    expect(exposure.tools.map((t) => t.name)).toContain("build_places");
    expect(exposure.lazy.has("build_places")).toBe(false);
    expect(isRegistryTool("build_places")).toBe(false);
  });

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
    const bad = { ...blueprint, places: [{ name: "눈마을", kind: "village" }], steps: mixed(["눈마을", "얼음 굴", "눈마을 광장", "호숫가", "절벽 길", "굴 안쪽"]) };
    expect((await call("write_blueprint", bad)).ok).toBe(false);
    expect((await call("write_blueprint", bad)).ok).toBe(false);
    expect((await call("write_blueprint", bad)).ok).toBe(true);
    expect(ctx.project.gameBlueprint?.setting).toBe("snow_north");
    expect(ctx.project.gameBlueprint?.places).toHaveLength(6);
  });

  // 세계 한 벌을 짓는 시험은 구성기 여섯 번 + 잇기라 느리다(부하가 있는 기계에서 25초 안팎) — 한 번 지어 여러 가지를 본다.
  const SLOW = 240_000;

  it("build_places 한 번으로 모든 장소가 서고, 한 칩셋이고, 시작에서 왕복으로 닿고, 다 세고, 위험한 곳에 적과 상자가 선다", async () => {
    const { ctx, tools, call } = harness(task, key(1));
    expect(tools.some((t) => t.name === "build_places")).toBe(true);
    expect((await call("write_blueprint", blueprint)).ok).toBe(true);
    const built = await call("build_places", {});
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
    // 위험한 종류(★)의 장소에는 보이는 적과 보물상자, 안전한 장소에는 없다.
    const stocked = (m: { events: readonly { id: string }[] }) => ({ foes: m.events.filter((e) => /_wfoe\d+$/u.test(e.id)).length, chest: m.events.filter((e) => e.id.endsWith("_wchest")).length });
    for (const m of [cliff, cave]) { expect(stocked(m).foes).toBeGreaterThanOrEqual(1); expect(stocked(m).chest).toBe(1); }
    expect(stocked(maps[0]!)).toEqual({ foes: 0, chest: 0 });
    const total = () => Object.values(ctx.project.maps).reduce((n, m) => n + stocked(m).foes + stocked(m).chest, 0);
    const before = total();
    // 다시 불러도 다시 짓지 않고 더 세우지 않는다. add 는 장소를 더한다(모르는 종류는 남는 종류로 — 이름이 실내면 실내 종류).
    const again = await call("build_places", { add: [{ name: "낚시 오두막", kind: "hut" }] });
    expect(again.ok).toBe(true);
    expect(Object.keys(ctx.project.maps)).toHaveLength(places.length + 1);
    expect(ctx.project.gameBlueprint?.places).toHaveLength(places.length + 1);
    expect(total()).toBe(before);
  }, SLOW);

  it("전부 «살펴본다» 인 청사진은 종류를 섞으라고 돌려보낸다", async () => {
    const { ctx, call } = harness(task, key(1));
    const flat = { ...blueprint, steps: steps(["눈마을", "촌장 회관", "겨울 장터", "얼어붙은 호수", "얼음 절벽", "얼음 동굴"]) };
    const res = await call("write_blueprint", flat);
    expect(res.ok).toBe(false);
    expect(res.summary).toContain("no battle step");
    expect(res.summary).toContain("no puzzle and no choice step");
    expect(ctx.project.gameBlueprint).toBeUndefined();
    expect(stepMixProblems({ steps: mixed(["가", "나", "다", "라", "마", "바"]) }, true)).toEqual([]);
    expect(stepMixProblems({ steps: mixed(["가", "나", "다", "라", "마", "바"]).map((st) => (st.kind === "talk" ? { ...st, who: "" } : st)) }, true).join(" ")).toContain("needs who");
  });

  it("구성기 세계에서 make_place 는 세계 장소로 짓는다(버들항 맵이 섞이지 않는다)", async () => {
    const { ctx, call } = harness(task, key(1));
    // 장소 둘짜리 세계 청사진을 바로 건다(짓는 시간을 줄인다).
    ctx.project.gameBlueprint = normalizeGameBlueprint({ ...blueprint, setting: "snow_north", places: [{ name: "눈마을", kind: "village" }, { name: "얼음 절벽", kind: "ice-cliff" }], steps: mixed(["눈마을", "얼음 절벽", "눈마을", "얼음 절벽", "눈마을", "얼음 절벽"]) });
    const res = await call("make_place", { spec: { type: "cave", name: "숨은 굴" } });
    expect(res.ok).toBe(true);
    expect(new Set(Object.values(ctx.project.maps).map((m) => m.tilesetId))).toEqual(new Set(["snow_north"]));
    expect(ctx.project.gameBlueprint?.places?.some((p) => p.name === "숨은 굴")).toBe(true);
  }, SLOW);
});

// 경로 시험은 세계를 짓지 않는다 — 장소 맵이 없으면 경로 짓기가 시작 맵에 단계 이벤트를 둔다(빠르다). 세계 없는 요청(학교 = 다른 테마 낱말).
describe("단계 종류 — 청사진 경로가 종류마다 다른 이벤트를 짓는다", () => {
  const task = "학교 괴담 모험 게임 하나 만들어 줘.";
  function harness() {
    const project = createBlankProject();
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const env: PiAssistantV2Env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project } as never, emit: () => {}, record: () => {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {} };
    const tools = createV2Tools(env, new V2Session());
    const call = async (name: string, args: unknown): Promise<{ ok?: boolean; summary?: string }> => {
      const res = await tools.find((t) => t.name === name)!.execute(`c-${name}`, args);
      return JSON.parse((res.content as { type: string; text?: string }[]).find((c) => c.type === "text")!.text!) as { ok?: boolean; summary?: string };
    };
    const eventOf = (name: string) => Object.values(ctx.project.maps).flatMap((m) => m.events).find((e) => e.name === name)!;
    return { ctx, call, eventOf, text: (name: string) => JSON.stringify(eventOf(name).pages) };
  }
  const SPOTS = ["현관", "복도", "교실", "도서실", "옥상 계단", "옥상"];
  const base = (stepsIn: GameBlueprint["steps"]) => ({ title: "밤의 학교", genre: "모험", playerGoal: "밤의 학교에서 단서를 따라 옥상까지 가자.", steps: stepsIn, ending: { name: "새벽", how: "해가 뜨고 문이 열렸다.", feeling: "안도" } });

  it("세계 없는 게임의 청사진에는 장소 목록을 남기지 않는다", async () => {
    const { ctx, call } = harness();
    expect((await call("write_blueprint", { ...base(mixed(SPOTS)), places: SPOTS.map((name) => ({ name, kind: "village" })) })).ok).toBe(true);
    expect(ctx.project.gameBlueprint?.setting).toBeUndefined();
    expect(ctx.project.gameBlueprint?.places).toBeUndefined();
  });

  it("사람은 제 말로, 고르기는 결말 한 줄을 바꾸고, 싸움은 이겨야 넘어간다", async () => {
    const { ctx, call, eventOf, text } = harness();
    expect((await call("write_blueprint", base(mixed(SPOTS)))).ok).toBe(true);
    // 사람이 말하는 단계에 대사가 없으면 한 번 돌려보낸다 — 두 번째는 받은 글로 짓는다.
    const bounced = await call("build_blueprint_path", {});
    expect(bounced.ok).toBe(false);
    expect(bounced.summary).toContain("s1 (talk, 촌장 하르)");
    expect(bounced.summary).toContain("choices missing");
    expect((await call("build_blueprint_path", { steps: STEP_TEXT })).ok).toBe(true);
    const project = ctx.project;
    expect(walkBlueprint(project).blockers).toEqual([]);
    // 사람: 그 사람 이름으로 말하고(괄호 줄은 서술), 캐릭터 칩으로 서고, «알아냈다» 토큰 줄이 없다.
    expect(text("촌장 하르")).toContain('"speaker":"촌장 하르","body":"어서 오게. 밤마다 종이 저절로 울린다네."');
    expect(text("촌장 하르")).toContain('{"kind":"text","body":"(촌장이 한숨을 쉰다.)"}');
    expect(text("촌장 하르")).not.toContain("알아냈다");
    expect((eventOf("촌장 하르").pages?.[0]?.graphic as { sprite?: unknown }).sprite).toBeDefined();
    // 찾기: 사람 칩으로 서지 않는다.
    expect((eventOf("복도의 낡은 상자").pages?.[0]?.graphic as { sprite?: unknown }).sprite).toBeUndefined();
    // 고르기: 고를 것 둘, 고른 것마다 스위치 — 엔딩 직전 줄이 그 스위치로 갈린다.
    expect(text("떠돌이 상인 미라")).toContain('"kind":"choices"');
    expect(text("떠돌이 상인 미라")).toContain("등불을 산다");
    const endingText = () => JSON.stringify(Object.values(ctx.project.maps).flatMap((m) => m.events).find((e) => JSON.stringify(e.pages).includes("triggerEnding"))!.pages);
    expect(endingText()).toContain("미라의 등불이 마지막 길을 밝혔다.");
    expect(endingText()).toContain("미라의 지도 덕에 지름길로 왔다.");
    // 싸움: 대사 → 그 상대 이름의 무리와 전투 → 이긴 갈래에서만 진행.
    const fightOf = () => (eventOf("얼음 문지기").pages ?? []).map((pg) => pg.commands ?? []).find((cmds) => cmds.some((c) => c.kind === "battleProcessing"))! as unknown as { kind: string; troopId?: string; then?: { kind: string; body?: string }[] }[];
    expect(fightOf().map((c) => c.kind)).toEqual(["text", "battleProcessing", "fork"]);
    expect(fightOf()[2]!.then!.some((c) => c.kind === "setSwitch")).toBe(true);
    expect(project.database.troops.find((t) => t.id === fightOf()[1]!.troopId)!.name).toBe("얼음 문지기");
    expect(project.database.enemies.some((e) => e.name === "얼음 문지기")).toBe(true);
    expect(battleStepBypass(project, eventOf("얼음 문지기"))).toBeUndefined();
    // 싸우는 상대는 그 무리의 전투 그림과 같은 종류의 필드 그림으로 선다(있을 때) — 주민 칩이 아니다.
    const foeLook = foeGraphic(project, fightOf()[1]!.troopId!);
    if (foeLook) expect((eventOf("얼음 문지기").pages?.[0]?.graphic as { sprite?: { id?: string } }).sprite?.id).toBe((foeLook.sprite as { id: string }).id);
    // 사람 둘은 서로 다른 칩이다(이름으로 돌려 고른다).
    const chip = (name: string) => JSON.stringify((eventOf(name).pages?.[0]?.graphic as { sprite?: unknown; pattern?: unknown }));
    expect(chip("촌장 하르")).not.toBe(chip("떠돌이 상인 미라"));
    // 다시 읽기 쪽(했던 말을 한 번 더)은 장면 반복 검사가 세지 않는다.
    expect(text("촌장 하르")).toContain("(다시 묻는다.)");
    expect(sceneCraftFindings(createBlankProject(), ctx.project, task).filter((f) => f.id === "repeat")).toEqual([]);

    // 한 단계의 대사만 고쳐 다시 불러도 나머지 단계의 고르기·결말 갈래·승리 대사가 남는다(글은 청사진 단계에 남는다).
    expect((await call("build_blueprint_path", { steps: [{ id: "s1", lines: ["자네가 왔군. 종탑을 봐 주게."] }] })).ok).toBe(true);
    expect(text("촌장 하르")).toContain("자네가 왔군. 종탑을 봐 주게.");
    expect(text("떠돌이 상인 미라")).toContain('"kind":"choices"');
    expect(endingText()).toContain("미라의 등불이 마지막 길을 밝혔다.");
    expect(fightOf()[2]!.then![0]!.body).toBe("…강하군. 지나가라.");
    expect(ctx.project.gameBlueprint?.steps.find((st) => st.id === "s3")?.text?.choices).toHaveLength(2);
    // 청사진을 같은 단계로 다시 써도(이름 맞추기) 단계 글을 물려받는다.
    await call("write_blueprint", { ...base(ctx.project.gameBlueprint!.steps.map(({ text: _text, ...st }) => st)), playerGoal: "밤의 학교에서 단서를 따라 옥상 문을 열자." });
    expect(ctx.project.gameBlueprint?.steps.find((st) => st.id === "s5")?.text?.winLines).toEqual(["…강하군. 지나가라."]);
  }, 120_000);

  it("마지막 단계가 고르기·싸움이어도 그 종류대로 짓는다", async () => {
    // 마지막이 고르기: 엔딩 이벤트에서 고르고, 고른 것의 결말 줄 뒤에 엔딩.
    const a = harness();
    const lastChoice = mixed(SPOTS).map((st, i) => (i === 5 ? { ...st, kind: "choice" as const, who: "옥상의 소녀", event: "옥상의 소녀" } : i === 2 ? { ...st, kind: "talk" as const } : st));
    await a.call("write_blueprint", base(lastChoice));
    // 첫 호출은 다른 사람 단계의 대사가 없어 돌려보내지만 받은 글은 청사진에 남는다 — 두 번째는 글 없이 불러도 그 글로 짓는다.
    expect((await a.call("build_blueprint_path", { steps: [{ id: "s6", lines: ["무엇을 바라지?"], choices: [{ text: "문을 연다", later: "문이 열리고 새벽빛이 들었다." }, { text: "남는다", later: "너는 소녀 곁에 남았다." }] }] })).ok).toBe(false);
    expect((await a.call("build_blueprint_path", {})).ok).toBe(true);
    const end = JSON.stringify(a.eventOf("옥상의 소녀").pages);
    expect(end).toContain('"kind":"choices"');
    expect(end).toContain("너는 소녀 곁에 남았다.");
    expect(end).toContain("triggerEnding");
    // 마지막이 싸움이고 대사를 안 줬다: 상대가 «살펴보았다»·엔딩 글을 말하지 않는다 — 서술로 열고, 엔딩 글은 이긴 뒤 서술.
    const b = harness();
    const lastBattle = mixed(SPOTS).map((st, i) => (i === 5 ? { ...st, kind: "battle" as const, who: "옥상의 그림자", event: "옥상의 그림자", action: "그림자와 싸워 이긴다" } : i === 4 ? { ...st, kind: "find" as const, who: undefined, event: "옥상 계단의 낡은 상자" } : st));
    await b.call("write_blueprint", base(lastBattle as GameBlueprint["steps"]));
    await b.call("build_blueprint_path", {});
    await b.call("build_blueprint_path", {});
    const foe = b.eventOf("옥상의 그림자");
    const spoken = JSON.stringify(foe.pages);
    expect(spoken).not.toContain('"speaker":"옥상의 그림자","body":"옥상의 그림자');
    expect(spoken).not.toContain('"speaker":"옥상의 그림자","body":"해가 뜨고 문이 열렸다."');
    const page = (foe.pages ?? []).map((pg) => pg.commands ?? []).find((cmds) => cmds.some((c) => c.kind === "battleProcessing"))! as unknown as { kind: string; then?: { kind: string; body?: string }[] }[];
    expect(page.map((c) => c.kind)).toEqual(["text", "battleProcessing", "fork"]);
    expect(page[2]!.then!.map((c) => c.kind)).toEqual(["text", "text", "triggerEnding"]);
    expect(page[2]!.then![1]!.body).toBe("(해가 뜨고 문이 열렸다.)");
  }, 120_000);
});

describe("함수가 지은 것을 검사가 다시 모델에게 돌려보내지 않는다", () => {
  it("모델이 분위기로 쓴 «미스터리» 는 추리 사건이 아니다 — 요청이 말했거나 범인·추리가 있을 때만", () => {
    const project = createBlankProject();
    const bp = (genre: string, request: string, goal = "기관을 멈추자.") => normalizeGameBlueprint({ title: "t", genre, playerGoal: goal, request, steps: steps(["가", "나"]), ending: { name: "e", how: "h", feeling: "f" } });
    project.gameBlueprint = bp("증기 도시 미스터리", "재밌는 게임 만들어 줘.");
    expect(isMysteryBlueprint(project)).toBe(false);
    project.gameBlueprint = bp("모험", "미스터리 게임 만들어 줘.");
    expect(isMysteryBlueprint(project)).toBe(true);
    project.gameBlueprint = bp("모험", "재밌는 게임 만들어 줘.", "여관에서 범인을 찾아내자.");
    expect(isMysteryBlueprint(project)).toBe(true);
  });

  it("자리표시 시작 맵 은퇴는 막는 삭제가 아니다 — 그 맵 안의 것을 지운 삭제는 그대로 막는다", () => {
    const level = (what: string) => parseAdvisorReply(JSON.stringify({ claims: [], removals: [{ what, mentioned: false }], unreachable: [], missing: [], notes: [] })).notes[0]!.level;
    expect(level("빈 맵 삭제")).toBe("aside");
    expect(level("맵 「빈 맵」(map_blank_start) 삭제")).toBe("aside");
    expect(level("빈 맵에 있던 촌장 NPC 삭제")).toBe("blocker");
    expect(level("여관 주인 이벤트 삭제")).toBe("blocker");
  });

  it("세계를 고르는 요청은 무엇이든 좋다는 요청과 모험·RPG 요청뿐이다", () => {
    for (const ok of ["재밌는 게임 만들어 줘.", "게임 하나 만들어 줘", "판타지 RPG 게임 하나 만들어 줘.", "용사가 마왕을 물리치는 게임", "make me a fun game"]) expect(fitsAnyWorld(ok)).toBe(true);
    for (const no of ["저택에서 탈출하는 게임 만들어 줘", "탐정 게임 하나 만들어 줘", "카페 경영 게임 만들어 줘", "농장 게임"]) expect(fitsAnyWorld(no)).toBe(false);
    const project = createBlankProject();
    for (let i = 0; i < 20; i++) for (const no of ["저택에서 탈출하는 게임 만들어 줘", "탐정 게임 하나 만들어 줘", "카페 경영 게임 만들어 줘"]) expect(pickWorld(project, key(i), no)).toBeUndefined();
  });

  it("버들항 세계는 집·여관을 실내 종류로 받고, 메우기는 실내 이름을 실내 종류로 메운다", () => {
    const beodeul = worldById("beodeul")!;
    expect(worldKind(beodeul, "inn")?.indoor).toBe(true);
    const fixed = repairWorldPlaces({ places: [{ name: "강가 마을", kind: "village" }, { name: "촌장의 집", kind: "interior" }, { name: "여관", kind: "tavern-room" }], steps: steps(["강가 마을", "대장간 안"]) }, beodeul);
    for (const name of ["촌장의 집", "여관", "대장간 안"]) expect(worldKind(beodeul, fixed.places.find((p) => p.name === name)!.kind)?.indoor).toBe(true);
  });
});
