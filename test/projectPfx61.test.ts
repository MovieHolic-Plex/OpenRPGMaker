import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { deserialize, serialize } from "@/project/io";
import { collectProjectReferenceIssues, repairProjectReferences, validateProjectReferences } from "@/project/io/references";
import { projectLint } from "@/project/lint/projectLint";
import { applyMapDeletion, collectMapDeletionImpact } from "@/project/mapDeletion";
import type { GameEvent, GameMap, NpcScheduleEntry, Project, Command } from "@/project/types";
import { OPENING_PICTURE_WALKERS_CODE, openingPictureWalkers } from "@/project/openingAuthoringReview";
import { openingStageEventId, openingStageFlag } from "@/project/openingStage";
import { runTool, getTool, toOpenAiTools, type ToolContext } from "@/editor/tools";
import type { AnimaticLayer } from "@/project/openingAnimatic";
import { store } from "@/project/store";
import { startSession } from "@/project/session";
import { initialRuntimeEventPositions } from "@/project/runtimeEventState";
import { activeRuntimeEvents } from "@/player/playSceneMapRuntime";
import { SCARLOXY_PACK_MANIFEST, scarloxyChipsetGroupSeeds } from "@/assets/scarloxyPack";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { ensureTilesetHarnesses } from "@/project/tilesetHarness";
import { declaredIntent } from "./intentFixture";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { computeActiveToolDomains, resetAssistantToolDomainMemory } from "@/editor/assistantToolMode";
import { isolateTimers } from "./mergedTeardown";
import { AuthoredProjectBaseline } from "@/project/authoredProjectBaseline";
import { AssistantSession } from "@/ai/assistantSession";
import { reassembleSelectedProposalProject } from "@/editor/panels/aiChatPanel";
import { resetMapEditHistory, undoMapEdit } from "@/editor/mapEditHistory";
import { applyProposedProject, captureProposalBase } from "@/editor/tools/applyChangesetToStore";
import type { ChatResult } from "@/ai/llmClient";

