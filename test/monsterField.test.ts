import { describe, expect, it } from "vitest";
import { createMonsterExpedition } from "@/project/examples/monsterExpedition";
import templateData from "@/project/examples/monsterExpedition/mapTemplates.json";
import { maxTemplateOverlap, templateOverlap, TEMPLATE_COPY_GATE, type OverlapGrid } from "@/project/mapTemplateOverlap";
import { canMove, layeredPassability } from "@/project/collision";
import { caveRimDefects, fieldGeneratorInternals, hallFrameDefects, type FieldTemplate } from "@/project/examples/monsterExpedition/fieldGenerator";
import type { GameMap, Project } from "@/project/types";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { normalizeItemRecord } from "@/project/databaseRecordModel";
import { applyCareItem, previewCareItem } from "@/project/monsterCare";
import { giveMonster } from "@/project/monsterCollection";
import { isEvolutionStone, itemAllowsFieldMenu } from "@/project/monsterEvolutionItems";
import { startSession } from "@/project/session";
import { BAG_POCKETS, bagPocketCounts, bagPocketOf, stepBagPocket } from "@/player/playerBagPockets";
import { inventoryViewEntries } from "@/player/playerInventoryView";
import { previewEvolutionStoneTarget, useItemFromMenu } from "@/player/playerItemUse";
import { runTool } from "@/editor/tools/toolRunner";
import { EXPEDITION_STONE_IDS } from "@/project/examples/monsterExpedition/roster";
import type { ToolContext } from "@/editor/tools/types";
import { isolateTimers } from "./mergedTeardown";

