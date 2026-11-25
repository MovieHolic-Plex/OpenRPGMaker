import { describe, expect, it } from "vitest";
import { ToolReadEvidence } from "@/ai/toolReadEvidence";
import { runTool } from "@/editor/tools";
import { goblinId, slimeId, monsterContext, monsterWriters } from "./monsterAiFixture";
import { parseVerificationChecks } from "@/ai/toolVerificationEvidence";
import { parseOrchestratorDecision, workPlanFromOrchestratorDecision, workPlanFromSetToolArgs, parsePlannerVolume } from "@/ai/workPlan";
import { MAX_VOLUME_CONTINUES_PER_TURN, formatVolumeContinueMessage, measureVolume, placedNpcIdFrom, verifyPlacedNpcsHaveStatePages, volumeGaps, volumeUnmet } from "@/ai/volumeContract";
import { createBlankProject } from "@/project/defaults";
import type { Command, Condition, GameEvent, Project } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("monsterAppearanceAdversarial", () => {
  isolateTimers();
  const readArgs = { resourceId: goblinId };
  describe.each(monsterWriters)("$name adversarial appearance boundary", writer => {
    it("rejects declared goblin identity when full selected metadata describes slime", () => {
      // Given full current slime metadata.
      const ctx = monsterContext();
      const evidence = new ToolReadEvidence();
      evidence.begin(undefined);
      const args = { resourceId: slimeId };
      evidence.observe("get_monster_resource", args, runTool(ctx, "get_monster_resource", args));
      // When desired visible identity conflicts with that resource.
      const result = evidence.beforeWrite(ctx.project, writer.name, { ...writer.args({ monsterResourceId: slimeId }), appearanceTags: ["goblin"] });
      // Then mismatch is explicit, not a fallback or name comparison.
      expect(result?.issues?.[0]?.code).toBe("monster-appearance-mismatch");
    });

    it.each([undefined, [], [""], ["   "], [1], "goblin", ["goblin".repeat(20)], Array(33).fill("goblin")])(
      "rejects missing or malformed appearanceTags %j after full lookup", appearanceTags => {
        // Given an observed, full, current resource.
        const ctx = monsterContext();
        const evidence = new ToolReadEvidence();
        evidence.begin(undefined);
        evidence.observe("get_monster_resource", readArgs, runTool(ctx, "get_monster_resource", readArgs));
        // When the selection lacks a valid declared identity.
        const result = evidence.beforeWrite(ctx.project, writer.name, { ...writer.args({ monsterResourceId: goblinId }), appearanceTags });
        // Then full lookup alone cannot replace the appearance declaration.
        expect(result?.issues?.[0]?.code).toBe("monster-appearance-tags-required");
      },
    );

    it("accepts intentional custom names without persisting appearanceTags", () => {
      // Given a full goblin lookup and an unrelated boss display name.
      const ctx = monsterContext();
      const evidence = new ToolReadEvidence();
      evidence.begin(undefined);
      evidence.observe("get_monster_resource", readArgs, runTool(ctx, "get_monster_resource", readArgs));
      const args = { ...writer.args({ monsterResourceId: goblinId }), appearanceTags: [" GOBLIN "] };
      expect(evidence.beforeWrite(ctx.project, writer.name, args)).toBeNull();
      // When executing the writer through its public schema.
      const result = runTool(ctx, writer.name, args);
      // Then the custom name and exact art survive, while the envelope is not data.
      expect(result.ok, result.summary).toBe(true);
      expect(result.data).toMatchObject(writer.name === "make_action_enemy" ? { enemyId: "enemy_ai_test" } : { name: "The Last Emperor" });
      expect(result.data).not.toHaveProperty("appearanceTags");
      expect(JSON.stringify(ctx.project.database)).not.toContain('"appearanceTags"');
    });

    it("invalidates evidence when effective description changes without changing the ID", () => {
      // Given successful full metadata evidence.
      const ctx = monsterContext();
      const evidence = new ToolReadEvidence();
      evidence.begin(undefined);
      evidence.observe("get_monster_resource", readArgs, runTool(ctx, "get_monster_resource", readArgs));
      Object.assign(ctx.project, { monsterMetadata: { [goblinId]: { tags: ["goblin"], description: "changed after read" } } });
      // When writing with a stale snapshot of the same exact resource.
      const result = evidence.beforeWrite(ctx.project, writer.name, { ...writer.args({ monsterResourceId: goblinId }), appearanceTags: ["goblin"] });
      // Then stale evidence cannot authorize it.
      expect(result?.issues?.[0]?.code).toBe("monster-resource-read-required");
    });

    it("keeps unchanged art edits valid without rereading metadata", () => {
      // Given an existing record with explicitly chosen art.
      const ctx = monsterContext();
      expect(runTool(ctx, writer.name, writer.args({ monsterResourceId: goblinId })).ok).toBe(true);
      const evidence = new ToolReadEvidence();
      evidence.begin(undefined);
      // When writing the same graphic with no appearance declaration.
      const result = evidence.beforeWrite(ctx.project, writer.name, writer.args({ monsterResourceId: goblinId }));
      // Then this is not a new selection.
      expect(result).toBeNull();
    });

    it("does not allow malformed or partial full-read payloads to authorize", () => {
      // Given a nominally successful but incomplete payload.
      const ctx = monsterContext();
      const evidence = new ToolReadEvidence();
      evidence.begin(undefined);
      evidence.observe("get_monster_resource", readArgs, { ok: true, summary: "", data: { resource: { resourceId: goblinId, description: "" } } });
      // When attempting to use it as full current metadata.
      const result = evidence.beforeWrite(ctx.project, writer.name, { ...writer.args({ monsterResourceId: goblinId }), appearanceTags: ["goblin"] });
      // Then exact metadata equality fails closed.
      expect(result?.issues?.[0]?.code).toBe("monster-resource-read-required");
    });
  });
  it("authorizes only returned full page IDs, not all requested IDs", () => {
    // Given an explicit two-ID full lookup with a one-record page.
    const ctx = monsterContext();
    const evidence = new ToolReadEvidence();
    evidence.begin(undefined);
    const args = { ids: [goblinId, slimeId], include: "full", limit: 1 };
    evidence.observe("list_monster_resources", args, runTool(ctx, "list_monster_resources", args));
    // When writing the unreturned second resource.
    const result = evidence.beforeWrite(ctx.project, "upsert_enemy", { enemy: { id: "new", name: "Boss", monsterResourceId: slimeId }, appearanceTags: ["slime"] });
    // Then requested IDs are not evidence of delivered data.
    expect(result?.issues?.[0]?.code).toBe("monster-resource-read-required");
  });
});

