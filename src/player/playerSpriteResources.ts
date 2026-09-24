import { CHARSET_ASSETS } from "@/assets/charsetCatalog";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Dir } from "@/player/input";
import { defaultActorCharacterResourceId } from "@/project/actorModel";
import { resolveActorAppearance } from "@/project/characterAppearances";
import { parseActorGraphicOverride } from "@/project/actorGraphicOverride";
import { DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults/constants";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

const CHARSET_IDLE_PATTERN = 1;
const CHARSET_WALK_SEQUENCE = [0, 1, 2, 1] as const;
export type PlayerSpriteKind = "charset";

export type PlayerSpriteResource = {
  readonly texture: string;
  readonly resourceId: string;
  /** 시트 안 인물 칸(0~7). 같은 시트의 다른 칸으로 갈아입었는지 가르는 데 쓴다. */
  readonly characterIndex: number;
  readonly kind: PlayerSpriteKind;
  readonly walkFrameCount: number;
  readonly idleFrameFor: (direction: Dir) => string | number;
  readonly walkFrameFor: (direction: Dir, walkFrame: number) => string | number;
};

export function resolvePlayerSpriteResource(project: Project, session: PlaySession): PlayerSpriteResource {
  const actorId = session.partyActorIds[0];
  const actor = actorId ? project.database.actors.find((entry) => entry.id === actorId) : undefined;
  const effectiveActor = actor ? resolveActorAppearance(project, actor) : undefined;
  const rawOverride = actorId ? session.actorCharacterResourceIds?.[actorId] : undefined;
  const override = rawOverride !== undefined ? parseActorGraphicOverride(rawOverride) : undefined;
  const resourceId = override?.resourceId ?? effectiveActor?.characterResourceId;
  const characterIndex = override !== undefined ? override.characterIndex : effectiveActor?.characterIndex ?? 0;
  if (resourceId && project.assets.uploaded[resourceId]?.kind === "charset") {
    return createCharsetSpriteResource(resourceId, resourceId, characterIndex);
  }
  const charsetAsset = resourceId ? findCharsetAsset(resourceId) : undefined;
  if (charsetAsset) {
    return createCharsetSpriteResource(charsetAsset.id, charsetAsset.textureKey, characterIndex);
  }
  const defaultResourceId = actorId ? defaultActorCharacterResourceId({ id: actorId }) : undefined;
  const defaultCharsetAsset = defaultResourceId ? findCharsetAsset(defaultResourceId) : undefined;
  if (defaultCharsetAsset) {
    return createCharsetSpriteResource(defaultCharsetAsset.id, defaultCharsetAsset.textureKey);
  }
  const fallbackCharsetAsset = findCharsetAsset(DEFAULT_EASYRPG_CHARSET_ID);
  if (fallbackCharsetAsset) {
    return createCharsetSpriteResource(fallbackCharsetAsset.id, fallbackCharsetAsset.textureKey);
  }
  return createCharsetSpriteResource(DEFAULT_EASYRPG_CHARSET_ID, DEFAULT_EASYRPG_CHARSET_ID);
}

function findCharsetAsset(resourceId: string): (typeof CHARSET_ASSETS)[number] | undefined {
  return CHARSET_ASSETS.find((asset) => asset.id === resourceId || asset.textureKey === resourceId);
}

function createCharsetSpriteResource(resourceId: string, texture: string, characterIndex = 0): PlayerSpriteResource {
  return {
    texture,
    resourceId,
    characterIndex,
    kind: "charset",
    walkFrameCount: CHARSET_WALK_SEQUENCE.length,
    idleFrameFor: (direction) => charsetFrameIndex({ characterIndex, direction, pattern: CHARSET_IDLE_PATTERN }),
    walkFrameFor: (direction, walkFrame) => charsetFrameIndex({ characterIndex, direction, pattern: walkPattern(CHARSET_WALK_SEQUENCE, walkFrame) }),
  };
}

function walkPattern(sequence: readonly number[], walkFrame: number): number {
  const index = Math.abs(Math.trunc(walkFrame)) % sequence.length;
  return sequence[index] ?? 0;
}
