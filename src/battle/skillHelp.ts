/**
 * 기술 도움말 한 벌 — 전투 기술 목록·연계 목록의 도움말 창, 필드 메뉴 스킬 화면, 결과 화면 「새 기술 습득」 카드,
 * 편집기 미리보기가 **같은 문장**을 쓴다(2026-10-24, 사용자 「스킬 설명을 볼 수가 없다」).
 *
 * 꼬리표는 레코드 값에서 기계적으로 뽑는다 — 저작자가 설명을 안 써도 「적 전체 · 냉기 · 둔화 40%」가 나오고,
 * 설명은 그 위에 「무엇을 노리는 기술인가」 한 줄을 더한다. 숫자는 레코드 그대로(추측 없음).
 */
import type { Project, SkillRecord } from "@/project/types";
import { statStageEffectText } from "@/battle/statStages";
import { battleSkillMpCostFor } from "@/battle/battleSkillUse";
import { resolveTerms } from "@/project/terms";

export interface SkillHelpUser {
  readonly recordId?: string;
  readonly maxMp: number;
  readonly equipmentEffects?: { readonly halfMpCost?: boolean };
}

export interface SkillHelp {
  readonly name: string;
  readonly description: string;
  /** 「MP 10」 — 사용자를 주면 장비 절반·연계 몫까지 반영. 0 이면 「MP 0」. */
  readonly cost: string;
  /** 「적 전체」·「냉기」·「둔화 40%」… 순서: 대상 → 속성 → 위력/회복 → 타수 → 상태 → 특수. */
  readonly tags: readonly string[];
  /** 연계기면 참가자 이름(시전자 포함, 저작 순서). */
  readonly comboNames?: readonly string[];
}

const SCOPE_LABEL: Record<SkillRecord["scope"], string> = {
  self: "자신", ally: "아군 1명", allAllies: "아군 전체", enemy: "적 1명", allEnemies: "적 전체",
};

function stateName(project: Project, stateId: string): string {
  return project.database.states.find((state) => state.id === stateId)?.name ?? stateId;
}

/** 새 프로젝트 기본 속성 이름은 영어(「Fire」「Sword」)다 — 한국어 게임의 전투 목록에 영어 꼬리표가 그대로 보였다(jrpg-loop-1 실측). 작가가 이름을 바꾸지 않은 기본 이름일 때만 한글로 보인다. */
const DEFAULT_ELEMENT_DISPLAY_KO: Readonly<Record<string, readonly [english: string, korean: string]>> = {
  sword: ["Sword", "검"], spear: ["Spear", "창"], hit: ["Hit", "타격"], bow: ["Bow", "활"],
  fire: ["Fire", "화염"], ice: ["Ice", "빙결"], thunder: ["Thunder", "번개"], water: ["Water", "물"],
  earth: ["Earth", "대지"], wind: ["Wind", "바람"], holy: ["Holy", "신성"], dark: ["Dark", "암흑"],
  grass: ["Grass", "풀"],
};

/** 속성 표시 이름 — 기술 목록 배지·도움말 창이 같이 쓴다. */
export function elementDisplayName(project: Pick<Project, "database">, elementId: string): string {
  const name = (project.database.elements ?? []).find((element) => element.id === elementId)?.name ?? elementId;
  const known = DEFAULT_ELEMENT_DISPLAY_KO[elementId];
  return known && name === known[0] ? known[1] : name;
}

const elementName = elementDisplayName;

function actorName(project: Project, actorId: string): string {
  return project.database.actors.find((actor) => actor.id === actorId)?.name ?? actorId;
}

/** 방어를 보지 않는 피해 식인가 — 식이 있고 대상 방어(b.def)를 읽지 않으면 방어 무시로 읽힌다. */
function ignoresDefense(skill: SkillRecord): boolean {
  return Boolean(skill.damageFormula) && skill.effect.kind === "damage" && !/\bb\.def\b/u.test(skill.damageFormula!);
}

