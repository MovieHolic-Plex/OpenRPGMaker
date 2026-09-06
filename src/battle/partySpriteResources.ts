import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { BattlerPartyFacing } from "@/battle/battlerPlacements";
import type { BattleSkinId } from "@/battle/skins/types";
import type { Project } from "@/project/types";

type PartyActorResource = { readonly battleCharacterResourceId?: string };

/** Back views belong to the same actor as the authored battle sheet; no separate authored field. */
function actorBackSpriteId(actor: PartyActorResource): string | null {
  const slug = /^generated-actor-(hero-\d+)-battle$/.exec(actor.battleCharacterResourceId ?? "")?.[1];
  return slug ? `generated-actor-${slug}-back` : null;
}

/** Shared by battle rendering and export so derived resources follow the same fallback rules. */
export function skinPartySpriteUrl(
  project: Pick<Project, "assets">,
  skinId: BattleSkinId,
  index: number,
  facing: BattlerPartyFacing,
  actor?: PartyActorResource,
): { url: string; perActor: boolean; resourceId: string } | null {
  if (facing === "hidden") return null;
  if (facing === "back" && actor) {
    const backId = actorBackSpriteId(actor);
    // A derived ID is usable only when the resource resolver accepts it.
    const backUrl = backId && resolveAssetResourceUrl(backId, { project });
    if (backId && backUrl) return { url: backUrl, perActor: true, resourceId: backId };
  }
  const id = skinId === "pokemon"
    ? "bskin-ally-creature-back"
    : `bskin-party-${index % 2 === 0 ? "warrior" : "mage"}-${facing}`;
  const url = resolveAssetResourceUrl(id, { project });
  return url ? { url, perActor: false, resourceId: id } : null;
}
