import { describe, expect, it, vi } from "vitest";
import catalog from "@/assets/beodeulMassingCatalog.json";
import { BUNDLED_EASYRPG_CHIPSET_ASSETS, bundledChipsetFrameCount, chipsetAnimationKey, TEX_TILESET } from "@/assets/bundled";
import { createBlankProject } from "@/project/defaults/blankProject";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { createBeodeulMassingTileset } from "@/project/defaults/beodeulMassing";
import { AUTHOR_BEODEUL_TOWN_TOOL } from "@/editor/tools/authorBeodeulTown";
import { layerTileAt } from "@/project/mapLayers";
import { canMove } from "@/project/collision";
import { runTool } from "@/editor/tools";
import { caveMouthSpotClear, pickDungeonGateSpot } from "@/editor/tools/dungeonLinkTools";
import type { ToolContext } from "@/editor/tools/types";
import type { GameMap, Project, SkillRecord } from "@/project/types";
import { battlerSkillIdsWithGrants } from "@/battle/battleSkillUse";
import { resolveRetroClassChoreography, resolveRetroMonsterChoreography } from "@/assets/retroSkillCatalog";
import { createBattleRuntime, exploitBonusPercent } from "@/battle/runtime";
import { normalizeSkillRecord, normalizeStateRecord, normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { skillHelpTags } from "@/battle/skillHelp";
import { deserialize, serialize } from "@/project/io/serialize";
import { predictSkillDamageFor } from "@/battle/battlePredict";
import { chooseAutoBattleCommand } from "@/battle/battleAuto";
import type { BattleFlow, BattleRuntimeOptions } from "@/battle/types";
import { resolveBattlerAuras, resolveStateAura } from "@/assets/battleStateAuras";
import { normalizeBattleBackdropLayers, resolvedBattleBackdropLayer } from "@/project/battleBackdropLayers";
import { cellTransformFields, normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { normalizeEnemyRecord, normalizeTroopRecord } from "@/project/databaseEnemyTroopRecordModel";
import { normalizeDisplayFilter } from "@/project/displayFilter";
import { normalizeEnemyCollapseEffect } from "@/project/enemyCollapse";
import { automaticCharacterScale, characterRenderScale, mapCharacterScale } from "@/project/characterScale";
import { syncPlayerCharacterScale } from "@/player/playerCharacterScale";
import { eventSpriteScale, isCharsetSpriteTexture, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { store } from "@/project/store";
import { compileCutscene } from "@/editor/cutscene";
import { isolateTimers } from "./mergedTeardown";
import { animationFrameForTile, animationKeyForTile, animationStripForTile, CHIPSET_ANIMATION_FPS, WATERFALL_ANIMATION_FPS } from "@/project/defaults/chipsetAnimation";

describe("beodeulMassingTileset", () => {
  isolateTimers();
  /**
   * building-kit massing(bk-massing-100 → 손 도트 건물)의 공용 번들: 위임 허용한 건물만 든 시트가
   * 모든 새 프로젝트에 있고, beodeul_city 에 키트·통행이 이식되어 조수가 bd-house-mk-* 로 놓을 수 있다.
   */
  describe("beodeul_massing bundle", () => {
    const buildings = catalog.buildings as { id: string; width: number; height: number; rows: number[][]; blocked: number[][]; parts: { dx: number; dy: number; w: number; h: number }[] }[];

    it("번들 자산과 칸 수가 카탈로그와 같다", () => {
      expect(BUNDLED_EASYRPG_CHIPSET_ASSETS.some((a) => a.textureKey === "tex_beodeul_massing")).toBe(true);
      expect(bundledChipsetFrameCount("tex_beodeul_massing")).toBe(catalog.count);
      expect(buildings.length).toBeGreaterThan(0);
    });

    it("새 프로젝트가 시트를 갖고, beodeul_city 에 건물 키트(본체·그림자·기초)가 이식된다", () => {
      const p = createBlankProject();
      expect(p.tilesets.beodeul_massing?.count).toBe(catalog.count);
      const city = p.tilesets.beodeul_city!;
      for (const b of buildings) {
        const kid = b.id.slice("bd-house-mk-".length);
        const body = city.structureKits!.find((k) => k.id === b.id)!;
        expect(body, b.id).toBeTruthy();
        expect([body.width, body.height]).toEqual([b.width, b.height]);
        expect(city.structureKits!.some((k) => k.id === `bd-mk-shadow-${kid}`)).toBe(true);
        expect(city.structureKits!.some((k) => k.id === `bd-mk-foundation-${kid}`)).toBe(true);
        // 이식된 칸의 통행: 막힌 칸은 막히고, 처마(그림 있는 나머지)는 열려 있다
        const blocked = new Set(b.blocked.map(([x, y]) => `${x},${y}`));
        for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) {
          const n = body.rows[y]!.upperTiles![x]!;
          if (n < 0) continue;
          const pass = city.passability[n]!;
          expect(pass.up && pass.down && pass.left && pass.right, `${b.id} ${x},${y}`).toBe(!blocked.has(`${x},${y}`));
        }
        // 문 하나, 문 아랫칸 = 그 문 아래 땅선(groundLines). 앞이 들어간 ㄷ자 건물(manor, #3514)은 가운데 땅선이 맨 아랫줄보다 한 줄 위다.
        expect(body.parts?.length).toBe(1);
        const d = b.parts[0]!;
        const lines = (b as { groundLines: number[][] }).groundLines;
        expect(lines.some(([x0, x1, y]) => d.dx >= x0! && d.dx + d.w - 1 <= x1! && y === d.dy + d.h - 1), b.id).toBe(true);
      }
    });

    it("옛 프로젝트(시트 없음)도 ensureBundledTilesets 로 받는다", () => {
      const p = createBlankProject();
      delete p.tilesets.beodeul_massing;
      const city = p.tilesets.beodeul_city!;
      city.structureKits = city.structureKits!.filter((k) => !k.id.startsWith("bd-house-mk-") && !k.id.startsWith("bd-mk-"));
      expect(ensureBundledTilesets(p)).toBe(true);
      expect(p.tilesets.beodeul_massing?.count).toBe(catalog.count);
      expect(p.tilesets.beodeul_city!.structureKits!.filter((k) => k.id.startsWith("bd-house-mk-")).length).toBe(buildings.length);
    });

    it("키트 설명이 위임 허용 출처를 말한다(사람 클릭으로 적지 않는다)", () => {
      const ts = createBeodeulMassingTileset();
      const k = ts.structureKits!.find((x) => x.id.startsWith("bd-house-mk-"))!;
      expect(k.ai?.description).toContain("사용자 위임");
      expect(k.ai?.tags).not.toContain("사람이 허용");
    });

    it("조수 도구 author_beodeul_town roofs medieval 이 검수 통과 건물을 그림자·기초와 함께 놓는다", () => {
      const p = createBlankProject();
      const r = AUTHOR_BEODEUL_TOWN_TOOL.run(p as never, { roofs: "medieval", theme: "river", width: 64, height: 48, seed: 7 }) as { data: { mapId: string; roofs: string; doors: { kit: string; x: number; y: number; reached: boolean }[] } };
      expect(r.data.roofs).toBe("medieval");
      const mk = r.data.doors.filter((d) => d.kit.startsWith("bd-house-mk-"));
      expect(mk.length).toBeGreaterThan(0);
      expect(mk.every((d) => d.reached)).toBe(true);
      const m = p.maps[r.data.mapId]!;
      const city = p.tilesets.beodeul_city!;
      const shadowTiles = new Set(city.structureKits!.filter((k) => k.id.startsWith("bd-mk-shadow-")).flatMap((k) => k.rows.flatMap((row) => row.upperTiles ?? [])).filter((t) => t >= 0));
      let shadow = 0;
      for (let i = 0; i < m.width * m.height; i++) if (shadowTiles.has(layerTileAt(m, 2, i))) shadow++;
      expect(shadow).toBeGreaterThan(0);
    });
  });
});

// 마을이 남기는 터(2026-11-15 명세 은행 전/후 — r3b-fun «버들마을»: 집을 마당 둘레로 모으자 광산 입구가 설 바탕 땅이 사라져 출입구가 맵 테두리 칸으로 밀려났고,
// 강 건너에 서 있던 집과 그 다리가 같이 사라졌다).
//  - 굴 입구 자리: 길 곁의 한 단 빈 땅 3×4 를 비워 둔다 — 던전 잇기(pickDungeonGateSpot)가 갱구를 세울 수 있다.
//  - 떨어진 터: 예전 고리 배치가 강 건너나 다른 단에 집·일터를 두었으면 그 터에 하나는 남긴다 — 문까지 걸어 닿는다(다리가 놓인다).
describe("beodeulVillageSites", () => {
  isolateTimers();
  type Data = { mapId: string; houses: number; entrance: { x: number; y: number }; doors: { kit: string; x: number; y: number; reached: boolean }[]; gateNooks?: { x: number; y: number }[];
    layout?: { yard?: { x0: number; y0: number; x1: number; y1: number; frame: { role: string; at: string }[]; apart: { x: number; y: number; role: string; why: string }[] } } };
  /** 명세 은행 r3b-fun 의 «버들마을» 이 받는 인자(강가 마을 38×48, 집 셋) — 강이 남동쪽 터를 갈라 놓는다. */
  const BEODEUL = { theme: "river", water: "river", houseCount: 3, forestType: "broadleaf", width: 38, height: 48, seed: 68900, name: "버들마을" } as const;
  const BEODEUL_KEY = JSON.stringify(["project", "154683ba-d3cf-4df7-93d2-14f4960debac"]);
  function town(args: Record<string, unknown>, key?: string): { project: Project; map: GameMap; data: Data } {
    const project = createBlankProject() as Project; ensureBundledTilesets(project);
    const ctx = { project, currentMapId: project.startMapId, ...(key ? { assistantRun: true, lookKey: key } : {}) } as ToolContext;
    const res = runTool(ctx, "author_beodeul_town", args);
    expect(res.ok, res.summary).toBe(true);
    const data = res.data as unknown as Data;
    return { project: ctx.project, map: ctx.project.maps[data.mapId]!, data };
  }
  /** 입구에서 엔진 걸음으로 닿는 칸. */
  function reached(project: Project, map: GameMap, from: { x: number; y: number }): Uint8Array {
    const W = map.width, H = map.height, seen = new Uint8Array(W * H), q = [from.y * W + from.x];
    seen[q[0]!] = 1;
    for (let h = 0; h < q.length; h += 1) { const c = q[h]!, x = c % W, y = (c - x) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ny * W + nx] || !canMove(project, map, x, y, nx, ny)) continue; seen[ny * W + nx] = 1; q.push(ny * W + nx); } }
    return seen;
  }
  describe("마을은 굴 입구가 설 자리를 길 곁에 남긴다", () => {
    it.each([
      ["강가 마을(은행 r3b-fun 버들마을)", BEODEUL, BEODEUL_KEY],
      ["언덕 마을", { theme: "river", seed: 11, houseCount: 4, landform: "hill" }, undefined],
      ["포구", { theme: "coast", seed: 5, houseCount: 4 }, undefined],
    ] as const)("%s: 남긴 자리에 갱구가 서고, 던전 잇기가 테두리 칸이 아니라 그 자리를 고른다", (_name, args, key) => {
      const { project, map, data } = town({ ...args }, key);
      const nooks = data.gateNooks ?? [];
      expect(nooks.length).toBeGreaterThanOrEqual(1);
      const seen = reached(project, map, data.entrance);
      for (const g of nooks) {
        expect(caveMouthSpotClear(project, map, g), `(${g.x},${g.y}) 에 갱구(3×4)가 선다`).toBe(true);
        expect(seen[g.y * map.width + g.x], `(${g.x},${g.y}) 문 칸에 걸어 닿는다`).toBe(1);
      }
      const at = pickDungeonGateSpot(project, map, (c) => c.x);
      expect(at?.why).toBe("갱구 자리·길 곁");
      expect(at!.x > 0 && at!.y > 0 && at!.x < map.width - 1 && at!.y < map.height - 1, "던전 문은 맵 테두리 칸이 아니다").toBe(true);
    }, 240_000);
  });
  describe("집을 마당 둘레로 모아도 강 건너 터를 비우지 않는다", () => {
    it("은행 r3b-fun 버들마을: 건물 하나가 강 건너에 남고 그 문까지 걸어 닿는다 — 마당에는 여관과 집 둘 이상이 문을 낸다", () => {
      const { project, map, data } = town({ ...BEODEUL }, BEODEUL_KEY);
      const yard = data.layout?.yard;
      expect(yard, "마당 배치").toBeTruthy();
      const far = yard!.apart.filter((a) => a.why === "bank");
      expect(far.length).toBe(1);
      // 강 건너에 남는 것은 예전 고리 배치가 거기 두었던 건물이다. 열쇠 없는 마을에서는 집이고, 이 게임 열쇠는 마을 종류(나무꾼 야영지)를 골라
      // 그 종류의 일터 건물(오두막)이 강 건너에 서고 집 셋이 모두 마당에 문을 낸다(editor/tools/beodeulVillageKinds.ts). 지키는 것은 «강 건너 터가 비지 않고 그 문에 걸어 닿는다» 다.
      expect(["house", "work"]).toContain(far[0]!.role);
      const seen = reached(project, map, data.entrance);
      expect(seen[far[0]!.y * map.width + far[0]!.x], "강 건너 집의 문 앞에 걸어 닿는다(다리)").toBe(1);
      expect(data.doors.filter((d) => !d.reached)).toEqual([]);
      expect(yard!.frame.filter((f) => f.at === "yard").length).toBeGreaterThanOrEqual(3);
      expect(data.houses).toBe(3);
    }, 240_000);
  });
});

