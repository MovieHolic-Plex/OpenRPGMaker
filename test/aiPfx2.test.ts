import { describe, expect, it } from "vitest";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import { isPassable } from "@/project/collision";
import type { ToolContext } from "@/editor/tools/types";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { withTodoLoop } from "@/ai/v2/loop/todoTools";
import { V2Session } from "@/ai/v2/turn/session";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { builderFor } from "@/ai/v2/place/builders";
import { ROOM_PROGRAM_TOOL, pickWorldDoor, worldById, worldKind, worldPlaceSpec } from "@/ai/v2/place/world";
import { walkGame } from "@/ai/v2/story/makeGame";
import { transfersOut } from "@/ai/v2/judge/todoCheckFacts";
import { pickVillageChipset } from "@/ai/villageChipsetPool";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { normalizeGameBlueprint, normalizeStepText } from "@/project/gameBlueprint";
import { refreshObjectiveRoutes } from "@/ai/v2/judge/objectiveRoutes";
import { objectiveGaps } from "@/ai/v2/judge/discoverability";
import { fillStaleObjectives } from "@/ai/v2/story/shipObjectiveDefaults";
import { dropWrongPrerequisiteLinesIn } from "@/ai/v2/story/blueprintPathGates";
import type { GameEvent, Project, GameMap } from "@/project/types";
import { isEntranceArt } from "@/ai/v2/place/entrances";
import { drawnThings, onDrawnThing, thingMatch } from "@/ai/v2/place/fixtures";
import { incomingLandings } from "@/ai/v2/place/where";
import { wallDoorKits } from "@/ai/v2/place/wallDoors";
import { isDoorEvent } from "@/ai/v2/judge/eventReach";
import { finishStepOnBossVictoryIn } from "@/ai/v2/story/blueprintPathBattles";
import { MIN_BLUEPRINT_PLACES, MIN_BLUEPRINT_STEPS, thinBlueprintReason } from "@/ai/v2/story/blueprint";
import { oneProjectGame } from "@/ai/v2/request/readers";
import { isolateTimers } from "./mergedTeardown";

