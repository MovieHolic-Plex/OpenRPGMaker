import type { ActorRecord } from "@/project/types";

export function defaultActorFaceResourceId(actor: Pick<ActorRecord, "id" | "characterResourceId">): string | undefined {
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
