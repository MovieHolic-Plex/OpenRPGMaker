import recordedRepairs from "./fixtures/acceptance-round2-repairs.json";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as applyStore from "@/editor/tools/applyChangesetToStore";
import { store } from "@/project/store";
afterEach(() => vi.restoreAllMocks());
import { AssistantSession } from "@/ai/assistantSession";
import { createBlankProject } from "@/project/defaults";

describe("session acceptance ownership", () => {
  it("exposes the session-owned acceptance snapshot independently of WorkPlan", () => {
    // Given a new session; when inspected; then the read-only ledger API exists.
    const session = new AssistantSession(createBlankProject());
    expect("getAcceptanceSnapshot" in session).toBe(true);
    expect("refreshAcceptance" in session).toBe(true);
  });
});


import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import type { SessionEvent } from "@/ai/assistantSession";
import { fixedDeclarer } from "./intentFixture";

type Call = { readonly name: string; readonly args: Record<string, unknown> };
const work = { goal: "Authored map contract", layers: [{ title: "Edit", items: [{ id: "work", title: "Edit map", instruction: "Rename the map" }] }] };
function script(rounds: readonly (readonly Call[])[]) {
  const project = createBlankProject();
  const events: SessionEvent[] = [];
  let calls = 0;
  const session = new AssistantSession(project, {
    config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 12 },
    declareIntent: fixedDeclarer({ mode: "modify", targetMapId: project.startMapId }),
    renderImages: async () => [{ label: "Rendered map", dataUrl: "data:image/png;base64,AA==" }],
    chat: async (): Promise<ChatResult> => {
      const batch = rounds[calls++];
      return batch ? { message: { role: "assistant", content: null, tool_calls: batch.map((call, i) => ({ id: `c${calls}_${i}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } })) }, finishReason: "tool_calls" }
        : { message: { role: "assistant", content: "SCRIPTED_SUCCESS" }, finishReason: "stop" };
    },
  });
  return { session, events, project, run: (autonomous = false) => session.sendUserMessage("Edit the authored map", event => events.push(event), undefined, { autonomous }), calls: () => calls };
}
function snapshot(session: AssistantSession): unknown {
  return "getAcceptanceSnapshot" in session && typeof session.getAcceptanceSnapshot === "function" ? session.getAcceptanceSnapshot() : null;
}
const target = { mapId: createBlankProject().startMapId };

describe("acceptance controls actual session termination", () => {
  it("does not schedule run-end persistence proof for a completed plan with unmet acceptance", async () => {
    const fixture = script([[{ name: "set_work_plan", args: { ...work, acceptance: [
      { id: "size", title: "Required size", criteria: [{ kind: "mapDimensions", target, width: 99, height: 99 }] },
    ] } }, { name: "skip_work_item", args: {} }]]);
    const prove = vi.spyOn(fixture.session, "proveAppliedRevision");
    await fixture.run(true);
    expect(fixture.session.getWorkPlan()?.layers[0]?.items[0]?.status).toBe("skipped");
    expect(fixture.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(prove).not.toHaveBeenCalled();
    expect(fixture.session.getRunEndProof()).toBeNull();
  });

  it("does not turn a review without an explicit passing verdict into completion", async () => {
    // Given delivered image coverage and a review that never declares a pass.
    const project = createBlankProject(), map = project.maps[project.startMapId];
    const fixture = script([
      [{ name: "set_work_plan", args: { ...work, acceptance: [{ id: "image", title: "Review", criteria: [{ kind: "imageReviewed", target }] }] } }, { name: "skip_work_item", args: {} }],
      [{ name: "show_map_region", args: { mapId: project.startMapId, x: 0, y: 0, w: map.width, h: map.height } }],
      [{ name: "review_acceptance", args: { itemId: "image", note: "Inspection observations" } }],
    ]);
    // When the model attempts finalization, then coverage and a note are not a verdict.
    await fixture.run();
    expect(fixture.session.getAcceptanceSnapshot()?.status).not.toBe("verified");
  });

  it("withdraws an earlier pass when a later explicit review fails", async () => {
    // Given a passing review followed by a failed review of the same delivered image.
    const project = createBlankProject(), map = project.maps[project.startMapId];
    const fixture = script([
      [{ name: "set_work_plan", args: { ...work, acceptance: [{ id: "image", title: "Review", criteria: [{ kind: "imageReviewed", target }] }] } }, { name: "skip_work_item", args: {} }],
      [{ name: "show_map_region", args: { mapId: project.startMapId, x: 0, y: 0, w: map.width, h: map.height } }],
      [{ name: "review_acceptance", args: { itemId: "image", verdict: "pass", note: "Initial inspection" } }],
      [{ name: "review_acceptance", args: { itemId: "image", verdict: "fail", note: "An unfinished edge remains" } }],
    ]);
    // When the later verdict is recorded, then both verdicts are accepted but completion is revoked.
    await fixture.run();
    const reviews = fixture.events.filter(event => event.type === "tool_call" && event.name === "review_acceptance");
    expect(reviews.map(event => event.type === "tool_call" && event.result.ok)).toEqual([true, true]);
    expect(fixture.session.getAcceptanceSnapshot()?.status).not.toBe("verified");
    expect(fixture.session.getAcceptanceSnapshot()?.items[0]?.evidence[0]?.observed).toContain("An unfinished edge remains");
  });

  it("continues then blocks insufficient dimensions and quantity even after skip completes the plan", async () => {
    // Given unmet exact promises and a model that skips its work.
    const fixture = script([[{ name: "set_work_plan", args: { ...work, acceptance: [
      { id: "size", title: "Required size", criteria: [{ kind: "mapDimensions", target, width: 99, height: 99 }] },
      { id: "events", title: "Required events", criteria: [{ kind: "eventCount", target, count: 7 }] },
    ] } }, { name: "skip_work_item", args: {} }]]);
    // When the real session receives repeated final-success responses.
    const result = await fixture.run();
    // Then skipped work cannot authorize final success and repair is bounded.
    expect(result.assistantText).not.toBe("SCRIPTED_SUCCESS");
    expect(fixture.calls()).toBeGreaterThan(2);
    expect(snapshot(fixture.session)).toMatchObject({ status: "blocked", items: [{ id: "size", status: "blocked" }, { id: "events", status: "blocked" }] });
  });

  it("retains original denominator when skip and set_work_plan try to shrink promises", async () => {
    // Given an original promise, followed by a replacement plan with one easier promise.
    const fixture = script([
      [{ name: "set_work_plan", args: { ...work, acceptance: [{ id: "original", title: "Original", criteria: [{ kind: "eventCount", target, count: 7 }] }] } }, { name: "skip_work_item", args: {} }],
      [{ name: "set_work_plan", args: { ...work, acceptance: [{ id: "replacement", title: "Replacement", criteria: [{ kind: "eventCount", target, count: 0 }] }] } }, { name: "skip_work_item", args: {} }],
    ]);
    // When both plans are marked finished; then the goal still owns both promises.
    await fixture.run();
    expect(snapshot(fixture.session)).toMatchObject({ items: [{ id: "original", status: "blocked" }, { id: "replacement", status: "verified" }] });
  });

  it("invalidates an attributed image review after a subsequent real map write", async () => {
    // Given actual show_map_region output delivered through the image-render boundary.
    const project = createBlankProject(), map = project.maps[project.startMapId];
    const fixture = script([
      [{ name: "set_work_plan", args: { ...work, acceptance: [{ id: "image", title: "Review", criteria: [{ kind: "imageReviewed", target }] }] } }, { name: "skip_work_item", args: {} }],
      [{ name: "show_map_region", args: { mapId: project.startMapId, x: 0, y: 0, w: map.width, h: map.height } }],
      [{ name: "review_acceptance", args: { itemId: "image", verdict: "pass", note: "The delivered image was inspected" } }],
      [{ name: "set_map_properties", args: { mapId: project.startMapId, name: "Changed after review" } }],
    ]);
    // When the real map tool changes the reviewed content; then prior review is stale.
    await fixture.run();
    expect(fixture.events.find(event => event.type === "tool_call" && event.name === "review_acceptance")).toMatchObject({ result: { ok: true } });
    expect(snapshot(fixture.session)).toMatchObject({ status: "blocked", items: [{ id: "image", status: "blocked", evidence: [{ passed: false }] }] });
  });
});


describe("applied acceptance lifecycle through real tools", () => {
  it("repairs exact dimensions after plan completion and invalidates on applied undo", async () => {
    // Given the real resize tool and only the external persistence boundary replaced.
    vi.spyOn(store, "isRemotePersistenceEnabled").mockReturnValue(false);
    vi.spyOn(applyStore, "applyProposedProject").mockImplementation(async applied => ({
      ok: true, applied,
      commit: { commitId: null, persisted: false, reviewStatus: "approved", summary: "local test", toolNames: [], recordedAt: "2026-09-06T00:00:00.000Z" },
    }));
    const fixture = script([
      [{ name: "set_work_plan", args: { ...work, acceptance: [{ id: "size", title: "Required size", criteria: [{ kind: "mapDimensions", target, width: 22, height: 17 }] }] } }, { name: "skip_work_item", args: {} }],
      [],
      [{ name: "resize_map", args: { mapId: target.mapId, width: 21, height: 17 } }],
      [],
      [{ name: "resize_map", args: { mapId: target.mapId, width: 22, height: 17 } }],
    ]);
    // When the plan is already done but the first resize is insufficient.
    await fixture.run(true);
    // Then final verification follows the applied map rather than the finished plan.
    expect(fixture.session.getAcceptanceSnapshot()).toMatchObject({ status: "verified", items: [{ id: "size", status: "verified" }] });
    expect(fixture.events.filter(event => event.type === "acceptance").some(event => event.type === "acceptance" && event.snapshot?.items[0]?.evidence[0]?.observed === "21x17" && event.snapshot.status !== "verified")).toBe(true);
    fixture.session.refreshAcceptance(fixture.project, event => fixture.events.push(event));
    expect(fixture.session.getAcceptanceSnapshot()?.status).not.toBe("verified");
    expect(fixture.events.at(-1)).toMatchObject({ type: "acceptance", snapshot: { items: [{ evidence: [{ observed: "20x15", passed: false }] }] } });
  });

  it("blocks and retains the ledger when aborted while the next model response is held", async () => {
    // Given an event promise subscribed before entering the real session.
    const controller = new AbortController();
    let enteredResolve: (() => void) | undefined;
    const entered = new Promise<void>(resolve => { enteredResolve = resolve; });
    let releaseResolve: (() => void) | undefined;
    const release = new Promise<void>(resolve => { releaseResolve = resolve; });
    let round = 0;
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 8 },
      declareIntent: fixedDeclarer({ mode: "modify", targetMapId: target.mapId }),
      chat: async (): Promise<ChatResult> => {
        if (round++ === 0) return { message: { role: "assistant", content: null, tool_calls: [{ id: "plan", type: "function", function: { name: "set_work_plan", arguments: JSON.stringify({ ...work, acceptance: [{ id: "size", title: "Required size", criteria: [{ kind: "mapDimensions", target, width: 22, height: 17 }] }] }) } }] }, finishReason: "tool_calls" };
        enteredResolve?.();
        await release;
        return { message: { role: "assistant", content: null, tool_calls: [{ id: "read", type: "function", function: { name: "get_project_summary", arguments: "{}" } }] }, finishReason: "tool_calls" };
      },
    });
    const deadline = AbortSignal.timeout(5000);
    const expired = new Promise<never>((_resolve, reject) => deadline.addEventListener("abort", () => reject(new Error("Model hold deadline exceeded")), { once: true }));
    const running = session.sendUserMessage("Resize map", () => {}, controller.signal);
    // When the exact pending-model event fires, abort without sleeping/polling.
    await Promise.race([entered, expired]);
    controller.abort(); releaseResolve?.();
    const result = await Promise.race([running, expired]);
    // Then no success survives and the session-owned note remains available.
    expect(result.stoppedReason).toBe("aborted");
    expect(session.getAcceptanceSnapshot()).toMatchObject({ status: "blocked", items: [{ id: "size", status: "blocked" }] });
    session.clearWorkPlan();
    expect(session.getAcceptanceSnapshot()?.items).toHaveLength(1);
  });

  it("never credits a review authored in the same response as the image request", async () => {
    // Given show and review in one model response (the model has not consumed the image).
    const fixture = script([
      [{ name: "set_work_plan", args: { ...work, acceptance: [{ id: "image", title: "Image", criteria: [{ kind: "imageReviewed", target }] }] } }, { name: "skip_work_item", args: {} }],
      [{ name: "show_map_region", args: { mapId: target.mapId, x: 0, y: 0, w: 20, h: 15 } }, { name: "review_acceptance", args: { itemId: "image", verdict: "pass", note: "Premature" } }],
    ]);
    // When executed; then image-tool success alone cannot mark the row verified.
    await fixture.run();
    expect(fixture.events.find(event => event.type === "tool_call" && event.name === "review_acceptance")).toMatchObject({ result: { ok: false } });
    expect(fixture.session.getAcceptanceSnapshot()?.status).toBe("blocked");
  });

  it("requires visible contract repair for a spatial plan missing criteria", async () => {
    // Given a spatial work plan without any structured criteria.
    const fixture = script([[{ name: "set_work_plan", args: work }, { name: "skip_work_item", args: {} }],
      [{ name: "repair_acceptance", args: { itemId: "acceptance-contract", criteria: [{ kind: "mapDimensions", target, width: 20, height: 15 }] } }],
    ]);
    // When repaired through its dedicated tool; then only measured applied facts verify.
    await fixture.run();
    expect(fixture.events.filter(event => event.type === "acceptance").some(event => event.type === "acceptance" && event.snapshot?.items[0]?.id === "acceptance-contract" && event.snapshot.status === "blocked")).toBe(true);
    expect(fixture.session.getAcceptanceSnapshot()?.status).toBe("verified");
  });

  it("keeps legacy nonspatial and read-only requests free of fabricated map promises", async () => {
    // Given a read-only request without spatial intent or authored acceptance.
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test" },
      declareIntent: fixedDeclarer({ mode: "question" }),
      chat: async () => ({ message: { role: "assistant", content: "A factual answer" }, finishReason: "stop" }),
    });
    // When answered; then the session has no acceptance denominator.
    await session.sendUserMessage("Explain this project");
    expect(session.getAcceptanceSnapshot()).toBeNull();
  });
});


describe("recorded provider acceptance repair failures (R7)", () => {
  it.each(recordedRepairs)("identifies the missing scope atomically in recorded repair %#", async args => {
    const fixture = script([
      [{ name: "set_work_plan", args: { ...work, acceptance: [{ id: "acceptance-contract", title: "Recorded contract", criteria: args.criteria }] } }],
      [{ name: "repair_acceptance", args }],
      [{ name: "repair_acceptance", args: { ...args, criteria: args.criteria.map(criterion => criterion.kind === "mapCount"
        ? { ...criterion, targets: [{ mapId: "map_blank_start" }, { mapId: "map_basement" }] } : criterion) } }],
    ]);
    await fixture.run();
    const repairs = fixture.events.filter(event => event.type === "tool_call" && event.name === "repair_acceptance");
    expect(repairs[0]).toMatchObject({ result: { ok: false, data: { code: "malformed-criteria", issues: [
      { criterionIndex: 0, field: "criteria[0].targets", code: "missing-field", example: { kind: "mapCount", targets: expect.any(Array) } },
    ], acceptance: { items: [{ evidence: [] }] } } } });
    expect(repairs[1]).toMatchObject({ result: { ok: true, data: { code: "repaired" } } });
    const adoption = fixture.events.find(event => event.type === "tool_call" && event.name === "set_work_plan");
    expect(adoption).toMatchObject({ result: { data: { acceptance: { items: [{ issues: [
      { field: "criteria[0].targets", code: "missing-field" },
    ] }] } } } });
  });
});


it("returns distinct repair and review diagnostics through the actual session handler", async () => {
  const fixture = script([
    [{ name: "set_work_plan", args: { ...work, acceptance: [
      { id: "valid", title: "Valid", criteria: [{ kind: "preserve", target }] },
      { id: "bad", title: "Bad", criteria: null },
      { id: "image", title: "Image", criteria: [{ kind: "imageReviewed", target }] },
    ] } }],
    [{ name: "repair_acceptance", args: { itemId: "unknown", criteria: [] } },
      { name: "repair_acceptance", args: { itemId: "valid", criteria: [] } },
      { name: "repair_acceptance", args: { itemId: "bad", criteria: [{ kind: "preserve", target }, { kind: "mapCount", count: 1, targets: [{ ...target, newMapName: "Both" }] }] } },
      { name: "review_acceptance", args: { itemId: "image", verdict: "pass", note: "No delivered image" } }],
  ]);
  await fixture.run();
  const results = fixture.events.filter(event => event.type === "tool_call" && ["repair_acceptance", "review_acceptance"].includes(event.name));
  expect(results).toMatchObject([
    { result: { ok: false, data: { code: "unknown-item" } } },
    { result: { ok: false, data: { code: "immutable-valid" } } },
    { result: { ok: false, data: { code: "malformed-criteria", issues: [{ criterionIndex: 1, field: "criteria[1].targets[0]", code: "invalid-selector" }], acceptance: { items: [{ id: "valid", status: "verified" }, { id: "bad", evidence: [] }, { id: "image", evidence: [{ passed: false }] }] } } } },
    { result: { ok: false, data: { code: "image-review-unavailable" } } },
  ]);
});

it.each([undefined, [{ id: "bad", title: "Bad", criteria: [{ kind: "mapCount", count: 2 }] }]])("exposes planner acceptance diagnostics before the first generation response (%j)", async acceptance => {
  const project = createBlankProject();
  let generationCalls = 0;
  const session = new AssistantSession(project, {
    config: { ...defaultAiConfig(), agentMode: "auto", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 1 },
    declareIntent: fixedDeclarer({ mode: "modify", targetMapId: project.startMapId }),
    chat: async (_config, request): Promise<ChatResult> => {
      if (!request.tools?.length) return { message: { role: "assistant", content: JSON.stringify({ action: "new_plan", ...work, acceptance }) }, finishReason: "stop" };
      if (generationCalls++ === 0) {
        const diagnostic = request.messages.flatMap(message => {
          if (message.role !== "user" || typeof message.content !== "string") return [];
          const start = message.content.indexOf('{"code":"malformed-criteria"');
          if (start < 0) return [];
          const value: unknown = JSON.parse(message.content.slice(start));
          return [value];
        });
        expect(diagnostic).toMatchObject([{ code: "malformed-criteria", items: [{ issues: [{ field: acceptance ? "criteria[0].targets" : "criteria", code: "missing-field" }] }] }]);
      }
      return { message: { role: "assistant", content: "No content generated" }, finishReason: "stop" };
    },
  });
  await session.sendUserMessage("Edit the authored map");
  expect(generationCalls).toBeGreaterThan(0);
});
