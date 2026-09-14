import { cooperativeNodeYield } from "./cooperativeNodeYield";
import { reviewingChat } from "./aiEpochFixture";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { applyProposedProject } from "@/editor/tools/applyChangesetToStore";
import * as history from "@/editor/mapEditHistory";
import { store } from "@/project/store";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import * as commits from "@/project/projectCommitLog";
import { fixedDeclarer } from "./intentFixture";
import { bounded, deferred, epochRunner } from "./aiEpochFixture";
import { installFakeDom } from "./fakeDom";
import * as activity from "@/ai/activityLog";
import * as changeset from "@/editor/tools/changeset";
import { RunOperation } from "@/ai/runOperation";
import { clearAgentBlueprint } from "@/editor/agentBlueprint";
import { clearAgentGhostPreview } from "@/editor/agentGhostPreview";
import { applyFixture, drainOutcomeFixtures } from "./runOutcomeApplyFixture";
import { createProjectWikiCoordinator } from "@/editor/projectWikiCoordinator";

const final: ChatResult = { message: { role: "assistant", content: "RESULT" }, finishReason: "stop" };
const title = (value: string): ChatResult => ({ message: { role: "assistant", content: null,
  tool_calls: [{ id: value, type: "function", function: { name: "set_title_screen", arguments: JSON.stringify({ title: value }) } }] }, finishReason: "tool_calls" });
const config = { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 4 } satisfies ReturnType<typeof defaultAiConfig>;

beforeEach(() => {
  // Store persistence and commit-history transport are independent boundaries.
  vi.stubEnv("VITE_SUPABASE_USE_PROXY", "0");
  vi.stubEnv("VITE_SUPABASE_URL", "");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "");
  vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "");
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  store.replace(createBlankProject());
  history.resetMapEditHistory();
});
afterEach(async () => {
  await store.flush(); await drainOutcomeFixtures();
  store._setPersistenceStateForTest({ loaded: false, remotePersistenceEnabled: false, disabledReason: null });
  history.resetMapEditHistory(); clearAgentBlueprint(); clearAgentGhostPreview();
  vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

function liveValues() {
  const project = store.getCurrent();
  const map = project.maps[project.startMapId];
  const item = project.database.items.find(entry => entry.id === "item_potion");
  if (!map || !item) throw new Error("Missing real map/item fixture");
  return { tile: map.lowerTiles[1], width: project.system.playResolution?.width ?? 320, itemId: item.id, price: item.price };
}
function humanEdits() {
  store.updateMap(store.getCurrent().startMapId, map => { map.lowerTiles[1] = 7; }, { origin: "human" });
  store.update(project => {
    const item = project.database.items.find(entry => entry.id === "item_potion");
    if (!item) throw new Error("Missing potion");
    item.price = 137;
    project.system.playResolution = { width: 336, height: 240 };
  }, { scope: "database", collection: "items", origin: "human" });
}
function sessionForTitle(value = "AI_TITLE") {
  let round = 0;
  return new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }),
    yieldToUi: cooperativeNodeYield, chat: reviewingChat(async () => round++ === 0 ? title(value) : final) });
}

it("refuses an old real session proposal after human non-house tile and database record edits", async () => {
  const session = sessionForTitle();
  const turn = await session.sendUserMessage("Set title");
  expect(turn.proposedCalls.map(call => call.name)).toEqual(["set_title_screen"]);
  const proposed = session.getProposedProject();
  humanEdits();
  const human = store.getCurrent();
  const bytes = serialize(human);
  expect(liveValues()).toEqual({ tile: 7, width: 336, itemId: "item_potion", price: 137 });
  const snapshot = vi.spyOn(history, "recordProjectSnapshot");
  const commit = vi.spyOn(commits, "recordProjectCommit");
  const replace = vi.spyOn(store, "replace");
  const applied = await applyProposedProject(proposed, { base: session.getProposalBase(), baseline: session.getDraftBaseline(), source: "agent", summary: "Title", toolNames: ["set_title_screen"] });
  // Both values must be measured even when the old implementation overwrites both.
  expect.soft(liveValues().tile).toBe(7);
  expect.soft(liveValues().price).toBe(137);
  expect.soft(liveValues().width).toBe(336);
  expect(applied).toMatchObject({ ok: false, reason: "stale-base" });
  expect(store.getCurrent()).toBe(human);
  expect(serialize(store.getCurrent())).toBe(bytes);
  expect(snapshot).not.toHaveBeenCalled();
  expect(commit).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
  expect(history.getMapEditHistoryEntries()).toHaveLength(0);
});

