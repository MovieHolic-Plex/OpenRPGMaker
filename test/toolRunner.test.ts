import { describe, expect, it } from "vitest";
import * as bindings from "@/player/keyBindings";
import { runTool } from "@/editor/tools/toolRunner";
import type { ToolContext } from "@/editor/tools/types";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { actorBattlers } from "@/battle/battleBattlers";
import type { ItemRecord } from "@/project/types";
import { isolateTimers } from "./mergedTeardown";

describe("actionControlsGuide", () => {
  isolateTimers();
  function context(): ToolContext {
    return { project: createBlankProject() };
  }
  describe("action controls guide authoring", () => {
    it("does not invent a portrait for a generated controls guide", () => {
      const ctx = context();
      const result = runTool(ctx, "place_npc", {
        mapId: ctx.project.startMapId, x: 2, y: 2, name: "Controls", guide: "action-controls",
      });

      expect(result.ok, result.summary).toBe(true);
      const guide = ctx.project.maps[ctx.project.startMapId]?.events[0];
      expect(guide?.pages?.[0]?.commands.filter(command => command.kind === "changeFace")).toHaveLength(0);
    });

    it("updates one map-stable guide without moving it when retried elsewhere", () => {
      const ctx = context();
      const mapId = ctx.project.startMapId;
      const args = { mapId, x: 2, y: 2, name: "Controls", guide: "action-controls" };
      const first = runTool(ctx, "place_npc", args);
      expect(first.ok, first.summary).toBe(true);
      const before = structuredClone(ctx.project.maps[mapId]?.events ?? []);

      const retry = runTool(ctx, "place_npc", { ...args, x: 8, y: 8, name: "Arena controls" });

      expect(retry.ok, retry.summary).toBe(true);
      const events = ctx.project.maps[mapId]?.events ?? [];
      expect(events).toHaveLength(before.length);
      const guide = events.find((event) => event.id === `ev_action_controls_${mapId}`);
      expect(guide).toMatchObject({ x: 2, y: 2, name: "Arena controls" });
      expect(guide?.pages).toHaveLength(1);
      expect(guide?.pages?.[0]?.commands.flatMap((command) => command.kind === "text" ? [command.body] : []))
        .toEqual([bindings.ACTION_CONTROLS_GUIDE]);
    });

    it("honors explicit existing identity rather than the map guide or nearby NPC", () => {
      const ctx = context();
      const mapId = ctx.project.startMapId;
      for (const args of [
        { mapId, x: 2, y: 2, name: "Controls", guide: "action-controls" },
        { mapId, x: 6, y: 6, name: "Teacher", id: "teacher", pages: [{ text: "Old lesson" }] },
      ]) expect(runTool(ctx, "place_npc", args).ok).toBe(true);
      const count = ctx.project.maps[mapId]?.events.length;

      const result = runTool(ctx, "place_npc", {
        mapId, x: 3, y: 3, name: "Controls", id: "teacher", guide: "action-controls",
      });

      expect(result.ok, result.summary).toBe(true);
      expect(ctx.project.maps[mapId]?.events).toHaveLength(count ?? 0);
      expect(ctx.project.maps[mapId]?.events.find((event) => event.id === "teacher"))
        .toMatchObject({ x: 6, y: 6 });
    });

    it("keeps distinct ordinary NPC ids distinct and requires their authored pages", () => {
      const ctx = context();
      const mapId = ctx.project.startMapId;
      for (const id of ["teacher_a", "teacher_b"]) {
        const result = runTool(ctx, "place_npc", {
          mapId, x: 2, y: 2, name: "Teacher", id, pages: [{ text: id }],
        });
        expect(result.ok, result.summary).toBe(true);
      }
      expect(ctx.project.maps[mapId]?.events.filter((event) => event.id.startsWith("teacher_"))).toHaveLength(2);
      // 2026-09-18: pages 없는 일반 NPC 는 거부 대신 인사 한 줄을 기본으로 받는다(거부 잘 안하게).
      const defaulted = runTool(ctx, "place_npc", { mapId, x: 4, y: 4, name: "No pages" });
      expect(defaulted.ok, defaulted.summary).toBe(true);
      expect((defaulted.diff?.warnings ?? []).some((w) => w.includes("인사 한 줄 기본 적용"))).toBe(true);
    });

    it("derives displayed action keys from the runtime binding predicates", () => {
      expect(bindings.ACTION_CONTROL_BINDINGS).toBeDefined();
      const predicates = {
        move: bindings.isNavKey,
        attack: bindings.isAttackKey,
        dodge: bindings.isDashKey,
        guard: bindings.isGuardKey,
        skill: bindings.isSkillKey,
        cycle: bindings.isSkillCycleKey,
        menu: bindings.isMenuKey,
      };
      for (const binding of bindings.ACTION_CONTROL_BINDINGS) {
        expect(binding.keys.length).toBeGreaterThan(0);
        expect(binding.keys.every(predicates[binding.id])).toBe(true);
      }
    });
  });
});

