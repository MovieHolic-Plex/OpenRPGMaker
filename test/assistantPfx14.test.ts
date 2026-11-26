import { describe, expect, it, afterEach, beforeEach, vi, beforeAll } from "vitest";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { parseAcceptanceCriteria } from "@/ai/assistantAcceptance";
import { parseIntentDeclaration, type IntentFacts } from "@/ai/intentDeclaration";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { isWorkPlanComplete, skipWorkItemById, workPlanFromSetToolArgs } from "@/ai/workPlan";
import { freshBlankProject as createBlankProject, ownTileset } from "./support/blankProject";
import { runSceneTest } from "@/testing/sceneTestRunner";
import { IDBFactory } from "fake-indexeddb";
import { resetAiRecordDbForTest, writeAiRecords } from "@/ai/aiRecordDb";
import { readLatestRunCheckpoint, saveRunCheckpoint, runCheckpointId, type RunCheckpoint } from "@/ai/runCheckpointStore";
import { checkpointContentIdentity, isRunRuntimeState, reconcileRunCheckpoint, restoreCheckpointBaselines, type RunRuntimeState } from "@/ai/runRecovery";
import { checkpointProjectView } from "@/ai/checkpointPayload";
import { runTool } from "@/editor/tools";
import { verificationJourney } from "./fixtures/verificationOwnership";
import { isolateTimers } from "./mergedTeardown";
import { AssistantImageEvidence } from "@/ai/assistantImageEvidence";
import type { Project } from "@/project/types";
import "fake-indexeddb/auto";

