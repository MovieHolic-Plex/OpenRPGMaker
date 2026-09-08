import { beforeEach, describe, expect, it } from "vitest";
import { AssistantSession, type SessionEvent, type SessionTurnOptions, type ToolImageRenderer } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";
import { resetIntentDeclarationCache } from "@/ai/intentDeclarationClient";

beforeEach(resetIntentDeclarationCache);

type Call = { readonly name: string; readonly args: Record<string, unknown> };
type Stop = "final" | "max-tool-calls" | "token-budget";
const image = { label: "Map render", dataUrl: "data:image/png;base64,AA==" };
const INSPECT = "Inspect both authored maps";
const SOURCE_ITEM = "request-1:source:0";

function inspectRequirements(maps: ReadonlyArray<{ readonly id: string }>) {
  return {
    entries: [{
      source: [{ start: 0, end: INSPECT.length, quote: INSPECT }],
      criteria: maps.map(map => ({ kind: "imageReviewed" as const, target: { mapId: map.id } })),
      bindings: [],
    }],
  };
}

function statusById(session: AssistantSession): Record<string, string | undefined> {
  return Object.fromEntries((session.getAcceptanceSnapshot()?.items ?? []).map(item => [item.id, item.status]));
}

function fixture(options: { readonly stop?: Stop; readonly render?: ToolImageRenderer; readonly requireBattle?: boolean } = {}) {
  const project = createBlankProject();
  const start = project.maps[project.startMapId];
  project.maps.second = { ...structuredClone(start), id: "second", name: "Second" };
  const maps = Object.values(project.maps);
  const plan: Call[] = [{ name: "set_work_plan", args: {
    goal: "Inspect both maps", layers: [{ title: "Inspect", items: [{ id: "work", title: "Inspect", instruction: "Inspect" }] }],
    acceptance: maps.map(map => ({ id: map.id, title: map.name, criteria: [{ kind: "imageReviewed", target: { mapId: map.id } }] })),
  } }, { name: "skip_work_item", args: {} }];
  const shows: Call[] = maps.map(map => ({ name: "show_map_region", args: { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height } }));
  const reviews: Call[] = [
    ...maps.map(map => ({ name: "review_acceptance", args: { itemId: map.id, verdict: "pass", note: "Inspected delivered image" } })),
    { name: "review_acceptance", args: { itemId: SOURCE_ITEM, verdict: "pass", note: "Inspected delivered image" } },
  ];
  const dbWrite: Call[] = [{ name: "upsert_skill", args: { skill: { id: "visual_test_skill", name: "DB only" } } }];
  const rounds: Call[][] = [plan, shows, reviews, dbWrite];
  const events: SessionEvent[] = [];
  let round = 0;
  let deliveredImages = 0;
  const session = new AssistantSession(project, {
    config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test",
      maxToolCalls: options.stop === "max-tool-calls" ? 4 : 20, maxTokens: 10000 },
    declareIntent: fixedDeclarer({
      mode: "modify",
      targetMapId: start.id,
      requestRequirements: inspectRequirements(maps),
      adventure: { village: false, dungeon: false, party: false, battle: options.requireBattle ?? false },
    }),
    renderImages: options.render ?? (async () => [image]),
    chat: async (_config, request): Promise<ChatResult> => {
      deliveredImages = request.messages.flatMap(message => Array.isArray(message.content) ? message.content : []).filter(part => part.type === "image_url").length;
      const batch = rounds[round++];
      return batch ? { message: { role: "assistant", content: null, tool_calls: batch.map((call, index) => ({ id: `c${round}_${index}`, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } })) }, finishReason: "tool_calls",
        usage: { prompt_tokens: 1, completion_tokens: options.stop === "token-budget" && round === rounds.length ? 10000 : 0, total_tokens: 1 } }
        : { message: { role: "assistant", content: "SCRIPTED_FINAL" }, finishReason: "stop" };
    },
  });
  return { project, session, events, rounds, shows, reviews, startId: start.id, deliveredImages: () => deliveredImages,
    run: (opts?: SessionTurnOptions) => session.sendUserMessage(INSPECT, event => events.push(event), undefined, opts) };
}

describe("one visual evidence lifecycle", () => {
  it.each<Stop>(["final", "max-tool-calls", "token-budget"])("preserves delivered reviewed maps after a DB-only write at %s termination", async stop => {
    // Given two delivered/reviewed maps followed by a real non-rendering DB tool.
    const f = fixture({ stop });
    // When the session terminates normally or through either execution budget.
    const result = await f.run();
    // Then sticky acceptance and terminal adventure coverage agree on currentness.
    expect(f.events.find(event => event.type === "tool_call" && event.name === "upsert_skill")).toMatchObject({ result: { ok: true } });
    expect(f.session.getProposedProject().database.skills.some(skill => skill.id === "visual_test_skill")).toBe(true);
    expect(f.deliveredImages()).toBe(2);
    const statuses = statusById(f.session);
    expect(statuses[SOURCE_ITEM]).toBe("verified");
    expect(statuses[f.startId]).toBe("verified");
    expect(statuses.second).toBe("verified");
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
    expect(f.session["adventureProblems"]()).toEqual([]);
    expect(result.stoppedReason).toBe(stop);
    if (stop === "final") expect(result.assistantText).toBe("SCRIPTED_FINAL");
  });

  it.each(["empty", "failed"])("does not credit metadata when rendering is %s", async mode => {
    // Given successful map metadata but no delivered rendered image.
    const f = fixture({ render: async () => { if (mode === "failed") throw new Error("Render failed"); return []; } });
    f.rounds.pop();
    // When the model attempts to review and finalize.
    await f.run();
    // Then neither reporting surface credits the metadata as coverage.
    expect(f.deliveredImages()).toBe(0);
    const statuses = statusById(f.session);
    expect(statuses[SOURCE_ITEM]).toBe("blocked");
    expect(statuses[f.startId]).toBe("blocked");
    expect(statuses.second).toBe("blocked");
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(f.session["adventureProblems"]()).toHaveLength(2);
  });
});

