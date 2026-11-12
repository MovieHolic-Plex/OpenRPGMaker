// 전국·에도의 실내 종류 — 2026-11-12 Haiku 판: 프로젝트가 전국·에도 칩셋을 뽑았는데 그 세계 표에는 바깥 종류 여섯뿐이라
// «촌장 집» 이 «실내 종류 없음» 으로 거절되고 턴이 질문으로 끝났다. 그림은 있었다(다다미 실내 · 손으로 짠 방 견본 15 · 방 구성 7) — 빠진 것은 선언이었다.
// 방 구성 여섯(농가·마치야·여관 1층·무가 저택·도장·성 알현실)을 방 구성 도구(build_hand_interior_room, layout.program)로 짓는 실내 종류로 싣는다.
// 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(CI 에서 돈다). 같은 값의 실측은 scripts/qa/assistant-v2/worldHouseMatrix.mts 와 PR 본문.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
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
    // 제 문이 없으면 다른 종류가 찜하지 않은 문(찻집).
    expect(pickWorldDoor(world, worldKind(world, "farmhouse")!, doors.filter((d) => !d.kit.includes("minka")))?.kit).toContain("chaya");
  });

  it("여섯 종류 모두 세계 빌더가 짓는다 — 전국·에도 칩셋의 실내 맵이고, 들어오는 칸은 맨 아래 출입구 틈이다", () => {
    for (const id of ROOMS) {
      const kind = worldKind(world, id)!;
      const ctx: ToolContext = { project: createBlankProject(), currentMapId: "", assistantRun: true };
      ctx.currentMapId = ctx.project.startMapId;
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
