import { numberField, selectLiteral, textField } from "@/editor/panels/databaseControls";
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { store } from "@/project/store";
import type { SkillEffect, SkillRecord } from "@/project/types";
import { el } from "@/util/dom";

const SKILL_EFFECT_KINDS = ["damage", "healing", "support", "switch"] as const satisfies readonly SkillEffect["kind"][];
const SKILL_EFFECT_AFFECTS = ["hp", "mp"] as const satisfies readonly SkillEffectAffects[];
const SKILL_DAMAGE_STATS = ["attack", "mind"] as const satisfies readonly SkillDamageStatistic[];

type SkillEffectAffects = Extract<SkillEffect, { kind: "damage" | "healing" }>["affects"];
type SkillDamageStatistic = Extract<SkillEffect, { kind: "damage" }>["statistic"];

export function renderSkillRecordForm(form: HTMLElement, record: SkillRecord): void {
  form.append(
    textField("설명", "db-field-skill-description", record.description, (description) =>
      updateDatabaseRecord("skills", record.id, { description })
    ),
    selectLiteral("종류", "db-field-skill-type", record.type, ["normal", "teleport", "escape", "switch"], (type) =>
      updateDatabaseRecord("skills", record.id, { type })
    ),
    panel("소모와 명중", [
      numberField("MP", "db-field-skill-mp-flat", record.mpCost.flat, (flat) =>
        updateDatabaseRecord("skills", record.id, { mpCost: { ...currentSkill(record).mpCost, flat } })
      ),
      numberField("MP %", "db-field-skill-mp-percent", record.mpCost.percentMax, (percentMax) =>
        updateDatabaseRecord("skills", record.id, { mpCost: { ...currentSkill(record).mpCost, percentMax } })
      ),
      numberField("성공률", "db-field-skill-success", record.successRate, (successRate) =>
        updateDatabaseRecord("skills", record.id, { successRate })
      ),
      numberField("명중률", "db-field-skill-hit-rate", record.hitRate, (hitRate) =>
        updateDatabaseRecord("skills", record.id, { hitRate })
      ),
      numberField("분산", "db-field-skill-variance", record.variance, (variance) =>
        updateDatabaseRecord("skills", record.id, { variance })
      ),
    ]),
    panel("효과", [
      selectLiteral("효과", "db-field-skill-effect-kind", record.effect.kind, SKILL_EFFECT_KINDS, (kind) =>
        updateSkillEffectKind(record, kind)
      ),
      selectLiteral("계산", "db-field-skill-effect-statistic", skillDamageStatistic(record.effect), SKILL_DAMAGE_STATS, (statistic) =>
        updateSkillDamageStatistic(record, statistic)
      ),
      selectLiteral("대상 값", "db-field-skill-effect-affects", skillEffectAffects(record.effect), SKILL_EFFECT_AFFECTS, (affects) =>
        updateSkillEffectAffects(record, affects)
      ),
    ])
  );
}

function panel(title: string, children: readonly HTMLElement[]): HTMLElement {
  return el("fieldset", { class: "db-advanced-panel", children: [el("legend", { text: title }), ...children] });
}

function updateSkillEffectKind(record: SkillRecord, kind: SkillEffect["kind"]): void {
  const effect = currentSkill(record).effect;
  switch (kind) {
    case "damage":
      updateDatabaseRecord("skills", record.id, {
        effect: { kind, statistic: skillDamageStatistic(effect), affects: skillEffectAffects(effect) },
      });
      return;
    case "healing":
      updateDatabaseRecord("skills", record.id, { effect: { kind, statistic: "mind", affects: skillEffectAffects(effect) } });
      return;
    case "support":
      updateDatabaseRecord("skills", record.id, { effect: { kind } });
      return;
    case "switch":
      updateDatabaseRecord("skills", record.id, { effect: { kind } });
      return;
    default:
      assertNever(kind);
  }
}

function updateSkillDamageStatistic(record: SkillRecord, statistic: SkillDamageStatistic): void {
  const effect = currentSkill(record).effect;
  if (effect.kind === "damage") {
    updateDatabaseRecord("skills", record.id, { effect: { ...effect, statistic } });
    return;
  }
  updateDatabaseRecord("skills", record.id, { effect: { kind: "damage", statistic, affects: skillEffectAffects(effect) } });
}

function updateSkillEffectAffects(record: SkillRecord, affects: SkillEffectAffects): void {
  const effect = currentSkill(record).effect;
  if (effect.kind === "damage" || effect.kind === "healing") {
    updateDatabaseRecord("skills", record.id, { effect: { ...effect, affects } });
    return;
  }
  updateDatabaseRecord("skills", record.id, { effect: { kind: "healing", statistic: "mind", affects } });
}

function skillDamageStatistic(effect: SkillEffect): SkillDamageStatistic {
  return effect.kind === "damage" ? effect.statistic : "mind";
}

function skillEffectAffects(effect: SkillEffect): SkillEffectAffects {
  return effect.kind === "damage" || effect.kind === "healing" ? effect.affects : "hp";
}

function currentSkill(record: SkillRecord): SkillRecord {
  return store.getCurrent().database.skills.find((skill) => skill.id === record.id) ?? record;
}

function assertNever(value: never): never {
  throw new Error(`Unhandled skill effect kind: ${value}`);
}
