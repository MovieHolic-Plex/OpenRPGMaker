import { describe, expect, it, afterEach, beforeEach } from "vitest";
import { isActionCombatMap, normalizeActionCombatConfig, normalizeActionSkillProfile, normalizeActionWeaponProfile, normalizeEnemyActionAttack, normalizeEnemyActionProfile, resolveActionCombatConfig } from "@/project/actionCombat";
import { createBlankProject, TILE } from "@/project/defaults";
import type { GameMap, EquipmentRecord, CharacterFootprint, Dir } from "@/project/types";
import { renderEquipmentRecordForm } from "@/editor/panels/databaseEquipmentRecordView";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";
import { cellInArc, expandRect, swingArcCells, swingArcCellsFromBody, swingArcOverlapsBody, swingArcOverlapsPoint } from "@/battle/action/hitbox";
import { contactRectTouches, contactTouches, shouldApplyContactDamage } from "@/battle/action/contact";
import { createFieldSpawnRuntime, materializeFieldSpawnEvents } from "@/player/fieldSpawns";
import { footprintBounds } from "@/project/footprint";
import { runtimeEventView } from "@/project/runtimeEventState";
import { computeContactDamage, computeSwingDamage } from "@/battle/action/combatMath";
import { aiActivityFamilySource } from "@/editor/aiActivityNarration";
import { toolGroup, toolIconKey } from "@/editor/panels/aiToolLabels";
import { isolateTimers } from "./mergedTeardown";

describe("actionCombatConfig", () => {
  isolateTimers();
  function mapWith(flags: Partial<GameMap>): GameMap {
    return { actionCombat: undefined, ...flags } as unknown as GameMap;
  }
  describe("normalizeActionCombatConfig", () => {
    it("returns undefined for absent config", () => {
      expect(normalizeActionCombatConfig(undefined)).toBeUndefined();
    });

    it("preserves explicit fields and clamps numbers", () => {
      const normalized = normalizeActionCombatConfig({
        enabled: true,
        playerIframesMs: 999999,
        swingCooldownMs: 1,
        hud: { stamina: true, enemyHpBars: "always" },
      });
      expect(normalized?.enabled).toBe(true);
      expect(normalized?.playerIframesMs).toBe(10000);
      expect(normalized?.swingCooldownMs).toBe(50);
      expect(normalized?.hud?.stamina).toBe(true);
      expect(normalized?.hud?.enemyHpBars).toBe("always");
    });

    it("drops invalid hud enum values", () => {
      const normalized = normalizeActionCombatConfig({ enabled: true, hud: { enemyHpBars: "bogus" as never } });
      expect(normalized?.hud).toBeUndefined();
    });
  });
  describe("normalizeActionWeaponProfile / normalizeActionSkillProfile", () => {
    it("normalizes weapon swing overrides", () => {
      expect(normalizeActionWeaponProfile({ swingRange: 2, swingCooldownMs: 200, swingDamageBonus: 3 })).toEqual({ swingRange: 2, swingCooldownMs: 200, swingDamageBonus: 3 });
      expect(normalizeActionWeaponProfile({ swingRange: 99 })).toEqual({ swingRange: 5 });
      expect(normalizeActionWeaponProfile({})).toBeUndefined();
    });

    it("normalizes action skills (projectile only)", () => {
      const skill = normalizeActionSkillProfile({ kind: "projectile", damage: 8, range: 8, speedTilesPerSec: 7 });
      expect(skill).toEqual({ kind: "projectile", damage: 8, range: 8, speedTilesPerSec: 7 });
      expect(normalizeActionSkillProfile({ kind: "beam" as never, damage: 1, range: 1 })).toBeUndefined();
    });
  });
  describe("normalizeEnemyActionAttack", () => {
    it("preserves a valid melee attack and clamps fields", () => {
      const attack = normalizeEnemyActionAttack({ kind: "melee", windupMs: 10, recoverMs: 600, damage: 6, range: 1, cooldownMs: 1500 });
      expect(attack?.kind).toBe("melee");
      expect(attack?.windupMs).toBe(100);
      expect(attack?.cooldownMs).toBe(1500);
    });

    it("rejects unknown kinds", () => {
      expect(normalizeEnemyActionAttack({ kind: "laser" as never, windupMs: 300, recoverMs: 300, damage: 1, range: 1 })).toBeUndefined();
    });

    it("nests inside action profiles", () => {
      const profile = normalizeEnemyActionProfile({
        contactDamage: 3,
        attack: { kind: "projectile", windupMs: 600, recoverMs: 500, damage: 4, range: 8, projectileSpeedTilesPerSec: 99 },
      });
      expect(profile?.attack?.kind).toBe("projectile");
      expect(profile?.attack?.projectileSpeedTilesPerSec).toBe(30);
    });
  });
  describe("normalizeEnemyActionProfile", () => {
    it("returns undefined when empty", () => {
      expect(normalizeEnemyActionProfile({})).toBeUndefined();
      expect(normalizeEnemyActionProfile(undefined)).toBeUndefined();
    });

    it("clamps knockbackResist into 0..1", () => {
      expect(normalizeEnemyActionProfile({ knockbackResist: 7 })?.knockbackResist).toBe(1);
    });
  });
  describe("isActionCombatMap / resolveActionCombatConfig", () => {
    it("requires both system enabled and map opt-in", () => {
      const project = createBlankProject();
      const map = mapWith({ actionCombat: true });
      expect(isActionCombatMap(project, map)).toBe(false);
      project.system.actionCombat = { enabled: true };
      expect(isActionCombatMap(project, map)).toBe(true);
      expect(isActionCombatMap(project, mapWith({}))).toBe(false);
    });

    it("resolves defaults when fields are omitted", () => {
      const project = createBlankProject();
      project.system.actionCombat = { enabled: true };
      const config = resolveActionCombatConfig(project);
      expect(config.playerIframesMs).toBe(800);
      expect(config.swingCooldownMs).toBe(350);
      expect(config.hearts).toBe(true);
      expect(config.stamina).toBe(false);
      expect(config.enemyHpBars).toBe("damaged");
    });
  });
});

