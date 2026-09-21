import { describe, expect, it } from "vitest";
import { adventureCompletionProblems, adventureToolNames } from "@/ai/adventureCompletion";
import { createBlankProject } from "@/project/defaults";
import { roleCapabilities } from "@/project/tileRoles";
import { runTool } from "@/editor/tools";
import { serialize, deserialize } from "@/project/io";

const required = { village: true, dungeon: true, party: true, battle: true };
function connectedAdventure() {
  const p = createBlankProject();
  const start = p.maps[p.startMapId];
  const tileset = p.tilesets[start.tilesetId];
  const structure = tileset.tileGroups?.find(g => roleCapabilities(tileset, g.role).structure && g.tileIds.length);
  expect(structure).toBeDefined();
  start.lowerTiles[0] = structure!.tileIds[0];
  const dungeon = structuredClone(start); dungeon.id = "test_dungeon"; dungeon.events = [];
  p.maps[dungeon.id] = dungeon;
  const event = { id: "entrance", x: p.startPos.x, y: p.startPos.y - 1, trigger: { kind: "action" as const }, commands: [], pages: [{ id: "entrance_page", name: "入口", conditions: [], trigger: { kind: "action" as const }, priority: "same" as const, graphic: {}, movement: { type: "fixed" as const, speed: 3, frequency: 3 }, commands: [{ kind: "transfer" as const, mapId: dungeon.id, x: p.startPos.x, y: p.startPos.y }] }] };
  start.events.push(event);
  const back = structuredClone(event); back.id = "return"; back.pages[0].commands[0].mapId = start.id;
  dungeon.events.push(back);
  dungeon.events.push({ ...structuredClone(event), id: "treasure", x: p.startPos.x + 2, commands: [{ kind: "changeGold", op: "+=", amount: 10 }], pages: [] });
  dungeon.encounterRate = 10; dungeon.troopIds = [p.database.troops[0].id];
  p.system.startActorIds = p.database.actors.slice(0, 2).map(a => a.id);
  p.session.partyActorIds = [...p.system.startActorIds];
  return p;
}

describe("declared adventure completion", () => {
  it("exposes every promised tool as a real registered schema before authoring", async () => {
    const { getTool } = await import("@/editor/tools");
    expect(adventureToolNames(undefined)).toEqual([]);
    for (const name of adventureToolNames(required)) expect(getTool(name), name).toBeDefined();
    let names: string[] = [];
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 1 },
      declareIntent: fixedDeclarer({ mode: "modify", adventure: required }),
      chat: async (_config, request) => { names = request.tools?.map(t => t.function.name) ?? [];return { message: { role: "assistant", content: "확인 중" }, finishReason: "stop" }; },
    });
    await session.sendUserMessage("모험 시작 구성을 만들어줘");
    expect(names).toEqual(expect.arrayContaining(adventureToolNames(required)));
  });
  it("does not impose a genre contract on an unrelated edit", () => {
    expect(adventureCompletionProblems(createBlankProject(), undefined)).toEqual([]);
  });
  it("accepts a shared character appearance as a complete start-party look", () => {
    const p = createBlankProject();
    const actor = p.database.actors[0]!;
    actor.faceResourceId = undefined;
    actor.characterResourceId = undefined;
    actor.appearanceId = "appearance_hero";
    p.database.characterAppearances = [{
      id: "appearance_hero",
      name: "주인공 외형",
      description: "",
      charset: { resourceId: "charset_hero", characterIndex: 2 },
      face: { resourceId: "face_hero" },
    }];
    p.session.partyActorIds = [actor.id];
    expect(adventureCompletionProblems(p, { appearance: true })).toEqual([]);
  });
  it("rejects grass with an NPC, standalone DB troops, and a solo party", () => {
    const p = createBlankProject();
    expect(adventureCompletionProblems(p, required)).toHaveLength(4);
  });
  it("accepts real structure, reachable transfer, connected encounters and a party", () => {
    expect(adventureCompletionProblems(connectedAdventure(), required)).toEqual([]);
  });
  it("uses the runtime start state instead of decorative system party metadata", () => {
    const p = connectedAdventure(); p.session.partyActorIds = p.session.partyActorIds.slice(0, 1);
    expect(adventureCompletionProblems(p, required)).toContainEqual(expect.stringContaining("전투 파티가 1명"));
  });
  it("persists project-settings party changes into the actual new-game session", async () => {
    const ctx = { project: createBlankProject() };
    const ids = ctx.project.database.actors.slice(0, 3).map(a => a.id);
    expect(runTool(ctx, "set_project_settings", { startActorIds: ids }).ok).toBe(true);
    const { startSession } = await import("@/project/session");
    const loaded = deserialize(serialize(ctx.project));
    expect(startSession(loaded).partyActorIds).toEqual(ids);
    expect(loaded.system.startActorIds).toEqual(ids);
  });
  it("rejects a secondary map without an exploration objective or return route", () => {
    const p = connectedAdventure(); p.maps.test_dungeon.events = [];
    expect(adventureCompletionProblems(p, required)).toContainEqual(expect.stringContaining("복귀 경로"));
  });
  it("rejects a treasure buried in an impassable structure", () => {
    const p = connectedAdventure(), map = p.maps.test_dungeon;
    const chest = map.events.find(e => e.id === "treasure")!;
    const tileset = p.tilesets[map.tilesetId];
    const solid = tileset.passability.findIndex(p => p && !Object.values(p).some(Boolean));
    expect(solid).toBeGreaterThanOrEqual(0);
    map.lowerTiles[chest.y * map.width + chest.x] = solid;
    chest.pages = [{ ...structuredClone(map.events[0].pages![0]), graphic: { sprite: { type: "bundled", id: "test-chest" } }, commands: chest.commands }];
    expect(adventureCompletionProblems(p, required)).toContainEqual(expect.stringContaining("treasure가 막힌"));
  });
  it("cannot use an obsolete root transfer when the active pages contain only dialogue", () => {
    const p = connectedAdventure(); const e = p.maps[p.startMapId].events[0];
    e.commands = e.pages![0].commands; e.pages![0].commands = [{ kind: "text", body: "입구입니다" }];
    expect(adventureCompletionProblems(p, required)).toEqual(expect.arrayContaining([expect.stringContaining("전이가 없습니다"), expect.stringContaining("전투가 없습니다")]));
  });
  it("cannot count a zero-weight or disabled encounter as playable", () => {
    const p = connectedAdventure();p.maps.test_dungeon.encounterRate = 0;
    expect(adventureCompletionProblems(p, required)).toEqual([expect.stringContaining("전투가 없습니다")]);
  });
});