describe("verificationCheckSingleObject", () => {
  isolateTimers();
  const lint = "run_lint";
  const scene = "run_scene_test";
  const oneStep = {
    mapId: "map_cellar",
    start: { x: 1, y: 2 },
    steps: [{ kind: "interact", eventId: "chest" }],
  };
  const twoSteps = {
    mapId: "map_cellar",
    start: { x: 1, y: 2 },
    steps: [
      { kind: "interact", eventId: "chest" },
      { kind: "interact", eventId: "chief" },
    ],
  };
  describe("verification checks accept a single object where the schema asks for an array", () => {
    it("stores one lint declaration sent as an object", () => {
      const check = { tool: lint, args: {} };
      expect(parseVerificationChecks(check)).toEqual([check]);
      const plan = workPlanFromSetToolArgs({
        goal: "Lint the cellar",
        layers: [{ title: "QA", items: [{ title: "Lint", instruction: "Lint", successTools: [lint], verificationChecks: check }] }],
      });
      expect(plan?.layers[0]?.items[0]?.verificationChecks).toEqual([check]);
    });

    it("stores one scene interaction target sent as an object", () => {
      const stored = [{
        tool: scene,
        args: oneStep,
        interactionTargets: [{ stepIndex: 0, mapId: "map_cellar", eventId: "chest" }],
      }];
      expect(parseVerificationChecks({
        tool: scene,
        args: oneStep,
        interactionTargets: { stepIndex: "0", mapId: "map_cellar", eventId: "chest" },
      })).toEqual(stored);

      const raw = JSON.stringify({
        action: "new_plan",
        goal: "Check the chest",
        layers: [{ title: "QA", items: [{
          title: "Scene",
          instruction: "Open the chest",
          successTools: [scene],
          verificationChecks: {
            tool: scene,
            args: oneStep,
            interactionTargets: { stepIndex: 0, mapId: "map_cellar", eventId: "chest" },
          },
        }] }],
      });
      const { decision } = parseOrchestratorDecision(raw);
      if (!decision || decision.action !== "new_plan") throw new Error("expected plan");
      expect(workPlanFromOrchestratorDecision(decision).layers[0]?.items[0]?.verificationChecks).toEqual(stored);
    });

    it("still drops a non-object, a bad check, and a one-target scene that skips an interact step", () => {
      expect(parseVerificationChecks("run_lint")).toBeUndefined();
      expect(parseVerificationChecks(null)).toBeUndefined();
      expect(parseVerificationChecks(1)).toBeUndefined();
      expect(parseVerificationChecks({ tool: "not_a_tool", args: {} })).toBeUndefined();
      expect(parseVerificationChecks({
        tool: scene,
        args: twoSteps,
        interactionTargets: { stepIndex: 0, mapId: "map_cellar", eventId: "chest" },
      })).toBeUndefined();
      expect(parseVerificationChecks([
        { tool: lint, args: {} },
        { tool: "not_a_tool", args: {} },
      ])).toBeUndefined();
    });
  });
});