it("applies a current-base real proposal exactly once and undo restores its original project", async () => {
  humanEdits();
  const before = serialize(store.getCurrent());
  const session = sessionForTitle();
  const turn = await session.sendUserMessage("Set title");
  const commit = vi.spyOn(commits, "recordProjectCommit");
  const applied = await applyProposedProject(session.getProposedProject(), {
    base: session.getProposalBase(), baseline: session.getDraftBaseline(),
    source: "agent", summary: "Title", toolNames: turn.proposedCalls.map(call => call.name),
  });
  expect(applied.ok).toBe(true);
  expect(store.getCurrent().system.titleScreen?.title).toBe("AI_TITLE");
  expect(liveValues()).toEqual({ tile: 7, width: 336, itemId: "item_potion", price: 137 });
  expect(commit).toHaveBeenCalledTimes(1);
  expect(history.getMapEditHistoryEntries()).toHaveLength(1);
  expect(history.undoMapEdit()).toBe(true);
  expect(serialize(store.getCurrent())).toBe(before);
});

it("rechecks the actual synchronous write boundary after validation, before undo or replacement", async () => {
  const session = sessionForTitle();
  await session.sendUserMessage("Set title");
  const original = changeset.commitChangeset;
  vi.spyOn(changeset, "commitChangeset").mockImplementation((...args) => {
    const result = original(...args);
    humanEdits();
    return result;
  });
  const snapshot = vi.spyOn(history, "recordProjectSnapshot");
  const applied = await applyProposedProject(session.getProposedProject(), {
    base: session.getProposalBase(), baseline: session.getDraftBaseline(), source: "agent", summary: "Title", toolNames: ["set_title_screen"],
  });
  expect(applied).toMatchObject({ ok: false, reason: "stale-base" });
  expect(liveValues()).toEqual({ tile: 7, width: 336, itemId: "item_potion", price: 137 });
  expect(snapshot).not.toHaveBeenCalled();
});

it.each([false, true])("same-byte project replacement retires the old base, resetProject=%s", async resetProject => {
  const session = sessionForTitle();
  await session.sendUserMessage("Set title");
  const token = store.getVersionToken();
  store.replaceProject(structuredClone(store.getCurrent()));
  expect(store.getVersionToken().lineage).not.toBe(token.lineage);
  const applied = await applyProposedProject(session.getProposedProject(), {
    base: session.getProposalBase(), baseline: session.getDraftBaseline(), source: "agent", summary: "Title", toolNames: ["set_title_screen"], resetProject,
  });
  expect(applied).toMatchObject({ ok: false, reason: "stale-base" });
  expect(history.getMapEditHistoryEntries()).toHaveLength(0);
});

it("context refresh cannot relabel a retained stale draft as current", async () => {
  const session = sessionForTitle();
  await session.sendUserMessage("Set title");
  const base = session.getProposalBase();
  humanEdits();
  session.refreshProjectContext(store.getCurrent());
  expect(session.syncBaselineFromStoreIfClean(store.getCurrent())).toBe(false);
  expect(session.getProposalBase()).toBe(base);
  const applied = await applyProposedProject(session.getProposedProject(), { base, baseline: session.getDraftBaseline(), source: "agent", summary: "Title", toolNames: ["set_title_screen"],
  });
  expect(applied).toMatchObject({ ok: false, reason: "stale-base" });
  expect(liveValues().price).toBe(137);
});

it("a no-op update and a real accepted own save do not invalidate a current proposal", async () => {
  const f = applyFixture();
  await f.run();
  const version = store.getVersionToken();
  store.update(() => {});
  expect(store.getVersionToken().generation).toBe(version.generation + 1);
  const saved = await store.flush();
  expect(saved.kind).toBe("saved");
  const applied = await applyProposedProject(f.session.getProposedProject(), {
    base: f.session.getProposalBase(), baseline: f.session.getDraftBaseline(), source: "agent", summary: "Title", toolNames: ["set_title_screen"],
  });
  expect(applied.ok).toBe(true);
  expect(store.getCurrent().system.titleScreen?.title).toBe("Run-owned title");
  expect(history.getMapEditHistoryEntries()).toHaveLength(1);
});

