import { describe, expect, it } from "vitest";
import { runTool, getTool, type ToolContext, type ToolDomain } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { runGameCheck } from "@/qa/gameCheck";
import type { Project, StructureKitDef, GameEvent } from "@/project/types";
import { deserialize, serialize } from "@/project/io";
import { isolateTimers } from "./mergedTeardown";

describe("openingLiteralNewline", () => {
  isolateTimers();
  // 추리 도그푸딩 gen: set_opening 서술에 「\\n」 두 글자가 와서 오프닝에 「밤.\n불의의」 가 그대로 떴다.
  describe("오프닝 서술의 글자 그대로 \\n", () => {
    it("set_opening·edit_opening 은 백슬래시-n 을 줄바꿈으로 바꾼다", () => {
      const ctx = { project: createBlankProject() };
      const set = runTool(ctx, "set_opening", { enabled: true, scenes: [{ kind: "text", narration: "폭풍우 치던 밤.\\n탐정은 저택으로 피신했다.", durationMs: 4000 }] });
      expect(set.ok, set.summary).toBe(true);
      expect(ctx.project.system.opening?.scenes[0]?.narration).toBe("폭풍우 치던 밤.\n탐정은 저택으로 피신했다.");
      const edit = runTool(ctx, "edit_opening", { op: "append", scene: { kind: "text", narration: "그리고\\r\\n비명.", durationMs: 3000 } });
      expect(edit.ok, edit.summary).toBe(true);
      expect(ctx.project.system.opening?.scenes.at(-1)?.narration).toBe("그리고\n비명.");
    });
  });
});

// qa:game 자동 플레이가 「하루 한 번 만나 호감 +2 → 자고 다음 날」 을 되풀이해 호감 문턱 엔딩까지 가는지.
// 2026-09-24 연애 도그푸딩: 호감 ≥ 6 엔딩 셋이 전부 「변수 켜기 실패」 로 막힘 오판됐다(한 번 +2 로는 안 닿는다).
describe("qaGameDayCycle", () => {
  isolateTimers();
  function romance(days: number, forkLock = false): Project {
    const ctx: { project: Project } = { project: createBlankProject() };
    const room = ctx.project.startMapId;
    const { x, y } = ctx.project.startPos;
    const ok = (name: string, args: Record<string, unknown>) => { const r = runTool(ctx, name, args); expect(r.ok, `${name} ${r.summary}`).toBe(true); };
    ok("create_map", { id: "map_fest", name: "축제", width: 12, height: 10 });
    const meet = { kind: "choices", options: [
      { text: "무심하게", branch: [{ kind: "setVariable", variableId: "var_love", op: "-=", value: 1 }, { kind: "setSwitch", switchId: "sw_met", value: true }] },
      { text: "다정하게", branch: [{ kind: "setVariable", variableId: "var_love", op: "+=", value: 2 }, { kind: "setSwitch", switchId: "sw_met", value: true }] },
    ] };
    if (forkLock) ok("upsert_event", { mapId: room, event: { id: "ev_love", x: x + 1, y, pages: [
      { trigger: { kind: "action" }, graphic: { transparent: true }, conditions: [], commands: [{ kind: "fork", condition: { kind: "switch", switchId: "sw_met", value: true }, then: [{ kind: "text", body: "내일 봐." }], else: [meet] }] },
    ] } });
    else ok("upsert_event", { mapId: room, event: { id: "ev_love", x: x + 1, y, pages: [
      { trigger: { kind: "action" }, graphic: { transparent: true }, conditions: [{ kind: "switch", switchId: "sw_met", value: false }], commands: [{ kind: "choices", options: [
        { text: "무심하게", branch: [{ kind: "setVariable", variableId: "var_love", op: "-=", value: 1 }, { kind: "setSwitch", switchId: "sw_met", value: true }] },
        { text: "다정하게", branch: [{ kind: "setVariable", variableId: "var_love", op: "+=", value: 2 }, { kind: "setSwitch", switchId: "sw_met", value: true }] },
      ] }] },
      { trigger: { kind: "action" }, graphic: { transparent: true }, conditions: [{ kind: "switch", switchId: "sw_met", value: true }], commands: [{ kind: "text", body: "내일 봐." }] },
    ] } });
    ok("upsert_event", { mapId: room, event: { id: "ev_bed", x: x - 1, y, pages: [
      { trigger: { kind: "action" }, graphic: { transparent: true }, conditions: [], commands: [{ kind: "setVariable", variableId: "var_day", op: "+=", value: 1 }, { kind: "setSwitch", switchId: "sw_met", value: false }] },
      { trigger: { kind: "action" }, graphic: { transparent: true }, conditions: [{ kind: "variable", variableId: "var_day", op: ">=", value: days }], commands: [{ kind: "transfer", mapId: "map_fest", x: 5, y: 5 }] },
    ] } });
    ok("define_ending", { id: "ending_love", name: "고백", conditions: [] });
    ok("upsert_event", { mapId: "map_fest", event: { id: "ev_confess", x: 6, y: 5, pages: [
      { trigger: { kind: "action" }, graphic: { transparent: true }, conditions: [], commands: [{ kind: "text", body: "…미안." }] },
      { trigger: { kind: "action" }, graphic: { transparent: true }, conditions: [{ kind: "variable", variableId: "var_love", op: ">=", value: 6 }], commands: [{ kind: "triggerEnding", endingId: "ending_love" }] },
    ] } });
    return ctx.project;
  }
  describe("autoplay day cycles", () => {
    it("repeats the daily meeting and sleeps until the affection ending opens", () => {
      const run = runGameCheck(romance(4)).autoPlay!.runs[0]!;
      expect(run.ok, JSON.stringify(run.steps)).toBe(true);
      expect(run.endingReached).toBe("ending_love");
    });
    it("also repeats when the daily lock is a fork around the meeting", () => {
      const run = runGameCheck(romance(4, true)).autoPlay!.runs[0]!;
      expect(run.ok, JSON.stringify(run.steps)).toBe(true);
    });
    it("reports when the calendar is too short to reach the threshold", () => {
      const run = runGameCheck(romance(1)).autoPlay!.runs[0]!;
      expect(run.ok).toBe(false);
    });
  });
});

