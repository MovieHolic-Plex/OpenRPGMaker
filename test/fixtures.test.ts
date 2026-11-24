import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { layoutPatchRefusal, noDesignRefusal } from "@/ai/v2/tools/placeMemory";
import { V2Session } from "@/ai/v2/turn/session";
import { buildFixture, type FixtureId } from "@/harnesses/assistant-capability/node/smallJobs/fixtures";
import type { GameMap, Project } from "@/project/types";
import type { ToolContext } from "@/editor/tools/types";
import { createV2Tools } from "@/ai/v2/tools/verbs";
import { classifyRequest } from "@/ai/v2/request/intent";
import type { PiAssistantV2Env } from "@/ai/v2/shared/env";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { resolveWhere } from "@/ai/v2/place/where";
import { buildEvent } from "@/ai/v2/story/events";
import type { EventSpec } from "@/ai/v2/shared/types";
import { isolateTimers } from "./mergedTeardown";

// 뒷문 — 2026-11-11 작은 일 재측정(door-backdoor-built, 30가지 가운데 남은 하나): 「긴 집에 뒷문을 만들어 겨울 시장으로 나가게」 를 조수는
// edit_place 의 layoutPatch 로 내려다 «전체 배치를 보내라» 는 같은 거절을 다섯 번 받고 막혔다. 앞 측정에서는 place_door 의 재료 이름을 못 맞혀 포기했다.
// 맵을 잇는 것은 create_transfer_pair 한 번이면 된다 — 막다른 거절이 그 길을 일러야 한다.
describe("aiV2BackDoor", () => {
  isolateTimers();
  const mapNamed = (project: Project, name: string): GameMap => Object.values(project.maps).find((map) => map?.name === name)!;
  describe("뒷문 — 막다른 거절이 한 번에 되는 길을 이른다", () => {
    it("layoutPatch 거절은 전체 배치를 권하지 않고 create_transfer_pair 를 그 맵 id 와 문 칸으로 준다", () => {
      const project = buildFixture("built");
      const hall = mapNamed(project, "족장의 긴 집");
      const text = layoutPatchRefusal(project, hall.id, { replace: { doors: [{ wall: "outer", x: 12, y: 1 }] } });
      expect(text).toContain(`create_transfer_pair({"a":{"mapId":"${hall.id}","x":12,"y":1}`);
      expect(text).toContain("nothing was changed");
      expect(text).not.toMatch(/Send patch\.set\.layout/u);
      expect(text).not.toContain('mapId":""');
      // 문이 아닌 고침은 그 맵을 먼저 보게 한다 — 다음 호출은 하나, 실제 맵 id 로.
      expect(layoutPatchRefusal(project, hall.id, { replace: {} })).toContain(`Next call: inspect({"mapId":"${hall.id}"})`);
      expect(noDesignRefusal(new V2Session(), project, hall.id)).toContain("create_transfer_pair");
    });

    it("place_door 가 재료를 못 맞히면 문 그림 없이 잇는 길을 같이 적는다", () => {
      const ctx = { project: buildFixture("built") };
      const hall = mapNamed(ctx.project, "족장의 긴 집");
      const result = runTool(ctx, "place_door", { mapId: hall.id, at: { x: 12, y: 2 }, material: "벽 통로" });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("create_transfer_pair");
    });

    it("create_transfer_pair 는 벽 칸을 받아 그 앞 걷는 칸에 출입구를 붙인다(한 번에 두 맵이 이어진다)", () => {
      const ctx = { project: buildFixture("built") };
      const hall = mapNamed(ctx.project, "족장의 긴 집"), market = mapNamed(ctx.project, "겨울 시장");
      const result = runTool(ctx, "create_transfer_pair", { a: { mapId: hall.id, x: 10, y: 1 }, b: { mapId: market.id, x: 21, y: 13 } });
      expect(result.ok, result.summary).toBe(true);
      const toMarket = mapNamed(ctx.project, "족장의 긴 집").events.filter((event) => !hall.events.some((old) => old.id === event.id))
        .flatMap((event) => (event.pages ?? []).flatMap((page) => page.commands)).filter((command) => command.kind === "transfer" && (command as { mapId?: string }).mapId === market.id);
      expect(toMarket.length).toBeGreaterThan(0);
      const back = mapNamed(ctx.project, "겨울 시장").events.filter((event) => !market.events.some((old) => old.id === event.id))
        .flatMap((event) => (event.pages ?? []).flatMap((page) => page.commands)).filter((command) => command.kind === "transfer" && (command as { mapId?: string }).mapId === hall.id);
      expect(back.length).toBeGreaterThan(0);
    });
  });
});

