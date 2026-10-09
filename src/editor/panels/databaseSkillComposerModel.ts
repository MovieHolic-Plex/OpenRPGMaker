import type { DatabaseCollection } from "@/editor/databaseActions";
import type { Project, SkillRecord } from "@/project/types";
import { specialSkillEffectLabel } from "@/battle/battleSpecialEffects";

export type SkillComposerChipKind = "activation" | "target" | "cost";
export type SkillComposerEffectKind = "primary" | "element" | "states" | "animation";
export type SkillBacklinkCollection =
  | Extract<DatabaseCollection, "actors" | "classes" | "items" | "equipment" | "enemies">
  | "monsterSpecies";

export type SkillComposerChip = {
  readonly kind: SkillComposerChipKind;
  readonly label: string;
};

export type SkillComposerEffectBlock = {
  readonly kind: SkillComposerEffectKind;
  readonly title: string;
  readonly summary: string;
};

export type SkillBacklink = {
  readonly collection: SkillBacklinkCollection;
  readonly id: string;
  readonly name: string;
  readonly relationship: string;
};

export type SkillComposerModel = {
  readonly chips: readonly SkillComposerChip[];
  readonly effectBlocks: readonly SkillComposerEffectBlock[];
  readonly backlinks: readonly SkillBacklink[];
};

export function deriveSkillComposerModel(project: Project, record: SkillRecord): SkillComposerModel {
  return {
    chips: [
      { kind: "activation", label: activationLabel(record.type) },
      { kind: "target", label: targetLabel(record.scope) },
      { kind: "cost", label: costLabel(record.mpCost) },
    ],
    effectBlocks: [
      { kind: "primary", title: "주 효과", summary: primaryEffectSummary(project, record) },
      { kind: "element", title: "속성", summary: elementSummary(project, record) },
      { kind: "states", title: "상태 변화", summary: stateEffectsSummary(project, record) },
      { kind: "animation", title: "애니메이션", summary: animationSummary(project, record) },
    ],
    backlinks: deriveBacklinks(project, record.id),
  };
}

function activationLabel(type: SkillRecord["type"]): string {
  switch (type) {
    case "normal": return "일반 스킬";
    case "teleport": return "순간 이동";
    case "escape": return "도주";
    case "switch": return "스위치";
  }
}

function targetLabel(scope: SkillRecord["scope"]): string {
  switch (scope) {
    case "self": return "자신";
    case "ally": return "아군 1명";
    case "allAllies": return "아군 전체";
    case "enemy": return "적 1명";
    case "allEnemies": return "적 전체";
  }
}

function costLabel(cost: SkillRecord["mpCost"]): string {
  const flat = cost.flat > 0 ? `MP ${cost.flat}` : "";
  const percent = cost.percentMax > 0 ? `최대 MP ${cost.percentMax}%` : "";
  if (flat && percent) return `${flat} + ${percent}`;
  return flat || percent || "MP 소모 없음";
}

function primaryEffectSummary(project: Project, record: SkillRecord): string {
  const accuracy = `성공 ${record.successRate}% · 명중 ${record.hitRate}%`;
  switch (record.effect.kind) {
    case "damage":
      return `${resourceLabel(record.effect.affects)} 피해 · ${statisticLabel(record.effect.statistic)} 기반 · 위력 ${record.power} · ${accuracy}`;
    case "healing":
      return `${resourceLabel(record.effect.affects)} 회복 · 마력 기반 · 위력 ${record.power} · ${accuracy}`;
    case "support":
      return `지원 효과 · ${accuracy}`;
    case "switch": {
      const switchId = record.effect.switchId;
      const target = switchId
        ? project.switches.find((entry) => entry.id === switchId)
        : undefined;
      const label = target ? target.name || target.id : switchId;
      return label ? `스위치 ON · ${label} · ${accuracy}` : `스위치 ON · 대상 미지정 · ${accuracy}`;
    }
    default:
      return `${specialSkillEffectLabel(record.effect)} · ${accuracy}`;
  }
}

function resourceLabel(affects: "hp" | "mp"): string {
  return affects === "hp" ? "HP" : "MP";
}

