import { describe, expect, it } from "vitest";
import { applyRepel, escapeGraceStepsOf, grantEscapeGrace, normalizeRepelSteps, parseEncounterGuard, recordDungeonEntrance, repelBlocksWildLevel, resolveEscapeRope, tickEncounterGuard, troopWildLevel } from "@/project/encounterGuard";
import { normalizeItemRecord, normalizeSystemRecords } from "@/project/databaseRecordModel";
import { activeItemEffects, itemAllowsBattle, itemAllowsMenu } from "@/project/itemUsage";
import { useItemFromMenu, previewEvolutionStoneTarget } from "@/player/playerItemUse";
import { largestWaterRect, EXPEDITION_FIELD_ITEM_IDS, EXPEDITION_FISHING_ROD_ID } from "@/project/examples/monsterExpedition/fieldItems";
import { createScarloxyPokemonDemoProject } from "./support/scarloxyPokemonProject";
import { createBlankProject } from "@/project/defaults";
import { runTool } from "@/editor/tools";
import { runToolAsync } from "@/editor/tools/asyncToolRunner";
import { serialize, deserialize } from "@/project/io";
import { startSession } from "@/project/session";
import { attemptFishingCatch } from "@/project/fishing";
import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import { createMonsterHuntingGrounds } from "@/project/examples/monsterExpedition/tournamentGame";
import { canMove, isPassableLanding } from "@/project/collision";
import type { GameEvent, GameMap, Project } from "@/project/types";
import { applyCareItem, previewCareItem } from "@/project/monsterCare";
import { giveMonster } from "@/project/monsterCollection";
import { isEvolutionStone, itemAllowsFieldMenu } from "@/project/monsterEvolutionItems";
import { BAG_POCKETS, bagPocketCounts, bagPocketOf, stepBagPocket } from "@/player/playerBagPockets";
import { inventoryViewEntries } from "@/player/playerInventoryView";
import { EXPEDITION_STONE_IDS } from "@/project/examples/monsterExpedition/roster";
import type { ToolContext } from "@/editor/tools/types";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EXPEDITION_HERO_BACK, expeditionTrainerFront, gymLeaderArt, inferTrainerRoleFromName, typeArt, TRAINER_HERO_BACK } from "@/project/examples/monsterExpedition/trainerArt";
import { isolateTimers } from "./mergedTeardown";