describe("blankProject", () => {
  isolateTimers();
  describe("battleChoreographyAuditRegressions", () => {
    isolateTimers();
    describe("battle choreography audit identity", () => {
      it("keeps own class and monster contracts ahead of cross-kind borrowed fields", () => {
        const actor = { id: "skill_ranger_snipe", retroChoreographyId: "skill_mon_acid_spit" };
        const monster = { id: "skill_mon_acid_spit", retroChoreographyId: "skill_ranger_snipe" };
        expect(resolveRetroClassChoreography(actor)?.id).toBe(actor.id);
        expect(resolveRetroMonsterChoreography(actor)).toBeUndefined();
        expect(resolveRetroMonsterChoreography(monster)?.id).toBe(monster.id);
        expect(resolveRetroClassChoreography(monster)).toBeUndefined();
      });

      it("borrows either kind for a custom ID", () => {
        expect(resolveRetroClassChoreography({ id: "custom", retroChoreographyId: "skill_gunner_snipe" })?.id).toBe("skill_gunner_snipe");
        expect(resolveRetroMonsterChoreography({ id: "custom", retroChoreographyId: "skill_mon_acid_spit" })?.id).toBe("skill_mon_acid_spit");
      });

      it("keeps exact equipped skill identity when the actor owns another skill with the same name", () => {
        const project = createBlankProject();
        const actor = project.database.actors.find(row => row.id === "actor_ranger")!;
        const troop = project.database.troops[0]!;
        const enemy = project.database.enemies.find(row => row.id === troop.enemyIds[0])!;
        const charm = project.database.equipment.find(row => row.id === "equip_focus_charm")!;
        actor.initialEquipment = { accessory: charm.id };
        actor.parameterCurves.maxMp = Array(99).fill(100);
        actor.parameterCurves.agility = Array(99).fill(999);
        charm.grantsSkillIds = ["skill_gunner_snipe"];
        enemy.stats.maxHp = 9999;
        enemy.stats.agility = 1;
        enemy.actions = [];
        troop.enemyIds = [enemy.id];
        troop.members = [{ enemyId: enemy.id, x: 80, y: 80 }];
        troop.battleEventPages = [];
        const runtime = createBattleRuntime({ project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5,
          party: { partyActorIds: [actor.id], levels: { [actor.id]: 22 }, experience: {} } });
        expect(runtime.snapshot().actors[0]!.skillIds).toContain("skill_ranger_snipe");
        // 장비가 준 기술은 스냅샷 skillIds 가 아니라 equipmentEffects.grantedSkillIds 에 실린다 — 메뉴와 같은 합(battlerSkillIdsWithGrants)으로 본다.
        expect(battlerSkillIdsWithGrants(runtime.snapshot().actors[0]!)).toContain("skill_gunner_snipe");
        runtime.performActorCommand({ kind: "skill", skillId: "skill_gunner_snipe", targetEnemyId: "enemy-1" });
        const fact = runtime.snapshot().timeline.find(row => row.kind === "damage" && row.userRecordId === actor.id)!;
        expect(fact).toMatchObject({ skillName: "저격", skillId: "skill_gunner_snipe" });
      });

      it("carries enemy special skill identity and command kind into its presentation fact", () => {
        const project = createBlankProject();
        const actor = project.database.actors[0]!;
        const troop = project.database.troops[0]!;
        const enemy = project.database.enemies.find(row => row.id === troop.enemyIds[0])!;
        const skill = normalizeSkillRecord({ id: "audit_scan", name: "Borrowed scan", scope: "enemy", effect: { kind: "scan" },
          retroChoreographyId: "skill_gunner_snipe", mpCost: { flat: 0, percentMax: 0 }, hitRate: 100, successRate: 100 });
        project.database.skills.push(skill);
        actor.parameterCurves.agility = Array(99).fill(1);
        enemy.stats.agility = 999;
        enemy.stats.maxHp = 9999;
        enemy.actions = [{ skillId: skill.id, priority: 50, condition: { kind: "always" }, switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
        troop.enemyIds = [enemy.id];
        troop.members = [{ enemyId: enemy.id, x: 80, y: 80 }];
        troop.battleEventPages = [];
        const runtime = createBattleRuntime({ project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5,
          party: { partyActorIds: [actor.id], levels: { [actor.id]: 1 }, experience: {} } });
        runtime.performActorCommand({ kind: "defend" });
        expect(runtime.snapshot().timeline.find(row => row.kind === "special" && row.side === "enemy"))
          .toMatchObject({ skillId: skill.id, skillName: skill.name, commandKind: "enemySkill", targetId: actor.id });
      });
    });
  });
  describe("battleExploitTierBonus", () => {
    isolateTimers();
    const MARKS = ["tier_mark_1", "tier_mark_2", "tier_mark_3"] as const;
    function setup() {
      const project = createBlankProject();
      project.system.battleModel = "rm2k3";
      project.system.atbSpeed = 4;
      const actor = project.database.actors[0]!;
      const enemy = project.database.enemies[0]!;
      const troop = project.database.troops.find((record) => record.id === project.system.initialTroopId) ?? project.database.troops[0]!;
      troop.enemyIds = [enemy.id];
      troop.members = [{ enemyId: enemy.id, x: 80, y: 80 }];
      troop.battleEventPages = [];
      actor.initialEquipment = {};
      actor.learnedSkills = [];
      actor.parameterCurves.maxHp = Array(99).fill(500);
      actor.parameterCurves.agility = Array(99).fill(999);
      for (const klass of project.database.classes) klass.learnedSkills = [];
      enemy.stats = { ...enemy.stats, maxHp: 9999, attack: 1, defense: 20, mind: 20, agility: 1 };
      enemy.actions = [];
      MARKS.forEach((id, index) => {
        project.database.states.push(normalizeStateRecord({ id, name: id, recoverNaturallyChance: 0, recoverWhenHitChance: 0, emotion: { family: "tier_mark", tier: index + 1 } }));
        enemy.stateRates[id] = "A";
      });
      const skill = (extra: Partial<SkillRecord>, id = "finisher") => {
        const record = normalizeSkillRecord({ id, name: id, scope: "enemy", power: 10, damageFormula: "100",
          mpCost: { flat: 0, percentMax: 0 }, variance: 0, criticalRate: 0, hitRate: 100, successRate: 100,
          effect: { kind: "damage", statistic: "attack", affects: "hp" }, ...extra });
        project.database.skills.push(record);
        return record;
      };
      /** marks 번 표식을 실제 기술로 새긴 뒤 마무리기를 쓴다. 마무리기 피해와 끝난 뒤 대상 상태를 돌려준다. */
      let mark: SkillRecord | undefined;
      const strike = (finisherId: string, marks: number) => {
        mark ??= skill({ damageFormula: undefined, effect: { kind: "support" }, stateEffects: [{ stateId: MARKS[0], chance: 100, operation: "add" }] }, "mark");
        const runtime = createBattleRuntime({
          project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: "strict", rng: () => 0.5,
          party: { levels: { [actor.id]: 1 }, experience: {}, partyActorIds: [actor.id], skillIds: { [actor.id]: [mark!.id, finisherId] } },
        });
        for (let i = 0; i < marks; i += 1) runtime.performActorCommand({ kind: "skill", skillId: mark!.id, targetEnemyId: "enemy-1" });
        const before = runtime.snapshot().timeline.length;
        runtime.performActorCommand({ kind: "skill", skillId: finisherId, targetEnemyId: "enemy-1" });
        const hit = runtime.snapshot().timeline.slice(before).find((entry) => entry.kind === "damage" && entry.userRecordId === actor.id && entry.targetId === "enemy-1");
        return { amount: hit?.amount ?? 0, exploit: Boolean(hit?.exploit), statesAfter: runtime.snapshot().enemies[0]!.stateIds };
      };
      return { project, skill, strike };
    }
    describe("exploitStates.bonusByState (tiered set-up → payoff)", () => {
      it("uses the largest per-state bonus among the matched states, falling back to bonusPercent", () => {
        const exploit = { stateIds: [...MARKS], bonusPercent: 10, bonusByState: { tier_mark_1: 25, tier_mark_2: 50, tier_mark_3: 75 } };
        expect(exploitBonusPercent(exploit, ["tier_mark_1"])).toBe(25);
        expect(exploitBonusPercent(exploit, ["tier_mark_2"])).toBe(50);
        expect(exploitBonusPercent(exploit, ["tier_mark_1", "tier_mark_3"])).toBe(75);
        expect(exploitBonusPercent({ stateIds: ["a", "b"], bonusPercent: 40, bonusByState: { a: 10 } }, ["b"])).toBe(40);
        expect(exploitBonusPercent({ stateIds: ["a"], bonusPercent: 50 }, ["a"])).toBe(50);
      });

      it("in battle, each mark tier gives its own bonus and the finisher consumes it in the same action", () => {
        const tiered = setup();
        tiered.skill({ exploitStates: { stateIds: [...MARKS], bonusPercent: 25, consume: true, bonusByState: { tier_mark_2: 50, tier_mark_3: 75 } } });
        const none = tiered.strike("finisher", 0);
        const one = tiered.strike("finisher", 1);
        const two = tiered.strike("finisher", 2);
        const three = tiered.strike("finisher", 3);
        expect(none.exploit).toBe(false);
        expect([one, two, three].every((row) => row.exploit)).toBe(true);
        expect(one.amount / none.amount).toBeCloseTo(1.25, 1);
        expect(two.amount / none.amount).toBeCloseTo(1.5, 1);
        expect(three.amount / none.amount).toBeCloseTo(1.75, 1);
        for (const row of [one, two, three]) expect(row.statesAfter.some((id) => (MARKS as readonly string[]).includes(id))).toBe(false);
      });

      it("without bonusByState every matched state gives bonusPercent (existing skills unchanged)", () => {
        const plain = setup();
        plain.skill({ exploitStates: { stateIds: [...MARKS], bonusPercent: 25 } });
        const none = plain.strike("finisher", 0);
        const three = plain.strike("finisher", 3);
        expect(three.amount / none.amount).toBeCloseTo(1.25, 1);
        expect(three.statesAfter).toContain("tier_mark_3");
      });

      it("normalizes the table: keeps only listed states, clamps 1..300, drops an empty table", () => {
        const record = normalizeSkillRecord({ id: "s", name: "s", scope: "enemy",
          exploitStates: { stateIds: ["a", "b"], bonusPercent: 50, bonusByState: { a: 999, b: 0, c: 30 } as Record<string, number> } } as never);
        expect(record.exploitStates).toEqual({ stateIds: ["a", "b"], bonusPercent: 50, bonusByState: { a: 300 } });
        const plain = normalizeSkillRecord({ id: "p", name: "p", scope: "enemy", exploitStates: { stateIds: ["a"], bonusPercent: 50, consume: true } } as never);
        expect(plain.exploitStates).toEqual({ stateIds: ["a"], bonusPercent: 50, consume: true });
      });

      it("round-trips through save and load", () => {
        const s = setup();
        s.skill({ exploitStates: { stateIds: [...MARKS], bonusPercent: 25, consume: true, bonusByState: { tier_mark_2: 50, tier_mark_3: 75 } } });
        const loaded = deserialize(serialize(s.project));
        expect(loaded.database.skills.find((skill) => skill.id === "finisher")!.exploitStates)
          .toEqual({ stateIds: [...MARKS], bonusPercent: 25, consume: true, bonusByState: { tier_mark_2: 50, tier_mark_3: 75 } });
      });

      it("help text lists each tier", () => {
        const s = setup();
        const skill = s.skill({ exploitStates: { stateIds: [...MARKS], bonusPercent: 25, consume: true, bonusByState: { tier_mark_2: 50, tier_mark_3: 75 } } });
        const tags = skillHelpTags(s.project, skill).join(" ");
        expect(tags).toContain("tier_mark_1 +25%");
        expect(tags).toContain("tier_mark_2 +50%");
        expect(tags).toContain("tier_mark_3 +75%");
      });
    });
  });
  describe("battleRulesAdversarialRegression", () => {
    isolateTimers();
    function setup() {
      const project = createBlankProject();
      project.system.battleModel = "rm2k3";
      project.system.battleUiStyle = "retro2003";
      project.system.atbSpeed = 4;
      const actor = project.database.actors[0]!;
      const enemy = project.database.enemies[0]!;
      const troop = project.database.troops.find(record => record.id === project.system.initialTroopId) ?? project.database.troops[0]!;
      troop.enemyIds = [enemy.id];
      troop.members = [{ enemyId: enemy.id, x: 80, y: 80 }];
      troop.battleEventPages = [];
      actor.initialEquipment = {};
      actor.learnedSkills = [];
      actor.parameterCurves.maxHp = Array(99).fill(500);
      actor.parameterCurves.maxMp = Array(99).fill(100);
      actor.parameterCurves.agility = Array(99).fill(999);
      for (const klass of project.database.classes) klass.learnedSkills = [];
      enemy.stats = { ...enemy.stats, maxHp: 9999, maxMp: 100, attack: 1, defense: 20, mind: 20, agility: 1 };
      enemy.actions = [];
      const start = (flow: BattleFlow = "strict", party: BattleRuntimeOptions["party"] = {}) => createBattleRuntime({
        project, troopId: troop.id, canEscape: false, canLose: true, battleFlow: flow, rng: () => 0.5,
        party: { levels: { [actor.id]: 1 }, experience: {}, partyActorIds: [actor.id], ...party },
      });
      const skill = (id: string, extra: Partial<SkillRecord> = {}) => {
        const record = normalizeSkillRecord({ id, name: id, scope: "enemy", power: 10, damageFormula: "10",
          mpCost: { flat: 0, percentMax: 0 }, variance: 0, criticalRate: 0, hitRate: 100, successRate: 100,
          effect: { kind: "damage", statistic: "attack", affects: "hp" }, ...extra });
        project.database.skills.push(record);
        return record;
      };
      const enemyAction = (skillId: string) => {
        enemy.actions = [{ skillId, priority: 50, condition: { kind: "always" },
          switchOnAfterAction: { enabled: false }, switchOffAfterAction: { enabled: false } }];
      };
      return { project, actor, enemy, troop, start, skill, enemyAction };
    }
    function hits(runtime: ReturnType<typeof createBattleRuntime>, userId: string, targetId: string) {
      return runtime.snapshot().timeline.filter(entry => entry.kind === "damage" && entry.userRecordId === userId && entry.targetId === targetId);
    }
    describe("battle rules adversarial regression R1–R5", () => {
      it.each(["restrictsAction", "freezesGauge"] as const)("R1: a queued attack is skipped after a faster enemy applies %s", restriction => {
        const s = setup();
        s.actor.parameterCurves.agility = Array(99).fill(1);
        s.enemy.stats.agility = 999;
        s.project.database.states.push(normalizeStateRecord({ id: "audit_stop", name: "Audit stop",
          runtimeEffects: { [restriction]: true, removeOnBattleEnd: false }, recoverNaturallyChance: 0 }));
        const stop = s.skill("stop", { damageFormula: undefined, effect: { kind: "support" },
          stateEffects: [{ stateId: "audit_stop", chance: 100, operation: "add" }] });
        s.enemyAction(stop.id);
        const runtime = s.start();
        runtime.performActorCommand({ kind: "attack", targetEnemyId: "enemy-1" });
        const round = runtime.snapshot().roundLogs[0]!;
        expect(round.timeline.some(entry => entry.kind === "stateAdded" && entry.targetId === s.actor.id)).toBe(true);
        expect(round.timeline.some(entry => entry.kind === "incapacitated" && entry.userRecordId === s.actor.id)).toBe(true);
        expect(hits(runtime, s.actor.id, "enemy-1")).toHaveLength(0);
      });

      it("R1: an invalidated queued skill consumes neither MP nor HP", () => {
        const s = setup();
        s.actor.parameterCurves.agility = Array(99).fill(1);
        s.enemy.stats.agility = 999;
        s.project.database.states.push(normalizeStateRecord({ id: "audit_stop", name: "Stop",
          runtimeEffects: { restrictsAction: true, removeOnBattleEnd: false }, recoverNaturallyChance: 0 }));
        const stop = s.skill("stop", { damageFormula: undefined, effect: { kind: "support" },
          stateEffects: [{ stateId: "audit_stop", chance: 100, operation: "add" }] });
        const queued = s.skill("queued", { mpCost: { flat: 25, percentMax: 0 }, hpCostPercent: 50 });
        s.enemyAction(stop.id);
        const runtime = s.start("strict", { skillIds: { [s.actor.id]: [queued.id] } });
        runtime.performActorCommand({ kind: "skill", skillId: queued.id, targetEnemyId: "enemy-1" });
        expect(runtime.snapshot().actors[0]).toMatchObject({ hp: 500, mp: 100 });
        expect(hits(runtime, s.actor.id, "enemy-1")).toHaveLength(0);
      });

      it("R1: a faster actor also invalidates an enemy's queued attack", () => {
        const s = setup();
        s.project.database.states.push(normalizeStateRecord({ id: "audit_stop", name: "Stop",
          runtimeEffects: { restrictsAction: true }, recoverNaturallyChance: 0 }));
        s.enemy.stateRates.audit_stop = "A";
        const stop = s.skill("stop", { damageFormula: undefined, effect: { kind: "support" },
          stateEffects: [{ stateId: "audit_stop", chance: 100, operation: "add" }] });
        const runtime = s.start("strict", { skillIds: { [s.actor.id]: [stop.id] } });
        runtime.performActorCommand({ kind: "skill", skillId: stop.id, targetEnemyId: "enemy-1" });
        expect(runtime.snapshot().actors[0]!.hp).toBe(500);
        expect(runtime.snapshot().roundLogs[0]!.timeline.some(entry => entry.kind === "incapacitated" && entry.side === "enemy")).toBe(true);
      });

      it.each(["wait", "active"] as const)("R2: %s ATB recovers an entirely frozen battle at the same simulation time for different tick partitions", mode => {
        const s = setup();
        s.project.system.atbMode = mode;
        s.project.database.states.push(normalizeStateRecord({ id: "audit_stop", name: "Stop",
          runtimeEffects: { freezesGauge: true, removeOnBattleEnd: false }, recoverNaturallyFromTurn: 2, recoverNaturallyChance: 100 }));
        const stop = s.skill("self_stop", { scope: "self", damageFormula: undefined, effect: { kind: "support" },
          stateEffects: [{ stateId: "audit_stop", chance: 100, operation: "add" }] });
        s.enemy.stateRates.audit_stop = "A";
        s.enemyAction(stop.id);
        const create = () => {
          const runtime = s.start("gauge", { stateIds: { [s.actor.id]: ["audit_stop"] } });
          runtime.tick(100000); // The only unfrozen battler freezes itself; cycle 1 closes.
          expect(runtime.snapshot().turn).toBe(1);
          return runtime;
        };
        const whole = create();
        const pieces = create();
        whole.tick(999);
        for (let i = 0; i < 999; i++) pieces.tick(1);
        expect(whole.snapshot().actors[0]!.stateTurns.audit_stop).toBe(1);
        expect(pieces.snapshot().actors[0]!.stateTurns.audit_stop).toBe(1);
        whole.tick(1);
        pieces.tick(1);
        expect(pieces.snapshot()).toEqual(whole.snapshot());
        expect(whole.snapshot().turn).toBe(2);
        expect(whole.snapshot().actors[0]!.stateIds).not.toContain("audit_stop");
        expect(whole.snapshot().enemies[0]!.stateIds).not.toContain("audit_stop");
        whole.tick(100000);
        expect(whole.snapshot().phase).toBe("actorCommand");
      });

      it("R2: permanent all-stop reaches the existing stalemate cap", () => {
        const s = setup();
        s.project.database.states.push(normalizeStateRecord({ id: "audit_stop", name: "Stop",
          runtimeEffects: { freezesGauge: true, removeOnBattleEnd: false }, recoverNaturallyChance: 0 }));
        const stop = s.skill("self_stop", { scope: "self", damageFormula: undefined, effect: { kind: "support" },
          stateEffects: [{ stateId: "audit_stop", chance: 100, operation: "add" }] });
        s.enemyAction(stop.id);
        const runtime = s.start("gauge", { stateIds: { [s.actor.id]: ["audit_stop"] } });
        runtime.tick(100000);
        runtime.tick(1000000);
        expect(runtime.snapshot()).toMatchObject({ result: "escape", phase: "resolved", turn: 200 });
        expect(runtime.snapshot().timeline.some(entry => entry.kind === "stalemate")).toBe(true);
      });

      it.each([
        { scope: "allEnemies", pickedScope: "allEnemies" },
        { scope: "enemy", pickedScope: "allEnemies" },
        { scope: "enemy", pickedScope: "enemy" },
      ] as const)("R3: a $scope wrapper resolves one $pickedScope choice for two targets", ({ scope, pickedScope }) => {
        const s = setup();
        s.troop.enemyIds = [s.enemy.id, s.enemy.id];
        s.troop.members = [{ enemyId: s.enemy.id, x: 80, y: 80 }, { enemyId: s.enemy.id, x: 100, y: 80 }];
        const picked = s.skill("picked", { scope: pickedScope, area: { shape: "circle", radius: 200 }, mpCost: { flat: 50, percentMax: 0 } });
        const wrapper = s.skill("wrapper", { scope, area: scope === "enemy" ? { shape: "circle", radius: 200 } : undefined,
          effect: { kind: "randomSkillFrom", skillIds: [picked.id] },
          mpCost: { flat: 15, percentMax: 0 },
          inputSequence: { keys: ["confirm"], timeLimitMs: 1000, successMultiplier: 2 } });
        const runtime = s.start("strict", { skillIds: { [s.actor.id]: [wrapper.id] } });
        runtime.performActorCommand({ kind: "skill", skillId: wrapper.id, targetEnemyId: "enemy-1", inputResult: "success" });
        expect(hits(runtime, s.actor.id, "enemy-1").map(entry => entry.amount)).toEqual([20]);
        expect(hits(runtime, s.actor.id, "enemy-2").map(entry => entry.amount)).toEqual([20]);
        expect(runtime.snapshot().timeline.filter(entry => entry.kind === "special")).toHaveLength(1);
        expect(runtime.snapshot().actors[0]!.mp).toBe(85);
      });

      it("R3: an enemy all-enemies wrapper hits each actor once", () => {
        const s = setup();
        const other = s.project.database.actors[1]!;
        other.initialEquipment = {};
        other.parameterCurves.maxHp = Array(99).fill(500);
        other.parameterCurves.agility = Array(99).fill(1);
        s.actor.parameterCurves.agility = Array(99).fill(1);
        s.enemy.stats.agility = 999;
        const picked = s.skill("picked", { scope: "allEnemies" });
        const wrapper = s.skill("wrapper", { scope: "allEnemies", effect: { kind: "randomSkillFrom", skillIds: [picked.id] } });
        s.enemyAction(wrapper.id);
        const runtime = s.start("strict", { partyActorIds: [s.actor.id, other.id] });
        runtime.performActorCommand({ kind: "defend" });
        runtime.performActorCommand({ kind: "defend" });
        expect(hits(runtime, s.enemy.id, s.actor.id).map(entry => entry.amount)).toEqual([10]);
        expect(hits(runtime, s.enemy.id, other.id).map(entry => entry.amount)).toEqual([10]);
        expect(runtime.snapshot().timeline.filter(entry => entry.kind === "special")).toHaveLength(1);
      });

      it.each([
        { name: "HP cast cost", hp: 500, extra: { hpCostPercent: 50, damageFormula: "a.hp" }, expected: 250 },
        { name: "HP drain between hits", hp: 100, extra: { drainPercent: 50, damageFormula: "a.hp", hitSequence: [1, 1] }, expected: 250 },
        { name: "HP drain saturation", hp: 480, extra: { drainPercent: 50, damageFormula: "a.hp", hitSequence: [1, 1] }, expected: 980 },
        { name: "HP cost survival floor", hp: 500, extra: { hpCostPercent: 100, damageFormula: "a.hp" }, expected: 1 },
        { name: "MP drain between hits", hp: 500, extra: { drainPercent: 50, damageFormula: "a.mp", hitSequence: [1, 1], effect: { kind: "damage", statistic: "attack", affects: "mp" } }, expected: 25 },
      ] satisfies { name: string; hp: number; extra: Partial<SkillRecord>; expected: number }[])("R4: prediction follows $name and leaves snapshots unchanged", ({ hp, extra, expected }) => {
        const s = setup();
        const skill = s.skill("vitals", extra);
        const runtime = s.start("strict", { skillIds: { [s.actor.id]: [skill.id] }, vitals: { [s.actor.id]: { hp, mp: 10 } } });
        const before = runtime.snapshot();
        const saved = structuredClone(before);
        const prediction = predictSkillDamageFor(s.project, before.actors[0]!, skill, before.enemies[0]!);
        expect(before).toEqual(saved);
        runtime.performActorCommand({ kind: "skill", skillId: skill.id, targetEnemyId: "enemy-1" });
        expect(prediction.amount).toBe(expected);
        expect(hits(runtime, s.actor.id, "enemy-1").reduce((sum, entry) => sum + (entry.amount ?? 0), 0)).toBe(expected);
      });

      it("R4: self multi-hit drain uses the same caster and target clone", () => {
        const s = setup();
        const skill = s.skill("self_drain", { scope: "self", drainPercent: 50, damageFormula: "a.hp / 4", hitSequence: [1, 1] });
        const runtime = s.start("strict", { skillIds: { [s.actor.id]: [skill.id] }, vitals: { [s.actor.id]: { hp: 100, mp: 100 } } });
        const before = runtime.snapshot();
        expect(predictSkillDamageFor(s.project, before.actors[0]!, skill, before.actors[0]!).amount).toBe(47);
        runtime.performActorCommand({ kind: "skill", skillId: skill.id, targetActorId: s.actor.id });
        expect(hits(runtime, s.actor.id, s.actor.id).map(entry => entry.amount)).toEqual([25, 22]);
      });

      it.each(["attack", "mind"] as const)("R5: prediction applies %s defense and formula contexts", statistic => {
        const s = setup();
        s.actor.parameterCurves.attack = Array(99).fill(0);
        s.actor.parameterCurves.mind = Array(99).fill(0);
        s.project.database.states.push(normalizeStateRecord({ id: "protect", name: "Protect", runtimeEffects: {
          physicalDefenseMultiplier: statistic === "attack" ? 2.5 : 1,
          magicDefenseMultiplier: statistic === "mind" ? 2.5 : 1,
        } }));
        s.enemy.stateRates.protect = "A";
        const protect = s.skill("protect_skill", { scope: "self", damageFormula: undefined, effect: { kind: "support" },
          stateEffects: [{ stateId: "protect", chance: 100, operation: "add" }] });
        s.enemyAction(protect.id);
        s.actor.parameterCurves.agility = Array(99).fill(1);
        s.enemy.stats.agility = 999;
        const damage = s.skill("test_damage", { power: 100, damageFormula: undefined, effect: { kind: "damage", statistic, affects: "hp" } });
        const runtime = s.start("strict", { skillIds: { [s.actor.id]: [damage.id] } });
        runtime.performActorCommand({ kind: "defend" }); // Enemy applies protection before next preview.
        const snapshot = runtime.snapshot();
        const predicted = predictSkillDamageFor(s.project, snapshot.actors[0]!, damage, snapshot.enemies[0]!);
        runtime.performActorCommand({ kind: "skill", skillId: damage.id, targetEnemyId: "enemy-1" });
        expect(predicted.amount).toBe(75);
        expect(hits(runtime, s.actor.id, "enemy-1")[0]!.amount).toBe(75);
        damage.damageFormula = statistic === "attack" ? "100 - b.def" : "100 - b.mind";
        const next = runtime.snapshot();
        expect(predictSkillDamageFor(s.project, next.actors[0]!, damage, next.enemies[0]!).amount).toBe(50);
        runtime.performActorCommand({ kind: "skill", skillId: damage.id, targetEnemyId: "enemy-1" });
        expect(hits(runtime, s.actor.id, "enemy-1")[1]!.amount).toBe(50);
      });

      it("R5: a guaranteed first-hit element override affects the next hit and auto battle choice", () => {
        const s = setup();
        const element = s.project.database.elements![0]!;
        element.damageMultipliers = { A: 200, B: 150, C: 100, D: 50, E: 0 };
        s.enemy.elementRates[element.id] = "C";
        s.enemy.stateRates.wet = "A";
        s.project.database.states.push(normalizeStateRecord({ id: "wet", name: "Wet", runtimeEffects: { elementRates: { [element.id]: "A" } } }));
        const combo = s.skill("wet_combo", { damageFormula: "100", hitSequence: [1, 1], elementId: element.id,
          stateEffects: [{ stateId: "wet", chance: 100, operation: "add" }] });
        const alternative = s.skill("alternative", { damageFormula: "250" });
        const runtime = s.start("strict", { skillIds: { [s.actor.id]: [combo.id, alternative.id] } });
        const before = runtime.snapshot();
        const prediction = predictSkillDamageFor(s.project, before.actors[0]!, combo, before.enemies[0]!);
        expect(prediction.amount).toBe(300);
        expect(chooseAutoBattleCommand(s.project, before, () => 0.5)).toMatchObject({ kind: "skill", skillId: combo.id });
        runtime.performActorCommand({ kind: "skill", skillId: combo.id, targetEnemyId: "enemy-1" });
        expect(hits(runtime, s.actor.id, "enemy-1").map(entry => entry.amount)).toEqual([100, 200]);
      });

      it("R5: guaranteed emotion changes update the next hit's matchup", () => {
        const s = setup();
        s.project.database.states.push(
          normalizeStateRecord({ id: "joy", name: "Joy", emotion: { family: "joy", tier: 1 } }),
          normalizeStateRecord({ id: "anger", name: "Anger", emotion: { family: "anger", tier: 1 } }),
        );
        s.project.system.emotionCycle = [{ attackerFamily: "joy", targetFamily: "anger", multiplier: 2 }];
        s.enemy.stateRates.anger = "A";
        const skill = s.skill("emotion_combo", { damageFormula: "100", hitSequence: [1, 1],
          stateEffects: [{ stateId: "anger", chance: 100, operation: "add" }] });
        const runtime = s.start("strict", { stateIds: { [s.actor.id]: ["joy"] }, skillIds: { [s.actor.id]: [skill.id] } });
        const before = runtime.snapshot();
        expect(predictSkillDamageFor(s.project, before.actors[0]!, skill, before.enemies[0]!).amount).toBe(300);
        runtime.performActorCommand({ kind: "skill", skillId: skill.id, targetEnemyId: "enemy-1" });
        expect(hits(runtime, s.actor.id, "enemy-1").map(entry => entry.amount)).toEqual([100, 200]);
      });
    });
  });
  describe("battleStaging", () => {
    isolateTimers();
    describe("적 쓰러짐 연출", () => {
      it("기본(dissolve)·모르는 값은 저장하지 않는다", () => {
        expect(normalizeEnemyCollapseEffect("pixelBreak")).toBe("pixelBreak");
        expect(normalizeEnemyCollapseEffect("dissolve")).toBeUndefined();
        expect(normalizeEnemyCollapseEffect("explode")).toBeUndefined();
        const record = normalizeEnemyRecord({ id: "e", name: "보스", collapseEffect: "bossSink" });
        expect(record.collapseEffect).toBe("bossSink");
        expect("collapseEffect" in normalizeEnemyRecord({ id: "e", name: "잡몹" })).toBe(false);
      });

      it("upsert_enemy 가 collapseEffect 를 받아 저장하고 dissolve 로 되돌린다", () => {
        const ctx = { project: createBlankProject() };
        const set = runTool(ctx, "upsert_enemy", { enemy: { id: "enemy_boss_fx", name: "마왕", collapseEffect: "bossSink" } });
        expect(set.ok, JSON.stringify(set.issues)).toBe(true);
        expect(ctx.project.database.enemies.find((enemy) => enemy.id === "enemy_boss_fx")?.collapseEffect).toBe("bossSink");
        runTool(ctx, "upsert_enemy", { enemy: { id: "enemy_boss_fx", name: "마왕", collapseEffect: "dissolve" } });
        expect(ctx.project.database.enemies.find((enemy) => enemy.id === "enemy_boss_fx")?.collapseEffect).toBeUndefined();
      });
    });
    describe("전투 배경 겹", () => {
      it("프리셋도 그림도 없는 겹은 버리고, 최대 4겹·범위로 자른다", () => {
        const layers = normalizeBattleBackdropLayers([
          { preset: "fog" },
          { front: true },
          { preset: "rain", scrollY: 99999, opacity: 140, blendMode: "normal" },
          { resourceId: "  my-clouds  ", front: true, blendMode: "screen" },
          { preset: "snow" },
          { preset: "stars" },
        ]);
        expect(layers).toEqual([
          { preset: "fog" },
          { preset: "rain", scrollY: 1200, opacity: 100 },
          { resourceId: "my-clouds", front: true, blendMode: "screen" },
          { preset: "snow" },
        ]);
        expect(normalizeBattleBackdropLayers([{ preset: "lava" }])).toBeUndefined();
      });

      it("값을 주지 않으면 프리셋 기본값으로 그리고, 그림 겹은 정지·불투명", () => {
        expect(resolvedBattleBackdropLayer({ preset: "embers" })).toEqual({ scrollX: 8, scrollY: -50, opacity: 85, blendMode: "add" });
        expect(resolvedBattleBackdropLayer({ preset: "fog", opacity: 30 }).opacity).toBe(30);
        expect(resolvedBattleBackdropLayer({ resourceId: "x", preset: "rain" })).toEqual({ scrollX: 0, scrollY: 0, opacity: 100, blendMode: "normal" });
      });

      it("트룹 정규화가 겹을 보존하고, upsert_troop 이 받는다", () => {
        const troop = normalizeTroopRecord({ id: "t", name: "동굴", enemyIds: [], backdropLayers: [{ preset: "mist", front: true, opacity: 40 }] });
        expect(troop.backdropLayers).toEqual([{ preset: "mist", front: true, opacity: 40 }]);
        const ctx = { project: createBlankProject() };
        // upsert_enemy 는 이름에 확실히 맞는 외형이 없으면 거절한다(monster-graphic-required) — 외형을 명시한다.
        runTool(ctx, "upsert_enemy", { enemy: { id: "enemy_fx", name: "까마귀", monsterResourceId: "generated-enemy-bat-01", stats: { maxHp: 30, attack: 10 } } });
        const result = runTool(ctx, "upsert_troop", { troop: { id: "troop_fx", name: "폭풍 전야", enemyIds: ["enemy_fx"], backdropLayers: [{ preset: "rain" }, { preset: "fog", front: true, opacity: 35 }] } });
        expect(result.ok, JSON.stringify(result.issues)).toBe(true);
        expect(ctx.project.database.troops.find((entry) => entry.id === "troop_fx")?.backdropLayers).toHaveLength(2);
      });

      it("members 만 준 새 트룹도 받는다(enemyIds 는 members 에서)", () => {
        const ctx = { project: createBlankProject() };
        runTool(ctx, "upsert_enemy", { enemy: { id: "enemy_fx", name: "까마귀", monsterResourceId: "generated-enemy-bat-01", stats: { maxHp: 30, attack: 10 } } });
        const result = runTool(ctx, "upsert_troop", { troop: { id: "troop_members", name: "배치만", members: [{ enemyId: "enemy_fx", x: 120, y: 140 }, { enemyId: "enemy_fx", x: 200, y: 150 }] } });
        expect(result.ok, JSON.stringify(result.issues)).toBe(true);
        expect(ctx.project.database.troops.find((entry) => entry.id === "troop_members")?.enemyIds).toEqual(["enemy_fx", "enemy_fx"]);
      });
    });
    describe("상태 오라", () => {
      it("수면·마비·침묵·혼란·매혹·화상이 기본 상태 id 로 자동", () => {
        expect(resolveStateAura("state_sleep")).toBe("sleep-zzz");
        expect(resolveStateAura("state_paralysis")).toBe("paralyze-spark");
        expect(resolveStateAura("state_silence")).toBe("silence-mute");
        expect(resolveStateAura("state_confuse")).toBe("confuse-stars");
        expect(resolveStateAura("state_charm")).toBe("charm-heart");
        expect(resolveStateAura("state_burn")).toBe("burn-ember");
      });

      it("몬스터 주 상태는 id 와 무관하게 의미로 고르고, 저자 지정·none 이 앞선다", () => {
        expect(resolveStateAura("st_gen1_slp", { gen1MajorStatus: "sleep" })).toBe("sleep-zzz");
        expect(resolveStateAura("st_gen1_brn", { gen1MajorStatus: "burn", battleAura: "none" })).toBeNull();
        expect(resolveStateAura("state_sleep", { battleAura: "charm-heart" })).toBe("charm-heart");
        expect(resolveBattlerAuras(["st_x"], [{ id: "st_x", gen1MajorStatus: "paralysis" }])).toEqual(["paralyze-spark"]);
      });
    });
    describe("전투 이펙트 셀 회전·뒤집기·겹치기", () => {
      it("기본값(0·false)은 저장하지 않고, 회전은 -360~360 정수", () => {
        expect(cellTransformFields({ rotation: 0, mirror: false })).toEqual({});
        expect(cellTransformFields({ rotation: 721.4, mirror: true })).toEqual({ rotation: 360, mirror: true });
        const record = normalizeBattleAnimationRecord({
          id: "a", name: "베기", blendMode: "add",
          frames: [{ cells: [{ pattern: 0, x: 0, y: 0, zoom: 100, opacity: 255, visible: true, rotation: 45, mirror: true }] }],
        });
        expect(record.blendMode).toBe("add");
        expect(record.frames?.[0]?.cells[0]).toMatchObject({ rotation: 45, mirror: true });
        expect("blendMode" in normalizeBattleAnimationRecord({ id: "b", name: "b", blendMode: "normal" as never })).toBe(false);
      });

      it("upsert_battle_animation 이 blendMode 를 걸고 normal 로 걷는다", () => {
        const ctx = { project: createBlankProject() };
        expect(runTool(ctx, "upsert_battle_animation", { animation: { id: "anim_fx", name: "번개", blendMode: "add" } }).ok).toBe(true);
        expect(ctx.project.database.battleAnimations.find((entry) => entry.id === "anim_fx")?.blendMode).toBe("add");
        runTool(ctx, "upsert_battle_animation", { animation: { id: "anim_fx", name: "번개", blendMode: "normal" } });
        expect(ctx.project.database.battleAnimations.find((entry) => entry.id === "anim_fx")?.blendMode).toBeUndefined();
      });
    });
    describe("화면 필터", () => {
      it("none·모르는 값은 저장하지 않고, set_project_settings 가 켜고 끈다", () => {
        expect(normalizeDisplayFilter("crt")).toBe("crt");
        expect(normalizeDisplayFilter("none")).toBeUndefined();
        const ctx = { project: createBlankProject() };
        expect(runTool(ctx, "set_project_settings", { displayFilter: "scanlines" }).ok).toBe(true);
        expect(ctx.project.system.displayFilter).toBe("scanlines");
        runTool(ctx, "set_project_settings", { displayFilter: "none" });
        expect(ctx.project.system.displayFilter).toBeUndefined();
        expect(runTool(ctx, "set_project_settings", { displayFilter: "vhs" }).ok).toBe(false);
      });
    });
    describe("연출 지침", () => {
      it("전투 연출 절이 새 칸을 모두 안내한다", () => {
        const text = JSON.stringify(runTool({ project: createBlankProject() }, "read_directing_guide", {}));
        for (const word of ["collapseEffect", "backdropLayers", "battleAura", "blendMode", "displayFilter"]) expect(text).toContain(word);
      });
    });
  });
  describe("characterScale", () => {
    isolateTimers();
    describe("automatic walking-character scale", () => {
      it("uses the requested middle size for the 24px frame on a 48px map", () => {
        expect([16, 32, 48].map(size => automaticCharacterScale(24, size))).toEqual([1, 1, 2]);
        expect(automaticCharacterScale(48, 48)).toBe(1);
        expect(automaticCharacterScale(16, 48)).toBe(3);
        expect(automaticCharacterScale(32, 48)).toBe(1); // no uneven 1.5x pixels
        expect(automaticCharacterScale(96, 48)).toBe(1); // large authored art isn't shrunk
        expect(automaticCharacterScale(0, 48)).toBe(1);
      });

      it("preserves legacy/manual scales, including 1x, and separates the auto body multiplier", () => {
        expect(characterRenderScale(24, 48)).toBe(2);
        expect(characterRenderScale(24, 48, { scale: 1 })).toBe(1);
        expect(characterRenderScale(24, 48, { scale: 1, scaleMode: "manual" })).toBe(1);
        expect(characterRenderScale(24, 48, { scale: 1.5 })).toBe(1.5);
        expect(characterRenderScale(24, 48, { scale: 3, scaleMode: "auto" })).toBe(6);
        expect(characterRenderScale(24, 48, { scale: 8, scaleMode: "auto" })).toBe(8);
      });

      it("refreshes after map/graphic changes without overwriting an in-progress squash", () => {
        const project = createBlankProject();
        const map = { ...project.maps[project.startMapId]!, tileSize: 48 };
        // Single-size project: the store's maps object is replaced on every edit, so hand out a fresh one.
        vi.spyOn(store, "getCurrent").mockImplementation(() => ({ ...project, maps: { [map.id]: { ...map } } }));
        const player = { width: 24, setScale: vi.fn() };
        syncPlayerCharacterScale({ map, player });
        syncPlayerCharacterScale({ map, player });
        expect(player.setScale.mock.calls).toEqual([[2]]);
        map.tileSize = 16;
        syncPlayerCharacterScale({ map, player });
        map.tileSize = 48;
        syncPlayerCharacterScale({ map, player });
        player.width = 48;
        syncPlayerCharacterScale({ map, player });
        expect(player.setScale.mock.calls).toEqual([[2], [1], [2], [1]]);
        vi.restoreAllMocks();
      });

      it("keeps the reference-cell fit on maps whose cell differs, so the on-screen size holds", () => {
        // 16px project with one 32px map: fit on 16 (1x), then x2 in 32px world pixels.
        expect(mapCharacterScale(24, 32, 16)).toBe(2);
        expect(mapCharacterScale(24, 48, 16)).toBe(3);
        // 32px project visiting a 16px map: 1x on 32, half in 16px world pixels (camera zooms x2).
        expect(mapCharacterScale(24, 16, 32)).toBe(0.5);
        // Same cell as the reference is exactly the old rule.
        expect([16, 32, 48].map(size => mapCharacterScale(24, size))).toEqual([1, 1, 2]);
        expect(characterRenderScale(24, 32, undefined, 16)).toBe(2);
        expect(characterRenderScale(24, 32, { scale: 1, scaleMode: "manual" }, 16)).toBe(1); // manual stays absolute
        expect(characterRenderScale(24, 32, { scale: 2, scaleMode: "auto" }, 16)).toBe(4);
      });

      it("applies the same rule to charset NPCs/followers, leaving props and fitted monsters alone", () => {
        const project = createBlankProject();
        const charset = resolveEventSpriteTexture(project, "tex_easyrpg_charset_actor1", 0);
        expect(isCharsetSpriteTexture(charset)).toBe(true);
        expect(eventSpriteScale(charset, { width: 24, height: 32 }, undefined, 48)).toBe(2);
        expect(eventSpriteScale(charset, { width: 24, height: 32 }, 1, 48)).toBe(1);
        expect(eventSpriteScale({ texture: "door", frame: 0 }, { width: 16, height: 32 }, undefined, 48)).toBe(1);
        expect(eventSpriteScale({ texture: "monster", frame: 0, fitSize: 32 }, { width: 384, height: 192 }, 2, 48)).toBe(1 / 6);
        expect(eventSpriteScale(charset, { width: 24, height: 32 }, undefined, 32, undefined, 16)).toBe(2);
        expect(eventSpriteScale({ texture: "door", frame: 0 }, { width: 16, height: 32 }, undefined, 32, undefined, 16)).toBe(1);
      });
    });
  });
  describe("cutsceneShakeIntensity", () => {
    isolateTimers();
    describe("컷신 shake beat", () => {
      it("script_cutscene 이 shake beat 를 명령 형식 오류 없이 받는다", () => {
        const ctx = { project: createBlankProject() };
        const result = runTool(ctx, "script_cutscene", {
          mapId: ctx.project.startMapId, x: 3, y: 3, trigger: "auto", once: true,
          beats: [{ kind: "fade", direction: "in", durationMs: 800 }, { kind: "shake", durationMs: 500 }, { kind: "say", speaker: "탐정", text: "비명이다!" }],
        });
        expect(result.ok, JSON.stringify(result.issues)).toBe(true);
      });

      it("intensity 숫자는 선택지 문자열로 맞추고 런타임 value 도 채운다", () => {
        const project = createBlankProject();
        const commands = compileCutscene([{ kind: "shake", intensity: 7 }], { project } as never) as unknown as { kind: string; fields?: Record<string, unknown> }[];
        const shake = JSON.stringify(commands);
        expect(shake).toContain('"intensity":"6"');
        expect(shake).toContain('"value":6');
      });
    });
  });
  describe("equipmentStatBonusSave", () => {
    isolateTimers();
    describe("equipment stat penalties survive project save", () => {
      it("keeps a negative agility penalty through normalize and a save round trip", () => {
        const heavy = normalizeEquipmentRecord({
          id: "equip_heavy_spear",
          name: "무거운 창",
          slot: "weapon",
          statBonuses: { attack: 22, defense: 0, mind: -4, agility: -3 },
        });
        expect(heavy.statBonuses).toEqual({ attack: 22, defense: 0, mind: -4, agility: -3 });

        const clamped = normalizeEquipmentRecord({
          id: "equip_clamp",
          name: "한계",
          slot: "weapon",
          statBonuses: { attack: 99_999, defense: -99_999, mind: 1.8, agility: -1.2 },
        });
        expect(clamped.statBonuses).toEqual({ attack: 9999, defense: -9999, mind: 1, agility: -1 });

        const project = createBlankProject();
        project.database.equipment.push(heavy);
        const loaded = deserialize(serialize(project));
        expect(loaded.database.equipment.find((row) => row.id === "equip_heavy_spear")?.statBonuses).toEqual({
          attack: 22,
          defense: 0,
          mind: -4,
          agility: -3,
        });
      });
    });
  });
});

describe("chipsetAnimation", () => {
  isolateTimers();
  describe("chipset water animation mapping", () => {
    it("treats horizontal water triplets as one 3fps terrain animation", () => {
      expect(CHIPSET_ANIMATION_FPS).toBe(3);
      expect(animationStripForTile(0)).toMatchObject({ baseTile: 0, frames: [0, 1, 2], fps: 3 });
      expect(animationStripForTile(1)).toMatchObject({ baseTile: 0, frames: [0, 1, 2], fps: 3 });
      expect(animationStripForTile(90)).toMatchObject({ baseTile: 90, frames: [90, 91, 92], fps: 3 });
      expect(animationStripForTile(92)).toMatchObject({ baseTile: 90, frames: [90, 91, 92], fps: 3 });
      expect(animationStripForTile(120)).toMatchObject({ baseTile: 120, frames: [120, 121, 122], fps: 3 });
      expect(animationKeyForTile(91)).toBe(animationKeyForTile(90));
    });

    it("treats waterfall as vertical 4-frame loop at 4fps (123→153→183→213)", () => {
      expect(WATERFALL_ANIMATION_FPS).toBe(4);
      expect(animationStripForTile(123)).toMatchObject({
        baseTile: 123,
        frames: [123, 153, 183, 213],
        fps: 4,
      });
      // 가로 이웃 124/125 는 같은 세로 루프의 다른 열 — 123과 섞이지 않는다.
      expect(animationStripForTile(124)?.frames).toEqual([124, 154, 184, 214]);
      expect(animationStripForTile(125)?.frames).toEqual([125, 155, 185, 215]);
      // 123 한 칸만 저장해도 세로로 프레임이 바뀐다.
      expect(animationFrameForTile(123, 0)).toBe(123);
      expect(animationFrameForTile(123, 250)).toBe(153);
      expect(animationFrameForTile(123, 500)).toBe(183);
      expect(animationFrameForTile(123, 750)).toBe(213);
      expect(animationFrameForTile(123, 1000)).toBe(123);
      // 예전 잘못된 가로 해석: 123→124 가 되면 안 된다.
      expect(animationFrameForTile(123, 250)).not.toBe(124);
    });

    it("selects the visible chipset frame from elapsed time", () => {
      expect(animationFrameForTile(90, 0)).toBe(90);
      expect(animationFrameForTile(90, 334)).toBe(91);
      expect(animationFrameForTile(90, 667)).toBe(92);
      expect(animationFrameForTile(90, 1000)).toBe(90);
      expect(animationFrameForTile(7, 667)).toBe(7);
    });

    it("scopes non-legacy animation keys to the active chipset texture", () => {
      const key = animationKeyForTile(120);
      expect(key).toBeTruthy();
      expect(chipsetAnimationKey(TEX_TILESET, key!)).toBe(key);
      expect(chipsetAnimationKey("tex_easyrpg_chipset_combined_town", key!)).toBe(
        `tex_easyrpg_chipset_combined_town:${key}`,
      );
    });
  });
});