function statisticLabel(statistic: "attack" | "mind"): string {
  return statistic === "attack" ? "공격" : "마력";
}

function elementSummary(project: Project, record: SkillRecord): string {
  if (!record.elementId) return "무속성";
  return project.database.elements?.find((entry) => entry.id === record.elementId)?.name || record.elementId;
}

function stateEffectsSummary(project: Project, record: SkillRecord): string {
  const effects = record.stateEffects ?? [];
  if (effects.length === 0) return "상태 변화 없음";
  return effects.map((effect) => {
    const state = project.database.states.find((entry) => entry.id === effect.stateId);
    const name = state?.name || state?.id || effect.stateId;
    const operation = effect.operation === "add" ? "부여" : "해제";
    return `${name} ${operation} ${effect.chance}%`;
  }).join(" · ");
}

function animationSummary(project: Project, record: SkillRecord): string {
  if (!record.animationId) return "애니메이션 없음";
  const animation = project.database.battleAnimations.find((entry) => entry.id === record.animationId);
  return animation?.name || animation?.id || record.animationId;
}

function deriveBacklinks(project: Project, skillId: string): SkillBacklink[] {
  const backlinks: SkillBacklink[] = [];
  for (const actor of project.database.actors) {
    const levels = matchingLevels(actor.learnedSkills, skillId);
    if (levels.length === 0) continue;
    backlinks.push({ collection: "actors", id: actor.id, name: actor.name, relationship: learnedAtLabel(levels) });
  }
  for (const klass of project.database.classes) {
    const levels = matchingLevels(klass.learnedSkills, skillId);
    const relationships: string[] = [];
    if (levels.length > 0) relationships.push(learnedAtLabel(levels));
    else if (klass.skillIds.includes(skillId)) relationships.push("스킬 목록");
    if (klass.battleCommands.some((command) => command.skillId === skillId)) relationships.push("전투 명령");
    if (relationships.length === 0) continue;
    backlinks.push({ collection: "classes", id: klass.id, name: klass.name, relationship: relationships.join(" · ") });
  }
  for (const item of project.database.items) {
    const relationships: string[] = [];
    if (item.learnedSkillId === skillId) relationships.push("스킬 습득");
    if (item.activateSkillId === skillId) relationships.push("스킬 발동");
    if (item.skillId === skillId && relationships.length === 0) relationships.push("연결 스킬");
    if (relationships.length === 0) continue;
    backlinks.push({ collection: "items", id: item.id, name: item.name, relationship: relationships.join(" · ") });
  }
  for (const equipment of project.database.equipment) {
    const relationships: string[] = [];
    if (equipment.skillId === skillId) relationships.push("장비 스킬");
    if (equipment.usableAsItemSkillId === skillId) relationships.push("사용 스킬");
    if (relationships.length === 0) continue;
    backlinks.push({ collection: "equipment", id: equipment.id, name: equipment.name, relationship: relationships.join(" · ") });
  }
  for (const enemy of project.database.enemies) {
    const relationships: string[] = [];
    if (enemy.skillIds.includes(skillId)) relationships.push("스킬 목록");
    const actionNumbers = enemy.actions.flatMap((action, index) => action.skillId === skillId ? [index + 1] : []);
    if (actionNumbers.length > 0) relationships.push(`행동 ${actionNumbers.join("/")}`);
    if (relationships.length === 0) continue;
    backlinks.push({ collection: "enemies", id: enemy.id, name: enemy.name, relationship: relationships.join(" · ") });
  }
  for (const species of project.database.monsterSpecies ?? []) {
    const levels = matchingLevels(species.skillsByLevel ?? [], skillId);
    if (levels.length === 0) continue;
    backlinks.push({ collection: "monsterSpecies", id: species.id, name: species.name, relationship: learnedAtLabel(levels) });
  }
  return backlinks;
}

function matchingLevels(entries: readonly { readonly level: number; readonly skillId: string }[], skillId: string): number[] {
  return [...new Set(entries.filter((entry) => entry.skillId === skillId).map((entry) => entry.level))].sort((left, right) => left - right);
}

function learnedAtLabel(levels: readonly number[]): string {
  return `Lv ${levels.join("/")} 습득`;
}