// qa:game 자동 플레이가 잠긴 문(transfer 페이지가 스위치를 기다림)의 선행 조건을 사슬에 넣는지.
// 2026-09-24 갤러리 호러: 화실 문이 「화실 개방」 스위치를 기다리는데 자동 플레이는 문을 못 찾아 막힘으로 오판했다.
describe("qaGameLockedDoor", () => {
  isolateTimers();
  describe("autoplay locked door", () => {
    it("unlocks a switch-gated door before walking to the room behind it", () => {
      const ctx: { project: Project } = { project: createBlankProject() };
      const hall = ctx.project.startMapId;
      const { x, y } = ctx.project.startPos;
      expect(runTool(ctx, "create_map", { id: "map_room", name: "화실", width: 12, height: 10 }).ok).toBe(true);
      const ok = (name: string, args: Record<string, unknown>) => { const r = runTool(ctx, name, args); expect(r.ok, `${name} ${r.summary}`).toBe(true); };
      ok("upsert_event", { mapId: hall, event: { id: "ev_key", x: x + 1, y, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "setSwitch", switchId: "sw_open", value: true }] }] } });
      ok("upsert_event", { mapId: hall, event: { id: "ev_door", x: x - 2, y, pages: [
        { trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "잠겨 있다." }] },
        { trigger: { kind: "playerTouch" }, conditions: [{ kind: "switch", switchId: "sw_open", value: true }], commands: [{ kind: "transfer", mapId: "map_room", x: 5, y: 5 }] },
      ] } });
      ok("define_ending", { id: "ending_room", name: "끝", conditions: [] });
      ok("upsert_event", { mapId: "map_room", event: { id: "ev_end", x: 6, y: 5, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "triggerEnding", endingId: "ending_room" }] }] } });
      const report = runGameCheck(ctx.project);
      const run = report.autoPlay!.runs[0]!;
      expect(run.ok, JSON.stringify(run.steps)).toBe(true);
      expect(report.autoPlay!.plan.join(" ")).toContain("sw_open");
    });
  });
});

