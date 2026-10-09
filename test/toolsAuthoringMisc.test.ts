import { describe, expect, it } from "vitest";
import { getTool, runTool, type ToolContext, type ToolDomain } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";

function context(): ToolContext {
  return { project: createBlankProject() };
}

function firstMap(project: Project) {
  const map = project.maps[project.startMapId];
  if (!map) throw new Error(`missing start map: ${project.startMapId}`);
  return map;
}

function firstId(entries: readonly { readonly id: string }[], label: string): string {
  const entry = entries[0];
  if (!entry) throw new Error(`missing ${label}`);
  return entry.id;
}

function firstProfileAssetId(project: Project): string {
  const assetId = project.resourceProfiles[0]?.assetId;
  if (!assetId) throw new Error("missing resource profile assetId");
  return assetId;
}

function addSecondMap(ctx: ToolContext): string {
  const result = runTool(ctx, "create_map", { id: "map_second", name: "둘째 맵", width: 8, height: 7 });
  expect(result.ok, result.summary).toBe(true);
  return "map_second";
}

function expectRejectedWith(result: ReturnType<typeof runTool>, ...values: string[]): void {
  expect(result.ok).toBe(false);
  for (const value of values) expect(result.summary).toContain(value);
}

describe("authoring misc facades", () => {
  it("upserts mapConnections and validates map ids and coordinates", () => {
    const ctx = context();
    const fromMap = firstMap(ctx.project);
    const toMapId = addSecondMap(ctx);
    const connection = {
      id: "road_gate",
      name: "마을길",
      from: { mapId: fromMap.id, x: 2, y: 3, direction: "right" },
      to: { mapId: toMapId, x: 4, y: 5, direction: "left" },
      playerEnabled: true,
      npcEnabled: false,
    };

    const result = runTool(ctx, "upsert_map_connection", { connection });
    expect(result.ok, result.summary).toBe(true);
    expect(ctx.project.mapConnections).toEqual([connection]);

    const missingMap = runTool(ctx, "upsert_map_connection", {
      connection: { ...connection, id: "bad-map", to: { ...connection.to, mapId: "missing" } },
    });
    expectRejectedWith(missingMap, fromMap.id, toMapId);
    const badCoordinate = runTool(ctx, "upsert_map_connection", {
      connection: { ...connection, id: "bad-pos", to: { ...connection.to, x: 8 } },
    });
    expectRejectedWith(badCoordinate, toMapId, "0..7");
  });

  it("deletes mapConnections and names valid connection ids on rejection", () => {
    const ctx = context();
    ctx.project.mapConnections = [{
      id: "road_gate",
      from: { mapId: ctx.project.startMapId, x: 1, y: 1 },
      to: { mapId: ctx.project.startMapId, x: 2, y: 2 },
      playerEnabled: true,
      npcEnabled: true,
    }];
    expect(runTool(ctx, "delete_map_connection", { connectionId: "road_gate" }).ok).toBe(true);
    expect(ctx.project.mapConnections).toEqual([]);

    ctx.project.mapConnections = [{
      id: "known-road",
      from: { mapId: ctx.project.startMapId, x: 1, y: 1 },
      to: { mapId: ctx.project.startMapId, x: 2, y: 2 },
      playerEnabled: true,
      npcEnabled: true,
    }];
    expectRejectedWith(runTool(ctx, "delete_map_connection", { connectionId: "missing" }), "known-road");
  });

  it("upserts villageInfoDocuments and validates mapId", () => {
    const ctx = context();
    const document = { id: "village-guide", mapId: ctx.project.startMapId, title: "마을 안내", markdown: "# 광장" };
    expect(runTool(ctx, "upsert_village_document", { document }).ok).toBe(true);
    expect(ctx.project.villageInfoDocuments).toEqual([document]);

    const rejected = runTool(ctx, "upsert_village_document", { document: { ...document, mapId: "missing" } });
    expectRejectedWith(rejected, ctx.project.startMapId);
  });

  it("deletes villageInfoDocuments and names valid ids on rejection", () => {
    const ctx = context();
    ctx.project.villageInfoDocuments = [{ id: "guide", mapId: ctx.project.startMapId, title: "안내", markdown: "본문" }];
    expect(runTool(ctx, "delete_village_document", { documentId: "guide" }).ok).toBe(true);
    expect(ctx.project.villageInfoDocuments).toEqual([]);

    ctx.project.villageInfoDocuments = [{ id: "known-doc", mapId: ctx.project.startMapId, title: "안내", markdown: "본문" }];
    expectRejectedWith(runTool(ctx, "delete_village_document", { documentId: "missing" }), "known-doc");
  });

  it("upserts resourceProfiles only for known authored assets", () => {
    const ctx = context();
    ctx.project.assets.uploaded.face_may = { id: "face_may", name: "메이", kind: "faceset", dataUrl: "data:image/png;base64,AA==", meta: {} };
    const profile = { kind: "faceset" as const, name: "메이 얼굴", assetId: "face_may", tileWidth: 48, tileHeight: 48, imageWidth: 192, imageHeight: 192 };
    expect(runTool(ctx, "upsert_resource_profile", { profile }).ok).toBe(true);
    expect(ctx.project.resourceProfiles.find((entry) => entry.assetId === "face_may")).toEqual(profile);

    const rejected = runTool(ctx, "upsert_resource_profile", { profile: { ...profile, assetId: "missing" } });
    expectRejectedWith(rejected, "face_may");
  });

  it("deletes resourceProfiles without deleting the separately authored asset", () => {
    const ctx = context();
    ctx.project.assets.uploaded.face_may = { id: "face_may", name: "메이", kind: "faceset", dataUrl: "data:image/png;base64,AA==", meta: {} };
    ctx.project.resourceProfiles.push({ kind: "faceset", name: "메이 얼굴", assetId: "face_may" });
    expect(runTool(ctx, "delete_resource_profile", { assetId: "face_may" }).ok).toBe(true);
    expect(ctx.project.resourceProfiles.some((entry) => entry.assetId === "face_may")).toBe(false);
    expect(ctx.project.assets.uploaded.face_may?.id).toBe("face_may");

    expectRejectedWith(runTool(ctx, "delete_resource_profile", { assetId: "missing" }), firstProfileAssetId(ctx.project));
  });

  it("upserts character profiles keyed by characterId and validates gift item ids", () => {
    const ctx = context();
    const itemId = firstId(ctx.project.database.items, "item");
    const profile = {
      displayName: "메이",
      birthday: { season: "spring" as const, day: 12 },
      giftPrefs: { loved: [itemId], liked: [], disliked: [] },
      giftResponses: { loved: "정말 좋아!", disliked: "이건 조금..." },
    };
    expect(runTool(ctx, "upsert_character_profile", { characterId: "may", profile }).ok).toBe(true);
    expect(ctx.project.characters).toEqual({ may: profile });

    const rejected = runTool(ctx, "upsert_character_profile", {
      characterId: "may",
      profile: { giftPrefs: { loved: ["missing-item"] } },
    });
    expectRejectedWith(rejected, itemId);
  });

  it("deletes character profiles without deleting actors or events", () => {
    const ctx = context();
    const actorId = ctx.project.database.actors[0]?.id;
    ctx.project.characters = { may: { displayName: "메이" } };
    expect(runTool(ctx, "delete_character_profile", { characterId: "may" }).ok).toBe(true);
    expect(ctx.project.characters).toBeUndefined();
    expect(ctx.project.database.actors.some((actor) => actor.id === actorId)).toBe(true);

    ctx.project.characters = { known: { displayName: "남은 인물" } };
    expectRejectedWith(runTool(ctx, "delete_character_profile", { characterId: "missing" }), "known");
  });

  it("upserts testPresets and validates referenced slots and start position", () => {
    const ctx = context();
    const map = firstMap(ctx.project);
    const switchId = firstId(ctx.project.switches, "switch");
    const variableId = firstId(ctx.project.variables, "variable");
    const itemId = firstId(ctx.project.database.items, "item");
    const preset = {
      id: "boss-ready",
      name: "보스 직전",
      switches: { [switchId]: true },
      variables: { [variableId]: 4 },
      inventory: { [itemId]: 2 },
      gold: 300,
      startMapId: map.id,
      startPos: { x: 3, y: 4 },
    };
    expect(runTool(ctx, "upsert_test_preset", { preset }).ok).toBe(true);
    expect(ctx.project.testPresets).toEqual([preset]);

    const missingSlot = runTool(ctx, "upsert_test_preset", { preset: { ...preset, id: "bad", switches: { missing: true } } });
    expectRejectedWith(missingSlot, switchId);
    const badPosition = runTool(ctx, "upsert_test_preset", { preset: { ...preset, id: "bad-pos", startPos: { x: map.width, y: 0 } } });
    expectRejectedWith(badPosition, map.id, `0..${map.width - 1}`);
  });

  it("deletes testPresets and names valid ids on rejection", () => {
    const ctx = context();
    ctx.project.testPresets = [{ id: "known-preset", name: "알려진 프리셋" }];
    expect(runTool(ctx, "delete_test_preset", { presetId: "known-preset" }).ok).toBe(true);
    expect(ctx.project.testPresets).toEqual([]);

    ctx.project.testPresets = [{ id: "another-preset", name: "다른 프리셋" }];
    expectRejectedWith(runTool(ctx, "delete_test_preset", { presetId: "missing" }), "another-preset");
  });

  it("adds and deletes a named flag slot together with its session seed", () => {
    const ctx = context();
    expect(runTool(ctx, "manage_flag_slot", { action: "add", kind: "switch", id: "sw_weather", name: "비가 옴", switchValue: true }).ok).toBe(true);
    expect(ctx.project.switches).toContainEqual({ id: "sw_weather", name: "비가 옴" });
    expect(ctx.project.session.switches.sw_weather).toBe(true);

    expect(runTool(ctx, "manage_flag_slot", { action: "delete", kind: "switch", id: "sw_weather" }).ok).toBe(true);
    expect(ctx.project.switches.some((entry) => entry.id === "sw_weather")).toBe(false);
    expect(ctx.project.session.switches).not.toHaveProperty("sw_weather");

    expectRejectedWith(runTool(ctx, "manage_flag_slot", { action: "delete", kind: "variable", id: "missing" }), firstId(ctx.project.variables, "variable"));
  });

  it("rejects deleting referenced slots and names event, quest, and ending ids", () => {
    const ctx = context();
    const map = firstMap(ctx.project);
    ctx.project.switches.push({ id: "sw_guarded", name: "보호됨" });
    ctx.project.session.switches.sw_guarded = false;
    map.events.push({
      id: "ev_guarded",
      x: 1,
      y: 1,
      trigger: { kind: "action" },
      commands: [{ kind: "setSwitch", switchId: "sw_guarded", value: true }],
    });
    ctx.project.quests = [{
      kind: "graph",
      id: "quest_guarded",
      title: "보호 퀘스트",
      nodes: [{ id: "node_guarded", description: "조건", completesWhen: { kind: "switch", switchId: "sw_guarded", value: true } }],
      edges: [],
    }];
    ctx.project.endings = [{ id: "ending_guarded", name: "보호 엔딩", priority: 1, conditions: [{ kind: "switch", switchId: "sw_guarded", value: true }] }];

    const rejected = runTool(ctx, "manage_flag_slot", { action: "delete", kind: "switch", id: "sw_guarded" });
    expectRejectedWith(rejected, "ev_guarded", "quest_guarded", "ending_guarded");
    expect(ctx.project.switches.some((entry) => entry.id === "sw_guarded")).toBe(true);
    expect(ctx.project.session.switches).toHaveProperty("sw_guarded");
  });

  it("declares every mixed-family tool domain explicitly", () => {
    const expected: Readonly<Record<string, readonly ToolDomain[]>> = {
      upsert_map_connection: ["map"],
      delete_map_connection: ["map"],
      upsert_village_document: ["map"],
      delete_village_document: ["map"],
      upsert_resource_profile: ["system"],
      delete_resource_profile: ["system"],
      upsert_character_profile: ["database"],
      delete_character_profile: ["database"],
      upsert_test_preset: ["system"],
      delete_test_preset: ["system"],
      manage_flag_slot: ["event"],
    };
    for (const [name, domains] of Object.entries(expected)) expect(getTool(name)?.domains, name).toEqual(domains);
  });
});