describe("visual evidence invalidation and review boundaries", () => {
  it("invalidates only the changed map after a real resize and does not revive it on undo", async () => {
    // Given both maps reviewed before one map is resized by the real tool.
    const f = fixture();
    f.rounds[3] = [{ name: "resize_map", args: { mapId: f.project.startMapId, width: 21, height: 15 } }];
    // When finalizing and then undoing to the previously reviewed project.
    await f.run();
    expect(f.events.find(event => event.type === "tool_call" && event.name === "resize_map")).toMatchObject({ result: { ok: true } });
    const afterResize = statusById(f.session);
    expect(afterResize[f.startId]).toBe("blocked");
    expect(afterResize.second).toBe("verified");
    expect(afterResize[SOURCE_ITEM]).toBe("blocked");
    expect(f.session["adventureProblems"]()).toHaveLength(1);
    f.session.rebaseProject(f.project);
    // Then undo cannot recreate either the retired image receipt or its review.
    const afterUndo = statusById(f.session);
    expect(afterUndo[f.startId]).toBe("blocked");
    expect(afterUndo.second).toBe("verified");
    expect(afterUndo[SOURCE_ITEM]).toBe("blocked");
    expect(f.session["adventureProblems"]()).toHaveLength(1);
  });

  it("retains current images across a follow-up without a new render", async () => {
    // Given a completed inspection in this conversation.
    const f = fixture();
    await f.run();
    // When another non-resetting user turn has no render-input changes.
    const result = await f.run({ goalAction: "resume" });
    // Then both reports reuse the same current receipts rather than resetting just one.
    const statuses = statusById(f.session);
    expect(statuses[SOURCE_ITEM]).toBe("verified");
    expect(statuses[f.startId]).toBe("verified");
    expect(statuses.second).toBe("verified");
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("verified");
    expect(f.session["adventureProblems"]()).toEqual([]);
    expect(result.assistantText).toBe("SCRIPTED_FINAL");
  });

  it.each(["missing", "same-response", "fail"])("does not verify %s explicit review", async mode => {
    // Given coverage without a later explicit passing review (or with a later failure).
    const f = fixture();
    f.rounds.pop();
    if (mode === "missing") f.rounds.pop();
    if (mode === "same-response") f.rounds.splice(1, 2, [...f.shows, ...f.reviews]);
    if (mode === "fail") f.rounds.push(f.reviews.map(call => ({ ...call, args: { ...call.args, verdict: "fail" } })));
    // When the session attempts completion.
    const result = await f.run();
    // Then delivered coverage is not equivalent to a passing visual assessment.
    expect(f.session["adventureProblems"]()).toEqual([]);
    const statuses = statusById(f.session);
    expect(statuses[SOURCE_ITEM]).toBe("blocked");
    expect(statuses[f.startId]).toBe("blocked");
    expect(statuses.second).toBe("blocked");
    expect(result.assistantText).not.toBe("SCRIPTED_FINAL");
    if (mode === "same-response") expect(f.events.filter(event => event.type === "tool_call" && event.name === "review_acceptance").map(event => event.type === "tool_call" && event.result.ok)).toEqual([false, false, false]);
  });

  it("requires coverage of every promised map", async () => {
    // Given only the first map's image, despite a promise covering both maps.
    const f = fixture();
    f.shows.splice(1); f.rounds.pop();
    // When the model reviews and finalizes.
    await f.run();
    // Then unrelated coverage cannot stand in for the missing second map.
    const statuses = statusById(f.session);
    expect(statuses[f.startId]).toBe("verified");
    expect(statuses.second).toBe("blocked");
    expect(statuses[SOURCE_ITEM]).toBe("blocked");
    expect(f.session["adventureProblems"]()).toHaveLength(1);
  });

  it("does not turn verified map images into game-completion proof", async () => {
    // Given full reviewed images but a requested battle that is not connected.
    const f = fixture({ requireBattle: true });
    // When the model claims completion.
    const result = await f.run();
    // Then static adventure requirements remain independent of image verification.
    const statuses = statusById(f.session);
    expect(statuses[SOURCE_ITEM]).toBe("verified");
    expect(statuses[f.startId]).toBe("verified");
    expect(statuses.second).toBe("verified");
    expect(f.session.getAcceptanceSnapshot()?.status).toBe("blocked");
    expect(f.session["adventureRequirements"]?.battle).toBe(true);
    expect(f.session["adventureProblems"]()).toHaveLength(1);
    expect(result.assistantText).not.toBe("SCRIPTED_FINAL");
  });
});
