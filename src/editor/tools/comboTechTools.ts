// editor/tools/comboTechTools.ts
// 연계기(크로노 트리거식 듀얼·트리플 테크) 전용 도구 — list_combo_techs(읽기) · upsert_combo_tech(쓰기).
//
// 연계기는 SkillRecord 의 comboActorIds·comboRequires·comboMpCosts·comboCombinedStats 로 저장된다(전투 「연계」 명령이 연다).
// upsert_skill 로도 만들 수 있지만 필드가 흩어져 있어 조수가 「동료 둘이 함께 쓰는 기술」을 한 번에 저작하도록 묶었다.
// 실제 저장은 upsert_skill 의 검증·정규화를 그대로 지난다(같은 오류 메시지·같은 저장 모양).

import { comboLockedBy } from "@/battle/battleSkillUse";
import { skillHelp, skillHelpTagLine } from "@/battle/skillHelp";
import type { Project, SkillRecord } from "@/project/types";
import { DB_TOOLS } from "./dbTools";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

function techRow(project: Project, skill: SkillRecord) {
  const help = skillHelp(project, skill);
  const party = project.session.partyActorIds ?? project.system.startActorIds ?? [];
  // 시작 레벨 기준으로 열렸는가(해금 조건만 본다 — 전투 중 준비·MP 는 전투가 판정한다).
  const participants = (skill.comboActorIds ?? []).map((actorId) => {
    const actor = project.database.actors.find((record) => record.id === actorId);
    const classRecord = actor ? project.database.classes.find((record) => record.id === actor.classId) : undefined;
    const level = actor?.initialLevel ?? 1;
    const skillIds = [
      ...(actor?.learnedSkills ?? []).filter((row) => row.level <= level).map((row) => row.skillId),
      ...(classRecord?.learnedSkills ?? []).filter((row) => row.level <= level).map((row) => row.skillId),
    ];
    return { recordId: actorId, hp: 1, mp: 0, maxMp: 0, stateIds: [], ready: true, skillIds };
  });
  const locked = comboLockedBy(skill, participants);
  return {
    id: skill.id,
    name: skill.name,
    actors: help.comboNames ?? [],
    actorIds: [...(skill.comboActorIds ?? [])],
    cost: help.cost,
    tags: skillHelpTagLine(help),
    description: skill.description,
    requires: skill.comboRequires ?? [],
    combinedStats: skill.comboCombinedStats === true,
    choreographyId: skill.retroChoreographyId,
    inParty: (skill.comboActorIds ?? []).every((id) => party.includes(id)),
    unlockedAtStart: locked.length === 0,
    ...(locked.length ? { missing: locked } : {}),
  };
}

const listComboTechs: ToolDefinition = {
  name: "list_combo_techs",
  description: "연계기(듀얼·트리플 테크) 목록 — 참가 배우·비용 몫·해금 조건(comboRequires)·연출(retroChoreographyId)·지금 파티로 열렸는지. 연계기를 만들거나 고치기 전에 읽는다.",
  mode: "read",
  parameters: { type: "object", properties: { actorId: { type: "string", description: "이 배우가 낀 연계기만" } } },
  run(project, args): ToolExecResult {
    const actorId = typeof args.actorId === "string" ? args.actorId : undefined;
    const techs = project.database.skills
      .filter((skill) => (skill.comboActorIds?.length ?? 0) >= 2 && (!actorId || skill.comboActorIds!.includes(actorId)))
      .map((skill) => techRow(project, skill));
    return { summary: `연계기 ${techs.length}개`, data: { techs } };
  },
};