it.each(["record", "map", "world"])("object-key reorder in a live %s is not a stale authored base", async target => {
  store.update(project => {
    project.world = { entities: [{ id: "w_order", type: "guideline", name: "Order", summary: "Unchanged", origin: "user" }], relations: [] };
  });
  const session = sessionForTitle();
  await session.sendUserMessage("Set title");
  const before = structuredClone(store.getCurrent());
  const bytes = serialize(before);
  store.update(project => {
    if (target === "record") project.database.items = project.database.items.map(item => {
      if (item.id !== "item_potion") return item;
      const { id, ...fields } = item;
      return { ...fields, id };
    });
    if (target === "map") {
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("Missing map");
      const { id, ...fields } = map;
      project.maps[project.startMapId] = { ...fields, id };
    }
    if (target === "world") {
      if (!project.world) throw new Error("Missing world");
      project.world = { ...project.world, entities: project.world.entities.map(entity => {
        const { id, ...fields } = entity;
        return { ...fields, id };
      }) };
    }
  });
  expect(store.getCurrent()).toEqual(before);
  expect(serialize(store.getCurrent())).not.toBe(bytes);
  const applied = await applyProposedProject(session.getProposedProject(), {
    base: session.getProposalBase(), baseline: session.getDraftBaseline(), source: "agent", summary: "Title", toolNames: ["set_title_screen"], resetProject: target === "world",
  });
  expect(applied.ok).toBe(true);
  expect(store.getCurrent().system.titleScreen?.title).toBe("AI_TITLE");
  expect(history.getMapEditHistoryEntries()).toHaveLength(1);
  expect(history.undoMapEdit()).toBe(true);
  expect(store.getCurrent()).toEqual(before);
});

it("array reordering is still an authored change, not an object-key no-op", async () => {
  const session = sessionForTitle();
  await session.sendUserMessage("Set title");
  const originalIds = store.getCurrent().database.items.map(item => item.id);
  store.update(project => { project.database.items.reverse(); });
  const currentIds = store.getCurrent().database.items.map(item => item.id);
  expect(currentIds).not.toEqual(originalIds);
  const applied = await applyProposedProject(session.getProposedProject(), {
    base: session.getProposalBase(), baseline: session.getDraftBaseline(), source: "agent", summary: "Title", toolNames: ["set_title_screen"],
  });
  expect(applied).toMatchObject({ ok: false, reason: "stale-base" });
  expect(store.getCurrent().database.items.map(item => item.id)).toEqual(currentIds);
  expect(history.getMapEditHistoryEntries()).toHaveLength(0);
});

it.each([false, true])("wiki ownership survives an old ordinary base without granting reset authority, resetProject=%s", async resetProject => {
  const session = sessionForTitle();
  await session.sendUserMessage("Set title");
  store.update(project => { project.world = { entities: [{ id: "w_human_wiki", type: "guideline", name: "Human", summary: "Current", origin: "user" }], relations: [] }; });
  const world = structuredClone(store.getCurrent().world);
  const applied = await applyProposedProject(session.getProposedProject(), {
    base: session.getProposalBase(), baseline: session.getDraftBaseline(), source: "agent", summary: "Title", toolNames: ["set_title_screen"], resetProject,
  });
  expect(applied.ok).toBe(!resetProject);
  if (!applied.ok) expect(applied.reason).toBe("stale-base");
  expect(store.getCurrent().world).toEqual(world);
});

