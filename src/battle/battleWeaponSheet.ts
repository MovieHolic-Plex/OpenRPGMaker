// 장비한 무기의 계열로 배우의 전투 시트를 고른다.
//
// 왜(2026-11-15 폴른 스타 QA): 창을 들려도 전투의 카엘은 검을 들고 서 있었다 — 전투 시트가 배우마다 한 장이었다.
// 규칙은 엔진에 하나, 어느 계열에 어느 시트인지는 게임 자료(ActorRecord.weaponBattleSheets)가 정한다.
// 계열은 새 낱말을 만들지 않고 무기의 공격 속성(attackElementIds)을 쓴다 — 기술의 「무기 공명」(weaponAffinity)이 이미 같은 낱말로 무기 계열을 가린다.
import type { ActorInitialEquipment, Project } from "@/project/types";

type SheetOwner = {
  readonly battleCharacterResourceId?: string;
  readonly weaponBattleSheets?: Readonly<Record<string, string>>;
};

/**
 * 이 장비로 설 전투 시트. equipment 는 유효 장비(effectiveActorEquipment 를 거친 것)다.
 * 표가 없거나, 무기 칸이 비었거나, 그 무기의 계열이 표에 없으면 기본 시트(battleCharacterResourceId) 그대로다.
 * 계열이 여럿인 무기는 무기에 적힌 순서로 표에 있는 첫 계열을 쓴다.
 */
export function actorBattleSheetForEquipment(
  project: Pick<Project, "database">,
  actor: SheetOwner,
  equipment: ActorInitialEquipment | undefined,
): string | undefined {
  const table = actor.weaponBattleSheets;
  const weaponId = equipment?.weapon;
  if (!table || !weaponId) return actor.battleCharacterResourceId;
  const weapon = project.database.equipment.find((record) => record.id === weaponId);
  for (const kind of weapon?.attackElementIds ?? []) {
    const sheet = table[kind];
    if (sheet) return sheet;
  }
  return actor.battleCharacterResourceId;
}