describe("actionTools", () => {
  isolateTimers();
  function authoredEnemyFixture() {
    const context: ToolContext = { project: createBlankProject() };
    const enemy = context.project.database.enemies[0];
    if (!enemy) throw new Error("enemy fixture missing");
    enemy.actionProfile = {
      contactDamage: 9,
      moveIntervalMs: 730,
      aggroRange: 4,
      knockbackResist: 0.3,
      attack: {
        kind: "projectile",
        windupMs: 620,
        recoverMs: 430,
        damage: 17,
        range: 9,
        cooldownMs: 1700,
        projectileSpeedTilesPerSec: 8,
      },
    };
    enemy.rewards = { ...enemy.rewards, exp: 23, gold: 19 };
    return { context, enemy };
  }
  describe("action combat AI tools", () => {
    it("set_action_combat writes system config and map opt-in", () => {
      const context: ToolContext = { project: createBlankProject() };
      const mapId = context.project.startMapId;

      const result = runTool(context, "set_action_combat", { enabled: true, mapId, stamina: true, enemyHpBars: "always" });
      expect(result.ok, result.summary).toBe(true);
      expect(context.project.system.actionCombat?.enabled).toBe(true);
      expect(context.project.system.actionCombat?.hud?.stamina).toBe(true);
      expect(context.project.system.actionCombat?.hud?.enemyHpBars).toBe("always");
      expect(context.project.maps[mapId]?.actionCombat).toBe(true);

      const off = runTool(context, "set_action_combat", { enabled: false, mapId });
      expect(off.ok).toBe(true);
      expect(context.project.system.actionCombat?.enabled).toBe(false);
      expect(context.project.maps[mapId]?.actionCombat).toBe(false);
    });

    it("set_action_combat rejects unknown maps", () => {
      const context: ToolContext = { project: createBlankProject() };
      expect(runTool(context, "set_action_combat", { enabled: true, mapId: "map_nope" }).ok).toBe(false);
    });

    it("make_action_enemy creates an enemy with a melee profile and spawn", () => {
      const context: ToolContext = { project: createBlankProject() };
      const mapId = context.project.startMapId;
      const troopId = context.project.database.troops[0]?.id;
      if (!troopId) throw new Error("troop missing");

      const created = runTool(context, "make_action_enemy", {
        enemyId: "enemy_test_charger",
        name: "돌진 슬라임",
        monsterResourceId: "generated-enemy-slime-01",
        stats: { maxHp: 40, attack: 12 },
        actionProfile: { contactDamage: 3, attack: { kind: "dash", windupMs: 400, recoverMs: 600, damage: 6, range: 4 } },
      });
      expect(created.ok, created.summary).toBe(true);
      const enemy = context.project.database.enemies.find((entry) => entry.id === "enemy_test_charger");
      expect(enemy?.actionProfile?.attack?.kind).toBe("dash");

      const troopEnemyId = context.project.database.troops[0]?.members?.[0]?.enemyId ?? context.project.database.troops[0]?.enemyIds[0];
      const spawned = runTool(context, "make_action_enemy", {
        enemyId: troopEnemyId,
        actionProfile: { contactDamage: 2 },
        spawn: { mapId, troopId, area: { x: 1, y: 1, w: 4, h: 4 }, maxAlive: 2 },
      });
      expect(spawned.ok, spawned.summary).toBe(true);
      const spawns = context.project.maps[mapId]?.fieldSpawns ?? [];
      expect(spawns.some((spawn) => spawn.troopId === troopId && spawn.chase === true)).toBe(true);
    });

    it("make_action_enemy modifies existing enemy and opts a non-opted map in, saying so", () => {
      const context: ToolContext = { project: createBlankProject() };
      const existing = context.project.database.enemies[0];
      if (!existing) throw new Error("enemy fixture missing");
      const mapId = context.project.startMapId;
      const troopId = context.project.database.troops[0]?.id;

      const result = runTool(context, "make_action_enemy", {
        enemyId: existing.id,
        actionProfile: { attack: { kind: "projectile", windupMs: 600, recoverMs: 400, damage: 5, range: 8, projectileSpeedTilesPerSec: 7 } },
        spawn: { mapId, troopId, area: { x: 0, y: 0, w: 3, h: 3 } },
      });
      expect(result.ok).toBe(true);
      const updated = context.project.database.enemies.find((entry) => entry.id === existing.id);
      expect(updated?.actionProfile?.attack?.kind).toBe("projectile");
      // Break(2026-11-11 작은 일 셋째 묶음): 옵트인이 아닌 맵의 스폰은 싸우지 않는다 — 전에는 주의 글만 남겨 set_action_combat 을 한 번 더 불러야 했다.
      expect(context.project.maps[mapId]?.actionCombat).toBe(true);
      expect(context.project.system.actionCombat?.enabled).toBe(true);
      expect((result.diff?.warnings ?? []).join(" ")).toContain("turned real-time action combat on");
    });

    it("make_action_enemy rejects invalid profiles and unknown troops", () => {
      const context: ToolContext = { project: createBlankProject() };
      const mapId = context.project.startMapId;
      expect(runTool(context, "make_action_enemy", { enemyId: "enemy_x", name: "X", actionProfile: {} }).ok).toBe(false);
      expect(
        runTool(context, "make_action_enemy", {
          enemyId: "enemy_x",
          name: "X",
          actionProfile: { contactDamage: 2 },
          spawn: { mapId, troopId: "troop_ghost", area: { x: 0, y: 0, w: 2, h: 2 } },
        }).ok
      ).toBe(false);
    });

    it("preserves authored attacks during partial action profile edits", () => {
      const { context, enemy } = authoredEnemyFixture();
      const before = structuredClone(enemy);

      const result = runTool(context, "make_action_enemy", {
        enemyId: enemy.id,
        actionProfile: { aggroRange: 7 },
      });

      expect(result.ok, result.summary).toBe(true);
      const expected = { ...before, actionProfile: { ...before.actionProfile, aggroRange: 7 } };
      expect(context.project.database.enemies.find((entry) => entry.id === enemy.id)).toEqual(expected);
      const loaded = deserialize(serialize(context.project));
      expect(loaded.database.enemies.find((entry) => entry.id === enemy.id)).toEqual(expected);
    });

    it("replaces a supplied attack without discarding other authored profile fields", () => {
      const { context, enemy } = authoredEnemyFixture();
      const before = structuredClone(enemy);
      const attack = { kind: "dash", windupMs: 400, recoverMs: 300, damage: 21, range: 5 } as const;

      const result = runTool(context, "make_action_enemy", {
        enemyId: enemy.id,
        actionProfile: { attack },
      });

      expect(result.ok, result.summary).toBe(true);
      expect(context.project.database.enemies.find((entry) => entry.id === enemy.id)).toEqual({
        ...before,
        actionProfile: { ...before.actionProfile, attack },
      });
    });

    it.each([
      { name: "quoted attack key", profile: { contactDamage: 8, '"attack"': { kind: "melee" } } },
      { name: "unknown profile key", profile: { contactDamage: 8, aggroRnage: 7 } },
      { name: "unknown attack kind", profile: { contactDamage: 8, attack: { kind: "beam", windupMs: 500, recoverMs: 300, damage: 8, range: 4 } } },
      { name: "missing attack fields", profile: { contactDamage: 8, attack: { kind: "projectile", damage: 8 } } },
      { name: "unknown attack key", profile: { attack: { kind: "projectile", windupMs: 500, recoverMs: 300, damage: 8, range: 4, projectileSpeed: 9 } } },
      { name: "invalid movement value", profile: { contactDamage: 8, moveIntervalMs: "fast" } },
      { name: "non-finite damage", profile: { contactDamage: Number.NaN } },
      { name: "non-object attack", profile: { contactDamage: 8, attack: [] } },
      { name: "unknown extra attack kind", profile: { attack: { kind: "melee", windupMs: 500, recoverMs: 300, damage: 8, range: 1 }, extraAttacks: [{ kind: "beam", windupMs: 500, recoverMs: 300, damage: 8, range: 4 }] } },
    ])("rejects malformed action profiles without mutation: $name", ({ profile }) => {
      const { context, enemy } = authoredEnemyFixture();
      const before = serialize(context.project);

      const result = runTool(context, "make_action_enemy", {
        enemyId: enemy.id,
        actionProfile: profile,
      });

      expect(result.ok).toBe(false);
      expect(result.issues?.some((issue) => issue.code === "invalid-args")).toBe(true);
      expect(serialize(context.project)).toBe(before);
    });

    it.each(["melee", "projectile", "dash"] as const)("accepts a complete %s attack", (kind) => {
      const { context, enemy } = authoredEnemyFixture();

      const result = runTool(context, "make_action_enemy", {
        enemyId: enemy.id,
        actionProfile: { attack: { kind, windupMs: 500, recoverMs: 300, damage: 8, range: 4 } },
      });

      expect(result.ok, result.summary).toBe(true);
      expect(context.project.database.enemies.find((entry) => entry.id === enemy.id)?.actionProfile?.attack?.kind).toBe(kind);
    });

    it("retains contact-only enemy creation", () => {
      const context: ToolContext = { project: createBlankProject() };

      const result = runTool(context, "make_action_enemy", {
        enemyId: "contact_only_enemy",
        name: "Contact-only enemy",
        monsterResourceId: "generated-enemy-slime-01",
        actionProfile: { contactDamage: 6 },
      });

      expect(result.ok, result.summary).toBe(true);
      expect(context.project.database.enemies.find((entry) => entry.id === "contact_only_enemy")?.actionProfile).toEqual({ contactDamage: 6 });
    });
  });
});

