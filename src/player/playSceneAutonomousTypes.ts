import type { CharacterSprite } from "@/player/characterDepth";
import type { Dir } from "@/player/input";
import type { PlaySceneContext } from "@/player/playSceneTypes";

export type AutonomousNpcSceneContext = Pick<
  PlaySceneContext,
  | "autonomousNPCs"
  | "eventPositions"
  | "map"
  | "runEvent"
  | "session"
  | "tileX"
  | "tileY"
> &
  Partial<Pick<PlaySceneContext, "moving" | "movingTo">> & {
  readonly eventSprites: { get(eventId: string): AutonomousNpcSprite | undefined };
  readonly runtimeDom: Pick<PlaySceneContext["runtimeDom"], "upsertEventMarker">;
  readonly showRuntimeOverlay?: PlaySceneContext["showRuntimeOverlay"];
  readonly refreshRuntimeSurfaces?: PlaySceneContext["refreshRuntimeSurfaces"];
  readonly syncRuntimeState?: PlaySceneContext["syncRuntimeState"];
  readonly commandMoveRouteEventIds?: PlaySceneContext["commandMoveRouteEventIds"];
};

export type AutonomousNpcSprite = CharacterSprite & {
  readonly texture: { readonly key: string };
  setPosition(x: number, y: number): void;
  setFrame(frame: string | number): void;
  setAlpha(alpha: number): void;
  setTexture(texture: string, frame?: string | number): void;
};

export type MovementDelta = {
  readonly x: number;
  readonly y: number;
  readonly face: Dir;
  readonly jump?: boolean;
};
