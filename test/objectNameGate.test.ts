import { describe, expect, it } from "vitest";
import { parseIntentDeclaration, parseNpcRewardRequirements, type IntentFacts, type NpcRewardRequirement } from "@/ai/intentDeclaration";
import { verifyNpcRewardsPlayable } from "@/ai/workItemOutcome";
import { DB_TOOLS } from "@/editor/tools/dbTools";
import { giveMonster } from "@/project/monsterCollection";
import { startSession } from "@/project/session";
import { PLAY_TOOLS } from "@/editor/tools/playTools";
import { freshBlankProject as createBlankProject } from "./support/blankProject";
import type { Command, GameEvent } from "@/project/types";
import { buildObjectGenRequest } from "@/editor/tools/objectGenTool";
import { createHeadlessBlankProject } from "@/headless";
import { BEODEUL_PLACEABLE_OBJECTS } from "@/assets/beodeulPlaceableObjects";
import { sharedObjects } from "@/editor/tools/sharedDesignCatalog";
import { kitDisplayNameTable } from "@/project/kitDisplayNames";
import { isolateTimers } from "./mergedTeardown";

describe("npcRewardAcceptance", () => {
  isolateTimers();
  const FACTS: IntentFacts = {
    userText: "Make Mira give two potions once.", currentMap: null, selection: null,
    maps: [], facilityLabels: [], toolNames: [], hasActivePlan: false,
  };
  const REQUEST = [{ target: { eventName: "Mira" }, grants: [{ kind: "item", id: "item_potion", count: 2 }], oneTime: true }] satisfies NpcRewardRequirement[];
  const ITEM: Command = { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 2 };
  const MONSTER: Command = { kind: "giveMonster", speciesId: "species_leafling", level: 5 };
  const MONSTER_REQUEST = [{ target: { eventId: "ev_mira" }, grants: [{ kind: "monster", id: "species_leafling", count: 1 }], oneTime: true }] satisfies NpcRewardRequirement[];
  function fixture(commands: Command[], oneTime = true) {
    const project = createBlankProject();
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("Missing fixture map");
    map.events = [];
    const event: GameEvent = {
      id: "ev_mira", name: "Mira", x: 2, y: 3, trigger: { kind: "action" }, commands: [],
      pages: [{
        id: "reward", name: "Reward", conditions: [], graphic: { transparent: true },
        trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 },
        commands: [...commands, ...(oneTime ? [{ kind: "setSelfSwitch", key: "A", value: true } satisfies Command] : [])],
      }, ...(oneTime ? [{
        id: "claimed", name: "Claimed", conditions: [{ kind: "selfSwitch", key: "A", value: true }],
        graphic: { transparent: true }, trigger: { kind: "action" }, priority: "same", overlapForbidden: true,
        movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", body: "Already claimed." }],
      } satisfies NonNullable<GameEvent["pages"]>[number]] : [])],
    };
    map.events.push(event);
    return { project, map, event };
  }
  function sceneTool(project: ReturnType<typeof createBlankProject>, steps: unknown[]) {
    const tool = PLAY_TOOLS.find((entry) => entry.name === "run_scene_test");
    if (!tool) throw new Error("Missing scene tool");
    return tool.run(project, { mapId: project.startMapId, start: { x: 2, y: 2 }, steps });
  }
  describe("request-declared NPC rewards", () => {
    it("leaves ordinary NPCs and non-authoring declarations unchanged", () => {
      const { project } = fixture([{ kind: "text", body: "Hello." }]);
      expect(verifyNpcRewardsPlayable(project, undefined)).toEqual({ ok: true });
      const ordinary = parseIntentDeclaration(JSON.stringify({ mode: "create" }), FACTS);
      expect(ordinary.intent?.npcRewards).toBeUndefined();
      for (const mode of ["question", "other"]) {
        expect(parseIntentDeclaration(JSON.stringify({ mode, npcRewards: REQUEST }), FACTS).intent?.npcRewards).toBeUndefined();
      }
    });

    it.each([
      null, [], {}, [{ grants: [] }], [{ target: { eventId: "ev_mira" } }],
      [{ target: { eventId: "ev_mira" }, grants: [] }],
      [{ target: { eventId: "ev_mira", eventName: "Mira" }, grants: [{ kind: "item", id: "item_potion" }] }],
      ...[0, -1, 1.5, "2", null].map((count) => [{ target: { eventId: "ev_mira" }, grants: [{ kind: "item", id: "item_potion", count }] }]),
      [{ target: { eventId: "ev_mira" }, grants: [{ kind: "actor", id: "actor_hero" }] }],
      [{ target: { eventId: "ev_mira" }, grants: [{ kind: "monster" }] }],
      [{ ...REQUEST[0], oneTime: "true" }], [{ ...REQUEST[0], choices: [-1] }],
    ].map((npcRewards) => ({ npcRewards })))("keeps malformed opt-in data fail-closed: %j", ({ npcRewards }) => {
      const { intent } = parseIntentDeclaration(JSON.stringify({ mode: "modify", npcRewards }), FACTS);
      expect(intent?.source).toBe("llm");
      expect(intent?.npcRewards).toHaveProperty("invalidReason");
      expect(verifyNpcRewardsPlayable(createBlankProject(), intent?.npcRewards).ok).toBe(false);
    });

    it("requires a first-interaction delta even when the inventory already exceeds the reward", () => {
      const { project } = fixture([]);
      project.session.inventory.item_potion = 20;
      expect(verifyNpcRewardsPlayable(project, REQUEST).ok).toBe(false);
    });

    it("accepts exact item and monster grants once without mutating the project", () => {
      const { project } = fixture([ITEM, MONSTER]);
      project.session.inventory.item_potion = 20;
      const before = structuredClone(project);
      const required: NpcRewardRequirement[] = [{
        target: { eventId: "ev_mira", mapId: project.startMapId },
        grants: [{ kind: "item", id: "item_potion", count: 2 }, { kind: "monster", id: "species_leafling", count: 1 }], oneTime: true,
      }];
      expect(verifyNpcRewardsPlayable(project, required)).toEqual({ ok: true });
      expect(project).toEqual(before);
    });

    it("accepts an unspecified positive count but never a zero delta", () => {
      const { project, event } = fixture([ITEM]);
      const required: NpcRewardRequirement[] = [{ target: { eventId: event.id }, grants: [{ kind: "item", id: "item_potion" }] }];
      expect(verifyNpcRewardsPlayable(project, required)).toEqual({ ok: true });
      if (event.pages?.[0]) event.pages[0].commands = [];
      expect(verifyNpcRewardsPlayable(project, required).ok).toBe(false);
    });

    it.each(["removed", "wrong-item", "wrong-count", "repeatable", "shadowed-page", "wrong-repeat-grant"])("rejects %s item reward behavior", (variant) => {
      const { project, event } = fixture([ITEM], variant !== "repeatable");
      const rewardPage = event.pages?.[0];
      const claimedPage = event.pages?.[1];
      if (!rewardPage) throw new Error("Missing reward page");
      if (variant === "removed") rewardPage.commands = [{ kind: "text", body: "Reward delivered." }, { kind: "setSelfSwitch", key: "A", value: true }];
      if (variant === "wrong-item") rewardPage.commands = [{ kind: "changeItem", itemId: "item_capture_orb", op: "+=", amount: 2 }];
      if (variant === "wrong-count") rewardPage.commands = [{ kind: "changeItem", itemId: "item_potion", op: "+=", amount: 1 }];
      if (variant === "shadowed-page" && claimedPage) claimedPage.conditions = [];
      if (variant === "wrong-repeat-grant" && claimedPage) claimedPage.commands = [{ kind: "changeItem", itemId: "item_capture_orb", op: "+=", amount: 1 }];
      expect(verifyNpcRewardsPlayable(project, REQUEST).ok).toBe(false);
    });

    it.each(["removed", "wrong-species", "actor-party", "repeatable"])("rejects %s collected monster behavior", (variant) => {
      const command: Command = variant === "wrong-species" ? { ...MONSTER, speciesId: "species_sparkit" }
        : variant === "actor-party" ? { kind: "changeParty", actorId: "actor_hero", action: "add" }
        : variant === "removed" ? { kind: "text", body: "Here is your monster." } : MONSTER;
      const { project } = fixture([command], variant !== "repeatable");
      expect(verifyNpcRewardsPlayable(project, MONSTER_REQUEST).ok).toBe(false);
    });

    it("resolves unique exact item and NPC names within the declared map", () => {
      const { project, map, event } = fixture([ITEM]);
      const potion = project.database.items.find((item) => item.id === "item_potion");
      if (!potion) throw new Error("Missing potion");
      project.maps.other = { ...structuredClone(map), id: "other", events: [structuredClone(event)] };
      const required: NpcRewardRequirement[] = [{ target: { eventName: "Mira", mapId: map.id }, grants: [{ kind: "item", name: potion.name, count: 2 }], oneTime: true }];
      expect(verifyNpcRewardsPlayable(project, required)).toEqual({ ok: true });
      expect(verifyNpcRewardsPlayable(project, REQUEST).ok).toBe(false);
      project.database.items.push({ ...potion, id: "duplicate_potion" });
      expect(verifyNpcRewardsPlayable(project, required).ok).toBe(false);
    });

    it.each(["missing-target", "ambiguous-target", "wrong-map", "missing-item", "hidden-behind-npc"])("rejects %s rather than picking another reward", (variant) => {
      const { project, map, event } = fixture([ITEM]);
      if (variant === "missing-target") map.events = [];
      if (variant === "ambiguous-target") map.events.push({ ...structuredClone(event), id: "duplicate" });
      if (variant === "wrong-map") map.id = "other";
      if (variant === "missing-item") project.database.items = project.database.items.filter((item) => item.id !== "item_potion");
      if (variant === "hidden-behind-npc") map.events.unshift({ ...structuredClone(event), id: "blocker", name: "Someone else" });
      const required = variant === "wrong-map" ? [{ ...REQUEST[0], target: { eventId: event.id, mapId: "missing" } }] : REQUEST;
      expect(verifyNpcRewardsPlayable(project, required).ok).toBe(false);
    });

    it("uses declared starter choices and counts new box monsters when the party is full", () => {
      const { project } = fixture([]);
      const session = startSession(project, 1);
      for (let index = 0; index < 6; index++) giveMonster(project, session, { speciesId: "species_leafling", level: 5 });
      project.session.monsterInstances = session.monsterInstances;
      project.session.monsterParty = session.monsterParty;
      project.session.monsterBox = session.monsterBox;
      expect(verifyNpcRewardsPlayable(project, MONSTER_REQUEST).ok).toBe(false);
      const tool = DB_TOOLS.find((entry) => entry.name === "give_starter_monsters");
      if (!tool) throw new Error("Missing starter tool");
      tool.run(project, { speciesIds: ["species_leafling", "species_sparkit"], actorEvent: { eventId: "ev_mira", x: 2, y: 3 } });
      // #2727: 스타터를 고르면 「첫 동료로 정할까요?」 예/아니오가 이어진다 — 선택은 [종, 예(0)] 두 번이다.
      const required: NpcRewardRequirement[] = [{ target: { eventId: "ev_mira" }, grants: [{ kind: "monster", id: "species_leafling", count: 1 }], oneTime: true, choices: [0, 0] }];
      expect(verifyNpcRewardsPlayable(project, required)).toEqual({ ok: true });
      expect(verifyNpcRewardsPlayable(project, [{ ...required[0], choices: [1, 0] }]).ok).toBe(false);
      const proof = sceneTool(project, [
        { kind: "snapshotRewards" }, { kind: "interact", eventId: "ev_mira" }, { kind: "choose", index: 0 }, { kind: "choose", index: 0 },
        { kind: "expect", ownedMonsterDelta: { species_leafling: 1 }, interactionComplete: true },
        { kind: "snapshotRewards" }, { kind: "interact", eventId: "ev_mira" },
        { kind: "expect", ownedMonsterDelta: { species_leafling: 0 }, interactionComplete: true },
      ]);
      expect(proof.data).toMatchObject({ ok: true, finalState: { ownedMonsterCounts: { species_leafling: 7 } } });
      expect(proof.data).toHaveProperty("finalState.monsterParty.length", 6);
      expect(proof.data).toHaveProperty("finalState.monsterBox.length", 1);
    });

    it("resolves the first-page display name used by starter authoring when no root name exists", () => {
      const { project, event } = fixture([MONSTER]);
      delete event.name;
      if (event.pages?.[0]) event.pages[0].name = "Mira";
      const species = project.database.monsterSpecies?.find((entry) => entry.id === "species_leafling");
      if (!species) throw new Error("Missing species");
      const required: NpcRewardRequirement[] = [{ target: { eventName: "Mira" }, grants: [{ kind: "monster", name: species.name, count: 1 }], oneTime: true }];
      expect(verifyNpcRewardsPlayable(project, required)).toEqual({ ok: true });
      expect(verifyNpcRewardsPlayable(project, [{ ...required[0], target: { eventName: "mira" } }]).ok).toBe(false);
    });

    it("checks declared repeat choices against the same session rather than resetting the guard", () => {
      const { project, event } = fixture([{
        kind: "choices", options: [{ text: "Claim", branch: [{
          kind: "fork", condition: { kind: "selfSwitch", key: "A", value: false },
          then: [ITEM, { kind: "setSelfSwitch", key: "A", value: true }],
        }] }],
      }], false);
      const required = parseNpcRewardRequirements([{ ...REQUEST[0], choices: [0], repeatChoices: [0] }]);
      expect(verifyNpcRewardsPlayable(project, required)).toEqual({ ok: true });
      if (event.pages?.[0]) event.pages[0].commands = [{ kind: "choices", options: [{ text: "Claim", branch: [ITEM] }] }];
      expect(verifyNpcRewardsPlayable(project, required).ok).toBe(false);
    });

    it("rejects unfinished choices even if a reward was already granted", () => {
      const { project } = fixture([ITEM, { kind: "choices", options: [{ text: "OK", branch: [] }] }]);
      expect(verifyNpcRewardsPlayable(project, REQUEST).ok).toBe(false);
      const required = parseNpcRewardRequirements([{ ...REQUEST[0], choices: [0] }]);
      expect(verifyNpcRewardsPlayable(project, required)).toEqual({ ok: true });
      expect(verifyNpcRewardsPlayable(project, parseNpcRewardRequirements([{ ...REQUEST[0], choices: [99] }])).ok).toBe(false);
    });

    it("keeps explicit reward expectations even before the target exists", () => {
      const parsed = parseIntentDeclaration(JSON.stringify({ mode: "modify", npcRewards: REQUEST }), FACTS);
      expect(parsed.intent).toMatchObject({ npcRewards: REQUEST });
    });

    it("does not accept text and a claimed switch as an inventory delta", () => {
      const { project } = fixture([{ kind: "text", body: "Take these potions." }]);
      project.session.inventory.item_potion = 20;
      const result = sceneTool(project, [
        { kind: "interact", eventId: "ev_mira" },
        { kind: "expect", inventoryDelta: { item_potion: 2 }, interactionComplete: true },
      ]);
      expect(result.data).toMatchObject({ ok: false });
    });

    it("does not accept changeParty as a collected monster grant", () => {
      const { project } = fixture([{ kind: "changeParty", actorId: "actor_hero", action: "add" }]);
      const result = sceneTool(project, [
        { kind: "interact", eventId: "ev_mira" },
        { kind: "expect", ownedMonsterDelta: { species_leafling: 1 } },
      ]);
      expect(result.data).toMatchObject({ ok: false });
    });
  });
});