// 짧은 능력치 곡선 입력 — 99칸 미만 배열이 말없이 기본 곡선(Lv1 HP 514)으로 바뀌던 것(2026-09-24 도그푸딩).
describe("actorShortParameterCurves", () => {
  isolateTimers();
  describe("upsert_actor 짧은 parameterCurves", () => {
    it("[Lv1, Lv99] 두 끝값을 곡선으로 채워 전투 능력치에 반영한다", () => {
      const ctx = { project: createBlankProject() };
      const result = runTool(ctx, "upsert_actor", {
        actor: { id: "actor_hero", parameterCurves: { maxHp: [160, 3200], maxMp: [12, 240], defense: [30, 300] } },
      }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      const actor = ctx.project.database.actors.find((entry) => entry.id === "actor_hero")!;
      expect(actor.parameterCurves.maxHp).toHaveLength(99);
      expect(actor.parameterCurves.maxHp[0]).toBe(160);
      expect(actor.parameterCurves.maxHp[98]).toBe(3200);
      expect(JSON.stringify(result.diff?.warnings)).toContain("parameterCurves 짧은 배열");
      const [hero] = actorBattlers(ctx.project, { partyActorIds: ["actor_hero"], levels: { actor_hero: 1 } });
      expect(hero!.maxHp).toBe(160);
      expect(hero!.maxMp).toBe(12);
    });

    it("[Lv1] 하나만 주면 기본 비율로 자라고, 레벨 1..n 배열은 마지막 증가폭으로 이어 간다", () => {
      const ctx = { project: createBlankProject() };
      expect(runTool(ctx, "upsert_actor", { actor: { id: "actor_hero", parameterCurves: { maxHp: [100], agility: [20, 22, 25] } } }, { dryRun: false }).ok).toBe(true);
      const curves = ctx.project.database.actors.find((entry) => entry.id === "actor_hero")!.parameterCurves;
      expect(curves.maxHp[0]).toBe(100);
      expect(curves.maxHp[98]).toBe(1000);
      expect(curves.agility.slice(0, 5)).toEqual([20, 22, 25, 28, 31]);
    });

    it("99칸 배열은 그대로 두고, 직업 곡선을 고치면 배우 곡선이 정본이라고 알린다", () => {
      const ctx = { project: createBlankProject() };
      const full = Array.from({ length: 99 }, (_, index) => 50 + index);
      expect(runTool(ctx, "upsert_actor", { actor: { id: "actor_hero", parameterCurves: { maxHp: full } } }, { dryRun: false }).ok).toBe(true);
      expect(ctx.project.database.actors.find((entry) => entry.id === "actor_hero")!.parameterCurves.maxHp).toEqual(full);
      const klass = ctx.project.database.actors.find((entry) => entry.id === "actor_hero")!.classId;
      const result = runTool(ctx, "upsert_class", { class: { id: klass, parameterCurves: { maxHp: [80, 1600] } } }, { dryRun: false });
      expect(result.ok, result.summary).toBe(true);
      expect(JSON.stringify(result.diff?.warnings)).toContain("배우 parameterCurves 가 정합니다");
    });
  });
});

describe("assistantRewriteGuard", () => {
  isolateTimers();
  // 실측(2026-10-07 조수 기능 시험): gpt-6.1-sol 이 가격 하나를 바꾸면서 읽은 회복약 레코드 전체를 되돌려 보냈고,
  // 원래 없던 farmTool·captureProfile 을 채우고 저장값 "noLimit" 을 정수 5 로 바꿨다. 거부하면 같은 호출을 다섯 번 반복했다.
  function projectWithPotion() {
    const project = createBlankProject();
    const potion = {
      id: "item_potion", name: "회복약", scope: "ally", price: 60, type: "medicine", occasion: "always", consumable: true,
      description: "아군 하나의 HP를 50 회복합니다.", consumptionLimit: "noLimit",
      hpRecovery: { flat: 50, percentMax: 0 }, mpRecovery: { flat: 0, percentMax: 0 },
      stateEffects: [], usableActorIds: [], usableClassIds: [], healStateIds: [],
    } as unknown as ItemRecord;
    project.database.items = [potion];
    return { project, potion };
  }
  function assistantCtx(project: ReturnType<typeof createBlankProject>): ToolContext {
    return { project, assistantRun: true };
  }
  describe("assistant whole-record rewrite guard", () => {
    it("applies only the changed existing fields of an echoed record", () => {
      const { project, potion } = projectWithPotion();
      const ctx = assistantCtx(project);
      const echoed = { ...potion, price: 30, consumptionLimit: 5, farmTool: "hoe", captureProfile: { multiplier: 1, ballClass: "poke" } };
      const result = runTool(ctx, "upsert_item", { item: echoed });
      expect(result.ok).toBe(true);
      const saved = ctx.project.database.items.find(item => item.id === "item_potion") as unknown as Record<string, unknown>;
      expect(saved.price).toBe(30);
      expect(saved.farmTool).toBeUndefined();
      expect(saved.captureProfile).toBeUndefined();
      expect(saved.consumptionLimit).not.toBe(5);
      expect(result.ok && result.diff.warnings.join(" ")).toContain("바뀐 칸 price 만 적용");
    });

    it("rejects an echo whose only differences are fields the record never had", () => {
      const { project, potion } = projectWithPotion();
      const result = runTool(assistantCtx(project), "upsert_item", { item: { ...potion, farmTool: "hoe" } });
      expect(result.ok).toBe(false);
    });

    it("keeps a minimal patch untouched", () => {
      const { project } = projectWithPotion();
      const ctx = assistantCtx(project);
      const result = runTool(ctx, "upsert_item", { item: { id: "item_potion", price: 30 } });
      expect(result.ok).toBe(true);
      expect(ctx.project.database.items[0]!.price).toBe(30);
    });

    it("does not store replacePages sent inside the event", () => {
      const project = createBlankProject();
      const mapId = Object.keys(project.maps)[0]!;
      const ctx: ToolContext = { project, assistantRun: true };
      const created = runTool(ctx, "upsert_event", { mapId, event: { id: "ev_probe", x: 1, y: 1, pages: [{ commands: [] }] } });
      expect(created.ok).toBe(true);
      const result = runTool(ctx, "upsert_event", {
        mapId, replacePages: true, event: { id: "ev_probe", replacePages: true, pages: [{ commands: [] }, { commands: [] }] },
      });
      expect(result.ok).toBe(true);
      const event = ctx.project.maps[mapId]!.events.find(entry => entry.id === "ev_probe") as unknown as Record<string, unknown>;
      expect("replacePages" in event).toBe(false);
    });
  });
});