// 게임 하나를 잇는 «계속» 은 게임 도구 묶음을 받는다 · 그림 요청은 generate_art 를 받는다 · 지시문이 이미 실은 카드를 동사가 다시 돌려주지 않는다
// (2026-11-11 — openwiki/assistant-v2.md 「이어 하기 턴의 도구」).
describe("aiV2ContinueTools", () => {
  isolateTimers();
  function tools(fixture: FixtureId, task: string) {
    const project = buildFixture(fixture);
    const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
    const env: PiAssistantV2Env = {
      ctx, request: { task, provider: "local-cli:claude", mapIds: [], project, projectKey: `["project","continue-tools"]` } as never,
      emit: () => {}, record: () => {}, sideChat: async () => "{}", render: async () => "", checkpoint: async () => {}, contextEpoch: () => 0,
    };
    const list = createV2Tools(env, new V2Session());
    return { ctx, list, names: new Set(list.map((t) => t.name)) };
  }
  describe("이어 하기 턴의 도구", () => {
    it.each(["계속", "남은 거 마저 해 줘"])("게임 하나를 잇는 «%s» 은 엔딩·타이틀·이벤트를 고치는 도구를 받는다", (task) => {
      const { ctx, names } = tools("built", task);
      expect(classifyRequest(task, ctx.project).wholeGame).toBe(true);
      for (const name of ["define_ending", "set_title_screen", "upsert_event", "move_event", "upsert_item", "generate_art"]) expect(names.has(name), name).toBe(true);
    });

    it("청사진이 없는 프로젝트의 «계속» 은 게임 하나를 물려받지 않는다 — 지은 것을 고치는 도구는 받는다", () => {
      const { ctx, names } = tools("starter", "계속");
      const intent = classifyRequest("계속", ctx.project);
      expect(intent.wholeGame).toBe(false);
      // 게임 하나의 묶음(엔딩·타이틀)은 이 요청의 도구로 내놓지 않는다 — 풀에 있어 이름으로 부르면 실릴 뿐이다.
      for (const name of ["define_ending", "set_title_screen"]) expect(intent.tools.extra, name).not.toContain(name);
      // 전에는 이벤트를 찾고 옮기는 도구가 만들어지지도 않았다(요청 글에 게임 낱말이 없어서).
      for (const name of ["find_events", "get_event", "patch_event_page", "move_event"]) expect(names.has(name), name).toBe(true);
    });

    it("타이틀 그림을 새로 그려 달라는 작은 요청도 generate_art 를 받고, 대사 고치기는 받지 않는다", () => {
      expect(tools("built", "타이틀 화면 그림 새로 그려 줘").names.has("generate_art")).toBe(true);
      expect(tools("built", "겨울 시장 모피 상인의 첫 대사를 바꿔 줘").names.has("generate_art")).toBe(false);
    });

    it("사람 카드가 지시문에 실린 요청의 첫 add_people 은 카드를 다시 돌려주지 않고 바로 세운다", async () => {
      const { ctx, list } = tools("starter", "이 맵에 상점 주인 한 명 세워 줘.");
      const before = ctx.project.maps[ctx.project.startMapId]!.events.length;
      const res = await list.find((t) => t.name === "add_people")!.execute("c1", { people: [{ role: "상인", name: "잡화점 주인", where: "광장", firstTalk: ["어서 오세요."], sells: [{ item: "회복약" }] }] });
      const head = JSON.parse((res.content as { type: string; text?: string }[])[0]!.text!) as { ok?: boolean; summary?: string };
      expect(head.ok, head.summary).toBe(true);
      expect(ctx.project.maps[ctx.project.startMapId]!.events.length).toBe(before + 1);
    }, 60_000);
  });
});