// 2026-11-08 tiles-relax (owner: 「이름 거절을 거의 제거하고」): generate_missing_object refuses only an exact id / display-name match.
// A name that merely shares a word with a stock kit (「얼음 기둥」 vs 「정원 정문 (돌기둥·열린 쇠문)」) is drawn, and the similar kits
// come back as a visible note so the agent can still pick a stock one.
describe("objectGenNameRefusal", () => {
  isolateTimers();
  const project = createHeadlessBlankProject();
  const map = Object.values(project.maps).find((m) => project.tilesets[m.tilesetId]?.tileSize === 16)!;
  const kit = (project.tilesets[map.tilesetId]!.structureKits ?? []).find((k) => k.width <= 8 && k.height <= 8 && (k.name ?? "").length >= 2)!;
  const ask = (title: string, extra: Record<string, unknown> = {}) =>
    buildObjectGenRequest(project, { mapId: map.id, title, description: "시험용 기물", objectKind: "floor", need: "시험", ...extra });
  describe("generate_missing_object name refusal", () => {
    it("draws a similarly named object and lists the similar kits as a note", () => {
      const result = ask("얼음 기둥");
      expect(result.data.title).toBe("얼음 기둥");
      expect(result.data.similar?.length).toBeGreaterThan(0);
      expect(result.summary).toContain(result.data.similar![0]!.id);
    });

    it("still refuses an exact display name or id, ignoring spaces", () => {
      expect(() => ask(kit.name!)).toThrow(kit.id);
      expect(() => ask(kit.name!.replace(/\s/gu, ""))).toThrow(kit.id);
      expect(() => ask(kit.id)).toThrow(kit.id);
    });

    it("lets notThese override an exact match", () => {
      expect(ask(kit.name!, { notThese: [kit.id] }).data.title).toBe(kit.name);
    });
  });
});

