import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createPiToolset, scopeFindToolsResult } from "@/ai/piAgent/toolAdapter";
import { createBlankProject } from "@/project/defaults";
import type { Command, GameEvent, Project } from "@/project/types";
import type { ToolResult } from "@/editor/tools/types";
import { isolateTimers } from "./mergedTeardown";

// 2026-09-23 「등대지기의 겨울」 재시험(origin/main a5b552712 이후)에서 게임을 끝낼 수 없던 결함들의 회귀.
// 동료 합류·보스전 선택지가 빈 분기, 구출 후 페이지를 여는 스위치·엔딩 호출 없음, 마을 맵 「빈 맵」, 같은 이름의 빈 맵 고아.
describe("jrpgDogfoodRetestRegressions", () => {
  isolateTimers();
  function blank(): { ctx: { project: Project }; mapId: string } {
    const project = createBlankProject();
    return { ctx: { project }, mapId: project.startMapId };
  }
  function eventOf(project: Project, mapId: string, id: string): GameEvent {
    const event = project.maps[mapId]!.events.find(entry => entry.id === id);
    if (!event) throw new Error(`missing event ${id}`);
    return event;
  }
  function choicesOf(event: GameEvent): Extract<Command, { kind: "choices" }> {
    const command = event.pages![0]!.commands.find(entry => entry.kind === "choices");
    if (!command || command.kind !== "choices") throw new Error("no choices command");
    return command;
  }
  function warningsOf(result: unknown): string {
    return ((result as { diff?: { warnings?: string[] } }).diff?.warnings ?? []).join("\n");
  }
  function companionArgs(mapId: string, actorId: string, key: "commands" | "branch"): Record<string, unknown> {
    return {
      mapId, x: 3, y: 3, id: "ev_companion_kyle", name: "떠돌이 어부 소년 카일",
      pages: [
        {
          lines: ["루나, 안색이 안 좋네."],
          choices: [
            { text: "동행을 제안한다", [key]: [{ kind: "changeParty", actorId, action: "add" }, { kind: "setSelfSwitch", key: "A", value: true }] },
            { text: "잠시 기다려달라고 한다" },
          ],
        },
        { conditions: [{ kind: "selfSwitch", key: "A", value: true }], lines: ["등대 불꽃을 되찾으러 가자!"] },
      ],
    };
  }
  describe("defect 1 — choices lose their branches", () => {
    it("place_npc keeps a choice sent with the native `branch` key (was silently dropped) and says so", () => {
      const { ctx, mapId } = blank();
      const actorId = ctx.project.database.actors[1]!.id;
      const result = runTool(ctx, "place_npc", companionArgs(mapId, actorId, "branch"));
      expect(result.ok, result.summary).toBe(true);
      const choices = choicesOf(eventOf(ctx.project, mapId, "ev_companion_kyle"));
      expect(choices.options[0]!.branch).toEqual([
        { kind: "changeParty", actorId, action: "add" },
        { kind: "setSelfSwitch", key: "A", value: true },
      ]);
      expect(warningsOf(result)).toContain("branch를 선택지 commands로 읽었습니다");
    });

    it("the Pi tool path (createPiToolset → place_npc) keeps the branch too", async () => {
      const project = createBlankProject();
      const ctx = { project };
      const actorId = project.database.actors[1]!.id;
      const [tool] = createPiToolset(ctx, { toolNames: ["place_npc"] });
      await tool!.execute("call_1", companionArgs(project.startMapId, actorId, "branch"), undefined as never);
      const choices = choicesOf(eventOf(ctx.project, project.startMapId, "ev_companion_kyle"));
      expect(choices.options[0]!.branch.map(command => command.kind)).toEqual(["changeParty", "setSelfSwitch"]);
    });

    it("run_scene_test can drive the choice and proves the join", () => {
      const { ctx, mapId } = blank();
      const actorId = ctx.project.database.actors[1]!.id;
      expect(runTool(ctx, "place_npc", companionArgs(mapId, actorId, "branch")).ok).toBe(true);
      const event = eventOf(ctx.project, mapId, "ev_companion_kyle");
      const scene = runTool(ctx, "run_scene_test", {
        mapId, start: { x: event.x, y: event.y + 1 },
        steps: [{ kind: "face", dir: "up" }, { kind: "interact", eventId: event.id }, { kind: "choose", index: 0 }, { kind: "expect", partyIncludes: actorId }],
      });
      expect((scene.data as { ok: boolean; failureReason?: string }).ok, (scene.data as { failureReason?: string }).failureReason).toBe(true);
    });

    it("warns when every branch of a choice is empty — choosing does nothing", () => {
      const { ctx, mapId } = blank();
      const result = runTool(ctx, "place_npc", {
        mapId, x: 3, y: 3, id: "ev_blizzard_boss", name: "눈보라 정령",
        pages: [{ lines: ["크크크..."], choices: [{ text: "정령과 맞선다!" }, { text: "물러선다" }] }],
      });
      expect(result.ok, result.summary).toBe(true);
      expect(warningsOf(result)).toMatch(/「정령과 맞선다!」\/「물러선다」의 분기가 모두 비어/u);
    });

    it("upsert_event moves options[].commands onto branch instead of rejecting or emptying it", () => {
      const { ctx, mapId } = blank();
      const actorId = ctx.project.database.actors[1]!.id;
      const result = runTool(ctx, "upsert_event", {
        mapId,
        event: {
          id: "ev_kyle_native", x: 4, y: 4, trigger: { kind: "action" },
          pages: [{
            conditions: [], graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, pattern: 0 },
            commands: [{ kind: "choices", options: [
              { text: "동행", commands: [{ kind: "changeParty", actorId, action: "add" }] },
              { text: "대기", branch: [] },
            ] }],
          }],
        },
      });
      expect(result.ok, result.summary).toBe(true);
      expect(choicesOf(eventOf(ctx.project, mapId, "ev_kyle_native")).options[0]!.branch).toEqual([{ kind: "changeParty", actorId, action: "add" }]);
      expect(warningsOf(result)).toContain("branch 로 옮겼습니다");
    });
  });
  describe("defect 2 — rescue page that nothing opens, ending nothing triggers", () => {
    const grandpa = (mapId: string) => ({
      mapId,
      event: {
        id: "ev_harmont_keeper", x: 5, y: 5, trigger: { kind: "action" },
        pages: [
          { conditions: [], graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, pattern: 25 }, commands: [{ kind: "text", body: "어서 정령을 물리쳐다오!" }] },
          { conditions: [{ kind: "switch", switchId: "sw_catalog_lighthouse_lit", value: true }], graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, pattern: 25 }, commands: [{ kind: "text", body: "너희가 날 구해주었구나!" }] },
        ],
      },
    });

    it("upsert_event warns that no command in the project turns the page's switch on", () => {
      const { ctx, mapId } = blank();
      const result = runTool(ctx, "upsert_event", grandpa(mapId));
      expect(result.ok, result.summary).toBe(true);
      expect(warningsOf(result)).toContain("sw_catalog_lighthouse_lit");
      expect(warningsOf(result)).toContain("setSwitch 가 아직 없습니다");
    });

    it("the warning disappears once a boss victory branch sets the switch", () => {
      const { ctx, mapId } = blank();
      const troopId = ctx.project.database.troops[0]!.id;
      const boss = runTool(ctx, "place_npc", {
        mapId, x: 8, y: 8, id: "ev_boss", name: "눈보라 정령",
        pages: [{ lines: ["크크크"], choices: [
          { text: "맞선다", commands: [{ kind: "battleProcessing", troopId, canEscape: false, canLose: false, victoryBranch: [{ kind: "setSwitch", switchId: "sw_catalog_lighthouse_lit", value: true }] }] },
          { text: "물러선다" },
        ] }],
      });
      expect(boss.ok, `${boss.summary} ${JSON.stringify(boss.issues ?? [])}`).toBe(true);
      const result = runTool(ctx, "upsert_event", grandpa(mapId));
      expect(result.ok, result.summary).toBe(true);
      expect(warningsOf(result)).not.toContain("sw_catalog_lighthouse_lit");
    });

    it("define_ending warns while no event calls triggerEnding", () => {
      const { ctx } = blank();
      const result = runTool(ctx, "define_ending", { id: "ending_light", name: "등대의 불", conditions: [] });
      expect(result.ok, result.summary).toBe(true);
      expect(warningsOf(result)).toContain("triggerEnding");
    });
  });
  // Removed describe "defect 3 — village keeps the placeholder": author_village was removed from the tool registry on purpose.

  describe("defect 4 — empty duplicate map left by create_map + room pipeline", () => {
    // Removed it "run_dungeon_room_pipeline adopts a create_map": run_dungeon_room_pipeline was removed from the tool registry on purpose.

    // Removed it "an authored map is still protected (map-exists)": run_dungeon_room_pipeline was removed from the tool registry on purpose.

    it("create_map warns when a blank map with the same name already exists", () => {
      const { ctx } = blank();
      expect(runTool(ctx, "create_map", { id: "map_lighthouse_top", name: "서리불꽃 등대 꼭대기", width: 20, height: 15 }).ok).toBe(true);
      const second = runTool(ctx, "create_map", { id: "map_lighthouse_peak", name: "서리불꽃 등대 꼭대기", width: 20, height: 16 });
      expect(second.ok).toBe(true);
      expect(warningsOf(second)).toContain("map_lighthouse_top");
    });
  });
});

