import { faceIdForSheetCell } from "@/assets/facesetFaceAssets";
import type { ActorRecord } from "@/project/types";

/**
 * 액터 기본 얼굴. 시트가 낱장으로 쪨개진 뒤로는 **그 시트의 0번 칸**을 가리킨다
 * (예전 `easyrpg-faceset-actor1` + 생략된 인덱스 = 지금의 `easyrpg-faceset-actor1-00`).
 */
export function defaultActorFaceResourceId(actor: Pick<ActorRecord, "id" | "characterResourceId">): string | undefined {
  const sheetResourceId = defaultActorFaceSheetId(actor);
  return sheetResourceId ? faceIdForSheetCell(sheetResourceId, 0) : undefined;
}

function defaultActorFaceSheetId(actor: Pick<ActorRecord, "id" | "characterResourceId">): string | undefined {
  switch (actor.characterResourceId) {
    case "easyrpg-charset-actor1":
      return "easyrpg-faceset-actor1";
    case "easyrpg-charset-actor2":
      return "easyrpg-faceset-actor2";
    case "easyrpg-charset-actor3":
      return "easyrpg-faceset-people1";
    case "easyrpg-charset-actor4":
      return "easyrpg-faceset-people2";
    case "easyrpg-charset-people1":
      return "easyrpg-faceset-people1";
    case "easyrpg-charset-people2":
      return "easyrpg-faceset-people2";
    default:
      break;
  }
  switch (actor.id) {
    case "actor_hero":
      return "easyrpg-faceset-actor1";
    case "actor_guardian":
      return "easyrpg-faceset-actor2";
    case "actor_mage":
    case "actor_cleric":
      return "easyrpg-faceset-people1";
    case "actor_scout":
    case "actor_ranger":
      return "easyrpg-faceset-people2";
    default:
      return undefined;
  }
}
