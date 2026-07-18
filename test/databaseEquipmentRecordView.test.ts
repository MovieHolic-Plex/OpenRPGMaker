import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  equipmentEffectSummaryChips,
  renderEquipmentRecordForm,
} from "@/editor/panels/databaseEquipmentRecordView";
import { normalizeEquipmentRecord } from "@/project/databaseRecordModel";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { EquipmentRecord, ItemEquipmentEffectFlags } from "@/project/types";
import { FakeElement, findByTestId, installFakeDom } from "./fakeDom";

let restoreDom: (() => void) | undefined;

function allFlagsFalse(): ItemEquipmentEffectFlags {
  return {
    preemptive: false,
    doubleAttack: false,
    attackAll: false,
    ignoreDodge: false,
    preventCriticalHits: false,
    increasePhysicalDodge: false,
    halfMpCost: false,
    negateTerrainDamage: false,
    fixedEquipment: false,
  };
}

function seedEquipment(patch: Partial<EquipmentRecord> = {}): EquipmentRecord {
  const record = normalizeEquipmentRecord({
    id: "equip_sword",
    name: "검",
    twoHanded: false,
    cursed: false,
    effectFlags: allFlagsFalse(),
    attackElementIds: [],
    elementalDefenseIds: [],
    stateInflictIds: [],
    stateDefenseIds: [],
    ...patch,
  });
  store.update((project) => {
    project.database.equipment = [record];
  });
  return store.getCurrent().database.equipment[0]!;
}

function renderForm(recordId = "equip_sword"): FakeElement {
  const form = document.createElement("section") as unknown as FakeElement;
  const record = store.getCurrent().database.equipment.find((entry) => entry.id === recordId);
  if (!record) throw new Error(`missing equipment ${recordId}`);
  const rerender = (): void => {
    form.replaceChildren();
    const current = store.getCurrent().database.equipment.find((entry) => entry.id === record.id) ?? record;
    renderEquipmentRecordForm(form as unknown as HTMLElement, current, rerender);
  };
  rerender();
  return form;
}

function chipTexts(host: FakeElement): string[] {
  const row = findByTestId(host, "db-equipment-summary-chips");
  if (!row) throw new Error("missing summary chip row");
  return row.childNodes
    .map((node) => ("textContent" in node ? String(node.textContent ?? "") : ""))
    .map((text) => text.trim())
    .filter(Boolean);
}

beforeEach(() => {
  restoreDom = installFakeDom();
  store.replace(createBlankProject());
  seedEquipment();
});

afterEach(() => {
  restoreDom?.();
  restoreDom = undefined;
});

describe("equipmentEffectSummaryChips (pure)", () => {
  it("maps doubleAttack to 2회 공격", () => {
    const summary = equipmentEffectSummaryChips(
      normalizeEquipmentRecord({
        id: "equip_test",
        name: "테스트",
        effectFlags: { ...allFlagsFalse(), doubleAttack: true },
      }),
    );
    expect(summary.flags).toContain("2회 공격");
  });

  it("returns empty collections when all flags/badges/counts are off", () => {
    const summary = equipmentEffectSummaryChips(
      normalizeEquipmentRecord({ id: "equip_empty", name: "빈 장비", effectFlags: allFlagsFalse() }),
    );
    expect(summary.flags).toEqual([]);
    expect(summary.badges).toEqual([]);
    expect(summary.counts).toEqual([]);
  });

  it("includes twoHanded and cursed badges", () => {
    const summary = equipmentEffectSummaryChips(
      normalizeEquipmentRecord({
        id: "equip_badge",
        name: "배지",
        twoHanded: true,
        cursed: true,
        effectFlags: allFlagsFalse(),
      }),
    );
    expect(summary.badges).toEqual(["양손 장비", "저주"]);
  });
});

describe("equipment detail-form summary chips (G004)", () => {
  it("shows 2회 공격 chip when doubleAttack is true", () => {
    seedEquipment({ effectFlags: { ...allFlagsFalse(), doubleAttack: true } });
    const host = renderForm();
    expect(chipTexts(host)).toContain("2회 공격");
    expect(findByTestId(host, "db-equipment-summary-empty")).toBeNull();
  });

  it("shows muted 효과 없음 when every effect flag/badge/count is empty", () => {
    seedEquipment();
    const host = renderForm();
    const empty = findByTestId(host, "db-equipment-summary-empty");
    expect(empty).not.toBeNull();
    expect(empty?.textContent).toBe("효과 없음");
    expect(chipTexts(host)).toEqual(["효과 없음"]);
  });

  it("shows twoHanded and cursed badges when set", () => {
    seedEquipment({ twoHanded: true, cursed: true });
    const host = renderForm();
    const texts = chipTexts(host);
    expect(texts).toContain("양손 장비");
    expect(texts).toContain("저주");
    expect(findByTestId(host, "db-equipment-summary-empty")).toBeNull();
  });

  it("rebuilds chips from currentEquipment after doubleAttack toggle (no stale empty)", () => {
    seedEquipment();
    const host = renderForm();
    expect(findByTestId(host, "db-equipment-summary-empty")?.textContent).toBe("효과 없음");

    const double = findByTestId(host, "db-field-equipment-effect-double");
    if (!double) throw new Error("missing doubleAttack control");
    double.checked = true;
    double.dispatchEvent(new Event("change"));

    expect(store.getCurrent().database.equipment[0]?.effectFlags.doubleAttack).toBe(true);
    const texts = chipTexts(host);
    expect(texts).toContain("2회 공격");
    expect(findByTestId(host, "db-equipment-summary-empty")).toBeNull();

    // Flip off again — chip row must track currentEquipment, not the initial snapshot.
    double.checked = false;
    double.dispatchEvent(new Event("change"));
    expect(store.getCurrent().database.equipment[0]?.effectFlags.doubleAttack).toBe(false);
    expect(findByTestId(host, "db-equipment-summary-empty")?.textContent).toBe("효과 없음");
    expect(chipTexts(host)).toEqual(["효과 없음"]);
  });
});
