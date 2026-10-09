import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { extractOriginalContext, OriginalContextStore, ORIGINAL_MODEL_WINDOWS, originalContextWindow, type OriginalContext } from "@/ai/originalContext";
import { buildGroundedRequest } from "@/ai/contextBuilder";
import { compactMessagesForRequest, totalMessagesCharLength } from "@/ai/messageBudget";
import { ToolReadEvidence } from "@/ai/toolReadEvidence";
import { TASK_RECIPES } from "@/ai/toolCapabilityIndex";
import { createEmptyToolProject, getTool, runTool, toOpenAiTools } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { startSession } from "@/project/session";
import type { ChatMessage } from "@/ai/llmClient";
import { declaredIntent } from "./intentFixture";

const options = { snapshotId: "original-test" };
const parsed = (message: ChatMessage) => JSON.parse(message.content as string).originalContext;

describe("original authored-state extraction", () => {
  it("follows actual selected-map record references transitively without pulling unrelated maps or runtime state", () => {
    const project = createBlankProject();
    const start = project.maps[project.startMapId]!;
    const target = structuredClone(start);
    target.id = "target/map";
    target.events = [{ id: "target_event", x: 1, y: 1, trigger: { kind: "action" }, commands: [
      { kind: "changeItem", itemId: "item_grounded", op: "+=", amount: 2 },
      { kind: "callCommonEvent", commonEventId: "common_link" },
    ] }];
    project.commonEvents.push({ id: "common_link", name: "Linked", trigger: "none", commands: [
      { kind: "callCommonEvent", commonEventId: "common_cycle" },
    ] }, { id: "common_cycle", name: "Cycle", trigger: "none", commands: [
      { kind: "callCommonEvent", commonEventId: "common_link" },
      { kind: "changeItem", itemId: "item_transitive", op: "+=", amount: 1 },
    ] });
    project.maps[target.id] = target;
    const item = { ...project.database.items[0]!, id: "item_grounded", name: "Original item", price: 47 };
    const isolated = { ...item, id: "item_unrelated", name: "Unrelated" };
    project.database.items.push(item, isolated, { ...item, id: "item_transitive" });
    const runtime = startSession(project, 5);
    runtime.inventory.RUNTIME_SECRET_SENTINEL = 913579;
    Object.assign(project, { credentials: "ROOT_SECRET_SENTINEL" });
    const selection = { mapId: target.id, x: 0, y: 0, width: 3, height: 3 };
    const context = extractOriginalContext(project, { ...options, currentMapId: start.id, selection,
      intent: declaredIntent({ targetMapId: target.id, useSelection: true, tools: ["get_event"] }) });
    expect(context.target).toEqual({ mapId: target.id, selection });
    expect(context.entries.find(entry => entry.id === "/maps/target~1map/tiles")?.value).toMatchObject({ lowerTiles: target.lowerTiles, upperTiles: target.upperTiles });
    expect(context.entries.find(entry => entry.id === "/database/items/item_grounded")?.value).toMatchObject({ records: [item] });
    expect(context.entries.find(entry => entry.id === "/database/items/item_unrelated")).toBeUndefined();
    expect(context.entries.find(entry => entry.id === "/database/items/item_transitive")?.value).toMatchObject({ records: [{ id: "item_transitive" }] });
    expect(context.entries.filter(entry => entry.id === "/database/commonEvents/common_link")).toHaveLength(1);
    expect(context.entries.some(entry => entry.id.startsWith(`/maps/${start.id}/`))).toBe(false);
    expect(JSON.stringify(context)).not.toContain("SECRET_SENTINEL");
    target.events[0]!.commands = [];
    expect(context.entries.find(entry => entry.id.endsWith("/events/target_event"))?.value).toMatchObject({ event: { commands: [{ kind: "changeItem", itemId: item.id, op: "+=", amount: 2 }, { kind: "callCommonEvent", commonEventId: "common_link" }] } });
  });

  it("uses structured quest/world/life intent to include complete definitions and preserves unsupported collection omissions", () => {
    const project = createBlankProject();
    project.world = { entities: [{ id: "lore", type: "place", name: "Place", summary: "Summary", body: "Authored world body ".repeat(100), origin: "user" }], relations: [] };
    project.quests = [{ key: "quest_original", title: "Quest", summary: "Original quest", giver: { mapId: project.startMapId, eventId: "giver" },
      steps: [{ kind: "collect", itemId: "item_potion", count: 3, sources: [] }], rewards: { gold: 47 } }];
    project.system.craftRecipes = [{ id: "craft_original", ingredients: [{ itemId: "item_potion", count: 2 }], outputItemId: "item_potion", outputCount: 1 }];
    const context = extractOriginalContext(project, { ...options, intent: declaredIntent({ tools: ["define_quest", "configure_life_economy"],
      readBeforeWrite: { project: true, collections: ["not_a_collection"], references: true } }) });
    expect(context.entries.find(entry => entry.id === "/world")?.value).toEqual(project.world);
    expect(context.entries.find(entry => entry.id === "/quests")?.value).toEqual(project.quests);
    expect(context.entries.find(entry => entry.id === "/system")?.value).toEqual(project.system);
    expect(context.missing).toContainEqual({ kind: "collection", id: "not_a_collection" });
  });

  it("represents an empty requested collection as an actual successful empty read", () => {
    const project = createEmptyToolProject();
    const context = extractOriginalContext(project, { ...options, intent: declaredIntent({ readBeforeWrite: { project: false, collections: ["items"], references: true } }) });
    const entry = context.entries.find(entry => entry.id === "/database/items")!;
    expect(entry.value).toMatchObject({ records: [], total: 0, nextOffset: null });
    expect(entry.reads[0]?.result.ok).toBe(true);
  });
});

