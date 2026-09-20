import { numberField, selectField, selectLiteral } from "./databaseControls";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { store } from "@/project/store";
import type { SkillRecord } from "@/project/types";
import { el } from "@/util/dom";
const currentSkill = (record: SkillRecord): SkillRecord => store.getCurrent().database.skills.find((s) => s.id === record.id) ?? record;

export function actionSkillFields(record: SkillRecord, rerender: () => void): HTMLElement[] {
  const profile = record.actionSkill;
  const patchProfile = (mutate: (draft: NonNullable<SkillRecord["actionSkill"]>) => void): void => {
    const draft: NonNullable<SkillRecord["actionSkill"]> = structuredClone(
      currentSkill(record).actionSkill ?? { kind: "projectile", damage: 4, range: 8 }
    );
    mutate(draft);
    updateDatabaseRecord("skills", record.id, { actionSkill: draft });
  };
  const items = store.getCurrent().database.items;
  const fields: HTMLElement[] = [
    selectLiteral("필드 액션", "db-field-skill-action-enabled", profile ? "on" : "off", ["off", "on"], (value) => {
      if (value === "off") updateDatabaseRecord("skills", record.id, { actionSkill: undefined });
      else patchProfile(() => undefined);
      rerender();
    }),
  ];
  if (profile) {
    fields.push(
      selectLiteral("종류", "db-field-skill-action-kind", profile.kind, ["projectile", "melee", "dash", "trap"], (kind) => {
        patchProfile((draft) => { draft.kind = kind; }); rerender();
      }),
      numberField("재사용 대기(ms)", "db-field-skill-action-cooldown", profile.cooldownMs ?? 350,
        (value) => patchProfile((draft) => { draft.cooldownMs = value; }), { min: 50, max: 30000 }),
      selectLiteral("필드 상태", "db-field-skill-action-status", profile.fieldStatus?.kind ?? "none", ["none", "poison", "slow"], (kind) => {
        patchProfile((draft) => { draft.fieldStatus = kind === "none" ? undefined : { kind, durationMs: 3000 }; }); rerender();
      }),
      numberField("데미지", "db-field-skill-action-damage", profile.damage, (value) =>
        patchProfile((draft) => {
          draft.damage = value;
        }), { min: 1, max: 9999 }
      ),
      numberField("사거리", "db-field-skill-action-range", profile.range, (value) =>
        patchProfile((draft) => {
          draft.range = value;
        }), { min: 1, max: 20 }
      ),
      selectField("탄약", "db-field-skill-action-ammo", profile.itemCost?.itemId ?? "", [{ id: "", name: "없음(MP만 소모)" }, ...items], (value) => {
        const had = Boolean(currentSkill(record).actionSkill?.itemCost);
        patchProfile((draft) => {
          draft.itemCost = value ? { itemId: value, amount: draft.itemCost?.amount ?? 1 } : undefined;
        });
        // 탄약 유무가 바뀔 때만 다시 그린다 — 같은 상태에서 재렌더하면 포커스만 잃는다.
        if (had !== Boolean(value)) rerender();
      })
    );
    if (profile.kind === "projectile" || profile.kind === "dash") fields.push(
      numberField("속도(타일/초)", "db-field-skill-action-speed", profile.speedTilesPerSec ?? 6,
        (value) => patchProfile((draft) => { draft.speedTilesPerSec = value; }), { min: 1, max: 30 }));
    fields.push(el("p", { class: "db-skill-card-note", text: "근접은 정면 범위, 돌진은 충돌 전까지 이동, 함정은 정면 사거리 끝에 설치됩니다. 독은 초당 최대 HP의 5%, 둔화는 이동·공격 속도 50%입니다." }));
    if (profile.itemCost) {
      fields.push(
        numberField("발당 소모", "db-field-skill-action-ammo-amount", profile.itemCost.amount, (value) =>
          patchProfile((draft) => {
            if (draft.itemCost) draft.itemCost.amount = value;
          }), { min: 1, max: 99 }
        )
      );
    }
  }
  if (profile?.kind === "trap") fields.push(numberField("함정 수명(ms)", "db-field-skill-action-duration", profile.durationMs ?? 5000,
    (value) => patchProfile((draft) => { draft.durationMs = value; }), { min: 100, max: 30000 }));
  if (profile?.fieldStatus) fields.push(numberField("상태 수명(ms)", "db-field-skill-action-status-duration", profile.fieldStatus.durationMs,
    (value) => patchProfile((draft) => { if (draft.fieldStatus) draft.fieldStatus.durationMs = value; }), { min: 100, max: 30000 }));
  const labels: Record<string, string> = { on: "사용", off: "사용 안 함", projectile: "투사체", melee: "근접", dash: "돌진", trap: "설치 · 함정", none: "없음", poison: "독", slow: "둔화" };
  for (const field of fields) for (const option of field.querySelectorAll("option")) {
    if (labels[option.value]) option.textContent = labels[option.value]!;
  }
  return fields;
}

