// 장비 탭 「마석 성장」 카드 본문: AP 영구 습득(apGrants·apRate)과 레벨업 보너스(levelUpBonus). 최소 UI —
// 같은 필드를 AI 도구 upsert_equipment 도 저작한다. 전투 규칙: src/battle/battleEsperAp.ts.
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { numberField, selectField } from "@/editor/panels/databaseControls";
import { store } from "@/project/store";
import type { EquipmentLevelUpBonus, EquipmentRecord } from "@/project/types";
import { el } from "@/util/dom";

function current(record: EquipmentRecord): EquipmentRecord {
  return store.getCurrent().database.equipment.find((equipment) => equipment.id === record.id) ?? record;
}

export function equipmentEsperHasContent(record: EquipmentRecord): boolean {
  return (record.apGrants?.length ?? 0) > 0 || record.apRate !== undefined || record.levelUpBonus !== undefined;
}

export function equipmentEsperFields(record: EquipmentRecord, rerender: () => void): HTMLElement[] {
  const skills = store.getCurrent().database.skills;
  const grants = record.apGrants ?? [];
  const nodes: HTMLElement[] = [
    el("p", { class: "db-field-hint", text: "장착한 배우가 전투 승리마다 적의 「마석 AP」를 쌓고, 필요 AP 를 채운 스킬을 영구히 배웁니다(장비를 벗어도 남음)." }),
    numberField("AP 습득률(%)", "db-field-equipment-ap-rate", record.apRate ?? 100, (value) => {
      updateDatabaseRecord("equipment", record.id, { apRate: value === 100 ? undefined : value });
    }, { min: 1, max: 1000 }),
  ];
  for (const grant of grants) {
    const name = skills.find((skill) => skill.id === grant.skillId)?.name ?? grant.skillId;
    nodes.push(el("div", {
      class: "db-eq-grid",
      dataset: { testid: `db-equipment-ap-grant-${grant.skillId}` },
      children: [
        numberField(`${name} — 필요 AP`, `db-field-equipment-ap-need-${grant.skillId}`, grant.ap, (value) => {
          const next = (current(record).apGrants ?? []).map((entry) => entry.skillId === grant.skillId ? { ...entry, ap: value } : entry);
          updateDatabaseRecord("equipment", record.id, { apGrants: next });
        }, { min: 1, max: 99999 }),
        el("button", {
          class: "btn small", text: "빼기", attrs: { type: "button" },
          dataset: { testid: `db-equipment-ap-remove-${grant.skillId}` },
          on: { click: () => {
            const next = (current(record).apGrants ?? []).filter((entry) => entry.skillId !== grant.skillId);
            updateDatabaseRecord("equipment", record.id, { apGrants: next.length > 0 ? next : undefined });
            rerender();
          } },
        }),
      ],
    }));
  }
  const addable = skills.filter((skill) => !grants.some((grant) => grant.skillId === skill.id));
  nodes.push(selectField("AP 로 배울 스킬 추가", "db-field-equipment-ap-add", "", addable, (skillId) => {
    if (!skillId) return;
    updateDatabaseRecord("equipment", record.id, { apGrants: [...(current(record).apGrants ?? []), { skillId, ap: 100 }] });
    rerender();
  }));
  const bonus = record.levelUpBonus ?? {};
  const bonusField = (key: keyof EquipmentLevelUpBonus, label: string, min: number, max: number): HTMLElement =>
    numberField(label, `db-field-equipment-levelup-${key}`, bonus[key] ?? 0, (value) => {
      const next = { ...(current(record).levelUpBonus ?? {}), [key]: value };
      updateDatabaseRecord("equipment", record.id, { levelUpBonus: next });
    }, { min, max });
  nodes.push(
    el("p", { class: "db-field-hint", text: "레벨업 보너스 — 장착한 배우가 레벨이 오를 때마다 영구히 받습니다(0 = 없음)." }),
    el("div", { class: "db-eq-grid", children: [
      bonusField("maxHpPercent", "최대 HP +%(곡선 기준)", 0, 100),
      bonusField("maxMpPercent", "최대 MP +%(곡선 기준)", 0, 100),
      bonusField("attack", "공격 +", -99, 99),
      bonusField("defense", "방어 +", -99, 99),
      bonusField("mind", "마력 +", -99, 99),
      bonusField("agility", "민첩 +", -99, 99),
    ] }),
  );
  return nodes;
}