describe("projectLint", () => {
  isolateTimers();
  describe("npcScheduleReferenceIntegrity", () => {
    isolateTimers();
    describe("NPC schedule project reference integrity", () => {
      // Break caught: global reference validation ignores missing and invalid schedule destinations.
      it("reports unknown, blank, missing, fractional, and out-of-bounds destinations with their host row", () => {
        const project = scheduleProject();
        const source = project.maps[project.startMapId]!;
        const target = project.maps.map_target!;
        const valid = scheduleRow(target.id, 1, 1, "work");
        source.events.push(eventWithSchedule("ev_schedule", [
          valid,
          scheduleRow("map_missing", 1, 1),
          scheduleRow("", 1, 1),
          { ...scheduleRow(target.id, 1, 1), at: { x: 1, y: 1 } } as unknown as NpcScheduleEntry,
          scheduleRow(target.id, target.width, 0),
          scheduleRow(target.id, 1.5, 1),
          structuredClone(valid),
        ]));

        const issues = collectProjectReferenceIssues(project).filter((issue) => issue.includes("schedule["));
        expect(issues).toHaveLength(5);
        expect(issues).toEqual(expect.arrayContaining([
          expect.stringMatching(/map_blank_start.*ev_schedule.*schedule\[1\].*map_missing/),
          expect.stringMatching(/map_blank_start.*ev_schedule.*schedule\[2\].*blank/i),
          expect.stringMatching(/map_blank_start.*ev_schedule.*schedule\[3\].*missing/i),
          expect.stringMatching(/map_blank_start.*ev_schedule.*schedule\[4\].*out of bounds/i),
          expect.stringMatching(/map_blank_start.*ev_schedule.*schedule\[5\].*out of bounds/i),
        ]));

        const lintIssues = projectLint(project)
          .filter((issue) => issue.code === "reference-validation" && issue.message.includes("schedule["));
        expect(lintIssues).toHaveLength(5);
      });

      // Break caught: load repair leaves dangling schedule rows while repairing other map references.
      it("repairs only invalid rows across attached and map-tree-orphan event hosts", () => {
        const project = scheduleProject();
        const target = project.maps.map_target!;
        const source = project.maps[project.startMapId]!;
        const valid = scheduleRow(target.id, 2, 2, "work");
        const duplicate = structuredClone(valid);
        const sourceEvent = eventWithSchedule("ev_source", [
          valid,
          scheduleRow("map_missing", 1, 1),
          scheduleRow("", 1, 1),
          { ...scheduleRow(target.id, 1, 1), at: { x: 1, y: 1 } } as unknown as NpcScheduleEntry,
          duplicate,
          scheduleRow(target.id, -1, 0),
        ]);
        source.events.push(sourceEvent);
        const orphan = addMap(project, "map_orphan_host", false);
        orphan.events.push(eventWithSchedule("ev_orphan", [
          scheduleRow("map_missing", 0, 0),
          scheduleRow(target.id, 3, 3, "orphan-work"),
        ]));
        const commandsBefore = structuredClone(sourceEvent.commands);
        const pagesBefore = structuredClone(sourceEvent.pages);

        repairProjectReferences(project);

        expect(sourceEvent.schedule).toEqual([valid, duplicate]);
        expect(orphan.events[0]?.schedule).toEqual([scheduleRow(target.id, 3, 3, "orphan-work")]);
        expect(sourceEvent.commands).toEqual(commandsBefore);
        expect(sourceEvent.pages).toEqual(pagesBefore);
      });

      // Break caught: two scheduled map events can share one global runtime session key silently.
      it("hard-fails a scheduled event id collision while preserving legacy unscheduled duplicates", () => {
        const project = scheduleProject();
        const source = project.maps[project.startMapId]!;
        const target = project.maps.map_target!;
        source.events.push(eventWithSchedule("ev_shared", [scheduleRow(source.id, 1, 1)]));
        target.events.push(eventWithSchedule("ev_shared", [scheduleRow(target.id, 2, 2)]));

        expect(collectProjectReferenceIssues(project)).toEqual(expect.arrayContaining([
          expect.stringMatching(/scheduled event id.*ev_shared.*map_blank_start.*map_target/i),
        ]));
        expect(() => validateProjectReferences(project)).toThrow(/scheduled event id.*ev_shared/i);

        target.events[0]!.schedule = undefined;
        expect(collectProjectReferenceIssues(project)).toEqual(expect.arrayContaining([
          expect.stringMatching(/scheduled event id.*ev_shared/i),
        ]));

        source.events[0]!.schedule = undefined;
        expect(collectProjectReferenceIssues(project).some((issue) => /scheduled event id.*ev_shared/i.test(issue))).toBe(false);
      });

      // Break caught: map-deletion impact/cascade does not discover or remove nested schedule rows.
      it("identifies exact incoming rows and removes only those rows from surviving hosts", () => {
        const project = scheduleProject();
        const source = project.maps[project.startMapId]!;
        const target = project.maps.map_target!;
        const keep = addMap(project, "map_keep");
        const keepRow = scheduleRow(keep.id, 1, 1, "keep");
        const sourceEvent = eventWithSchedule("ev_multi", [
          scheduleRow(target.id, 1, 1, "target-a"),
          keepRow,
          scheduleRow(target.id, 1, 1, "target-a"),
        ]);
        const secondEvent = eventWithSchedule("ev_second", [scheduleRow(target.id, 2, 2)]);
        const preservedDuplicateEvent = eventWithSchedule("ev_keep", [keepRow, structuredClone(keepRow)]);
        source.events.push(sourceEvent, secondEvent, preservedDuplicateEvent);
        target.events.push(eventWithSchedule("ev_target_self", [scheduleRow(target.id, 3, 3)]));
        const orphan = addMap(project, "map_orphan_host", false);
        orphan.events.push(eventWithSchedule("ev_orphan", [scheduleRow(target.id, 4, 4)]));
        const commandsBefore = structuredClone(sourceEvent.commands);
        const pagesBefore = structuredClone(sourceEvent.pages);

        const impact = collectMapDeletionImpact(project, target.id);
        expect(impact?.incomingScheduleRows).toEqual([
          { hostMapId: source.id, eventId: "ev_multi", eventIndex: 0, scheduleIndex: 0 },
          { hostMapId: source.id, eventId: "ev_multi", eventIndex: 0, scheduleIndex: 2 },
          { hostMapId: source.id, eventId: "ev_second", eventIndex: 1, scheduleIndex: 0 },
          { hostMapId: orphan.id, eventId: "ev_orphan", eventIndex: 0, scheduleIndex: 0 },
        ]);

        applyMapDeletion(project, target.id);

        expect(project.maps[target.id]).toBeUndefined();
        expect(sourceEvent.schedule).toEqual([keepRow]);
        expect(secondEvent.schedule).toEqual([]);
        expect(preservedDuplicateEvent.schedule).toEqual([keepRow, keepRow]);
        expect(orphan.events[0]?.schedule).toEqual([]);
        expect(sourceEvent.commands).toEqual(commandsBefore);
        expect(sourceEvent.pages).toEqual(pagesBefore);
        for (const map of Object.values(project.maps)) {
          for (const event of map.events) {
            expect(event.schedule?.some((entry) => entry.at.mapId === target.id) ?? false).toBe(false);
          }
        }
      });

      // Characterization: ordered duplicate rows are legal first-match authoring and must round-trip byte-for-data.
      it("round-trips valid ordered schedules without deduplicating them", () => {
        const project = scheduleProject();
        const source = project.maps[project.startMapId]!;
        const row = scheduleRow("map_target", 2, 2, "work");
        source.events.push(eventWithSchedule("ev_valid", [row, structuredClone(row)]));

        const restored = deserialize(serialize(project));

        expect(restored.maps[project.startMapId]?.events[0]?.schedule).toEqual([row, row]);
      });
    });
    function scheduleProject(): Project {
      const project = createBlankProject();
      addMap(project, "map_target");
      return project;
    }
    function addMap(project: Project, id: string, attachToTree = true): GameMap {
      const template = project.maps[project.startMapId]!;
      const map = structuredClone(template);
      map.id = id;
      map.name = id;
      map.events = [];
      project.maps[id] = map;
      if (attachToTree) project.mapTree.children.push({ mapId: id, children: [] });
      return map;
    }
    function scheduleRow(
      mapId: string,
      x: number,
      y: number,
      activity?: string,
    ): NpcScheduleEntry {
      return {
        when: { hourRange: [6, 18] },
        at: { mapId, x, y },
        ...(activity ? { activity } : {}),
      };
    }
    function eventWithSchedule(id: string, schedule: NpcScheduleEntry[] | undefined): GameEvent {
      return {
        id,
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [{ kind: "text", body: `${id}:legacy` }],
        pages: [{
          id: `${id}_page`,
          name: id,
          conditions: [],
          graphic: {},
          trigger: { kind: "action" },
          priority: "same",
          overlapForbidden: true,
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [{ kind: "text", body: `${id}:page` }],
        }],
        ...(schedule === undefined ? {} : { schedule }),
      };
    }
  });
  describe("openingStage", () => {
    isolateTimers();
    const walker = (moving: boolean): AnimaticLayer => ({
      id: "w1", kind: "image", role: "actor", resourceId: "oprn-charset-modern1", x: 10, y: 100, width: 24, height: 32,
      sheet: { frameWidth: 24, frameHeight: 32, columns: 12, count: 96, fps: 0 }, walk: { stride: 8, frames: [1, 2, 1, 0] },
      keys: { x: [{ atMs: 0, value: 10 }, { atMs: 3000, value: moving ? 200 : 10 }] },
    } as AnimaticLayer);
    function withAnimatic(layer: AnimaticLayer): Project {
      const project = createBlankProject();
      project.system.opening = { enabled: true, skippable: true, scenes: [{ id: "shot1", kind: "animatic", narration: "", durationMs: 3000, composition: { width: 480, height: 270, layers: [layer] } }] };
      return project;
    }
    describe("opening-picture-walkers lint", () => {
      it("flags a charset walker moved across the shot as a picture layer", () => {
        const project = withAnimatic(walker(true));
        expect(openingPictureWalkers(project)).toEqual([{ sceneId: "shot1", layerIds: ["w1"] }]);
        expect(projectLint(project).some((issue) => issue.code === OPENING_PICTURE_WALKERS_CODE)).toBe(true);
      });

      it("does not flag a standing charset or a non-sheet picture slide (bust close-up)", () => {
        expect(openingPictureWalkers(withAnimatic(walker(false)))).toEqual([]);
        const bust = { id: "bust", kind: "image", role: "actor", resourceId: "bust", x: 0, y: 0, width: 200, height: 200, keys: { x: [{ atMs: 0, value: -60 }, { atMs: 500, value: 20 }] } } as AnimaticLayer;
        expect(openingPictureWalkers(withAnimatic(bust))).toEqual([]);
      });
    });
    describe("author_opening_stage", () => {
      it("sets system.opening.stage and compiles a skippable autorun that clears the stage flag before moving to the start", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        const ctx = { project };
        const result = runTool(ctx, "author_opening_stage", { mapId, x: 2, y: 2, beats: [{ kind: "wait", ms: 300 }] });
        expect(result.ok).toBe(true);
        const next = ctx.project;
        expect(next.system.opening?.stage).toEqual({ mapId, x: 2, y: 2, eventId: "ev_opening_stage" });
        const page = next.maps[mapId]!.events.find((event) => event.id === "ev_opening_stage")!.pages![0]!;
        expect(page.trigger).toEqual({ kind: "auto" });
        const kinds = page.commands.map((command) => command.kind);
        const clear = kinds.indexOf("setFlag"), transfer = kinds.lastIndexOf("transfer"), landing = page.commands.findIndex((command) => command.kind === "label");
        expect(landing).toBeGreaterThan(-1);
        expect(clear).toBeGreaterThan(landing);
        expect(transfer).toBeGreaterThan(clear);
        expect(page.commands[clear]).toEqual({ kind: "setFlag", flag: openingStageFlag(mapId, "ev_opening_stage"), value: false });
        // 건너뛰기 착지 뒤에 주인공 모습을 되돌린다(숨긴 채 본편이 시작되지 않게).
        const resets = page.commands.flatMap((command, index) => command.kind === "m2Command" && (command as { fields?: Record<string, unknown> }).fields?.reset ? [index] : []);
        expect(resets).toEqual([clear + 1]);
        expect(transfer).toBe(clear + 2);
        // 맵 이벤트는 이동에서 끝난다 — 이동 뒤에 명령을 남기지 않는다(scene-commands-after-transfer).
        expect(transfer).toBe(page.commands.length - 1);
      });

      it("refuses a letterbox on a stage that has captions (scene-letterbox-dialogue)", () => {
        const project = createBlankProject();
        const ctx = { project };
        const result = runTool(ctx, "author_opening_stage", { mapId: project.startMapId, x: 2, y: 2, beats: [{ kind: "letterbox", show: true }, { kind: "say", text: "봄." }] });
        expect(result.ok).toBe(false);
      });

      it("editing the picture scenes afterwards keeps the stage (edit_opening rebuilds the sequence)", () => {
        const project = createBlankProject();
        const ctx = { project };
        const mapId = project.startMapId;
        expect(runTool(ctx, "author_opening_stage", { mapId, x: 2, y: 2, beats: [{ kind: "wait", ms: 300 }] }).ok).toBe(true);
        const first = ctx.project.system.opening!.scenes[0];
        if (first) expect(runTool(ctx, "edit_opening", { op: "remove", sceneId: first.id }).ok).toBe(true);
        expect(runTool(ctx, "edit_opening", { op: "append", scene: { kind: "text", narration: "제1장", durationMs: 3000 } }).ok).toBe(true);
        expect(ctx.project.system.opening?.stage).toEqual({ mapId, x: 2, y: 2, eventId: "ev_opening_stage" });
      });

      it("stage flag names the running stage event for that map only", () => {
        const flags = { [openingStageFlag("m1", "ev_a")]: true, [openingStageFlag("m2", "ev_b")]: false };
        expect(openingStageEventId(flags, "m1")).toBe("ev_a");
        expect(openingStageEventId(flags, "m2")).toBeUndefined();
      });
    });
    describe("opening stage runtime gate", () => {
      function stageWorld(stageSelfSwitchOn: boolean) {
        const project = createBlankProject();
        const ctx = { project };
        const mapId = project.startMapId;
        expect(runTool(ctx, "author_opening_stage", { mapId, x: 2, y: 2, beats: [{ kind: "wait", ms: 300 }] }).ok).toBe(true);
        const map = ctx.project.maps[mapId]!;
        map.events.push({ id: "story_intro", x: 1, y: 1, pages: [{ id: "intro", trigger: { kind: "auto" }, conditions: [], graphic: { transparent: true }, commands: [] }] } as never);
        map.events.push({ id: "fountain", x: 3, y: 3, pages: [{ id: "loop", trigger: { kind: "parallel" }, conditions: [], graphic: { transparent: true }, commands: [] }] } as never);
        store.replace(ctx.project);
        const live = store.getCurrent(), liveMap = live.maps[mapId]!;
        const session = startSession(live);
        session.flags[openingStageFlag(mapId, "ev_opening_stage")] = true;
        if (stageSelfSwitchOn) session.selfSwitches = { ...session.selfSwitches, ev_opening_stage: { A: true } };
        const scene = { map: liveMap, session, eventPositions: initialRuntimeEventPositions(liveMap.events), getMapId: () => mapId, running: false };
        return { scene, session, mapId };
      }
      const ids = (views: { event: { id: string } }[]) => views.map((view) => view.event.id);

      it("while the stage cutscene is live only it auto-runs, and parallel events on that map wait", () => {
        const { scene } = stageWorld(false);
        expect(ids(activeRuntimeEvents(scene as never, "auto"))).toEqual(["ev_opening_stage"]);
        expect(ids(activeRuntimeEvents(scene as never, "parallel"))).toEqual([]);
      });

      it("a stale flag (stage page already off, e.g. a save taken mid-stage) is dropped instead of freezing the map", () => {
        const { scene, session, mapId } = stageWorld(true);
        expect(ids(activeRuntimeEvents(scene as never, "auto"))).toEqual(["story_intro"]);
        expect(session.flags[openingStageFlag(mapId, "ev_opening_stage")]).toBeUndefined();
        expect(ids(activeRuntimeEvents(scene as never, "parallel"))).toEqual(["fountain"]);
      });
    });
  });
  describe("referenceIntegrityRepair", () => {
    isolateTimers();
    describe("project reference integrity", () => {
      it("deserialize는 dangling mapTree 참조를 안전하게 제거한다", () => {
        const project = createBlankProject();
        const obj = JSON.parse(serialize(project));
        obj.mapTree.children.push({ mapId: "map_ember_village", children: [] });

        const restored = deserialize(JSON.stringify(obj));

        expect(JSON.stringify(restored.mapTree)).not.toContain("map_ember_village");
        expect(restored.mapTree.mapId).toBe(project.startMapId);
      });

      it("projectLint는 참조 오류를 한 번에 여러 건 보고한다", () => {
        const project = createBlankProject();
        project.database.actors[0].unarmedAnimationId = "anim_missing";
        project.database.classes[0].animationId = "anim_missing_class";
        project.database.items[0].healStateIds = ["state_missing"];

        const errors = projectLint(project).filter((issue) => issue.code === "reference-validation");

        expect(errors.map((issue) => issue.message).join("\n")).toContain("unarmedAnimationId");
        expect(errors.map((issue) => issue.message).join("\n")).toContain("class");
        expect(errors.map((issue) => issue.message).join("\n")).toContain("healState");
        expect(errors.length).toBeGreaterThanOrEqual(3);
      });

      // 2026-07-08 사고 회귀: 존재하지 않는 맵(map_dry_mine 등)으로의 transfer가 저장본에 남아
      // 프로젝트 전체가 로드 불가(벽돌)였다. 로드는 깨진 이동 명령을 정리하고 성공해야 한다.
      it("deserialize는 존재하지 않는 맵으로의 transfer/changeTile을 정리하고 로드한다", () => {
        const project = createBlankProject();
        const obj = JSON.parse(serialize(project));
        const mapId = Object.keys(obj.maps)[0];
        obj.maps[mapId].events = [
          {
            id: "ev_broken",
            name: "부서진 문",
            x: 1,
            y: 1,
            trigger: { kind: "action" },
            commands: [
              { kind: "text", text: "안녕" },
              { kind: "transfer", mapId: "map_dry_mine", x: 2, y: 3 },
              {
                kind: "choices",
                options: [
                  { text: "간다", branch: [{ kind: "transfer", mapId: "map_ember_village", x: 0, y: 0 }] },
                  { text: "안 간다", branch: [] },
                ],
              },
              { kind: "changeTile", mapId: "map_dry_mine", x: 0, y: 0, layer: "lower", tile: 1 },
            ],
          },
        ];

        const restored = deserialize(JSON.stringify(obj));

        const commands = restored.maps[mapId].events[0].commands;
        expect(JSON.stringify(commands)).not.toContain("map_dry_mine");
        expect(JSON.stringify(commands)).not.toContain("map_ember_village");
        // 로드가 문장 명령의 옛 text 칸을 본문 칸 body 로 옮긴다(commandFieldAliases, #3226 계열).
        expect(commands[0]).toMatchObject({ kind: "text", body: "안녕" });
        // 정상 명령/분기 구조는 보존된다.
        expect(commands.some((command) => command.kind === "choices")).toBe(true);
      });

      it("deserialize는 삭제된 showEmote 대상 이벤트를 현재 이벤트로 복구한다", () => {
        const project = createBlankProject();
        const mapId = project.startMapId;
        project.maps[mapId].events = [
          {
            id: "ev_emote",
            x: 1,
            y: 1,
            trigger: { kind: "action" },
            commands: [
              { kind: "showEmote", target: { eventId: "ev_target" }, emote: "heart" },
              { kind: "showEmote", target: "player", emote: "question" },
              { kind: "showEmote", target: { eventId: "ev_deleted" }, emote: "anger" },
            ],
          },
          {
            id: "ev_target",
            x: 2,
            y: 1,
            trigger: { kind: "action" },
            commands: [],
          },
          {
            id: "ev_deleted",
            x: 3,
            y: 1,
            trigger: { kind: "action" },
            commands: [],
          },
        ];
        const obj = JSON.parse(serialize(project));
        obj.maps[mapId].events = obj.maps[mapId].events.filter((event: { id: string }) => event.id !== "ev_deleted");
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        const restored = deserialize(JSON.stringify(obj));

        expect(restored.maps[mapId].events[0].commands).toEqual([
          { kind: "showEmote", target: { eventId: "ev_target" }, emote: "heart" },
          { kind: "showEmote", target: "player", emote: "question" },
          { kind: "showEmote", target: { eventId: "" }, emote: "anger" },
        ]);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining("없는 이모트 대상 이벤트를 현재 이벤트로 대체 1건"));
        warn.mockRestore();
      });

      it("deserialize는 안전하게 지울 수 있는 dangling DB 참조를 복구한다", () => {
        const project = createBlankProject();
        const obj = JSON.parse(serialize(project));
        obj.database.actors[0].unarmedAnimationId = "anim_missing";
        obj.database.classes[0].animationId = "anim_missing_class";
        obj.commonEvents = [{ id: "ce_live", name: "Live", trigger: "none", commands: [{ kind: "callCommonEvent", commonEventId: "ce_missing" }] }];

        const restored = deserialize(JSON.stringify(obj));

        expect(restored.database.actors[0].unarmedAnimationId).toBeUndefined();
        expect(restored.database.classes[0].animationId).toBeUndefined();
        expect(restored.commonEvents[0].commands).toEqual([]);
      });
    });
    // 2026-07-09 사고 회귀: 타입 상성(9b)이 skill.elementId 존재 검증을 추가하면서, 존재하지 않는
    // 속성을 가리키는 기존 저장본 스킬(skill_leaf)이 프로젝트 전체 로드 실패(벽돌)를 일으켰다.
    // 로드는 깨진 elementId를 제거하고 성공해야 한다.
    describe("skill elementId 로드 복구", () => {
      it("deserialize는 존재하지 않는 elementId를 가진 스킬을 정리하고 로드한다", () => {
        const project = createBlankProject();
        const obj = JSON.parse(serialize(project));
        obj.database.skills[0].elementId = "element_missing";

        const restored = deserialize(JSON.stringify(obj));

        expect(restored.database.skills[0].elementId).toBeUndefined();
      });
    });
  });
  // test/scarloxyIndoorFurnitureBlocks.test.ts
  // 계약: Scarloxy 실내 치프셋은 가구를 **의미 단위 그룹**으로 노출한다.
  //
  // 실측 근거(2026-08-30): 실내 치프셋 블록이 `indoor-all` 하나뿐이라 침대·소파·모니터·창문이
  // 전부 한 그룹(role=terrain, 통행 가능)으로 묶였다. 그 상태에서는 "침대만 놓아라" 같은 요청을
  // 도구 어휘로 표현할 수 없어 AI 실내 저작이 불가능했다.
  describe("scarloxyIndoorFurnitureBlocks", () => {
    isolateTimers();
    const INDOOR_TEXTURE = "tex_scarloxy_chipset_indoor";
    const EXPECTED_FURNITURE = [
      "bed-mint",
      "counter-wood",
      "wall-window",
      "bed-lavender",
      "cabinet-white",
      "wall-screen",
      "sofa-yellow",
      "sofa-mint",
    ] as const;
    const indoorChipset = () => {
      const chipset = SCARLOXY_PACK_MANIFEST.chipsets.find((entry) => entry.file.includes("indoor"));
      if (!chipset) throw new Error("indoor chipset missing from manifest");
      return chipset;
    };
    describe("scarloxy indoor chipset exposes furniture as separate groups", () => {
      it("매니페스트가 가구 블록 8개를 갖고, 뭉뚱그린 indoor-all 은 없다", () => {
        const names = indoorChipset().blocks.map((block) => block.name);
        expect(names).toEqual([...EXPECTED_FURNITURE]);
        expect(names).not.toContain("indoor-all");
      });

      it("블록은 시트 안에 있고 서로 겹치지 않는다", () => {
        const claimed = new Map<string, string>();
        for (const block of indoorChipset().blocks) {
          expect(block.col).toBeGreaterThanOrEqual(0);
          expect(block.row).toBeGreaterThanOrEqual(0);
          expect(block.w).toBeGreaterThan(0);
          expect(block.h).toBeGreaterThan(0);
          for (let row = block.row; row < block.row + block.h; row += 1) {
            for (let col = block.col; col < block.col + block.w; col += 1) {
              const cell = `${col},${row}`;
              expect(claimed.get(cell)).toBeUndefined();
              claimed.set(cell, block.name);
            }
          }
        }
      });

      it("그룹 시드가 가구 이름별로 갈리고 전부 상층·통행 불가 프롭이다", () => {
        const seeds = scarloxyChipsetGroupSeeds(INDOOR_TEXTURE);
        expect(seeds.map((seed) => seed.key)).toEqual([...EXPECTED_FURNITURE]);
        for (const seed of seeds) {
          expect(seed.role).toBe("prop");
          expect(seed.defaultLayer).toBe("upper");
          expect(seed.passage).toBe("solid");
          expect(seed.repeatability).toBe("fixed");
          expect(seed.tileIds.length).toBeGreaterThan(0);
          expect(seed.name).not.toBe(seed.key); // 한국어 라벨이 붙어 있다
        }
      });

      it("포켓몬 데모 타일셋에 8개 그룹이 실제로 붙고 프로젝트 무결성이 유지된다", () => {
        const project = createScarloxyPokemonDemoProject();
        ensureTilesetHarnesses(project);
        const tileset = Object.values(project.tilesets)
          .find((entry) => entry.image.type === "bundled" && entry.image.id === INDOOR_TEXTURE);
        expect(tileset).toBeDefined();
        expect((tileset?.tileGroups ?? []).length).toBe(EXPECTED_FURNITURE.length);

        expect(collectProjectReferenceIssues(project)).toEqual([]);
        expect(projectLint(project).filter((issue) => issue.severity === "error")).toEqual([]);
      });
    });
  });
  describe("storyArcQualityTools", () => {
    isolateTimers();
    const ARC_ARGS = {
      id: "first-steps",
      title: "First Steps",
      mapId: "map_blank_start",
      eventId: "ev_first_steps",
      at: { x: 5, y: 5 },
      opening: ["Welcome."],
      tutorialObjectives: [
        { id: "listen", text: "Listen to the guide." },
        { id: "decide", text: "Make a choice." },
      ],
      branchChoices: [
        { id: "help", label: "Help", lines: ["Find the passage."] },
        { id: "leave", label: "Leave", lines: ["Leave for now."] },
      ],
      twist: {
        enabled: true,
        flagId: "guide-is-royal",
        description: "The guide is royal.",
        discoverInBranchId: "help",
        reveal: ["The guide was royal."],
      },
    } as const;
    type ArcData = {
      readonly eventId: string;
      readonly questId: string;
      readonly objectiveFlagIds: readonly string[];
      readonly choiceVariableId: string;
      readonly twistFlagId?: string;
      readonly twistSwitchId?: string;
    };
    describe("author_story_arc", () => {
      it("creates a serializable tutorial with two executable branches and a twist write/read", () => {
        const context = { project: createBlankProject() };
        const result = runTool(context, "author_story_arc", ARC_ARGS);
        expect(result.ok, result.summary).toBe(true);
        const ids = result.data as ArcData;
        const commands = context.project.maps.map_blank_start?.events.find((event) => event.id === ids.eventId)?.pages?.[0]?.commands ?? [];
        const choices = commands.find((command) => command.kind === "choices");
        expect(choices?.kind === "choices" ? choices.options : []).toHaveLength(2);
        expect(choices?.kind === "choices" && choices.options.every((option) => option.branch.some((command) => command.kind === "setVariable"))).toBe(true);
        expect(commands.some((command) => command.kind === "fork" && command.condition.kind === "switch" && command.condition.switchId === ids.twistSwitchId)).toBe(true);
        expect(projectLint(context.project).filter((issue) => issue.severity === "error")).toEqual([]);
        expect(deserialize(serialize(context.project)).quests?.some((quest) => ("id" in quest ? quest.id : quest.key) === ids.questId)).toBe(true);
      });

      it("rejects structurally dead objectives and branches", () => {
        const deadObjective = structuredClone(ARC_ARGS) as Record<string, unknown>;
        deadObjective.tutorialObjectives = [{ id: "empty", text: "" }];
        expect(runTool({ project: createBlankProject() }, "author_story_arc", deadObjective).issues?.[0]?.code).toBe("story-arc-dead-objective");
        const deadBranch = structuredClone(ARC_ARGS) as Record<string, unknown>;
        deadBranch.branchChoices = [{ id: "help", label: "Help", lines: [] }, { id: "leave", label: "Leave", lines: ["Go."] }];
        expect(runTool({ project: createBlankProject() }, "author_story_arc", deadBranch).issues?.[0]?.code).toBe("story-arc-dead-branch");
      });
    });
    describe("evaluate_game_quality", () => {
      it("traverses every owner and nested branch family without mutation", () => {
        const project = createBlankProject();
        const nested: Command[] = [{
          kind: "choices",
          options: [{ text: "A", branch: [{ kind: "fork", condition: { kind: "switch", switchId: "sw_0001", value: true }, then: [{ kind: "text", body: "then" }], else: [{ kind: "text", body: "else" }] }] }],
          cancelBehavior: "branch",
          cancelBranch: [{ kind: "loop", body: [{ kind: "breakLoop" }] }],
        }];
        const event: GameEvent = { id: "ev_quality", x: 2, y: 2, trigger: { kind: "action" }, commands: nested, pages: [{ id: "page_quality", name: "quality", conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "page" }] }] };
        project.maps[project.startMapId]?.events.push(event);
        project.commonEvents.push({ id: "ce_quality", name: "quality", trigger: "none", commands: [{ kind: "text", body: "common" }] });
        project.database.troops[0]?.battleEventPages.push({ id: "tp_quality", name: "quality", span: "turn", conditions: [], commands: [{ kind: "text", body: "troop" }] });
        const before = serialize(project);
        const result = runTool({ project }, "evaluate_game_quality", { walkthroughResults: [{ id: "main", ok: true }] });
        expect(serialize(project)).toBe(before);
        const data = result.data as { coverage: { commandOwners: Record<string, number>; nestedBranches: Record<string, number> }; limitations: string[] };
        expect(data.coverage.commandOwners).toMatchObject({ legacyEvent: 1, eventPage: 1, commonEvent: 1, troopPage: 1 });
        expect(data.coverage.nestedBranches).toMatchObject({ choiceOption: 1, choiceCancel: 1, forkThen: 1, forkElse: 1, loopBody: 1 });
        expect(data.limitations.join(" ")).toContain("fun");
        expect(JSON.stringify(data)).not.toMatch(/"score"\s*:/u);
      });

      it("blocks only on objective lint errors and always reports limitations", () => {
        const advisoryProject = createBlankProject();
        advisoryProject.world = { entities: [{ id: "bad-ref", type: "place", name: "Bad", summary: "Broken", origin: "user", refs: [{ kind: "map", id: "missing" }] }], relations: [] };
        const advisory = runTool({ project: advisoryProject }, "evaluate_game_quality", {}).data as { verdict: { blocked: boolean }; limitations: string[] };
        expect(advisory.verdict.blocked).toBe(false);
        expect(advisory.limitations).toHaveLength(5);
        const broken = createBlankProject();
        broken.startMapId = "missing";
        const blocked = runTool({ project: broken }, "evaluate_game_quality", {}).data as { verdict: { blocked: boolean; objectiveErrorCount: number } };
        expect(blocked.verdict.blocked).toBe(true);
        expect(blocked.verdict.objectiveErrorCount).toBeGreaterThan(0);
      });
    });
    describe("routing and policy", () => {
      beforeEach(() => resetAssistantToolDomainMemory());
      it("exposes both tools for their wording", () => {
        const narrative = computeActiveToolDomains(declaredIntent({ tools: ["author_story_arc", "define_quest"] }));
        expect(narrative.has("event") && narrative.has("quest")).toBe(true);
        expect(toOpenAiTools(undefined, { domains: narrative }).map((tool) => tool.function.name)).toContain("author_story_arc");
        const quality = computeActiveToolDomains(declaredIntent({ mode: "question", tools: ["evaluate_game_quality"] }));
        expect(quality.has("system")).toBe(true);
        expect(toOpenAiTools(undefined, { domains: quality }).map((tool) => tool.function.name)).toContain("evaluate_game_quality");
      });
      it("registers and recommends the facades", () => {
        expect(getTool("author_story_arc")?.mode).toBe("write");
        expect(getTool("evaluate_game_quality")?.mode).toBe("read");
        const prompt = buildSystemPrompt(createBlankProject());
        expect(prompt).toContain("author_story_arc로 작성");
        expect(prompt).toContain("evaluate_game_quality");
      });
    });
  });
});