describe("authored start-state originals", () => {
  function fixture() {
    const project = createBlankProject();
    const start = project.maps[project.startMapId];
    const item = project.database.items[0];
    const actor = project.database.actors[0];
    const actorClass = project.database.classes[0];
    if (!start || !item || !actor || !actorClass) throw new Error("Blank project fixture is incomplete");
    project.database.items.push({ ...item, id: "item_seed_only", price: 83471 },
      { ...item, id: "item_preset_only", price: 83472 }, { ...item, id: "item_map_only", price: 83473 });
    project.database.classes.push({ ...actorClass, id: "class_seed_only" });
    project.database.actors.push({ ...actor, id: "actor_seed_only", classId: "class_seed_only" });
    project.switches.push({ id: "sw_seed_only", name: "Seed switch" });
    project.variables.push({ id: "var_preset_only", name: "Preset variable" });
    project.maps["preset/start"] = { ...structuredClone(start), id: "preset/start", events: [
      { id: "preset_event", x: 1, y: 1, trigger: { kind: "action" }, commands: [
        { kind: "callCommonEvent", commonEventId: "common_seed_only" },
      ] },
    ] };
    project.commonEvents.push({ id: "common_seed_only", name: "Seed link", trigger: "none", commands: [
      { kind: "transfer", mapId: "map_transitive", x: 1, y: 1 },
    ] });
    project.maps.map_transitive = { ...structuredClone(start), id: "map_transitive", events: [
      { id: "transitive_event", x: 1, y: 1, trigger: { kind: "action" }, commands: [
        { kind: "changeItem", itemId: "item_map_only", op: "+=", amount: 1 },
        { kind: "transfer", mapId: "preset/start", x: 1, y: 1 },
      ] },
    ] };
    project.maps.map_seed_farm = { ...structuredClone(start), id: "map_seed_farm" };
    project.maps.map_unrelated = { ...structuredClone(start), id: "map_unrelated" };
    project.mapTree.children.push({ mapId: "map_unrelated", children: [] });
    project.session.gold = 472319;
    project.session.inventory = { item_seed_only: 17 };
    project.session.partyActorIds = ["actor_seed_only"];
    project.session.switches = { sw_seed_only: true };
    project.session.homeDecorationPlacements = [{ instanceId: "seed_home", typeId: "home_type",
      mapId: "map_seed_farm", x: 2, y: 3, orientation: "down" }];
    project.testPresets = [{ id: "preset_r5_unique", name: "Preset R5", gold: 583421,
      inventory: { item_preset_only: 23 }, variables: { var_preset_only: 71 },
      startMapId: "preset/start", startPos: { x: 2, y: 3 } }];
    return project;
  }

  it("includes complete authored seed and presets rather than reporting zero omissions for absent state", () => {
    const project = fixture();
    const expectedSeed = structuredClone(project.session);
    const expectedPresets = structuredClone(project.testPresets);
    const runtime = startSession(project, 5);
    runtime.gold = 913579;
    runtime.inventory.RUNTIME_SECRET_SENTINEL = 1;
    runtime.partyActorIds = ["RUNTIME_ACTOR_SENTINEL"];
    Object.assign(project, { credentials: "ROOT_SECRET_SENTINEL" });
    const context = extractOriginalContext(project, { ...options,
      intent: declaredIntent({ tools: ["set_session_start", "upsert_test_preset"] }) });
    project.session.gold = 1;
    project.testPresets = [];
    const envelope = parsed(new OriginalContextStore(context).message(1_000_000).message);
    expect(envelope.entries).toContainEqual({ entryId: "/session", value: expectedSeed });
    expect(envelope.entries).toContainEqual({ entryId: "/testPresets", value: expectedPresets });
    expect(envelope.omitted.count).toBe(0);
    expect(envelope.missing).toEqual([]);
    expect(JSON.stringify(envelope)).not.toContain("SENTINEL");
    expect(JSON.stringify(envelope)).not.toContain('"gold":913579');
  });

  it("follows seed and preset keys, actor classes and map/common-event cycles without selecting the map index", () => {
    const project = fixture();
    const context = extractOriginalContext(project, { ...options,
      intent: declaredIntent({ tools: ["get_event"] }) });
    const ids = context.entries.map(entry => entry.id);
    for (const id of ["/database/items/item_seed_only", "/database/items/item_preset_only", "/database/items/item_map_only",
      "/database/actors/actor_seed_only", "/database/classes/class_seed_only", "/database/switches/sw_seed_only",
      "/database/variables/var_preset_only", "/database/commonEvents/common_seed_only",
      "/maps/preset~1start/events/preset_event", "/maps/map_transitive/events/transitive_event", "/maps/map_seed_farm/tiles"]) {
      expect(ids.filter(entryId => entryId === id), id).toHaveLength(1);
    }
    expect(ids.some(id => id.startsWith("/maps/map_unrelated"))).toBe(false);
    expect(context.entries.find(entry => entry.id === "/maps/map_transitive/tiles")?.value)
      .toMatchObject({ lowerTiles: project.maps.map_transitive?.lowerTiles, upperTiles: project.maps.map_transitive?.upperTiles });
  });

  it("lists and reconstructs oversized authored seed and presets through exact original pages", () => {
    const project = fixture();
    project.session.inventory = { ...project.session.inventory,
      ...Object.fromEntries(Array.from({ length: 8000 }, (_, i) => [`item_large_${i}`, i + 1])) };
    for (const preset of project.testPresets ?? []) preset.name = "preset_r5_payload_".repeat(4000);
    const store = new OriginalContextStore(extractOriginalContext(project, options));
    const narrow = store.message(500);
    const ids = store.context.entries.map(entry => entry.id);
    expect(parsed(narrow.message).omitted.count).toBe(ids.length - narrow.includedIds.length);
    for (const [entryId, expected] of [["/session", project.session], ["/testPresets", project.testPresets]] as const) {
      expect(narrow.includedIds).not.toContain(entryId);
      expect(ids).toContain(entryId);
      expect(store.read({ ...options, action: "list", offset: ids.indexOf(entryId), limit: 1 }).data)
        .toMatchObject({ entries: [{ entryId }] });
      let offset: number | null = 0;
      let text = "";
      while (offset !== null) {
        const result = store.read({ ...options, action: "read", entryId, offset, limit: 24000 });
        expect(result.ok).toBe(true);
        const data = result.data as { text: string; nextOffset: number | null };
        text += data.text;
        offset = data.nextOffset;
      }
      expect(JSON.parse(text)).toEqual(expected);
    }
  });
});