// poke-sys ② 야생 조우 보호(도망 무적 걸음 · 벌레퇴치 · 탈출 로프 · 낚싯대). 작성만 했고 실행하지 않았다(워크트리 규칙).
describe("encounterGuard", () => {
  isolateTimers();
  function setup() {
    const project: any = createScarloxyPokemonDemoProject();
    project.system.battleParty = "monsters";
    project.database.items.push(
      normalizeItemRecord({ id: "repel", name: "퇴치 향", type: "normalGoods", occasion: "field", scope: "none", consumable: true, repelSteps: 3 }),
      normalizeItemRecord({ id: "rope", name: "탈출 로프", type: "normalGoods", occasion: "field", scope: "none", consumable: true, escapeTo: "entrance" }),
    );
    const session: any = structuredClone(project.session);
    session.inventory = { repel: 2, rope: 1 };
    return { project, session };
  }
  describe("item field normalisation", () => {
    it("omits the new fields from ordinary items (unchanged bytes) and clamps steps", () => {
      const plain = normalizeItemRecord({ id: "i", name: "i" });
      for (const key of ["repelSteps", "repelBelowLead", "escapeTo"]) expect(key in plain).toBe(false);
      expect(normalizeItemRecord({ id: "i", name: "i", repelSteps: 50000 }).repelSteps).toBe(9999);
      expect("repelSteps" in normalizeItemRecord({ id: "i", name: "i", repelSteps: 0 })).toBe(false);
      expect("repelBelowLead" in normalizeItemRecord({ id: "i", name: "i", repelBelowLead: true })).toBe(false);
      expect(normalizeItemRecord({ id: "i", name: "i", repelSteps: 5, repelBelowLead: true }).repelBelowLead).toBe(true);
      expect(normalizeItemRecord({ id: "i", name: "i", escapeTo: "entrance" }).escapeTo).toBe("entrance");
      expect("escapeTo" in normalizeItemRecord({ id: "i", name: "i", escapeTo: "bogus" as never })).toBe(false);
      expect(normalizeRepelSteps(2.9)).toBe(2);
      expect(normalizeRepelSteps(-1)).toBeUndefined();
    });
    it("lets the field menu use them regardless of item type, never in battle", () => {
      const { project } = setup();
      for (const id of ["repel", "rope"]) {
        const item = activeItemEffects(project.database.items.find((entry: any) => entry.id === id));
        expect(itemAllowsMenu(item)).toBe(true);
        expect(itemAllowsBattle({ ...item, occasion: "always" })).toBe(false);
      }
    });
  });
  describe("escape grace after fleeing", () => {
    it("defaults to 4 steps only for monster-party games and obeys system.escapeGraceSteps", () => {
      const { project } = setup();
      expect(escapeGraceStepsOf(project)).toBe(4);
      project.system.escapeGraceSteps = 0;
      expect(escapeGraceStepsOf(project)).toBe(0);
      project.system.escapeGraceSteps = 500;
      expect(escapeGraceStepsOf(project)).toBe(99);
      delete project.system.escapeGraceSteps;
      delete project.system.battleParty; delete project.system.monsterBattleParty;
      expect(escapeGraceStepsOf(project)).toBe(0);
    });
    it("keeps an authored step count through the project save whitelist, including an explicit 0", () => {
      // Break: normalizeSystemRecords is a whitelist. A missing field vanishes on one save/load,
      // so a monster game that turned grace off (0) or set 12 silently returns to the default 4.
      expect(normalizeSystemRecords({ startActorIds: [] }).escapeGraceSteps).toBeUndefined();
      expect(normalizeSystemRecords({ startActorIds: [], escapeGraceSteps: 0 }).escapeGraceSteps).toBe(0);
      expect(normalizeSystemRecords({ startActorIds: [], escapeGraceSteps: 12.8 }).escapeGraceSteps).toBe(12);
      expect(normalizeSystemRecords({ startActorIds: [], escapeGraceSteps: 500 }).escapeGraceSteps).toBe(99);
      expect(normalizeSystemRecords({ startActorIds: [], escapeGraceSteps: Number.NaN }).escapeGraceSteps).toBeUndefined();
      const kept = normalizeSystemRecords({ startActorIds: [], escapeGraceSteps: 0, battleParty: "monsters" });
      expect(escapeGraceStepsOf({ system: kept })).toBe(0);
    });
    it("suppresses exactly N steps, then the session field disappears", () => {
      const { project, session } = setup();
      grantEscapeGrace(project, session);
      expect(session.encounterGuard).toEqual({ graceSteps: 4 });
      const results = Array.from({ length: 6 }, () => tickEncounterGuard(session).suppress);
      expect(results).toEqual([true, true, true, true, false, false]);
      expect("encounterGuard" in session).toBe(false);
    });
  });
  describe("repellent", () => {
    it("uses steps, refuses stacking, announces the end and clears the guard", () => {
      const { project, session } = setup();
      const first = useItemFromMenu(project, session, "repel");
      expect(first).toMatchObject({ kind: "used" });
      expect(session.encounterGuard).toMatchObject({ repelSteps: 3, repelItemId: "repel" });
      expect(session.inventory.repel).toBe(1);
      expect(useItemFromMenu(project, session, "repel")).toMatchObject({ kind: "unusable" });
      expect(session.inventory.repel).toBe(1);
      expect(tickEncounterGuard(session)).toMatchObject({ suppress: true });
      expect(tickEncounterGuard(session)).toMatchObject({ suppress: true });
      const last = tickEncounterGuard(session);
      expect(last).toMatchObject({ suppress: true, expiredItemId: "repel" });
      expect(session.encounterGuard).toBeUndefined();
      expect(tickEncounterGuard(session).suppress).toBe(false);
    });
    it("below-lead mode never suppresses before the roll and blocks only weaker wild monsters", () => {
      const { session } = setup();
      expect(applyRepel(session, { id: "r2", name: "강한 향", repelSteps: 4, repelBelowLead: true }).kind).toBe("used");
      expect(tickEncounterGuard(session)).toMatchObject({ suppress: false, repelBelowLead: true });
      expect(repelBlocksWildLevel(5, 8)).toBe(true);
      expect(repelBlocksWildLevel(8, 8)).toBe(false);
      expect(repelBlocksWildLevel(undefined, 8)).toBe(false);
    });
    it("derives the wild level from the encounter roll first, then the troop's enemies", () => {
      const { project } = setup();
      const troop = project.database.troops[0];
      expect(troopWildLevel(project, troop.id, 7)).toBe(7);
      expect(typeof troopWildLevel(project, troop.id)).toBe("number");
      expect(troopWildLevel(project, "missing")).toBeUndefined();
    });
  });
  describe("escape rope", () => {
    it("only works on dungeon maps and returns to the recorded entrance", () => {
      const { project, session } = setup();
      const dungeon = Object.values<any>(project.maps)[0];
      const outdoor = { id: "outdoor_x", mapRole: "field" as const };
      project.maps.outdoor_x = { ...structuredClone(dungeon), id: "outdoor_x", mapRole: "field" };
      project.maps[dungeon.id] = { ...dungeon, mapRole: "dungeon" };
      session.currentMapId = "outdoor_x";
      expect(useItemFromMenu(project, session, "rope")).toMatchObject({ kind: "unusable" });
      expect(session.inventory.rope).toBe(1);
      recordDungeonEntrance(session, outdoor as never, project.maps[dungeon.id], { x: 4, y: 5 });
      expect(session.encounterGuard?.entrance).toEqual({ mapId: "outdoor_x", x: 4, y: 5 });
      session.currentMapId = dungeon.id;
      const used = useItemFromMenu(project, session, "rope");
      expect(used).toMatchObject({ kind: "used", transfer: { mapId: "outdoor_x", x: 4, y: 5 } });
      expect(session.inventory.rope ?? 0).toBe(0);
      // dungeon → dungeon keeps the original entrance; leaving the dungeon forgets it.
      recordDungeonEntrance(session, project.maps[dungeon.id], project.maps[dungeon.id], { x: 1, y: 1 });
      expect(session.encounterGuard?.entrance).toEqual({ mapId: "outdoor_x", x: 4, y: 5 });
      recordDungeonEntrance(session, project.maps[dungeon.id], project.maps.outdoor_x, { x: 1, y: 1 });
      expect(session.encounterGuard).toBeUndefined();
    });
    it("falls back to the start point without a recorded entrance", () => {
      const { project, session } = setup();
      const here = Object.values<any>(project.maps).find((map) => map.id !== project.startMapId)!;
      project.maps[here.id] = { ...here, mapRole: "dungeon" };
      session.currentMapId = here.id;
      const rope = resolveEscapeRope(project, session, { name: "탈출 로프", escapeTo: "entrance" });
      expect(rope).toMatchObject({ kind: "ok", destination: { mapId: project.startMapId } });
    });
  });
  describe("save round trip", () => {
    it("keeps only valid, non-empty guard state", () => {
      expect(parseEncounterGuard(undefined)).toBeUndefined();
      expect(parseEncounterGuard({ graceSteps: 0, repelSteps: -4 })).toBeUndefined();
      expect(parseEncounterGuard({ graceSteps: 3, repelSteps: 9, repelItemId: "x", repelBelowLead: true, entrance: { mapId: "m", x: 1, y: 2 } }))
        .toEqual({ graceSteps: 3, repelSteps: 9, repelItemId: "x", repelBelowLead: true, entrance: { mapId: "m", x: 1, y: 2 } });
      expect(parseEncounterGuard({ entrance: { mapId: "m", x: 1.5, y: 2 } })).toBeUndefined();
      const roundTrip = parseEncounterGuard(JSON.parse(JSON.stringify({ graceSteps: 2 })));
      expect(roundTrip).toEqual({ graceSteps: 2 });
    });
  });
  describe("fishing pond finder", () => {
    it("only returns rectangles made entirely of water cells", () => {
      const water = { passage: "solid", label: "강물(바위 둑)" };
      const grass = { passage: "passable", label: "풀밭" };
      const project: any = { tilesets: { t: { tileMeta: [grass, water] } } };
      const map: any = { tilesetId: "t", width: 5, height: 4, lowerTiles: [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0] };
      expect(largestWaterRect(project, map)).toEqual({ x: 1, y: 1, w: 3, h: 2 });
      map.lowerTiles = map.lowerTiles.map(() => 0);
      expect(largestWaterRect(project, map)).toBeUndefined();
    });
  });
});

