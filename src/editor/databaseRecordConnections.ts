import { commandsReferenceLocations, type DatabaseReferenceLocation } from "./databaseCommandReferences";
import { projectDatabaseReferenceMessage } from "./databaseRecordReferences";
import type { DatabaseCollection } from "./databaseActions";
import type { Project } from "@/project/types";

/**
 * 자료집 오른쪽 「연결」 칸의 순수 계산 — 선택한 레코드를 **어디서 쓰는지**와 **무엇을 확인할지**.
 *
 * 삭제 차단 메시지(databaseRecordReferences.projectDatabaseReferenceMessage)는 첫 매치 한 건만
 * 문장으로 말한다. 이 칸은 같은 참조를 **전부** 목록으로 보인다 — 저자가 「이걸 바꾸면 어디가
 * 흔들리나」를 먼저 보고 고르게. 검출 권위는 여전히 references.ts 이고, 여기는 표시 계층이다.
 */

export type RecordUse = {
  /** 이동할 수 있으면 자료집 컬렉션과 레코드 id. 맵 이벤트처럼 자료집 밖이면 없다. */
  readonly target?: { readonly collection: DatabaseCollection; readonly id: string };
  readonly kind: string;
  readonly name: string;
};

export type RecordConnections = {
  readonly uses: readonly RecordUse[];
  readonly checks: readonly string[];
};

/** 이 칸이 다루는 컬렉션. 나머지 탭은 칸을 그리지 않는다. */
export const CONNECTION_COLLECTIONS: ReadonlySet<DatabaseCollection> = new Set<DatabaseCollection>([
  "actors", "classes", "skills", "items", "equipment", "enemies", "troops", "states",
]);

const USE_LIMIT = 40;

function recordUses(
  collection: DatabaseCollection,
  kind: string,
  records: readonly { readonly id: string; readonly name: string }[],
): RecordUse[] {
  return records.map((record) => ({ target: { collection, id: record.id }, kind, name: record.name || record.id }));
}

function locationUse(location: DatabaseReferenceLocation): RecordUse {
  switch (location.kind) {
    case "mapEvent": return { kind: "맵 이벤트", name: `${location.mapName} › ${location.eventName}` };
    case "commonEvent": return { kind: "공용 이벤트", name: location.eventName };
    case "troopBattleEvent": return { kind: "전투 이벤트", name: `${location.troopName} › ${location.pageName}` };
  }
}

function databaseUses(project: Project, collection: DatabaseCollection, id: string): RecordUse[] {
  const db = project.database;
  switch (collection) {
    case "actors": {
      const uses: RecordUse[] = [];
      if (project.system.startActorIds.includes(id)) uses.push({ kind: "시스템", name: "시작 파티" });
      return uses;
    }
    case "classes":
      return [
        ...recordUses("actors", "주인공", db.actors.filter((record) => record.classId === id)),
        ...recordUses("classes", "승급 전 직업", db.classes.filter((record) => record.id !== id && record.promotions?.some((promotion) => promotion.toClassId === id))),
        ...recordUses("equipment", "장비 허용", db.equipment.filter((record) => record.equippableClassIds.includes(id))),
      ];
    case "skills":
      return [
        ...recordUses("classes", "직업 습득", db.classes.filter((record) => record.learnedSkills.some((skill) => skill.skillId === id))),
        ...recordUses("actors", "주인공 습득", db.actors.filter((record) => record.learnedSkills.some((skill) => skill.skillId === id))),
        ...recordUses("items", "아이템", db.items.filter((record) => record.skillId === id)),
        ...recordUses("enemies", "몬스터 행동", db.enemies.filter((record) => record.actions.some((action) => action.skillId === id))),
      ];
    case "items":
      return [
        ...recordUses("enemies", "몬스터 보상", db.enemies.filter((record) => record.rewards.dropItemId === id || record.rewards.drops?.some((drop) => drop.itemId === id))),
      ];
    case "equipment":
      return [
        ...recordUses("actors", "초기 장비", db.actors.filter((record) => Object.values(record.initialEquipment).includes(id))),
        ...recordUses("classes", "직업 허용", db.classes.filter((record) => record.equipmentPermissions.equipmentIds.includes(id))),
      ];
    case "enemies":
      return recordUses("troops", "적 그룹", db.troops.filter((record) => record.enemyIds.includes(id) || record.members?.some((member) => member.enemyId === id)));
    case "troops": {
      const uses: RecordUse[] = [];
      if (project.system.initialTroopId === id) uses.push({ kind: "시스템", name: "기본 전투" });
      for (const map of Object.values(project.maps)) {
        if (map.troopIds?.includes(id) || map.encounterTable?.some((entry) => entry.troopId === id) || map.fieldSpawns?.some((entry) => entry.troopId === id)) {
          uses.push({ kind: "맵 인카운터", name: map.name || map.id });
        }
      }
      return uses;
    }
    case "states":
      return [
        ...recordUses("skills", "스킬 효과", db.skills.filter((record) => record.stateEffects?.some((effect) => effect.stateId === id))),
        ...recordUses("items", "아이템 효과", db.items.filter((record) => record.stateEffects.some((effect) => effect.stateId === id) || record.healStateIds.includes(id))),
        ...recordUses("equipment", "장비", db.equipment.filter((record) => record.stateInflictIds.includes(id) || record.stateDefenseIds.includes(id))),
      ];
    default:
      return [];
  }
}