// 자동 플레이 계획: 문 후보 하나가 중간에 실패하면 그 시도가 남긴 선행 표식(planned·unresolved)도
// 함께 되돌아야 한다. goals 만 되돌리면 다음 후보는 «이미 계획됨」으로 건너뛰고 실제 세터 목표 없이
// 계획이 끝나, 런타임의 문이 (현재 스위치 상태로는) 열리지 않는다
// (2026-09-24 감성 스토리 r3: 계획 5단·유령 preamble 24건·자동 플레이「recordshop → busstop_v3 문 없음」).
describe("qaGamePlanRollback", () => {
  isolateTimers();
  function decoyDoorChain() {
    const ctx: { project: Project } = { project: createBlankProject() };
    const start = ctx.project.startMapId;
    const { x, y } = ctx.project.startPos;
    const ok = (name: string, args: Record<string, unknown>) => {
      const r = runTool(ctx, name, args);
      expect(r.ok, `${name}: ${r.summary}`).toBe(true);
    };
    ok("create_map", { id: "map_orphan", name: "못 가는 폐가", width: 12, height: 10 });
    ok("create_map", { id: "map_hall", name: "마당", width: 12, height: 10 });
    ok("create_map", { id: "map_goal", name: "기억의 방", width: 12, height: 10 });
    const [swX, swY] = ctx.project.switches.slice(0, 2).map((entry) => entry.id);
    ok("define_ending", { id: "ending_decoy", name: "끝", conditions: [] });
    ok("upsert_event", { mapId: start, event: { id: "ev_set_x", x: x + 1, y, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "setSwitch", switchId: swX, value: true }] }] } });
    ok("upsert_event", { mapId: start, event: { id: "ev_set_y", x: x + 1, y: y + 1, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "setSwitch", switchId: swY, value: true }] }] } });
    ok("upsert_event", { mapId: start, event: { id: "ev_free", x: x - 2, y, pages: [{ trigger: { kind: "playerTouch" }, conditions: [], commands: [{ kind: "transfer", mapId: "map_hall", x: 5, y: 5 }] }] } });
    // 들어오는 문이 하나도 없는 고아 맵의 문 — 선행 조건 수가 같아 계획이 이 문을 먼저 시도한다.
    ok("upsert_event", { mapId: "map_orphan", event: { id: "ev_decoy", x: 5, y: 3, pages: [
      { trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "못 가는 문" }] },
      { trigger: { kind: "playerTouch" }, conditions: [{ kind: "switch", switchId: swX, value: true }], commands: [{ kind: "transfer", mapId: "map_goal", x: 5, y: 5 }] },
    ] } });
    // 진짜 길: swX + swY 를 기다린다. 계획은 swX setter 목표까지 되돌려 잃으면 런타임에서 못 연다.
    ok("upsert_event", { mapId: "map_hall", event: { id: "ev_real", x: 7, y: 5, pages: [
      { trigger: { kind: "action" }, conditions: [], commands: [{ kind: "text", body: "잠겨 있다." }] },
      { trigger: { kind: "playerTouch" }, conditions: [{ kind: "switch", switchId: swX, value: true }, { kind: "switch", switchId: swY, value: true }], commands: [{ kind: "transfer", mapId: "map_goal", x: 5, y: 5 }] },
    ] } });
    ok("upsert_event", { mapId: "map_goal", event: { id: "ev_end", x: 7, y: 5, pages: [{ trigger: { kind: "action" }, conditions: [], commands: [{ kind: "triggerEnding", endingId: "ending_decoy" }] }] } });
    return { project: deserialize(serialize(ctx.project)), swX: swX!, swY: swY! };
  }
  describe("qa gameCheck — 실패한 문 후보의 계획 흔적 되돌리기", () => {
    it("고아 맵 문 후보가 실패해도 세터 목표는 남고 유령 preamble 가 없다", () => {
      const { project, swX } = decoyDoorChain();
      const report = runGameCheck(project, { autoPlayBudgetMs: 20_000 });
      const run = report.autoPlay!.runs[0]!;
      expect(run.ok, JSON.stringify(run.steps)).toBe(true);
      expect(run.endingReached).toBe("ending_decoy");
      // swX setter 는 고아 문 시도에서 계획됐다가 되돌려진 뒤, 진짜 문 후보에서 다시 계획되어야 한다.
      expect(report.autoPlay!.plan.join(" ")).toContain(swX);
      // 실패한 후보의 «찾지 못했습니다» 는 후보가 바뀐 순간 사라져야 한다(유령 preamble 금지).
      expect(run.steps.filter((step) => step.goal === "계획")).toEqual([]);
    });
  });
});

