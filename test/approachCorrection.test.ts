import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { fixedDeclarer } from "./intentFixture";
import { offlineChatResponse } from "./fixtures/offlineChatResponse";
import { p7Approach } from "./fixtures/p7Approach";
import { verificationEvent } from "./fixtures/verificationOwnership";
import type { SceneStep } from "@/testing/sceneTestRunner";
import { ToolVerificationEvidence, verificationInitialState } from "@/ai/toolVerificationEvidence";
import { runTool } from "@/editor/tools";
import { Window } from "happy-dom";
import { createAiStickyChecklist } from "@/editor/panels/aiStickyChecklist";

type Call = { name: string; args: Record<string, unknown> };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function harness(f = p7Approach(), priorTranscript?: string) {
  const network = vi.fn(() => { throw new Error("Offline recorded-model regression attempted network"); });
  vi.stubGlobal("fetch", network);
  let queued: Call[] = [], sequence = 0;
  const events: SessionEvent[] = [];
  const session = new AssistantSession(f.project, {
    priorTranscript,
    config: { ...defaultAiConfig(), agentMode: "chat", model: "recorded-regression", liteModel: "recorded-regression", apiKey: "test", maxToolCalls: 4 },
    declareIntent: fixedDeclarer({ mode: "modify", needsPlan: false, source: "continuation" }),
    chat: async (_config, request): Promise<ChatResult> => {
      const calls = request.tools?.length ? queued.splice(0) : [];
      return offlineChatResponse(calls.length ? { message: { role: "assistant", content: null, tool_calls: calls.map(call => ({
        id: `approach-${++sequence}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) },
      })) }, finishReason: "tool_calls" } : { message: { role: "assistant", content: request.tools?.length ? "REGRESSION_END" : JSON.stringify({ action: "resume" }) }, finishReason: "stop" });
    },
  });
  async function send(...calls: Call[]) {
    queued = calls;
    const result = await session.sendUserMessage("Continue the prospective verification regression.", event => events.push(event));
    expect(queued).toEqual([]);
    expect(network).not.toHaveBeenCalled();
    return result;
  }
  const declare: Call = { name: "set_work_plan", args: { goal: "Prospective P7-shape regression, not historical completion",
    requirements: [{ id: "acceptance-contract", title: "Recorded fifteen-criterion bundle", criteria: f.criteria }],
    layers: [{ title: "Verification", items: [{ id: "verify", title: "Verify", instruction: "Retain the complete bundle", requirementIds: ["acceptance-contract"] }] }],
  } };
  const check = () => session.getVerificationSnapshot().requirements.find(entry => entry.checkId.endsWith(":13"))!;
  const correct = (args: Record<string, unknown> = f.corrected): Call => ({ name: "correct_verification", args: { checkId: check().checkId, args } });
  const preview = () => {
    const result = session.previewApproachCorrection(check().checkId);
    expect(result).not.toBeNull();
    return result!;
  };
  const fail = () => send(declare, { name: "run_scene_test", args: f.args });
  return { f, session, events, send, declare, check, correct, preview, fail };
}

function encounterFixture() {
  const f = p7Approach();
  f.project.session.gold = 11;
  f.map.encounterRate = 1000;
  f.map.troopIds = ["troop_slime"];
  f.map.encounterTable = [];
  f.project.database.troops.find(troop => troop.id === "troop_slime")!.battleEventPages = [{
    id: "extra-approach-reward", name: "Regression battle event", span: "battle", conditions: [], commands: [
      { kind: "changeGold", op: "+=", amount: 101 },
      { kind: "setFlag", flag: "ending:review_extra_battle_event", value: true },
    ],
  }];
  return f;
}

describe("host-confirmed canonical interaction approach", () => {
  it("retains the full recorded bundle, fails natively, rejects movement without approval, and offers the missing action", async () => {
    const h = harness();
    await h.send(h.declare, { name: "run_scene_test", args: h.f.args });
    const original = h.session.getAcceptanceSnapshot()!.items.find(item => item.id === "acceptance-contract")!;
    expect(original.evidence).toHaveLength(15);
    expect(JSON.parse(original.evidence[14]!.expected)).toMatchObject({ tool: "run_lint" });
    expect(h.session.getVerificationSnapshot().attempts).toEqual(expect.arrayContaining([expect.objectContaining({ status: "negative", result: expect.objectContaining({ data: expect.objectContaining({
      failedStepIndex: 1, failedSelection: { stepIndex: 1, mapId: h.f.map.id, eventId: "ev_door" },
    }) }) })]));
    const before = h.session.getVerificationSnapshot();
    await h.send(h.correct());
    expect(h.events.filter(event => event.type === "tool_call" && event.name === "correct_verification")).toMatchObject([{ result: { ok: false } }]);
    expect(h.session.getVerificationSnapshot()).toEqual(before);
    expect(original.evidence[13]).toHaveProperty("approachCheckId", h.check().checkId);
  });

  it("appends confirmation and exact owned proof without changing original check, siblings, or failed attempts", async () => {
    const h = harness();
    await h.fail();
    const original = h.check();
    const acceptance = h.session.getAcceptanceSnapshot()!;
    const failed = h.session.getVerificationSnapshot();
    const preview = h.preview();
    expect(preview).toMatchObject({ originalArgs: h.f.args, args: h.f.corrected, initialState: original.initialState,
      insertion: { stepIndex: 1, mapId: h.f.map.id, step: { kind: "walk", to: { x: 10, y: 0 }, adjacent: true } },
      interactionTargets: [2, 5, 7].map(stepIndex => ({ stepIndex, mapId: h.f.map.id, eventId: "ev_door" })) });
    expect(h.session.confirmApproachCorrection(preview)).toBe(true);
    expect(h.session.confirmApproachCorrection(preview)).toBe(false);
    expect(h.check()).toEqual(original);
    const revision = h.session.getVerificationSnapshot().approaches[0]!;
    expect(revision.confirmation).toMatchObject({ source: "user", previewId: preview.previewId });
    expect(h.session.getVerificationSnapshot().resolutions).toEqual([]);
    await h.send(h.correct());
    expect(h.check()).toEqual({ ...original, status: "passed" });
    const after = h.session.getVerificationSnapshot();
    expect(after.findings).toEqual(failed.findings);
    expect(after.attempts.slice(0, failed.attempts.length)).toEqual(failed.attempts);
    expect(after.attempts.at(-1)).toMatchObject({ checkId: original.checkId, args: preview.args, status: "passed" });
    expect(after.resolutions).toMatchObject([{ checkId: original.checkId, revisionId: revision.revisionId, attemptId: after.attempts.at(-1)!.attemptId }]);
    const item = h.session.getAcceptanceSnapshot()!.items.find(entry => entry.id === "acceptance-contract")!;
    const beforeItem = acceptance.items.find(entry => entry.id === item.id)!;
    expect(item.source).toEqual(beforeItem.source);
    expect(item.evidence.map(entry => entry.expected)).toEqual(beforeItem.evidence.map(entry => entry.expected));
    expect(item.evidence[13]!.passed).toBe(true);
    expect(item.evidence[4]!.passed).toBe(false); // Fresh baseline never proves P7's historical targetChange.
    expect(h.session.getRunOutcome()?.goal).toBe("incomplete");
  });

  it("never reuses pre-approval or ordinary unowned passes", async () => {
    const h = harness();
    await h.fail();
    await h.send({ name: "run_scene_test", args: h.f.corrected });
    expect(h.check().status).toBe("unverified");
    expect(h.session.confirmApproachCorrection(h.preview())).toBe(true);
    expect(h.check().status).toBe("unverified");
    await h.send({ name: "run_scene_test", args: h.f.corrected });
    expect(h.check().status).toBe("unverified");
    expect(h.session.getVerificationSnapshot().resolutions).toEqual([]);
  });

  it.each(["start", "state", "choice", "assertion", "reward", "repeat", "move", "target", "extra-facing"])("atomically rejects changed %s after approval", async kind => {
    const h = harness();
    await h.fail();
    expect(h.session.confirmApproachCorrection(h.preview())).toBe(true);
    const changed: Record<string, unknown> = structuredClone(h.f.corrected);
    const steps = changed.steps as SceneStep[];
    if (kind === "start") changed.start = { x: 1, y: 1 };
    if (kind === "state") steps[0] = { kind: "set", gold: 500 };
    if (kind === "choice") steps.push({ kind: "choose", index: 0 });
    if (kind === "assertion") steps.splice(3, 1);
    if (kind === "reward") steps[3] = { kind: "expect", inventoryCount: { item_brass_key: 100 } };
    if (kind === "repeat") steps.splice(7);
    if (kind === "move") steps[1] = { kind: "move", to: { x: 10, y: 1 } };
    if (kind === "target") steps[2] = { kind: "interact", eventId: "other" };
    if (kind === "extra-facing") steps.splice(2, 0, { kind: "face", dir: "up" });
    const before = h.session.getVerificationSnapshot();
    await h.send(h.correct(changed));
    expect(h.session.getVerificationSnapshot()).toEqual(before);
    expect(h.events.filter(event => event.type === "tool_call" && event.name === "correct_verification").at(-1)).toMatchObject({ result: { ok: false } });
  });

  it.each(["sibling", "assistant-permission", "tampered-preview", "wrong-check", "wrong-owner", "stale-turn", "stale-write", "write-undo", "wrong-session", "wrong-project", "withdrawal", "new-goal"])("rejects %s without amendment", async kind => {
    const h = harness();
    await h.fail();
    const preview = h.preview();
    if (kind === "sibling") await h.send({ name: "repair_acceptance", args: { itemId: "acceptance-contract", criteria: h.f.criteria.slice(0, -1) } });
    if (kind === "assistant-permission") await h.send({ name: "correct_verification", args: { checkId: h.check().checkId, args: h.f.corrected, userApproved: true } });
    if (kind === "tampered-preview") preview.args.steps = [];
    const input = kind === "wrong-check" ? { ...preview, checkId: "finding-6" } : kind === "wrong-owner" ? { ...preview, ownerId: "foreign" } : preview;
    if (kind === "stale-turn") await h.send();
    if (kind === "stale-write" || kind === "write-undo") {
      const before = h.session.getProposedProject();
      const changed = structuredClone(before); changed.meta.title = "Changed";
      h.session.syncBaselineFromStoreIfClean(changed);
      if (kind === "write-undo") h.session.syncBaselineFromStoreIfClean(before);
    }
    if (kind === "wrong-project") {
      const foreign = p7Approach().project; foreign.meta.title = "Different project";
      h.session.rebaseProject(foreign);
    }
    if (kind === "withdrawal") h.session.withdrawRequirement({ acceptanceId: h.session.getAcceptanceSnapshot()!.id, requirementId: "acceptance-contract", reason: "Explicit user exclusion" });
    if (kind === "new-goal") await h.session.sendUserMessage("New goal", () => {}, undefined, { goalAction: "new-goal" });
    const owner = kind === "wrong-session" ? harness().session : h.session;
    const before = owner.getVerificationSnapshot();
    expect(owner.confirmApproachCorrection(input)).toBe(false);
    expect(owner.getVerificationSnapshot()).toEqual(before);
    expect(h.session.getVerificationSnapshot().approaches).toEqual([]);
  });

  it("rejects encounter-capable previews despite a native passing scene with unreceipted battle events", async () => {
    const f = encounterFixture();
    const original = structuredClone(f);
    const control = runTool({ project: f.project }, "run_scene_test", f.corrected);
    expect(control).toMatchObject({ ok: true, data: { ok: true, finalState: {
      gold: 131, endingsReached: expect.arrayContaining(["review_extra_battle_event", "ending_escape"]),
    }, interactions: [2, 5, 7].map(stepIndex => ({ stepIndex, mapId: f.map.id, eventId: "ev_door" })),
    log: expect.arrayContaining(["random encounter troop_slime: victory"]) } });
    const h = harness(f);
    await h.fail();
    expect(h.session.previewApproachCorrection(h.check().checkId)).toBeNull();
    expect(h.session.getAcceptanceSnapshot()!.items.find(item => item.id === "acceptance-contract")!.evidence[13]).not.toHaveProperty("approachCheckId");
    const before = h.session.getVerificationSnapshot();
    await h.send(h.correct());
    expect(h.session.getVerificationSnapshot()).toEqual(before);
    expect(before.approaches).toEqual([]);
    expect(before.resolutions).toEqual([]);
    expect(h.check().status).toBe("unverified");
    expect(f).toEqual(original);
  });

  it.each(["rate", "legacy-troop", "table-weight", "table-added", "after-proof"])("rejects execution and credit after encounter-enabling applied write: %s", async kind => {
    const f = encounterFixture();
    if (kind === "legacy-troop" || kind === "table-added") f.map.troopIds = [];
    else if (kind === "table-weight") f.map.encounterTable = [{ troopId: "troop_slime", weight: 0 }];
    else f.map.encounterRate = 0;
    const h = harness(f);
    await h.fail();
    expect(h.session.confirmApproachCorrection(h.preview())).toBe(true);
    if (kind === "after-proof") {
      await h.send(h.correct());
      expect(h.check().status).toBe("passed");
    }
    const safe = h.session.getProposedProject();
    const changed = structuredClone(safe);
    const map = changed.maps[f.map.id]!;
    if (kind === "legacy-troop") map.troopIds = ["troop_slime"];
    else if (kind === "table-weight") map.encounterTable![0]!.weight = 1;
    else if (kind === "table-added") map.encounterTable = [{ troopId: "troop_slime", weight: 1 }];
    else map.encounterRate = 1000;
    expect(h.session.syncBaselineFromStoreIfClean(changed)).toBe(true);
    const before = h.session.getVerificationSnapshot();
    await h.send(h.correct());
    const after = h.session.getVerificationSnapshot();
    expect(after.resolutions).toEqual(before.resolutions);
    expect(after.resolutions).toHaveLength(kind === "after-proof" ? 1 : 0);
    expect(after.attempts).toEqual(before.attempts);
    expect(after.findings).toEqual(before.findings);
    expect(after.approaches).toEqual(before.approaches);
    expect(h.check().status).not.toBe("passed");
    expect(h.events.filter(event => event.type === "tool_call" && event.name === "correct_verification").at(-1)).toMatchObject({ result: { ok: false } });
    if (kind === "after-proof") {
      expect(h.check().status).toBe("stale");
      expect(h.session.syncBaselineFromStoreIfClean(safe)).toBe(true);
      expect(h.check().status).toBe("stale");
      await h.send(h.correct());
      expect(h.check().status).toBe("passed");
      expect(h.session.getVerificationSnapshot().resolutions).toHaveLength(2);
    }
  });

  it.each([
    "low-rate", "weighted-table", "conditional-switch", "conditional-region", "conditional-time", "missing-troop",
    "zero-rate", "no-candidates", "zero-weight-table", "noninteger-weight-table", "negative-weight-table",
  ])("uses native encounter selection semantics for preview: %s", async kind => {
    const f = encounterFixture();
    if (kind === "low-rate") f.map.encounterRate = 1;
    if (kind === "zero-rate") f.map.encounterRate = 0;
    if (kind === "no-candidates") f.map.troopIds = [];
    if (kind === "missing-troop") f.map.troopIds = ["not-in-database"];
    if (kind.includes("table") || kind.startsWith("conditional")) f.map.encounterTable = [{ troopId: "troop_slime",
      weight: kind === "zero-weight-table" ? 0 : kind === "noninteger-weight-table" ? 0.5 : kind === "negative-weight-table" ? -1 : 1,
      ...(kind === "conditional-switch" ? { conditions: { switchId: "not-yet-enabled" } }
        : kind === "conditional-region" ? { conditions: { region: { x: 10, y: 1, w: 1, h: 1 } } }
        : kind === "conditional-time" ? { conditions: { timePhase: "night" as const } } : {}),
    }];
    const h = harness(f);
    await h.fail();
    const preview = h.session.previewApproachCorrection(h.check().checkId);
    const safe = ["zero-rate", "no-candidates", "zero-weight-table", "noninteger-weight-table", "negative-weight-table"].includes(kind);
    if (safe) {
      expect(preview).not.toBeNull();
      expect(h.session.confirmApproachCorrection(preview!)).toBe(true);
      await h.send(h.correct());
      expect(h.check().status).toBe("passed");
      expect(h.session.getVerificationSnapshot().attempts.at(-1)!.result).toMatchObject({ data: { finalState: { gold: 11, endingsReached: ["ending_escape"] } } });
    } else {
      expect(preview).toBeNull();
      expect(h.session.getVerificationSnapshot().approaches).toEqual([]);
      const before = h.session.getVerificationSnapshot();
      await h.send(h.correct());
      expect(h.session.getVerificationSnapshot()).toEqual(before);
      expect(h.check().status).toBe("unverified");
    }
  });

  it("expires confirmation when applied content becomes encounter-capable after preview", async () => {
    const h = harness();
    await h.fail();
    const preview = h.preview();
    const changed = h.session.getProposedProject();
    changed.maps[h.f.map.id]!.encounterRate = 1000;
    changed.maps[h.f.map.id]!.troopIds = ["troop_slime"];
    expect(h.session.syncBaselineFromStoreIfClean(changed)).toBe(true);
    expect(h.session.confirmApproachCorrection(preview)).toBe(false);
    expect(h.session.getVerificationSnapshot().approaches).toEqual([]);
  });

  it.each(["reward", "transfer", "interrupted", "last-cell-transfer", "empty-touch"])("refuses approach-only credit when inserted walk causes %s", async kind => {
    const f = p7Approach();
    f.map.events.push(verificationEvent("touch", 10, kind === "last-cell-transfer" ? 1 : 5, kind === "reward" ? [{ kind: "changeGold", op: "+=", amount: 10 }]
      : kind === "transfer" || kind === "last-cell-transfer" ? [{ kind: "transfer", mapId: f.map.id, x: 10, y: kind === "last-cell-transfer" ? 1 : 5 }]
      : kind === "empty-touch" ? [] : [{ kind: "choices", options: [{ text: "Wait", branch: [] }] }], true));
    const h = harness(f);
    await h.fail();
    expect(h.session.confirmApproachCorrection(h.preview())).toBe(true);
    await h.send(h.correct());
    const attempt = h.session.getVerificationSnapshot().attempts.at(-1)!;
    expect(attempt.result).toMatchObject({ data: { interactions: expect.arrayContaining([{ stepIndex: 1, mapId: f.map.id, eventId: "touch" }]) } });
    if (kind === "interrupted") expect(attempt).toMatchObject({ status: "negative", result: { data: { failedStepIndex: 1, finalState: { x: 10, y: 5, mapId: f.map.id } } } });
    if (kind === "last-cell-transfer" || kind === "empty-touch") expect(attempt.status).toBe("passed");
    expect(h.check().status).toBe("unverified");
    expect(h.session.getVerificationSnapshot().resolutions).toEqual([]);
    expect(h.session.getAcceptanceSnapshot()!.items.find(item => item.id === "acceptance-contract")!.evidence[13]!.passed).toBe(false);
  });

  it("does not credit verification of an unapplied draft through the real dispatcher", async () => {
    const h = harness();
    await h.fail();
    expect(h.session.confirmApproachCorrection(h.preview())).toBe(true);
    const before = h.session.getVerificationSnapshot();
    await h.send({ name: "set_title_screen", args: { title: "Unapplied content" } }, h.correct());
    expect(h.session.getVerificationSnapshot().attempts).toEqual(before.attempts);
    expect(h.check().status).not.toBe("passed");
    expect(h.events.filter(event => event.type === "tool_call" && event.name === "correct_verification").at(-1)).toMatchObject({ result: {
      ok: false, issues: [{ code: "unapplied-approach-verification" }],
    } });
  });

  it("write then undo never resurrects revised proof, and unrelated findings keep their own obligation", async () => {
    const h = harness();
    await h.fail();
    await h.send({ name: "run_scene_test", args: { ...h.f.args, start: { x: 10, y: 1 } } });
    const unrelated = h.session.getVerificationSnapshot().findings.find(finding => !finding.checkId.includes(":13"))!;
    expect(unrelated).toBeDefined();
    expect(h.session.confirmApproachCorrection(h.preview())).toBe(true);
    await h.send(h.correct());
    expect(h.check().status).toBe("passed");
    expect(h.session.getVerificationSnapshot().findings).toContainEqual(unrelated);
    const original = h.session.getProposedProject();
    const changed = structuredClone(original); changed.meta.title = "Write after pass";
    h.session.syncBaselineFromStoreIfClean(changed);
    expect(h.check().status).toBe("stale");
    h.session.syncBaselineFromStoreIfClean(original);
    expect(h.check().status).toBe("stale");
    await h.send(h.correct());
    expect(h.check().status).toBe("passed");
    expect(h.session.getVerificationSnapshot().resolutions).toHaveLength(2);
  });

  it("restored public transcript cannot recover an old ledger or pending confirmation", async () => {
    const h = harness();
    await h.fail();
    const preview = h.preview();
    const restored = harness(h.f, JSON.stringify({ messages: h.session.getHarnessSnapshot().messages, preview, userApproved: true }));
    expect(restored.session.getAcceptanceSnapshot()).toBeNull();
    expect(restored.session.previewApproachCorrection(preview.checkId)).toBeNull();
    expect(restored.session.confirmApproachCorrection(preview)).toBe(false);
    expect(restored.session.getVerificationSnapshot().approaches).toEqual([]);
  });

  it("retains a failed revised execution and appends its eventual fresh resolution", async () => {
    const h = harness();
    await h.fail();
    expect(h.session.confirmApproachCorrection(h.preview())).toBe(true);
    const original = h.session.getProposedProject();
    const changed = structuredClone(original);
    changed.maps[h.f.map.id]!.events[0]!.pages = [h.f.door.pages![0]!];
    h.session.syncBaselineFromStoreIfClean(changed);
    await h.send(h.correct());
    const failed = h.session.getVerificationSnapshot();
    expect(failed.findings.some(finding => finding.approachCheckId === h.check().checkId)).toBe(true);
    expect(h.check().status).toBe("unverified");
    h.session.syncBaselineFromStoreIfClean(original);
    await h.send(h.correct());
    expect(h.check().status).toBe("passed");
    expect(h.session.getVerificationSnapshot().findings).toEqual(failed.findings);
    expect(h.session.getAcceptanceSnapshot()!.items.find(item => item.id === "acceptance-contract")!.evidence[13]!.passed).toBe(true);
  });

  it.each(["missing-owner", "missing-target", "moving-target", "earlier-gameplay"])("does not offer unsupported %s", async kind => {
    const f = p7Approach();
    const criterion = f.criteria[13]!;
    if (criterion.kind !== "toolVerdict") throw new Error("Missing criterion");
    if (kind === "missing-owner") f.criteria[13] = { ...criterion, interactionTargets: [] };
    if (kind === "missing-target") f.map.events = [];
    if (kind === "moving-target") f.door.pages![0]!.movement = { type: "random", speed: 3, frequency: 3 };
    if (kind === "earlier-gameplay") (f.args.steps as SceneStep[])[0] = { kind: "move", dir: "left" };
    if (kind === "earlier-gameplay") f.criteria[13] = { ...criterion, args: f.args };
    const h = harness(f);
    await h.fail();
    expect(h.session.previewApproachCorrection(h.check().checkId)).toBeNull();
    expect(h.check().status).not.toBe("passed");
  });

  it("real checklist uses distinct review/confirmation and blocks busy, disposed and ownerless actions", async () => {
    const h = harness();
    await h.fail();
    const dom = new Window();
    vi.stubGlobal("document", dom.document); vi.stubGlobal("window", dom); vi.stubGlobal("Node", dom.Node);
    vi.stubGlobal("HTMLElement", dom.HTMLElement);
    const actions = { onReviewApproach: vi.fn((checkId: string) => h.session.previewApproachCorrection(checkId)),
      onConfirmApproach: vi.fn((preview: NonNullable<ReturnType<typeof h.session.previewApproachCorrection>>) => h.session.confirmApproachCorrection(preview)) };
    const note = createAiStickyChecklist(actions);
    const snapshot = h.session.getAcceptanceSnapshot()!;
    try {
      note.update(snapshot);
      const review = note.root.querySelector<HTMLButtonElement>("[data-testid=ai-approach-review]")!;
      expect(review).not.toBeNull();
      note.setBusy(true); review.click(); expect(actions.onReviewApproach).not.toHaveBeenCalled();
      note.setBusy(false); review.click(); expect(actions.onReviewApproach).toHaveBeenCalledOnce();
      expect(h.session.getVerificationSnapshot().approaches).toEqual([]);
      const confirm = note.root.querySelector<HTMLButtonElement>("[data-testid=ai-approach-confirm]")!;
      expect(confirm).not.toBeNull();
      note.setBusy(true); confirm.click(); expect(actions.onConfirmApproach).not.toHaveBeenCalled();
      note.setBusy(false); confirm.click(); expect(actions.onConfirmApproach).toHaveBeenCalledOnce();
      expect(h.check().status).toBe("unverified");
      const plain = createAiStickyChecklist(); plain.update(snapshot);
      expect(plain.root.querySelector("[data-testid=ai-approach-review]")).toBeNull(); plain.dispose();
      note.dispose(); review.click(); confirm.click();
      expect(actions.onReviewApproach).toHaveBeenCalledOnce(); expect(actions.onConfirmApproach).toHaveBeenCalledOnce();
    } finally { note.dispose(); await dom.happyDOM.close(); }
  });

  it.each(["user-authored", "advisory", "unowned", "stale"])("does not derive authority from %s failure", kind => {
    const f = p7Approach();
    const evidence = new ToolVerificationEvidence();
    const criterion = f.criteria[13]!;
    if (criterion.kind !== "toolVerdict") throw new Error("Missing criterion");
    const initialState = verificationInitialState("run_scene_test", f.project);
    if (kind !== "unowned") evidence.adopt({ checkId: "canonical", ownerId: "owner", name: "run_scene_test", args: f.args,
      acceptedCriterion: criterion, aiDeclared: kind !== "user-authored", interactionTargets: criterion.interactionTargets, initialState });
    evidence.observe("run_scene_test", f.args, runTool({ project: f.project }, "run_scene_test", f.args), kind === "advisory" ? "advisory" : "explicit", "owner", undefined, initialState);
    if (kind === "stale") evidence.invalidateAfterWrite();
    expect(evidence.previewApproach("canonical", f.project)).toBeNull();
    expect(evidence.snapshot().approaches).toEqual([]);
  });

  it("rejects a same-event foreign-map receipt and mismatched initial state even when the runner verdict says pass", () => {
    const f = p7Approach();
    const ledger = new ToolVerificationEvidence();
    const initialState = verificationInitialState("run_scene_test", f.project);
    const criterion = f.criteria[13]!;
    if (criterion.kind !== "toolVerdict") throw new Error("Missing criterion");
    ledger.adopt({ checkId: "canonical", ownerId: "owner", name: "run_scene_test", args: f.args, aiDeclared: true, acceptedCriterion: criterion, initialState, interactionTargets: criterion.interactionTargets });
    ledger.observe("run_scene_test", f.args, runTool({ project: f.project }, "run_scene_test", f.args), "explicit", "owner", "canonical", initialState);
    const preview = ledger.previewApproach("canonical", f.project)!;
    expect(ledger.confirmApproach(preview, f.project)).not.toBeNull();
    const passed = { ok: true, summary: "pass", data: { ok: true, interactions: preview.interactionTargets } };
    ledger.observe("run_scene_test", preview.args, { ...passed, data: { ...passed.data, interactions: preview.interactionTargets.map(target => ({ ...target, mapId: "foreign" })) } }, "explicit", "owner", "canonical", initialState);
    expect(ledger.passedScope("run_scene_test", f.args, "canonical")).toBe(false);
    ledger.observe("run_scene_test", preview.args, passed, "explicit", "owner", "canonical", { session: { gold: 999 } });
    expect(ledger.passedScope("run_scene_test", f.args, "canonical")).toBe(false);
  });
});