describe("assistantAcceptanceLedger", () => {
  isolateTimers();
  describe("actionAcceptanceRequirements", () => {
    isolateTimers();
    function setup() {
      const project = createBlankProject();
      const target = { mapId: project.startMapId };
      const ledger = new AssistantAcceptanceLedger("goal", "Action arena", project);
      ledger.adopt([{ id: "spatial", title: "Map", criteria: [{ kind: "preserve", target }] }]);
      return { project, target, ledger };
    }
    describe("authoritative action acceptance", () => {
      it("represents action proof separately from static map criteria", () => {
        const { target } = setup();
        expect(parseAcceptanceCriteria([{ kind: "actionCombat", target }])).toEqual([{ kind: "actionCombat", target }]);
        expect(parseAcceptanceCriteria([{ kind: "actionCombat", target, pass: true }])).toBeNull();
      });

      it("retains structured action requirements outside replacement plans and repairs", () => {
        const { project, target, ledger } = setup();
        ledger.requireActionCombat([target]);
        ledger.adopt([{ id: "missing", title: "Repair", criteria: null }]);
        expect(ledger.repair("missing", [{ kind: "preserve", target }])).toMatchObject({ ok: true, code: "repaired" });
        const replacement = workPlanFromSetToolArgs({
          goal: "Spatial-only replacement",
          acceptance: [{ id: "spatial", title: "No combat", criteria: [{ kind: "preserve", target }] }],
          layers: [{ title: "Check", items: [{ title: "Inspect", instruction: "Inspect" }] }],
        });
        ledger.adopt(replacement?.acceptance ?? []);
        ledger.resume();
        const snapshot = ledger.evaluate(project);
        expect(snapshot.status).not.toBe("verified");
        expect(snapshot.items.flatMap(item => item.evidence).filter(e => !e.passed)).toHaveLength(1);
      });

      it("does not accept a wait/spawn-only scene result or forged combat receipt", () => {
        const { project, target, ledger } = setup();
        ledger.requireActionCombat([target]);
        const scene = runSceneTest(project, { mapId: target.mapId, start: { x: 1, y: 1 },
          steps: [{ kind: "wait", ticks: 1 }, { kind: "expect", spawnedCount: 0 }] });
        expect(scene.ok).toBe(true);
        expect(ledger.captureActionProof(scene, project)).toBe(false);
        expect(ledger.captureActionProof({ ...scene, mapId: target.mapId, pass: true, status: "verified" }, project)).toBe(false);
        expect(ledger.evaluate(project).status).not.toBe("verified");
      });

      it.each(["failed", "stale"] as const)("cannot publish verified while a %s required check remains", kind => {
        const { project, ledger } = setup();
        const evidence = new ToolVerificationEvidence();
        const args = { mapId: project.startMapId, start: { x: 1, y: 1 }, steps: [] };
        evidence.adopt({ checkId: "scene", ownerId: "goal", name: "run_scene_test", args, interactionTargets: [] });
        evidence.observe("run_scene_test", args, { ok: true, data: { ok: kind !== "failed" } });
        if (kind === "stale") evidence.invalidateAfterWrite();
        expect(ledger.evaluate(project, project, evidence, evidence.problems()).status).toBe("blocked");
      });

      it("skips scheduling without waiving a required check through a replan", () => {
        const { project, ledger } = setup();
        const evidence = new ToolVerificationEvidence();
        const plan = workPlanFromSetToolArgs({ goal: "Verify", layers: [{ title: "QA", items: [
          { id: "qa", title: "Scene", instruction: "Check", successTools: ["run_scene_test"] },
        ] }] });
        if (!plan) throw new Error("Fixture plan missing");
        const args = { mapId: project.startMapId, start: { x: 1, y: 1 }, steps: [] };
        evidence.adopt({ checkId: "qa-scene", ownerId: "original-qa", name: "run_scene_test", args, interactionTargets: [] });
        skipWorkItemById(plan, "qa", "Unable to execute");
        expect(isWorkPlanComplete(plan)).toBe(true);
        expect(ledger.evaluate(project, project, evidence, evidence.problems()).status).toBe("blocked");
        evidence.observe("run_scene_test", args, { ok: true, data: { ok: true } });
        expect(ledger.evaluate(project, project, evidence, evidence.problems()).status).toBe("verified");
      });

      it("retains genuine advisory failures independently of declared requirements", () => {
        const { project, ledger } = setup();
        const evidence = new ToolVerificationEvidence();
        const args = { mapId: project.startMapId, start: { x: 1, y: 1 }, steps: [] };
        evidence.observe("run_scene_test", args, { ok: true, data: { ok: false } }, "advisory");
        expect(evidence.problems().length).toBeGreaterThan(0);
        expect(evidence.snapshot().requirements).toEqual([]);
        expect(ledger.evaluate(project, project, evidence, evidence.problems()).status).toBe("blocked");
        evidence.adopt({ checkId: "scene", ownerId: "goal", name: "run_scene_test", args, interactionTargets: [] });
        expect(ledger.evaluate(project, project, evidence, evidence.problems()).status).toBe("blocked");
      });

      it("keeps intent action and required checks open despite optionality or genuine withdrawal", () => {
        const { project, target, ledger } = setup();
        const evidence = new ToolVerificationEvidence();
        ledger.adopt([{ id: "optional", title: "Optional event", required: false,
          criteria: [{ kind: "eventCount", target, count: 1 }] },
        { id: "withdrawn", title: "Withdrawn event", criteria: [{ kind: "eventCount", target, count: 1 }] }]);
        expect(ledger.withdraw({ acceptanceId: "goal", requirementId: "withdrawn", reason: "User scope reduction" })).toBe(true);
        expect(ledger.evaluate(project).status).toBe("verified");
        ledger.requireActionCombat([target]);
        evidence.adopt({ checkId: "action", ownerId: "goal", name: "run_action_combat_test", args: { mapId: target.mapId } });
        const snapshot = ledger.evaluate(project, project, evidence, evidence.problems());
        expect(snapshot.status).toBe("blocked");
        expect(snapshot.items.find(item => item.id === "optional")).toMatchObject({ required: false, evidence: [{ passed: false }] });
        expect(snapshot.items.find(item => item.id === "withdrawn")).toMatchObject({ source: { requestId: "goal" },
          withdrawal: { source: "user", reason: "User scope reduction" }, evidence: [{ passed: false }] });
        expect(snapshot.items.filter(item => item.id.startsWith("action-combat:"))).toHaveLength(1);
        expect(snapshot.items.find(item => item.id === "required-verification")?.status).toBe("blocked");
      });

      it("parses structured requirements without routing prose into action or stateful NPC scope", () => {
        const { target } = setup();
        const facts: IntentFacts = { userText: "Action RPG with a guide", currentMap: { id: target.mapId, name: "Arena" },
          maps: [{ id: target.mapId, name: "Arena" }], selection: null, facilityLabels: [], toolNames: [], hasActivePlan: false };
        const actionCombat = { targets: [target, { newMapName: "Arena two" }] };
        expect(parseIntentDeclaration(JSON.stringify({ mode: "create", actionCombat, statefulNpcs: true }), facts).intent)
          .toMatchObject({ actionCombat, statefulNpcs: true });
        const ordinary = parseIntentDeclaration(JSON.stringify({ mode: "create" }), facts).intent;
        expect(ordinary?.actionCombat).toBeUndefined();
        expect(ordinary?.statefulNpcs).toBeUndefined();
        const question = parseIntentDeclaration(JSON.stringify({ mode: "question", actionCombat, statefulNpcs: true }), facts).intent;
        expect(question?.actionCombat).toBeUndefined();
        expect(question?.statefulNpcs).toBeUndefined();
      });

      it("does not waive a skipped check using another item's earlier or later success", () => {
        const { project, ledger } = setup();
        const evidence = new ToolVerificationEvidence();
        const success = { ok: true, data: { ok: true } };
        const otherArgs = { mapId: "other", start: { x: 1, y: 1 }, steps: [] };
        const args = { ...otherArgs, mapId: project.startMapId };
        evidence.observe("run_scene_test", otherArgs, success, "explicit", "other-item");
        evidence.adopt({ checkId: "required-scene", ownerId: "original-required-owner", name: "run_scene_test", args, interactionTargets: [] });
        expect(ledger.evaluate(project, project, evidence, evidence.problems()).status).toBe("blocked");
        evidence.observe("run_scene_test", otherArgs, success, "explicit", "other-item");
        expect(ledger.evaluate(project, project, evidence, evidence.problems()).status).toBe("blocked");
        evidence.observe("run_scene_test", args, success, "explicit", "required-item");
        expect(ledger.evaluate(project, project, evidence, evidence.problems()).status).toBe("verified");
      });
    });
  });
  describe("aiRunReconciliation", () => {
    isolateTimers();
    beforeAll(() => {
      // Tests here build the ~63MB blank project (createBlankProject) and drive assistant sessions or editor
      // panels over it, fingerprinting/copying it per session. Under ci-full load (8 workers on 4-core runners)
      // single tests measured 10-50s, past vitest's 15s default, so the budget is raised for this file only.
      vi.setConfig({ testTimeout: 120_000 });
    });
    function makeProject() {
      const project = createBlankProject();
      const tilesetId = project.maps[project.startMapId]!.tilesetId;
      project.tilesets = { [tilesetId]: project.tilesets[tilesetId]! };
      return project;
    }
    function fixture(project = makeProject()): RunCheckpoint & { readonly runtime: RunRuntimeState } {
      const evidence = new ToolVerificationEvidence();
      return { schemaVersion: 1, conversationId: "conversation", runId: "run", epoch: 1, projectId: "P", projectContextKey: "remote:P",
        savedAt: 1, status: "active", request: { requestId: "request", text: "Original goal", scope: null },
        baseContentIdentity: checkpointContentIdentity(project), currentContentIdentity: checkpointContentIdentity(project), workPlan: null,
        budget: { remainingToolCalls: 2, remainingOutputTokens: 100, remainingAutoRunSteps: 3, remainingWorkPlanSteps: 4,
          ralphAttemptsByItemId: [], repeatedToolFailures: [] }, verification: evidence.snapshot(), acceptance: null,
        applied: null, save: null, proof: null, pending: null,
        runtime: { schemaVersion: 2, instruction: "Original goal", requestText: "Original goal", composerMode: "do", autonomous: false,
          execution: "response-final", requestBaseline: checkpointProjectView(project), acceptance: null, verification: evidence.exportRecovery(), currentTurnIndex: 1, verificationOwnerSequence: 0, verificationOwners: [],
          specs: [], latestSpecMapId: null, implicitSpec: null, viewSpec: null, viewSpecWorkItemId: null, originalContext: null,
          statefulNpcRequirement: false, npcRewardItemBaselines: [], volumeBaseline: null, volumeBar: null, volumeContinueUsed: 0,
          acceptanceRepairAttempts: 0, reviewAttempts: 0, lastBlockReasons: [], roundLimit: 2, outputLimit: 100 } };
    }
    beforeEach(() => { vi.stubGlobal("indexedDB", new IDBFactory()); vi.stubGlobal("localStorage", undefined); resetAiRecordDbForTest(); });
    afterEach(() => { resetAiRecordDbForTest(); vi.unstubAllGlobals(); });
    const read = () => readLatestRunCheckpoint("conversation", "P", "remote:P");
    it("selects the newest host epoch despite a retired run's later completion", async () => {
      const checkpoint = fixture();
      await saveRunCheckpoint({ ...checkpoint, epoch: 2, runId: "successor", savedAt: 2 });
      await saveRunCheckpoint({ ...checkpoint, savedAt: 100 });
      expect(await read()).toMatchObject({ kind: "found", checkpoint: { epoch: 2, runId: "successor" } });
    });
    it.each(["foreign", "ambiguous", "malformed"] as const)("does not admit a %s newest checkpoint", async kind => {
      const checkpoint = fixture();
      await saveRunCheckpoint(checkpoint);
      if (kind === "foreign") await saveRunCheckpoint({ ...checkpoint, projectId: "foreign", epoch: 2, runId: "foreign" });
      if (kind === "ambiguous") await saveRunCheckpoint({ ...checkpoint, runId: "ambiguous" });
      if (kind === "malformed") await writeAiRecords("runCheckpoints", [{ ...checkpoint, id: runCheckpointId(checkpoint), runtime: { schemaVersion: 2 } }]);
      expect(await read()).toMatchObject({ kind: "unsupported" });
    });
    it.each(["proposal-ready", "applying", "saving", "proving"] as const)("does not authorize uncertain %s work", async stage => {
      const current = makeProject(), checkpoint = fixture(current);
      const draft = structuredClone(current); draft.meta.title = "Prepared result";
      await saveRunCheckpoint({ ...checkpoint, pending: { operationId: "apply", stage,
        proposal: stage === "saving" || stage === "proving" ? null : { baseContentIdentity: checkpoint.currentContentIdentity,
          contentIdentity: checkpointContentIdentity(draft), calls: [] } } });
      expect(reconcileRunCheckpoint(await read(), current)).toMatchObject({ kind: "needs-reconciliation", next: "inspect-current-project" });
    });
    it("reconciles a prepared snapshot already present without inventing an applied receipt", async () => {
      const draft = makeProject(), checkpoint = fixture(draft);
      draft.meta.title = "Prepared result";
      await saveRunCheckpoint({ ...checkpoint, pending: { operationId: "apply", stage: "applying", proposal: {
        baseContentIdentity: checkpoint.currentContentIdentity, contentIdentity: checkpointContentIdentity(draft), calls: [] } } });
      const result = reconcileRunCheckpoint(await read(), draft);
      expect(result).toMatchObject({ kind: "resumable", reason: "prepared-content-present", checkpoint: { applied: null } });
      draft.meta.title = "Later human edit";
      expect(reconcileRunCheckpoint(await read(), draft).kind).toBe("needs-reconciliation");
    });
    it.each(["cancelled", "awaiting-user"] as const)("keeps %s inactive even with matching content", async execution => {
      const project = makeProject(), checkpoint = fixture(project);
      await saveRunCheckpoint({ ...checkpoint, runtime: { ...checkpoint.runtime, execution } });
      expect(reconcileRunCheckpoint(await read(), project)).toMatchObject({ kind: "terminal", next: "new-request" });
    });
    it("keeps legacy and memory-backed rows transcript-only", async () => {
      const project = makeProject(), checkpoint = fixture(project);
      await saveRunCheckpoint({ ...checkpoint, runtime: undefined });
      expect(reconcileRunCheckpoint(await read(), project).kind).toBe("unsupported");
      vi.stubGlobal("indexedDB", undefined); resetAiRecordDbForTest();
      await saveRunCheckpoint(checkpoint);
      expect(reconcileRunCheckpoint(await read(), project)).toMatchObject({ kind: "unsupported", reason: "not-durable" });
    });
    it.each(["request", "ledger", "promise"] as const)("revalidates the %s baseline after an earlier successful runtime validation", kind => {
      const project = makeProject(), checkpoint = fixture(project);
      const ledger = new AssistantAcceptanceLedger("acceptance", "Original goal", project);
      ledger.adopt([{ id: "title", title: "Title", criteria: [{ kind: "gameTitle", title: "Expected" }] }],
        project, checkpoint.request);
      const runtime = { ...checkpoint.runtime, acceptance: ledger.recoveryView(checkpointProjectView) };
      expect(isRunRuntimeState(runtime)).toBe(true);
      const baseline = kind === "request" ? runtime.requestBaseline
        : kind === "ledger" ? runtime.acceptance.baseline : runtime.acceptance.promises[0]?.baseline;
      if (!baseline) throw new Error("Missing canonical baseline");
      const meta = Reflect.get(baseline, "meta");
      Reflect.set(meta, "title", "Different valid baseline");
      expect(isRunRuntimeState(runtime)).toBe(true);
      Reflect.set(meta, "title", 123);
      expect(isRunRuntimeState(runtime)).toBe(false);
    });
    it("persists host runtime recovery state through the actual checkpoint boundary", async () => {
      await expect(saveRunCheckpoint(fixture())).resolves.toEqual({ durable: true, written: true });
    });
    it("keeps identity stable across equivalent objects and detects map and event edits in place", () => {
      const project = makeProject();
      const map = project.maps[project.startMapId]!;
      const event = { id: "checkpoint-event", x: 2, y: 2, trigger: { kind: "action" as const },
        commands: [{ kind: "text" as const, body: "hello" }] };
      map.events.push(event);
      const identity = checkpointContentIdentity(project);
      const equivalent = { ...project, maps: structuredClone(project.maps), meta: {
        terms: project.meta.terms, author: project.meta.author, title: project.meta.title,
      } };
      expect(checkpointContentIdentity(equivalent)).toBe(identity);
      map.name = "Renamed map";
      const renamed = checkpointContentIdentity(project);
      expect(renamed).not.toBe(identity);
      event.commands[0]!.body = "hello again";
      expect(checkpointContentIdentity(project)).not.toBe(renamed);
    });
    it("keeps full-project runtime v1 rows transcript-only", async () => {
      const project = makeProject(), checkpoint = fixture(project);
      await writeAiRecords("runCheckpoints", [{ ...checkpoint, id: runCheckpointId(checkpoint),
        runtime: { ...checkpoint.runtime, schemaVersion: 1, requestBaseline: project } }]);
      expect(await read()).toEqual({ kind: "unsupported", reason: "schema-version", durable: true });
    });
    it("restores an authored change to a bundled tileset from the compact baseline", async () => {
      const project = makeProject();
      const tilesetId = project.maps[project.startMapId]!.tilesetId;
      const tileset = ownTileset(project, tilesetId); // 공유 타일셋은 동결 — 고칠 이 하나만 개인 사본
      tileset.tileMeta![0] = { ...tileset.tileMeta![0]!, label: "Authored tile label" };
      await saveRunCheckpoint(fixture(project));
      const readback = await read();
      if (readback.kind !== "found" || !readback.checkpoint.runtime) throw new Error("Missing checkpoint runtime");
      const restored = restoreCheckpointBaselines(readback.checkpoint.runtime);
      expect(restored.requestBaseline.tilesets[tilesetId]?.tileMeta?.[0]?.label).toBe("Authored tile label");
    });
  });
  describe("sceneVerificationRepair", () => {
    isolateTimers();
    function rewardScene() {
      const context = { project: createBlankProject() };
      const mapId = context.project.startMapId;
      const itemId = context.project.database.items[0]?.id;
      if (!itemId) throw new Error("Default item fixture missing");
      const placed = runTool(context, "place_npc", {
        mapId, id: "reward_npc", name: "Reward", x: 10, y: 7,
        graphic: { transparent: true },
        pages: [{ commands: [{ kind: "changeItem", itemId, op: "+=", amount: 5 }] }],
      });
      expect(placed.ok).toBe(true);
      const steps = [
        { kind: "snapshotRewards" },
        { kind: "interact", eventId: "reward_npc" },
        { kind: "expect", inventoryDelta: { [itemId]: 5 }, interactionComplete: true },
      ];
      return { context, args: { mapId, start: { x: 10, y: 8 }, steps }, itemId };
    }
    describe("corrected scene navigation retains the same verification obligation", () => {
      it("wire180->181 and corrected171 discharge distinct real-runner findings at terminal acceptance", () => {
        const f = verificationJourney();
        const evidence = new ToolVerificationEvidence();
        const acceptance = new AssistantAcceptanceLedger("goal", "Journey", f.project);
        acceptance.adopt([{ id: "preserve", title: "Existing content", criteria: [{ kind: "preserve", target: { mapId: f.village.id } }] }]);
        for (const input of [f.wire171, f.wire180]) {
          const result = runTool({ project: f.project }, "run_scene_test", { ...input });
          expect(result).toMatchObject({ ok: true, data: { ok: false, setupFailure: { kind: "no-interaction-target", mapId: f.cellar.id } } });
          evidence.observe("run_scene_test", { ...input }, result);
        }
        const ids = evidence.snapshot().findings.map(finding => finding.checkId);
        expect(new Set(ids).size).toBe(2);
        const pass180 = runTool({ project: f.project }, "run_scene_test", { ...f.wire181 });
        expect(pass180).toMatchObject({ ok: true, data: { ok: true } });
        evidence.observe("run_scene_test", { ...f.wire181 }, pass180);
        expect(evidence.snapshot().findings.map(finding => finding.checkId)).toEqual([ids[0]]);
        expect(acceptance.evaluate(f.project, f.project, evidence, evidence.problems()).status).toBe("blocked");
        const correction = evidence.correction(ids[0], f.corrected171);
        expect(correction).not.toBeNull();
        const pass171 = runTool({ project: f.project }, correction!.name, correction!.args);
        expect(pass171).toMatchObject({ ok: true, data: { ok: true } });
        evidence.observe(correction!.name, correction!.args, pass171, "explicit", undefined, ids[0]);
        expect(evidence.snapshot().findings).toEqual([]);
        expect(acceptance.evaluate(f.project, f.project, evidence, evidence.problems()).status).toBe("verified");
      });

      it.each(["drop-repeat", "weaker", "target", "start", "snapshot", "choice", "state", "navigation"])("rejects %s as a correction without deleting the original", variant => {
        const f = verificationJourney();
        const evidence = new ToolVerificationEvidence();
        evidence.observe("run_scene_test", { ...f.wire180 }, runTool({ project: f.project }, "run_scene_test", { ...f.wire180 }));
        const checkId = evidence.snapshot().findings[0]!.checkId;
        const args = structuredClone({ ...f.wire181, steps: [...f.wire181.steps] });
        if (variant === "drop-repeat") args.steps.splice(-3);
        if (variant === "weaker") args.steps = args.steps.map(step => step.kind === "expect" && step.goldDelta === 20 ? { ...step, goldDelta: { atLeast: 1 } } : step);
        if (variant === "target") args.steps = args.steps.map(step => step.kind === "interact" ? { ...step, eventId: "other" } : step);
        if (variant === "start") args.start.x++;
        if (variant === "snapshot") args.steps = args.steps.filter(step => step.kind !== "snapshotRewards");
        if (variant === "choice") args.steps.push({ kind: "choose", index: 0 });
        if (variant === "state") args.steps.unshift({ kind: "set", gold: 100 });
        if (variant === "navigation") args.steps = args.steps.filter(step => step.kind !== "move");
        expect(evidence.correction(checkId, args)).toBeNull();
        expect(evidence.snapshot().findings.map(finding => finding.checkId)).toEqual([checkId]);
      });
      it.each([
        { setup: [], malformed: false },
        { setup: [{ kind: "face", text: "up" }], malformed: true },
        { setup: [{ kind: "move", text: "up" }], malformed: true },
        { setup: [{ kind: "set", x: 10, y: 8 }], malformed: false },
      ])("replaces a failed navigation attempt with the passing same-target assertions: $setup", ({ setup, malformed }) => {
        const { context, args } = rewardScene();
        const evidence = new ToolVerificationEvidence();
        const failedArgs = { ...args, steps: [...setup, ...args.steps] };
        const failed = runTool(context, "run_scene_test", failedArgs);
        if (malformed) {
          expect(failed.ok).toBe(false);
          expect(failed.issues).toContainEqual(expect.objectContaining({ code: "invalid-scene-test" }));
        } else {
          expect(failed.ok).toBe(true);
          expect(failed.data).toMatchObject({ ok: false });
        }
        evidence.observe("run_scene_test", failedArgs, failed);
        evidence.invalidateAfterWrite();
        const corrected = { ...args, steps: [...(malformed ? [] : setup), { kind: "face", dir: "up" }, ...args.steps] };
        const passed = runTool(context, "run_scene_test", corrected);
        expect(passed.data).toMatchObject({ ok: true });
        evidence.observe("run_scene_test", corrected, passed);
        expect(evidence.passed("run_scene_test")).toBe(true);
        expect(evidence.problems()).toEqual([]);
      });

      it("keeps exact canonical proof separate from corrected navigation and advisory checks", () => {
        const { context, args } = rewardScene();
        const evidence = new ToolVerificationEvidence();
        const corrected = { ...args, steps: [{ kind: "face", dir: "up" }, ...args.steps] };
        evidence.adopt({ checkId: "canonical", ownerId: "goal", name: "run_scene_test", args: corrected,
          acceptedCriterion: { kind: "toolVerdict", tool: "run_scene_test", args: corrected } });
        evidence.observe("run_scene_test", args, runTool(context, "run_scene_test", args));
        evidence.observe("run_scene_test", corrected, runTool(context, "run_scene_test", corrected));
        expect(evidence.problems()).toEqual([]);
        expect(evidence.passedScope("run_scene_test", corrected)).toBe(true);
        expect(evidence.passedScope("run_scene_test", args)).toBe(false);

        // Same normalized NPC/assertion obligation, different exact navigation args.
        const otherNavigation = { ...args, steps: [{ kind: "set", x: 10, y: 8 }, ...corrected.steps] };
        const otherResult = runTool(context, "run_scene_test", otherNavigation);
        expect(otherResult.data).toMatchObject({ ok: true });
        evidence.observe("run_scene_test", otherNavigation, otherResult, "advisory");
        expect(evidence.passed("run_scene_test")).toBe(true);
        expect(evidence.passedScope("run_scene_test", otherNavigation)).toBe(false);
        evidence.observe("run_scene_test", corrected, runTool(context, "run_scene_test", corrected));
        evidence.invalidateAfterWrite();
        evidence.observe("run_scene_test", corrected, runTool(context, "run_scene_test", corrected), "advisory");
        expect(evidence.passedScope("run_scene_test", corrected)).toBe(false);
      });

      it("retains independently passing exact invocations of the same normalized scene", () => {
        const { context, args } = rewardScene();
        const evidence = new ToolVerificationEvidence();
        const first = { ...args, steps: [{ kind: "face", dir: "up" }, ...args.steps] };
        const second = { ...args, steps: [{ kind: "set", x: 10, y: 8 }, ...first.steps] };
        for (const [index, exact] of [first, second].entries()) {
          evidence.adopt({ checkId: `canonical-${index}`, ownerId: "goal", name: "run_scene_test", args: exact,
            acceptedCriterion: { kind: "toolVerdict", tool: "run_scene_test", args: exact } });
          const result = runTool(context, "run_scene_test", exact);
          expect(result.data).toMatchObject({ ok: true });
          evidence.observe("run_scene_test", exact, result);
        }
        expect(evidence.passedScope("run_scene_test", first)).toBe(true);
        expect(evidence.passedScope("run_scene_test", second)).toBe(true);
        evidence.invalidateAfterWrite();
        evidence.observe("run_scene_test", first, runTool(context, "run_scene_test", first), "advisory");
        expect(evidence.passedScope("run_scene_test", first)).toBe(false);
        expect(evidence.passedScope("run_scene_test", second)).toBe(false);
      });

      it("cannot erase a different assertion by weakening its expected reward", () => {
        const { context, args, itemId } = rewardScene();
        const evidence = new ToolVerificationEvidence();
        const impossible = {
          ...args,
          steps: [{ kind: "face", dir: "up" }, ...args.steps.slice(0, 2),
            { kind: "expect", inventoryDelta: { [itemId]: 6 }, interactionComplete: true }],
        };
        evidence.observe("run_scene_test", impossible, runTool(context, "run_scene_test", impossible));
        const otherAssertion = { ...args, steps: [{ kind: "face", dir: "up" }, ...args.steps] };
        evidence.observe("run_scene_test", otherAssertion, runTool(context, "run_scene_test", otherAssertion));
        expect(evidence.passed("run_scene_test")).toBe(false);
      });

      it("keeps distinct explicit NPC targets separate", () => {
        const { context, args } = rewardScene();
        const evidence = new ToolVerificationEvidence();
        const missingTarget = {
          ...args,
          steps: [{ kind: "face", dir: "up" }, args.steps[0],
            { kind: "interact", eventId: "missing_npc" }, args.steps[2]],
        };
        evidence.observe("run_scene_test", missingTarget, runTool(context, "run_scene_test", missingTarget));
        const correctTarget = { ...args, steps: [{ kind: "face", dir: "up" }, ...args.steps] };
        evidence.observe("run_scene_test", correctTarget, runTool(context, "run_scene_test", correctTarget));
        expect(evidence.passed("run_scene_test")).toBe(false);
      });
    });
  });
});

