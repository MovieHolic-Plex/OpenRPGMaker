import type { GameMap, Condition, Project } from "@/project/types";
import { validateCondition, validateMonsterSpeciesReferences } from "@/project/io/commandReferenceValidation";
import { validateConditionShape } from "@/project/io/shapeCommandFields";
import { PrimitiveError } from "../../errors";

type NamedRecord = { readonly id: string; readonly name: string };

export function requireReference<T extends { readonly id: string }>(
  records: readonly T[] | undefined, id: string, label: string,
): T {
  const record = records?.find(entry => entry.id === id);
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
        if (node.eventId || !node.watchers) requireReference(map.events, node.eventId, "맵 이벤트");
        if (node.watchers?.locationId) requireReference(map.locations, node.watchers.locationId, "장소");
        break;
      case "selfSwitch":
        if (!["A", "B", "C", "D"].includes(node.key)) throw new PrimitiveError("이 이벤트에서 쓸 기억을 네 칸 중에서 골라 주세요.");
        break;
      case "timer":
        if (!["timer1", "timer2"].includes(node.timerId)) throw new PrimitiveError("두 시간 계기 중 하나를 골라 주세요.");
        break;
    }
  }

  visit(condition);
}