// 조사 지점 — 2026-11-11 작은 일 재측정(sign-starter · examine-fireplace-built): 「벽난로를 조사하면 글」 을 조수는 컷신 동사(add_event)로 만들었고,
// 연출 비평가가 한 줄짜리 조사 글에 「두 인물이 멀다」 를 달아 고칠 수 없는 할 일이 막힘으로 닫혔다. 자리 낱말은 채워 보낸 at:{0,0} 에 밀려 버려졌다.
describe("aiV2ExamineSpots", () => {
  isolateTimers();
  const hallOf = (project: Project): GameMap => Object.values(project.maps).find((map) => map?.name === "족장의 긴 집")!;
  describe("place_examine_hotspots — on(물건 이름)", () => {
    it("이미 있는 물건의 칸을 찾아 그 위에 놓는다 — 채워 보낸 at:{0,0} 보다 앞선다", () => {
      const ctx = { project: buildFixture("built") };
      const hall = hallOf(ctx.project);
      const result = runTool(ctx, "place_examine_hotspots", { mapId: hall.id, hotspots: [{ on: "벽난로", at: { x: 0, y: 0 }, lines: ["장작이 따뜻하게 타오르고 있다."] }] });
      expect(result.ok, result.summary).toBe(true);
      const eventId = (result.data as { eventIds: string[] }).eventIds[0]!;
      const event = hallOf(ctx.project).events.find((entry) => entry.id === eventId)!;
      expect(event.name).toBe("벽난로");
      expect(result.summary).toContain(`벽난로(${event.x},${event.y})`);
      // 물건 칸 위다: 그 칸 윗층에 물건 타일이 있다(빈 바닥 위 투명 이벤트가 아니다).
      expect(hallOf(ctx.project).upperTiles[event.y * hall.width + event.x]).toBeGreaterThan(0);
      expect(event.trigger).toEqual({ kind: "action" });
      expect(event.pages![0]!.commands).toEqual([expect.objectContaining({ kind: "text", body: "장작이 따뜻하게 타오르고 있다." })]);
    });

    it("없는 물건이면 실패로 돌려준다(「0개 생성」 을 성공으로 주지 않는다)", () => {
      const ctx = { project: buildFixture("built") };
      const result = runTool(ctx, "place_examine_hotspots", { mapId: hallOf(ctx.project).id, hotspots: [{ on: "분수대", lines: ["…"] }] });
      expect(result.ok).toBe(false);
      expect(result.summary).toContain("분수대");
      expect(result.summary).toContain("stamp_object");
    });

    it("방금 찍은 표지판도 이름으로 찾는다(이정표 = 표지판)", () => {
      const ctx = { project: buildFixture("starter") };
      expect(runTool(ctx, "stamp_object", { objectId: "kit:beodeul_city/bd-out-signpost", mapId: "map_ember_village", x: 12, y: 15, layers: "both", onOverlap: "nearest" }).ok).toBe(true);
      const result = runTool(ctx, "place_examine_hotspots", { mapId: "map_ember_village", hotspots: [{ on: "표지판", lines: ["잿불 마을에 오신 것을 환영합니다"] }] });
      expect(result.ok, result.summary).toBe(true);
      expect(result.warnings ?? []).toEqual([]);
    });

    it("조사 요청에는 이 도구가 처음부터 실린다", () => {
      const project = buildFixture("built");
      expect(classifyRequest("족장의 긴 집 벽난로를 조사하면 \"장작이 따뜻하게 타오르고 있다.\"라고 나오게 해 줘", project).smallTools).toContain("place_examine_hotspots");
    });
  });
  describe("자리 낱말과 함께 온 at (0,0)", () => {
    it("낱말이 있으면 (0,0) 은 채움으로 보고 낱말로 푼다 — 낱말이 없으면 그 칸이다", () => {
      const project = buildFixture("built");
      const hall = hallOf(project);
      const worded = resolveWhere(project, hall, "벽난로 앞", {});
      expect(resolveWhere(project, hall, "벽난로 앞", { at: { x: 0, y: 0 } }).cell).toEqual(worded.cell);
      expect(worded.how).toContain("벽난로");
      expect(resolveWhere(project, hall, "벽난로 앞", { at: { x: 3, y: 8 } }).cell).toEqual({ x: 3, y: 8 });
      expect(resolveWhere(project, hall, undefined, { at: { x: 0, y: 0 } }).how).toMatch(/^칸 /u);
    });
  });
  describe("add_event — 글만 나오는 조사·읽기는 연출한 장면이 아니다", () => {
    const build = (beats: EventSpec["beats"], when: "talk" | "touch") => {
      const ctx = { project: buildFixture("built") };
      return buildEvent(createBuildRun(ctx), { kind: "talk", mapId: hallOf(ctx.project).id, when, where: "벽난로 앞", beats } as EventSpec);
    };
    it("내레이션 한 줄은 무대를 싣지 않는다(연출 비평을 부르지 않는다)", () => {
      const read = build([{ do: "say", who: "", text: "장작이 따뜻하게 타오르고 있다." }], "talk");
      expect(read.ok, read.summary).toBe(true);
      expect(read.stage).toBeUndefined();
      expect(read.summary).toContain("조사 글");
      expect(build([{ do: "say", who: "", text: "찬 바람이 분다." }], "touch").stage).toBeUndefined();
    });
    it("사람이 말하거나 걷는 장면은 그대로 무대를 싣는다", () => {
      expect(build([{ do: "say", who: "이르마", text: "어서 와." }], "talk").stage).toBeDefined();
      expect(build([{ do: "walk", who: "주인공", to: "벽난로 앞" }, { do: "say", who: "", text: "따뜻하다." }], "talk").stage).toBeDefined();
    });
  });
});