export function skillHelpTags(project: Project, skill: SkillRecord): string[] {
  const tags: string[] = [];
  tags.push(SCOPE_LABEL[skill.scope] + (skill.area ? "+주변" : ""));
  if (skill.elementId) tags.push(elementName(project, skill.elementId));
  const effect = skill.effect;
  if (effect.kind === "healing") tags.push(effect.affects === "mp" ? "MP 회복" : "HP 회복");
  else if (effect.kind === "damage") {
    if (effect.affects === "mp") tags.push("MP 피해");
    if (skill.power > 0) tags.push(`위력 ${skill.power}`);
  } else if (effect.kind === "steal") tags.push("훔치기");
  else if (effect.kind === "scan") tags.push("정보 보기");
  const hits = skill.hitSequence?.length ?? 0;
  if (hits > 1) tags.push(`${hits}연타`);
  else if (skill.multiHit) tags.push(`${skill.multiHit.min}~${skill.multiHit.max}연타`);
  if (skill.criticalRate !== undefined && skill.criticalRate >= 20) tags.push(`급소 ${skill.criticalRate}%`);
  if (ignoresDefense(skill)) tags.push("방어 무시");
  const removed: string[] = [];
  for (const row of skill.stateEffects ?? []) {
    const name = stateName(project, row.stateId);
    if (row.operation === "remove") removed.push(name);
    else tags.push(row.chance >= 100 ? name : `${name} ${row.chance}%`);
  }
  // 정화류는 지우는 상태가 열 가지가 넘기도 한다 — 셋까지만 이름, 나머지는 개수로.
  if (removed.length) tags.push(`${removed.length > 3 ? `${removed.slice(0, 2).join("·")} 외 ${removed.length - 2}종` : removed.join("·")} 해제`);
  for (const row of skill.statStageEffects ?? []) tags.push(statStageEffectText(row));
  if (skill.drainPercent) tags.push(`흡수 ${skill.drainPercent}%`);
  if (skill.recoilPercent) tags.push(`반동 ${skill.recoilPercent}%`);
  if (skill.hpCostPercent) tags.push(`HP 대가 ${skill.hpCostPercent}%`);
  if (skill.chargeTurns) tags.push(`${skill.chargeTurns}차례 모음`);
  if (skill.gaugeShift) tags.push(skill.gaugeShift < 0 ? "행동 지연" : "행동 앞당김");
  if (skill.flinchChance) tags.push(`풀죽음 ${skill.flinchChance}%`);
  if (skill.weaponAffinity) {
    const kinds = (skill.weaponAffinity.elementIds?.length ? skill.weaponAffinity.elementIds : skill.elementId ? [skill.elementId] : [])
      .map((id) => elementName(project, id)).join("·");
    tags.push(`${kinds || "무기"} 무기 +${skill.weaponAffinity.bonusPercent}%`);
  }
  if (skill.exploitStates) {
    const names = skill.exploitStates.stateIds.map((id) => stateName(project, id)).join("·");
    tags.push(`${names} 대상 +${skill.exploitStates.bonusPercent}%${skill.exploitStates.consume ? "(깨뜨림)" : ""}`);
  }
  if (skill.cooldownTurns) tags.push(`재사용 ${skill.cooldownTurns}차례`);
  if (skill.oncePerBattle) tags.push("전투당 1회");
  if (skill.comboCombinedStats) tags.push("합체 능력치");
  return tags;
}

export function skillHelp(project: Project, skill: SkillRecord, user?: SkillHelpUser): SkillHelp {
  const combo = skill.comboActorIds && skill.comboActorIds.length >= 2 ? skill.comboActorIds : undefined;
  const mpLabel = resolveTerms(project).mp || "MP";
  let cost: string;
  if (combo) {
    // 연계기는 참가자별 몫을 함께 보인다 — 「카엘 MP 4 · 엘레나 MP 8」.
    cost = combo.map((actorId) => `${actorName(project, actorId)} ${mpLabel} ${battleSkillMpCostFor(skill, { recordId: actorId, maxMp: user?.recordId === actorId ? user.maxMp : 0, ...(user?.recordId === actorId && user.equipmentEffects ? { equipmentEffects: user.equipmentEffects } : {}) })}`).join(" · ");
  } else {
    cost = `${mpLabel} ${user ? battleSkillMpCostFor(skill, user) : battleSkillMpCostFor(skill, { maxMp: 0 })}`;
  }
  return {
    name: skill.name,
    description: skill.description.trim(),
    cost,
    tags: skillHelpTags(project, skill),
    ...(combo ? { comboNames: combo.map((actorId) => actorName(project, actorId)) } : {}),
  };
}

