import { EASYRPG_CHARSET_ASSETS, charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Dir } from "@/player/input";
import { defaultActorCharacterResourceId } from "@/project/actorModel";
import { DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults/constants";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

const CHARSET_CHARACTER_INDEX = 0;
const CHARSET_IDLE_PATTERN = 1;
const CHARSET_WALK_SEQUENCE = [0, 1, 2, 1] as const;
export type PlayerSpriteKind = "charset";

export type PlayerSpriteResource = {
  readonly texture: string;
  readonly resourceId: string;
  readonly kind: PlayerSpriteKind;
  readonly walkFrameCount: number;
  readonly idleFrameFor: (direction: Dir) => string | number;
  readonly walkFrameFor: (direction: Dir, walkFrame: number) => string | number;
};

export function resolvePlayerSpriteResource(project: Project, session: PlaySession): PlayerSpriteResource {
  const actorId = session.partyActorIds[0];
  const actor = actorId ? project.database.actors.find((entry) => entry.id === actorId) : undefined;
  const resourceId = actorId ? session.actorCharacterResourceIds?.[actorId] ?? actor?.characterResourceId : undefined;
  const charsetAsset = resourceId ? findCharsetAsset(resourceId) : undefined;
  if (charsetAsset) {
    return createCharsetSpriteResource(charsetAsset.id, charsetAsset.textureKey);
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

function findCharsetAsset(resourceId: string): (typeof EASYRPG_CHARSET_ASSETS)[number] | undefined {
  return EASYRPG_CHARSET_ASSETS.find((asset) => asset.id === resourceId || asset.textureKey === resourceId);
}

function createCharsetSpriteResource(resourceId: string, texture: string): PlayerSpriteResource {
  return {
    texture,
    resourceId,
    kind: "charset",
    walkFrameCount: CHARSET_WALK_SEQUENCE.length,
    idleFrameFor: (direction) => charsetFrame(direction, CHARSET_IDLE_PATTERN),
    walkFrameFor: (direction, walkFrame) => charsetFrame(direction, walkPattern(CHARSET_WALK_SEQUENCE, walkFrame)),
  };
}

function charsetFrame(direction: Dir, pattern: number): number {
  return charsetFrameIndex({
    characterIndex: CHARSET_CHARACTER_INDEX,
    direction,
    pattern,
  });
}

function walkPattern(sequence: readonly number[], walkFrame: number): number {
  const index = Math.abs(Math.trunc(walkFrame)) % sequence.length;
  return sequence[index] ?? 0;
}