describe("actionCombatEditorFields", () => {
  isolateTimers();
  function renderSystem(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    const rerender = (): void => {
      host.replaceChildren();
      renderSystemTab(host as unknown as HTMLElement, rerender);
    };
    rerender();
    return host;
  }
  function seedWeapon(): EquipmentRecord {
    const record = normalizeEquipmentRecord({ id: "equip_action_sword", name: "액션 검", slot: "weapon" });
    store.update((project) => {
      project.database.equipment = [record];
    });
    return store.getCurrent().database.equipment[0]!;
  }
  function renderWeaponForm(): FakeElement {
    const form = document.createElement("section") as unknown as FakeElement;
    const rerender = (): void => {
      form.replaceChildren();
      const current = store.getCurrent().database.equipment.find((entry) => entry.id === "equip_action_sword");
      if (!current) throw new Error("missing equipment equip_action_sword");
      renderEquipmentRecordForm(form as unknown as HTMLElement, current, rerender);
    };
    rerender();
    return form;
  }
  function fieldOf(host: FakeElement, testid: string): FakeElement {
    const node = findByTestId(host, testid);
    if (!node) throw new Error(`missing field ${testid}`);
    return node;
  }
  function typeNumber(host: FakeElement, testid: string, value: number): void {
    const input = fieldOf(host, testid);
    input.value = String(value);
    input.dispatchEvent(new Event("change"));
  }
  function toggle(host: FakeElement, testid: string, checked: boolean): void {
    const input = fieldOf(host, testid);
    input.checked = checked;
    input.dispatchEvent(new Event("change"));
  }
  function pick(host: FakeElement, testid: string, value: string): void {
    const select = fieldOf(host, testid);
    select.value = value;
    select.dispatchEvent(new Event("change"));
  }
  function actionCombat(): NonNullable<ReturnType<typeof store.getCurrent>["system"]["actionCombat"]> {
    const config = store.getCurrent().system.actionCombat;
    if (!config) throw new Error("missing system.actionCombat");
    return config;
  }
  function currentWeapon(): EquipmentRecord {
    const record = store.getCurrent().database.equipment.find((entry) => entry.id === "equip_action_sword");
    if (!record) throw new Error("missing equipment equip_action_sword");
    return record;
  }
  describe("액션 전투 시스템 필드 편집", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      project.system.actionCombat = { enabled: true };
      store.replace(project);
    });

    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });

    it("스키마의 모든 액션 전투 필드를 정규화 경계와 함께 노출한다", () => {
      // Break named: 회피/가드/HUD/4방향 필드가 UI 에 없어 JSON 편집으로만 튜닝 가능하다.
      const host = renderSystem();

      const numericBounds: readonly (readonly [string, number, number])[] = [
        ["db-field-system-action-combat-iframes", 0, 10000],
        ["db-field-system-action-combat-swing-cooldown", 50, 5000],
        ["db-field-system-action-combat-swing-bonus", 0, 9999],
        ["db-field-system-action-combat-dodge-stamina-cost", 0, 100],
        ["db-field-system-action-combat-dodge-iframes", 0, 3000],
        ["db-field-system-action-combat-guard-reduction", 0, 90],
        ["db-field-system-action-combat-guard-drain", 0, 100],
      ];
      for (const [testid, min, max] of numericBounds) {
        const input = fieldOf(host, testid);
        expect(input.getAttribute("min"), testid).toBe(String(min));
        expect(input.getAttribute("max"), testid).toBe(String(max));
      }

      expect(findByTestId(host, "db-field-system-action-combat-four-way")).not.toBeNull();
      expect(findByTestId(host, "db-field-system-action-combat-hud-hearts")).not.toBeNull();
      expect(findByTestId(host, "db-field-system-action-combat-hud-stamina")).not.toBeNull();
      expect(findByTestId(host, "db-field-system-action-combat-hud-enemy-hp-bars")).not.toBeNull();
    });

    it("액션 전투가 꺼져 있으면 상세 필드를 감춘다", () => {
      store.update((project) => {
        project.system.actionCombat = { enabled: false };
      });
      const host = renderSystem();

      expect(findByTestId(host, "db-field-system-action-combat")).not.toBeNull();
      expect(findByTestId(host, "db-field-system-action-combat-guard-reduction")).toBeNull();
      expect(findByTestId(host, "db-field-system-action-combat-hud-hearts")).toBeNull();
    });

    it("기본값이 아닌 편집만 프로젝트에 저장한다", () => {
      const host = renderSystem();

      typeNumber(host, "db-field-system-action-combat-dodge-stamina-cost", 10);
      typeNumber(host, "db-field-system-action-combat-dodge-iframes", 450);
      typeNumber(host, "db-field-system-action-combat-guard-reduction", 30);
      typeNumber(host, "db-field-system-action-combat-guard-drain", 5);
      expect(actionCombat()).toEqual({
        enabled: true,
        dodgeStaminaCost: 10,
        dodgeIframesMs: 450,
        guardDamageReductionPercent: 30,
        guardStaminaDrainPerSec: 5,
      });

      typeNumber(host, "db-field-system-action-combat-dodge-stamina-cost", 25);
      typeNumber(host, "db-field-system-action-combat-dodge-iframes", 300);
      typeNumber(host, "db-field-system-action-combat-guard-reduction", 50);
      typeNumber(host, "db-field-system-action-combat-guard-drain", 20);
      expect(actionCombat()).toEqual({ enabled: true });
    });

    it("범위를 벗어난 입력은 정규화 클램프와 같은 값으로 잘린다", () => {
      const host = renderSystem();

      typeNumber(host, "db-field-system-action-combat-guard-reduction", 999);
      expect(actionCombat().guardDamageReductionPercent).toBe(90);
      typeNumber(host, "db-field-system-action-combat-dodge-iframes", -10);
      expect(actionCombat().dodgeIframesMs).toBe(0);
    });

    it("HUD 서브 설정과 4방향 이동을 기본값에서 벗어날 때만 저장한다", () => {
      const host = renderSystem();

      toggle(host, "db-field-system-action-combat-four-way", true);
      toggle(host, "db-field-system-action-combat-hud-hearts", false);
      toggle(host, "db-field-system-action-combat-hud-stamina", true);
      pick(host, "db-field-system-action-combat-hud-enemy-hp-bars", "always");
      expect(actionCombat()).toEqual({
        enabled: true,
        fourWayMovement: true,
        hud: { hearts: false, stamina: true, enemyHpBars: "always" },
      });

      toggle(host, "db-field-system-action-combat-four-way", false);
      toggle(host, "db-field-system-action-combat-hud-hearts", true);
      toggle(host, "db-field-system-action-combat-hud-stamina", false);
      pick(host, "db-field-system-action-combat-hud-enemy-hp-bars", "damaged");
      expect(actionCombat()).toEqual({ enabled: true });
    });
  });
  describe("액션 무기 프로필 편집", () => {
    let restoreDom: (() => void) | undefined;

    beforeEach(() => {
      restoreDom = installFakeDom();
      const project = createBlankProject();
      project.system.actionCombat = { enabled: true };
      store.replace(project);
      seedWeapon();
    });

    afterEach(() => {
      restoreDom?.();
      restoreDom = undefined;
    });

    it("장비 레코드에 액션 스윙 필드를 정규화 경계와 함께 노출한다", () => {
      // Break named: ActionWeaponProfile 은 스키마·런타임만 있고 편집 패널이 없다.
      const form = renderWeaponForm();

      // #166 이 29개 탭을 공용 워크스페이스로 옮기며 panel → card 로 이름을 바꿨다.
      // 필드 testid(db-field-equipment-action-weapon-*)와 동작은 그대로다.
      expect(findByTestId(form, "db-equipment-card-action-weapon")).not.toBeNull();
      const bounds: readonly (readonly [string, number, number])[] = [
        ["db-field-equipment-action-weapon-swing-range", 1, 5],
        ["db-field-equipment-action-weapon-swing-cooldown", 50, 5000],
        ["db-field-equipment-action-weapon-swing-bonus", 0, 9999],
      ];
      for (const [testid, min, max] of bounds) {
        const input = fieldOf(form, testid);
        expect(input.getAttribute("min"), testid).toBe(String(min));
        expect(input.getAttribute("max"), testid).toBe(String(max));
      }
    });

    it("기본값이 아닌 스윙 값만 레코드에 남긴다", () => {
      const form = renderWeaponForm();

      typeNumber(form, "db-field-equipment-action-weapon-swing-range", 3);
      typeNumber(form, "db-field-equipment-action-weapon-swing-cooldown", 500);
      typeNumber(form, "db-field-equipment-action-weapon-swing-bonus", 7);
      expect(currentWeapon().actionWeapon).toEqual({ swingRange: 3, swingCooldownMs: 500, swingDamageBonus: 7 });

      typeNumber(form, "db-field-equipment-action-weapon-swing-range", 1);
      typeNumber(form, "db-field-equipment-action-weapon-swing-cooldown", 350);
      typeNumber(form, "db-field-equipment-action-weapon-swing-bonus", 0);
      expect(currentWeapon().actionWeapon).toBeUndefined();
    });

    it("범위를 벗어난 스윙 reach 는 normalizeActionWeaponProfile 과 같은 값으로 잘린다", () => {
      const form = renderWeaponForm();

      typeNumber(form, "db-field-equipment-action-weapon-swing-range", 99);
      expect(currentWeapon().actionWeapon).toEqual({ swingRange: 5 });
    });
  });
});

