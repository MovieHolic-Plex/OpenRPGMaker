// 진행 검사 — 읽히기만 하고 켜지지 않는 스위치, 엔딩 정의와 엔딩 호출, 동료 합류, 전투 성립.

import { monsterSkillIdsAtLevel, monsterSpeciesById } from "@/project/monsterCollection";
import type { Project } from "@/project/types";
import { allPages, commandList, conditionLeaves, visitAllCommands, visitPageCommands, type CommandVisit, type PageRef } from "./walk";
import type { CommandWhere, Finding } from "./types";

export interface SwitchWrite { readonly switchId: string; readonly value: unknown; readonly where: CommandWhere; readonly visit?: CommandVisit }

/** 스위치를 켤 수 있는 모든 자리. 명령·이동 경로·적 행동·필드 스폰·스킬 효과. */
export function collectSwitchWrites(project: Project): SwitchWrite[] {
  const writes: SwitchWrite[] = [];
  const moves = (route: unknown, where: CommandWhere): void => {
    const list = route && typeof route === "object" ? (route as { moves?: unknown }).moves : undefined;
    for (const move of Array.isArray(list) ? list : []) {
      if (move && typeof move === "object" && (move as { kind?: unknown }).kind === "setSwitch") {
        writes.push({ switchId: String((move as { switchId?: unknown }).switchId), value: (move as { value?: unknown }).value, where });
      }
    }
  };
  visitAllCommands(project, (visit) => {
    const { command, where } = visit;
    if (command.kind === "setSwitch" && typeof command.switchId === "string") writes.push({ switchId: command.switchId, value: command.value, where, visit });
    if (command.kind === "moveEvent") moves(command.route, where);
  });
  for (const map of Object.values(project.maps)) {
    for (const event of map.events ?? []) {
      for (const [pageIndex, page] of (event.pages ?? []).entries()) moves(page.movement?.route, { mapId: map.id, eventId: event.id, pageIndex, path: "movement.route" });
      for (const living of (event.pages ?? []).flatMap((page) => page.movement?.living?.destinations ?? [])) {
        if (living.switchId) writes.push({ switchId: living.switchId, value: true, where: { mapId: map.id, eventId: event.id, path: "movement.living" } });
      }
    }
    for (const spawn of map.fieldSpawns ?? []) if (spawn.onKillSwitchId) writes.push({ switchId: spawn.onKillSwitchId, value: true, where: { mapId: map.id, path: `fieldSpawns.${spawn.id}` } });
  }
  for (const enemy of project.database.enemies) {
    for (const action of enemy.actions ?? []) {
      for (const effect of [action.switchOnAfterAction]) {
        const id = (effect as { switchId?: string } | undefined)?.switchId;
        if ((effect as { enabled?: boolean } | undefined)?.enabled && id) writes.push({ switchId: id, value: true, where: { path: `enemy ${enemy.id} action` } });
      }
    }
  }
  for (const skill of project.database.skills) {
    if (skill.effect?.kind === "switch" && skill.effect.switchId) writes.push({ switchId: skill.effect.switchId, value: true, where: { path: `skill ${skill.id}` } });
  }
  for (const troop of project.database.troops) {
    for (const page of troop.battleEventPages ?? []) {
      const pageRef: PageRef = { pageIndex: -1, conditions: [], commands: commandList((page as { commands?: unknown }).commands) };
      visitPageCommands(pageRef, ({ command }) => {
        if (command.kind === "setSwitch" && typeof command.switchId === "string") writes.push({ switchId: command.switchId, value: command.value, where: { path: `troop ${troop.id} battle event` } });
      });
    }
  }
  return writes;
}

export function initiallyOn(project: Project, switchId: string): boolean {
  return project.session?.switches?.[switchId] === true;
}

function turnsOn(value: unknown): boolean {
  return value === true || value === "toggle" || (typeof value === "object" && value !== null);
}

function containsEnding(page: PageRef): boolean {
  let found = false;
  visitPageCommands(page, ({ command }) => { if (command.kind === "triggerEnding" || command.kind === "ending") found = true; });
  return found;
}

function switchName(project: Project, id: string): string {
  const name = project.switches.find((s) => s.id === id)?.name;
  return name ? `${name}(${id})` : id;
}