// 몬스터 원정 길·필드·던전 맵 생성기: 견본을 칸 그대로 옮기지 않고(겹침 관문), 씨앗마다 다른 판을 짜며, 입구에서 모든 사람·문에 걸어 닿는다.
// 예전 make() 는 견본을 복사해 기본 캠페인 필드·던전 17맵 중 16맵이 견본과 93~100% 같았다(2026-11-22 분석).
// 작성만 했고 실행하지 않았다(워크트리 규칙) — CI 에서 돈다.
describe("monsterFieldGenerator", () => {
  isolateTimers();
  type Built = { project: Project; manifest: { maps: { id: string; role: string; template: string; entry: { x: number; y: number } }[] } };
  const templates = templateData as unknown as Record<string, OverlapGrid>;
  const grid = (m: GameMap): OverlapGrid => ({ width: m.width, height: m.height, lower: m.lowerTiles, tilesetId: m.tilesetId });
  const fieldMaps = ({ manifest }: Built) => manifest.maps.filter((m) => m.role === "field" || m.role === "dungeon");
  /** 입구에서 사람(막힌 이벤트) 칸을 피해 걸어 닿지 못하는 이벤트(자동 실행 제외). */
  function unreachable(project: Project, map: GameMap, entry: { x: number; y: number }): string[] {
    const key = (x: number, y: number) => `${x},${y}`;
    const solid = new Set(map.events.filter((e) => e.pages?.[0]?.overlapForbidden).map((e) => key(e.x, e.y)));
    const seen = new Set([key(entry.x, entry.y)]), queue = [entry];
    for (let n = 0; n < queue.length; n++) {
      const p = queue[n]!;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
        const q = { x: p.x + dx, y: p.y + dy };
        if (!seen.has(key(q.x, q.y)) && !solid.has(key(q.x, q.y)) && canMove(project, map, p.x, p.y, q.x, q.y)) { seen.add(key(q.x, q.y)); queue.push(q); }
      }
    }
    return map.events.filter((e) => e.pages?.[0]?.trigger?.kind !== "auto")
      .filter((e) => !seen.has(key(e.x, e.y)) && ![[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => seen.has(key(e.x + dx!, e.y + dy!))))
      .map((e) => e.id);
  }
  describe("monster expedition field generator", () => {
    it("does not copy a reference template into any route, side area or dungeon", () => {
      const built = createMonsterExpedition() as unknown as Built;
      const maps = fieldMaps(built);
      expect(maps.length).toBe(17);
      const copies = maps.map((m) => ({ id: m.id, hit: maxTemplateOverlap(grid(built.project.maps[m.id]!), templates)! }))
        .filter(({ hit }) => hit.overlap >= TEMPLATE_COPY_GATE).map(({ id, hit }) => `${id}≈${hit.key} ${Math.round(hit.overlap * 100)}%`);
      expect(copies).toEqual([]);
    }, 180_000);

    it("lets the player walk from each entrance to every trainer, sign and exit", () => {
      for (const mapSeed of [0, 1]) {
        const built = createMonsterExpedition({ mapSeed }) as unknown as Built;
        const blocked = fieldMaps(built).flatMap((m) => unreachable(built.project, built.project.maps[m.id]!, m.entry));
        expect(blocked, `mapSeed ${mapSeed}`).toEqual([]);
      }
    }, 180_000);

    // 큰 방(밤막회사·유적·탑) 천장이 조각나고(이웃 점수로 테두리 조각을 골랐다) 동굴 테두리 아래 줄이 귀퉁이 그림으로 채워지던 판(2026-11-23).
    it("draws hall ceilings and cave rims by the template's frame rule", () => {
      const ruled = new Set<string>();
      for (const mapSeed of [0, 1]) {
        const built = createMonsterExpedition({ mapSeed }) as unknown as Built;
        const bad: string[] = [];
        for (const m of fieldMaps(built)) {
          const map = built.project.maps[m.id]!, tileset = built.project.tilesets[map.tilesetId]!;
          const L = fieldGeneratorInternals.learn(tileset, (templateData as unknown as Record<string, FieldTemplate>)[m.template]!);
          const walk = (x: number, y: number) => {
            if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
            const i = y * map.width + x, p = layeredPassability(tileset, [map.lowerTiles[i]!, -1, map.upperTiles[i] ?? -1, -1]);
            return p.up || p.down || p.left || p.right;
          };
          if (L.frame) { ruled.add(`${m.id}:frame`); bad.push(...hallFrameDefects(L.frame, map.width, map.height, map.lowerTiles).map((d) => `${m.id} ${d.x},${d.y} ${d.tile}->${d.want}`)); }
          if (L.rim) { ruled.add(`${m.id}:rim`); bad.push(...caveRimDefects(L.rim, map.width, map.height, map.lowerTiles, walk).map((d) => `${m.id} ${d.x},${d.y} ${d.tile}->${d.want}`)); }
        }
        expect(bad, `mapSeed ${mapSeed}`).toEqual([]);
      }
      // 검사가 빈손으로 통과하지 않게: 큰 방 넷·동굴 셋에서 규칙을 찾아야 한다.
      // 얼음 동굴(dungeon/ice_cave)은 #4934 때부터 테두리 규칙을 배우지 못한다 — 견본의 한 변 이상에 안쪽 두 줄까지 막힌
      // 테두리 칸이 2개 미만이라 learnRim 이 undefined 를 돌려준다(그 커밋 e19f13f 와 지금 main 에서 같은 결과, ci-full 45149079696).
      // 얼음 동굴은 테두리를 다시 칠하지 않고 생성기 그림 그대로 둔다. 테두리를 배우게 하는 것은 따로 고친다.
      expect([...ruled].sort()).toEqual(["mx_map_cave:rim", "mx_map_ghost_tower:frame", "mx_map_hideout:frame", "mx_map_lava_cave:rim", "mx_map_observatory:frame", "mx_map_ruins:frame", "mx_map_sea_cave:rim"]);
    }, 180_000);

    it("counts a hall ceiling cell whose edge line faces the wrong way", () => {
      const built = createMonsterExpedition() as unknown as Built;
      const m = fieldMaps(built).find((x) => x.id === "mx_map_hideout")!;
      const map = built.project.maps[m.id]!;
      const L = fieldGeneratorInternals.learn(built.project.tilesets[map.tilesetId]!, (templateData as unknown as Record<string, FieldTemplate>)[m.template]!);
      const f = L.frame!;
      const i = map.lowerTiles.findIndex((v) => v === f.l);
      expect(i).toBeGreaterThanOrEqual(0);
      const broken = [...map.lowerTiles];
      broken[i] = f.r;
      expect(hallFrameDefects(f, map.width, map.height, broken).map((d) => d.y * map.width + d.x)).toEqual([i]);
    }, 180_000);

    it("builds a different layout for a different seed", () => {
      const a = createMonsterExpedition({ mapSeed: 0 }) as unknown as Built;
      const b = createMonsterExpedition({ mapSeed: 1 }) as unknown as Built;
      for (const m of fieldMaps(a)) {
        const overlap = templateOverlap(grid(a.project.maps[m.id]!), grid(b.project.maps[m.id]!)).overlap;
        expect(overlap, m.id).toBeLessThan(0.5);
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