describe("assistantImageEvidence", () => {
  isolateTimers();
  it("retains reviewed draft images until their exact content is applied", () => {
    // Given an image review for a changed draft, not the old applied map.
    const applied = createBlankProject(), draft = structuredClone(applied);
    draft.maps[draft.startMapId].lowerTiles[0] = 1;
    const ledger = new AssistantAcceptanceLedger("goal", "Review draft", applied);
    ledger.adopt([{ id: "image", title: "Image", criteria: [{ kind: "imageReviewed", target: { mapId: draft.startMapId } }] }]);
    const receipt = ledger.captureImage(draft, { mapId: draft.startMapId, x: 0, y: 0, w: 20, h: 15 });
    if (!receipt) throw new Error("Missing capture");
    ledger.deliverImages([receipt]);
    expect(ledger.review("image", "Inspected", draft, "pass")).toBe(true);
    expect(ledger.evaluate(applied, draft).status).toBe("verifying");
    // When that exact draft is applied, then its already-delivered review remains valid.
    expect(ledger.evaluate(draft).status).toBe("verified");
  });
  const mutations: readonly { readonly name: string; readonly change: (project: Project) => void; readonly affected: number }[] = [
    { name: "lower tile", change: p => { p.maps[p.startMapId].lowerTiles[0] = 1; }, affected: 1 },
    { name: "upper tile", change: p => { p.maps[p.startMapId].upperTiles[0] = 1; }, affected: 1 },
    { name: "sparse stack", change: p => { p.maps[p.startMapId].upperTileStacks = { 0: [1, 2] }; }, affected: 1 },
    { name: "event", change: p => { p.maps[p.startMapId].events.push({ id: "event", x: 0, y: 0, trigger: { kind: "action" }, commands: [] }); }, affected: 1 },
    { name: "tileset image", change: p => { ownTileset(p, p.maps[p.startMapId].tilesetId).image = { type: "uploaded", id: "replacement" }; }, affected: 1 },
    { name: "shared assets", change: p => { p.assets.uploaded.replacement = { id: "replacement", name: "Image", kind: "tileset", dataUrl: "data:image/png;base64,AA==", meta: {} }; }, affected: 2 },
  ];
  describe("render-input currentness", () => {
    it.each(mutations)("retires $name evidence for applicable maps without undo revival", ({ change, affected }) => {
      // Given separately tiled maps with delivered passing reviews.
      const project = createBlankProject(), first = project.maps[project.startMapId];
      project.tilesets.second = { ...structuredClone(project.tilesets[first.tilesetId]), id: "second" };
      project.maps.second = { ...structuredClone(first), id: "second", tilesetId: "second" };
      const evidence = new AssistantImageEvidence();
      const ledger = new AssistantAcceptanceLedger("goal", "Both maps", project, evidence);
      for (const map of Object.values(project.maps)) {
        ledger.adopt([{ id: map.id, title: map.id, criteria: [{ kind: "imageReviewed", target: { mapId: map.id } }] }]);
        const receipt = evidence.capture(project, { mapId: map.id, x: 0, y: 0, w: 20, h: 15 });
        if (!receipt) throw new Error("Missing capture");
        evidence.deliver([receipt]);
        expect(ledger.review(map.id, "Inspected", project, "pass")).toBe(true);
      }
      expect(ledger.evaluate(project).status).toBe("verified");
      const before = structuredClone(project);
      // When a render input changes and is subsequently undone.
      change(project);
      expect(ledger.evaluate(project).items.filter(item => item.status !== "verified")).toHaveLength(affected);
      // Then only unaffected maps retain receipts, even after the undo.
      expect(evidence.current(project)).toHaveLength(2 - affected);
      expect(ledger.evaluate(before).items.filter(item => item.status !== "verified")).toHaveLength(affected);
      expect(evidence.current(before)).toHaveLength(2 - affected);
    });

    it("retires a pending capture if content changes and is undone before image delivery", () => {
      // Given a captured image not yet inserted into model input.
      const project = createBlankProject(), before = structuredClone(project);
      const evidence = new AssistantImageEvidence();
      const receipt = evidence.capture(project, { mapId: project.startMapId, x: 0, y: 0, w: 20, h: 15 });
      if (!receipt) throw new Error("Missing capture");
      // When a write and undo occur before delivery.
      project.maps[project.startMapId].lowerTiles[0] = 1;
      evidence.current(project); evidence.current(before);
      evidence.deliver([receipt]);
      // Then the pending old capture cannot be credited after undo.
      expect(evidence.current(before)).toEqual([]);
    });
  });
});
