import { describe, expect, it } from "vitest";
import { DEFAULT_EASYRPG_CHARSET_ID } from "@/project/defaults";
import { charsetIdleFrameIndex } from "@/player/charsetMotion";
import { handleAction } from "@/player/playSceneMovement";
import type { EventAnimationType } from "@/project/types";
import { mockSprite, movementScene, type MockSprite } from "./runtimeEventPageFixtures";

type ActionScene = Parameters<typeof handleAction>[0];
type ActionSceneFixture = {
  readonly scene: ActionScene;
  readonly sprite: MockSprite;
};

function actionScene(animationType: EventAnimationType = "normal", textureKey = "tex_easyrpg_charset_actor1"): ActionSceneFixture {
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
      tileX: 0,
      tileY: 1,
      facing: "right",
      lastActionTargetKey: "",
      eventSprites: new Map([["npc", sprite]]),
      runEvent: async () => undefined,
    },
  };
}

describe("NPC action facing", () => {
  it("turns an action NPC toward the player before dialogue starts", () => {
    const { scene, sprite } = actionScene();

    handleAction(scene);

    expect(sprite.frame).toBe(charsetIdleFrameIndex(0, "left"));
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
  });
});
