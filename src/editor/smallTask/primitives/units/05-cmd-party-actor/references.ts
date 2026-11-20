import { resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { defaultActorCharacterResourceId } from "@/project/actorModel";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { resolveActorAppearance } from "@/project/characterAppearances";
import { equipmentSlotAccepts } from "@/project/equipmentRules";
import { hasEquipmentSlot } from "@/project/equipmentSlots";
import { isWholePartyActorTarget } from "@/project/eventCommands/actorTarget";
import { isPartySetCoordinate, normalizePartySetId } from "@/project/partySets";
import { troopAfterBattleLists } from "@/project/troopAfterBattle";
import type { Command, LightSource, PersistedGameEvent, Project } from "@/project/types";
import { PrimitiveError } from "../../errors";
import type { PartyActorCommand } from "../05-cmd-party-actor";

export function targetsWholeParty(command: PartyActorCommand): boolean {
  switch (command.kind) {
    case "learnSkill":
    case "changeExp":
    case "changeActorHp":
    case "changeActorMp":
      return isWholePartyActorTarget(command.actorId);
    case "recoverAll":
      return !command.actorId;
    default:
      return false;
  }
}

export function validatePartyActorCommand(
  project: Project, command: PartyActorCommand, patch: Record<string, unknown>,
): void {
  const { database } = project;
  const actorId = "actorId" in command ? command.actorId : undefined;
  const actor = actorId ? database.actors.find(record => record.id === actorId) : undefined;
  if (actorId && !actor && !targetsWholeParty(command)) throw new PrimitiveError("자료집에서 주인공을 찾을 수 없어요.");
  switch (command.kind) {
    case "learnSkill":
      if (!database.skills.some(({ id }) => id === command.skillId)) throw new PrimitiveError("자료집에서 스킬을 찾을 수 없어요.");
      return;
    case "changeLevel":
      if (!actor) throw new PrimitiveError("레벨을 바꿀 주인공을 골라 주세요.");
      if ((Object.hasOwn(patch, "amount") || Object.hasOwn(patch, "op"))
        && command.op === "=" && (command.amount < 1 || command.amount > 99)) {
        throw new PrimitiveError("레벨을 맞출 값은 1부터 99까지 입력해 주세요.");
      }
      return;
    case "changeActorHp":
    case "changeActorMp":
      if ((Object.hasOwn(patch, "amount") || Object.hasOwn(patch, "amountMode"))
        && command.amountMode === "percent" && (command.amount < 0 || command.amount > 100)) {
        throw new PrimitiveError("최대치에 대한 비율은 0부터 100까지 입력해 주세요.");
      }
      return;
    case "changeExp":
    case "changeLifeSkillExp": {
      if (command.kind === "changeLifeSkillExp" && !database.lifeSkills?.some(({ id }) => id === command.skillId)) {
        throw new PrimitiveError("자료집에서 생활 스킬을 찾을 수 없어요.");
      }
      const { amount } = command;
      if (typeof amount !== "number" && !project.variables.some(({ id }) => id === amount.id)) {
        throw new PrimitiveError("자료집에서 변수를 찾을 수 없어요.");
      }
      return;
    }
    case "promoteActor":
      if (!actor) throw new PrimitiveError("승급할 주인공을 골라 주세요.");
      if (command.toClassId && !database.classes.some(({ id }) => id === command.toClassId)) {
        throw new PrimitiveError("자료집에서 승급할 직업을 찾을 수 없어요.");
      }
      return;
    case "changeEquipment": {
      if (!actor) throw new PrimitiveError("장비를 바꿀 주인공을 골라 주세요.");
      if (!hasEquipmentSlot(project, command.slot)) throw new PrimitiveError("자료집에서 장비 부위를 찾을 수 없어요.");
      if (!command.equipmentId) return;
      const equipment = database.equipment.find(({ id }) => id === command.equipmentId);
      if (!equipment) throw new PrimitiveError("자료집에서 장비를 찾을 수 없어요.");
      // 실행 시 직업이 바뀔 수 있으므로 현재 직업과 다른 직업에서도 부위 호환성을 확인합니다.
      if (!equipmentSlotAccepts(project, actor, command.slot, equipment)
        && !database.classes.some(({ id }) => equipmentSlotAccepts(project, actor, command.slot, equipment, id))) {
        throw new PrimitiveError("선택한 부위에 착용할 수 있는 장비를 골라 주세요.");
      }
      return;
    }
    case "changeParty":
      if (!actor) throw new PrimitiveError("편성을 바꿀 파티 멤버를 골라 주세요.");
      return;
    case "storeParty": {
      validatePartyName(command.partySetId);
      if (command.actorIds && (command.actorIds.length === 0
        || command.actorIds.some(id => !database.actors.some(record => record.id === id)))) {
        throw new PrimitiveError("파티 구성원은 자료집에 있는 주인공 중에서 한 명 이상 골라 주세요.");
      }
      const { mapId } = command;
      const map = mapId !== undefined && Object.hasOwn(project.maps, mapId) ? project.maps[mapId] : undefined;
      if (mapId !== undefined && !map) throw new PrimitiveError("파티를 둘 맵을 찾을 수 없어요.");
      // The event can continue after a transfer. Only a destination named in the command is known here.
      if (!isPartySetCoordinate(command.x, map?.width) || !isPartySetCoordinate(command.y, map?.height)) {
        throw new PrimitiveError("범위 밖이에요. 파티를 맵 안에 놓아 주세요.");
      }
      const locationEdited = ["mapId", "x", "y"].some(key => Object.hasOwn(patch, key));
      if (locationEdited && command.mapId !== undefined && (command.x === undefined || command.y === undefined)) {
        throw new PrimitiveError("파티를 둘 맵을 지정할 때는 가로와 세로 좌표를 모두 입력해 주세요.");
      }
      return;
    }
    case "recallParty":
      validatePartyName(command.partySetId);
      return;
    case "addFollower": {
      const { sprite, pattern } = command.graphic ?? {};
      if (sprite?.id && (Object.hasOwn(Object.prototype, sprite.id) || !resolveEventSpriteTexture(project, sprite.id, pattern))) {
        throw new PrimitiveError("동행자의 걷기 그림을 찾을 수 없어요.");
      }
      if (!actor && !sprite?.id) throw new PrimitiveError("동행할 주인공이나 걷기 그림을 골라 주세요.");
      if (actor && Object.hasOwn(patch, "graphic") && (
        resolveActorAppearance(project, actor).characterResourceId?.trim() || defaultActorCharacterResourceId(actor)
      )) {
        throw new PrimitiveError("선택한 주인공은 자기 걷기 그림으로 따라와요. 다른 그림을 쓰려면 주인공 선택을 비워 주세요.");
      }
      return;
    }
    case "removeFollower":
      if (command.all !== true && !command.name?.trim()) throw new PrimitiveError("떠나게 할 동행자의 이름을 입력해 주세요.");
      return;
  }
}

function validatePartyName(name: string): void {
  const normalized = normalizePartySetId(name);
  if (!normalized || Object.hasOwn(Object.prototype, normalized)) throw new PrimitiveError("파티에 사용할 이름을 입력해 주세요.");
}

type Follower = Extract<Command, { kind: "addFollower" }>;

export function followerName(project: Project, command: Follower): string {
  return command.name?.trim() || (command.actorId
    ? project.database.actors.find(({ id }) => id === command.actorId)?.name || command.actorId
    : command.graphic?.sprite?.id || "동행자");
}

function hasCommand(project: Project, matches: (command: Command) => boolean): boolean {
  const inList = (commands: readonly Command[]): boolean => commands.some(command =>
    matches(command) || nestedCommandLists(command).some(inList));
  const inEvent = (event: PersistedGameEvent): boolean =>
    inList(event.commands) || (event.pages?.some(page => inList(page.commands)) ?? false);
  return Object.values(project.maps).some(map => map.events.some(event =>
    inEvent(event) || (event.draft?.original !== undefined && inEvent(event.draft.original))))
    || project.commonEvents.some(event => inList(event.commands))
    || project.database.troops.some(troop => troop.battleEventPages.some(page => inList(page.commands))
      || troopAfterBattleLists(troop).some(list => inList(list.commands)));
}

export function validatePartyActorRename(project: Project, before: PartyActorCommand, after: PartyActorCommand): void {
  if (before.kind === "storeParty" && after.kind === "storeParty") {
    const oldName = normalizePartySetId(before.partySetId);
    if (oldName !== normalizePartySetId(after.partySetId) && hasCommand(project, command =>
      command.kind === "recallParty" && normalizePartySetId(command.partySetId) === oldName)) {
      throw new PrimitiveError("이 이름으로 파티를 불러오는 명령이 있어요. 파티 저장 이름을 바꿀 수 없어요.");
    }
  }
  if (before.kind === "addFollower" && after.kind === "addFollower") {
    const oldName = followerName(project, before);
    const nextName = followerName(project, after);
    const nameChanged = oldName !== nextName;
    const matchesOldName = (target: string): boolean => nameChanged
      && (target === oldName || isNumberedFollowerName(target, oldName));
    const losesActorAnchor = Boolean(before.actorId && before.actorId !== after.actorId
      && before.actorId !== nextName);
    if (!nameChanged && !losesActorAnchor) return;

    const usesFollowerAnchor = ({ at }: LightSource): boolean => typeof at === "object" && "eventId" in at
      && ((at.eventId !== after.actorId && matchesOldName(at.eventId)) || (losesActorAnchor && at.eventId === before.actorId));
    if (Object.values(project.maps).some(map => map.defaultLighting?.sources.some(usesFollowerAnchor))) {
      throw new PrimitiveError("맵의 조명이 이 동행자를 따라가고 있어요. 연결된 동행자를 바꿀 수 없어요.");
    }
    if (hasCommand(project, command => {
      switch (command.kind) {
        case "removeFollower":
          return command.all !== true && command.name !== undefined && matchesOldName(command.name);
        case "m2Command": {
          const { query, target } = command.fields;
          return command.commandId === "m2-217-data-query" && query === "followerPresent"
            && target != null && matchesOldName(String(target));
        }
        case "addLight":
          return usesFollowerAnchor(command.source);
        default:
          return false;
      }
    })) {
      throw new PrimitiveError("이 동행자를 가리키는 다른 명령이 있어요. 동행자 이름이나 주인공을 바꿀 수 없어요.");
    }
  }
}

function isNumberedFollowerName(name: string, base: string): boolean {
  const prefix = `${base} (`;
  return name.startsWith(prefix) && /^\d{1,3}\)$/u.test(name.slice(prefix.length));
}