describe("volumeContract", () => {
  isolateTimers();
  function withEvents(events: GameEvent[]): Project {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    map.events = events;
    return project;
  }
  function npc(id: string, pages: Array<{ conditions: Condition[]; commands?: Command[] }>): GameEvent {
    return {
      id,
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [],
      pages: pages.map((page, index) => ({
        id: `p${index}`,
        name: `p${index}`,
        conditions: page.conditions,
        graphic: {},
        trigger: { kind: "action" },
        priority: "same",
        movement: { type: "fixed", speed: 4, frequency: 3 },
        commands: page.commands ?? [],
      })),
    };
  }
  describe("volume contract — 막대는 플래너가 선언한다", () => {
    // 2026-09-03 실측: 「마을|RPG」 정규식 막대가 「이 마을에 상인 하나 추가해줘」를 맵 3장·NPC 6명으로 키우고,
    // 「마을은 만들지 말고 여관만」의 부정을 읽지 못했다. 문장에서 막대를 만드는 함수는 이제 없다.
    it("플래너 volume 은 0 이상 정수만 받고 전부 0 이면 없는 것이다", () => {
      expect(parsePlannerVolume({ authoredMaps: 1, multiPageNpcs: 3, shops: 1, quests: 0 })).toEqual({
        authoredMaps: 1, multiPageNpcs: 3, shops: 1, quests: 0,
      });
      expect(parsePlannerVolume({ authoredMaps: -2, multiPageNpcs: 2.9, shops: "1", quests: 999 })).toEqual({
        authoredMaps: 0, multiPageNpcs: 2, shops: 0, quests: 999,
      });
      expect(parsePlannerVolume({ authoredMaps: 0, multiPageNpcs: 0, shops: 0, quests: 0 })).toBeNull();
      expect(parsePlannerVolume(undefined)).toBeNull();
      expect(parsePlannerVolume("many")).toBeNull();
    });
  });
  describe("volume contract — 델타 측정", () => {
    it("빈 프로젝트는 저작 맵 0, 한 줄 NPC는 다중 페이지로 세지 않는다", () => {
      const before = measureVolume(createBlankProject());
      expect(before.authoredMaps).toBe(0);
      expect(before.multiPageNpcs).toBe(0);
      const after = measureVolume(
        withEvents([
          npc("ev_thin", [{ conditions: [] }, { conditions: [] }]),
          npc("ev_state", [
            { conditions: [] },
            { conditions: [{ kind: "selfSwitch", key: "A", value: true }] },
          ]),
        ]),
      );
      expect(after.multiPageNpcs).toBe(1);
    });

    it("상점은 shop 커맨드가 있는 이벤트로 센다", () => {
      const project = withEvents([
        npc("ev_shop", [{ conditions: [], commands: [{ kind: "shop", itemIds: [] }] }]),
      ]);
      expect(measureVolume(project).shops).toBe(1);
    });

    it("막대 미달은 gaps + unmet 으로만 판정한다", () => {
      const before = measureVolume(createBlankProject());
      const after = measureVolume(createBlankProject());
      const bar = { authoredMaps: 1, multiPageNpcs: 3, shops: 1, quests: 0 };
      const gaps = volumeGaps(before, after, bar);
      expect(gaps.some((gap) => gap.includes("맵"))).toBe(true);
      expect(gaps.some((gap) => gap.includes("NPC"))).toBe(true);
      expect(volumeUnmet(before, after, bar)).toBe(true);
      expect(formatVolumeContinueMessage(gaps)).toContain("HARNESS CONTINUE");
      expect(formatVolumeContinueMessage(gaps)).toContain("Do not ask the user to continue");
    });

    it("재주입 상한은 사용자 상한이 아니라 안전핀이다", () => {
      expect(MAX_VOLUME_CONTINUES_PER_TURN).toBe(3);
    });
  });
  describe("volume contract — 상태별 NPC 게이트", () => {
    it("allows an ordinary one-page guide without inventing stateful behavior", () => {
      const project = withEvents([npc("guide", [{ conditions: [], commands: [{ kind: "text", body: "Go east." }] }])]);
      expect(verifyPlacedNpcsHaveStatePages(project, ["guide"]).ok).toBe(true);
      expect(verifyPlacedNpcsHaveStatePages(project, ["guide"], true).ok).toBe(false);
      const before = measureVolume(createBlankProject());
      expect(volumeUnmet(before, measureVolume(project), {
        authoredMaps: 0, multiPageNpcs: 1, shops: 0, quests: 0,
      })).toBe(true);
    });

    it("place_npc 결과 eventId 를 뽑는다", () => {
      expect(placedNpcIdFrom("place_npc", { eventId: "ev_chief" })).toBe("ev_chief");
      expect(placedNpcIdFrom("make_villager", undefined, { eventId: "ev_from_args" })).toBe("ev_from_args");
      expect(placedNpcIdFrom("fill_region", { eventId: "nope" })).toBeNull();
    });

    it("한 줄 인사 NPC 는 완료를 막고, 조건이 다른 페이지면 통과한다", () => {
      const project = withEvents([
        npc("ev_thin", [{ conditions: [] }]),
        npc("ev_ok", [
          { conditions: [] },
          { conditions: [{ kind: "switch", switchId: "story_met", value: true }] },
        ]),
      ]);
      const blocked = verifyPlacedNpcsHaveStatePages(project, ["ev_thin"], true);
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) expect(blocked.reason).toContain("ev_thin");
      expect(verifyPlacedNpcsHaveStatePages(project, ["ev_ok"], true).ok).toBe(true);
      expect(verifyPlacedNpcsHaveStatePages(project, []).ok).toBe(true);
    });
  });
});