it("own wiki preparation and post-tool progress retain their actual save/proof owners", async () => {
  applyFixture(); // Real store persistence against an isolated wire-level row.
  const coordinator = createProjectWikiCoordinator({ history: async () => [], extract: async input => ({ upserts: [{
    id: "w_owned_wiki", type: "guideline", name: "Combat", summary: "Contact battles",
    wiki: { kind: "declaration", basis: "explicit", combatMode: "contact", sourceIds: input.sources.map(source => source.id) },
  }] }) });
  let round = 0;
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }),
    prepareProjectWiki: coordinator.prepare, yieldToUi: cooperativeNodeYield, chat: reviewingChat(async () => round++ === 0 ? title("OWNED_TITLE") : final) });
  const turn = await session.sendUserMessage("Set title");
  expect(turn.proposedCalls).toHaveLength(1);
  expect(store.getCurrent().world?.entities.some(entity => entity.id === "w_owned_wiki")).toBe(true);
  const applied = await applyProposedProject(session.getProposedProject(), {
    base: session.getProposalBase(), baseline: session.getDraftBaseline(), operation: session.getRunOperation(), source: "agent", summary: "Title", toolNames: ["set_title_screen"],
  });
  if (!applied.ok) throw new Error(applied.issue);
  expect(applied.wikiDelivery?.kind).toBe("persisted");
  session.recordAppliedProject(applied); session.rebaseProject(store.getCurrent());
  expect(await session.proveAppliedRevision()).toMatchObject({ status: "succeeded", verified: true });
  expect(turn.runOutcome?.delivery).toBe("persisted-verified");
  expect(store.getCurrent().system.titleScreen?.title).toBe("OWNED_TITLE");
});

it("human edits across a held commit await survive while a second old-base application is refused", async () => {
  const session = sessionForTitle();
  await session.sendUserMessage("Set title");
  const proposed = session.getProposedProject();
  const base = session.getProposalBase();
  const entered = deferred<void>(); const release = deferred<void>();
  const original = commits.recordProjectCommit;
  vi.spyOn(commits, "recordProjectCommit").mockImplementation(async input => {
    entered.resolve(); await release.promise;
    return original(input);
  });
  const applying = applyProposedProject(proposed, { base, baseline: session.getDraftBaseline(), source: "agent", summary: "Title", toolNames: ["set_title_screen"] });
  try {
    await bounded(entered.promise);
    humanEdits();
    const second = await applyProposedProject(proposed, { base, baseline: session.getDraftBaseline(), source: "agent", summary: "Replay", toolNames: ["set_title_screen"] });
    expect(second).toMatchObject({ ok: false, reason: "stale-base" });
    release.resolve();
    const first = await bounded(applying);
    expect(first.ok).toBe(true); // The first mutation really preceded both human edits.
    expect(liveValues()).toEqual({ tile: 7, width: 336, itemId: "item_potion", price: 137 });
    expect(commits.recordProjectCommit).toHaveBeenCalledTimes(1);
    expect(history.getMapEditHistoryEntries()).toHaveLength(1);
  } finally { release.resolve(); await bounded(applying); }
});

it("retired apply authority refuses the old proposal while a fresh replacement applies", async () => {
  const session = sessionForTitle();
  await session.sendUserMessage("A");
  const proposed = session.getProposedProject(); const base = session.getProposalBase();
  const operation = new RunOperation(); operation.retire(); humanEdits();
  expect(await applyProposedProject(proposed, { base, baseline: session.getDraftBaseline(), operation, source: "agent", summary: "A", toolNames: ["set_title_screen"] }))
    .toMatchObject({ ok: false, reason: "retired-run" });
  const replacement = sessionForTitle("B_CURRENT");
  await replacement.sendUserMessage("B");
  const applied = await applyProposedProject(replacement.getProposedProject(), {
    base: replacement.getProposalBase(), baseline: replacement.getDraftBaseline(), operation: replacement.getRunOperation(), source: "agent", summary: "B", toolNames: ["set_title_screen"],
  });
  expect(applied.ok).toBe(true);
  expect(liveValues()).toEqual({ tile: 7, width: 336, itemId: "item_potion", price: 137 });
  expect(store.getCurrent().system.titleScreen?.title).toBe("B_CURRENT");
});

