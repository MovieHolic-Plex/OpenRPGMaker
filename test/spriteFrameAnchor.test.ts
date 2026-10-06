import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults/blankProject";
import { deserialize, serialize } from "@/project/io/serialize";
import { validateAssets } from "@/project/io/shapeResourceFields";
import { resolvePlayerSpriteResource } from "@/player/playerSpriteResources";
import type { PlaySession } from "@/project/session";
import { resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { setCharacterBaseOrigin } from "@/player/characterOrigin";
import { applyCharacterLift, clearCharacterLift } from "@/player/characterHop";
import { placeCharacterSprite } from "@/player/characterDepth";
import type { SpriteDef } from "@/project/types";

const action: SpriteDef = {
  id: "native-action", image: { type: "bundled", id: "native-action-sheet" },
  frames: 48, frameWidth: 48, frameHeight: 40, anchor: { x: 24, y: 31 },
};

describe("native action frame ground anchor", () => {
  it("preserves pixel anchor on save/load and resolves either definition or texture id", () => {
    const project = createBlankProject();
    project.assets.sprites[action.id] = structuredClone(action);
    const loaded = deserialize(serialize(project));
    expect(loaded.assets.sprites[action.id].anchor).toEqual({ x: 24, y: 31 });
    for (const id of [action.id, "native-action-sheet"]) {
      expect(resolveEventSpriteTexture(loaded, id, 47)).toEqual({
        texture: "native-action-sheet", frame: 47, origin: { x: 0.5, y: 31 / 40 },
      });
    }
  });

  it("resolves a native walking anchor for the player without applying it to a fallback", () => {
    const project = createBlankProject();
    const actor = project.database.actors[0];
    actor.characterResourceId = "native-walk";
    project.assets.uploaded["native-walk"] = { id: "native-walk", name: "Native walk", kind: "charset",
      dataUrl: "data:image/png;base64,", meta: { width: 288, height: 256 } };
    project.assets.sprites["native-walk"] = { ...action, id: "native-walk",
      image: { type: "uploaded", id: "native-walk" }, frames: 96,
      frameWidth: 24, frameHeight: 32, anchor: { x: 12, y: 31 } };
    const session = { ...project.session, partyActorIds: [actor.id] } as PlaySession;
    expect(resolvePlayerSpriteResource(project, session).origin).toEqual({ x: 0.5, y: 31 / 32 });
    actor.characterResourceId = "missing-resource";
    expect(resolvePlayerSpriteResource(project, session).origin).toBeUndefined();
  });

  it("keeps the same ground contact through scaled hop, landing and switching back to a walk sheet", () => {
    const sprite = { y: 112, height: 40, scaleY: 2, originX: 0, originY: 0, depth: 0,
      setOrigin(x: number, y: number) { this.originX = x; this.originY = y; },
      setDepth(depth: number) { this.depth = depth; },
    };
    setCharacterBaseOrigin(sprite, { x: 0.5, y: 31 / 40 });
    placeCharacterSprite(sprite, "same");
    const depth = sprite.depth;
    const footOnScreen = () => sprite.y - sprite.originY * 80 + 31 * 2;
    expect(footOnScreen()).toBeCloseTo(112);
    applyCharacterLift(sprite, 16);
    expect(footOnScreen()).toBeCloseTo(96);
    expect(sprite.y).toBe(112);
    expect(sprite.depth).toBe(depth);
    clearCharacterLift(sprite);
    expect(footOnScreen()).toBeCloseTo(112);
    setCharacterBaseOrigin(sprite, undefined);
    sprite.height = 32;
    placeCharacterSprite(sprite, "same");
    expect([sprite.originX, sprite.originY]).toEqual([0.5, 1]);
  });

  it("rejects corrupt/outside anchors while accepting legacy definitions without the field", () => {
    for (const anchor of [{ x: 49, y: 31 }, { x: 24, y: -1 }, { x: NaN, y: 31 }]) {
      expect(() => validateAssets({ sprites: { a: { ...action, anchor } }, uploaded: {} })).toThrow();
    }
    const { anchor: _anchor, ...legacy } = action;
    expect(() => validateAssets({ sprites: { a: legacy }, uploaded: {} })).not.toThrow();
  });
});