function recordChecks(project: Project, collection: DatabaseCollection, id: string, uses: readonly RecordUse[]): string[] {
  const db = project.database;
  const checks: string[] = [];
  switch (collection) {
    case "actors": {
      const actor = db.actors.find((record) => record.id === id);
      if (!actor) break;
      if (!db.classes.some((record) => record.id === actor.classId)) checks.push("직업이 없는 주인공입니다");
      if (!actor.faceResourceId) checks.push("얼굴 그래픽이 비어 있어요");
      if (!actor.characterResourceId) checks.push("걷는 모습이 비어 있어요");
      break;
    }
    case "classes": {
      const record = db.classes.find((entry) => entry.id === id);
      if (!record) break;
      if (record.learnedSkills.length === 0) checks.push("배우는 스킬이 없어요");
      if (!db.actors.some((actor) => actor.classId === id)) checks.push("이 직업을 쓰는 주인공이 없어요");
      break;
    }
    case "skills": {
      const record = db.skills.find((entry) => entry.id === id);
      if (!record) break;
      if (!record.description.trim()) checks.push("설명이 비어 있어요");
      break;
    }
    case "items": {
      const record = db.items.find((entry) => entry.id === id);
      if (!record) break;
      if (!record.description.trim()) checks.push("설명이 비어 있어요");
      break;
    }
    case "enemies": {
      const record = db.enemies.find((entry) => entry.id === id);
      if (!record) break;
      if (record.actions.length === 0) checks.push("행동이 하나도 없어요");
      break;
    }
    case "troops": {
      const record = db.troops.find((entry) => entry.id === id);
      if (!record) break;
      if (record.enemyIds.length === 0 && !(record.members?.length)) checks.push("몬스터가 한 마리도 없어요");
      break;
    }
    default:
      break;
  }
  // 시스템이 늘 쓰는 레코드(시작 파티·기본 전투)는 쓰는 곳이 있다. 나머지는 아무도 안 쓰면 알린다.
  if (uses.length === 0 && collection !== "states") checks.push("아직 아무 데서도 쓰지 않아요");
  return checks;
}

export function recordConnections(project: Project, collection: DatabaseCollection, id: string): RecordConnections {
  if (!CONNECTION_COLLECTIONS.has(collection)) return { uses: [], checks: [] };
  const uses = [
    ...databaseUses(project, collection, id),
    ...commandsReferenceLocations(project, collection, id).map(locationUse),
  ];
  // 목록이 못 잡는 참조(제작법·출하·박물관·승급 조건…)는 삭제 차단 검사가 안다. 목록이 비었는데
  // 차단 검사가 참조를 찾으면 그 문장을 한 줄로 보인다 — 「아무 데서도 안 쓴다」고 거짓말하지 않는다.
  if (uses.length === 0) {
    const message = projectDatabaseReferenceMessage(project, collection, id);
    if (message) uses.push({ kind: "다른 곳", name: message });
  }
  return { uses: uses.slice(0, USE_LIMIT), checks: recordChecks(project, collection, id, uses) };
}