// poke-sys ② 기본 캠페인의 필드 도구·낚시: 도구점 진열, 낚싯대 규칙, 낚시 구역(물 칸만), upsert_item 도구 검증. 작성만 했고 실행하지 않았다(워크트리 규칙).
describe("expeditionFieldItems", () => {
  isolateTimers();
  describe("monster campaign field items", () => {
    it("ships repellents, an escape rope, an angler with a rod and one fishing pond that only covers water", async () => {
      const ctx: any = { project: createBlankProject(), currentMapId: undefined };
      ctx.currentMapId = ctx.project.startMapId;
      // 체육관 수로 세계를 덜어 내면(#2573·#2581) 1~2관 판에는 낚시할 물길(강·항구·해변의 넓은 물)이 없다 — 강이 남는 3관 판에서 본다.
      const built = await runToolAsync(ctx, "build_monster_game", { mode: "create", gymCount: 3 });
      expect(built.ok).toBe(true);
      const project = deserialize(serialize(ctx.project));
      for (const id of [...EXPEDITION_FIELD_ITEM_IDS, EXPEDITION_FISHING_ROD_ID]) expect(project.database.items.some((item) => item.id === id)).toBe(true);
      const shops = Object.values(project.maps).flatMap((map) => map.events.flatMap((event) => JSON.stringify(event.pages ?? event.commands)));
      expect(shops.some((json) => json.includes('"mx_repel"') && json.includes('"mx_escape_rope"'))).toBe(true);
      const spot = project.system.fishing!.spots[0]!;
      expect(spot.catches).toEqual([]);
      expect(spot.monsterCatches!.length).toBeGreaterThan(0);
      expect(project.system.toolActions).toEqual([{ id: "mx-rod-fish", itemId: EXPEDITION_FISHING_ROD_ID, action: "fish" }]);
      const map = project.maps[spot.mapId]!;
      expect(map.events.some((event) => /angler$/.test(event.id))).toBe(true);
      const session: any = startSession(project, 1);
      expect(session.collections).toBeDefined();
      const target = { mapId: spot.mapId, x: spot.area.x, y: spot.area.y };
      expect(attemptFishingCatch(project, session, target)).toMatchObject({ ok: false, reason: "tool" });
      session.inventory[EXPEDITION_FISHING_ROD_ID] = 1;
      const cast = attemptFishingCatch(project, session, target);
      expect(cast).toMatchObject({ ok: true, kind: "encounter" });
    }, 120_000);
  });
  describe("upsert_item field utility fields", () => {
    it("accepts repelSteps / escapeTo and rejects invalid values", () => {
      const ctx: any = { project: createBlankProject(), currentMapId: undefined };
      ctx.currentMapId = ctx.project.startMapId;
      const ok = runTool(ctx, "upsert_item", { item: { id: "r1", name: "향", repelSteps: 120, occasion: "field", scope: "none" } });
      expect(ok.ok).toBe(true);
      expect(ctx.project.database.items.find((item: any) => item.id === "r1").repelSteps).toBe(120);
      const rope = runTool(ctx, "upsert_item", { item: { id: "e1", name: "로프", escapeTo: "entrance", occasion: "field", scope: "none" } });
      expect(rope.ok).toBe(true);
      expect(runTool(ctx, "upsert_item", { item: { id: "r2", name: "나쁜 향", repelSteps: 0 } }).ok).toBe(false);
      expect(runTool(ctx, "upsert_item", { item: { id: "e2", name: "나쁜 로프", escapeTo: "somewhere" } }).ok).toBe(false);
      const wrongOccasion = runTool(ctx, "upsert_item", { item: { id: "r3", name: "배틀 향", repelSteps: 5, occasion: "battle", scope: "ally" } });
      expect(wrongOccasion.ok).toBe(true);
      // 쓰기 도구 경고는 이제 diff.warnings 로 온다(toolRunner).
      expect((wrongOccasion.diff?.warnings ?? wrongOccasion.warnings ?? []).length).toBeGreaterThan(0);
    });
  });
});

