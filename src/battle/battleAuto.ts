import { battleActorSkillFailure, battlerSkillIdsWithGrants, comboParticipantsFromSnapshot, comboSkillIdsFor } from "@/battle/battleSkillUse";
import { areaTargets, resolveBattleTargets, targetIdFor } from "@/battle/battleTargetResolver";
import { predictSkillDamageFor } from "@/battle/battlePredict";
import type { ActorCommand, BattleBattlerSnapshot, BattleSnapshot } from "@/battle/types";
import { stateBehavior } from "@/battle/battleStates";
import type { Project, SkillRecord } from "@/project/types";
import type { Rng } from "@/util/rng";

export function chooseAutoBattleCommand(project: Project, snapshot: BattleSnapshot, rng: Rng): ActorCommand | undefined {
  if (snapshot.phase !== "actorCommand" || snapshot.result) return undefined;
  if (snapshot.forcedSwitchActorId) {
    const targetActorId = snapshot.switchCandidateActorIds[0];
    return targetActorId ? { kind: "switch", targetActorId } : undefined;
  }

  const actor = snapshot.actors.find((entry) => entry.recordId === snapshot.activeActorId);
  if (!actor || actor.defeated) return undefined;
  // 연계기는 배우지 않아도 연계 멤버에게 열린다 — 메뉴(battleCommandDom)와 같은 목록.
  const owned = battlerSkillIdsWithGrants(actor);
  const offered = [...owned, ...comboSkillIdsFor(project, actor.recordId, snapshot.actors.map((entry) => entry.recordId), owned)];
  const learned = offered
    .map((skillId) => project.database.skills.find((record) => record.id === skillId))
    .filter((skill): skill is SkillRecord => Boolean(skill))
    .filter((skill) => !battleActorSkillFailure(project, actor, skill.id, comboParticipantsFromSnapshot(snapshot), snapshot.partyGauge));

  const recovery = bestRecovery(project, snapshot, actor, learned, rng);
  if (recovery) return recovery;

  const attacks = learned.filter((skill) => skill.effect.kind === "damage");
  const attack = bestAttack(project, snapshot, actor, attacks, rng);
  if (attack) return attack;

  const fallbackSkill = fallbackLearnedSkill(snapshot, actor, learned, rng);
  if (fallbackSkill) return fallbackSkill;

  const enemies = snapshot.enemies.filter((enemy) => !enemy.defeated);
  const target = pickBest(enemies, (enemy) => -enemy.hp / Math.max(1, enemy.maxHp), rng);
  if (target) return { kind: "attack", targetEnemyId: target.id };
  return { kind: "defend" };
}

function fallbackLearnedSkill(
  snapshot: BattleSnapshot,
  actor: BattleBattlerSnapshot,
  skills: readonly SkillRecord[],
  rng: Rng,
): ActorCommand | undefined {
  const candidates: Array<{ readonly skill: SkillRecord; readonly target: BattleBattlerSnapshot; readonly side: "actor" | "enemy" }> = [];
  for (const skill of skills) {
    const resolution = resolveBattleTargets({
      scope: skill.scope,
      user: actor,
      actors: snapshot.actors,
      enemies: snapshot.enemies,
    });
    for (const target of resolution.requiresSelection ? resolution.candidates : resolution.targets.slice(0, 1)) {
      candidates.push({ skill, target, side: resolution.side });
    }
  }
  const selected = pickBest(candidates, () => 0, rng);
  return selected ? skillCommand(selected.skill, selected.target, selected.side) : undefined;
}