describe("AI authoring retry boundaries", () => {
  it("reuses named NPCs even when state page names differ, preserving ID across save/load", () => {
    let project = createBlankProject();const mapId = project.startMapId;
    const args = { mapId, x: 8, y: 8, name: "안내원 에린", pages: [{ name: "첫 대화", lines: ["안녕하세요"] }] };
    const ctx = { project };const first = runTool(ctx, "place_npc", args);expect(first.ok).toBe(true);project = ctx.project;
    project = deserialize(serialize(project));
    const secondCtx = { project };const second = runTool(secondCtx, "place_npc", { ...args, pages: [{ name: "수정 대화", lines: ["어서 오세요"] }] });
    expect(second.ok).toBe(true);expect(secondCtx.project.maps[mapId].events).toHaveLength(1);
    expect(secondCtx.project.maps[mapId].events[0].id).toBe(project.maps[mapId].events[0].id);
  });
  it("rejects a new legacy weapon item instead of pretending it is equippable", () => {
    const result = runTool({ project: createBlankProject() }, "upsert_item", { item: { id: "test_weapon", name: "검", type: "weapon" } });
    expect(result.ok).toBe(false);expect(result.summary).toContain("upsert_equipment");
  });
});

import { validateLowLevelCommandArray } from "@/editor/tools/commandArgs";
import { AssistantSession } from "@/ai/assistantSession";
import { defaultAiConfig } from "@/ai/llmClient";
import { fixedDeclarer } from "./intentFixture";

describe("completion and dialogue evidence", () => {
  it("cannot claim completion after creating equipment without its icon", async () => {
    let call = 0;
    const steps = [
      { name: "get_database_records", args: { collection: "equipment", limit: 1 } },
      { name: "upsert_equipment", args: { equipment: { id: "test_iconless_sword", name: "아이콘 없는 검", slot: "weapon" } } },
    ];
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 10 },
      declareIntent: fixedDeclarer({ mode: "modify", adventure: required }),
      chat: async () => {
        const step = steps[call++];
        return step ? { message: { role: "assistant", content: null, tool_calls: [{ id: `call_${call}`, type: "function", function: { name: step.name, arguments: JSON.stringify(step.args) } }] }, finishReason: "tool_calls" }
          : { message: { role: "assistant", content: "모두 완료" }, finishReason: "stop" };
      },
    });
    const result = await session.sendUserMessage("모험 장비를 구성해줘");
    expect(result.assistantText).toContain("equipment test_iconless_sword에 그림이 없습니다");
    expect(result.assistantText).not.toContain("모두 완료");
  });
  it("normalizes NPC command lines into the runtime dialogue body and rejects missing low-level bodies", () => {
    const ctx = { project: createBlankProject() };
    const result = runTool(ctx, "place_npc", { mapId: ctx.project.startMapId, x: 8, y: 8, name: "안내인", pages: [{ commands: [{ kind: "text", lines: ["던전 입구", "함께 가자"] }] }] });
    expect(result.ok).toBe(true);
    const page = ctx.project.maps[ctx.project.startMapId].events[0].pages![0];
    expect(page.commands).toContainEqual({ kind: "text", body: "던전 입구\n함께 가자" });
    expect(() => validateLowLevelCommandArray("commands", [{ kind: "text", lines: ["누락"] }])).toThrow("string body");
  });
  it("rejects double-escaped line breaks but preserves the RPG actor-name escape", () => {
    expect(() => validateLowLevelCommandArray("text", [{ kind: "text", body: "입구\\n출발" }])).toThrow("실제 줄바꿈");
    expect(() => validateLowLevelCommandArray("text", [{ kind: "text", body: "입구\n\\n[1] 출발" }])).not.toThrow();
  });
  it("cannot claim success after the model repeatedly says complete without authoring", async () => {
    let calls = 0;
    const session = new AssistantSession(createBlankProject(), {
      config: { ...defaultAiConfig(), agentMode: "chat", model: "test", liteModel: "test", apiKey: "test", maxToolCalls: 12 },
      declareIntent: fixedDeclarer({ mode: "modify", adventure: required }),
      chat: async () => { calls++;return { message: { role: "assistant", content: "모험 완성" }, finishReason: "stop" }; },
    });
    const result = await session.sendUserMessage("요청한 모험을 구성해줘");
    expect(result.assistantText).toContain("아직 미완성");
    expect(result.assistantText).not.toContain("모험 완성");
    expect(calls).toBeGreaterThan(1);
  });
});