// 전국·에도의 실내 종류 — 2026-11-12 Haiku 판: 프로젝트가 전국·에도 칩셋을 뽑았는데 그 세계 표에는 바깥 종류 여섯뿐이라
// «촌장 집» 이 «실내 종류 없음» 으로 거절되고 턴이 질문으로 끝났다. 그림은 있었다(다다미 실내 · 손으로 짠 방 견본 15 · 방 구성 7) — 빠진 것은 선언이었다.
// 방 구성 여섯(농가·마치야·여관 1층·무가 저택·도장·성 알현실)을 방 구성 도구(build_hand_interior_room, layout.program)로 짓는 실내 종류로 싣는다.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다). 같은 값의 실측은 scripts/qa/assistant-v2/worldHouseMatrix.mts 와 PR 본문.
describe("aiV2SengokuRooms", () => {
  isolateTimers();
  const SLOW = 120_000;
  const ROOMS = ["farmhouse", "townhouse", "inn", "samurai-house", "dojo", "castle-hall"] as const;
  /** todoLoop = false: 할 일 고리 없이 동사만(게임 전체 길 — write_blueprint · build_places 는 할 일 목록을 기다리지 않게). */
  function turn(task: string, projectKey?: string, todoLoop = true) {
    const project = createBlankProject();
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project, ...(projectKey ? { projectKey } : {}) } as never, emit: () => {}, record: () => {}, checkpoint: async () => {},
      sideChat: async () => JSON.stringify({ imagesSeen: 0, axes: {}, score: 7, majors: [] }), render: async () => "",
      preferToolNextTurn: () => {}, clearToolPreference: () => {} } as unknown as PiAssistantV2Env;
    const session = new V2Session();
    const verbs = createV2Tools(env, session);
    const tools = todoLoop ? withTodoLoop(env, session.todo, session.loop, verbs, session.hooks) : verbs;
    const call = async (name: string, args: unknown): Promise<string> => tools.find((t) => t.name === name)!.execute(`c-${name}`, args)
      .then((r) => (r.content as { type: string; text?: string }[]).filter((c) => c.type === "text").map((c) => c.text ?? "").join("\n"), (e: Error) => `THROW ${e.message}`);
    return { ctx, call };
  }
  describe("전국·에도 세계 표의 실내 종류", () => {
    const world = worldById("sengoku_edo")!;

    it("방 구성 여섯이 실내 종류다 — 모두 방 구성 도구로 짓고, 살림집은 농가다", () => {
      const indoor = world.kinds.filter((k) => k.indoor);
      expect(indoor.map((k) => k.id)).toEqual([...ROOMS]);
      for (const k of indoor) {
        expect(k.compose?.tool).toBe(ROOM_PROGRAM_TOOL);
        expect(k.door).toBeInstanceOf(RegExp);
        expect(k.danger).toBeUndefined();
      }
      expect(indoor.filter((k) => k.home).map((k) => k.id)).toEqual(["farmhouse"]);
      // 방 구성 이름(layout.program) — src/assets/sengokuEdoRoomTemplates.json programs.
      expect(indoor.map((k) => k.compose!.value)).toEqual(["minka", "machiya", "ryokan-1f", "samurai-house", "dojo", "castle-hall"]);
    });

    it("방은 제 건물 문에 달린다 — 농가는 농가·곳간, 여관은 여관·온천, 알현실은 천수각", () => {
      const doors = [{ kit: "se-machiya-a 마치야" }, { kit: "se-chaya 찻집" }, { kit: "se-onsen 온천" }, { kit: "se-minka 농가" }, { kit: "se-castle-keep 천수각" }, { kit: "se-dojo 도장" }, { kit: "se-samurai-house 무가 저택" }];
      const at = (kind: string) => pickWorldDoor(world, worldKind(world, kind)!, doors)?.kit;
      expect(at("farmhouse")).toContain("minka");
      expect(at("townhouse")).toContain("machiya");
      expect(at("inn")).toContain("onsen");
      expect(at("samurai-house")).toContain("samurai-house");
      expect(at("dojo")).toContain("dojo");
      expect(at("castle-hall")).toContain("castle-keep");
      // 제 문이 없으면 다른 종류가 찜하지 않은 문(찻집 — 곳간도 아무도 찜하지 않는다).
      expect(pickWorldDoor(world, worldKind(world, "farmhouse")!, doors.filter((d) => !d.kit.includes("minka")))?.kit).toContain("chaya");
      expect(pickWorldDoor(world, worldKind(world, "farmhouse")!, [{ kit: "se-kura 곳간" }, { kit: "se-minka-small 작은 농가" }])?.kit).toContain("minka-small");
    });

    it("여섯 종류 모두 세계 빌더가 짓는다 — 전국·에도 칩셋의 실내 맵이고, 들어오는 칸은 맨 아래 출입구 틈이다", () => {
      for (const id of ROOMS) {
        const kind = worldKind(world, id)!;
        const blank = createBlankProject();
        const ctx: ToolContext = { project: blank, currentMapId: blank.startMapId, assistantRun: true };
        const run = createBuildRun(ctx);
        const spec = { ...worldPlaceSpec(world, kind, kind.ko), salt: 1 };
        const builder = builderFor(spec)!;
        expect(builder.id, id).toBe("world");
        const built = builder.build(run, spec);
        expect(built.ok, `${id}: ${built.summary}`).toBe(true);
        const map = run.ctx.project.maps[built.mapIds[0]!]!;
        expect(map.tilesetId, id).toBe("sengoku_edo");
        expect((map as { climate?: { mode?: string } }).climate?.mode, id).toBe("indoor");
        expect(map.name, id).toBe(kind.ko);
        // 세는 맵(100칸 이상) — 방 구성이 정한 크기 그대로.
        expect(map.width * map.height, id).toBeGreaterThanOrEqual(100);
        const e = built.entrance!;
        expect(e.y, id).toBe(map.height - 1);
        expect(isPassable(run.ctx.project, map, e.x, e.y), id).toBe(true);
      }
    }, SLOW);
  });
  describe("전국·에도 마을 뒤의 «촌장 집»", () => {
    it("농가 안으로 서고 마을 집 문에 양쪽으로 이어진다 — 걸어 들어갔다 나온다", async () => {
      // 칩셋 풀은 프로젝트 열쇠로 고른다 — 전국·에도가 뽑히는 열쇠를 찾아 그 프로젝트로 돈다.
      const task = "작은 마을이랑 촌장 집 안을 만들어 줘.";
      const key = Array.from({ length: 400 }, (_, k) => `key-${k}`).find((k) => pickVillageChipset(createBlankProject(), k, task)?.entry.tilesetId === "sengoku_edo");
      expect(key, "전국·에도가 뽑히는 열쇠").toBeTruthy();
      const t = turn(task, key);
      await t.call("todo", { op: "init", list: [{ phase: "장소", items: [
        { content: "마을 만들기", id: "v", check: { kind: "place", name: "새벽 마을", placeKind: "village", fresh: true } },
        { content: "촌장 집 만들기", id: "house", check: { kind: "place", name: "촌장 집", placeKind: "interior", fresh: true } }] }] });
      await t.call("make_place", { type: "village", name: "새벽 마을", size: "small" });
      const home = await t.call("make_place", { type: "interior", name: "촌장 집", mapId: "" });
      const project = t.ctx.project;
      const village = Object.values(project.maps).find((m) => m.name === "새벽 마을")!;
      const house = Object.values(project.maps).find((m) => m.name === "촌장 집");
      expect(village.tilesetId).toBe("sengoku_edo");
      expect(house, home.slice(0, 600)).toBeTruthy();
      expect(house!.tilesetId).toBe("sengoku_edo");
      expect([house!.width, house!.height]).toEqual([11, 15]);
      expect(home).toContain("«farmhouse» kind");
      expect(home).toMatch(/linked both ways with «새벽 마을»/u);
      expect(home).not.toMatch(/has no indoor place kind/u);
      // 다른 실내 종류는 같은 이름으로 다시 부르는 화풍으로 알려 준다.
      expect(home).toContain("world:sengoku_edo:townhouse");
      expect(transfersOut(village).some((x) => x.to.mapId === house!.id)).toBe(true);
      expect(transfersOut(house!).some((x) => x.to.mapId === village.id)).toBe(true);
      const walk = walkGame(project, [village.id, house!.id]);
      expect(walk.unreached).toEqual([]);
      expect(walk.noWayBack).toEqual([]);

      // 결과 글이 이른 길: 다른 이름 + 그 세계의 실내 종류 화풍 → 그 종류로 서고 집 문에 이어진다(전에는 «칸 배치를 설계하라» 로 돌아왔다).
      const shop = await t.call("make_place", { type: "interior", name: "쌀가게 안채", style: "world:sengoku_edo:townhouse" });
      const after = t.ctx.project;
      const store = Object.values(after.maps).find((m) => m.name === "쌀가게 안채");
      expect(store, shop.slice(0, 600)).toBeTruthy();
      expect([store!.width, store!.height]).toEqual([11, 14]);
      expect(shop).toContain("«townhouse» kind");
      expect(shop).toMatch(/linked both ways with «새벽 마을»/u);
      const walk2 = walkGame(after, Object.keys(after.maps));
      expect(walk2.unreached).toEqual([]);
      expect(walk2.noWayBack).toEqual([]);

      // 이미 선 방·마을에 다른 종류를 적어 오면 다시 짓지 않는다 — 맵 수가 그대로다(전에는 같은 이름의 마을이 한 장 더 섰다).
      const count = Object.keys(after.maps).length;
      const again = await t.call("make_place", { type: "interior", name: "촌장 집", style: "world:sengoku_edo:townhouse" });
      expect(again).toMatch(/already stands as the «farmhouse» kind/u);
      expect(again).toContain("not rebuilt as another kind");
      const restyle = await t.call("make_place", { type: "village", name: "새벽 마을", style: "world:sengoku_edo:castle-town" });
      expect(restyle).toMatch(/«새벽 마을» already stands in Sengoku · Edo Japan/u);
      expect(Object.keys(t.ctx.project.maps).length).toBe(count);
    }, SLOW);
  });
  describe("build_places — 전국·에도 게임의 바깥과 방", () => {
    it("바깥 다섯과 방 여섯이 한 칩셋으로 서고, 시작에서 왕복으로 닿고, 방은 제 건물 문에 달린다", async () => {
      const t = turn("전국시대 일본에서 벌어지는 게임 하나 만들어 줘.", '["project","p1"]', false);
      const places = [
        { name: "논두렁 마을", kind: "village" }, { name: "촌장 집", kind: "farmhouse" }, { name: "성 아랫마을", kind: "castle-town" }, { name: "쌀가게 안채", kind: "townhouse" },
        { name: "역참 거리", kind: "inn-street" }, { name: "달맞이 여관", kind: "inn" }, { name: "무가 저택 뜰", kind: "samurai" }, { name: "저택 안채", kind: "samurai-house" },
        { name: "검술 도장", kind: "dojo" }, { name: "산성", kind: "castle" }, { name: "알현실", kind: "castle-hall" },
      ];
      const KINDS = [{ kind: "talk", who: "촌장 겐" }, { kind: "find" }, { kind: "choice", who: "행상 오하루" }, { kind: "puzzle" }, { kind: "battle", who: "성문 무사" }, { kind: "find" }] as const;
      const steps = places.map((pl, i) => {
        const k = KINDS[i % KINDS.length]!;
        return { id: `s${i + 1}`, place: pl.name, feeling: "호기심", gives: i === places.length - 1 ? "엔딩" : `단서 ${i + 1}`, ...k,
          event: "who" in k ? k.who : k.kind === "puzzle" ? `${pl.name}의 번호 자물쇠` : `${pl.name}의 낡은 상자`,
          action: k.kind === "battle" ? "무사와 싸워 이긴다" : k.kind === "puzzle" ? "번호를 맞춘다" : "단서를 찾는다" };
      });
      const wrote = JSON.parse(await t.call("write_blueprint", { title: "에도 시험", genre: "모험", playerGoal: "단서를 따라 산성 알현실까지 가자.", places, steps, ending: { name: "끝", how: "끝났다.", feeling: "안도" } })) as { ok?: boolean; summary?: string };
      expect(wrote.ok, wrote.summary).toBe(true);
      const built = JSON.parse(await t.call("build_places", {})) as { ok?: boolean; summary?: string };
      expect(built.ok, built.summary).toBe(true);
      const project = t.ctx.project;
      const maps = places.map((p) => Object.values(project.maps).find((m) => m.name === p.name));
      expect(maps.every(Boolean)).toBe(true);
      expect(new Set(Object.values(project.maps).map((m) => m.tilesetId))).toEqual(new Set(["sengoku_edo"]));
      expect(project.maps[project.startMapId]?.name).toBe("논두렁 마을");
      const walk = walkGame(project, maps.map((m) => m!.id));
      expect(walk.unreached).toEqual([]);
      expect(walk.noWayBack).toEqual([]);
      // 알현실은 산성의 천수각 문, 도장·저택 안채는 무가 저택 뜰의 문에서 들어간다(그 건물은 그 바깥 종류에만 선다).
      const into = (from: string, to: string) => transfersOut(maps[places.findIndex((p) => p.name === from)]!).some((x) => x.to.mapId === maps[places.findIndex((p) => p.name === to)]!.id);
      expect(into("산성", "알현실")).toBe(true);
      expect(into("무가 저택 뜰", "검술 도장")).toBe(true);
      expect(into("무가 저택 뜰", "저택 안채")).toBe(true);
    }, SLOW);
  });
});