// 몬스터 원정 길 출구: 문 칸에서 가장자리 띠로 이어지는 통행 칸마다 같은 이동 이벤트(잠긴 길이면 같은 잠금 fork)가 있어야 한다.
// 별싹 마을 북쪽 길은 두 칸 폭인데 이동 이벤트가 오른쪽 한 칸뿐이라, 왼쪽 열을 따라 올라간 플레이어가 지도 끝에서 멈췄다(terra-autopilot c4·c5·c9),
// 첫 사냥터 북쪽(스위치 mx_rival_2 로 잠긴 14칸 폭)은 문이 한 칸이었다(c1). 사냥터 탐험 생성기(tournament.ts)도 같은 규칙이다.
// 작성만 했고 실행하지 않았다(워크트리 규칙) — CI 에서 돈다.
describe("monsterExpeditionRoadExits", () => {
  isolateTimers();
  type Built = { project: Project; manifest: { maps: { id: string; role: string }[]; links: { from: string; to: string; eventId: string; source: { x: number; y: number } }[] } };
  const isTransfer = (e: GameEvent) => JSON.stringify(e.pages ?? e.commands).includes('"kind":"transfer"');
  const commandsOf = (e: GameEvent) => JSON.stringify(e.pages?.[0]?.commands ?? e.commands);
  const steps = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
  /** 길 출구(건물 문·계단 제외)마다, 문에서 가장자리 띠로 걸어 닿는 가장자리 칸을 모아 이동 이벤트가 없는 칸·잠금이 다른 칸을 돌려준다. */
  function auditRoadExits({ project, manifest }: Built) {
    const role = new Map(manifest.maps.map((m) => [m.id, m.role]));
    const building = /_(house|center|mart|gym)(_2f)?$/;
    const gaps: string[] = [], differing: string[] = [];
    let checked = 0, guarded = 0;
    for (const link of manifest.links) {
      // 건물 문·계단은 한 칸이 맞다 — 지도 사이를 잇는 길(마을·길·동굴·탑·학교) 출구만 본다.
      if (role.get(link.from) === "interior" || building.test(link.to)) continue;
      const map: GameMap = project.maps[link.from]!;
      const door = map.events.find((e) => e.id === link.eventId)!;
      const doorCommands = commandsOf(door);
      const { x, y } = link.source;
      const dist = { N: y, S: map.height - 1 - y, W: x, E: map.width - 1 - x };
      const [side, near] = Object.entries(dist).sort((a, b) => a[1] - b[1])[0]! as ["N" | "S" | "W" | "E", number];
      if (near > 4) continue;
      if (doorCommands.includes('"kind":"fork"')) guarded++;
      const toEdge = (p: { x: number; y: number }) => (side === "N" ? p.y : side === "S" ? map.height - 1 - p.y : side === "W" ? p.x : map.width - 1 - p.x);
      const out = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] }[side];
      // 같은 가장자리 띠를 다른 길 출구(같은 지도의 다른 문)가 나눠 쓸 수 있다 — 그 칸은 그 출구의 이동이 맡는다.
      const otherDoor = (e: GameEvent) => manifest.links.some((l) => l.from === link.from && l.eventId !== link.eventId && (e.id === l.eventId || e.id.startsWith(`${l.eventId}_edge_`)));
      const queue = [{ x, y }], seen = new Set([`${x},${y}`]);
      for (let n = 0; n < queue.length; n++) {
        const p = queue[n]!;
        if (toEdge(p) === 0) {
          checked++;
          // 그 칸에서 문 쪽(안쪽)으로 되짚어 가장 가까운 이동 이벤트가 이 문의 것이어야 한다(잠긴 길은 같은 잠금 명령).
          let cover: GameEvent | undefined;
          for (let k = 0; k <= near && !cover; k++) cover = map.events.find((e) => e.x === p.x - out[0] * k && e.y === p.y - out[1] * k && isTransfer(e));
          if (!cover) gaps.push(`${link.from}->${link.to} edge tile ${p.x},${p.y}`);
          else if (commandsOf(cover) !== doorCommands && !otherDoor(cover)) differing.push(`${link.from}->${link.to} edge tile ${p.x},${p.y} carries ${cover.id}`);
        }
        for (const [dx, dy] of steps) {
          const q = { x: p.x + dx, y: p.y + dy };
          if (q.x < 0 || q.y < 0 || q.x >= map.width || q.y >= map.height || seen.has(`${q.x},${q.y}`) || toEdge(q) > near) continue;
          if (isPassableLanding(project, map, q.x, q.y) && canMove(project, map, p.x, p.y, q.x, q.y)) { seen.add(`${q.x},${q.y}`); queue.push(q); }
        }
      }
    }
    return { checked, guarded, gaps, differing };
  }
  describe("monster expedition road exits", () => {
    it("puts the same transfer on every walkable tile where a campaign exit meets the map edge", () => {
      const audit = auditRoadExits(createMonsterExpedition());
      expect(audit.checked).toBeGreaterThan(40);
      expect(audit.guarded).toBeGreaterThan(5);
      expect(audit.gaps).toEqual([]);
      expect(audit.differing).toEqual([]);
    }, 180_000);

    it("does the same for hunting-grounds exits, including the switch-guarded ones", () => {
      for (const rounds of [2, 4]) {
        const audit = auditRoadExits(createMonsterHuntingGrounds({ rounds }));
        expect(audit.checked, `rounds ${rounds}`).toBeGreaterThan(20);
        expect(audit.guarded, `rounds ${rounds}`).toBeGreaterThan(0);
        expect(audit.gaps, `rounds ${rounds}`).toEqual([]);
        expect(audit.differing, `rounds ${rounds}`).toEqual([]);
      }
    }, 180_000);

    it("guards all 14 north edge tiles of the first hunting field with the mx_rival_2 lock (c1)", () => {
      const { project } = createMonsterHuntingGrounds({ rounds: 2 });
      const field = project.maps["mx_map_ground_1"]!;
      const toLast = field.events.filter((e) => e.id.startsWith("mx_map_ground_1_to_mx_map_ground_2") && JSON.stringify(e.pages?.[0]?.commands).includes('"mapId":"mx_map_ground_2"'));
      const north = toLast.filter((e) => e.y === 0);
      expect(north.map((e) => e.x).sort((a, b) => a - b)).toEqual(Array.from({ length: 14 }, (_, i) => 6 + i));
      for (const e of toLast) expect(JSON.stringify(e.pages![0]!.commands)).toContain('"switchId":"mx_rival_2"');
    }, 180_000);

    it("gives both columns of the start town north road the school transfer", () => {
      const { project } = createMonsterExpedition();
      const home = project.maps["mx_map_home"]!;
      for (const x of [10, 11]) {
        expect(home.events.some((e) => e.x === x && e.y === 1 && JSON.stringify(e.pages ?? e.commands).includes('"mapId":"mx_map_school"'))).toBe(true);
      }
    }, 180_000);
  });
});