// set_scene_mood 의 sunlight — 해 질 녘 「집·소나무가 동쪽으로 길게 그림자」를 같은 호출로(2026-11-03 조수 대조 B8 서리나루:
// Opus 가 「그림자를 만들 도구가 없다」며 그 요구를 막힘으로 닫았다. 도구는 set_map_properties.sunlight 에 있었다).
describe("sceneMoodSunlight", () => {
  isolateTimers();
  describe("set_scene_mood sunlight", () => {
    it("곱하기 노을 조명과 서쪽 낮은 해 그림자를 한 번에 켠다", () => {
      const ctx = { project: createBlankProject() };
      const mapId = ctx.project.startMapId;
      const r = runTool(ctx, "set_scene_mood", {
        mapId, applyMode: "map",
        lighting: { ambient: 0.9, color: "#5a3f86", blend: "multiply", vignette: 0.55, sources: [] },
        sunlight: { azimuth: 262, altitude: 24, opacity: 0.45 },
      });
      expect(r.ok, r.summary).toBe(true);
      const map = ctx.project.maps[mapId]!;
      expect(map.sunlight).toMatchObject({ enabled: true, azimuth: 262, altitude: 24 });
      expect(map.defaultLighting).toMatchObject({ blend: "multiply" });
    });

    it("이벤트 구역 분위기에는 해를 받지 않는다", () => {
      const ctx = { project: createBlankProject() };
      const r = runTool(ctx, "set_scene_mood", { mapId: ctx.project.startMapId, applyMode: "event", sunlight: { azimuth: 90 }, lighting: { ambient: 0.5, color: "#000000", sources: [], area: { x: 0, y: 0, w: 2, h: 2 } } });
      expect(r.ok).toBe(false);
    });
  });
});

describe("scriptCutsceneReplace", () => {
  isolateTimers();
  function scriptTwice(args: Record<string, unknown>) {
    const ctx = { project: createBlankProject() };
    const beats = [{ kind: "say", speaker: "나", text: "그날." }];
    const first = runTool(ctx, "script_cutscene", { mapId: ctx.project.startMapId, eventId: "ev_memory", beats, ...args });
    const second = runTool(ctx, "script_cutscene", { mapId: ctx.project.startMapId, eventId: "ev_memory", beats: [{ kind: "say", speaker: "나", text: "다시." }], ...args });
    const event = ctx.project.maps[ctx.project.startMapId]?.events.find((entry) => entry.id === "ev_memory");
    return { first, second, event };
  }
  describe("script_cutscene replace and once", () => {
    it("defaults to replacing existing 컷신 pages instead of stacking them", () => {
      const { first, second, event } = scriptTwice({});
      expect(first.ok, JSON.stringify(first.issues)).toBe(true);
      expect(second.ok, JSON.stringify(second.issues)).toBe(true);
      expect(event?.pages).toHaveLength(1);
      expect(event?.pages?.[0]?.name).toBe("컷신");
      expect(JSON.stringify(event?.pages?.[0]?.commands)).toContain("다시");
      expect(JSON.stringify(event?.pages?.[0]?.commands)).not.toContain("그날.");
    });

    it("mode append still stacks a new 컷신 page", () => {
      const { event } = scriptTwice({ mode: "append" });
      expect(event?.pages).toHaveLength(2);
    });

    it("once adds a self-switch A off condition and turns A on at the end", () => {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "script_cutscene", {
        mapId: ctx.project.startMapId,
        eventId: "ev_once",
        once: true,
        beats: [{ kind: "say", speaker: "나", text: "한 번만." }],
      });
      expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      const event = ctx.project.maps[ctx.project.startMapId]?.events.find((entry) => entry.id === "ev_once");
      expect(event?.pages?.[0]?.conditions).toContainEqual({ kind: "selfSwitch", key: "A", value: false });
      expect(event?.pages?.[0]?.commands).toContainEqual({ kind: "setSelfSwitch", key: "A", value: true });
    });
  });
});

