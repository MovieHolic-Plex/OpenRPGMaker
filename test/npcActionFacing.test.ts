import { describe, expect, it } from "vitest";
import { DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults";
import { charsetIdleFrameIndex } from "@/player/charsetMotion";
import { handleAction } from "@/player/playSceneMovement";
import { renderTiles } from "@/player/playSceneMapRuntime";
import { runtimeMoverSnapshots } from "@/player/runtimeMoverSnapshots";
import type { EventAnimationType } from "@/project/types";
import type { AutonomousMover } from "@/player/playSceneTypes";
import type { Dir } from "@/player/input";
import { mockSprite, movementScene, renderSceneWith, type MockSprite } from "./runtimeEventPageFixtures";

type ActionScene = Parameters<typeof handleAction>[0];
type ActionSceneFixture = {
  readonly scene: ActionScene;
  readonly sprite: MockSprite;
};

function actionScene(
  animationType: EventAnimationType = "normal",
  textureKey = "tex_easyrpg_charset_actor1",
  player: { readonly x: number; readonly y: number; readonly facing: Dir } = { x: 0, y: 1, facing: "right" }
): ActionSceneFixture {
  const scene = movementScene({
    animationType,
    graphic: {
      direction: "down",
      pattern: 0,
      sprite: { type: "bundled", id: "easyrpg-charset-actor1" },
    },
    movement: { type: "fixed", speed: 3, frequency: 3 },
  });
  const sprite = mockSprite(0, 0, textureKey);
  return {
    sprite,
    scene: {
      ...scene,
      tileX: player.x,
      tileY: player.y,
      facing: player.facing,
      lastActionTargetKey: "",
      eventSprites: new Map([["npc", sprite]]),
      runEvent: async () => undefined,
    },
  };
}

describe("NPC action facing", () => {
  it.each([
    ["west", { x: 0, y: 1, facing: "right" }, "left"],
    ["east", { x: 2, y: 1, facing: "left" }, "right"],
    ["north", { x: 1, y: 0, facing: "down" }, "up"],
    ["south", { x: 1, y: 2, facing: "up" }, "down"],
  ] satisfies Array<readonly [string, { readonly x: number; readonly y: number; readonly facing: Dir }, Dir]>)(
    "turns a static action NPC toward a player on the %s side before dialogue starts",
    (_label, player, expectedDirection) => {
      const { scene, sprite } = actionScene("normal", "tex_easyrpg_charset_actor1", player);

      handleAction(scene);

      expect(scene.eventPositions.npc?.direction).toBe(expectedDirection);
      expect(sprite.frame).toBe(charsetIdleFrameIndex(0, expectedDirection));
    }
  );

  it("uses runtime direction when action-facing static events are rendered again", () => {
    const scene = renderSceneWith({
      graphic: {
        direction: "down",
        pattern: 0,
        sprite: { type: "bundled", id: "tex_easyrpg_charset_actor1" },
      },
    });
    scene.eventPositions.npc = { ...scene.eventPositions.npc!, direction: "right" };

    renderTiles(scene);

    expect(scene.eventSprites.get("npc")?.frame).toBe(charsetIdleFrameIndex(0, "right"));
  });

  it("turns a default bundled NPC sprite toward the player before dialogue starts", () => {
    const { scene, sprite } = actionScene("normal", DEFAULT_EASYRPG_CHARSET_ID);

    handleAction(scene);

    expect(sprite.frame).toBe(charsetIdleFrameIndex(0, "left"));
  });

  it("keeps fixed-direction action NPCs facing their authored direction", () => {
    const { scene, sprite } = actionScene("fixedDirection");

    handleAction(scene);

    expect(sprite.frame).toBeNull();
    expect(scene.eventPositions.npc?.direction).toBeUndefined();
  });

  it("updates autonomous mover facing and runtime mover snapshots before dialogue starts", () => {
    const { scene, sprite } = actionScene("normal", "tex_easyrpg_charset_actor1", { x: 2, y: 1, facing: "left" });
    const mover = autonomousMover("down");
    scene.autonomousNPCs.set("npc", mover);

    handleAction(scene);

    expect(mover.facing).toBe("right");
    expect(runtimeMoverSnapshots(scene.autonomousNPCs).npc?.facing).toBe("right");
    expect(sprite.frame).toBe(charsetIdleFrameIndex(0, "right"));
  });

  it("respects move route direction fix on autonomous action NPCs", () => {
    const { scene, sprite } = actionScene("normal", "tex_easyrpg_charset_actor1", { x: 2, y: 1, facing: "left" });
    const mover = autonomousMover("down", true);
    scene.autonomousNPCs.set("npc", mover);

    handleAction(scene);

    expect(mover.facing).toBe("down");
    expect(runtimeMoverSnapshots(scene.autonomousNPCs).npc?.directionFix).toBe(true);
    expect(sprite.frame).toBe(charsetIdleFrameIndex(0, "down"));
  });
});

function autonomousMover(facing: Dir, directionFix = false): AutonomousMover {
  return {
    moves: [],
    step: 0,
    timer: 0,
    repeat: false,
    strategy: "sequence",
    facing,
    directionFix,
    through: false,
    animationEnabled: true,
    opacity: 255,
    speedRank: 3,
    frequencyRank: 3,
    moveIntervalMs: 560,
    moveDurationMs: 400,
    activeMove: null,
  };
}
