import type { CharacterSprite } from "@/player/characterDepth";
import type { CharacterHop } from "@/player/characterHop";
import type { HopVisualScene } from "@/player/characterHopRuntime";
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
} & HopVisualScene;

export type AutonomousNpcSprite = CharacterSprite & {
  readonly texture: { readonly key: string };
  readonly width?: number;
  readonly height?: number;
  setScale?(scale: number): void;
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
  /** 체공 곡선(점프 포물선/낙하 중력). jump=true 일 때만 의미가 있다. */
  readonly hop?: CharacterHop;
};