describe("stampObjectKitEntrance", () => {
  isolateTimers();
  // 특수 건물 킷(Rasak Special_Buildings 선례): 입구 부위가 있는 킷은 찍은 뒤 맵 좌표 입구를 돌려주고, ai.tags 로 검색된다.
  function kitProject() {
    const project = createBlankProject();
    const tileset = Object.values(project.tilesets)[0]!;
    const mapId = Object.keys(project.maps)[0]!;
    const kit: StructureKitDef = {
      id: "sb_test_inn", kind: "section", name: "시험 여관", width: 3, height: 2, learnedFrom: "db-authored",
      rows: [{ tiles: [-1, -1, -1], upperTiles: [1, 2, 3] }, { tiles: [-1, -1, -1], upperTiles: [4, -1, 6] }],
      parts: [{ id: "entry1", kind: "entrance", dx: 1, dy: 1, w: 1, h: 1, note: "문" }],
      ai: { description: "시험", placementRules: "", tags: ["특수 건물", "여관"] },
    };
    tileset.structureKits = [...(tileset.structureKits ?? []), kit];
    return { project, tilesetId: tileset.id, mapId };
  }
  describe("stamp_object 킷 입구", () => {
    it("입구 부위를 맵 좌표로 돌려준다", () => {
      const { project, tilesetId, mapId } = kitProject();
      const ctx = { project };
      const result = runTool(ctx, "stamp_object", { objectId: `kit:${tilesetId}/sb_test_inn`, mapId, x: 4, y: 3 });
      expect(result.ok).toBe(true);
      expect((result.data as { entrances?: unknown }).entrances).toEqual([{ x: 5, y: 4, note: "문" }]);
      expect(result.summary).toContain("입구 (5,4)");
      expect(result.summary).toContain("(5,5)");
    });

    it("킷 ai.tags 로 목록에서 찾는다", () => {
      const { project, tilesetId } = kitProject();
      const list = runTool({ project }, "list_spatial_designs", { kind: "object", query: "특수 건물" });
      expect(list.ok).toBe(true);
      expect(JSON.stringify(list.data)).toContain(`kit:${tilesetId}/sb_test_inn`);
    });
  });
});

// jrpg-loop-1 ct1: 그림 없는 시간의 문은 화면에 아무 표시도 없어 플레이어가 문을 찾을 수 없었다 — 문 칸에 빛(파티클) 병렬 이벤트를 단다.
describe("timeGateBeacon", () => {
  isolateTimers();
  function twoMaps(): { project: Project; a: string } {
    const project = createBlankProject();
    const a = project.startMapId;
    const copy = structuredClone(project.maps[a]!);
    copy.id = "map_b";
    copy.name = "B";
    copy.events = [];
    project.maps.map_b = copy;
    return { project, a };
  }
  const beaconsOf = (project: Project, mapId: string): GameEvent[] => project.maps[mapId]!.events.filter((event) => event.id.startsWith("ev_beacon"));
  describe("create_time_gate beacon", () => {
    it("adds a magic-particle parallel event on each gate tile of a transparent gate", () => {
      const { project, a } = twoMaps();
      const ctx = { project };
      const result = runTool(ctx as never, "create_time_gate", { a: { mapId: a, x: 5, y: 5 }, b: { mapId: "map_b", x: 6, y: 6 }, name: "시간의 문" });
      expect(result.ok).toBe(true);
      for (const [mapId, x, y] of [[a, 5, 5], ["map_b", 6, 6]] as const) {
        const beacons = beaconsOf(ctx.project, mapId);
        expect(beacons).toHaveLength(1);
        expect(beacons[0]).toMatchObject({ x, y, trigger: { kind: "parallel" } });
        const commands = beacons[0]!.pages![0]!.commands;
        expect(commands[0]).toMatchObject({ kind: "m2Command", commandId: "m2-224-particle-effect", fields: { preset: "magic", target: "tile", x, y, wait: false } });
        expect(commands[1]).toMatchObject({ kind: "wait" });
      }
    });
  });
});