describe("original paging, delivery and window accounting", () => {
  function fixture() {
    const project = createBlankProject();
    const item = project.database.items.find(item => item.id === "item_potion")!;
    const args = { collection: "items", ids: [item.id], include: "full" };
    const result = runTool({ project }, "get_database_records", args);
    const context: OriginalContext = { snapshotId: options.snapshotId, target: { mapId: project.startMapId, selection: null }, missing: [], entries: [
      { id: "/item", value: result.data, reads: [{ name: "get_database_records", args, result }] },
      { id: "/large", value: { commands: Array.from({ length: 8000 }, (_, i) => ({ kind: "text", body: `Original dialogue ${i}` })) }, reads: [] },
    ] };
    return { project, item, args, store: new OriginalContextStore(context) };
  }

  it("retains all entries under a large window and exposes every omitted original through deterministic pages", () => {
    const { store } = fixture();
    const narrow = store.message(500);
    expect(parsed(narrow.message).omitted.count).toBeGreaterThan(0);
    expect(parsed(narrow.message).omitted.read.args).toMatchObject({ snapshotId: options.snapshotId, action: "list", offset: 0 });
    const broad = store.message(200000);
    expect(parsed(broad.message).omitted.count).toBe(0);
    expect(parsed(broad.message).entries).toContainEqual({ entryId: "/large", value: store.context.entries[1]!.value });
    const index = store.read({ snapshotId: options.snapshotId, action: "list", limit: 1 });
    expect(index.data).toMatchObject({ entries: [{ entryId: "/item" }], total: 2, nextOffset: 1 });
    let offset: number | null = 0;
    let text = "";
    while (offset !== null) {
      const result = store.read({ snapshotId: options.snapshotId, action: "read", entryId: "/large", offset, limit: 24000 });
      expect(result.ok).toBe(true);
      const data = result.data as { text: string; nextOffset: number | null };
      text += data.text;
      offset = data.nextOffset;
    }
    expect(JSON.parse(text)).toEqual(store.context.entries[1]!.value);
  });

  it("does not credit missing/partial pages, validates reference IDs and never overwrites a fresher native read", () => {
    const { store, project, args } = fixture();
    const evidence = new ToolReadEvidence();
    evidence.begin({ project: false, collections: ["items"], references: true });
    const write = { item: { id: "item_potion", price: 321 } };
    const deliver = (offset: number, limit: number) => {
      const result = store.read({ snapshotId: options.snapshotId, action: "read", entryId: "/item", offset, limit });
      const message: ChatMessage = { role: "tool", name: "get_original_context", content: JSON.stringify(result) };
      store.observeDelivered([message], [], evidence);
    };
    store.observeDelivered([], [], evidence);
    expect(evidence.beforeWrite(project, "upsert_item", write)).not.toBeNull();
    deliver(1, 24000); // Missing the first code unit is not a full original.
    expect(evidence.beforeWrite(project, "upsert_item", write)).not.toBeNull();
    deliver(0, 1);
    expect(evidence.beforeWrite(project, "upsert_item", write)).toBeNull();
    expect(evidence.beforeWrite(project, "upsert_troop", { troop: { enemyIds: ["fabricated_enemy"] } })).not.toBeNull();
    project.database.items.find(item => item.id === "item_potion")!.price = 555;
    expect(evidence.beforeWrite(project, "upsert_item", write)).not.toBeNull();
    evidence.observe("get_database_records", args, runTool({ project }, "get_database_records", args));
    store.observeDelivered([], ["/item"], evidence);
    expect(evidence.beforeWrite(project, "upsert_item", write)).toBeNull();
  });

  it.each(["truncated-json", "null", "redacted-text", "invalid-total", "invalid-offset", "invalid-next", "nonboolean-ok"])("rejects rewritten delivered receipts without throwing or granting evidence: %s", variant => {
    const { store, project } = fixture();
    const evidence = new ToolReadEvidence();
    evidence.begin({ project: false, collections: ["items"], references: true });
    const receipt = store.read({ snapshotId: options.snapshotId, action: "read", entryId: "/item" });
    const changed = JSON.parse(JSON.stringify(receipt));
    if (variant === "redacted-text") changed.data.text = "[redacted]";
    if (variant === "invalid-total") changed.data.totalChars++;
    if (variant === "invalid-offset") changed.data.offset = -1;
    if (variant === "invalid-next") changed.data.nextOffset = 1;
    if (variant === "nonboolean-ok") changed.ok = "true";
    const content = variant === "truncated-json" ? JSON.stringify(receipt).slice(0, 60)
      : variant === "null" ? "null" : JSON.stringify(changed);
    const message: ChatMessage = { role: "tool", name: "get_original_context", content };
    expect(() => store.observeDelivered([message], [], evidence)).not.toThrow();
    expect(evidence.beforeWrite(project, "upsert_item", { item: { id: "item_potion", price: 321 } })).not.toBeNull();
    // Refusal does not poison the snapshot: an intact later delivery still establishes evidence.
    store.observeDelivered([{ ...message, content: JSON.stringify(receipt) }], [], evidence);
    expect(evidence.beforeWrite(project, "upsert_item", { item: { id: "item_potion", price: 321 } })).toBeNull();
  });

  it("does not credit an original tool result whose data was removed by real request compaction", () => {
    const { store, project } = fixture();
    const evidence = new ToolReadEvidence();
    evidence.begin({ project: false, collections: ["items"], references: true });
    const receipt = store.read({ snapshotId: options.snapshotId, action: "read", entryId: "/item" });
    const messages: ChatMessage[] = [
      { role: "system", content: "System" },
      { role: "assistant", content: null, tool_calls: [{ id: "original-read", type: "function", function: { name: "get_original_context", arguments: "{}" } }] },
      { role: "tool", name: "get_original_context", tool_call_id: "original-read", content: JSON.stringify(receipt) },
      ...Array.from({ length: 7 }, () => ({ role: "user" as const, content: "Retained request" })),
    ];
    const compacted = compactMessagesForRequest(messages, totalMessagesCharLength(messages) - 100);
    const tool = compacted.find(message => message.role === "tool")!;
    expect(tool).toBeDefined();
    expect(JSON.parse(tool.content as string).data).toBeUndefined();
    expect(() => store.observeDelivered(compacted, [], evidence)).not.toThrow();
    expect(evidence.beforeWrite(project, "upsert_item", { item: { id: "item_potion", price: 321 } })).not.toBeNull();
  });

  it.each([
    { snapshotId: "old", action: "list" }, { action: "read", entryId: "/absent" },
    { action: "read", entryId: "/item", offset: -1 }, { action: "read", entryId: "/item", limit: 24001 },
    { action: "list", limit: 51 }, { action: "list", unsupported: true }, { action: "write" },
  ])("rejects invalid original reads without claiming evidence: %j", args => {
    expect(fixture().store.read({ snapshotId: options.snapshotId, ...args }).ok).toBe(false);
  });

  it.each(["unknown-test-model", "gemini-3.7-flash", "gpt-5"]) ("accounts for full native tools, original values and output reserve on %s", model => {
    const { store } = fixture();
    const tools = toOpenAiTools();
    const result = buildGroundedRequest([{ role: "system", content: "System" }, { role: "user", content: "Request" }], tools, { model, baseUrl: "x" }, store);
    expect(result.budget.toolsTokens).toBeGreaterThan(50000);
    expect(result.budget.inputTokens + result.budget.reserveTokens).toBeLessThanOrEqual(result.budget.windowTokens);
    expect(parsed(result.messages.at(-1)!).entries).toContainEqual({ entryId: "/item", value: store.context.entries[0]!.value });
    expect(tools).toEqual(toOpenAiTools());
  });

  it("keeps the paging manifest and latest full read when history includes large tool arguments", () => {
    const { store } = fixture();
    const tools = toOpenAiTools();
    const messages: ChatMessage[] = [{ role: "system", content: "system" }, { role: "user", content: "request" }];
    for (let index = 0; index < 12; index++) {
      const id = `paging_${index}`;
      messages.push({ role: "assistant", content: null, tool_calls: [{ id, type: "function", function: {
        name: "get_original_context", arguments: JSON.stringify({ entryId: "x".repeat(2000) }),
      } }] }, { role: "tool", name: "get_original_context", tool_call_id: id,
        content: JSON.stringify({ ok: true, data: { text: "x".repeat(24000) } }) });
    }
    const before = structuredClone(messages);
    const result = buildGroundedRequest(messages, tools, { model: "unknown-window-fixture", baseUrl: "x" }, store);
    expect(result.budget.inputTokens + result.budget.reserveTokens).toBeLessThanOrEqual(result.budget.windowTokens);
    expect(parsed(result.messages.at(-1)!).omitted.read.args.snapshotId).toBe(store.context.snapshotId);
    expect(result.messages.find(message => message.tool_call_id === "paging_11")).toEqual(messages.at(-1));
    expect(messages).toEqual(before);
    expect(tools).toEqual(toOpenAiTools());
  });

  it("fails explicitly when mandatory input alone exhausts the model window", () => {
    const { store } = fixture();
    expect(() => buildGroundedRequest([{ role: "user", content: "irreducible instruction ".repeat(40000) }], toOpenAiTools(), { model: "unknown", baseUrl: "x" }, store)).toThrow("original-context-window-exceeded");
  });
});

