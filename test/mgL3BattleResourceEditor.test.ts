// 전투 자원·감정·장비 부여·장비 강화의 편집기 노출(#7 #9 #16 #21 #23). 폼에서 바꾼 값이 저장값에 닿는지 본다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { renderSkillRecordForm } from "@/editor/panels/databaseSkillRecordView";
import { renderStateRecordForm } from "@/editor/panels/databaseStateRecordView";
import { renderEquipmentRecordForm } from "@/editor/panels/databaseEquipmentRecordView";
import { parseEmotionCycle, renderSystemTab } from "@/editor/panels/databaseSystemView";
import { renderLifeCraftingTab } from "@/editor/panels/databaseLifeCraftingView";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { findByTestId, installFakeDom, type FakeElement } from "./fakeDom";

let restoreDom: (() => void) | undefined;

beforeEach(() => {
  restoreDom = installFakeDom();
  const project = createBlankProject();
  project.database.states = [{ id: "state_joy", name: "기쁨" }];
  project.database.equipment = [
    normalizeEquipmentRecord({ id: "equip_blade", name: "검", slot: "weapon" }),
    normalizeEquipmentRecord({ id: "equip_blade_plus", name: "검+", slot: "weapon" }),
  ];
  store.replace(project);
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

function byTestId(root: FakeElement, testid: string): FakeElement {
  const node = findByTestId(root, testid);
  if (!node) throw new Error(`missing ${testid}`);
  return node;
}

function change(root: FakeElement, testid: string, value: string): void {
  const node = byTestId(root, testid);
  node.value = value;
  node.dispatchEvent(new Event("change"));
}

function check(root: FakeElement, testid: string, checked: boolean): void {
  const node = byTestId(root, testid);
  node.checked = checked;
  node.dispatchEvent(new Event("change"));
}

describe("skill form: battle resource costs", () => {
  it("writes resource2Cost / limitSkill / partyGaugeCost and clears them at zero", () => {
    const skillId = store.getCurrent().database.skills[0]!.id;
    const form = document.createElement("section") as unknown as FakeElement;
    renderSkillRecordForm(form as unknown as HTMLElement, store.getCurrent().database.skills[0]!);
    const current = () => store.getCurrent().database.skills.find((skill) => skill.id === skillId)!;
    change(form, "db-field-skill-resource2-cost", "30");
    check(form, "db-field-skill-limit", true);
    change(form, "db-field-skill-party-gauge-cost", "50");
    expect(current()).toMatchObject({ resource2Cost: 30, limitSkill: true, partyGaugeCost: 50 });
    change(form, "db-field-skill-resource2-cost", "0");
    check(form, "db-field-skill-limit", false);
    expect(current().resource2Cost).toBeUndefined();
    expect(current().limitSkill).toBeUndefined();
  });
});

describe("state form: emotion family and tier", () => {
  it("sets the family, then the tier, and clearing the family removes the emotion", () => {
    const current = () => store.getCurrent().database.states[0]!;
    const render = (): FakeElement => {
      const form = document.createElement("section") as unknown as FakeElement;
      renderStateRecordForm(form as unknown as HTMLElement, current());
      return form;
    };
    change(render(), "db-state-emotion-family", "기쁨");
    expect(current().emotion).toEqual({ family: "기쁨", tier: 1 });
    change(render(), "db-state-emotion-tier", "3");
    expect(current().emotion).toEqual({ family: "기쁨", tier: 3 });
    change(render(), "db-state-emotion-family", "");
    expect(current().emotion).toBeUndefined();
  });
});

describe("equipment form: grants and half MP", () => {
  it("toggles granted skills, sets a granted skill command, and exposes the half-MP flag", () => {
    const skillId = store.getCurrent().database.skills[0]!.id;
    const current = () => store.getCurrent().database.equipment.find((record) => record.id === "equip_blade")!;
    const form = document.createElement("section") as unknown as FakeElement;
    const rerender = (): void => {
      form.replaceChildren();
      renderEquipmentRecordForm(form as unknown as HTMLElement, current(), rerender);
    };
    rerender();
    check(form, `db-field-equipment-grant-skill-${skillId}`, true);
    expect(current().grantsSkillIds).toEqual([skillId]);
    change(form, "db-field-equipment-grant-command-skill", skillId);
    expect(current().grantsCommand).toMatchObject({ id: "cmd_equip_equip_blade", kind: "skill", skillId });
    check(form, "db-field-equipment-effect-half-mp", true);
    expect(current().effectFlags.halfMpCost).toBe(true);
    check(form, `db-field-equipment-grant-skill-${skillId}`, false);
    change(form, "db-field-equipment-grant-command-skill", "");
    expect(current().grantsSkillIds).toBeUndefined();
    expect(current().grantsCommand).toBeUndefined();
  });
});

describe("system tab: battle resources", () => {
  // 시스템 탭은 HUD 편집기(databaseFieldHud)까지 한꺼번에 그리는데, 그 편집기가 ResizeObserver 를
  // 무조건 만든다. 공용 fakeDom 에는 없다(actionCombatEditorFields 도 같은 이유로 깨져 있다) —
  // 이 파일에서만 관찰을 하지 않는 대역을 끼운다. 검사 대상(전투 자원 필드)은 크기와 무관하다.
  let restoreResizeObserver: (() => void) | undefined;
  beforeEach(() => {
    const scope = globalThis as { ResizeObserver?: unknown };
    const previous = scope.ResizeObserver;
    scope.ResizeObserver = class { observe(): void {} unobserve(): void {} disconnect(): void {} };
    restoreResizeObserver = () => { scope.ResizeObserver = previous; };
  });
  afterEach(() => restoreResizeObserver?.());

  function renderSystem(): FakeElement {
    const host = document.createElement("div") as unknown as FakeElement;
    const rerender = (): void => {
      host.replaceChildren();
      renderSystemTab(host as unknown as HTMLElement, rerender);
    };
    rerender();
    return host;
  }

  it("enables and disables each gauge, the weakness option, and parses the emotion cycle", () => {
    const system = () => store.getCurrent().system;
    check(renderSystem(), "db-field-system-limit-gauge", true);
    check(renderSystem(), "db-field-system-resource2", true);
    check(renderSystem(), "db-field-system-party-gauge", true);
    check(renderSystem(), "db-field-system-weakness-extra-action", true);
    expect(system().limitGauge?.enabled).toBe(true);
    expect(system().resource2?.enabled).toBe(true);
    expect(system().partyGauge?.enabled).toBe(true);
    expect(system().weaknessExtraAction).toBe(true);
    change(renderSystem(), "db-field-system-resource2-max", "60");
    expect(system().resource2?.max).toBe(60);
    change(renderSystem(), "db-field-system-emotion-cycle", "기쁨>분노=1.5\n엉터리\n분노 > 슬픔 = 2");
    expect(system().emotionCycle).toEqual([
      { attackerFamily: "기쁨", targetFamily: "분노", multiplier: 1.5 },
      { attackerFamily: "분노", targetFamily: "슬픔", multiplier: 2 },
    ]);
    check(renderSystem(), "db-field-system-limit-gauge", false);
    check(renderSystem(), "db-field-system-weakness-extra-action", false);
    change(renderSystem(), "db-field-system-emotion-cycle", "");
    expect(system().limitGauge).toBeUndefined();
    expect(system().weaknessExtraAction).toBeUndefined();
    expect(system().emotionCycle).toBeUndefined();
  });

  it("parseEmotionCycle drops malformed and negative lines", () => {
    expect(parseEmotionCycle("a>b=-1\na>b\n>b=2\nx>y=0.5")).toEqual([{ attackerFamily: "x", targetFamily: "y", multiplier: 0.5 }]);
  });
});

describe("life crafting: equipment upgrade target", () => {
  it("switching an upgrade row to equipment lists equipment and stores target", () => {
    const host = document.createElement("div") as unknown as FakeElement;
    const rerender = (): void => {
      host.replaceChildren();
      renderLifeCraftingTab(host as unknown as HTMLElement, rerender);
    };
    rerender();
    byTestId(host, "db-life-section-upgrades").click();
    byTestId(host, "db-life-add").click();
    check(host, "db-life-upgrade-target-equipment", true);
    const rule = () => store.getCurrent().system.itemUpgrades![0]!;
    expect(rule()).toMatchObject({ target: "equipment", fromItemId: "equip_blade", toItemId: "equip_blade" });
    change(host, "db-life-upgrade-to-item", "equip_blade_plus");
    expect(rule().toItemId).toBe("equip_blade_plus");
    check(host, "db-life-upgrade-target-equipment", false);
    expect(rule().target).toBeUndefined();
  });
});
