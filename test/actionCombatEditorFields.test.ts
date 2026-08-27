import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderEquipmentRecordForm } from "@/editor/panels/databaseEquipmentRecordView";
import { renderSystemTab } from "@/editor/panels/databaseSystemView";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EquipmentRecord } from "@/project/types";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

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

    expect(findByTestId(form, "db-equipment-panel-action-weapon")).not.toBeNull();
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