/** 한 줄 꼬리표 — 「적 전체 · 냉기 · 둔화 40%」. */
export function skillHelpTagLine(help: Pick<SkillHelp, "tags">): string {
  return help.tags.join(" · ");
}

const SHORT_SCOPE: Record<SkillRecord["scope"], string> = {
  self: "자신", ally: "아군 1", allAllies: "아군 전체", enemy: "적 1", allEnemies: "적 전체",
};

/**
 * 전투 한 줄 도움말(2026-10-25, 사용자 「기술 도움말은 '카엘은 무엇을 할까?' 자리에 1줄로 짧게」) —
 * 「MP6 · 적 전체 · 냉기 · 둔화」. 비용 → 대상 → 속성 → 특징(가장 고유한 것 최대 둘). 위력·급소 같은 수치는 뺀다.
 * 연계기 비용은 「MP3+5」(참가자 순). 긴 설명은 필드 메뉴 「스킬」 화면과 결과 카드에만 있다.
 */
export function skillHelpOneLiner(project: Project, skill: SkillRecord, user?: SkillHelpUser): string {
  const mpLabel = resolveTerms(project).mp || "MP";
  const combo = skill.comboActorIds && skill.comboActorIds.length >= 2 ? skill.comboActorIds : undefined;
  const parts: string[] = [];
  if (combo) {
    parts.push(`${mpLabel}${combo.map((actorId) => battleSkillMpCostFor(skill, { recordId: actorId, maxMp: user?.recordId === actorId ? user.maxMp : 0 })).join("+")}`);
  } else {
    const mp = user ? battleSkillMpCostFor(skill, user) : battleSkillMpCostFor(skill, { maxMp: 0 });
    if (mp > 0) parts.push(`${mpLabel}${mp}`);
  }
  parts.push(SHORT_SCOPE[skill.scope] + (skill.area ? "+주변" : ""));
  if (skill.elementId) parts.push(elementName(project, skill.elementId));
  const hooks: string[] = [];
  const effect = skill.effect;
  if (skill.exploitStates?.stateIds.length) hooks.push(`${stateName(project, skill.exploitStates.stateIds[0]!)} 노림`);
  const added = (skill.stateEffects ?? []).filter((row) => row.operation === "add");
  const removed = (skill.stateEffects ?? []).filter((row) => row.operation === "remove");
  for (const row of added.slice(0, 2)) hooks.push(stateName(project, row.stateId));
  if (removed.length) hooks.push(removed.length > 2 ? "상태 해제" : `${removed.map((row) => stateName(project, row.stateId)).join("·")} 해제`);
  for (const row of (skill.statStageEffects ?? []).slice(0, 1)) hooks.push(statStageEffectText(row));
  if (skill.drainPercent) hooks.push("흡수");
  if (skill.gaugeShift) hooks.push(skill.gaugeShift < 0 ? "행동 지연" : "행동 앞당김");
  const hits = skill.hitSequence?.length ?? 0;
  if (hits > 1) hooks.push(`${hits}연타`);
  else if (skill.multiHit) hooks.push(`${skill.multiHit.min}~${skill.multiHit.max}연타`);
  if (skill.comboCombinedStats) hooks.push("합체");
  if (ignoresDefense(skill)) hooks.push("방어 무시");
  if (skill.criticalRate !== undefined && skill.criticalRate >= 30) hooks.push("급소↑");
  if (skill.weaponAffinity) hooks.push("무기 공명");
  if (!hooks.length) {
    if (effect.kind === "healing") hooks.push(effect.affects === "mp" ? "MP 회복" : "회복");
    else if (effect.kind === "steal") hooks.push("훔치기");
    else if (effect.kind === "scan") hooks.push("정보 보기");
    else if (effect.kind === "damage" && skill.power > 0) hooks.push(`위력 ${skill.power}`);
  }
  parts.push(...hooks.slice(0, 2));
  return parts.join(" · ");
}