it("the real runner rejects late authoring, retains it through Ask, then recalculates against both human edits", async () => {
  const restoreDom = installFakeDom();
  vi.spyOn(activity, "recordAiActivity").mockImplementation(async entry => activity.buildAiActivityLogRecord(entry));
  const entered = deferred<void>(); const release = deferred<ChatResult>();
  let round = 0; let mode = "initial";
  let freshContext: ReturnType<typeof liveValues> | undefined;
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }), yieldToUi: cooperativeNodeYield,
    chat: reviewingChat(async () => {
      if (mode === "ask") return final;
      if (mode === "fresh") {
        mode = "done";
        const project = session.getProposedProject();
        const map = project.maps[project.startMapId];
        const item = project.database.items.find(item => item.id === "item_potion");
        if (!map || !item) throw new Error("Recalculation lost the map/item");
        freshContext = { tile: map.lowerTiles[1], width: project.system.playResolution?.width ?? 320, itemId: item.id, price: item.price };
        return title("FRESH_TITLE");
      }
      if (mode === "done") return final;
      if (round++ === 0) return title("STALE_TITLE");
      entered.resolve(); return release.promise;
    }) });
  const f = epochRunner(session);
  const initial = f.send("Set title");
  try {
    await bounded(entered.promise); humanEdits(); release.resolve(final);
    const rejected = await bounded(initial);
    expect(rejected.runOutcome).toEqual({ execution: "failed", goal: "unassessed", delivery: "draft" });
    expect(liveValues()).toEqual({ tile: 7, width: 336, itemId: "item_potion", price: 137 });
    expect(history.getMapEditHistoryEntries()).toHaveLength(0);
    const oldBase = session.getProposalBase();
    mode = "ask";
    const query = await bounded(f.send("What happened?", { composerMode: "ask" }));
    expect(query.proposedCalls).toEqual([]);
    expect(session.getProposalBase()).toBe(oldBase);
    expect(session.getProposedProject().system.titleScreen?.title).toBe("STALE_TITLE");
    const before = serialize(store.getCurrent());
    mode = "fresh";
    const fresh = await bounded(f.send("Recalculate the title", { goalAction: "resume" }));
    expect(freshContext).toEqual({ tile: 7, width: 336, itemId: "item_potion", price: 137 });
    expect(fresh.appliedCalls?.map(call => call.args.title)).toEqual(["FRESH_TITLE"]);
    expect(fresh.proposedCalls).toEqual([]);
    expect(store.getCurrent().system.titleScreen?.title).toBe("FRESH_TITLE");
    expect(liveValues()).toEqual({ tile: 7, width: 336, itemId: "item_potion", price: 137 });
    expect(history.getMapEditHistoryEntries()).toHaveLength(1);
    await bounded(f.send("Continue", { goalAction: "resume" }));
    expect(history.getMapEditHistoryEntries()).toHaveLength(1);
    expect(history.undoMapEdit()).toBe(true);
    expect(serialize(store.getCurrent())).toBe(before);
  } finally { release.resolve(final); await bounded(initial); restoreDom(); }
});

it("the real autonomous milestone rejects non-house/database edits and never reports them applied", async () => {
  const events: SessionEvent[] = [];
  let round = 0;
  const session = new AssistantSession(store.getCurrent(), { config, declareIntent: fixedDeclarer({ mode: "other" }), yieldToUi: cooperativeNodeYield,
    chat: reviewingChat(async () => {
      if (round++ === 0) return { message: { role: "assistant", content: null, tool_calls: [{ id: "plan", type: "function", function: {
        name: "set_work_plan", arguments: JSON.stringify({ goal: "Title", layers: [{ title: "Title", items: [{ title: "Title", instruction: "Title", successTools: ["set_title_screen"] }] }] }),
      } }] }, finishReason: "tool_calls" };
      return round === 2 ? title("STALE_MILESTONE") : final;
    }) });
  const result = await session.sendUserMessage("Set title", event => {
    events.push(event);
    if (event.type === "tool_call" && event.name === "set_title_screen" && event.result.ok) humanEdits();
  }, undefined, { autonomous: true });
  expect(events.filter(event => event.type === "proposal_paused")).toHaveLength(1);
  expect(events.filter(event => event.type === "milestone_applied")).toHaveLength(0);
  expect(result.appliedCalls).toEqual([]);
  expect(liveValues()).toEqual({ tile: 7, width: 336, itemId: "item_potion", price: 137 });
  expect(history.getMapEditHistoryEntries()).toHaveLength(0);
});
