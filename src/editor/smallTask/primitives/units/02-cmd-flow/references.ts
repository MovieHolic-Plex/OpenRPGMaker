import type { GameMap, Condition, Project } from "@/project/types";
import { isSafeEconomyValue, GOLD_MAX } from "@/project/economyValues";
import { validateCondition, validateMonsterSpeciesReferences } from "@/project/io/commandReferenceValidation";
import { validateConditionShape } from "@/project/io/shapeCommandFields";
import { ROGUELIKE_FLOOR_MAX, ROGUELIKE_FLOOR_MIN } from "@/project/roguelikeRun";
import { clampFriendship, FRIENDSHIP_MAX, FRIENDSHIP_MIN } from "@/project/session";
import { watchersHaveSelector } from "@/project/sightWatchers";
import { PrimitiveError } from "../../errors";

type NamedRecord = { readonly id: string; readonly name: string };

export function requireReference<T extends { readonly id: string }>(
  records: readonly T[] | undefined, id: string, label: string,
): T {
  const record = id.trim() ? records?.find(entry => entry.id === id) : undefined;
  if (!record) throw new PrimitiveError(`연결할 ${label} 항목이 없습니다.`);
  return record;
}

export function referenceName(records: readonly NamedRecord[], id: string): string {
  const name = records.find(record => record.id === id)?.name ?? "";
  return name.trim() === id ? "" : name;
}

const compareOps = ["==", "!=", ">=", "<=", ">", "<"];

export function validateForkCondition(project: Project, map: GameMap, condition: Condition): void {
  try {
    validateConditionShape("조건", condition);
  } catch {
    throw new PrimitiveError("분기 조건의 형식이 올바르지 않습니다.");
  }
  const switchIds = new Set(project.switches.map(record => record.id));
  const variableIds = new Set(project.variables.map(record => record.id));
  const speciesIds = new Set(project.database.monsterSpecies?.map(record => record.id));
  try {
    validateMonsterSpeciesReferences(condition, { speciesIds });
  } catch {
    throw new PrimitiveError("분기 조건에 연결할 몬스터 종이 없습니다.");
  }

  function visit(node: Condition): void {
    if (node.kind === "all" || node.kind === "any") {
      node.conditions.forEach(visit);
      return;
    }
    if (node.kind === "not") {
      visit(node.condition);
      return;
    }
    if ("op" in node && node.op !== undefined && node.kind !== "stringVariable" && !compareOps.includes(node.op)) {
      throw new PrimitiveError("분기 조건에서 사용할 비교 방법이 올바르지 않습니다.");
    }
    try {
      validateCondition(node, switchIds, variableIds);
    } catch {
      throw new PrimitiveError("분기 조건에 연결할 스위치나 변수가 없습니다.");
    }
    switch (node.kind) {
      case "item":
      case "itemUsed":
        requireReference(project.database.items, node.itemId, "아이템");
        break;
      case "actor":
      case "partyLeader":
        requireReference(project.database.actors, node.actorId, "배우");
        break;
      case "actorStat":
      case "actorState":
        if (node.actorId !== "leader" && !(node.kind === "actorState" && node.actorId === "anyone")) {
          requireReference(project.database.actors, node.actorId, "배우");
        }
        if (node.kind === "actorState") requireReference(project.database.states, node.stateId, "상태");
        break;
      case "partyKnowsSkill":
        requireReference(project.database.skills, node.skillId, "기술");
        break;
      case "difficulty":
        requireReference(project.system.difficulties, node.difficultyId, "난이도");
        break;
      case "endingSeen":
        requireReference(project.endings, node.endingId, "결말");
        break;
      case "insideLocation":
        requireReference(map.locations, node.locationId, "장소");
        if (node.eventId !== undefined) requireReference(map.events, node.eventId, "맵 이벤트");
        break;
      case "pursuitActive":
        if (node.eventId !== undefined) requireReference(map.events, node.eventId, "맵 이벤트");
        break;
      case "eventSeesPlayer":
        if (node.eventId) {
          requireReference(map.events, node.eventId, "맵 이벤트");
        } else {
          if (!watchersHaveSelector(node.watchers)) {
            throw new PrimitiveError("주인공을 지켜볼 이벤트를 고르거나 인물, 이름, 장소 중 하나를 입력해 주세요.");
          }
          if (node.watchers?.locationId?.trim()) requireReference(map.locations, node.watchers.locationId, "장소");
          const characterId = node.watchers?.characterId?.trim();
          if (characterId && !map.events.some(event => event.characterId === characterId)) {
            throw new PrimitiveError("같은 맵에 이 인물과 연결된 이벤트가 없습니다.");
          }
        }
        if ([node.range, node.hearRange, node.darkness?.night, node.darkness?.dark].some(value => value !== undefined && value < 0)) {
          throw new PrimitiveError("보거나 들을 수 있는 거리는 0칸 이상으로 정해 주세요.");
        }
        if (node.darkness?.darkAmbient !== undefined && (node.darkness.darkAmbient < 0 || node.darkness.darkAmbient > 1)) {
          throw new PrimitiveError("어둡다고 판단할 밝기 기준은 0부터 1 사이로 정해 주세요.");
        }
        break;
      case "stringVariable":
        if (!node.stringVariableId.trim()) throw new PrimitiveError("비교할 문자열 변수를 골라 주세요.");
        break;
      case "weekday":
        if (!node.weekdays.length) throw new PrimitiveError("요일을 하나 이상 골라 주세요.");
        break;
      case "npcActivity":
        if (!node.activity.trim()) throw new PrimitiveError("비교할 인물의 활동 이름을 입력해 주세요.");
        break;
      case "gold":
        if (!isSafeEconomyValue(node.amount)) throw new PrimitiveError(`비교할 소지금은 0부터 ${GOLD_MAX}까지의 정수로 입력해 주세요.`);
        break;
      case "friendshipAtLeast":
        if (node.value !== clampFriendship(node.value)) {
          throw new PrimitiveError(`비교할 호감도는 ${FRIENDSHIP_MIN}부터 ${FRIENDSHIP_MAX}까지의 정수로 입력해 주세요.`);
        }
        break;
      case "run":
        if (node.query === "flag" && !node.flag.trim()) throw new PrimitiveError("확인할 진행 표시의 이름을 입력해 주세요.");
        if (node.query === "floor" && (!Number.isInteger(node.value) || node.value < ROGUELIKE_FLOOR_MIN || node.value > ROGUELIKE_FLOOR_MAX)) {
          throw new PrimitiveError(`비교할 층은 ${ROGUELIKE_FLOOR_MIN}부터 ${ROGUELIKE_FLOOR_MAX}까지의 정수로 입력해 주세요.`);
        }
        break;
      case "selfSwitch":
        if (!["A", "B", "C", "D"].includes(node.key)) throw new PrimitiveError("이벤트 전용 스위치를 A부터 D 중에서 골라 주세요.");
        break;
      case "timer":
        if (!["timer1", "timer2"].includes(node.timerId)) throw new PrimitiveError("1번 타이머와 2번 타이머 중 하나를 골라 주세요.");
        if (!Number.isSafeInteger(node.seconds) || node.seconds < 0) throw new PrimitiveError("비교할 타이머 시간은 0초 이상의 정수로 입력해 주세요.");
        break;
    }
  }

  visit(condition);
}