// 액션 전투가 **몸 사각 전체**로 판정하는지 — 2차 스펙 §8.
//
// 사용자 결정: 통행만 하단 N행으로 줄이고 **조사·전투는 몸 전체**다. 그래서 3x3 골렘의
// 상체를 때려도 유효타이고, 상체 옆에 선 플레이어도 접촉 피해를 받는다.
//
// 판별력 규칙: 프로브는 앵커 칸/앵커 행을 겨냥하지 않는다. 앵커는 1x1 이어도 같은 결과라
// 아무것도 증명하지 않는다. 몸 사각의 **상체 행**을 겨눈다.
describe("actionCombatFootprint", () => {
  isolateTimers();
  const GOLEM: CharacterFootprint = { width: 3, height: 3 };
  const UNIT: CharacterFootprint = { width: 1, height: 1 };
  describe("swingArcOverlapsBody — 상체만 걸려도 유효타", () => {
    it("1x1 은 점 판정과 완전히 같다(항등)", () => {
      for (const facing of ["up", "down", "left", "right"] as const) {
        for (let x = 2; x <= 8; x += 1) {
          for (let y = 2; y <= 8; y += 1) {
            expect(swingArcOverlapsBody(facing, 5, 5, 1, x, y, UNIT)).toBe(
              swingArcOverlapsPoint(facing, 5, 5, 1, x, y)
            );
          }
        }
      }
    });

    it("플레이어 눈앞에 상체가 있으면 맞는다 — 앵커는 두 칸 아래라 안 걸렸다", () => {
      // 플레이어 (5,5) 가 위를 본다 → 호는 (5,4) 중심. 골렘 앵커는 (5,6) 이고 몸은 4..6 행.
      // 앵커 판정: (5,6) 은 호에 없다 → 빗나감. 몸 판정: 상체 칸 (5,4) 가 호 안 → 명중.
      expect(swingArcOverlapsPoint("up", 5, 5, 1, 5, 6)).toBe(false);
      expect(swingArcOverlapsBody("up", 5, 5, 1, 5, 6, GOLEM)).toBe(true);
    });

    it("몸이 호 밖이면 빗나간다", () => {
      // 앵커 (5,10) → 몸 8..10 행. 위를 보는 호는 (5,4) 근처라 몸에 닿지 않는다.
      expect(swingArcOverlapsBody("up", 5, 5, 1, 5, 10, GOLEM)).toBe(false);
    });

    it("걸음 보간 중인 소수 앵커도 몸으로 판정한다", () => {
      // x = 5.4 면 몸은 4.4..6.4 열. 호 (6,5) 는 그 안이라 명중.
      expect(swingArcOverlapsBody("right", 5, 5, 1, 5.4, 5, { width: 3, height: 1 })).toBe(true);
    });
  });
  describe("swingArcCellsFromBody — 몸 사각에서 뻗는 호", () => {
    it("1x1 은 기존 호와 완전히 같다(항등)", () => {
      for (const facing of ["up", "down", "left", "right"] as const) {
        for (const range of [1, 2, 3]) {
          expect(swingArcCellsFromBody(facing, 5, 5, range, UNIT)).toEqual(
            swingArcCells(facing, 5, 5, range)
          );
        }
      }
    });

    it("3x3 이 오른쪽을 보면 세 행 모두에서 팔이 나간다", () => {
      const arc = swingArcCellsFromBody("right", 5, 7, 1, GOLEM);
      // 몸은 x 4..6, y 5..7. 오른쪽 한 칸은 x=7 의 세 행 전부.
      for (const y of [5, 6, 7]) expect(cellInArc(arc, 7, y)).toBe(true);
      // 앵커 행만 보던 시절에는 (7,5) 가 호에 없었다.
      expect(cellInArc(swingArcCells("right", 5, 7, 1), 7, 5)).toBe(false);
    });

    it("자기 몸 칸은 호에서 뺀다 — 예고 음영이 몸을 덮으면 안 된다", () => {
      const body = footprintBounds(5, 7, GOLEM);
      for (const cell of swingArcCellsFromBody("right", 5, 7, 1, GOLEM)) {
        const inside =
          cell.x >= body.left && cell.x <= body.right && cell.y >= body.top && cell.y <= body.bottom;
        expect(inside).toBe(false);
      }
    });

    it("칸이 중복되지 않는다", () => {
      const arc = swingArcCellsFromBody("down", 5, 7, 2, GOLEM);
      expect(new Set(arc.map((cell) => `${cell.x},${cell.y}`)).size).toBe(arc.length);
    });
  });
  describe("expandRect", () => {
    it("사방으로 넓힌다", () => {
      expect(expandRect({ left: 4, right: 6, top: 5, bottom: 7 }, 1)).toEqual({
        left: 3,
        right: 7,
        top: 4,
        bottom: 8,
      });
    });
  });
  describe("접촉 피해 — 몸 사각 인접", () => {
    const PLAYER = [{ x: 5, y: 4 }] as const;

    it("1x1 사각은 체비셰프 1 과 같은 집합이다(항등)", () => {
      for (let x = 2; x <= 8; x += 1) {
        for (let y = 1; y <= 7; y += 1) {
          const rect = { left: x, right: x, top: y, bottom: y };
          expect(contactRectTouches(rect, PLAYER)).toBe(contactTouches({ x, y }, PLAYER));
        }
      }
    });

    it("골렘 머리 옆에 선 플레이어도 접촉이다 — 앵커에서는 2칸이라 안 닿았다", () => {
      // 앵커 (5,7) → 몸 y 5..7. 플레이어 (5,4) 는 상체 (5,5) 바로 위.
      const body = footprintBounds(5, 7, GOLEM);
      expect(contactTouches({ x: 5, y: 7 }, PLAYER)).toBe(false);
      expect(contactRectTouches(body, PLAYER)).toBe(true);
      expect(
        shouldApplyContactDamage({
          enemyTile: { x: 5, y: 7 },
          enemyBody: body,
          playerTiles: PLAYER,
          mode: "combat",
          moving: true,
        })
      ).toBe(true);
    });

    it("몸 사각을 주지 않으면 예전 앵커 판정 그대로다(항등)", () => {
      expect(
        shouldApplyContactDamage({ enemyTile: { x: 5, y: 7 }, playerTiles: PLAYER, mode: "combat", moving: true })
      ).toBe(false);
    });

    it("멈춰 있는 적은 몸이 닿아도 접촉 피해가 없다 — 거리를 좁히는 적만이라는 규칙은 그대로", () => {
      expect(
        shouldApplyContactDamage({
          enemyTile: { x: 5, y: 7 },
          enemyBody: footprintBounds(5, 7, GOLEM),
          playerTiles: PLAYER,
          mode: "combat",
          moving: false,
        })
      ).toBe(false);
    });
  });
  function projectWithSpawn(footprint?: CharacterFootprint, passRows?: number) {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    // TILE.GRASS (240) is not open ground on the default beodeul_city sheet; floor the map with its own plain ground tile.
    map.lowerTiles.fill(map.lowerTiles[0]!);
    const troopId = project.database.troops[0]!.id;
    map.fieldSpawns = [
      {
        id: "spawn_golem",
        troopId,
        area: { x: 4, y: 4, w: 4, h: 4 },
        maxAlive: 1,
        respawnSec: 5,
        ...(footprint ? { footprint } : {}),
        ...(passRows !== undefined ? { passRows } : {}),
      },
    ];
    store.replace(project);
    return { project, map };
  }
  describe("필드 스폰 — 합성 페이지가 몸 크기를 싣는다", () => {
    it("3x3 · 통행 1행 스폰이 런타임 뷰에서 3x3 으로 보인다", () => {
      const { project, map } = projectWithSpawn(GOLEM, 1);
      const state = createFieldSpawnRuntime(project, map, { x: 15, y: 15 });
      const instance = state.entries[0]?.alive[0];
      expect(instance?.footprint).toEqual(GOLEM);
      expect(instance?.passRows).toBe(1);

      const [event] = materializeFieldSpawnEvents(state);
      if (!event) throw new Error("spawn event missing");
      const view = runtimeEventView(event, {}, {});
      expect(view.footprint).toEqual(GOLEM);
      expect(view.passRows).toBe(1);
      // 통행 사각은 발밑 한 줄, 몸 사각은 세 줄.
      expect(view.passRect.top).toBe(view.passRect.bottom);
      expect(view.bodyRect.bottom - view.bodyRect.top).toBe(2);
    });

    it("발자국 없는 스폰은 1x1 이고 통행 사각 === 몸 사각이다(항등)", () => {
      const { project, map } = projectWithSpawn();
      const state = createFieldSpawnRuntime(project, map, { x: 15, y: 15 });
      const [event] = materializeFieldSpawnEvents(state);
      if (!event) throw new Error("spawn event missing");
      const view = runtimeEventView(event, {}, {});
      expect(view.footprint).toEqual(UNIT);
      expect(view.passRect).toEqual(view.bodyRect);
    });
  });
  describe("필드 스폰 배치 — 남의 몸통 안에 솟지 않는다", () => {
    it("2x2 이벤트의 비앵커 칸에는 스폰이 놓이지 않는다", () => {
      const { project, map } = projectWithSpawn();
      // 스폰 영역 4..7 을 앵커가 아닌 몸으로 덮는 2x2 이벤트.
      // 앵커 (4,5) → 몸 x 4..5, y 4..5. 앵커 칸만 등록하던 시절에는 (5,4)·(4,4)·(5,5) 가 비어 보였다.
      map.events = [
        {
          id: "wall_golem",
          x: 4,
          y: 5,
          trigger: { kind: "action" },
          commands: [],
          pages: [
            {
              id: "p1",
              conditions: [],
              graphic: {},
              trigger: { kind: "action" },
              priority: "same",
              movement: { type: "fixed", speed: 3, frequency: 3 },
              commands: [],
              footprint: { width: 2, height: 2 },
            },
          ],
        },
      ];
      store.replace(project);
      const state = createFieldSpawnRuntime(project, map, { x: 15, y: 15 });
      const instance = state.entries[0]?.alive[0];
      expect(instance).toBeDefined();
      const covered = new Set(["4,4", "5,4", "4,5", "5,5"]);
      expect(covered.has(`${instance?.x},${instance?.y}`)).toBe(false);
    });

    it("3x3 스폰은 몸이 벽을 걸치는 칸에 앉지 않는다", () => {
      const { project, map } = projectWithSpawn(GOLEM);
      // 스폰 영역 x 4..7 · y 4..7. 몸이 위로 두 칸 자라므로 y 2..3 을 물에 잠기게 만들어
      // 앵커 y 4 를 전부 불가로 만든다. 앵커만 보던 판정은 (4,4) 를 골랐을 것이다.
      for (const y of [2, 3]) {
        for (let x = 0; x < map.width; x += 1) map.lowerTiles[y * map.width + x] = TILE.WATER;
      }
      store.replace(project);
      const state = createFieldSpawnRuntime(project, map, { x: 15, y: 15 });
      const instance = state.entries[0]?.alive[0];
      expect(instance).toBeDefined();
      expect(instance!.y).toBeGreaterThanOrEqual(6);
      const body = footprintBounds(instance!.x, instance!.y, GOLEM);
      expect(body.top).toBeGreaterThanOrEqual(4);
    });

    it("몸이 맵을 벗어나는 칸도 거른다", () => {
      const { project, map } = projectWithSpawn({ width: 3, height: 1 });
      map.fieldSpawns = [
        { id: "spawn_golem", troopId: project.database.troops[0]!.id, area: { x: 0, y: 3, w: 1, h: 1 }, maxAlive: 1, footprint: { width: 3, height: 1 } },
      ];
      store.replace(project);
      const state = createFieldSpawnRuntime(project, map, { x: 15, y: 15 });
      // 앵커 (0,3) 은 몸이 x -1 까지 뻗어 맵 밖이다 → 배치 실패.
      expect(state.entries[0]?.alive).toHaveLength(0);
    });
  });
  describe("적 스윙 방향 — 네 방향 모두 몸에서 뻗는다", () => {
    const CASES: readonly { readonly dir: Dir; readonly cell: readonly [number, number] }[] = [
      { dir: "up", cell: [4, 4] },
      { dir: "down", cell: [4, 8] },
      { dir: "left", cell: [3, 5] },
      { dir: "right", cell: [7, 5] },
    ];

    it("각 방향에서 상체/측면 비앵커 칸이 호에 든다", () => {
      for (const probe of CASES) {
        const arc = swingArcCellsFromBody(probe.dir, 5, 7, 1, GOLEM);
        expect(cellInArc(arc, probe.cell[0], probe.cell[1])).toBe(true);
      }
    });
  });
});