describe("task recipe contracts", () => {
  it("uses active actual tools and read-only verification in every read-write-verify sequence", () => {
    expect(TASK_RECIPES.map(recipe => recipe.id)).toEqual(["npc-event", "map", "interior", "database-battle", "quest-world", "life"]);
    for (const recipe of TASK_RECIPES) {
      for (const name of [...recipe.read, ...recipe.verify]) {
        expect(getTool(name)?.mode, name).toBe("read");
        expect(getTool(name)?.deprecated, name).not.toBe(true);
      }
      for (const name of recipe.write) {
        expect(getTool(name)?.mode, name).toBe("write");
        expect(getTool(name)?.deprecated, name).not.toBe(true);
      }
    }
  });
});


describe("installed model window contract", () => {
  it("matches every supported bundled provider model without importing the 9 MB catalog into the app", () => {
    const catalog = JSON.parse(readFileSync("node_modules/@oh-my-pi/pi-catalog/src/models.json", "utf8")) as Record<string, Record<string, { contextWindow: number }>>;
    // 번들 밖 로컬 확장(scripts/lib/ohMyPiModel.ts) — 번들에 없는 것이 정상이다.
    const localExtensions: Record<string, readonly string[]> = {
      "google-antigravity": ["gemini-3.8-flash"],
      "openai-codex": ["gpt-6-astra", "gpt-6-sol", "gpt-6-luna"],
    };
    for (const [provider, windows] of Object.entries(ORIGINAL_MODEL_WINDOWS)) {
      const local = new Set(localExtensions[provider] ?? []);
      const bundledOnly = Object.fromEntries(Object.entries(windows).filter(([id]) => !local.has(id)));
      expect(bundledOnly).toEqual(Object.fromEntries(Object.entries(catalog[provider]!).map(([id, model]) => [id, model.contextWindow])));
    }
    expect(originalContextWindow({ model: "gpt-6-astra", providerId: "openai-codex" })).toBe(272000);
    expect(originalContextWindow({ model: "gpt-5.3-codex-spark", providerId: "openai-codex" })).toBe(128000);
    expect(originalContextWindow({ model: "gpt-5.6-sol", providerId: "openai-codex" })).toBe(1000000);
    expect(originalContextWindow({ model: "unknown", providerId: "openai-codex", authMode: "chatgpt" })).toBe(1000000);
  });
});
