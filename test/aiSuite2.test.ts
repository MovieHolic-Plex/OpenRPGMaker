import { afterEach, describe, expect, it, vi, beforeEach, type MockInstance } from "vitest";
import { AssistantSession, type SessionEvent, type AuditEntry } from "@/ai/assistantSession";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { ToolVerificationEvidence, parseVerificationChecks } from "@/ai/toolVerificationEvidence";
import { defaultAiConfig, type ChatResult, companionCompletionsBaseUrl, companionRequestBaseUrl, DEFAULT_CHATGPT_BASE_URL, humanizeLlmStatus } from "@/ai/llmClient";
import { parseOrchestratorDecision, workPlanFromOrchestratorDecision, workPlanFromSetToolArgs } from "@/ai/workPlan";
import { createSharedTilesetBlankProject as createBlankProject } from "./support/sharedBlankProject";
import { getTool, runTool } from "@/editor/tools";
import type { ReviewInput } from "@/ai/independentReview";
import { independentReviewPayload } from "./independentReviewFixture";
import { fixedDeclarer } from "./intentFixture";
import { unboundCriterionCheck, verificationEvent, verificationJourney } from "./fixtures/verificationOwnership";
import { pickAutoProvider, providerQuotaState, type ProviderRouteState } from "@/ai/autoProviderPick";
import type { ProviderUsageSnapshot } from "@/ai/providerQuota";
import { ChatGptCompanionResponseError, ChatGptCompanionUnreachableError, COMPANION_TIMEOUT_MS, fetchChatGptAuthStatus, fetchCompanionProviders, hasStoredCompanionCredential, hasUsableCompanionCredential, companionAuthUrl, companionCredentialMissing, cancelCompanionLogin } from "@/ai/chatgptOAuthClient";
import { DEFAULT_OH_MY_PI_PROVIDER } from "@/ai/ohMyPiProviders";
import { isolateTimers } from "./mergedTeardown";
import { IDBDatabase, IDBFactory, IDBObjectStore, IDBCursor, IDBIndex } from "fake-indexeddb";
import { AI_RECORD_DB_NAME, aiRecordBackendKind, isScopedAiRecordDeleted, readAiRecord, readAllAiRecords, resetAiRecordDbForTest, writeAiRecords, AI_RECORD_STORES, mutateScopedAiRecord } from "@/ai/aiRecordDb";
import { CONVERSATION_MAX_RECORDS, listConversations, loadConversation, type ConversationRecord, listConversationArchiveMapIds, queryConversationArchive, CONVERSATION_ARGS_MAX_CHARS, CONVERSATION_RECORD_MAX_CHARS, CONVERSATION_TRIM_MARKER, LEGACY_CONVERSATION_STORAGE_KEY, clearConversations, deleteConversation, deriveTitle, loadLatestConversationForScope, saveConversation, searchConversations } from "@/ai/conversationStore";
import type { RunCheckpoint } from "@/ai/runCheckpointStore";
import type { MemoryRepository } from "@/project/persistence/memoryRepository";
import { installMemoryProjectSession, type MemoryProjectSession } from "./support/projectSession";
import * as db from "@/ai/aiRecordDb";
import * as conversations from "@/ai/conversationStore";
import { installElectronBridgeSession, type ElectronBridgeSession } from "./support/electronBridgeSession";
import "fake-indexeddb/auto";