function bestRecovery(
  project: Project,
  snapshot: BattleSnapshot,
  actor: BattleBattlerSnapshot,
  skills: readonly SkillRecord[],
  rng: Rng,
): ActorCommand | undefined {
  const candidates: Array<{ skill: SkillRecord; target: BattleBattlerSnapshot; score: number }> = [];
  for (const skill of skills) {
    const resolution = resolveBattleTargets({
      scope: skill.scope,
      user: actor,
      actors: snapshot.actors,
      enemies: snapshot.enemies,
    });
    if (resolution.side !== "actor") continue;
    for (const target of resolution.candidates) {
      const hpDanger = skill.effect.kind === "healing" && skill.effect.affects === "hp"
        ? Math.max(0, 0.4 - target.hp / Math.max(1, target.maxHp)) * 100
        : 0;
      const mpDanger = skill.effect.kind === "healing" && skill.effect.affects === "mp"
        ? Math.max(0, 0.25 - target.mp / Math.max(1, target.maxMp)) * 80
        : 0;
      const harmfulStates = target.stateIds.filter((stateId) => isHarmfulState(project, stateId));
      const cured = skill.stateEffects?.filter((effect) => effect.operation === "remove" && harmfulStates.includes(effect.stateId)).length ?? 0;
      const score = hpDanger + mpDanger + cured * 60;
      if (score > 0) candidates.push({ skill, target, score });
    }
  }
  const selected = pickBest(candidates, (entry) => entry.score, rng);
  return selected ? skillCommand(selected.skill, selected.target, "actor") : undefined;
}

function bestAttack(
  project: Project,
  snapshot: BattleSnapshot,
  actor: BattleBattlerSnapshot,
  skills: readonly SkillRecord[],
  rng: Rng,
): ActorCommand | undefined {
  const candidates: Array<{ skill: SkillRecord; target: BattleBattlerSnapshot; score: number }> = [];
  for (const skill of skills) {
    const resolution = resolveBattleTargets({
      scope: skill.scope,
      user: actor,
      actors: snapshot.actors,
      enemies: snapshot.enemies,
    });
    if (resolution.side !== "enemy") continue;
    if (!resolution.requiresSelection && resolution.targets.length > 0) {
      const score = resolution.targets.reduce((sum, target) => sum + Math.max(0, predictSkillDamageFor(project, actor, skill, target).amount), 0);
      candidates.push({ skill, target: resolution.targets[0], score });
      continue;
    }
    for (const target of resolution.candidates) {
      // 위치 범위기는 주 대상 둘레까지 합산한다 — 런타임 대상 해결과 같은 areaTargets 를 쓴다.
      const hits = areaTargets(target, resolution.candidates, skill.area);
      const damage = hits.reduce((sum, hit) => sum + Math.max(0, predictSkillDamageFor(project, actor, skill, hit).amount), 0);
      candidates.push({ skill, target, score: damage + (hits.some((hit) => predictSkillDamageFor(project, actor, skill, hit).amount >= hit.hp) ? 1000 : 0) });
    }
  }
  const selected = pickBest(candidates, (entry) => entry.score, rng);
  return selected ? skillCommand(selected.skill, selected.target, "enemy") : undefined;
}

function skillCommand(skill: SkillRecord, target: BattleBattlerSnapshot, side: "actor" | "enemy"): ActorCommand {
  return {
    kind: "skill",
    skillId: skill.id,
    targetEnemyId: targetIdFor(target),
    ...(side === "actor" ? { targetActorId: target.recordId } : {}),
  };
}

function isHarmfulState(project: Project, stateId: string): boolean {
  const state = project.database.states.find((record) => record.id === stateId);
  if (!state) return false;
  const behavior = stateBehavior(state);
  return behavior.restrictsAction || behavior.blocksSkillUse || behavior.hpDamagePercentPerTurn > 0
    || behavior.attackMultiplier < 1 || behavior.defenseMultiplier < 1 || behavior.agilityMultiplier < 1;
}

function pickBest<T>(values: readonly T[], score: (value: T) => number, rng: Rng): T | undefined {
  if (values.length === 0) return undefined;
  let best = -Infinity;
  let ties: T[] = [];
  for (const value of values) {
    const next = score(value);
    if (next > best) {
      best = next;
      ties = [value];
    } else if (next === best) {
      ties.push(value);
    }
  }
  if (ties.length === 1) return ties[0];
  return ties[Math.min(ties.length - 1, Math.floor(rng() * ties.length))];
}