describe("monsterFieldItems", () => {
  isolateTimers();
  /** 풀→불 두 단계 진화(레벨 5, 레벨 8)와 돌 진화 한 갈래를 가진 최소 몬스터 프로젝트. */
  function fieldItemProject(): Project {
    const project = createBlankProject();
    project.system.monsterCollection = true;
    project.system.battleParty = "monsters";
    const base = project.database.monsterSpecies.find((entry) => entry.id === "species_wild_slime");
    if (!base) throw new Error("missing slime");
    const clone = (id: string, name: string) => ({ ...structuredClone(base), id, name, evolutions: [] as typeof base.evolutions });
    const first = { ...clone("species_first", "첫째"), evolutions: [{ toSpeciesId: "species_second", requires: { level: 5 } }, { toSpeciesId: "species_stone_form", requires: { itemId: "item_test_stone" } }] };
    const second = { ...clone("species_second", "둘째"), evolutions: [{ toSpeciesId: "species_third", requires: { level: 8 } }] };
    project.database.monsterSpecies.push(first, second, clone("species_third", "셋째"), clone("species_stone_form", "돌모습"));
    project.database.items.push(
      normalizeItemRecord({ id: "item_test_candy", name: "시험 사탕", scope: "none", price: 10, type: "special", occasion: "field", consumable: true, careProfile: { kind: "feed", friendshipDelta: 0, levelUp: 3 } }),
      normalizeItemRecord({ id: "item_test_stone", name: "시험 돌", scope: "none", price: 10, type: "normalGoods", occasion: "field", consumable: true }),
      normalizeItemRecord({ id: "item_test_ether", name: "시험 에테르", scope: "ally", price: 10, type: "medicine", occasion: "field", consumable: true, ppRecovery: { flat: 10, percentMax: 0 } }),
    );
    return project;
  }
  function giveFirst(project: Project, level: number) {
    const session = startSession(project, 1);
    const gift = giveMonster(project, session, { speciesId: "species_first", level });
    if (!gift.ok) throw new Error("give failed");
    return { session, id: gift.instance.instanceId };
  }
  describe("rare candy (careProfile.levelUp)", () => {
    it("previews the level range and the evolution chain without changing the session", () => {
      const project = fieldItemProject();
      const { session, id } = giveFirst(project, 4);
      session.inventory.item_test_candy = 1;
      const item = project.database.items.find((entry) => entry.id === "item_test_candy")!;
      const before = structuredClone(session.monsterInstances[id]);
      const preview = previewCareItem(project, session, item, id);
      expect(preview.reason).toBeUndefined();
      // previewCareItem (#2707) names the fields level / levelAfter / evolveToSpeciesIds; this test was written against a draft shape.
      expect(preview).toMatchObject({ level: 4, levelAfter: 7 });
      expect(preview.evolveToSpeciesIds).toEqual(["species_second"]);
      expect(session.monsterInstances[id]).toEqual(before);
      expect(session.inventory.item_test_candy).toBe(1);
    });

    it("raises levels and chains evolutions, consuming one candy", () => {
      const project = fieldItemProject();
      const { session, id } = giveFirst(project, 6);
      session.inventory.item_test_candy = 2;
      const result = applyCareItem(project, session, { itemId: "item_test_candy", instanceId: id });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.levelAfter).toBe(9);
      expect(result.evolutions.map((entry) => entry.toSpeciesId)).toEqual(["species_second", "species_third"]);
      expect(session.monsterInstances[id]?.speciesId).toBe("species_third");
      expect(session.inventory.item_test_candy).toBe(1);
    });

    it("is rejected at the level cap without consuming the item", () => {
      const project = fieldItemProject();
      const { session, id } = giveFirst(project, 99);
      session.inventory.item_test_candy = 1;
      const result = applyCareItem(project, session, { itemId: "item_test_candy", instanceId: id });
      expect(result).toMatchObject({ ok: false, reason: "maxLevel" });
      expect(session.inventory.item_test_candy).toBe(1);
    });
  });
  describe("evolution stone from the field menu", () => {
    it("is derived from evolutions[].requires.itemId, not from a flag", () => {
      const project = fieldItemProject();
      const stone = project.database.items.find((entry) => entry.id === "item_test_stone")!;
      const potion = project.database.items.find((entry) => entry.id === "item_potion")!;
      expect(isEvolutionStone(project, stone)).toBe(true);
      expect(itemAllowsFieldMenu(project, stone)).toBe(true);
      expect(isEvolutionStone(project, potion)).toBe(false);
    });

    it("evolves a compatible monster and keeps the stone when nothing happens", () => {
      const project = fieldItemProject();
      const { session, id } = giveFirst(project, 3);
      const other = giveMonster(project, session, { speciesId: "species_third", level: 3 });
      if (!other.ok) throw new Error("give failed");
      session.inventory.item_test_stone = 1;
      const stone = project.database.items.find((entry) => entry.id === "item_test_stone")!;

      expect(previewEvolutionStoneTarget(project, session, stone, id).toName).toBe("돌모습");
      expect(previewEvolutionStoneTarget(project, session, stone, other.instance.instanceId).reason).toBeTruthy();

      const none = useItemFromMenu(project, session, "item_test_stone", undefined, other.instance.instanceId);
      expect(none.kind).not.toBe("used");
      expect(session.inventory.item_test_stone).toBe(1);

      const used = useItemFromMenu(project, session, "item_test_stone", undefined, id);
      expect(used.kind).toBe("used");
      expect(session.monsterInstances[id]?.speciesId).toBe("species_stone_form");
      expect(session.inventory.item_test_stone ?? 0).toBe(0);
      if (used.kind === "used") expect(used.evolutions?.[0]?.toSpeciesId).toBe("species_stone_form");
    });
  });
  describe("bag pockets", () => {
    it("classifies from item fields with an optional override", () => {
      const project = fieldItemProject();
      const find = (id: string) => project.database.items.find((entry) => entry.id === id)!;
      expect(bagPocketOf(project, find("item_potion"))).toBe("items");
      expect(bagPocketOf(project, find("item_test_stone"))).toBe("items");
      const ball = normalizeItemRecord({ id: "item_ball", name: "볼", scope: "enemy", price: 1, type: "special", occasion: "battle", captureProfile: { multiplier: 1 } });
      expect(bagPocketOf(project, ball)).toBe("balls");
      const held = normalizeItemRecord({ id: "item_held", name: "지닐", scope: "none", price: 1, type: "normalGoods", heldEffect: { kind: "regen", percent: 6 } });
      expect(bagPocketOf(project, held)).toBe("held");
      expect(bagPocketOf(project, { ...find("item_potion"), pocket: "key" })).toBe("key");
    });

    it("steps through the pockets and wraps at both ends", () => {
      expect(BAG_POCKETS.map((pocket) => pocket.id)).toEqual(["items", "balls", "machines", "held", "key"]);
      expect(stepBagPocket("items", -1)).toBe("key");
      expect(stepBagPocket("key", 1)).toBe("items");
    });

    it("counts kinds per pocket and filters the list by pocket in monster games only", () => {
      const project = fieldItemProject();
      const session = startSession(project, 1);
      session.inventory = { item_potion: 2, item_test_stone: 1 };
      expect(bagPocketCounts(project, session.inventory)).toMatchObject({ items: 2, balls: 0 });
      const entries = ["item_potion", "item_test_stone"].map((id) => ({ label: id, value: "1개", testId: `status-menu-item-${id}` }));
      const items = inventoryViewEntries(entries, project, session, { filter: "all", sort: "default", pocket: "items" });
      expect(items.map((entry) => entry.testId)).toContain("status-menu-item-item_potion");
      const balls = inventoryViewEntries(entries, project, session, { filter: "all", sort: "default", pocket: "balls" });
      expect(balls.map((entry) => entry.testId)).toContain("inventory-pocket-empty");

      const other = createBlankProject();
      const otherSession = startSession(other, 1);
      otherSession.inventory = { item_potion: 1 };
      const rows = inventoryViewEntries([{ label: "포션", value: "1개", testId: "status-menu-item-item_potion" }], other, otherSession, { filter: "all", sort: "default", pocket: "balls" });
      expect(rows.map((entry) => entry.testId)).toContain("inventory-filter");
    });
  });
  describe("assistant upsert_item schema", () => {
    it("keeps careProfile.levelUp, ppRecovery and pocket, coercing the item type so they take effect", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      const candy = runTool(ctx, "upsert_item", { item: { id: "item_q_candy", name: "사탕", careProfile: { kind: "feed", friendshipDelta: 0, levelUp: 1 }, pocket: "items" } }, { dryRun: false });
      expect(candy.ok, JSON.stringify(candy.issues)).toBe(true);
      const saved = ctx.project.database.items.find((entry) => entry.id === "item_q_candy")!;
      expect(saved.type).toBe("special");
      expect(saved.careProfile?.levelUp).toBe(1);
      expect(saved.pocket).toBe("items");

      const ether = runTool(ctx, "upsert_item", { item: { id: "item_q_ether", name: "에테르", ppRecovery: { flat: 10, percentMax: 0 } } }, { dryRun: false });
      expect(ether.ok, JSON.stringify(ether.issues)).toBe(true);
      const savedEther = ctx.project.database.items.find((entry) => entry.id === "item_q_ether")!;
      expect(savedEther.type).toBe("medicine");
      expect(savedEther.ppRecovery?.flat).toBe(10);
    });

    it("omits the optional pocket field from untouched records", () => {
      const ctx: ToolContext = { project: createBlankProject() };
      runTool(ctx, "upsert_item", { item: { id: "item_potion", price: 120 } }, { dryRun: false });
      expect("pocket" in ctx.project.database.items.find((entry) => entry.id === "item_potion")!).toBe(false);
    });
  });
  describe("monster expedition field items", () => {
    it("ships revive, rare candy and stones with evolution paths and a start gift", () => {
      const { project } = createMonsterExpedition();
      const ids = new Set(project.database.items.map((item) => item.id));
      for (const id of ["mx_revive", "mx_candy", ...EXPEDITION_STONE_IDS]) expect(ids.has(id), id).toBe(true);
      const stoneTargets = project.database.monsterSpecies.flatMap((species) => species.evolutions ?? []).map((evolution) => evolution.requires?.itemId).filter(Boolean);
      for (const id of EXPEDITION_STONE_IDS) expect(stoneTargets).toContain(id);
      const revive = project.database.items.find((item) => item.id === "mx_revive")!;
      expect(revive.onlyEffectiveOnDeadActors).toBe(true);
    });
  });
});