export function checkProgression(project: Project): Finding[] {
  const findings: Finding[] = [];
  const writes = collectSwitchWrites(project);
  const settable = new Set(writes.filter((write) => turnsOn(write.value)).map((write) => write.switchId));
  const reported = new Set<string>();
  const pages = allPages(project);

  // 1) 페이지 조건이 기다리는 스위치 — 켜는 곳이 없으면 그 페이지는 영원히 안 나온다.
  for (const page of pages) {
    for (const leaf of page.conditions.flatMap((condition) => conditionLeaves(condition))) {
      if (leaf.kind === "switch" && leaf.value === true && typeof leaf.switchId === "string") {
        const id = leaf.switchId;
        if (settable.has(id) || initiallyOn(project, id)) continue;
        const ending = containsEnding(page);
        const key = `${id}|${page.map?.id}|${page.event?.id}|${page.pageIndex}`;
        if (reported.has(key)) continue;
        reported.add(key);
        findings.push({
          severity: ending ? "blocker" : "warning", code: ending ? "ending-page-switch-never-set" : "page-switch-never-set",
          message: `스위치 ${switchName(project, id)} 을 켜는 곳이 없어 이 페이지가 절대 나오지 않습니다${ending ? " — 엔딩이 이 페이지에 있습니다" : ""}.`,
          where: { ...(page.map ? { mapId: page.map.id, mapName: page.map.name } : {}), ...(page.event ? { eventId: page.event.id, eventName: page.event.name, x: page.event.x, y: page.event.y } : {}), pageIndex: page.pageIndex },
        });
      }
      if (leaf.kind === "selfSwitch" && leaf.value === true && page.event) {
        const key = String(leaf.key);
        const setsIt = (page.event.pages ?? []).some((other) => {
          let hit = false;
          visitPageCommands({ ...page, page: other, commands: commandList(other.commands) }, ({ command }) => { if (command.kind === "setSelfSwitch" && command.key === key && command.value === true) hit = true; });
          return hit;
        });
        if (!setsIt) {
          findings.push({ severity: containsEnding(page) ? "blocker" : "warning", code: "page-selfswitch-never-set", message: `셀프 스위치 ${key} 를 이 이벤트 안에서 켜는 곳이 없어 이 페이지가 나오지 않습니다.`, where: { mapId: page.map?.id, eventId: page.event.id, eventName: page.event.name, pageIndex: page.pageIndex } });
        }
      }
    }
  }

  // 2) 엔딩 — 정의가 있으면 부르는 곳이 있어야 하고, 조건의 스위치는 켜질 수 있어야 한다.
  const endings = project.endings ?? [];
  const triggers: CommandVisit[] = [];
  visitAllCommands(project, (visit) => { if (visit.command.kind === "triggerEnding" || visit.command.kind === "ending") triggers.push(visit); });
  if (triggers.length === 0) {
    findings.push({
      severity: "blocker", code: "no-ending-trigger",
      message: endings.length > 0
        ? `엔딩 ${endings.length}개(${endings.map((e) => e.name || e.id).join(", ")})가 정의돼 있지만 어떤 이벤트도 triggerEnding 을 부르지 않습니다 — 게임을 끝낼 수 없습니다.`
        : "어떤 이벤트도 엔딩(triggerEnding/ending)을 부르지 않습니다 — 게임을 끝낼 수 없습니다.",
    });
  }
  for (const trigger of triggers) {
    if (trigger.command.kind !== "triggerEnding") continue;
    const endingId = typeof trigger.command.endingId === "string" ? trigger.command.endingId : undefined;
    if (endingId && !endings.some((e) => e.id === endingId)) {
      findings.push({ severity: "blocker", code: "ending-missing", message: `없는 엔딩 \`${endingId}\` 을 부릅니다 — 「조건에 맞는 엔딩이 없습니다」로 끝납니다.`, where: trigger.where });
    }
    if (!endingId && endings.length === 0) {
      findings.push({ severity: "blocker", code: "ending-none-defined", message: "엔딩 id 없이 triggerEnding 을 부르지만 정의된 엔딩이 없습니다.", where: trigger.where });
    }
  }
  for (const ending of endings) {
    for (const condition of ending.conditions ?? []) {
      if (condition.kind === "switch" && condition.value === true && !settable.has(condition.switchId) && !initiallyOn(project, condition.switchId)) {
        // endingId 를 지정해 부르면 조건은 보지 않는다 — 그래도 조건 없이 자동 선택되는 호출이 있으면 막힌다.
        const autoSelected = triggers.some((t) => t.command.kind === "triggerEnding" && !t.command.endingId);
        findings.push({
          severity: autoSelected ? "blocker" : "warning", code: "ending-switch-never-set",
          message: `엔딩 「${ending.name || ending.id}」 의 조건 스위치 ${switchName(project, condition.switchId)} 을 켜는 곳이 없습니다.`,
        });
      }
    }
  }

  // 3) 파티 — 시작 파티가 비었거나 없는 배우면 전투가 성립하지 않는다.
  const actorIds = new Set(project.database.actors.map((actor) => actor.id));
  const party = project.session?.partyActorIds ?? [];
  if (party.length === 0) findings.push({ severity: "blocker", code: "party-empty", message: "시작 파티가 비어 있습니다." });
  for (const id of party) if (!actorIds.has(id)) findings.push({ severity: "blocker", code: "party-missing-actor", message: `시작 파티의 배우 \`${id}\` 가 데이터베이스에 없습니다.` });

  // 4) 전투 — 적 그룹·적·적의 공격 수단.
  const troops = new Map(project.database.troops.map((troop) => [troop.id, troop]));
  const enemies = new Map(project.database.enemies.map((enemy) => [enemy.id, enemy]));
  const skills = new Map(project.database.skills.map((skill) => [skill.id, skill]));
  const checkedTroops = new Set<string>();
  visitAllCommands(project, ({ command, where }) => {
    if (command.kind !== "battleProcessing" || command.troopSource === "variable") return;
    const troopId = typeof command.troopId === "string" ? command.troopId : "";
    const troop = troops.get(troopId);
    if (!troop || checkedTroops.has(troopId)) return;
    checkedTroops.add(troopId);
    const members = troop.members?.map((member) => member.enemyId) ?? troop.enemyIds;
    if (members.length === 0) findings.push({ severity: "blocker", code: "troop-empty", message: `적 그룹 ${troop.name}(${troop.id}) 에 적이 없습니다.`, where });
    for (const enemyId of members) {
      const enemy = enemies.get(enemyId);
      if (!enemy) { findings.push({ severity: "blocker", code: "troop-missing-enemy", message: `적 그룹 ${troop.name}(${troop.id}) 이 없는 적 \`${enemyId}\` 를 담고 있습니다.`, where }); continue; }
      const authoredDamage = (enemy.actions ?? []).some((action) => {
        const skill = skills.get(action.skillId);
        return skill?.effect?.kind === "damage" && (skill.scope === "enemy" || skill.scope === "allEnemies");
      });
      // 몬스터 파티의 빈 행동은 전투에서 종족 습득 기술로 채운다(enemyBattlers). 그 기술이 피해를 주면 경고하지 않는다.
      const monsterParty = project.system.battleParty === "monsters" || project.system.monsterBattleParty === true;
      const species = monsterParty && (enemy.actions ?? []).length === 0 && enemy.skillIds.length === 0 && enemy.speciesId
        ? monsterSpeciesById(project, enemy.speciesId)
        : undefined;
      const inheritedDamage = species
        ? monsterSkillIdsAtLevel(species, enemy.level ?? 1).some((skillId) => {
          const skill = skills.get(skillId);
          return skill?.effect?.kind === "damage" && (skill.scope === "enemy" || skill.scope === "allEnemies");
        })
        : false;
      if (!authoredDamage && !inheritedDamage) findings.push({ severity: "warning", code: "enemy-no-damage", message: `적 ${enemy.name}(${enemy.id}) 에 피해를 주는 행동이 없습니다 — 공격하지 않는 보스가 됩니다.`, where });
    }
  });

  // 5) 동료 — 따라다니기(addFollower)만 있고 파티 합류(changeParty add)가 없는 배우.
  const joined = new Set<string>();
  const followers: CommandVisit[] = [];
  visitAllCommands(project, (visit) => {
    if (visit.command.kind === "changeParty" && visit.command.action === "add" && typeof visit.command.actorId === "string") joined.add(visit.command.actorId);
    if (visit.command.kind === "addFollower") followers.push(visit);
  });
  for (const follower of followers) {
    const actorId = typeof follower.command.actorId === "string" ? follower.command.actorId : undefined;
    if (!actorId || !joined.has(actorId)) {
      findings.push({ severity: "warning", code: "follower-not-in-party", message: `동료 추종(addFollower${actorId ? ` ${actorId}` : ""})만 있고 같은 배우의 파티 합류(changeParty add)가 없습니다 — 전투에는 참여하지 않습니다.`, where: follower.where });
    }
  }
  return findings;
}

/** 파티에 새로 합류시키는 명령(시작 파티에 없는 배우). 잘못된 필드로 쓴 합류도 포함한다. */
export function companionJoins(project: Project): CommandVisit[] {
  const start = new Set(project.session?.partyActorIds ?? []);
  const joins: CommandVisit[] = [];
  visitAllCommands(project, (visit) => {
    const command = visit.command;
    if (command.kind !== "changeParty" || command.action === "remove") return;
    if (typeof command.actorId === "string" && start.has(command.actorId)) return;
    joins.push(visit);
  });
  return joins;
}