describe("toolsAuthoringMisc", () => {
  isolateTimers();
  function context(): ToolContext {
    return { project: createBlankProject() };
  }
  function firstMap(project: Project) {
    const map = project.maps[project.startMapId];
    if (!map) throw new Error(`missing start map: ${project.startMapId}`);
    return map;
  }
  function firstId(entries: readonly { readonly id: string }[], label: string): string {
    const entry = entries[0];
    if (!entry) throw new Error(`missing ${label}`);
    return entry.id;
  }
  function firstProfileAssetId(project: Project): string {
    const assetId = project.resourceProfiles[0]?.assetId;
    if (!assetId) throw new Error("missing resource profile assetId");
    return assetId;
  }
  function addSecondMap(ctx: ToolContext): string {
    const result = runTool(ctx, "create_map", { id: "map_second", name: "둘째 맵", width: 8, height: 7 });
    expect(result.ok, result.summary).toBe(true);
    return "map_second";
  }
  function expectRejectedWith(result: ReturnType<typeof runTool>, ...values: string[]): void {
    expect(result.ok).toBe(false);
    for (const value of values) expect(result.summary).toContain(value);
  }
  describe("authoring misc facades", () => {
    it("upserts mapConnections and validates map ids and coordinates", () => {
      const ctx = context();
      const fromMap = firstMap(ctx.project);
      const toMapId = addSecondMap(ctx);
      const connection = {
        id: "road_gate",
        name: "마을길",
        from: { mapId: fromMap.id, x: 2, y: 3, direction: "right" },
        to: { mapId: toMapId, x: 4, y: 5, direction: "left" },
        playerEnabled: true,
        npcEnabled: false,
      };

      const result = runTool(ctx, "upsert_map_connection", { connection });
      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.mapConnections).toEqual([connection]);

      const missingMap = runTool(ctx, "upsert_map_connection", {
        connection: { ...connection, id: "bad-map", to: { ...connection.to, mapId: "missing" } },
      });
      expectRejectedWith(missingMap, fromMap.id, toMapId);
      const badCoordinate = runTool(ctx, "upsert_map_connection", {
        connection: { ...connection, id: "bad-pos", to: { ...connection.to, x: 8 } },
      });
      expectRejectedWith(badCoordinate, toMapId, "0..7");
    });

    it("deletes mapConnections and names valid connection ids on rejection", () => {
      const ctx = context();
      ctx.project.mapConnections = [{
        id: "road_gate",
        from: { mapId: ctx.project.startMapId, x: 1, y: 1 },
        to: { mapId: ctx.project.startMapId, x: 2, y: 2 },
        playerEnabled: true,
        npcEnabled: true,
      }];
      expect(runTool(ctx, "delete_map_connection", { connectionId: "road_gate" }).ok).toBe(true);
      expect(ctx.project.mapConnections).toEqual([]);

      ctx.project.mapConnections = [{
        id: "known-road",
        from: { mapId: ctx.project.startMapId, x: 1, y: 1 },
        to: { mapId: ctx.project.startMapId, x: 2, y: 2 },
        playerEnabled: true,
        npcEnabled: true,
      }];
      expectRejectedWith(runTool(ctx, "delete_map_connection", { connectionId: "missing" }), "known-road");
    });

    it("upserts villageInfoDocuments and validates mapId", () => {
      const ctx = context();
      const document = { id: "village-guide", mapId: ctx.project.startMapId, title: "마을 안내", markdown: "# 광장" };
      expect(runTool(ctx, "upsert_village_document", { document }).ok).toBe(true);
      expect(ctx.project.villageInfoDocuments).toEqual([document]);

      const rejected = runTool(ctx, "upsert_village_document", { document: { ...document, mapId: "missing" } });
      expectRejectedWith(rejected, ctx.project.startMapId);
    });

    it("deletes villageInfoDocuments and names valid ids on rejection", () => {
      const ctx = context();
      ctx.project.villageInfoDocuments = [{ id: "guide", mapId: ctx.project.startMapId, title: "안내", markdown: "본문" }];
      expect(runTool(ctx, "delete_village_document", { documentId: "guide" }).ok).toBe(true);
      expect(ctx.project.villageInfoDocuments).toEqual([]);

      ctx.project.villageInfoDocuments = [{ id: "known-doc", mapId: ctx.project.startMapId, title: "안내", markdown: "본문" }];
      expectRejectedWith(runTool(ctx, "delete_village_document", { documentId: "missing" }), "known-doc");
    });

    it("upserts resourceProfiles only for known authored assets", () => {
      const ctx = context();
      ctx.project.assets.uploaded.face_may = { id: "face_may", name: "메이", kind: "faceset", dataUrl: "data:image/png;base64,AA==", meta: {} };
      const profile = { kind: "faceset" as const, name: "메이 얼굴", assetId: "face_may", tileWidth: 48, tileHeight: 48, imageWidth: 192, imageHeight: 192 };
      expect(runTool(ctx, "upsert_resource_profile", { profile }).ok).toBe(true);
      expect(ctx.project.resourceProfiles.find((entry) => entry.assetId === "face_may")).toEqual(profile);

      const rejected = runTool(ctx, "upsert_resource_profile", { profile: { ...profile, assetId: "missing" } });
      expectRejectedWith(rejected, "face_may");
    });

    it("deletes resourceProfiles without deleting the separately authored asset", () => {
      const ctx = context();
      ctx.project.assets.uploaded.face_may = { id: "face_may", name: "메이", kind: "faceset", dataUrl: "data:image/png;base64,AA==", meta: {} };
      ctx.project.resourceProfiles.push({ kind: "faceset", name: "메이 얼굴", assetId: "face_may" });
      expect(runTool(ctx, "delete_resource_profile", { assetId: "face_may" }).ok).toBe(true);
      expect(ctx.project.resourceProfiles.some((entry) => entry.assetId === "face_may")).toBe(false);
      expect(ctx.project.assets.uploaded.face_may?.id).toBe("face_may");

      expectRejectedWith(runTool(ctx, "delete_resource_profile", { assetId: "missing" }), firstProfileAssetId(ctx.project));
    });

    it("upserts character profiles keyed by characterId and validates gift item ids", () => {
      const ctx = context();
      const itemId = firstId(ctx.project.database.items, "item");
      const profile = {
        displayName: "메이",
        birthday: { season: "spring" as const, day: 12 },
        giftPrefs: { loved: [itemId], liked: [], disliked: [] },
        giftResponses: { loved: "정말 좋아!", disliked: "이건 조금..." },
      };
      expect(runTool(ctx, "upsert_character_profile", { characterId: "may", profile }).ok).toBe(true);
      expect(ctx.project.characters).toEqual({ may: profile });

      const rejected = runTool(ctx, "upsert_character_profile", {
        characterId: "may",
        profile: { giftPrefs: { loved: ["missing-item"] } },
      });
      expectRejectedWith(rejected, itemId);
    });

    it("deletes character profiles without deleting actors or events", () => {
      const ctx = context();
      const actorId = ctx.project.database.actors[0]?.id;
      ctx.project.characters = { may: { displayName: "메이" } };
      expect(runTool(ctx, "delete_character_profile", { characterId: "may" }).ok).toBe(true);
      expect(ctx.project.characters).toBeUndefined();
      expect(ctx.project.database.actors.some((actor) => actor.id === actorId)).toBe(true);

      ctx.project.characters = { known: { displayName: "남은 인물" } };
      expectRejectedWith(runTool(ctx, "delete_character_profile", { characterId: "missing" }), "known");
    });

    it("upserts testPresets and validates referenced slots and start position", () => {
      const ctx = context();
      const map = firstMap(ctx.project);
      const switchId = firstId(ctx.project.switches, "switch");
      const variableId = firstId(ctx.project.variables, "variable");
      const itemId = firstId(ctx.project.database.items, "item");
      const preset = {
        id: "boss-ready",
        name: "보스 직전",
        switches: { [switchId]: true },
        variables: { [variableId]: 4 },
        inventory: { [itemId]: 2 },
        gold: 300,
        startMapId: map.id,
        startPos: { x: 3, y: 4 },
      };
      expect(runTool(ctx, "upsert_test_preset", { preset }).ok).toBe(true);
      expect(ctx.project.testPresets).toEqual([preset]);

      const missingSlot = runTool(ctx, "upsert_test_preset", { preset: { ...preset, id: "bad", switches: { missing: true } } });
      expectRejectedWith(missingSlot, switchId);
      const badPosition = runTool(ctx, "upsert_test_preset", { preset: { ...preset, id: "bad-pos", startPos: { x: map.width, y: 0 } } });
      expectRejectedWith(badPosition, map.id, `0..${map.width - 1}`);
    });

    it("deletes testPresets and names valid ids on rejection", () => {
      const ctx = context();
      ctx.project.testPresets = [{ id: "known-preset", name: "알려진 프리셋" }];
      expect(runTool(ctx, "delete_test_preset", { presetId: "known-preset" }).ok).toBe(true);
      expect(ctx.project.testPresets).toEqual([]);

      ctx.project.testPresets = [{ id: "another-preset", name: "다른 프리셋" }];
      expectRejectedWith(runTool(ctx, "delete_test_preset", { presetId: "missing" }), "another-preset");
    });

    it("adds and deletes a named flag slot together with its session seed", () => {
      const ctx = context();
      expect(runTool(ctx, "manage_flag_slot", { action: "add", kind: "switch", id: "sw_weather", name: "비가 옴", switchValue: true }).ok).toBe(true);
      expect(ctx.project.switches).toContainEqual({ id: "sw_weather", name: "비가 옴" });
      expect(ctx.project.session.switches.sw_weather).toBe(true);

      expect(runTool(ctx, "manage_flag_slot", { action: "delete", kind: "switch", id: "sw_weather" }).ok).toBe(true);
      expect(ctx.project.switches.some((entry) => entry.id === "sw_weather")).toBe(false);
      expect(ctx.project.session.switches).not.toHaveProperty("sw_weather");

      expectRejectedWith(runTool(ctx, "manage_flag_slot", { action: "delete", kind: "variable", id: "missing" }), firstId(ctx.project.variables, "variable"));
    });

    it("rejects deleting referenced slots and names event, quest, and ending ids", () => {
      const ctx = context();
      const map = firstMap(ctx.project);
      ctx.project.switches.push({ id: "sw_guarded", name: "보호됨" });
      ctx.project.session.switches.sw_guarded = false;
      map.events.push({
        id: "ev_guarded",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [{ kind: "setSwitch", switchId: "sw_guarded", value: true }],
      });
      ctx.project.quests = [{
        kind: "graph",
        id: "quest_guarded",
        title: "보호 퀘스트",
        nodes: [{ id: "node_guarded", description: "조건", completesWhen: { kind: "switch", switchId: "sw_guarded", value: true } }],
        edges: [],
      }];
      ctx.project.endings = [{ id: "ending_guarded", name: "보호 엔딩", priority: 1, conditions: [{ kind: "switch", switchId: "sw_guarded", value: true }] }];

      const rejected = runTool(ctx, "manage_flag_slot", { action: "delete", kind: "switch", id: "sw_guarded" });
      expectRejectedWith(rejected, "ev_guarded", "quest_guarded", "ending_guarded");
      expect(ctx.project.switches.some((entry) => entry.id === "sw_guarded")).toBe(true);
      expect(ctx.project.session.switches).toHaveProperty("sw_guarded");
    });

    it("declares every mixed-family tool domain explicitly", () => {
      const expected: Readonly<Record<string, readonly ToolDomain[]>> = {
        upsert_map_connection: ["map"],
        delete_map_connection: ["map"],
        upsert_village_document: ["map"],
        delete_village_document: ["map"],
        upsert_resource_profile: ["system"],
        delete_resource_profile: ["system"],
        upsert_character_profile: ["database"],
        delete_character_profile: ["database"],
        upsert_test_preset: ["system"],
        delete_test_preset: ["system"],
        manage_flag_slot: ["event"],
      };
      for (const [name, domains] of Object.entries(expected)) expect(getTool(name)?.domains, name).toEqual(domains);
    });
  });
});