// 몬스터 마을 ⑤ 트레이너 전투 소개 그림 — 캠페인·place_trainer 가 번들 trainerSprite 를 배정한다.
// 이 파일은 에이전트 세션 규칙으로 작성 시점에는 실행하지 않았다(감독자가 게이트에서 돌린다).
describe("monsterTownTrainerArt", () => {
  isolateTimers();
  const bundled = JSON.parse(readFileSync(resolve("public/assets/battle-trainers/index.json"), "utf8")) as { trainers: Record<string, unknown> };
  const roles = new Set(Object.keys(bundled.trainers));
  describe("trainerArt", () => {
    it("배정하는 모든 역할은 번들 public/assets/battle-trainers 에 실제로 있다", () => {
      const used = new Set<string>([EXPEDITION_HERO_BACK, "hero_f_front"]);
      for (const key of ["water", "dojo", "grass", "fire", "psychic", "ice", "ghost", "dragon", "unknown"]) used.add(gymLeaderArt(key));
      for (const type of ["water", "ice", "rock", "ground", "fighting", "steel", "normal", "grass", "bug", "fire", "dark", "poison", "ghost", "psychic", "electric", "fairy", "dragon", "flying", undefined]) used.add(typeArt(type));
      for (let i = 0; i < 8; i++) used.add(expeditionTrainerFront(`grunt_${i}`, "부하")!);
      for (const role of used) expect(roles.has(role), role).toBe(true);
    });

    it("관장·두목·라이벌·부하·회사원 접미사마다 그림이 정해진다", () => {
      expect(expeditionTrainerFront("leader", "관장", "gym_water")).toBe("gym_water");
      expect(expeditionTrainerFront("boss", "두목")).toBe("punk");
      expect(expeditionTrainerFront("rival", "라이벌")).toBe("hero_f_front");
      expect(expeditionTrainerFront("company_2", "연구원")).toBe("scientist");
      expect(expeditionTrainerFront("grunt_0", "부하")).toBeTruthy();
      expect(expeditionTrainerFront("trainer_0", "낚시꾼 하루")).toBe("fisher");
      expect(expeditionTrainerFront("unknown_suffix", "누군가")).toBeUndefined();
    });

    it("이름 말로 번들 역할을 고르고, 근거가 없으면 지어내지 않는다", () => {
      expect(inferTrainerRoleFromName("곤충채집 소년")).toBe("bug_catcher");
      expect(inferTrainerRoleFromName("등산가 철수")).toBe("hiker");
      expect(inferTrainerRoleFromName("연구원 민")).toBe("scientist");
      expect(inferTrainerRoleFromName("김철수")).toBeUndefined();
    });
  });
});