describe("actionCombatMath", () => {
  isolateTimers();
  describe("computeSwingDamage", () => {
    it("is attack plus bonus minus half defense, minimum 1", () => {
      const damage = computeSwingDamage({ attackerAttack: 20, defenderDefense: 10, bonus: 5, rand: () => 0.5 });
      expect(damage).toBe(20);
    });

    it("clamps to 1 when defense overwhelms attack", () => {
      const damage = computeSwingDamage({ attackerAttack: 4, defenderDefense: 99, bonus: 0, rand: () => 0.5 });
      expect(damage).toBe(1);
    });

    it("applies ±10% variance deterministically from rand", () => {
      const low = computeSwingDamage({ attackerAttack: 10, defenderDefense: 0, bonus: 0, rand: () => 0 });
      const high = computeSwingDamage({ attackerAttack: 10, defenderDefense: 0, bonus: 0, rand: () => 0.999 });
      expect(low).toBe(9);
      expect(high).toBe(11);
    });
  });
  describe("computeContactDamage", () => {
    it("prefers authored contactDamage reduced by quarter defense", () => {
      expect(computeContactDamage({ contactDamage: 8, enemyAttack: 99, defenderDefense: 8 })).toBe(6);
    });

    it("falls back to half attack when no profile", () => {
      expect(computeContactDamage({ contactDamage: undefined, enemyAttack: 12, defenderDefense: 0 })).toBe(6);
    });

    it("never drops below 1", () => {
      expect(computeContactDamage({ contactDamage: 1, enemyAttack: 1, defenderDefense: 99 })).toBe(1);
    });
  });
});

describe("actionCombatToolPresentation", () => {
  isolateTimers();
  it("classifies the action proof as an explicit inspection activity", () => {
    expect(toolGroup("run_action_combat_test")).toBe("inspect");
    expect(toolIconKey("run_action_combat_test")).toBe("shield");
    expect(aiActivityFamilySource("run_action_combat_test")).toBe("mapped");
  });
});