const upsertComboTech: ToolDefinition = {
  name: "upsert_combo_tech",
  description: [
    "연계기(크로노 트리거식 듀얼·트리플 테크)를 한 번에 만든다/고친다. 전투에서 참가자 전원이 준비되고 MP 가 있으면 명령 메뉴의 「연계」에 뜨고,",
    "쓰면 참가자 모두의 차례·MP(몫)를 쓰고 「연계!」 띠와 함께 도트 연출(choreographyId)이 재생된다.",
    "requires 로 「누가 무슨 기술을 배워야 열리는가」를 정한다(레벨 업으로 조건이 채워지면 결과 화면에 「새 연계기!」 카드).",
    "power 는 시전자 능력치 기준 — combinedStats:true 면 참가자 공격력·마력의 합이라 power 를 낮게(40~70).",
    "고칠 때는 id 와 바꿀 칸만. 저장은 upsert_skill 과 같은 검증을 지난다. 먼저 list_combo_techs·get_database_records(actors, skills)로 배우·기술 id 를 확인한다.",
  ].join(" "),
  mode: "write",
  domains: ["database", "battle"],
  parameters: {
    type: "object",
    properties: {
      id: { type: "string", description: "skill_combo_<영문> 처럼. 없는 id 면 새로 만든다" },
      name: { type: "string" },
      description: { type: "string", description: "게임 안 한 줄 — 무엇이 다른가(예: 「불붙은 검으로 두 번 베고 화상을 남긴다」)" },
      actorIds: { type: "array", items: { type: "string" }, description: "참가 배우 2~3명(첫째가 시전자 — 위력은 그 사람 능력치)" },
      requires: {
        type: "array",
        description: "해금 조건 [{actorId, skillId}] — 그 배우가 그 기술을 배워야 「연계」에 뜬다. 빈 배열 = 조건 없음",
        items: { type: "object", properties: { actorId: { type: "string" }, skillId: { type: "string" } }, required: ["actorId", "skillId"], additionalProperties: false },
      },
      mpCosts: {
        type: "array",
        description: "참가자별 MP 몫 [{actorId, mp}] — 비용 나누기. 생략한 참가자는 mp(공통) 를 낸다",
        items: { type: "object", properties: { actorId: { type: "string" }, mp: { type: "integer", minimum: 0 } }, required: ["actorId", "mp"], additionalProperties: false },
      },
      mp: { type: "integer", minimum: 0, description: "몫이 없는 참가자가 내는 MP(기본 0)" },
      scope: { type: "string", enum: ["enemy", "allEnemies", "ally", "allAllies", "self"] },
      kind: { type: "string", enum: ["damage", "healing", "support"], description: "damage(기본) · healing(HP 회복) · support(상태만)" },
      statistic: { type: "string", enum: ["attack", "mind"], description: "피해/회복 계열: attack(물리) · mind(마법). 기본 attack" },
      power: { type: "integer" },
      elementId: { type: "string", description: "속성 id(fire·ice·thunder·holy·sword …). 빈 문자열 = 없음" },
      hits: { type: "integer", minimum: 1, maximum: 8, description: "타수(같은 배율로 N번)" },
      combinedStats: { type: "boolean", description: "true = 참가자 전원의 공격력·마력 합으로 계산" },
      stateEffects: {
        type: "array",
        items: { type: "object", properties: { stateId: { type: "string" }, chance: { type: "integer" }, operation: { type: "string", enum: ["add", "remove"] } }, required: ["stateId", "chance", "operation"], additionalProperties: false },
      },
      exploitStates: {
        type: "object",
        description: "약점 공략: 대상이 이 상태면 피해 +bonusPercent%(consume 이면 그 상태를 깨뜨림)",
        properties: { stateIds: { type: "array", items: { type: "string" } }, bonusPercent: { type: "integer" }, consume: { type: "boolean" } },
        required: ["stateIds", "bonusPercent"],
        additionalProperties: false,
      },
      drainPercent: { type: "integer", minimum: 0, maximum: 100 },
      gaugeShift: { type: "integer", minimum: -100, maximum: 100, description: "맞은 적 행동 게이지 밀기(음수 = 늦추기)" },
      choreographyId: { type: "string", description: "도트 연출 — 계약 스킬 id 나 프로젝트 연출 chor_* (list_retro_choreographies). 연계기답게 큰 연출을 고른다" },
      switchId: { type: "string", description: "발동하면 켜지는 스위치(이야기 분기)" },
    },
    required: ["id"],
    additionalProperties: false,
  },
  invalidArgsExample: {
    id: "skill_combo_flame_cross", name: "불꽃 십자참", actorIds: ["actor_hero", "actor_mage"],
    requires: [{ actorId: "actor_hero", skillId: "skill_hero_cross_slash" }, { actorId: "actor_mage", skillId: "skill_mage_fireball" }],
    mpCosts: [{ actorId: "actor_hero", mp: 4 }, { actorId: "actor_mage", mp: 6 }], scope: "enemy", power: 70, elementId: "fire", hits: 2,
    choreographyId: "skill_hero_flame_sword", description: "불붙은 검으로 두 번 벤다.",
  },
  run(draft, args): ToolExecResult {
    const id = String(args.id ?? "").trim();
    if (!id) throw new ToolError("upsert_combo_tech: id 가 필요합니다. 예: skill_combo_flame_cross", { code: "invalid-args" });
    const existing = draft.database.skills.find((skill) => skill.id === id);
    if (!existing && (typeof args.name !== "string" || !Array.isArray(args.actorIds))) {
      throw new ToolError("새 연계기에는 name 과 actorIds(2~3명)가 필요합니다.", { code: "invalid-args" });
    }
    if (existing && !existing.comboActorIds?.length && !Array.isArray(args.actorIds)) {
      throw new ToolError(`${id} 는 연계기가 아닌 기술입니다. 연계기로 바꾸려면 actorIds 를 주거나, 일반 기술은 upsert_skill 로 고치세요.`, { code: "invalid-args" });
    }
    const skill: Record<string, unknown> = { id };
    if (typeof args.name === "string") skill.name = args.name;
    if (typeof args.description === "string") skill.description = args.description;
    if (Array.isArray(args.actorIds)) skill.comboActorIds = args.actorIds;
    if (Array.isArray(args.requires)) skill.comboRequires = args.requires;
    if (Array.isArray(args.mpCosts)) skill.comboMpCosts = args.mpCosts;
    if (typeof args.mp === "number") skill.mpCost = { flat: Math.max(0, Math.trunc(args.mp)), percentMax: 0 };
    else if (!existing) {
      // 공통 몫이 없으면 몫 중 가장 작은 값(몫이 전원에 있으면 쓰이지 않는다).
      const shares = Array.isArray(args.mpCosts) ? (args.mpCosts as Array<{ mp?: unknown }>).map((row) => Number(row.mp)).filter(Number.isFinite) : [];
      skill.mpCost = { flat: shares.length ? Math.min(...shares) : 0, percentMax: 0 };
    }
    if (typeof args.scope === "string") skill.scope = args.scope;
    else if (!existing) skill.scope = "enemy";
    const kind = typeof args.kind === "string" ? args.kind : existing ? undefined : "damage";
    if (kind) {
      const statistic = args.statistic === "mind" ? "mind" : args.statistic === "attack" ? "attack" : kind === "healing" ? "mind" : "attack";
      skill.effect = kind === "support" ? { kind: "support" } : kind === "healing" ? { kind: "healing", statistic: "mind", affects: "hp" } : { kind: "damage", statistic, affects: "hp" };
    } else if (args.statistic === "attack" || args.statistic === "mind") {
      const effect = existing?.effect;
      if (effect && (effect.kind === "damage" || effect.kind === "healing")) skill.effect = { ...effect, statistic: effect.kind === "healing" ? "mind" : args.statistic };
    }
    if (typeof args.power === "number") skill.power = Math.trunc(args.power);
    else if (!existing) skill.power = 60;
    if (typeof args.elementId === "string") skill.elementId = args.elementId.trim() || undefined;
    if (typeof args.hits === "number") skill.hitSequence = args.hits > 1 ? Array.from({ length: Math.min(8, Math.trunc(args.hits)) }, () => 1) : null;
    if (typeof args.combinedStats === "boolean") skill.comboCombinedStats = args.combinedStats;
    if (Array.isArray(args.stateEffects)) skill.stateEffects = args.stateEffects;
    if (args.exploitStates !== undefined) skill.exploitStates = args.exploitStates;
    if (typeof args.drainPercent === "number") skill.drainPercent = args.drainPercent;
    if (typeof args.gaugeShift === "number") skill.gaugeShift = args.gaugeShift;
    if (typeof args.choreographyId === "string") skill.retroChoreographyId = args.choreographyId;
    if (typeof args.switchId === "string") skill.comboSwitchId = args.switchId;
    if (!existing) {
      skill.type = "normal";
      skill.successRate = 100;
      skill.variance = 10;
      skill.hitRate = 100;
      skill.description ??= "";
    }
    if (skill.elementId === undefined && "elementId" in skill) delete skill.elementId;
    const upsert = DB_TOOLS.find((tool) => tool.name === "upsert_skill");
    if (!upsert) throw new ToolError("upsert_skill 도구가 없습니다.", { code: "internal" });
    const result = upsert.run(draft, { skill }) as ToolExecResult;
    const saved = draft.database.skills.find((record) => record.id === id);
    if (!saved?.comboActorIds?.length) throw new ToolError(`${id} 를 연계기로 저장하지 못했습니다(comboActorIds 가 비었다).`, { code: "invalid-combo-actors" });
    const row = techRow(draft, saved);
    const warnings = [...(result.warnings ?? [])];
    if (!saved.retroChoreographyId) warnings.push("choreographyId(도트 연출)가 없어 자동 추천 연출로 보입니다 — 연계기답게 list_retro_choreographies 에서 큰 연출을 골라 주세요.");
    if (!row.inParty) warnings.push(`참가자 중 지금 파티에 없는 배우가 있습니다(${row.actorIds.join(", ")}). 그 배우가 합류해야 「연계」에 뜹니다.`);
    return {
      summary: `연계기 '${saved.name}' ${existing ? "수정" : "추가"} — ${row.actors.join(" × ")} · ${row.cost}`,
      data: row,
      ...(warnings.length ? { warnings } : {}),
    };
  },
};

export const COMBO_TECH_TOOLS: readonly ToolDefinition[] = [listComboTechs, upsertComboTech];