describe("monsterTrainerArt", () => {
  isolateTimers();
  // 시각 QA D03: 캠페인 트레이너 troop 이 인물 그림 없이 만들어져 전투에 사람이 없었다.
  const bundled = JSON.parse(readFileSync('public/assets/battle-trainers/index.json', 'utf8')).trainers as Record<string, { front?: string; back?: string }>;
  describe('monster campaign trainer pictures', () => {
    const { project } = createMonsterExpedition({});
    const trainers = project.database.troops.filter(t => t.trainerBattle);

    it('gives every trainer troop a bundled front picture and the hero back picture', () => {
      expect(trainers.length).toBeGreaterThan(40);
      for (const troop of trainers) {
        expect(troop.trainerSprite, troop.id).toBeDefined();
        expect(bundled[troop.trainerSprite!.front]?.front, `${troop.id} front`).toBeTruthy();
        expect(bundled[troop.trainerSprite!.back ?? '']?.back, `${troop.id} back`).toBeTruthy();
      }
      expect(bundled[TRAINER_HERO_BACK]?.back).toBeTruthy();
    });

    it('leaves wild troops without trainer pictures', () => {
      for (const troop of project.database.troops.filter(t => !t.trainerBattle)) expect(troop.trainerSprite).toBeUndefined();
    });

    it('puts different faces on the gym leaders and the elite four', () => {
      const faces = (re: RegExp) => trainers.filter(t => re.test(t.id)).map(t => t.trainerSprite!.front);
      const leaders = faces(/gym_leader$/u);
      expect(leaders.length).toBe(8);
      expect(new Set(leaders).size).toBeGreaterThanOrEqual(6);
      const elite = trainers.filter(t => /league_\d_league_challenge$/u.test(t.id) && !/챔피언/u.test(t.name)).map(t => t.trainerSprite!.front);
      expect(new Set(elite).size).toBe(elite.length);
    });

    it('uses the water and rock gym pictures for the matching leaders', () => {
      const byType = (town: string) => trainers.find(t => t.id === `mx_troop_mx_map_${town}_gym_leader`)!.trainerSprite!.front;
      expect(byType('harbor')).toBe('gym_water');
      expect(byType('dune')).toBe('gym_rock');
    });
  });
});