describe("projectResetTool", { timeout: 120000 }, () => {
  isolateTimers();
  // 시험 시간 한도는 수집 때 읽혀 beforeAll 안 vi.setConfig 는 듣지 않는다 — describe 옵션 timeout 으로 둔다.
  // createBlankProject() 는 호출마다 약 80MB 를 새로 만든다(test/support/blankProject.ts 머리말) — 이 파일의 느린 케이스는 한 케이스에 그것을 여러 번 부르거나 부르는 제품 함수를 돌려
  // CI(4코어 호스티드 러너)에서 11~15초가 걸려 기본 15초 제한에 걸리거나 닿을 듯하다. 판정은 그대로 두고 제한만 이 파일의 다른 무거운 시험과 같이 넓힌다.
  const CONFIG = { authMode: "apiKey" as const, baseUrl: "x", model: "stub-model", apiKey: "sk", maxToolCalls: 4, maxTokens: 1024 };
  function scriptedChat(steps: readonly ChatResult[]) {
    let index = 0;
    return async (): Promise<ChatResult> => steps[index++];
  }
  function resetCall(args: Record<string, unknown>): ChatResult {
    return {
      message: { role: "assistant", content: null, tool_calls: [{ id: "c_reset", type: "function", function: { name: "reset_project", arguments: JSON.stringify(args) } }] },
      finishReason: "tool_calls",
    } as ChatResult;
  }
  function finalMessage(): ChatResult {
    return { message: { role: "assistant", content: "새 프로젝트 초안을 제안합니다." }, finishReason: "stop" } as ChatResult;
  }
  describe("reset_project", () => {
    it("deterministically replaces old content with a valid blank seed and applies title/genre", () => {
      const old = createBlankProject();
      old.maps[old.startMapId].events.push({
        id: "old_event",
        x: 1,
        y: 1,
        trigger: { kind: "action" },
        commands: [],
        pages: [{
          id: "old_event_page",
          name: "old",
          conditions: [],
          graphic: { transparent: true },
          trigger: { kind: "action" },
          priority: "same",
          movement: { type: "fixed", speed: 3, frequency: 3 },
          commands: [],
        }],
      });
      old.database.items.push({ ...old.database.items[0], id: "old_item", name: "old" });
      const first: ToolContext = { project: structuredClone(old) };
      const second: ToolContext = { project: structuredClone(old) };
      const args = { prompt: "작은 농장 생활 RPG를 처음부터 시작해줘", title: "달빛 농장", genrePreset: "farm-life" };

      const firstResult = runTool(first, "reset_project", args);
      const secondResult = runTool(second, "reset_project", args);

      expect(firstResult.ok, firstResult.summary).toBe(true);
      expect(secondResult.ok, secondResult.summary).toBe(true);
      // 오프닝 장면 id 는 매번 새로 뽑는다(openingPresets/defaultOpeningSequence 의 genId — 편집 선택이 옛 장면을 가리키지 않게).
      // 그 id 만 떼고 나머지 내용이 같은지 본다.
      const withoutSceneIds = (project: ToolContext["project"]) => {
        const copy = structuredClone(project);
        for (const scene of copy.system.opening?.scenes ?? []) (scene as { id?: string }).id = "";
        return copy;
      };
      expect(withoutSceneIds(first.project)).toEqual(withoutSceneIds(second.project));
      expect(() => deserialize(serialize(first.project))).not.toThrow();
      expect(first.project.meta.title).toBe("달빛 농장");
      expect(first.project.system.titleScreen?.title).toBe("달빛 농장");
      expect(first.project.system.genre).toBe("farm-life");
      expect(first.project.system.timeSystem?.enabled).toBe(true);
      expect(Object.values(first.project.maps).flatMap((map) => map.events).some((event) => event.id === "old_event")).toBe(false);
      expect(first.project.database.items.some((item) => item.id === "old_item")).toBe(false);
      expect(firstResult.data).toEqual({ title: "달빛 농장", genrePreset: "farm-life" });
      expect(firstResult.data).not.toHaveProperty("project");
    });

    it("bounds abstract input and never accepts a raw project payload", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const overlong = runTool(ctx, "reset_project", { prompt: "x".repeat(2001), title: "new" });
      const rawPayload = runTool(ctx, "reset_project", { prompt: "new game", title: "new", project: createBlankProject() });

      expect(overlong.ok).toBe(false);
      expect(overlong.issues?.[0]?.code).toBe("invalid-args");
      expect(rawPayload.ok).toBe(false);
      expect(rawPayload.issues?.[0]?.code).toBe("invalid-args");
    });

    it("remains a destructive proposal but no longer crosses an approval boundary", async () => {
      const project = createBlankProject();
      const session = new AssistantSession(project, {
        chat: scriptedChat([resetCall({ prompt: "새 게임 시작", title: "새 출발" }), finalMessage()]),
        config: CONFIG,
      });

      const result = await session.sendUserMessage("새 프로젝트로 처음부터 시작해줘");
      expect(result.proposedCalls).toHaveLength(1);
      expect(result.proposedCalls[0]).toMatchObject({ name: "reset_project", destructive: true, requiresApproval: true });
      expect(session.getProposedProject().meta.title).toBe("새 출발");
    // 한도 60초: 빈 프로젝트(수십 MB) 위에서 세션 한 턴을 돈다 — AssistantSession 생성과 턴의 초안 복제·검수(structuredClone · 왕복 직렬화 검사 · 통째 지문)가
    // 프로젝트를 여러 번 통째로 훑는다. 러너에서 12.5~23.1초였다(ci-full 11-05~11-15 일곱 실행 16.0·12.5·19.5·20.6·21.2·17.9·23.1 · ci-vitest-files 43718681723 에서 16.0)
    // — 기본 한도 15초를 넘나들고, 기준선(2026-10-26)에도 timeout 으로 적혀 있었다. 그 열흘 사이 커밋에 따라 늘지 않았다. 이 경우만 한도를 둔다.
    }, 60_000);

    it("makes reset-rooted proposal replay all-or-nothing", () => {
      const baseline = createBlankProject();
      const ctx: ToolContext = { project: structuredClone(baseline) };
      const resetArgs = { prompt: "새 시작", title: "새 세계" };
      const resetResult = runTool(ctx, "reset_project", resetArgs);
      const downstreamResult = runTool(ctx, "set_title_screen", { title: "최종 제목" });
      if (!resetResult.ok || !downstreamResult.ok) throw new Error("proposal setup failed");
      const calls = [
        { name: "reset_project", args: resetArgs, summary: resetResult.summary, result: resetResult, destructive: true, requiresApproval: true },
        { name: "set_title_screen", args: { title: "최종 제목" }, summary: downstreamResult.summary, result: downstreamResult, destructive: false },
      ];

      const excludedReset = reassembleSelectedProposalProject(baseline, calls, [false, true]);
      const excludedDownstream = reassembleSelectedProposalProject(baseline, calls, [true, false]);

      expect(excludedReset.ok).toBe(false);
      expect(excludedDownstream.ok).toBe(false);
    });

    it("keeps the pre-reset project available through undo after applying a reset proposal", async () => {
      vi.stubEnv("VITE_LEGACY_DB_ANON_KEY", "");
      vi.stubEnv("VITE_LEGACY_DB_PROJECT_ID", "");
      vi.stubEnv("VITE_LEGACY_DB_URL", "");
      try {
        const before = createBlankProject();
        before.meta.title = "되돌릴 프로젝트";
        store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
        store.replaceProject(before);
        resetMapEditHistory();
        const base = captureProposalBase(store.getCurrent());
        const proposed = createBlankProject();
        proposed.meta.title = "초기화된 프로젝트";

        const result = await applyProposedProject(proposed, {
          base,
          baseline: new AuthoredProjectBaseline(before),
          source: "agent",
          summary: "프로젝트 초기화",
          toolNames: ["reset_project"],
          resetProject: true,
        });

        expect(result.ok).toBe(true);
        expect(store.getCurrent().meta.title).toBe("초기화된 프로젝트");
        expect(undoMapEdit()).toBe(true);
        expect(store.getCurrent().meta.title).toBe("되돌릴 프로젝트");
      } finally {
        vi.unstubAllEnvs();
      }
    });
  });
});
