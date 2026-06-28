import { SPRITE_COLS, TEX_NPC } from "@/assets/bundled";
import { EASYRPG_CHARSET_ASSETS, charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { Dir } from "@/player/input";
import type { PlaySession } from "@/project/session";
import type { Project } from "@/project/types";

const CHARSET_CHARACTER_INDEX = 0;
const CHARSET_IDLE_PATTERN = 1;
const CHARSET_WALK_SEQUENCE = [0, 1, 2, 1] as const;
const LEGACY_WALK_SEQUENCE = [0, 1] as const;

const LEGACY_DIRECTION_ROW: Record<Dir, number> = {
  down: 0,
  left: 1,
  right: 2,
  up: 3,
};

export type PlayerSpriteKind = "charset" | "legacy";

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
  const resourceId = actor?.characterResourceId;
  const charsetAsset = resourceId
    ? EASYRPG_CHARSET_ASSETS.find((asset) => asset.id === resourceId || asset.textureKey === resourceId)
    : undefined;
  if (charsetAsset) {
    return createCharsetSpriteResource(charsetAsset.id, charsetAsset.textureKey);
  }
  return createLegacySpriteResource(resourceId ?? TEX_NPC);
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

function createLegacySpriteResource(resourceId: string): PlayerSpriteResource {
  return {
    texture: TEX_NPC,
    resourceId,
    kind: "legacy",
    walkFrameCount: LEGACY_WALK_SEQUENCE.length,
    idleFrameFor: (direction) => legacyFrame(direction, 0),
    walkFrameFor: (direction, walkFrame) => legacyFrame(direction, walkPattern(LEGACY_WALK_SEQUENCE, walkFrame)),
  };
}

function charsetFrame(direction: Dir, pattern: number): number {
  return charsetFrameIndex({
    characterIndex: CHARSET_CHARACTER_INDEX,
    direction,
    pattern,
  });
}

function legacyFrame(direction: Dir, pattern: number): number {
  return LEGACY_DIRECTION_ROW[direction] * SPRITE_COLS + pattern;
}

function walkPattern(sequence: readonly number[], walkFrame: number): number {
  const index = Math.abs(Math.trunc(walkFrame)) % sequence.length;
  return sequence[index] ?? 0;
}