describe("aiV2StoryCoherence", () => {
  isolateTimers();
  // 2026-11-11 눈가림 플레이(fun-x1-gatefix · fun-w3): 잠김 글이 틀린 선행 조건을 말하고(«수호자의 시험을 먼저» — 수호자는 이미 이겼다),
  // 목표 글과 꼬리의 대상이 다르고(«번호 쪽지를 살펴보자 → 별의 봉인»), 곁 퀘스트의 도착 칸이 본편 목표 줄을 덮어썼다.
  // 재는 법(모델 없음): scripts/qa/assistant-v2/storyCoherenceProbe.mts. 문서 openwiki/assistant-v2.md 「잠김 글·목표 대상은 실제 조건에서 나온다」.

  const SLOW = 120_000;
  const task = "밤의 학교를 탐험하는 게임 하나 만들어 줘.";
  function harness() {
    const project = createBlankProject();
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const env: PiAssistantV2Env = { ctx, request: { task, provider: "local-cli:claude", mapIds: [], project } as never, emit: () => {}, record: () => {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {} };
    const tools = createV2Tools(env, new V2Session());
    const call = async (name: string, args: unknown): Promise<{ ok?: boolean; summary?: string }> => {
      const res = await tools.find((t) => t.name === name)!.execute(`c-${name}`, args);
      const text = (res.content as { type: string; text?: string }[]).find((c) => c.type === "text")!.text!;
      try { return JSON.parse(text.split("\n[")[0]!) as { ok?: boolean; summary?: string }; } catch { return { ok: false, summary: text }; }
    };
    const eventOf = (name: string) => Object.values(ctx.project.maps).flatMap((m) => m.events).find((e) => e.name === name);
    return { ctx, call, eventOf };
  }
  const SPOTS = ["현관", "복도", "교실", "도서실", "옥상 계단", "옥상"];
  const blueprint = {
    title: "밤의 학교", genre: "모험", playerGoal: "밤의 학교에서 단서를 따라 옥상까지 가자.", ending: { name: "새벽", how: "해가 뜨고 문이 열렸다.", feeling: "안도" },
    steps: [
      { id: "s1", kind: "talk", who: "촌장 하르", place: SPOTS[0], event: "촌장 하르", action: "촌장에게 사정을 듣는다", gives: "촌장의 부탁", feeling: "걱정" },
      { id: "s2", kind: "find", place: SPOTS[1], event: "낡은 일지", action: "일지를 읽는다", needs: "촌장의 부탁", gives: "일지의 기록", feeling: "호기심" },
      { id: "s3", kind: "choice", who: "떠돌이 상인 미라", place: SPOTS[2], event: "떠돌이 상인 미라", action: "상인에게서 고른다", needs: "일지의 기록", gives: "상인의 물건", feeling: "설렘" },
      { id: "s4", kind: "battle", who: "얼음 문지기", place: SPOTS[3], event: "얼음 문지기", action: "문지기를 이긴다", needs: "상인의 물건", gives: "문지기 격파", feeling: "긴장" },
      { id: "s5", kind: "puzzle", place: SPOTS[4], event: "별의 봉인", action: "기록의 숫자로 봉인을 연다", needs: "문지기 격파", gives: "봉인 해제", feeling: "발견" },
      { id: "s6", kind: "talk", who: "별의 정령", place: SPOTS[5], event: "별의 정령", action: "정령에게 소원을 빈다", needs: "봉인 해제", gives: "엔딩", feeling: "안도" },
    ],
  };
  /** 번호를 두 단계 앞(일지)에서 알려 주는 판과 어디서도 알려 주지 않는 판. */
  const stepText = (told: boolean) => [
    { id: "s1", lines: ["어서 오게. 밤마다 종이 저절로 울린다네."] },
    { id: "s2", lines: told ? ["(낡은 일지에 적혀 있다. 봉인을 여는 숫자는 4826.)"] : ["(낡은 일지에는 종탑 이야기가 적혀 있다.)"] },
    { id: "s3", lines: ["뭘로 하시겠어요?"], choices: [{ text: "등불을 산다", lines: ["밤길엔 등불이죠."], later: "등불이 길을 밝혔다." }, { text: "지도를 산다", lines: ["길을 잃진 않겠네요."], later: "지도 덕에 지름길로 왔다." }] },
    { id: "s4", lines: ["여기부터는 못 지나간다."], winLines: ["(문지기가 얼음 속으로 물러난다.)"], doneLines: ["(얼음 조각만 남아 있다.)"] },
    { id: "s5", lines: ["(별 모양 홈에 숫자를 맞추자.)"], lockedLines: ["(문지기의 시험을 먼저 통과해야 한다.)"], ...(told ? { code: "4826" } : {}) },
    { id: "s6", lines: ["네 소원을 들려다오."] },
  ];
  const bodies = (event: GameEvent | undefined, page: number): string[] => ((event?.pages?.[page]?.commands ?? []) as { kind: string; body?: string }[]).filter((c) => c.kind === "text").map((c) => c.body ?? "");
  describe("잠김 글은 실제 조건에서 나온다", () => {
    it("번호를 앞선 단계 어디서든 알려 줬으면 같은 번호의 쪽지를 끼우지 않는다 — 자물쇠의 조건은 청사진의 needs 그대로", async () => {
      const { call, eventOf } = harness();
      if (!(await call("write_blueprint", blueprint)).ok) expect((await call("write_blueprint", blueprint)).ok).toBe(true);
      const built = await call("build_blueprint_path", { steps: stepText(true) });
      expect(built.ok).toBe(true);
      expect(built.summary).not.toContain("번호 쪽지");
      expect(eventOf("번호 쪽지")).toBeUndefined();
      // 조건이 청사진 그대로(문지기 격파)라 모델이 그 조건을 보고 쓴 잠김 글을 쓴다.
      expect(bodies(eventOf("별의 봉인"), 0)).toEqual(["(문지기의 시험을 먼저 통과해야 한다.)"]);
    }, SLOW);

    it("함수가 단서 고리를 끼워 조건을 바꿨으면 모델의 잠김 글을 쓰지 않는다 — 조건에서 지은 글만", async () => {
      const { call, eventOf } = harness();
      if (!(await call("write_blueprint", blueprint)).ok) expect((await call("write_blueprint", blueprint)).ok).toBe(true);
      expect((await call("build_blueprint_path", { steps: stepText(false) })).ok).toBe(true);
      // 봉인의 조건은 이제 쪽지다 — «문지기의 시험» 을 말하지 않는다. 문지기에 걸린 것은 쪽지 쪽이다.
      expect(eventOf("번호 쪽지")).toBeDefined();
      expect(bodies(eventOf("별의 봉인"), 0).join(" ")).not.toContain("문지기");
      expect(bodies(eventOf("별의 봉인"), 0)[0]).toContain("번호");
      // 쪽지의 잠김 글은 앞 단계의 상대를 가리키지 않는다(어디로 갈지는 목표 줄의 일) — 깃발 이름(«문지기 격파»)도 화면에 내지 않는다.
      expect(bodies(eventOf("번호 쪽지"), 0).length).toBeGreaterThan(0);
      expect(bodies(eventOf("번호 쪽지"), 0).join(" ")).not.toContain("문지기");

    }, SLOW);

    it("단계 이벤트의 글과 목표 줄에 설계 칸(action · needs · gives · feeling)이 나오지 않는다 — 물건은 item 으로 소지품에 들어간다", async () => {
      const { ctx, call, eventOf } = harness();
      if (!(await call("write_blueprint", blueprint)).ok) expect((await call("write_blueprint", blueprint)).ok).toBe(true);
      const text = stepText(true).map((t) => (t.id === "s3" ? { ...t, item: "은빛 등불", goal: "상인 미라에게서 밤길에 쓸 것을 고르자" } : t));
      expect((await call("build_blueprint_path", { steps: text })).ok).toBe(true);
      // 화면에 나가는 글만 모은다: 대사 본문과 목표 줄.
      const lines: string[] = [];
      const collect = (node: unknown): void => {
        if (Array.isArray(node)) { node.forEach(collect); return; }
        if (!node || typeof node !== "object") return;
        const c = node as { kind?: string; body?: unknown; fields?: { surface?: unknown; message?: unknown } };
        if (c.kind === "text" && typeof c.body === "string") lines.push(c.body);
        if (c.fields?.surface === "objectiveChip") lines.push(String(c.fields.message ?? ""));
        Object.values(c).forEach(collect);
      };
      collect(Object.values(ctx.project.maps).flatMap((m) => m.events).map((e) => e.pages));
      const shown = lines.join("\n");
      for (const step of blueprint.steps) {
        expect(shown, `${step.id} action`).not.toContain(step.action);
        expect(shown, `${step.id} feeling`).not.toContain(`${step.feeling}…`);
        // 깃발 이름은 화면에 없다 — 물건 이름인 gives 가 소지품 이름(『…』)으로 나오는 것만 예외다(마지막 단계의 「엔딩」 은 낱말이 흔해 빼고 본다).
        if (step.gives !== "엔딩") expect(shown.replaceAll(`『${step.gives}』`, ""), `${step.id} gives`).not.toContain(step.gives);
      }
      expect(shown).not.toContain("알아냈다");
      expect(shown).not.toContain("있어야 할 것 같다");
      // 목표 줄: 모델이 쓴 goal 이 있으면 그것, 없으면 사람·물건 이름으로 지은 줄.
      expect(shown).toContain("상인 미라에게서 밤길에 쓸 것을 고르자");
      expect(shown).toContain("낡은 일지를 살펴보자");
      expect(shown).toContain("얼음 문지기를 쓰러뜨리자");
      // 건네는 물건은 실제 소지품이고, 다음 단계(문지기)가 그 물건을 확인한다.
      const lamp = ctx.project.database.items.find((item) => item.name === "은빛 등불");
      expect(lamp).toBeDefined();
      expect(JSON.stringify(eventOf("떠돌이 상인 미라")?.pages)).toContain(`"kind":"changeItem","itemId":"${lamp!.id}"`);
      expect(JSON.stringify((eventOf("얼음 문지기")?.pages ?? []).map((p) => p.conditions))).toContain(`"itemId":"${lamp!.id}"`);
    }, SLOW);

    it("앞선 빌드가 남긴 «다른 단계를 먼저 하라» 는 잠김 줄을 뺀다", () => {
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      const page = (commands: unknown[], conditions: unknown[] = []) => ({ id: `p${Math.random()}`, trigger: { kind: "action" }, priority: "same", graphic: {}, conditions, commands });
      map.events.push({ id: "ev_note", name: "번호 쪽지", x: 2, y: 2, pages: [page([{ kind: "text", body: "4826" }, { kind: "setSwitch", switchId: "sw_note", value: true }])] } as never);
      map.events.push({ id: "ev_seal", name: "별의 봉인", x: 4, y: 2, pages: [page([{ kind: "text", body: "(수호자의 시험을 먼저 통과해야 한다.)" }, { kind: "text", body: "먼저 「번호 쪽지」를 살펴보자." }]), page([{ kind: "setSwitch", switchId: "sw_open", value: true }], [{ kind: "switch", switchId: "sw_note", value: true }])] } as never);
      project.gameBlueprint = normalizeGameBlueprint({ title: "t", genre: "모험", playerGoal: "g", ending: { name: "끝", how: "끝", feeling: "f" }, steps: [
        { id: "s1", kind: "battle", who: "모래 수호자", place: map.name, event: "모래 수호자", action: "이긴다", gives: "격파", feeling: "f" },
        { id: "s2", kind: "puzzle", place: map.name, event: "별의 봉인", action: "연다", needs: "격파", gives: "엔딩", feeling: "f" },
      ] });
      expect(dropWrongPrerequisiteLinesIn(project)).toHaveLength(1);
      expect(bodies(map.events.find((e) => e.id === "ev_seal"), 0)).toEqual(["먼저 「번호 쪽지」를 살펴보자."]);
      expect(dropWrongPrerequisiteLinesIn(project)).toEqual([]);
    });
  });
  describe("목표의 대상은 글이 이름을 댄 것이다", () => {
    const chip = (message: string) => ({ kind: "m2Command", commandId: "m2-214-ui-command", fields: { surface: "objectiveChip", message, durationMs: 0 } });
    const page = (commands: unknown[], extra: object = {}) => ({ id: `p${Math.random()}`, trigger: { kind: "action" }, priority: "same", graphic: {}, conditions: [], commands, ...extra });

    it("꼬리를 다시 쓸 때 다음 청사진 단계가 아니라 글이 «…를» 로 부른 이벤트를 가리킨다", () => {
      const project = createBlankProject() as Project;
      const first = project.maps[project.startMapId]!;
      const room = { ...structuredClone(first), id: "map_b", name: "별의 방", events: [] as GameEvent[] };
      project.maps[room.id] = room as never;
      first.events.push({ id: "ev_door", name: "문", x: 5, y: 5, pages: [page([{ kind: "transfer", mapId: "map_b", x: 3, y: 3 }])] } as never);
      first.events.push({ id: "ev_guard", name: "모래 수호자", x: 8, y: 8, pages: [page([{ kind: "setSwitch", switchId: "sw_a", value: true }, chip("번호 쪽지를 살펴보자 (별의 방 입구: 동쪽 → 별의 봉인)")])] } as never);
      room.events.push({ id: "ev_note", name: "번호 쪽지", x: 4, y: 4, pages: [page([{ kind: "text", body: "4826" }])] } as never);
      room.events.push({ id: "ev_seal", name: "별의 봉인", x: 6, y: 4, pages: [page([{ kind: "text", body: "봉인" }])] } as never);
      project.gameBlueprint = normalizeGameBlueprint({ title: "t", genre: "모험", playerGoal: "g", ending: { name: "끝", how: "끝", feeling: "f" }, steps: [
        { id: "s1", place: first.name, event: "모래 수호자", action: "이긴다", gives: "격파", feeling: "f" },
        { id: "s2", place: "별의 방", event: "별의 봉인", action: "연다", needs: "격파", gives: "엔딩", feeling: "f" },
      ] });
      expect(refreshObjectiveRoutes(project)).toBe(1);
      const message = JSON.stringify(first.events.find((e) => e.id === "ev_guard"));
      expect(message).toContain("→ 번호 쪽지)");
      expect(message).not.toContain("→ 별의 봉인)");
    });

    it("곁 퀘스트의 진행 페이지는 본편 이정표가 아니다 — 목표를 걸지 않고, 걸려 있던 «찾아가자» 는 뗀다", () => {
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      (project as unknown as { quests: unknown[] }).quests = [{ key: "q_x", title: "곁 일", giver: { mapId: map.id, eventId: "ev_giver" }, steps: [{ kind: "reach", label: "가기", mapId: map.id, x: 3, y: 3 }] }];
      map.events.push({ id: "ev_start", name: "시작", x: 1, y: 1, pages: [{ ...page([chip("나지라에게 묻자"), { kind: "setSelfSwitch", key: "A", value: true }]), trigger: { kind: "auto" } }, page([], { conditions: [{ kind: "selfSwitch", key: "A", value: true }] })] } as never);
      map.events.push({ id: "ev_giver", name: "하산", x: 2, y: 2, pages: [
        page([{ kind: "setSwitch", switchId: "sw_q_x_started", value: true }]),
        page([{ kind: "fork", condition: { kind: "switch", switchId: "sw_q_x_step0", value: true }, then: [{ kind: "setSwitch", switchId: "sw_q_x_done", value: true }] }], { conditions: [{ kind: "switch", switchId: "sw_q_x_started", value: true }] }),
        page([{ kind: "text", body: "고맙네" }], { conditions: [{ kind: "switch", switchId: "sw_q_x_done", value: true }] }),
      ] } as never);
      map.events.push({ id: "ev_q_x_reach0", x: 3, y: 3, pages: [{ ...page([{ kind: "setSwitch", switchId: "sw_q_x_step0", value: true }, chip("「하산」을 찾아가자")], { conditions: [{ kind: "switch", switchId: "sw_q_x_started", value: true }] }), trigger: { kind: "playerTouch" }, priority: "below", graphic: { transparent: true } }] } as never);
      expect(objectiveGaps(project).filter((gap) => gap.includes("다음 목표를 바꾸지 않는다"))).toEqual([]);
      const notes = fillStaleObjectives(project);
      expect(notes.some((note) => note.includes("ev_q_x_reach0"))).toBe(true);
      expect(JSON.stringify(map.events.find((e) => e.id === "ev_q_x_reach0"))).not.toContain("objectiveChip");
      expect(JSON.stringify(map.events.find((e) => e.id === "ev_giver"))).not.toContain("objectiveChip");
      // 본편 시작 목표는 그대로.
      expect(JSON.stringify(map.events.find((e) => e.id === "ev_start"))).toContain("나지라에게 묻자");
    });

    it("단계 목표 줄을 걸 때 같은 사람의 곁 의뢰 수락·완료 페이지에는 남기지 않는다 — 명세 은행 r5a-river", () => {
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      (project as unknown as { quests: unknown[] }).quests = [{ key: "q_mill", title: "멈춘 물레방아", giver: { mapId: map.id, eventId: "ev_han" }, steps: [{ kind: "talk", label: "어부에게", target: { mapId: map.id, eventId: "ev_fisher" } }] }];
      map.events.push({ id: "ev_start", name: "시작", x: 1, y: 1, pages: [{ ...page([chip("한씨에게 말을 걸자"), { kind: "setSelfSwitch", key: "A", value: true }]), trigger: { kind: "auto" } }, page([], { conditions: [{ kind: "selfSwitch", key: "A", value: true }] })] } as never);
      map.events.push({ id: "ev_han", name: "한씨", x: 2, y: 2, pages: [
        page([{ kind: "text", body: "어부에게 물어보게" }, { kind: "setSwitch", switchId: "sw_heard", value: true }]),
        page([{ kind: "choices", options: [{ text: "수락", branch: [{ kind: "setSwitch", switchId: "sw_q_mill_started", value: true }] }, { text: "거절", branch: [] }] }], { conditions: [{ kind: "switch", switchId: "sw_q_mill_started", value: false }] }),
        page([{ kind: "setSwitch", switchId: "sw_q_mill_done", value: true }], { conditions: [{ kind: "switch", switchId: "sw_q_mill_started", value: true }, { kind: "switch", switchId: "sw_q_mill_step0", value: true }] }),
      ] } as never);
      map.events.push({ id: "ev_fisher", name: "어부 도윤", x: 6, y: 6, pages: [page([{ kind: "text", body: "강물이 줄었어" }], { conditions: [{ kind: "switch", switchId: "sw_heard", value: true }] }), page([{ kind: "setSwitch", switchId: "sw_q_mill_step0", value: true }], { conditions: [{ kind: "switch", switchId: "sw_q_mill_started", value: true }] })] } as never);
      project.gameBlueprint = normalizeGameBlueprint({ title: "t", genre: "모험", playerGoal: "g", ending: { name: "끝", how: "끝", feeling: "f" }, steps: [
        { id: "s1", place: map.name, event: "한씨", action: "듣는다", gives: "부탁", feeling: "f" },
        { id: "s2", place: map.name, event: "어부 도윤", action: "묻는다", needs: "부탁", gives: "엔딩", feeling: "f" },
      ] });
      fillStaleObjectives(project);
      const han = map.events.find((e) => e.id === "ev_han")!;
      expect(JSON.stringify(han.pages![0])).toContain("objectiveChip");
      expect(JSON.stringify(han.pages![1])).not.toContain("objectiveChip");
      expect(JSON.stringify(han.pages![2])).not.toContain("objectiveChip");
      // 두 번째 바퀴에도 그대로.
      fillStaleObjectives(project);
      expect(JSON.stringify(han.pages!.slice(1))).not.toContain("objectiveChip");
    });

    it("본편 이정표와 의뢰 수락을 한 페이지에 둔 사람 — 이정표 뒤 목표는 남기고 «수락한다» 갈래 안의 같은 목표는 뗀다", () => {
      const project = createBlankProject() as Project;
      const map = project.maps[project.startMapId]!;
      (project as unknown as { quests: unknown[] }).quests = [{ key: "q_mill", title: "멈춘 물레방아", giver: { mapId: map.id, eventId: "ev_han" }, steps: [{ kind: "talk", label: "어부에게", target: { mapId: map.id, eventId: "ev_fisher" } }] }];
      map.events.push({ id: "ev_start", name: "시작", x: 1, y: 1, pages: [{ ...page([chip("한씨에게 말을 걸자"), { kind: "setSelfSwitch", key: "A", value: true }]), trigger: { kind: "auto" } }, page([], { conditions: [{ kind: "selfSwitch", key: "A", value: true }] })] } as never);
      map.events.push({ id: "ev_han", name: "한씨", x: 2, y: 2, pages: [
        page([{ kind: "text", body: "어부에게 물어보게" }, { kind: "setSwitch", switchId: "sw_heard", value: true },
          { kind: "choices", options: [{ text: "수락한다", branch: [{ kind: "setSwitch", switchId: "sw_q_mill_started", value: true }, { kind: "text", body: "믿겠네" }] }, { text: "다음에", branch: [] }] }]),
      ] } as never);
      map.events.push({ id: "ev_fisher", name: "어부 도윤", x: 6, y: 6, pages: [page([{ kind: "text", body: "강물이 줄었어" }], { conditions: [{ kind: "switch", switchId: "sw_heard", value: true }] })] } as never);
      project.gameBlueprint = normalizeGameBlueprint({ title: "t", genre: "모험", playerGoal: "g", ending: { name: "끝", how: "끝", feeling: "f" }, steps: [
        { id: "s1", place: map.name, event: "한씨", action: "듣는다", gives: "부탁", feeling: "f" },
        { id: "s2", place: map.name, event: "어부 도윤", action: "묻는다", needs: "부탁", gives: "엔딩", feeling: "f" },
      ] });
      fillStaleObjectives(project);
      const top = map.events.find((e) => e.id === "ev_han")!.pages![0]!.commands as unknown as { kind: string; options?: { branch: unknown[] }[] }[];
      expect(top.filter((c) => c.kind === "m2Command")).toHaveLength(1);
      expect(JSON.stringify(top.find((c) => c.kind === "choices"))).not.toContain("objectiveChip");
    });
  });
});

describe("aiV2StoryOnPlace", () => {
  isolateTimers();
  // 2026-11-12 r1s-fun 「증기의 심장」(Sonnet 이 «재밌는 게임 만들어 줘.» 로 지은 게임, steampunk_city):
  //  (1) 단계가 쓰게 하는 물건이 그 장소의 그림과 따로 놀았다 — 「압력 밸브」는 벽의 밸브 바퀴를 두고 나무 상자에, 「대심장 정지 레버」는 맨바닥 반짝임(발밑)에.
  //  (2) 번호를 맞혀도 winLines 가 안 나왔고, 보스를 이기면 마지막 단계(레버)가 저절로 돌아 엔딩이 났다.
  //  (3) 방→방 문이 벽 곁 맨바닥 한 칸이었고, 바깥 맵의 돌아가는 칸이 열린 길 한가운데였다.
  // 재는 법(모델 없음): scripts/qa/assistant-v2/storyOnPlaceProbe.mts. 문서 openwiki/assistant-v2.md 「이야기의 물건은 그 장소의 그림이다」.
  // 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다).

  describe("이름이 그림을 가리키는 세기(thingMatch)", () => {
    const valve = { label: "벽 밸브 바퀴", kitName: "벽 밸브 바퀴", tags: ["밸브"] };
    const terminal = { label: "천공 카드 단말기", kitName: "천공 카드 단말기(놋쇠 건반·레버·다이얼 조작대)", tags: ["단말기", "조작대"] };
    it("물건 낱말(마지막 어절)이 이름표의 낱말이면 맞는 그림이다", () => {
      expect(thingMatch("압력 밸브", valve)).toBe(2);
      expect(thingMatch("벽 밸브 바퀴", valve)).toBe(3);
      expect(thingMatch("번호 쪽지", { label: "바닥의 쪽지", tags: ["쪽지", "종이", "단서"] })).toBe(2);
    });
    it("낱말이 키트 이름의 괄호 속 부품 설명에만 있으면 약하게 맞는다", () => {
      expect(thingMatch("대심장 정지 레버", terminal)).toBe(1);
    });
    it("조사(find) 단계가 세운 이벤트는 이름에 「문」이 있어도 문이 아니다 — 단계의 종류가 말한다(낱말 표에 낱말을 더하지 않는다)", () => {
      const project = createBlankProject();
      const ev = { id: "ev_chain_x_4", name: "태양의 비문", x: 1, y: 1, pages: [] } as unknown as GameEvent;
      // 청사진 밖의 이벤트는 전처럼 이름으로 읽는다.
      expect(isDoorEvent(project, ev)).toBe(true);
      // 사슬을 짓는 중(아직 청사진에 적히기 전)에는 부르는 쪽이 조사 단계의 id 를 넘긴다.
      expect(isDoorEvent(project, ev, new Set([ev.id]))).toBe(false);
      // 지은 뒤에는 청사진 단계의 종류로.
      project.gameBlueprint = { title: "t", genre: "g", playerGoal: "p", steps: [{ id: "s4", kind: "find", place: "p", event: "태양의 비문", action: "a", gives: "g", feeling: "f", built: { mapId: project.startMapId, eventId: ev.id } }], ending: { name: "e", how: "h", feeling: "f" } } as unknown as Project["gameBlueprint"];
      expect(isDoorEvent(project, ev)).toBe(false);
      // 번호 자물쇠가 달린 문(puzzle 단계)은 전처럼 문이다.
      project.gameBlueprint!.steps[0]!.kind = "puzzle";
      expect(isDoorEvent(project, { ...ev, name: "굳게 닫힌 철문" } as GameEvent)).toBe(true);
    });
    it("낱말이 없으면 아니다 — 글자 포함으로 읽지 않는다", () => {
      expect(thingMatch("감시탑 일지", valve)).toBe(0);
      expect(thingMatch("책", { label: "목책 말뚝", tags: [] })).toBe(0);
    });
  });
  describe("증기 도시 한 판 — 물건은 그림에, 단계는 차례로, 문은 그려진 자리에", () => {
    function harness() {
      const project = createBlankProject();
      const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
      const env: PiAssistantV2Env = {
        ctx, request: { task: "스팀펑크 증기 도시에서 벌어지는 게임 하나 만들어 줘.", provider: "local-cli:claude", mapIds: [], project, projectKey: '["project","story-on-place"]' } as never,
        emit: () => {}, record: () => {},
        sideChat: async () => JSON.stringify({ imagesSeen: 0, axes: {}, score: 7, majors: [] }),
        render: async () => "", checkpoint: async () => {},
      };
      const tools = createV2Tools(env, new V2Session());
      const call = async (name: string, args: unknown): Promise<{ ok?: boolean; summary?: string }> => {
        const res = await tools.find((t) => t.name === name)!.execute(`c-${name}`, args);
        return JSON.parse((res.content as { type: string; text?: string }[]).find((c) => c.type === "text")!.text!.split("\n[청사진 진행]")[0]!) as { ok?: boolean; summary?: string };
      };
      return { ctx, call };
    }
    const places = [
      { name: "황동 광장", kind: "street" }, { name: "운하 부두", kind: "dock", from: "황동 광장" }, { name: "굴뚝 공업지구", kind: "industrial", from: "운하 부두" },
      { name: "오르텐의 공방", kind: "workshop", from: "황동 광장" }, { name: "지하 보일러실", kind: "boiler-room", from: "굴뚝 공업지구" }, { name: "대심장 기관실", kind: "engine-room", from: "지하 보일러실" },
    ];
    const blueprint = {
      title: "증기의 심장", genre: "모험", setting: "steampunk_city", playerGoal: "폭주하는 대심장을 멈추자.", places,
      ending: { name: "멈춘 심장", how: "레버를 당긴다.", feeling: "안도", closing: ["대심장이 멈췄다."] },
      steps: [
        { id: "s1", kind: "talk", who: "신문팔이 핀", place: "황동 광장", event: "신문팔이 핀", action: "핀에게 소문을 듣는다", gives: "공방 소개", feeling: "호기심" },
        { id: "s2", kind: "talk", who: "오르텐 할멈", place: "오르텐의 공방", event: "오르텐 할멈", action: "오르텐에게 렌치를 받는다", needs: "공방 소개", gives: "item:황동 렌치", feeling: "신뢰" },
        { id: "s3", kind: "choice", who: "선장 바르가", place: "운하 부두", event: "선장 바르가", action: "선장에게 통행증을 받는다", needs: "item:황동 렌치", gives: "공업지구 통행증", feeling: "갈등" },
        { id: "s4", kind: "find", place: "굴뚝 공업지구", event: "감시탑 일지", action: "일지에서 번호를 읽는다", needs: "공업지구 통행증", gives: "압력 밸브 번호 단서", feeling: "긴장" },
        { id: "s5", kind: "puzzle", place: "지하 보일러실", event: "압력 밸브", action: "밸브의 번호를 맞춘다", needs: "압력 밸브 번호 단서", gives: "기관실 개방", feeling: "성취" },
        { id: "s6", kind: "battle", who: "폭주 자동인형", place: "대심장 기관실", event: "폭주 자동인형", action: "자동인형과 싸워 이긴다", needs: "기관실 개방", gives: "자동인형 정지", feeling: "위기" },
        { id: "s7", kind: "find", place: "대심장 기관실", event: "대심장 정지 레버", action: "레버를 당겨 대심장을 멈춘다", needs: "자동인형 정지", gives: "ending", feeling: "안도" },
      ],
    };
    const text = [
      { id: "s1", lines: ["대심장이 사흘째 울어 대고 있어. 오르텐 할멈을 찾아가 봐."] },
      { id: "s2", lines: ["이건 황동 렌치란다. 가져가거라."] },
      { id: "s3", lines: ["어느 쪽이냐?"], choices: [{ text: "노동자 편", lines: ["수로 통행증이다."], later: "노동자들이 당신 이름을 불렀다." }, { text: "공장주 편", lines: ["정식 통행증이다."], later: "공장은 질서를 되찾았다." }] },
      { id: "s4", lines: ["'보일러실 압력 밸브 잠금 번호는 4729.'"] },
      { id: "s5", code: "4729", lines: ["거대한 압력 밸브다."], lockedLines: ["번호를 알아야 한다."], winLines: ["철컥! 밸브가 풀리고 증기가 빠져나간다."], wrongLines: ["번호가 틀린 모양이다."] },
      { id: "s6", lines: ["침입자 배제."], winLines: ["(자동인형이 멈춰 섰다.)"] },
      { id: "s7", lines: ["황동 렌치를 레버에 끼우고 힘껏 돌렸다."] },
    ];
    const SLOW = 300_000;
    const json = (value: unknown): string => JSON.stringify(value);
    const mapOf = (project: Project, name: string): GameMap => Object.values(project.maps).find((m) => m.name === name)!;
    const stepEvent = (project: Project, id: string): { map: GameMap; ev: GameEvent } => {
      const built = project.gameBlueprint!.steps.find((st) => st.id === id)!.built!;
      const map = project.maps[built.mapId]!;
      return { map, ev: map.events.find((e) => e.id === built.eventId)! };
    };

    it("조사·퍼즐 단계의 물건은 그려진 물건 칸에 앉고, 번호를 맞히면 winLines 가 나오고, 보스 승리는 마지막 단계를 부르지 않는다", async () => {
      const { ctx, call } = harness();
      for (let i = 0; i < 4 && !ctx.project.gameBlueprint; i += 1) await call("write_blueprint", blueprint);
      expect(ctx.project.gameBlueprint?.setting).toBe("steampunk_city");
      const built = await call("build_places", {});
      expect(built.ok).toBe(true);
      // 조사·퍼즐 단계가 있는 장소의 그려진 물건 이름을 모델에게 보인다.
      expect(built.summary).toContain("Things drawn where a find/puzzle step happens");
      expect(built.summary).toContain("벽 밸브 바퀴");
      let path = await call("build_blueprint_path", { steps: text });
      if (path.ok === false) path = await call("build_blueprint_path", { steps: text });
      expect(path.ok).toBe(true);
      const project = ctx.project;

      // (1) 물건 — 「압력 밸브」는 밸브 그림에, 「대심장 정지 레버」는 그려진 물건에(맨바닥·발밑·반짝임이 아니다).
      for (const id of ["s4", "s5", "s7"]) {
        const { map, ev } = stepEvent(project, id);
        const under = onDrawnThing(project, map, ev);
        expect(under, `${id} ${ev.name} (${ev.x},${ev.y}) 는 그려진 물건 위`).toBeTruthy();
        expect((ev.pages ?? []).every((p) => (p.priority ?? "same") === "same"), `${id} 는 마주 보고 누른다`).toBe(true);
        // 이름이 맞는 그림에 앉은 단계는 반짝이지도 빛나지도 않는다 — 그림이 곧 그 물건이다.
        // 맞는 그림이 없어 가까운 물건에 앉은 단계(s4 「감시탑 일지」)는 그 물건이 늘 빛난다 — 그림만 봐서는 그 물건인 줄 모른다(정직한 플레이와 같은 눈: project/eventSight).
        const lit = (ev.pages ?? []).some((p) => !!(p as { glow?: unknown }).glow);
        if (id === "s4") expect(lit || thingMatch(ev.name ?? "", under!) > 0, "s4 는 이름이 다른 그림 위에서 빛난다").toBe(true);
        else {
          expect((ev.pages ?? []).some((p) => !!(p as { nearSparkle?: unknown }).nearSparkle), `${id} 에 반짝임이 없다`).toBe(false);
          expect(lit, `${id} 는 늘 빛나는 표지가 아니다`).toBe(false);
        }
        const stand = [[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => isPassable(project, map, ev.x + dx!, ev.y + dy!));
        expect(stand, `${id} 곁에 설 칸이 있다`).toBe(true);
      }
      const valve = stepEvent(project, "s5");
      expect(thingMatch("압력 밸브", onDrawnThing(project, valve.map, valve.ev)!)).toBeGreaterThanOrEqual(2);
      expect(thingMatch("대심장 정지 레버", onDrawnThing(project, stepEvent(project, "s7").map, stepEvent(project, "s7").ev)!)).toBeGreaterThanOrEqual(1);

      // (2) 단계 — 번호를 맞힌 갈래에 winLines, 보스(s6)는 s7 을 부르지 않고 엔딩은 s7 이 부른다.
      expect(json(valve.ev.pages)).toContain("철컥! 밸브가 풀리고 증기가 빠져나간다.");
      finishStepOnBossVictoryIn(project);
      const boss = stepEvent(project, "s6").ev, lever = stepEvent(project, "s7").ev;
      expect(json(boss.pages)).not.toContain(`"kind":"callMapEvent","eventId":"${lever.id}"`);
      expect(json(boss.pages)).not.toContain('"triggerEnding"');
      expect(json(lever.pages)).toMatch(/"kind":"(?:triggerEnding|ending)"/u);

      // (3) 문 — 다른 맵으로 가는 칸은 맵 가장자리이거나 문·계단 그림(그 칸 또는 바로 위)이고, 문 앞 칸이 열려 있다.
      for (const map of Object.values(project.maps)) for (const ev of map.events) {
        if (!/"kind":"transfer"/u.test(json(ev.pages)) || json(ev.pages).includes(`"mapId":"${map.id}"`)) continue;
        const edge = ev.x === 0 || ev.y === 0 || ev.x === map.width - 1 || ev.y === map.height - 1;
        const art = isEntranceArt(project, map, ev.x, ev.y) || isEntranceArt(project, map, ev.x, ev.y - 1);
        expect(edge || art, `${map.name} (${ev.x},${ev.y}) 이동 칸은 가장자리이거나 문·계단 그림`).toBe(true);
        const front = [[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => isPassable(project, map, ev.x + dx!, ev.y + dy!) && !map.events.some((o) => o.id !== ev.id && o.x === ev.x + dx! && o.y === ev.y + dy! && /"kind":"transfer"/u.test(json(o.pages))));
        expect(front, `${map.name} (${ev.x},${ev.y}) 문 앞이 열려 있다`).toBe(true);
      }
      // 방에서 방으로(보일러실 → 기관실)는 벽에 건 문이다 — 칩셋에 벽 문 키트(sp-room-door: 위층 타일뿐 · 칸 꼬리표 문, 입구 부품 없음)가 있으면 계단보다 먼저.
      const kitTiles = (id: string): Set<number> => new Set(((project.tilesets[mapOf(project, "지하 보일러실").tilesetId] as unknown as { structureKits: { id: string; rows: { tiles?: number[]; upperTiles?: number[] }[] }[] })
        .structureKits.find((k) => k.id === id)?.rows ?? []).flatMap((r) => [...(r.tiles ?? []), ...(r.upperTiles ?? [])]).filter((tile) => tile >= 0));
      const doorTiles = kitTiles("sp-room-door"), hatchTiles = kitTiles("sp-hatch-down");
      expect(doorTiles.size).toBe(2);
      expect(hatchTiles.size).toBe(4);
      // 벽 문으로 읽는 키트는 그것 하나다 — 건물(입구 부품만 적은 것)·바닥에 서는 문은 들지 않는다.
      expect(wallDoorKits(project, mapOf(project, "지하 보일러실")).map((k) => k.kit.id)).toEqual(["sp-room-door"]);
      const boiler = mapOf(project, "지하 보일러실"), engine = mapOf(project, "대심장 기관실");
      const toEngine = boiler.events.filter((e) => json(e.pages).includes(`"mapId":"${engine.id}"`));
      expect(toEngine.length).toBeGreaterThanOrEqual(1);
      expect(toEngine.every((e) => isEntranceArt(project, boiler, e.x, e.y))).toBe(true);
      // 문 칸은 벽면(못 걷는 칸)이고 바로 아래가 문 앞 바닥이다.
      for (const e of toEngine) {
        expect(doorTiles.has(boiler.upperTiles[e.y * boiler.width + e.x] ?? -1), `보일러실 → 기관실 (${e.x},${e.y}) 은 철문 칸`).toBe(true);
        expect(isPassable(project, boiler, e.x, e.y)).toBe(false);
        expect(isPassable(project, boiler, e.x, e.y + 1)).toBe(true);
      }
      // 땅 밑 방(종류 boiler-room 의 below)은 바깥에서 내려가는 길(sp-hatch-down: 계단 칸뿐 · …-down · 아래층 타일 없음)로 들어간다 — 보일러실 건물 문이 아니다.
      const yard = mapOf(project, "굴뚝 공업지구");
      const toBoiler = yard.events.filter((e) => json(e.pages).includes(`"mapId":"${boiler.id}"`));
      expect(toBoiler.length).toBeGreaterThanOrEqual(1);
      for (const e of toBoiler) {
        expect(hatchTiles.has(yard.upperTiles[e.y * yard.width + e.x] ?? -1), `공업지구 → 보일러실 (${e.x},${e.y}) 은 해치 칸`).toBe(true);
        expect(isPassable(project, yard, e.x, e.y)).toBe(true);
      }
      // 땅 밑이라 적지 않은 방(공방 · 기관실)은 해치로 들어가지 않는다.
      for (const map of Object.values(project.maps)) for (const e of map.events) {
        if (map.id === yard.id && toBoiler.includes(e)) continue;
        if (/"kind":"transfer"/u.test(json(e.pages))) expect(hatchTiles.has(map.upperTiles[e.y * map.width + e.x] ?? -1), `${map.name} (${e.x},${e.y})`).toBe(false);
      }
      // 적·상자는 어느 도착 칸에서든 다섯 걸음 밖이다 — 문을 길 끝으로 옮긴 뒤 옛 «들어서는 칸» 기준으로 놓인 적이 도착 칸 세 칸 곁에 섰다.
      for (const map of Object.values(project.maps)) for (const ev of map.events.filter((e) => /_wfoe\d+$|_wchest$/u.test(e.id))) {
        for (const land of incomingLandings(project, map.id)) expect(Math.abs(land.x - ev.x) + Math.abs(land.y - ev.y), `${map.name} ${ev.id} 는 도착 칸 (${land.x},${land.y}) 에서 떨어져 있다`).toBeGreaterThan(5);
      }
      // 그 장소에 그려진 물건을 읽는다 — 보일러실에는 밸브 바퀴가 있다.
      expect(drawnThings(project, boiler).some((t) => t.label.includes("밸브"))).toBe(true);
    }, SLOW);

    it("모델이 고른 그림(steps[].on)이 먼저다", async () => {
      const { ctx, call } = harness();
      for (let i = 0; i < 4 && !ctx.project.gameBlueprint; i += 1) await call("write_blueprint", blueprint);
      expect((await call("build_places", {})).ok).toBe(true);
      const picked = text.map((t) => (t.id === "s5" ? { ...t, on: "벽 압력계 묶음" } : t));
      let path = await call("build_blueprint_path", { steps: picked });
      if (path.ok === false) path = await call("build_blueprint_path", { steps: picked });
      expect(path.ok).toBe(true);
      const { map, ev } = stepEvent(ctx.project, "s5");
      expect(onDrawnThing(ctx.project, map, ev)?.label).toContain("압력계");
      // 고른 그림은 청사진에 남는다 — 함수가 경로를 다시 지을 때(끝맺음 뒤 · 다음 턴)도 읽는다.
      expect(ctx.project.gameBlueprint!.steps.find((st) => st.id === "s5")!.text?.on).toBe("벽 압력계 묶음");
      expect(normalizeStepText({ on: "  벽 밸브 바퀴 ", lines: ["x"] })).toEqual({ on: "벽 밸브 바퀴", lines: ["x"] });
    }, SLOW);
  });
});

describe("aiV2ThinBlueprint", () => {
  isolateTimers();
  const WHOLE = "닌자가 성에 잠입하는 게임";
  const step = (id: string, place: string, event: string) => ({ id, place, event, action: "살핀다", gives: `${id} 단서`, feeling: "긴장" });
  // 단계 종류를 섞는다(사람 둘·싸움·번호 자물쇠) — 전부 «살펴본다» 인 초안은 종류 검사(stepMixProblems)가 한 번 돌려보낸다.
  const KINDS = [{ kind: "talk", who: "문지기 겐" }, { kind: "find" }, { kind: "battle", who: "그림자 무사" }, { kind: "puzzle" }, { kind: "talk", who: "하녀 유키" }, { kind: "find" }] as const;
  const args = (places: string[], count: number, kinded = true) => ({
    genre: "잠입 액션",
    playerGoal: "비밀 문서를 훔쳐 탈출한다",
    steps: Array.from({ length: count }, (_, i) => ({ ...step(`s${i + 1}`, places[i % places.length]!, `이벤트${i + 1}`), ...(kinded ? KINDS[i % KINDS.length] : {}) })),
    ending: { name: "탈출", how: "문서를 들고 성을 나선다", feeling: "안도" },
  });
  const envFor = (project: Project, task = WHOLE) => ({
    ctx: { project, currentMapId: project.startMapId, assistantRun: true }, request: { task, provider: "local-cli:claude", mapIds: [], project },
    emit() {}, record() {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {},
  }) as never;
  const write = (project: Project, session: V2Session, params: unknown, task = WHOLE) =>
    createV2Tools(envFor(project, task), session).find((t) => t.name === "write_blueprint")!.execute("a", params as never, undefined as never);
  const summaryOf = (res: unknown): string => JSON.stringify(res);
  describe("thinBlueprintReason", () => {
    it("flags one place or fewer than six steps and passes six steps over two places", () => {
      const thin = { ...createBlankProject().gameBlueprint, steps: args(["그림자 성"], 3).steps } as never;
      expect(thinBlueprintReason(thin)).toContain("그림자 성");
      const twoPlacesThreeSteps = { steps: args(["성 앞", "지하"], 3).steps } as never;
      expect(thinBlueprintReason(twoPlacesThreeSteps)).toBeTruthy();
      const ok = { steps: args(["성 앞", "지하", "천수각"], MIN_BLUEPRINT_STEPS).steps } as never;
      expect(thinBlueprintReason(ok)).toBeUndefined();
      expect(MIN_BLUEPRINT_PLACES).toBe(2);
    });
  });
  // 2026-11-16(오너 「벽을 기본값으로」): 얇은 초안·종류가 안 섞인 초안을 돌려보내지 않는다 — 건 뒤 알림으로 적는다(거절은 게임이 깨질 때만).
  describe("write_blueprint thin first draft", () => {
    it("hangs a one-place three-step first blueprint and says so as a notice, not a rejection", async () => {
      const project = createBlankProject() as Project; const session = new V2Session();
      const res = summaryOf(await write(project, session, args(["그림자 성"], 3)));
      expect(project.gameBlueprint?.steps.length).toBe(3);
      expect(res).toContain("Notice — saved as written, nothing is rejected");
      expect(res).toContain("3 step(s) over 1 place(s)");
      // 크기를 안 적은 첫 청사진은 첫 판 MVP 다(2026-11-23) — 알림은 MVP 크기(장소 2곳·단계 3)를 말한다.
      expect(project.gameBlueprint?.scale).toBe("mvp");
      expect(res).toContain("first playable version (mvp)");
    });
    it("gives no notice for a six-step three-place first blueprint", async () => {
      const project = createBlankProject() as Project; const session = new V2Session();
      const res = summaryOf(await write(project, session, args(["성 앞", "지하 통로", "천수각"], 6)));
      expect(project.gameBlueprint?.steps.length).toBe(6);
      expect(res).not.toContain("Notice — saved as written");
    });
    it("hangs a six-step draft whose steps are all examine and names the missing kinds in the notice", async () => {
      const project = createBlankProject() as Project; const session = new V2Session();
      const flat = args(["성 앞", "지하 통로", "천수각"], 6, false);
      const res = summaryOf(await write(project, session, flat));
      expect(project.gameBlueprint?.steps.length).toBe(6);
      expect(res).toContain("named");
      expect(res).toContain("no battle step");
      expect(res).toContain("3 find steps in a row");
    });
    it("a model-written scale:small and battles:false take the size and fight lines out of the notice", async () => {
      const project = createBlankProject() as Project; const session = new V2Session();
      const small = { ...args(["역 앞 상점가", "라멘집"], 4, false), scale: "small", battles: false };
      const res = summaryOf(await write(project, session, small, "짧은 이야기 게임을 만들어 줘. 전투는 없어도 돼."));
      // #4948: 새 게임의 첫 청사진은 모델이 scale:"small" 을 적어도 첫 판 MVP 로 둔다(엔딩 없음). MVP 기준(장소 2·단계 3 이상)을 넘으니
      // 크기 줄은 여전히 빠지고, battles:false 는 싸움 줄을 뺀다.
      expect(project.gameBlueprint?.scale).toBe("mvp");
      expect(project.gameBlueprint?.battles).toBe(false);
      expect(res).not.toContain("step(s) over");
      expect(res).not.toContain("no battle step");
    });
    it("gives no notice on a rewrite of an existing blueprint", async () => {
      const project = createBlankProject() as Project; const session = new V2Session();
      await write(project, session, args(["성 앞", "지하 통로", "천수각"], 6));
      const res = summaryOf(await write(project, session, args(["성 앞"], 3)));
      expect(project.gameBlueprint?.steps.length).toBe(3);
      expect(res).not.toContain("Notice — saved as written");
    });
    it("gives no notice when only the request sentence says escape room", async () => {
      const project = createBlankProject() as Project; const session = new V2Session();
      const res = summaryOf(await write(project, session, args(["작은 방"], 3), "밀실 탈출 게임 만들어 줘"));
      expect(project.gameBlueprint?.steps.length).toBe(3);
      expect(res).not.toContain("Notice — saved as written");
    });
    it("does not reject a locked-room escape game", async () => {
      const project = createBlankProject() as Project; const session = new V2Session();
      await write(project, session, args(["작은 방"], 3), "방탈출 게임 만들어 줘");
      expect(project.gameBlueprint?.steps.length).toBe(3);
      expect(oneProjectGame(project, "방탈출 게임 만들어 줘")).toBe(true);
    });
  });
});