// 기물 이름 관문 — 조수는 이름·태그만 보고 기물을 찾는다(~/claude-viz/object-findability.html, object-search 레인).
// 같은 이름의 다른 기물이나 영문 조각 이름은 찾기를 흐린다. 버들항 기물 카탈로그는 0 을 강제하고,
// 다른 번들 칩셋은 지금 수(기준선)보다 늘지 못하게 한다 — 줄이면 아래 수를 같이 낮춘다.
describe("objectNameGate", () => {
  isolateTimers();
  /** 칩셋별 상한: 같은 이름을 가진 킷 행 수, 영문 낱말(두 글자 이상)이 든 이름 수. 여기 없는 칩셋은 0. */
  const BASELINE: Readonly<Record<string, { duplicateRows: number; englishNames: number }>> = {
    atlas_biome_interior: { duplicateRows: 4, englishNames: 0 },
    beodeul_city: { duplicateRows: 122, englishNames: 9 },
    beodeul_ground: { duplicateRows: 0, englishNames: 5 },
    beodeul_reviewed: { duplicateRows: 42, englishNames: 0 },
    beodeul_warm_trees: { duplicateRows: 0, englishNames: 7 },
    emerald_monster_climate: { duplicateRows: 0, englishNames: 48 },
    emerald_monster_coast: { duplicateRows: 0, englishNames: 85 },
    emerald_monster_dungeon: { duplicateRows: 0, englishNames: 13 },
    emerald_monster_gyms: { duplicateRows: 0, englishNames: 37 },
    emerald_monster_overworld: { duplicateRows: 0, englishNames: 93 },
    emerald_monster_rooms: { duplicateRows: 0, englishNames: 104 },
    emerald_monster_wild: { duplicateRows: 0, englishNames: 65 },
    joseon_baram: { duplicateRows: 19, englishNames: 0 },
    jp_city: { duplicateRows: 522, englishNames: 16 },
    modern_campus: { duplicateRows: 0, englishNames: 1 },
    modern_city: { duplicateRows: 302, englishNames: 10 },
    monster_climate: { duplicateRows: 0, englishNames: 48 },
    monster_coast: { duplicateRows: 0, englishNames: 85 },
    monster_dungeon: { duplicateRows: 0, englishNames: 13 },
    monster_gyms: { duplicateRows: 0, englishNames: 37 },
    monster_overworld: { duplicateRows: 0, englishNames: 93 },
    monster_rooms: { duplicateRows: 0, englishNames: 104 },
    monster_wild: { duplicateRows: 0, englishNames: 65 },
  };
  const ENGLISH_WORD = /[A-Za-z]{2,}/u;
  describe("object name gate", () => {
    it("keeps Beodeul object names unique", () => {
      const seen = new Map<string, string>();
      const duplicates: string[] = [];
      for (const object of BEODEUL_PLACEABLE_OBJECTS) {
        const other = seen.get(object.nameKo);
        if (other) duplicates.push(`${object.nameKo}: ${other}, ${object.id}`);
        seen.set(object.nameKo, object.id);
      }
      expect(duplicates).toEqual([]);
    });

    it("gives every Beodeul object a Korean tag", () => {
      const missing = BEODEUL_PLACEABLE_OBJECTS.filter(object => !object.tags.some(tag => /[가-힣]/u.test(tag))).map(object => object.id);
      expect(missing).toEqual([]);
    });

    it("applies every kit display-name entry to a bundled kit", () => {
      const project = createBlankProject();
      const stale: string[] = [];
      for (const [tilesetId, renames] of Object.entries(kitDisplayNameTable())) {
        const kits = new Map((project.tilesets[tilesetId]?.structureKits ?? []).map(kit => [kit.id, kit.name]));
        for (const [kitId, [, name]] of Object.entries(renames)) if (kits.get(kitId) !== name) stale.push(`${tilesetId}/${kitId}: ${kits.get(kitId)} ≠ ${name}`);
      }
      expect(stale).toEqual([]);
    });

    it("does not add duplicate or English-fragment kit names to bundled chipsets", () => {
      const byTileset = new Map<string, string[]>();
      for (const row of sharedObjects(createBlankProject())) {
        if (!row.id.startsWith("kit:")) continue;
        byTileset.set(row.tilesetId, [...(byTileset.get(row.tilesetId) ?? []), row.name]);
      }
      const over: string[] = [];
      for (const [tilesetId, names] of byTileset) {
        const counts = new Map<string, number>();
        for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
        const duplicateRows = names.filter(name => counts.get(name)! > 1).length;
        const englishNames = names.filter(name => ENGLISH_WORD.test(name)).length;
        const limit = BASELINE[tilesetId] ?? { duplicateRows: 0, englishNames: 0 };
        if (duplicateRows > limit.duplicateRows) over.push(`${tilesetId}: 같은 이름 행 ${duplicateRows} > ${limit.duplicateRows} (${[...counts].filter(([, n]) => n > 1).slice(0, 5).map(([name]) => name).join(" / ")})`);
        if (englishNames > limit.englishNames) over.push(`${tilesetId}: 영문 이름 ${englishNames} > ${limit.englishNames} (${names.filter(name => ENGLISH_WORD.test(name)).slice(0, 5).join(" / ")})`);
      }
      expect(over).toEqual([]);
    });
  });
});
