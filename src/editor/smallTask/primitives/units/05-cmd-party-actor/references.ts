import { equipmentSlots } from "@/project/equipmentSlots";
import { validateCommands, type ReferenceContext } from "@/project/io/commandReferenceValidation";
import { collectResourceIds } from "@/project/io/resourceReferenceValidation";
import { normalizePartySetId } from "@/project/partySets";
import type { Project } from "@/project/types";
import { PrimitiveError } from "../../errors";
import type { PartyActorCommand } from "../05-cmd-party-actor";

const ids = (records: readonly { id: string }[] = []) => new Set(records.map(({ id }) => id));
const empty = new Set<string>();

export function validatePartyActorCommand(project: Project, command: PartyActorCommand): void {
  const { database } = project;
  const context: ReferenceContext = {
    actorIds: ids(database.actors),
    classIds: ids(database.classes),
    equipmentIds: ids(database.equipment),
    equipmentSlotIds: ids(equipmentSlots(project)),
    skillIds: ids(database.skills),
    variableIds: ids(project.variables),
    resourceIds: command.kind === "addFollower" && command.graphic?.sprite?.id ? collectResourceIds(project) : empty,
    enemyIds: empty, itemIds: empty, animationIds: empty, switchIds: empty, commonEventIds: empty,
    endingIds: empty, gameOverIds: empty, mapIds: empty, troopIds: empty, speciesIds: empty,
  };

  // 승급 결과 분기는 그대로 보존하고 이 명령에서 바꿀 수 있는 참조만 검사합니다.
  const ownCommand = command.kind === "promoteActor" ? { ...command, successBranch: [], failureBranch: [] } : command;
  try {
    validateCommands([ownCommand], context);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("actorId")) throw new PrimitiveError("자료집에서 주인공을 찾을 수 없어요.");
    if (message.includes("skillId")) throw new PrimitiveError("자료집에서 스킬을 찾을 수 없어요.");
    if (message.includes("toClassId")) throw new PrimitiveError("자료집에서 승급할 직업을 찾을 수 없어요.");
    if (message.includes("equipmentId")) throw new PrimitiveError("자료집에서 장비를 찾을 수 없어요.");
    if (message.includes("slot")) throw new PrimitiveError("자료집에서 장비 부위를 찾을 수 없어요.");
    if (message.includes("variableId")) throw new PrimitiveError("자료집에서 변수를 찾을 수 없어요.");
    if (command.kind === "addFollower") throw new PrimitiveError("동행자의 걷기 그림을 찾을 수 없어요.");
    throw new PrimitiveError("명령에 연결할 대상을 찾을 수 없어요.");
  }

  // 공용 참조 검사에서 다루지 않는 명령별 참조와 실행에 필요한 값을 확인합니다.
  if ("actorId" in command && command.actorId && !context.actorIds.has(command.actorId)) {
    throw new PrimitiveError("자료집에서 주인공을 찾을 수 없어요.");
  }
  switch (command.kind) {
    case "changeParty":
      if (!context.actorIds.has(command.actorId)) throw new PrimitiveError("자료집에서 파티 멤버를 찾을 수 없어요.");
      return;
    case "changeLifeSkillExp":
      if (!database.lifeSkills?.some(({ id }) => id === command.skillId)) throw new PrimitiveError("자료집에서 생활 스킬을 찾을 수 없어요.");
      if (typeof command.amount !== "number" && !context.variableIds.has(command.amount.id)) {
        throw new PrimitiveError("자료집에서 변수를 찾을 수 없어요.");
      }
      return;
    case "storeParty": {
      validatePartyName(command.partySetId);
      if (command.actorIds?.some(id => !context.actorIds.has(id))) throw new PrimitiveError("파티 구성원 중 자료집에 없는 주인공이 있어요.");
      if (command.mapId === undefined) return;
      const map = Object.hasOwn(project.maps, command.mapId) ? project.maps[command.mapId] : undefined;
      if (!map) throw new PrimitiveError("파티를 둘 맵을 찾을 수 없어요.");
      if ((command.x !== undefined && (command.x < 0 || command.x >= map.width))
        || (command.y !== undefined && (command.y < 0 || command.y >= map.height))) {
        throw new PrimitiveError("범위 밖이에요. 파티를 맵 안에 놓아 주세요.");
      }
      return;
    }
    case "recallParty":
      // 불러올 파티는 다른 이벤트에서 실행 중에 저장할 수 있습니다.
      validatePartyName(command.partySetId);
      return;
    case "addFollower":
      if (!command.actorId && !command.graphic?.sprite?.id && !command.graphic?.appearanceId) {
        throw new PrimitiveError("동행할 주인공이나 걷기 그림을 골라 주세요.");
      }
      return;
    case "removeFollower":
      if (command.all === false && !command.name?.trim()) throw new PrimitiveError("떠나게 할 동행자의 이름을 입력해 주세요.");
      return;
  }
}

function validatePartyName(name: string): void {
  const normalized = normalizePartySetId(name);
  if (!normalized || Object.hasOwn(Object.prototype, normalized)) throw new PrimitiveError("파티에 사용할 이름을 입력해 주세요.");
}