// find_tools 는 레지스트리 전체를 찾는다 — 실행 경계 밖 이름은 결과에서 빼고 「범위 밖」으로만 알린다
// (2026-10-05 스트레스 g-ember-mine: 팀 빌더가 찾은 set_map_properties 를 부르다 「Tool … not found」 연속).
describe("piFindToolsScope", () => {
  isolateTimers();
  const found = (names: string[], suffix = ""): ToolResult => ({
    ok: true,
    summary: `편집기 툴 ${names.length}개 발견: ${names.join(", ")}${suffix}`,
    data: { matches: names.map(name => ({ name, mode: "write", description: name })) },
  });
  describe("scopeFindToolsResult", () => {
    it("경계 밖 후보를 matches 에서 빼고 요약에 범위 밖으로 남긴다", () => {
      const allowed = new Set(["paint_tiles", "place_event"]);
      const result = scopeFindToolsResult(found(["paint_tiles", "set_map_properties", "place_event"]), name => allowed.has(name));
      expect((result.data as { matches: { name: string }[] }).matches.map(match => match.name)).toEqual(["paint_tiles", "place_event"]);
      expect(result.summary).toContain("편집기 툴 2개 발견: paint_tiles, place_event");
      expect(result.summary).toContain("범위 밖");
      expect(result.summary).toContain("set_map_properties");
    });

    it("모두 경계 밖이면 부를 수 있는 것이 없다고 말한다", () => {
      const result = scopeFindToolsResult(found(["set_project_settings"]), () => false);
      expect((result.data as { matches: unknown[] }).matches).toEqual([]);
      expect(result.summary).toMatch(/^이 실행에서 호출할 수 있는 툴 중 맞는 것이 없습니다/);
      expect(result.summary).toContain("set_project_settings");
    });

    it("없는 툴 이름 안내는 유지한다", () => {
      const result = scopeFindToolsResult(found(["paint_tiles", "set_map_properties"], ". 없는 툴 이름: get_project_settings"), name => name === "paint_tiles");
      expect(result.summary).toContain("없는 툴 이름: get_project_settings");
    });

    it("전부 경계 안이거나 실패 결과면 그대로 돌려준다", () => {
      const ok = found(["paint_tiles"]);
      expect(scopeFindToolsResult(ok, () => true)).toBe(ok);
      const failed: ToolResult = { ok: false, summary: "x" };
      expect(scopeFindToolsResult(failed, () => false)).toBe(failed);
    });
  });
});