describe("assistantVerificationContinuation", { timeout: 120000 }, () => {
  isolateTimers();
  // 시험 시간 한도는 수집 때 읽혀 beforeAll 안 vi.setConfig 는 듣지 않는다 — describe 옵션 timeout 으로 둔다.
  // Tests here build the ~63MB blank project (createBlankProject) and drive assistant sessions or editor
  // panels over it, fingerprinting/copying it per session. Under ci-full load (8 workers on 4-core runners)
  // single tests measured 10-50s, past vitest's 15s default, so the budget is raised for this file only.
  const reach = "check_reachability";
  const scene = "run_scene_test";
  type Call = { name: string; args: Record<string, unknown> };
  afterEach(() => vi.restoreAllMocks());
  function rig() {
    const f = verificationJourney();
    const acceptance = new AssistantAcceptanceLedger("retained", "Original routes", f.project);
    const villageRoute = { mapId: f.village.id, from: { x: 10, y: 12 }, targets: [{ x: 5, y: 8 }, { x: 10, y: 9 }, { x: 18, y: 7 }, { x: 10, y: 1 }] };
    const cellarRoute = { mapId: f.cellar.id, from: { x: 6, y: 9 }, targets: [{ x: 6, y: 3 }] };
    acceptance.adopt([villageRoute, cellarRoute].map((args, i) => ({ id: `route-${i}`, title: "Route", criteria: [
      { kind: "reachability", target: { mapId: args.mapId }, from: args.from, to: args.targets },
    ] })));
    acceptance.evaluate(f.project);
    const evidence = new ToolVerificationEvidence();
    for (const binding of acceptance.verificationOwnership(f.project)) {
      if (binding.criterion.kind !== "reachability") throw new Error("Unexpected criterion");
      evidence.adopt({ checkId: binding.promiseId, ownerId: binding.promiseId, name: reach,
        args: { mapId: binding.mapId, from: binding.criterion.from, targets: binding.criterion.to },
        criterion: { promiseId: binding.promiseId, criterionIndex: binding.criterionIndex }, acceptedCriterion: binding.criterion });
      evidence.setCriterionPassed(binding.promiseId, binding.passed);
    }
    const terminal = () => acceptance.evaluate(f.project, f.project, evidence, evidence.problems());
    return { ...f, acceptance, evidence, villageRoute, cellarRoute, terminal };
  }
  describe("immutable requirements, findings and attempts at both ledgers", () => {
    it("retains both original exact routes, later adoption and original owners independently", () => {
      const f = rig();
      for (const args of [f.villageRoute, f.cellarRoute]) f.evidence.observe(reach, args, runTool({ project: f.project }, reach, args));
      expect(f.terminal().status).toBe("verified");
      const later = { ...f.villageRoute, from: { x: 4, y: 6 } };
      f.evidence.observe(reach, later, runTool({ project: f.project }, reach, later));
      f.evidence.adopt({ checkId: "later", ownerId: "later-owner", name: reach, args: later });
      expect(f.terminal().status).toBe("blocked");
      expect(f.evidence.snapshot().requirements.find(r => r.checkId === "later")?.status).toBe("unverified");
      f.evidence.adopt({ checkId: "route-0", ownerId: "reused-scheduling-id", name: reach, args: later });
      expect(f.evidence.snapshot().requirements.find(r => r.checkId === "route-0")).toMatchObject({ ownerId: "route-0", args: f.villageRoute });
      f.evidence.observe(reach, later, runTool({ project: f.project }, reach, later));
      expect(f.terminal().status).toBe("verified");
      f.evidence.invalidateAfterWrite();
      f.evidence.observe(reach, later, runTool({ project: f.project }, reach, later));
      expect(f.terminal().status).toBe("blocked");
      expect(f.evidence.snapshot().requirements.filter(r => r.status === "stale").map(r => r.args)).toEqual([f.villageRoute, f.cellarRoute]);
    });

    it.each(["start", "subset", "map", "adjacency"])("a changed %s does not satisfy the accepted route", variant => {
      const f = rig();
      let args = structuredClone(f.villageRoute);
      if (variant === "start") args.from.x--;
      if (variant === "subset") args.targets.pop();
      if (variant === "map") args.mapId = f.cellar.id;
      if (variant === "adjacency") {
        f.village.events.push(verificationEvent("solid", 5, 8, []));
        const bound = f.acceptance.verificationOwnership(f.project).find(b => b.promiseId === "route-0")!;
        expect(bound.passed).toBe(false);
        f.evidence.setCriterionPassed("route-0", bound.passed);
      }
      const result = runTool({ project: f.project }, reach, args);
      expect(result).toMatchObject({ ok: true, data: { reachable: true } });
      f.evidence.observe(reach, args, result);
      expect(f.evidence.snapshot().requirements.find(r => r.checkId === "route-0")?.status).toBe("unverified");
      expect(f.terminal().status).toBe("blocked");
    });

    it("wire114 and execution errors are unsuccessful attempts, never artifact verdicts", () => {
      const f = rig();
      const args = { mapId: f.village.id, from: { x: 10, y: 8 }, targets: [{ newMapName: "지하실", mapId: f.village.id }] };
      const result = runTool({ project: f.project }, reach, args);
      expect(result.ok).toBe(false);
      expect(result.data).toBeUndefined();
      f.evidence.observe(reach, args, result, "explicit", "route-0");
      f.evidence.observe(reach, f.cellarRoute, { ok: false, summary: "executor failed" }, "explicit", "route-1");
      expect(f.evidence.snapshot().findings).toEqual([]);
      expect(f.evidence.snapshot().attempts.map(a => a.status)).toEqual(["unsuccessful", "unsuccessful"]);
      expect(f.terminal().status).toBe("blocked");
      for (const route of [f.villageRoute, f.cellarRoute]) f.evidence.observe(reach, route, runTool({ project: f.project }, reach, route));
      expect(f.terminal().status).toBe("verified");
    });

    it("keeps a genuine exploratory blocked route until its exact compatible rerun", () => {
      const f = rig();
      for (let y = 0; y < f.village.height; y++) f.village.lowerTiles[y * f.village.width + 13] = 342;
      const args = { mapId: f.village.id, from: { x: 10, y: 8 }, targets: [{ x: 15, y: 8 }] };
      const bad = runTool({ project: f.project }, reach, args);
      expect(bad).toMatchObject({ ok: true, data: { reachable: false } });
      f.evidence.observe(reach, args, bad);
      f.evidence.observe(reach, f.cellarRoute, runTool({ project: f.project }, reach, f.cellarRoute));
      expect(f.evidence.snapshot().findings).toHaveLength(1);
      expect(f.terminal().status).toBe("blocked");
      expect(f.evidence.correction("unknown-id", args)).toBeNull();
      const original = f.evidence.snapshot().findings[0]!;
      f.evidence.observe(reach, args, { ok: false }, "explicit", undefined, original.checkId);
      expect(f.evidence.snapshot().findings).toEqual([original]);
      f.evidence.invalidateAfterWrite();
      expect(f.evidence.snapshot().findings).toEqual([original]);
    });

    it("a foreign check ID cannot discharge the original owner even with identical tool inputs", () => {
      const f = rig();
      for (const args of [f.villageRoute, f.cellarRoute]) f.evidence.observe(reach, args, runTool({ project: f.project }, reach, args));
      for (const ownerId of ["original-owner", "foreign-owner"]) f.evidence.adopt({ checkId: ownerId, ownerId, name: reach, args: f.villageRoute });
      f.evidence.observe(reach, f.villageRoute, { ok: true, data: { reachable: false } }, "explicit", "original-owner", "original-owner");
      const original = f.evidence.snapshot().findings[0]!;
      const correction = f.evidence.correction("foreign-owner", f.villageRoute)!;
      const passed = runTool({ project: f.project }, correction.name, correction.args);
      f.evidence.observe(correction.name, correction.args, passed, "explicit", "foreign-owner", "foreign-owner");
      expect(f.evidence.snapshot().findings).toEqual([original]);
      expect(f.evidence.snapshot().requirements.find(r => r.checkId === "original-owner")?.status).toBe("unverified");
      expect(f.terminal().status).toBe("blocked");
      f.evidence.observe(reach, f.villageRoute, passed);
      expect(f.terminal().status).toBe("verified");
    });

    it.each([false, true])("dummy pass then removal creates obligations only when adopted=%s", adopted => {
      const f = rig();
      for (const route of [f.villageRoute, f.cellarRoute]) f.evidence.observe(reach, route, runTool({ project: f.project }, reach, route));
      const dummy = verificationEvent("ev_dummy_fix", 6, 4, []);
      f.cellar.events.push(dummy);
      const args = { mapId: f.cellar.id, start: { x: 6, y: 3 }, steps: [{ kind: "interact", eventId: dummy.id }] };
      if (adopted) f.evidence.adopt({ checkId: "dummy", ownerId: "dummy-owner", name: scene, args,
        interactionTargets: [{ stepIndex: 0, mapId: f.cellar.id, eventId: dummy.id }] });
      const result = runTool({ project: f.project }, scene, args);
      expect(result).toMatchObject({ ok: true, data: { ok: true } });
      f.evidence.observe(scene, args, result);
      f.cellar.events = f.cellar.events.filter(e => e.id !== dummy.id);
      f.evidence.invalidateAfterWrite();
      for (const route of [f.villageRoute, f.cellarRoute]) f.evidence.observe(reach, route, runTool({ project: f.project }, reach, route));
      expect(f.terminal().status).toBe(adopted ? "blocked" : "verified");
      expect(f.cellar.events.map(e => e.id)).not.toContain(dummy.id);
    });

    it("declarations pass both parsing paths; malformed and unscoped tools stay pending", () => {
      const f = rig();
      const checks = [{ tool: reach, criterion: { promiseId: "route-0", criterionIndex: 0 } },
        { tool: scene, args: f.wire180, interactionTargets: [{ stepIndex: 2, mapId: f.cellar.id, eventId: f.chest.id },
          { stepIndex: 6, mapId: f.village.id, eventId: f.chief.id }, { stepIndex: 9, mapId: f.village.id, eventId: f.chief.id }] }];
      const plan = { goal: "Declared checks", layers: [{ title: "QA", items: [{ title: "Check", instruction: "Check", successTools: [reach, scene], verificationChecks: checks }] }] };
      const parsed = parseOrchestratorDecision(JSON.stringify({ action: "new_plan", ...plan }));
      if (!parsed.decision || parsed.decision.action !== "new_plan") throw new Error("Plan parsing failed");
      expect(workPlanFromOrchestratorDecision(parsed.decision).layers[0]?.items[0]?.verificationChecks).toEqual(checks);
      expect(workPlanFromSetToolArgs(plan)?.layers[0]?.items[0]?.verificationChecks).toEqual(checks);
      expect(parseVerificationChecks([{ tool: scene, args: f.wire180 }])).toBeUndefined();
      expect(parseVerificationChecks([...checks, { tool: reach, args: { mapId: f.village.id } }])).toBeUndefined();
      f.evidence.adopt({ checkId: "pending", ownerId: "pending-owner", name: reach, args: null });
      f.evidence.observe(reach, f.villageRoute, runTool({ project: f.project }, reach, f.villageRoute), "explicit", "pending-owner");
      expect(f.evidence.snapshot().requirements.find(r => r.checkId === "pending")?.status).toBe("pending-specification");
    });
  });
  function response(calls: Call[], round: number): ChatResult {
    return { message: { role: "assistant", content: null, tool_calls: calls.map((call, i) => ({ id: `${round}-${i}`, type: "function",
      function: { name: call.name, arguments: JSON.stringify(call.args) } })) }, finishReason: "tool_calls" };
  }
  describe("normal session ownership through skip, replan and continuation", () => {
    it("reused scheduling IDs cannot waive pending scopes; late specification needs a fresh execution", async () => {
      const project = createBlankProject();
      const mapId = project.startMapId;
      const args = { mapId, from: { x: 10, y: 12 }, targets: [{ x: 5, y: 8 }] };
      const events: SessionEvent[] = [];
      const plan = (verificationChecks?: unknown[]) => ({ goal: "Retained route",
        layers: [{ title: "QA", items: [{ id: "same-id", title: "Route", instruction: "Check", successTools: [reach], mapTargets: [mapId], verificationChecks }] }] });
      let round = 0;
      let stage = 0;
      let session: AssistantSession;
      session = new AssistantSession(project, {
        config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 4 },
        declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false, source: "continuation" }),
        chat: async (_config, request) => {
          if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify({ action: "resume" }) }, finishReason: "stop" };
          round++;
          if (stage === 0) {
            stage++;
            // 스펙 미지정 요구를 만드는 현행 경로 — 선언을 비우는 방식은 더 이상 요구를 만들지 않는다.
            return response([{ name: "set_work_plan", args: plan([unboundCriterionCheck(reach)]) }, { name: reach, args }, { name: "skip_work_item", args: {} }], round);
          }
          if (stage === 2) {
            stage++;
            const pending = session.getVerificationSnapshot().requirements.find(r => r.status === "pending-specification")!;
            return response([{ name: "set_work_plan", args: plan([{ tool: reach, args, checkId: pending.checkId }]) },
              { name: "complete_work_item", args: {} }], round);
          }
          if (stage === 4) {
            stage++;
            return response([{ name: reach, args }, { name: "complete_work_item", args: {} }], round);
          }
          if (stage === 6) {
            stage++;
            const later = { ...args, from: { x: 4, y: 6 } };
            return response([{ name: "set_work_plan", args: plan([{ tool: reach, args: later }]) },
              { name: "set_title_screen", args: { title: "Later revision" } }, { name: reach, args: later }], round);
          }
          return { message: { role: "assistant", content: "Checks recorded." }, finishReason: "stop" };
        },
      });
      // 2026-09-17 수용 원장 해체: acceptance 스냅샷은 항상 null — 검증 원장(verification)만 상태를 갖는다.
      const snapshots = () => ({ plan: session.getWorkPlan(), verification: session.getVerificationSnapshot() });
      let beforeSkip: ReturnType<typeof snapshots> | undefined;
      const first = await session.sendUserMessage("Inspect the retained route.", event => {
        events.push(event);
        if (event.type === "tool_call" && event.name === reach) beforeSkip = snapshots();
        if (event.type === "tool_call" && event.name === "skip_work_item") {
          expect(event.result.ok).toBe(false);
          expect(snapshots()).toEqual(beforeSkip);
        }
      });
      const original = session.getVerificationSnapshot().requirements[0]!;
      expect(original.status).toBe("pending-specification");
      expect(first.workPlan?.layers[0]?.items[0]?.status).not.toBe("skipped");
      expect(events.filter(e => e.type === "tool_call" && e.name === "skip_work_item").map(e => e.type === "tool_call" && e.result.ok)).toEqual([false]);
      stage = 2;
      await session.sendUserMessage("Continue.", event => events.push(event));
      const specified = session.getVerificationSnapshot().requirements.find(r => r.checkId === original.checkId)!;
      expect(specified).toMatchObject({ ownerId: original.ownerId, status: "unverified", args });
      stage = 4;
      await session.sendUserMessage("Continue.", event => events.push(event));
      expect(session.getVerificationSnapshot().requirements).toHaveLength(1);
      expect(session.getVerificationSnapshot().requirements[0]?.status).toBe("passed");
      const externallyEdited = session.getProposedProject();
      externallyEdited.session.gold = 99;
      expect(session.syncBaselineFromStoreIfClean(externallyEdited)).toBe(true);
      expect(session.getVerificationSnapshot().requirements[0]?.status).toBe("stale");
      expect(events.filter(e => e.type === "tool_call" && e.name === "complete_work_item").map(e => e.type === "tool_call" && e.result.ok)).toEqual([false, true]);
      stage = 6;
      await session.sendUserMessage("Continue.", event => events.push(event));
      const retained = session.getVerificationSnapshot().requirements;
      expect(retained).toHaveLength(2);
      expect(retained.find(r => r.checkId === original.checkId)).toMatchObject({ ownerId: original.ownerId, status: "stale", args });
      expect(retained.find(r => r.checkId !== original.checkId)?.ownerId).not.toBe(original.ownerId);
    });

    it("normal session correction executes the registered original tool; unknown IDs and execution errors cannot clear a finding", async () => {
      const f = verificationJourney();
      let round = 0;
      let session: AssistantSession;
      const events: SessionEvent[] = [];
      const runner = getTool(scene)!;
      const originalRun = runner.run;
      session = new AssistantSession(f.project, {
        config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 12 },
        declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false }),
        chat: async () => {
          round++;
          if (round === 1) return response([{ name: "set_work_plan", args: { goal: "Journey check",
            layers: [{ title: "QA", items: [{ title: "Inspect", instruction: "Inspect", successTools: ["get_project_summary"] }] }] } }, { name: scene, args: { ...f.wire180 } }], round);
          const id = session.getVerificationSnapshot().findings[0]?.checkId;
          if (round === 2) return response([{ name: "correct_verification", args: { checkId: "unknown", args: f.wire181 } },
            { name: "correct_verification", args: { checkId: id, args: { ...f.wire181, start: { x: 1, y: 1 } } } }], round);
          if (round === 3) {
            vi.spyOn(runner, "run").mockImplementationOnce(() => { throw new Error("injected execution failure"); }).mockImplementation(originalRun);
            return response([{ name: "correct_verification", args: { checkId: id, args: f.wire181 } }], round);
          }
          if (round === 4) {
            expect(session.getVerificationSnapshot().findings).toHaveLength(1);
            return response([{ name: "correct_verification", args: { checkId: id, args: f.wire181 } }, { name: "get_project_summary", args: {} }], round);
          }
          return { message: { role: "assistant", content: "Checks recorded." }, finishReason: "stop" };
        },
      });
      await session.sendUserMessage("Inspect the journey.", event => events.push(event));
      expect(events.filter(e => e.type === "tool_call" && e.name === "correct_verification").map(e => e.type === "tool_call" && e.result.ok)).toEqual([false, false, false, true]);
      expect(session.getVerificationSnapshot().findings).toEqual([]);
      expect(session.getVerificationSnapshot().attempts.map(a => a.status)).toEqual(["negative", "unsuccessful", "passed"]);
    });
  });
  describe("authoring revalidates explicit checks before finalizing", () => {
    // 2026-09-17: 검수 모델이 낡은 명시 검사를 근거로 수리를 강제하던 경로는 없다(결정적 lint 검사만 승인 조건).
    // 남은 안전장치는 검증 원장 — 쓰기 뒤 낡아진 run_lint 요구는 승인된 초안과 별개로 차단 사유로 남는다.
    it("approves the draft deterministically but keeps a stale explicit lint as a blocking obligation after a real write", async () => {
      const project = createBlankProject();
      const item = project.database.items[0];
      const events: SessionEvent[] = [];
      const reviews: ReviewInput[] = [];
      const calls = [
        { name: "set_work_plan", args: { goal: "Required lint",
          layers: [{ title: "Check", items: [{ title: "Price", instruction: "Change price and revalidate", successTools: ["run_lint"],
            verificationChecks: [{ tool: "run_lint", args: {} }] }] }] } },
        { name: "run_lint", args: {} },
        { name: "upsert_item", args: { item: { id: item.id, price: 321 } } },
      ];
      let round = 0;
      const session = new AssistantSession(project, {
        config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 8 },
        declareIntent: fixedDeclarer({ mode: "modify", space: "none", targetMapId: null, needsPlan: false, tools: ["run_lint", "upsert_item"] }),
        chat: async (_config, request): Promise<ChatResult> => {
          const review = independentReviewPayload(request);
          if (review) { reviews.push(review); throw new Error("independent review request must not happen"); }
          const index = round++, call = calls[index];
          return call
            ? { finishReason: "tool_calls", message: { role: "assistant", content: null, tool_calls: [{
              id: `call-${index}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
            }] } }
            : { finishReason: "stop", message: { role: "assistant", content: "EARLY_FINAL" } };
        },
      });
      const result = await session.sendUserMessage("Change the item price and verify it", event => events.push(event));
      expect(events.filter(event => event.type === "tool_call" && event.name === "run_lint")).toHaveLength(1);
      expect(reviews).toHaveLength(0);
      const ownedLint = session.getVerificationSnapshot().requirements.find(requirement => requirement.name === "run_lint");
      expect(ownedLint).toMatchObject({ name: "run_lint", args: {}, status: "stale" });
      expect(events.filter(event => event.type === "result_review").map(event => event.review.status)).toEqual(["approved"]);
      expect(result.stoppedReason).toBe("final");
      expect(result.review?.status).toBe("approved");
      expect(result.review?.summary).toBe("결정적 검사 통과 — 변경 맵 0개, lint error 0건.");
      expect(session.isDraftReviewApproved()).toBe(true);
      // The terminal recap replaces the final text with the open verification notice, never the model's early claim.
      expect(result.assistantText).toContain("검증이 아직 통과되지 않았습니다");
      expect(result.assistantText).toContain("run_lint");
      expect(result.assistantText).not.toContain("EARLY_FINAL");
      expect(session.getProposedProject().database.items.find(record => record.id === item.id)?.price).toBe(321);
      // The verification ledger still owns the stale check: the run is blocked, not complete.
      expect(result.completionAssessment?.blockingVerification.join("\n")).toContain(`[${ownedLint!.checkId}]`);
      expect(result.runOutcome?.execution).toBe("blocked");
    });

    it("retains genuine advisory findings without inventing adopted requirements", () => {
      const evidence = new ToolVerificationEvidence();
      evidence.observe("run_lint", {}, { ok: true, data: { issues: [{ severity: "error", message: "existing advisory finding" }] } }, "advisory");
      expect(evidence.problems()).toHaveLength(1);
      expect(evidence.snapshot().requirements).toEqual([]);
      expect(evidence.snapshot().findings).toHaveLength(1);
    });
  });
});

describe("autoProviderPick", () => {
  isolateTimers();
  const NOW = 1_000_000;
  const CLAUDE = "anthropic";
  const CLAUDE_CLI = "local-cli:claude";
  const CHATGPT = "openai-codex";
  const GOOGLE = "google-antigravity";
  const DEEPSEEK = "openai-compat:deepseek";
  const usage = (provider: string, remainingFraction: number, resetsAt?: number): ProviderUsageSnapshot => ({
    provider, readable: true, fetchedAt: NOW,
    windows: [{ label: "5시간", remainingFraction, exhausted: remainingFraction === 0, resetsAt }],
  });
  const on = (providerId: string, extra: Partial<ProviderRouteState> = {}): ProviderRouteState => ({ providerId, connected: true, ...extra });
  const off = (providerId: string): ProviderRouteState => ({ providerId, connected: false });
  describe("pickAutoProvider — 상태 조합 표", () => {
    it.each<[string, ProviderRouteState[], string | null, string]>([
      ["Claude 만", [on(CLAUDE), off(CHATGPT)], CLAUDE, "best"],
      ["ChatGPT 만", [off(CLAUDE), on(CHATGPT)], CHATGPT, "best"],
      ["둘 다 — Claude 먼저", [on(CHATGPT), on(CLAUDE)], CLAUDE, "best"],
      ["Claude 구독 CLI 만", [on(CLAUDE_CLI), on(DEEPSEEK)], CLAUDE_CLI, "best"],
      ["Claude 한도(사용량 0%) → ChatGPT", [on(CLAUDE, { usage: usage(CLAUDE, 0) }), on(CHATGPT)], CHATGPT, "fallback"],
      ["Claude 최근 429 쉬는 중 → ChatGPT", [on(CLAUDE, { limitedUntil: NOW + 60_000 }), on(CHATGPT)], CHATGPT, "fallback"],
      ["Claude 429 시각이 지났으면 다시 Claude", [on(CLAUDE, { limitedUntil: NOW - 1 }), on(CHATGPT)], CLAUDE, "best"],
      ["한도 모름은 쓸 수 있다", [on(CLAUDE, { usage: { provider: CLAUDE, readable: false, fetchedAt: NOW, windows: [] } }), on(CHATGPT)], CLAUDE, "best"],
      ["도구 호출 불가 길은 건너뛴다", [on(CLAUDE, { toolCalls: false }), on(CHATGPT)], CHATGPT, "fallback"],
      ["비활성화된 Google OAuth 길은 자동 선택하지 않는다", [on(GOOGLE), on(DEEPSEEK)], DEEPSEEK, "best"],
      ["키 길은 사용자 지정 엔드포인트보다 앞", [on(DEEPSEEK), on("xai-oauth")], "xai-oauth", "best"],
      ["사용자 지정 엔드포인트만", [on(DEEPSEEK)], DEEPSEEK, "best"],
      ["연결 없음", [off(CLAUDE), off(CHATGPT)], null, "none"],
      ["빈 목록", [], null, "none"],
    ])("%s", (_name, routes, providerId, reason) => {
      const pick = pickAutoProvider({ routes, now: NOW });
      expect(pick.providerId).toBe(providerId);
      expect(pick.reason).toBe(reason);
    });

    it("건너뛴 길과 이유를 남긴다", () => {
      const pick = pickAutoProvider({ routes: [on(CLAUDE, { usage: usage(CLAUDE, 0) }), on(CLAUDE_CLI, { toolCalls: false }), on(CHATGPT)], now: NOW });
      expect(pick.skipped).toEqual([{ providerId: CLAUDE, why: "limited" }, { providerId: CLAUDE_CLI, why: "no-tools" }]);
    });

    it("모두 한도면 가장 빨리 풀리는 길을 고르고 exhausted 로 알린다", () => {
      const pick = pickAutoProvider({
        routes: [on(CLAUDE, { usage: usage(CLAUDE, 0, NOW + 3_600_000) }), on(CHATGPT, { limitedUntil: NOW + 600_000 })],
        now: NOW,
      });
      expect(pick).toMatchObject({ providerId: CHATGPT, reason: "all-limited", quota: "exhausted" });
    });

    it("고정한 연결은 한도라도 바꾸지 않는다", () => {
      const pick = pickAutoProvider({ routes: [on(CLAUDE), on(CHATGPT, { limitedUntil: NOW + 1 })], pinnedProviderId: CHATGPT, now: NOW });
      expect(pick).toMatchObject({ providerId: CHATGPT, reason: "pinned", quota: "exhausted", skipped: [] });
    });
  });
  describe("providerQuotaState", () => {
    it.each<[string, ProviderRouteState, string]>([
      ["넉넉함", on(CLAUDE, { usage: usage(CLAUDE, 0.6) }), "ok"],
      ["10% 아래", on(CLAUDE, { usage: usage(CLAUDE, 0.05) }), "low"],
      ["소진", on(CLAUDE, { usage: usage(CLAUDE, 0) }), "exhausted"],
      ["읽을 수 없음", on(CLAUDE, { usage: null }), "unknown"],
      ["429 쉬는 중이 사용량보다 우선", on(CLAUDE, { usage: usage(CLAUDE, 0.9), limitedUntil: NOW + 1 }), "exhausted"],
    ])("%s", (_name, route, expected) => {
      expect(providerQuotaState(route, NOW)).toBe(expected);
    });
  });
});

describe("chatgptOAuthClient", () => {
  isolateTimers();
  // 동반 서비스 클라이언트 회귀 스펙.
  //
  // 세 결함을 고정한다(전부 2026-08-21 실측):
  //  ① 상태 응답의 authKind/expired/env 를 버려서, 브라우저가 "자격 없음"과 "셸 env 만 있음"과
  //     "만료"를 구분할 수 없었다.
  //  ② companionFetch 에 타임아웃이 없어서 소켓만 잡히면 영원히 매달렸다 — 상태 칩이 "확인 중"에
  //     영구히 멈추고 재시도 가드까지 안 풀렸다.
  //  ③ 2xx 인데 JSON 이 아닌 응답(vite SPA 폴백 = 경로 미등록)을 성공으로 읽었다.
  describe("aiCompanionAuthClient", () => {
    isolateTimers();
    function jsonResponse(body: unknown, status = 200): Response {
      return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      });
    }
    /** vite dev 서버가 미등록 경로 GET 에 주는 응답 모양. */
    function spaFallback(): Response {
      return new Response("<!doctype html><html lang=\"ko\"></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    }
    afterEach(() => {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });
    describe("상태 응답을 버리지 않는다", () => {
      it("authKind·expired·env 를 그대로 실어 온다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
          connected: true, authKind: "oauth", expired: false, env: false, planType: "plus",
        })));

        const status = await fetchChatGptAuthStatus("openai-codex");

        expect(status).toMatchObject({
          connected: true, authKind: "oauth", expired: false, env: false, planType: "plus",
        });
      });

      it("모르는 authKind 값은 undefined 로 떨군다 (지어내지 않는다)", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ connected: true, authKind: "sorcery" })));
        expect((await fetchChatGptAuthStatus()).authKind).toBeUndefined();
      });
    });
    describe("hasStoredCompanionCredential — 환경 변수는 쓸 수 있지만 지우지는 못한다", () => {
      it("저장된 자격만 연결로 인정한다", () => {
        expect(hasStoredCompanionCredential({ connected: true, env: false })).toBe(true);
        expect(hasStoredCompanionCredential({ connected: true })).toBe(true);
      });

      it("환경 변수 키는 쓸 수 있지만 저장 자격은 아니다", () => {
        expect(hasUsableCompanionCredential({ connected: true, env: true })).toBe(true);
        expect(hasStoredCompanionCredential({ connected: true, env: true })).toBe(false);
      });

      it("만료된 자격은 인정하지 않는다", () => {
        expect(hasStoredCompanionCredential({ connected: true, expired: true })).toBe(false);
      });

      it("미연결은 당연히 인정하지 않는다", () => {
        expect(hasStoredCompanionCredential({ connected: false })).toBe(false);
      });
    });
    describe("도달 불가 (A) 의 세 원인을 구분한다", () => {
      it("fetch 가 던지면 network", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => {
          throw new TypeError("Failed to fetch");
        }));

        const error = await fetchChatGptAuthStatus().catch((cause: unknown) => cause);

        expect(error).toBeInstanceOf(ChatGptCompanionUnreachableError);
        expect((error as ChatGptCompanionUnreachableError).reason).toBe("network");
      });

      it("응답이 오지 않으면 타임아웃으로 끊는다", async () => {
        // 타임아웃이 없던 동안 이 호출은 영원히 pending 이었다.
        vi.stubGlobal("fetch", vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        })));
        vi.useFakeTimers();

        const pending = fetchChatGptAuthStatus().catch((cause: unknown) => cause);
        await vi.advanceTimersByTimeAsync(COMPANION_TIMEOUT_MS + 10);
        const error = await pending;

        expect(error).toBeInstanceOf(ChatGptCompanionUnreachableError);
        expect((error as ChatGptCompanionUnreachableError).reason).toBe("timeout");
      });

      it("2xx 인데 앱 HTML 이면 경로 미등록으로 읽는다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => spaFallback()));

        const error = await fetchChatGptAuthStatus().catch((cause: unknown) => cause);

        expect(error).toBeInstanceOf(ChatGptCompanionUnreachableError);
        expect((error as ChatGptCompanionUnreachableError).reason).toBe("not-mounted");
      });

      it("4xx 는 도달 불가가 아니라 응답 오류 (B) 다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "boom" }, 500)));

        const error = await fetchChatGptAuthStatus().catch((cause: unknown) => cause);

        expect(error).toBeInstanceOf(ChatGptCompanionResponseError);
        expect((error as ChatGptCompanionResponseError).serverMessage).toBe("boom");
      });
    });
    describe("fetchCompanionProviders", () => {
      it("제공자 목록을 정규화해 돌려준다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({
          providers: [
            { id: "openai-codex", label: "OpenAI Codex", authKind: "oauth", defaultModel: "gpt-5.5", hasLogin: true, hasRefresh: true },
            { id: "zai", label: "zAI", authKind: "apiKey", defaultModel: "glm-5.3", hasLogin: true, hasRefresh: false },
            { label: "id 없는 줄은 버린다" },
          ],
        })));

        const providers = await fetchCompanionProviders();

        expect(providers).toHaveLength(2);
        expect(providers[0]).toMatchObject({ id: "openai-codex", authKind: "oauth", hasRefresh: true });
        expect(providers[1]).toMatchObject({ id: "zai", authKind: "apiKey", hasRefresh: false });
      });

      it("목록이 없으면 빈 배열이다 (throw 하지 않는다)", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({})));
        expect(await fetchCompanionProviders()).toEqual([]);
      });
    });
  });
  // Preview/Tailscale 브라우저는 페이지 오리진의 /v1 로만 동반 서비스를 친다.
  // 깨는 지점: import.meta.env.DEV=false 일 때 17832(브라우저 루프백)로 가면
  // mdc-server:9888 에서 연 탭이 사용자 PC 의 127.0.0.1 을 두드린다.
  describe("aiCompanionSameOrigin", () => {
    isolateTimers();
    afterEach(() => {
      vi.restoreAllMocks();
      // restoreAllMocks does not undo vi.stubGlobal; the Electron-bridge window stub leaked into the /auth case.
      vi.unstubAllGlobals();
    });
    describe("동반 서비스 같은 오리진", () => {
      it("preview(비-DEV)에서도 완결 URL 은 /v1 이다 — 127.0.0.1:17832 가 아니다", () => {
        expect(companionCompletionsBaseUrl({ DEV: false })).toBe("/v1");
        expect(companionCompletionsBaseUrl({ DEV: true })).toBe("/v1");
        expect(DEFAULT_CHATGPT_BASE_URL).toBe("/v1");
      });

      it("일렉트론 브리지가 있으면 채팅은 루프백 /v1 로 간다", () => {
        vi.stubGlobal("window", { oprn: { companionOrigin: "http://127.0.0.1:43123" } });
        expect(companionRequestBaseUrl()).toBe("http://127.0.0.1:43123/v1");
      });

      it("인증 경로는 같은 오리진 /auth 다", () => {
        expect(companionAuthUrl("/auth/status", DEFAULT_OH_MY_PI_PROVIDER)).toBe(
          `/auth/status?provider=${DEFAULT_OH_MY_PI_PROVIDER}`,
        );
      });
    });
    describe("Gemini 로그인 안내", () => {
      it("OAuth 401 은 Google Gemini 로그인을 말한다", () => {
        expect(humanizeLlmStatus(401, "", "chatgpt")).toMatch(/Gemini/);
        expect(humanizeLlmStatus(401, "", "chatgpt")).not.toMatch(/ChatGPT/);
      });

      it("동반 서비스가 미연결이면 로그인이 필요하다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ connected: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })));
        await expect(companionCredentialMissing(DEFAULT_OH_MY_PI_PROVIDER)).resolves.toBe(true);
      });

      it("저장된 자격이 있으면 로그인이 필요 없다", async () => {
        vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ connected: true, env: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })));
        await expect(companionCredentialMissing(DEFAULT_OH_MY_PI_PROVIDER)).resolves.toBe(false);
      });
    });
  });
  describe("chatgptOAuthClient", () => {
    isolateTimers();
    afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
    describe("companionAuthUrl", () => {
      it("선택한 oh-my-pi 제공자를 쿼리에 넣는다", () => {
        vi.stubEnv("DEV", "true");
        // 레지스트리에 있는 두 제공자는 그대로 실린다.
        expect(companionAuthUrl("/auth/status", "openai-codex")).toContain("provider=openai-codex");
        expect(companionAuthUrl("/auth/status", "google-antigravity")).toContain("provider=google-antigravity");
        // 레지스트리 밖 값(옛 제공자 id·오타)은 기본 제공자로 스냅한다 — 동반 서비스에 모르는
        // 제공자를 물어보면 404 로 돌아오고, 화면은 그것을 "로그인 필요" 로 오해한다.
        expect(companionAuthUrl("/auth/login", "groq")).toContain("provider=google-antigravity");
        expect(companionAuthUrl("/auth/login", "not-a-provider")).toContain("provider=google-antigravity");
      });
    });
    describe("login attempt status", () => {
      it("preserves denial and resumable instructions returned by the companion", async () => {
        const pendingLogin = {
          verificationUrl: "https://example.invalid/login", userCode: "CODE",
          startedAt: 100, expiresAt: 200, pasteCallback: true,
        };
        vi.stubGlobal("fetch", vi.fn(async () => Response.json({
          connected: false, lastLoginError: "Authorization denied", pendingLogin,
        })));
        const status = await fetchChatGptAuthStatus("openai-codex");
        expect(status.lastLoginError).toBe("Authorization denied");
        expect(status.pendingLogin).toMatchObject(pendingLogin);
      });

      it("cancels a login through the companion without calling logout", async () => {
        const fetch = vi.fn(async () => Response.json({ connected: false }));
        vi.stubGlobal("fetch", fetch);
        expect((await cancelCompanionLogin("openai-codex")).connected).toBe(false);
        expect(fetch).toHaveBeenCalledTimes(1);
        const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toContain("/auth/login-cancel?provider=openai-codex");
        expect(init.method).toBe("POST");
      });
    });
  });
});

describe("conversationStore", () => {
  isolateTimers();
  describe("aiRunCheckpointStore", () => {
    isolateTimers();
    // Dynamic import keeps the migration RED at the actual v2 storage seam before the new module exists.
    const api = () => import("@/ai/runCheckpointStore");
    const checkpointStore = "runCheckpoints";
    const originalIndexedDb = globalThis.indexedDB;
    const conversation: ConversationRecord = {
      id: "conversation-1", title: "Keep me", model: "test", savedAt: 1, entries: [{ kind: "user", text: "Original goal" }], projectContextKey: "remote:P",
    };
    function fixture(overrides: Partial<RunCheckpoint> = {}): RunCheckpoint {
      return {
        schemaVersion: 1, conversationId: conversation.id, runId: "run-1", epoch: 1, projectId: "P", projectContextKey: "remote:P", savedAt: 1,
        status: "active", request: { requestId: "request-1", text: "Original goal", scope: null },
        baseContentIdentity: "base", currentContentIdentity: "current",
        workPlan: {
          id: "plan-1", goal: "Original goal", createdAt: "2026-09-08T00:00:00Z", currentLayerIndex: 0, currentItemId: "item-1",
          requirements: [{ id: "requirement-1", title: "Keep the goal", required: true, criteria: null }],
          layers: [{ id: "layer-1", title: "Work", items: [{ id: "item-1", title: "Work", instruction: "Remaining work", status: "in_progress", requirementIds: ["requirement-1"] }] }],
        },
        budget: { remainingToolCalls: 2, remainingOutputTokens: 100, remainingAutoRunSteps: 3, remainingWorkPlanSteps: 4,
          ralphAttemptsByItemId: [["item-1", 2]], repeatedToolFailures: [["item-1", [["tool:target:code", { target: "map-1", count: 1, summary: "Failed target" }]]]] },
        verification: { requirements: [], findings: [], attempts: [], approaches: [], resolutions: [] }, acceptance: null,
        applied: null, save: null, proof: null, pending: null,
        ...overrides,
      };
    }
    function opened(version?: number): Promise<IDBDatabase> {
      return new Promise((resolve, reject) => {
        const request = version === undefined ? indexedDB.open(AI_RECORD_DB_NAME) : indexedDB.open(AI_RECORD_DB_NAME, version);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    async function seed(version: 1 | 2): Promise<void> {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(AI_RECORD_DB_NAME, version);
        request.onupgradeneeded = () => {
          const store = request.result.createObjectStore("conversations", { keyPath: "id" });
          store.createIndex("savedAt", "savedAt"); store.createIndex("projectContextKey", "projectContextKey");
          store.put(conversation);
          if (version === 2) request.result.createObjectStore("conversationTombstones", { keyPath: "id" })
            .put({ id: JSON.stringify(["remote:P", "deleted-1"]) });
        };
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { request.result.close(); resolve(); };
      });
    }
    beforeEach(() => {
      resetAiRecordDbForTest();
      vi.stubGlobal("indexedDB", new IDBFactory());
      vi.stubGlobal("localStorage", undefined);
    });
    afterEach(() => {
      resetAiRecordDbForTest(); vi.restoreAllMocks(); vi.unstubAllGlobals(); globalThis.indexedDB = originalIndexedDb;
    });
    it.each([1, 2] as const)("upgrades v%i at the real IDB seam without replacing conversations, indexes or tombstones", async version => {
      await seed(version);
      expect(await aiRecordBackendKind()).toBe("indexeddb");
      const db = await opened();
      try {
        // v4 가 대화 요약 저장소 둘을 더했다(src/ai/aiRecordDb.ts AI_RECORD_DB_VERSION, public baseline 0d4f13e7c8).
        expect(db.version).toBe(4);
        expect([...db.objectStoreNames]).toEqual(["conversationSummaries", "conversationSummaryMeta", "conversationTombstones", "conversations", "runCheckpoints"]);
        const transaction = db.transaction(["conversations", checkpointStore], "readonly");
        const done = new Promise<void>((resolve, reject) => {
          transaction.oncomplete = () => resolve(); transaction.onabort = () => reject(transaction.error);
        });
        expect([...transaction.objectStore("conversations").indexNames]).toEqual(["projectContextKey", "savedAt"]);
        expect([...transaction.objectStore(checkpointStore).indexNames]).toEqual(["conversationId", "projectContextKey", "savedAt"]);
        await done;
      } finally { db.close(); }
      expect(await loadConversation(conversation.id)).toEqual(conversation);
      expect(await isScopedAiRecordDeleted("deleted-1", "remote:P")).toBe(version === 2);
      const { saveRunCheckpoint, readRunCheckpoint } = await api();
      expect(await saveRunCheckpoint(fixture())).toEqual({ durable: true, written: true });
      resetAiRecordDbForTest();
      expect(await readRunCheckpoint(fixture())).toMatchObject({ kind: "found", durable: true, checkpoint: fixture() });
      expect(await loadConversation(conversation.id)).toEqual(conversation);
      expect(await isScopedAiRecordDeleted("deleted-1", "remote:P")).toBe(version === 2);
    });
    it("awaits transaction completion and atomically replaces the one pending snapshot for the same run/epoch", async () => {
      const { saveRunCheckpoint, readRunCheckpoint } = await api();
      let completed = 0;
      const native = IDBDatabase.prototype.transaction;
      vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(function (this: IDBDatabase, ...args) {
        const transaction = native.apply(this, args);
        if (transaction.objectStoreNames.contains(checkpointStore)) transaction.addEventListener("complete", () => completed++, { once: true });
        return transaction;
      });
      const proposal = { operationId: "op-1", stage: "applying" as const,
        proposal: { baseContentIdentity: "base", contentIdentity: "draft", calls: [] } };
      await saveRunCheckpoint(fixture({ pending: proposal }));
      expect(completed).toBe(1);
      await saveRunCheckpoint(fixture({ savedAt: 2, pending: { ...proposal, operationId: "op-2" } }));
      expect(completed).toBe(2);
      expect(await readAllAiRecords(checkpointStore)).toHaveLength(1);
      expect(await readRunCheckpoint(fixture())).toMatchObject({ checkpoint: { pending: { operationId: "op-2" } } });
      expect(await saveRunCheckpoint(fixture())).toEqual({ durable: true, written: false });
      await saveRunCheckpoint(fixture({ savedAt: 3, pending: null, status: "terminal" }));
      expect(await readRunCheckpoint(fixture())).toMatchObject({ checkpoint: { pending: null, status: "terminal" } });
      expect(await saveRunCheckpoint(fixture({ savedAt: 4 }))).toEqual({ durable: true, written: false });
    });
    it("propagates an actual transaction abort rather than reporting durable success or falling back", async () => {
      const { saveRunCheckpoint, readRunCheckpoint } = await api();
      await saveRunCheckpoint(fixture());
      const native = IDBObjectStore.prototype.put;
      const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (this: IDBObjectStore, ...args) {
        const request = native.apply(this, args);
        if (this.name === checkpointStore) this.transaction.abort();
        return request;
      });
      await expect(saveRunCheckpoint(fixture({ savedAt: 2 }))).rejects.toThrow();
      spy.mockRestore();
      expect(await readRunCheckpoint(fixture())).toMatchObject({ durable: true, checkpoint: { savedAt: 1 } });
    });
    it("checks the row budget before cloning or starting an IndexedDB write", async () => {
      const { saveRunCheckpoint, readRunCheckpoint } = await api();
      await saveRunCheckpoint(fixture());
      const clone = vi.spyOn(globalThis, "structuredClone");
      const { MAX_CHECKPOINT_BYTES } = await import("@/ai/checkpointPayload");
      const request = { ...fixture().request, text: "x".repeat(MAX_CHECKPOINT_BYTES / 2 + 1) };
      await expect(saveRunCheckpoint(fixture({ savedAt: 2, request }))).rejects.toThrow("snapshot budget");
      expect(clone).not.toHaveBeenCalled();
      clone.mockRestore();
      expect(await readRunCheckpoint(fixture())).toMatchObject({ checkpoint: { savedAt: 1 } });
    });
    it.each([
      { schemaVersion: 0 }, { schemaVersion: 99 }, { epoch: -1 }, { epoch: 1.5 }, { conversationId: "" }, { runId: "" }, { projectId: "" },
      { projectContextKey: "" }, { currentContentIdentity: "" }, { savedAt: NaN }, { workPlan: {} }, { budget: {} },
      { save: { revisionId: "receipt", projectId: "FOREIGN", mutationGeneration: 1, contentIdentity: "current" } },
      { arbitraryModelTruth: { passed: true } }, { execute: () => true },
    ])("rejects malformed write %# without damaging the existing row or conversation", async changes => {
      const { saveRunCheckpoint, readRunCheckpoint } = await api();
      await seed(2); await saveRunCheckpoint(fixture());
      await expect(saveRunCheckpoint({ ...fixture(), ...changes } as RunCheckpoint)).rejects.toThrow(TypeError);
      expect(await readRunCheckpoint(fixture())).toMatchObject({ kind: "found", checkpoint: { savedAt: 1 } });
      expect(await loadConversation(conversation.id)).toEqual(conversation);
    });
    it("rejects foreign project and scope keys without overwriting the rightful row", async () => {
      const { saveRunCheckpoint, readRunCheckpoint } = await api();
      await saveRunCheckpoint(fixture());
      for (const foreign of [fixture({ projectId: "Q" }), fixture({ projectContextKey: "remote:Q" })]) {
        expect(await readRunCheckpoint(foreign)).toEqual({ kind: "unsupported", reason: "identity-mismatch", durable: true });
        await expect(saveRunCheckpoint(foreign)).rejects.toThrow(TypeError);
      }
      expect(await readRunCheckpoint(fixture())).toMatchObject({ kind: "found", checkpoint: { projectId: "P" } });
    });
    it.each(["version", "malformed", "foreign-id"] as const)("retains unsupported %s data and keeps its conversation readable", async mode => {
      const { saveRunCheckpoint, readRunCheckpoint, runCheckpointId, deleteTerminalRunCheckpointsForConversation } = await api();
      await seed(2);
      const raw = { ...fixture({ status: "terminal" }), id: runCheckpointId(fixture()),
        ...(mode === "version" ? { schemaVersion: 99 } : mode === "malformed" ? { budget: null } : { conversationId: "another" }) };
      await writeAiRecords(checkpointStore, [raw]);
      expect(await readRunCheckpoint(fixture())).toMatchObject({ kind: "unsupported" });
      await expect(saveRunCheckpoint(fixture())).rejects.toThrow(TypeError);
      expect(await deleteTerminalRunCheckpointsForConversation(conversation.id, "remote:P")).toEqual({ durable: true, deleted: 0 });
      expect(await readAiRecord(checkpointStore, raw.id)).toEqual(raw);
      expect(await loadConversation(conversation.id)).toEqual(conversation);
    });
    it("exposes only explicit terminal cleanup; recent-list limits cannot prune active, awaiting-user or foreign rows", async () => {
      const { saveRunCheckpoint, readRunCheckpoint, deleteTerminalRunCheckpointsForConversation } = await api();
      const checkpoints = [fixture(), fixture({ runId: "waiting", status: "awaiting-user" }), fixture({ runId: "done", status: "terminal" }),
        fixture({ runId: "foreign", projectId: "Q", projectContextKey: "remote:Q", status: "terminal" })];
      for (const checkpoint of checkpoints) await saveRunCheckpoint(checkpoint);
      await writeAiRecords("conversations", Array.from({ length: CONVERSATION_MAX_RECORDS + 2 }, (_, i) => ({ ...conversation, id: `c-${i}`, savedAt: i })));
      expect(await listConversations()).toHaveLength(CONVERSATION_MAX_RECORDS);
      for (const checkpoint of checkpoints) expect(await readRunCheckpoint(checkpoint)).toMatchObject({ kind: "found" });
      expect(await deleteTerminalRunCheckpointsForConversation(conversation.id, "remote:P")).toEqual({ durable: true, deleted: 1 });
      for (const checkpoint of checkpoints) {
        expect(await readRunCheckpoint(checkpoint)).toMatchObject({ kind: checkpoint.runId === "done" ? "missing" : "found" });
      }
    });
    it.each(["absent", "open-failed"] as const)("reports nondurability and snapshots by value when IndexedDB is %s", async backend => {
      const { saveRunCheckpoint, readRunCheckpoint } = await api();
      if (backend === "absent") vi.stubGlobal("indexedDB", undefined);
      else {
        vi.spyOn(indexedDB, "open").mockImplementation(() => { throw new DOMException("Unavailable", "SecurityError"); });
        vi.spyOn(console, "warn").mockImplementation(() => {});
      }
      const input = fixture();
      const saved = saveRunCheckpoint(input);
      Reflect.set(input.budget, "remainingToolCalls", 999);
      expect(await saved).toEqual({ durable: false, written: true });
      const first = await readRunCheckpoint(input);
      expect(first).toMatchObject({ kind: "found", durable: false, checkpoint: { budget: { remainingToolCalls: 2 } } });
      if (first.kind !== "found") throw new Error("Checkpoint missing");
      Reflect.set(first.checkpoint.budget, "remainingToolCalls", 888);
      expect(await readRunCheckpoint(input)).toMatchObject({ durable: false, checkpoint: { budget: { remainingToolCalls: 2 } } });
      resetAiRecordDbForTest();
      expect(await readRunCheckpoint(input)).toEqual({ kind: "missing", durable: false });
    });
  });
  describe("assistantUx2HistoryIndex", () => {
    isolateTimers();
    const store = AI_RECORD_STORES.conversations;
    function record(id: string, savedAt: number, scope: string | undefined = "mine", map = "a"): ConversationRecord {
      return { id, title: `Title ${id}`, model: "fixture", savedAt, projectContextKey: scope,
        entries: [{ kind: "user", text: `Request ${id}`, context: { mapId: map, mapName: map, mapWidth: 16, mapHeight: 16 } },
          { kind: "assistant", text: "SEARCH PREVIEW" }] };
    }
    beforeEach(() => {
      vi.stubGlobal("indexedDB", new IDBFactory());
      vi.stubGlobal("localStorage", { getItem: () => null, removeItem: vi.fn() });
      resetAiRecordDbForTest();
    });
    afterEach(() => { resetAiRecordDbForTest(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
    function refuseTranscriptScans() {
      const cursor = IDBObjectStore.prototype.openCursor;
      vi.spyOn(IDBObjectStore.prototype, "openCursor").mockImplementation(function (...args) {
        if (this.name === store) throw new Error("history enumerated transcripts");
        return cursor.apply(this, args);
      });
      vi.spyOn(IDBObjectStore.prototype, "getAll").mockImplementation(() => { throw new Error("history getAll"); });
    }
    describe("indexed conversation archive", () => {
      it("backfills old rows once without rewriting them, then queries scoped summaries and map keys only", async () => {
        const old = record("old", 1), legacy = { ...record("legacy", 2), projectContextKey: undefined };
        await new Promise<void>((resolve, reject) => {
          const request = indexedDB.open(AI_RECORD_DB_NAME, 3);
          request.onupgradeneeded = () => {
            const rows = request.result.createObjectStore(store, { keyPath: "id" });
            [old, legacy, { id: "invalid", entries: "invalid" }].forEach(row => rows.put(row));
          };
          request.onerror = () => reject(request.error);
          request.onsuccess = () => { request.result.close(); resolve(); };
        });
        expect((await queryConversationArchive({ projectContextKey: "mine" })).records.map(row => row.id)).toEqual(["old"]);
        refuseTranscriptScans();
        expect((await queryConversationArchive({ projectContextKey: null, query: "search preview" })).records.map(row => row.id)).toEqual(["legacy"]);
        expect(await listConversationArchiveMapIds("mine")).toEqual(["a"]);
        expect(await listConversationArchiveMapIds("other")).toEqual([]);
        expect(await readAiRecord(store, "old")).toEqual(old);
        expect(await readAiRecord(store, "invalid")).toEqual({ id: "invalid", entries: "invalid" });
      });

      it("uses an indexed count and cursor advance for pages, with no full transcript enumeration or cross-scope results", async () => {
        await writeAiRecords(store, Array.from({ length: 120 }, (_, i) => record(`row-${String(i).padStart(3, "0")}`, i, i < 100 ? "mine" : "other")));
        await queryConversationArchive({ projectContextKey: "mine", limit: 20 });
        refuseTranscriptScans();
        const advance = vi.spyOn(IDBCursor.prototype, "advance"), count = vi.spyOn(IDBIndex.prototype, "count");
        const page = await queryConversationArchive({ projectContextKey: "mine", mapId: "a", offset: 20, limit: 20 });
        expect(page).toMatchObject({ total: 100, hasMore: true, durable: true });
        expect(page.records).toHaveLength(20);
        expect(page.records[0]?.id).toBe("row-079");
        expect(page.records.at(-1)?.id).toBe("row-060");
        expect(advance).toHaveBeenCalledWith(20); expect(count).toHaveBeenCalled();
        expect((await queryConversationArchive({ projectContextKey: "mine", query: "SEARCH PREVIEW", limit: 2 })).total).toBe(100);
        const abort = new AbortController(); abort.abort();
        await expect(queryConversationArchive({ projectContextKey: "mine", signal: abort.signal })).rejects.toThrow();
      });

      it("retains localeCompare ordering across page boundaries inside a shared timestamp", async () => {
        const ids = ["Z", "a", "A", "z", "é", "E"];
        await writeAiRecords(store, ids.map(id => record(id, 10)));
        const sorted = [...ids].sort((a, b) => a.localeCompare(b));
        const page = await queryConversationArchive({ projectContextKey: "mine", offset: 2, limit: 3 });
        expect(page.records.map(row => row.id)).toEqual(sorted.slice(2, 5));
        const searched = await queryConversationArchive({ projectContextKey: "mine", query: "search preview", offset: 2, limit: 3 });
        expect(searched.records.map(row => row.id)).toEqual(sorted.slice(2, 5));
        expect(page.total).toBe(ids.length);
      });

      it("rolls back payload and summary together on summary failure, then removes both with scoped deletion suppression", async () => {
        const before = record("atomic", 1);
        await writeAiRecords(store, [before]);
        await queryConversationArchive({ projectContextKey: "mine" });
        const nativePut = IDBObjectStore.prototype.put;
        const failure = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (...args) {
          if (this.name === "conversationSummaries") throw new Error("summary quota fixture");
          return nativePut.apply(this, args);
        });
        await expect(writeAiRecords(store, [{ ...before, savedAt: 2, title: "replacement" }])).rejects.toThrow("summary quota fixture");
        failure.mockRestore();
        expect(await readAiRecord(store, before.id)).toEqual(before);
        expect((await queryConversationArchive({ projectContextKey: "mine" })).records[0]?.title).toBe(before.title);
        await mutateScopedAiRecord<ConversationRecord>({ store, id: before.id, scope: "mine" }, null);
        expect(await readAiRecord(store, before.id)).toBeNull();
        expect((await queryConversationArchive({ projectContextKey: "mine" })).total).toBe(0);
        expect(await listConversationArchiveMapIds("mine")).toEqual([]);
        const retry = await mutateScopedAiRecord<ConversationRecord>({ store, id: before.id, scope: "mine" }, () => ({ ...before, savedAt: 3 }));
        expect(retry.written).toBe(false);
      });
    });
  });
  // test/conversationStore.test.ts
  // 대화 기록 저장소 — IndexedDB(정본) + 레거시 localStorage 이관 + 압축·예산·무예외 계약.
  //
  // 실측 결함(2026-09-03): 대화 50건을 localStorage 한 키에 통째로 다시 쓰다 오리진 한도(약 5MB)를
  // 넘겨 「오류: Failed to execute 'setItem' on 'Storage': … exceeded the quota.」 로 조수 턴이 끊겼다.
  // 저장소를 IndexedDB 로 옮기고(레코드 단위 비동기 쓰기, 용량 수백 MB), 예전 키는 첫 접근에 이관한다.
  // Node 에는 IndexedDB 가 없어 fake-indexeddb 로 실제 IDB 의미론을 돌린다.
  describe("conversationStore", () => {
    isolateTimers();
    // 원격 미러는 포트가 받는다. 예전에는 sync 모듈을 목킹했는데 그 목은 기본 어댑터가 LegacyDb 일 때만
    // 살아 있었다 — 저장소를 심고 그 ai.recordConversation 을 본다.
    let session: MemoryProjectSession | null = null;
    let recordConversationSpy: MockInstance<MemoryRepository["ai"]["recordConversation"]> | null = null;
    const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const originalIndexedDb = globalThis.indexedDB;
    function createMemoryStorage(): Storage {
      const values = new Map<string, string>();
      return {
        get length() {
          return values.size;
        },
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        key: (index: number) => Array.from(values.keys())[index] ?? null,
        removeItem: (key: string) => void values.delete(key),
        setItem: (key: string, value: string) => void values.set(key, value),
      };
    }
    function installStorage(storage: Storage): void {
      Object.defineProperty(globalThis, "localStorage", { configurable: true, writable: true, value: storage });
    }
    function user(text: string): AuditEntry {
      return { kind: "user", text };
    }
    function assistant(text: string): AuditEntry {
      return { kind: "assistant", text };
    }
    function tool(name: string): AuditEntry {
      return { kind: "tool", name, args: {}, ok: true, summary: `${name} ok` };
    }
    function record(id: string, savedAt: number, entries: readonly AuditEntry[] = [user(`대화 ${id}`)]): ConversationRecord {
      return {
        id,
        title: deriveTitle(entries),
        model: "stub-model",
        savedAt,
        entries: [...entries],
      };
    }
    const bulkyArgs = (chars: number): Record<string, unknown> => ({
      mapId: "map_village",
      cells: Array.from({ length: Math.ceil(chars / 12) }, (_, index) => ({ x: index % 100, y: Math.floor(index / 100), t: 342 })),
    });
    const bulkyTool = (name: string, chars: number): AuditEntry => ({ kind: "tool", name, args: bulkyArgs(chars), ok: true, summary: `${name} 적용` });
    const bulkyRecord = (id: string, savedAt: number, toolCalls: number, charsPerCall: number): ConversationRecord =>
      record(id, savedAt, [user(`대화 ${id}`), ...Array.from({ length: toolCalls }, (_, index) => bulkyTool(`place_${index}`, charsPerCall))]);
    beforeEach(() => {
      session = installMemoryProjectSession();
      recordConversationSpy = vi.spyOn(session.repository.ai, "recordConversation");
      recordConversationSpy.mockResolvedValue({ kind: "not-configured" });
      installStorage(createMemoryStorage());
      // 테스트마다 새 IndexedDB 세계 — 연결 캐시와 이관 표식도 같이 리셋한다.
      globalThis.indexedDB = new IDBFactory();
      resetAiRecordDbForTest();
    });
    afterEach(() => {
      vi.restoreAllMocks();
      session?.dispose();
      session = null;
      globalThis.indexedDB = originalIndexedDb;
      resetAiRecordDbForTest();
      if (originalLocalStorageDescriptor) {
        Object.defineProperty(globalThis, "localStorage", originalLocalStorageDescriptor);
        return;
      }
      Reflect.deleteProperty(globalThis, "localStorage");
    });
    describe("conversationStore", () => {
      it("Given saved conversations When listed Then summaries include turn counts and newest records first", async () => {
        await saveConversation(record("old", 100, [user("첫 번째 요청"), assistant("응답")]));
        await saveConversation(record("new", 200, [assistant("준비"), user("두 번째 요청"), tool("create_map"), user("수정 요청")]));

        // preview(마지막 조수/사용자 발화)는 데크(2026-09-03)에서 추가된 목록 필드다 — 여기서는 나머지 모양만 잠근다.
        expect((await listConversations()).map(({ preview: _preview, ...rest }) => rest)).toEqual([
          { id: "new", title: "두 번째 요청", model: "stub-model", savedAt: 200, turnCount: 2 },
          { id: "old", title: "첫 번째 요청", model: "stub-model", savedAt: 100, turnCount: 1 },
        ]);
      });

      it("Given an existing conversation id When saved again Then it replaces the record without a duplicate", async () => {
        await saveConversation(record("same", 100, [user("처음")]));
        await saveConversation(record("same", 300, [user("교체됨"), assistant("응답")]));

        expect((await listConversations()).map(({ preview: _preview, ...rest }) => rest)).toEqual([
          { id: "same", title: "교체됨", model: "stub-model", savedAt: 300, turnCount: 1 },
        ]);
      });

      it("Given a saved conversation When loaded Then entries roundtrip and the outcome says durable", async () => {
        const saved = record("roundtrip", 123, [user("저장해줘"), assistant("저장했습니다"), tool("set_tile_metadata")]);

        const outcome = await saveConversation(saved);

        expect(outcome).toEqual({ ok: true, durable: true, evicted: 0 });
        expect(await loadConversation("roundtrip")).toMatchObject(saved);
      });

      it("Given a tool audit with reason When saved Then local load and remote payload keep the reason", async () => {
        const withReason: AuditEntry = {
          kind: "tool",
          name: "tile_erase",
          args: { mapId: "map_hub" },
          ok: true,
          summary: "754칸",
          reason: "다음에 author_village 를 찍을 자리를 비운다",
        };
        await saveConversation(record("reason", 400, [user("검토해줘"), withReason]));
        expect((await loadConversation("reason"))?.entries).toEqual([user("검토해줘"), withReason]);
        const remote = recordConversationSpy!.mock.calls.at(-1)?.[0] as { entries?: AuditEntry[] } | undefined;
        expect(remote?.entries).toEqual([user("검토해줘"), withReason]);
      });

      it("Given saved conversations When one is deleted Then only the other remains", async () => {
        await saveConversation(record("keep", 200));
        await saveConversation(record("delete", 300));

        await deleteConversation("delete");

        expect((await listConversations()).map(({ preview: _preview, ...rest }) => rest)).toEqual([
          { id: "keep", title: "대화 keep", model: "stub-model", savedAt: 200, turnCount: 1 },
        ]);
      });

      it("Given the only saved conversation When deleted Then the list is empty and stays empty after reopening", async () => {
        await saveConversation(record("only", 100));

        await deleteConversation("only");

        expect(await listConversations()).toEqual([]);
        resetAiRecordDbForTest(); // 연결을 끊고 다시 열어도(새로 고침) 지운 것이 되살아나지 않는다.
        expect(await listConversations()).toEqual([]);
      });

      it("Given saved conversations When cleared Then the list is empty", async () => {
        await saveConversation(record("one", 100));
        await saveConversation(record("two", 200));

        await clearConversations();

        expect(await listConversations()).toEqual([]);
      });

      it("Given more than the recent cap When saved Then older records remain loadable and no eviction is reported", async () => {
        let last = await saveConversation(record("c1", 1));
        for (let index = 2; index <= CONVERSATION_MAX_RECORDS + 5; index += 1) last = await saveConversation(record(`c${index}`, index));

        const summaries = await listConversations();

        expect(summaries).toHaveLength(CONVERSATION_MAX_RECORDS);
        expect(summaries[0]!.id).toBe(`c${CONVERSATION_MAX_RECORDS + 5}`);
        expect(summaries.at(-1)?.id).toBe("c6");
        expect((await loadConversation("c5"))?.id).toBe("c5");
        expect(last).toEqual({ ok: true, durable: true, evicted: 0 });
      });

      it("Given saved conversations When searched by title Then partial case-insensitive matches return", async () => {
        await saveConversation(record("a", 1, [user("마을에 집 지어줘")]));
        await saveConversation(record("b", 2, [user("NPC Dialogue 수정")]));

        expect((await searchConversations("집")).map((conversation) => conversation.id)).toEqual(["a"]);
        expect((await searchConversations("npc dialogue")).map((conversation) => conversation.id)).toEqual(["b"]);
        expect((await searchConversations("")).map((conversation) => conversation.id)).toEqual(["b", "a"]);
        expect(await searchConversations("없는검색어")).toHaveLength(0);
      });

      it("Given audit entries When deriving a title Then it uses the first user text with a short fallback", () => {
        expect(deriveTitle([assistant("ignored"), user("   0123456789012345678901234567890123456789 beyond   ")])).toBe(
          "0123456789012345678901234567890123456789...",
        );
        expect(deriveTitle([assistant("no user")])).toBe("(빈 대화)");
        expect(deriveTitle([user("   ")])).toBe("(빈 대화)");
      });

      it("Given a machine-appended context footer When deriving a title Then only the human sentence survives", () => {
        expect(deriveTitle([user("우물을 놔줘\n\n[컨텍스트] 현재 맵: 이슬 장터 마을 (100x100)")])).toBe("우물을 놔줘");
        expect(deriveTitle([user("표지판을 세워줘")])).toBe("표지판을 세워줘");
      });

      it("Given a remote mirror failure When saving Then the failure is visible without losing the local record", async () => {
        const failure = new Error("missing ai_conversations migration");
        const failureReported = new Promise<void>(resolve => {
          vi.spyOn(console, "error").mockImplementation(() => resolve());
        });
        recordConversationSpy!.mockRejectedValueOnce(failure);

        await saveConversation(record("remote-failure", 400));
        await failureReported;

        expect((await loadConversation("remote-failure"))?.id).toBe("remote-failure");
        // 원격 미러는 이제 프로젝트 저장소(SQLite 호스트)다 — 로그 문구도 바뀌었다.
        expect(console.error).toHaveBeenCalledWith("[ai-conversation] Project storage mirror failed:", failure);
      });
    });
    describe("loadLatestConversationForScope", () => {
      it("남의 프로젝트 대화가 더 최근이어도 내 범위의 최신을 돌려준다", async () => {
        await saveConversation({ ...record("conv_mine_old", 100), projectContextKey: "remote:mine" });
        await saveConversation({ ...record("conv_mine_new", 200), projectContextKey: "remote:mine" });
        await saveConversation({ ...record("conv_other", 999), projectContextKey: "remote:other" });

        expect((await loadLatestConversationForScope("remote:mine"))?.id).toBe("conv_mine_new");
        expect((await loadLatestConversationForScope("remote:other"))?.id).toBe("conv_other");
      });

      it("범위에 저장본이 없으면 null 이다 — 남의 대화를 끌어오지 않는다", async () => {
        await saveConversation({ ...record("conv_other", 999), projectContextKey: "remote:other" });
        expect(await loadLatestConversationForScope("remote:mine")).toBeNull();
      });

      it("저장 순서가 흐트러져도 savedAt 최댓값을 고른다", async () => {
        await saveConversation({ ...record("conv_new", 500), projectContextKey: "remote:mine" });
        await saveConversation({ ...record("conv_old", 100), projectContextKey: "remote:mine" });
        expect((await loadLatestConversationForScope("remote:mine"))?.id).toBe("conv_new");
      });
    });
    // ── 레거시 localStorage 이관 ───────────────────────────────────────────────────────────────
    describe("conversationStore — 레거시 localStorage 이관", () => {
      it("Given 옛 키에 부풀린 대화 3건 When 처음 읽는다 Then IndexedDB 로 옮기며 인자를 압축하고 옛 키를 지운다", async () => {
        const legacy = [bulkyRecord("legacy_c", 3, 10, 20_000), bulkyRecord("legacy_b", 2, 10, 20_000), bulkyRecord("legacy_a", 1, 10, 20_000)];
        const seeded = JSON.stringify(legacy);
        expect(seeded.length).toBeGreaterThan(300_000);
        localStorage.setItem(LEGACY_CONVERSATION_STORAGE_KEY, seeded);

        expect((await listConversations()).map((conversation) => conversation.id)).toEqual(["legacy_c", "legacy_b", "legacy_a"]);
        expect(localStorage.getItem(LEGACY_CONVERSATION_STORAGE_KEY)).toBeNull();
        const migrated = (await loadConversation("legacy_a"))!;
        const firstTool = migrated.entries[1];
        expect(firstTool.kind).toBe("tool");
        if (firstTool.kind !== "tool") return;
        expect(firstTool.args._truncated).toBe(true);
        expect(JSON.stringify(migrated).length).toBeLessThan(40_000);
      });

      it("Given 옛 키가 다시 심어졌다(e2e 시드·QA 스크립트) When 다시 읽는다 Then 같은 id 는 중복되지 않고 최신 savedAt 이 남는다", async () => {
        localStorage.setItem(LEGACY_CONVERSATION_STORAGE_KEY, JSON.stringify([record("seed", 100, [user("시드 1")])]));
        expect((await listConversations()).map((conversation) => conversation.id)).toEqual(["seed"]);
        await saveConversation(record("seed", 200, [user("시드 1"), assistant("응답")]));

        // 새로 고침을 흉내낸다: 연결을 끊고, e2e addInitScript 처럼 옛 키를 다시 심는다.
        resetAiRecordDbForTest();
        localStorage.setItem(LEGACY_CONVERSATION_STORAGE_KEY, JSON.stringify([record("seed", 100, [user("시드 1")])]));

        const summaries = await listConversations();
        expect(summaries.map((conversation) => conversation.id)).toEqual(["seed"]);
        expect(summaries[0]!.savedAt).toBe(200);
        expect((await loadConversation("seed"))?.entries).toHaveLength(2);
      });

      it("Given 옛 키가 깨진 JSON 이다 When 읽는다 Then 무시하고 빈 목록이며 키는 정리된다", async () => {
        localStorage.setItem(LEGACY_CONVERSATION_STORAGE_KEY, "{broken json");

        expect(await listConversations()).toEqual([]);
        expect(localStorage.getItem(LEGACY_CONVERSATION_STORAGE_KEY)).toBeNull();
      });
    });
    // ── 압축 ─────────────────────────────────────────────────────────────────────────────────
    describe("conversationStore — 압축", () => {
      it("Given 인자가 큰 툴콜 When 저장한다 Then 인자는 미리보기로 잘리고 작은 인자와 요약·이유는 그대로다", async () => {
        const small: AuditEntry = { kind: "tool", name: "place_npc", args: { mapId: "map_hub", x: 3, y: 4, name: "상인" }, ok: true, summary: "NPC 1명", reason: "시장 입구" };
        const big = bulkyTool("paint_cells", CONVERSATION_ARGS_MAX_CHARS * 4);
        const assistantWithCalls: AuditEntry = {
          kind: "assistant",
          text: "칸을 채웁니다.",
          toolCalls: [
            { name: "place_npc", args: JSON.stringify(small.kind === "tool" ? small.args : {}) },
            { name: "paint_cells", args: "x".repeat(CONVERSATION_ARGS_MAX_CHARS * 3) },
          ],
        };

        await saveConversation(record("clip", 5, [user("채워줘"), assistantWithCalls, small, big]));

        const stored = (await loadConversation("clip"))!;
        expect(stored.entries[2]).toEqual(small);
        const storedBig = stored.entries[3]!;
        expect(storedBig.kind).toBe("tool");
        if (storedBig.kind !== "tool") return;
        expect(storedBig.name).toBe("paint_cells");
        expect(storedBig.summary).toBe("paint_cells 적용");
        expect(storedBig.args._truncated).toBe(true);
        expect(typeof storedBig.args.preview).toBe("string");
        expect(JSON.stringify(storedBig.args).length).toBeLessThanOrEqual(CONVERSATION_ARGS_MAX_CHARS + 64);
        const storedAssistant = stored.entries[1]!;
        expect(storedAssistant.kind).toBe("assistant");
        if (storedAssistant.kind !== "assistant") return;
        expect(storedAssistant.text).toBe("칸을 채웁니다.");
        expect(storedAssistant.toolCalls?.[0]).toEqual(assistantWithCalls.kind === "assistant" ? assistantWithCalls.toolCalls?.[0] : undefined);
        expect(storedAssistant.toolCalls?.[1]?.args.length).toBeLessThanOrEqual(CONVERSATION_ARGS_MAX_CHARS + 1);
      });

      it("Given 레코드 하나가 예산을 넘는 긴 대화 When 저장한다 Then 머리와 꼬리를 남기고 가운데를 표식 하나로 접는다", async () => {
        const line = (index: number): AuditEntry => user(`${index}번째 요청 ${"가".repeat(1_000)}`);
        const entries = Array.from({ length: Math.ceil((CONVERSATION_RECORD_MAX_CHARS * 2) / 1_000) }, (_, index) => line(index));
        const last = entries.length - 1;

        const outcome = await saveConversation(record("long", 7, entries));

        expect(outcome.ok).toBe(true);
        const stored = (await loadConversation("long"))!;
        expect(JSON.stringify(stored.entries).length).toBeLessThanOrEqual(CONVERSATION_RECORD_MAX_CHARS + 1_200);
        expect(stored.entries[0]).toEqual(line(0));
        expect(stored.entries.at(-1)).toEqual(line(last));
        const markers = stored.entries.filter((entry) => entry.kind === "status" && entry.text.startsWith(CONVERSATION_TRIM_MARKER));
        expect(markers).toHaveLength(1);
        const dropped = entries.length - (stored.entries.length - 1);
        expect(markers[0]!.kind === "status" ? markers[0]!.text : "").toContain(String(dropped));

        await saveConversation(record("long", 8, [...stored.entries, line(last + 1), line(last + 2)]));
        const again = (await loadConversation("long"))!;
        const markersAgain = again.entries.filter((entry) => entry.kind === "status" && entry.text.startsWith(CONVERSATION_TRIM_MARKER));
        expect(markersAgain).toHaveLength(1);
        expect(again.entries.at(-1)).toEqual(line(last + 2));
        expect(again.entries[0]).toEqual(line(0));
      });

      it("Given 인자가 큰 툴콜 When 저장한다 Then 원격 미러도 로컬과 같은 압축본을 받는다", async () => {
        await saveConversation(record("mirror", 3, [user("미러"), bulkyTool("paint_cells", CONVERSATION_ARGS_MAX_CHARS * 4)]));

        const remote = recordConversationSpy!.mock.calls.at(-1)?.[0] as { entries?: AuditEntry[] } | undefined;
        const remoteTool = remote?.entries?.[1];
        expect(remoteTool?.kind).toBe("tool");
        if (remoteTool?.kind !== "tool") return;
        expect(remoteTool.args._truncated).toBe(true);
        expect(remote?.entries).toEqual((await loadConversation("mirror"))?.entries);
      });
    });
    // ── 저장소가 없거나 고장났을 때 ─────────────────────────────────────────────────────────────
    describe("conversationStore — 폴백", () => {
      it("Given IndexedDB 가 없는 환경(Node) When 저장·조회한다 Then 던지지 않고 메모리에서 동작하며 durable:false 를 돌려준다", async () => {
        Reflect.deleteProperty(globalThis, "indexedDB");
        resetAiRecordDbForTest();

        const outcome = await saveConversation(record("memory-only", 100));

        expect(outcome).toEqual({ ok: true, durable: false, evicted: 0 });
        expect((await loadConversation("memory-only"))?.id).toBe("memory-only");
        await deleteConversation("memory-only");
        await clearConversations();
        expect(await listConversations()).toEqual([]);
      });

      it("Given IndexedDB 열기가 실패한다(프라이빗 모드 등) When 저장한다 Then 메모리로 내려가고 경고는 한 번만 찍는다", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        const broken = { open: () => { throw new Error("InvalidStateError: A mutation operation was attempted on a database that did not allow mutations."); } };
        globalThis.indexedDB = broken as unknown as IDBFactory;
        resetAiRecordDbForTest();

        const first = await saveConversation(record("broken_1", 1));
        const second = await saveConversation(record("broken_2", 2));

        expect(first).toEqual({ ok: true, durable: false, evicted: 0 });
        expect(second.durable).toBe(false);
        expect((await listConversations()).map((conversation) => conversation.id)).toEqual(["broken_2", "broken_1"]);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0]?.[0])).toContain("[ai-records]");
      });

      it("Given Node without localStorage When the store is used Then legacy migration is skipped safely", async () => {
        Reflect.deleteProperty(globalThis, "localStorage");

        await saveConversation(record("missing-storage", 100));
        expect((await loadConversation("missing-storage"))?.id).toBe("missing-storage");
        await deleteConversation("missing-storage");
        await clearConversations();
        expect(await listConversations()).toEqual([]);
      });
    });
    describe("listConversations 미리보기 (데크 2026-09-03)", () => {
      it("마지막 조수 발화를 80자 안으로 잘라 preview 로 준다 — 없으면 마지막 사용자 발화", async () => {
        // Break: 이전 대화 목록이 제목·날짜·턴 수만 보여 어느 대화인지 고를 근거가 없다.
        await saveConversation({
          id: "conv_preview",
          title: "광장",
          model: "m",
          savedAt: 10,
          projectContextKey: "local:x::m1",
          entries: [
            { kind: "user", text: "우물 놓아줘" },
            { kind: "assistant", text: "광장 북쪽 (24,11) 에 우물을 놓았습니다. " + "다음으로 상점 창을 붙일까요? ".repeat(6) },
          ],
        });
        await saveConversation({
          id: "conv_preview_user_only",
          title: "질문만",
          model: "m",
          savedAt: 20,
          projectContextKey: "local:x::m1",
          entries: [{ kind: "user", text: "이 맵에 상점이 몇 개야?" }],
        });
        const rows = await listConversations();
        const withAssistant = rows.find((row) => row.id === "conv_preview");
        expect(withAssistant?.preview?.startsWith("광장 북쪽 (24,11) 에 우물을 놓았습니다.")).toBe(true);
        expect((withAssistant?.preview ?? "").length).toBeLessThanOrEqual(81);
        expect(withAssistant?.preview?.endsWith("…")).toBe(true);
        expect(rows.find((row) => row.id === "conv_preview_user_only")?.preview).toBe("이 맵에 상점이 몇 개야?");
      });
    });
  });
  describe("historyRecoveryAdmission", () => {
    isolateTimers();
    const scope = "remote:recovery-test";
    const records = db.AI_RECORD_STORES.conversations;
    let session: ElectronBridgeSession | null = null;
    function serveList(entered: () => void, response: Promise<Response>): void {
      session!.setConversationListImpl(async () => { entered(); return (await response).json(); });
    }
    function local(id = "record", savedAt = 100): ConversationRecord {
      return { id, title: "Local", model: "model", savedAt, projectContextKey: scope,
        entries: [{ kind: "user", text: "aaaa", context: { mapId: "A", mapName: "Map A" } }],
        mapIndex: { viewedMapIds: ["A"], targetMapIds: [], mapAttribution: "complete" } };
    }
    function wire(value = local("record", 900)) {
      return { conversation_id: value.id, project_id: "recovery-test", project_context_key: value.projectContextKey,
        title: value.title, model: value.model, saved_at: new Date(value.savedAt).toISOString(), entries_json: value.entries };
    }
    function deferred<T>() {
      let resolve!: (value: T) => void;
      const promise = new Promise<T>(done => { resolve = done; });
      return { promise, resolve };
    }
    async function put(value: ConversationRecord) { await db.writeAiRecords(records, [value]); }
    async function read(id = "record") { return db.readAiRecord<ConversationRecord>(records, id); }
    beforeEach(() => {
      const values = new Map<string, string>();
      vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
    });
    afterEach(() => {
      session?.dispose();
      session = null;
      db.resetAiRecordDbForTest();
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    });
    describe.each(["indexeddb", "memory"] as const)("explicit recovery admission on %s", backend => {
      beforeEach(async () => {
        vi.stubGlobal("indexedDB", backend === "indexeddb" ? new IDBFactory() : undefined);
        db.resetAiRecordDbForTest();
        session = await installElectronBridgeSession({ projectDir: "/tmp/oprn-history-recovery", projectId: "recovery-test" });
      });

      it.each(["created", "entries", "nested", "title", "model", "mapIndex", "undefined-property"] as const)("preserves %s changed during retrieval, even below the remote timestamp", async field => {
        if (field !== "created") await put(local());
        const started = deferred<void>(), response = deferred<Response>();
        serveList(() => started.resolve(), response.promise);
        const recovery = conversations.hydrateConversationArchive({ projectContextKey: scope });
        await started.promise;
        const changed = local();
        if (field === "entries") changed.entries[0] = { kind: "user", text: "bbbb", context: { mapId: "A", mapName: "Map A" } };
        if (field === "nested") changed.entries[0] = { kind: "user", text: "aaaa", context: { mapId: "B", mapName: "Map B" } };
        if (field === "title") changed.title = "Other";
        if (field === "model") changed.model = "other";
        if (field === "mapIndex") changed.mapIndex = { viewedMapIds: ["B"], targetMapIds: ["C"], mapAttribution: "partial" };
        if (field === "undefined-property") Object.assign(changed.entries[0]!, { at: undefined });
        await put(changed);
        response.resolve(Response.json([wire()]));
        expect(await recovery).toMatchObject({ imported: 0, skipped: 1, rejected: 0, durable: backend === "indexeddb" });
        expect(await read()).toEqual(changed);
        expect(session!.calls.conversationList).toBe(1);
      });

      it("captures memory-backed records by value rather than retaining aliases", async () => {
        await put(local());
        const started = deferred<void>(), response = deferred<Response>();
        serveList(() => started.resolve(), response.promise);
        const recovery = conversations.hydrateConversationArchive({ projectContextKey: scope });
        await started.promise;
        const changed = (await read())!;
        changed.entries[0] = { kind: "user", text: "bbbb" };
        await put(changed);
        response.resolve(Response.json([wire()]));
        expect(await recovery).toMatchObject({ imported: 0, skipped: 1 });
        expect(await read()).toEqual(changed);
      });

      it.each([50, 100, 900])("replaces only an unchanged strictly older baseline (remote=%s), then is idempotent", async savedAt => {
        await put(local());
        const remote = { ...local("record", savedAt), title: "Remote", entries: [{ kind: "user" as const, text: "remote whole transcript" }] };
        session!.setConversationListImpl(async () => [wire(remote)]);
        expect(await conversations.hydrateConversationArchive({ projectContextKey: scope })).toMatchObject({ imported: savedAt > 100 ? 1 : 0, skipped: savedAt > 100 ? 0 : 1 });
        expect((await read())?.entries).toEqual(savedAt > 100 ? remote.entries : local().entries);
        expect(await conversations.hydrateConversationArchive({ projectContextKey: scope })).toMatchObject({ imported: 0, skipped: 1 });
        expect(session!.calls.conversationList).toBe(2);
      });

      it("keeps one baseline across all remote pages", async () => {
        const page2 = deferred<void>(), response = deferred<Response>();
        session!.setConversationListImpl(async options => {
          if (Number(options.offset ?? 0) === 0) {
            await put(local("later", 1));
            return Array.from({ length: 100 }, (_, index) => wire(local(`page1-${index}`, 900)));
          }
          page2.resolve();
          return (await response.promise).json();
        });
        const recovery = conversations.hydrateConversationArchive({ projectContextKey: scope });
        await page2.promise;
        response.resolve(Response.json([wire(local("later", 900))]));
        expect(await recovery).toMatchObject({ imported: 100, skipped: 1 });
        expect(await read("later")).toEqual(local("later", 1));
      });

      it.each(["tombstone", "foreign", "owner"] as const)("preserves a pending %s decision", async change => {
        const started = deferred<void>(), response = deferred<Response>();
        let current = true;
        serveList(() => started.resolve(), response.promise);
        const recovery = conversations.hydrateConversationArchive({ projectContextKey: scope, isCurrent: () => current });
        const outcome = change === "owner" ? expect(recovery).rejects.toMatchObject({ name: "AbortError" }) : recovery;
        await started.promise;
        if (change === "tombstone") await conversations.deleteConversationForScope("record", scope);
        if (change === "foreign") await put({ ...local(), projectContextKey: "remote:foreign" });
        if (change === "owner") current = false;
        response.resolve(Response.json([wire()]));
        if (change === "owner") await outcome;
        else expect(await outcome).toMatchObject({ imported: 0, skipped: 1 });
        expect(await read()).toEqual(change === "foreign" ? { ...local(), projectContextKey: "remote:foreign" } : null);
      });

      it("checks the complete baseline at transactional admission, not before it", async () => {
        await put(local());
        const changed = { ...local(), title: "Changed after response" };
        let intercepted = false;
        if (backend === "indexeddb") {
          const transaction = IDBDatabase.prototype.transaction;
          // Queue a genuine competing write transaction before the recovery transaction.
          vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(function (this: IDBDatabase, names, mode, options) {
            if (!intercepted && mode === "readwrite" && Array.isArray(names) && names.includes("conversationTombstones")) {
              intercepted = true;
              const concurrent = transaction.call(this, records, "readwrite");
              concurrent.objectStore(records).put(changed);
            }
            return transaction.call(this, names, mode, options);
          });
        } else {
          const mutate = db.mutateScopedAiRecord;
          vi.spyOn(db, "mutateScopedAiRecord").mockImplementation(async (key, update) => {
            if (!intercepted) { intercepted = true; await put(changed); }
            return mutate(key, update);
          });
        }
        session!.setConversationListImpl(async () => [wire()]);
        expect(await conversations.hydrateConversationArchive({ projectContextKey: scope })).toMatchObject({ imported: 0, skipped: 1 });
        expect(intercepted).toBe(true);
        expect(await read()).toEqual(changed);
      });
    });
  });
  describe("mapConversationStore", () => {
    isolateTimers();
    beforeEach(() => {
      globalThis.indexedDB = new IDBFactory();
      resetAiRecordDbForTest();
      const values = new Map<string, string>();
      vi.stubGlobal("localStorage", { getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) });
    });
    afterEach(() => { resetAiRecordDbForTest(); vi.unstubAllGlobals(); });
    it("Given 151 records When reopened Then the oldest remains loadable and the recent list stays 50", async () => {
      for (let index = 0; index < 151; index++) {
        await saveConversation({ id: `retention-${index}`, title: `record ${index}`, model: "test", savedAt: index,
          projectContextKey: "remote:P", entries: [{ kind: "user", text: `request ${index}` }] });
      }
      resetAiRecordDbForTest();
      expect(await listConversations()).toHaveLength(50);
      expect((await loadConversation("retention-0"))?.id).toBe("retention-0");
    });
    const record = (id: string, savedAt = 1, projectContextKey = "remote:P"): ConversationRecord => ({
      id, savedAt, projectContextKey, title: id, model: "test", entries: [{ kind: "user", text: id,
        context: { mapId: "A", mapName: "origin" } }],
    });
    it("Given A context and large B target When saved Then both map queries find the whole conversation before argument compaction", async () => {
      const input = record("mixed");
      input.entries.push({ kind: "tool", name: "paint_cells", args: { mapId: "B", cells: "x".repeat(4000) }, ok: true, summary: "done" });
      await saveConversation(input);
      expect(conversations).toHaveProperty("queryConversationArchive");
      for (const mapId of ["A", "B"]) {
        const result = await conversations.queryConversationArchive({ projectContextKey: "remote:P", mapId });
        expect(result.records.map(row => row.id)).toEqual(["mixed"]);
        expect(result.records[0]).toMatchObject({ viewedMapIds: ["A"], targetMapIds: ["B"], mapAttribution: "complete", transcriptCompacted: true });
      }
    });
    it("Given an out of order update When saved Then newer local transcript survives", async () => {
      await saveConversation(record("newer", 200));
      await saveConversation({ ...record("newer", 100), title: "stale" });
      expect((await loadConversation("newer"))?.savedAt).toBe(200);
    });
    it("Given a deletion When a delayed save arrives after reopening Then it cannot resurrect the record", async () => {
      await saveConversation(record("deleted"));
      await conversations.deleteConversation("deleted");
      resetAiRecordDbForTest();
      await saveConversation(record("deleted", 999));
      expect(await loadConversation("deleted")).toBeNull();
    });
    it("Given same map IDs in P and Q When querying loading or deleting P Then Q is untouched", async () => {
      await saveConversation(record("p"));
      await saveConversation(record("q", 1, "remote:Q"));
      expect((await conversations.queryConversationArchive({ projectContextKey: "remote:P", mapId: "A" })).records.map(row => row.id)).toEqual(["p"]);
      expect(await conversations.loadConversationForScope("q", "remote:P")).toBeNull();
      await conversations.deleteConversationForScope("q", "remote:P");
      expect((await conversations.loadConversationForScope("q", "remote:Q"))?.id).toBe("q");
      await saveConversation({ ...record("q", 200), title: "wrong owner" });
      expect((await loadConversation("q"))?.projectContextKey).toBe("remote:Q");
    });
    it("Given tied timestamps When searching and paging Then order is stable by id and totals describe the filtered archive", async () => {
      for (const id of ["c", "a", "b"]) await saveConversation({ ...record(id), title: `Needle ${id}` });
      const page = await conversations.queryConversationArchive({ projectContextKey: "remote:P", query: "NEEDLE", limit: 2 });
      expect(page).toMatchObject({ total: 3, hasMore: true, durable: true });
      expect(page.records.map(row => row.id)).toEqual(["a", "b"]);
      const tail = await conversations.queryConversationArchive({ projectContextKey: "remote:P", query: "needle", offset: 2, limit: 2 });
      expect(tail.records.map(row => row.id)).toEqual(["c"]);
      expect(tail.hasMore).toBe(false);
    });
    it("Given legacy unscoped and malformed metadata When read Then attribution is unknown or recovered without current-map inference", async () => {
      await writeAiRecords("conversations", [
        { ...record("unknown"), projectContextKey: undefined, entries: [{ kind: "user", text: "mapId A in prose" }] },
        { ...record("malformed"), mapIndex: { viewedMapIds: [42], targetMapIds: "B", mapAttribution: "complete" } },
        { ...record("invalid"), entries: [{ kind: "assistant", text: "x", toolCalls: [null] }] },
      ]);
      expect((await conversations.queryConversationArchive({ projectContextKey: null, unknownOnly: true })).records.map(row => row.id)).toEqual(["unknown"]);
      const scoped = await conversations.queryConversationArchive({ projectContextKey: "remote:P" });
      expect(scoped.records.map(row => row.id)).toEqual(["malformed"]);
      expect(scoped.records[0]?.mapIds).toEqual(["A"]);
    });
    it("Given known endpoint fields and unrelated nested strings When indexed Then only recognized map references are used", async () => {
      const input = record("endpoints");
      input.entries.push({ kind: "tool", name: "link_maps", args: { a: { mapId: "B" }, b: { toMapId: "C" },
        arbitrary: { mapId: "not-a-target" }, name: "map_D" }, ok: true, summary: "done" });
      input.entries.push({ kind: "assistant", text: "", toolCalls: [{ name: "transfer", args: JSON.stringify({ toMapId: "D" }) }] });
      await saveConversation(input);
      expect((await conversations.queryConversationArchive({ projectContextKey: "remote:P" })).records[0]?.mapIds).toEqual(["A", "B", "C", "D"]);
    });
    it("Given a target only in the trimmed middle When saved and continued Then its association and original retained transcript survive", async () => {
      const input = record("long");
      input.entries.push(...Array.from({ length: 400 }, (_, index) => ({ kind: "user" as const, text: "x".repeat(1000),
        context: { mapId: index === 100 ? "middle" : "A", mapName: null } })));
      await saveConversation(input);
      const loaded = await conversations.loadConversationForScope("long", "remote:P");
      expect(loaded).not.toBeNull();
      if (!loaded) throw new Error("missing saved conversation");
      expect(loaded.entries.some(entry => entry.kind === "user" && entry.context?.mapId === "middle")).toBe(false);
      await saveConversation({ ...loaded, savedAt: 2, entries: [...loaded.entries, { kind: "user", text: "continue", context: { mapId: "B", mapName: null } }] });
      const restored = await conversations.loadConversationForScope("long", "remote:P");
      expect(restored?.entries[0]).toEqual(input.entries[0]);
      expect(restored?.id).toBe(input.id);
      expect((await conversations.queryConversationArchive({ projectContextKey: "remote:P", mapId: "middle" })).total).toBe(1);
    });
    it("Given same-millisecond live updates When the transcript grows Then the final update is retained", async () => {
      const input = record("equal");
      await saveConversation(input);
      await saveConversation({ ...input, entries: [...input.entries, { kind: "assistant", text: "final" }] });
      expect((await loadConversation("equal"))?.entries).toHaveLength(2);
    });
    it("Given simultaneous saves and deletion When all settle Then the tombstone wins regardless of scheduling", async () => {
      await saveConversation(record("race"));
      await Promise.all([saveConversation(record("race", 2)), conversations.deleteConversationForScope("race", "remote:P"), saveConversation(record("race", 3))]);
      resetAiRecordDbForTest();
      expect(await loadConversation("race")).toBeNull();
    });
    it("Given legacy records at clear When a legacy seed returns after reopen Then clear suppression remains durable", async () => {
      const legacy = record("legacy-cleared");
      localStorage.setItem(conversations.LEGACY_CONVERSATION_STORAGE_KEY, JSON.stringify([legacy]));
      await conversations.clearConversations();
      resetAiRecordDbForTest();
      localStorage.setItem(conversations.LEGACY_CONVERSATION_STORAGE_KEY, JSON.stringify([{ ...legacy, savedAt: 999 }]));
      expect(await loadConversation(legacy.id)).toBeNull();
    });
    it("Given no IndexedDB When saving deleting and querying Then memory operation never claims durability", async () => {
      vi.stubGlobal("indexedDB", undefined);
      resetAiRecordDbForTest();
      expect((await saveConversation(record("memory"))).durable).toBe(false);
      expect((await conversations.queryConversationArchive({ projectContextKey: "remote:P" })).durable).toBe(false);
      expect(await conversations.deleteConversationForScope("memory", "remote:P")).toEqual({ durable: false });
      await saveConversation(record("memory", 2));
      expect(await loadConversation("memory")).toBeNull();
    });
    it("Given a v1 IndexedDB When archive opens Then migration preserves old rows and adds durable deletion suppression", async () => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open(AI_RECORD_DB_NAME, 1);
        request.onupgradeneeded = () => request.result.createObjectStore("conversations", { keyPath: "id" }).put(record("v1"));
        request.onerror = () => reject(request.error);
        request.onsuccess = () => { request.result.close(); resolve(); };
      });
      expect((await conversations.queryConversationArchive({ projectContextKey: "remote:P" })).records[0]?.id).toBe("v1");
      await conversations.deleteConversationForScope("v1", "remote:P");
      resetAiRecordDbForTest();
      await saveConversation(record("v1", 2));
      expect(await loadConversation("v1")).toBeNull();
    });
  });
});
