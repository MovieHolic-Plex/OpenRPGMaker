import { describe, expect, it, vi } from "vitest";
import { automaticCharacterScale, characterRenderScale } from "@/project/characterScale";
import { syncPlayerCharacterScale } from "@/player/playerCharacterScale";
import { eventSpriteScale, isCharsetSpriteTexture, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { createBlankProject } from "@/project/defaults/blankProject";

describe("automatic walking-character scale", () => {
  it("uses the requested middle size for the 24px frame on a 48px map", () => {
    expect([16, 32, 48].map(size => automaticCharacterScale(24, size))).toEqual([1, 1, 2]);
    expect(automaticCharacterScale(48, 48)).toBe(1);
    expect(automaticCharacterScale(16, 48)).toBe(3);
    expect(automaticCharacterScale(32, 48)).toBe(1); // no uneven 1.5x pixels
    expect(automaticCharacterScale(96, 48)).toBe(1); // large authored art isn't shrunk
    expect(automaticCharacterScale(0, 48)).toBe(1);
  });

  it("preserves legacy/manual scales, including 1x, and separates the auto body multiplier", () => {
    expect(characterRenderScale(24, 48)).toBe(2);
    expect(characterRenderScale(24, 48, { scale: 1 })).toBe(1);
    expect(characterRenderScale(24, 48, { scale: 1, scaleMode: "manual" })).toBe(1);
    expect(characterRenderScale(24, 48, { scale: 1.5 })).toBe(1.5);
    expect(characterRenderScale(24, 48, { scale: 3, scaleMode: "auto" })).toBe(6);
    expect(characterRenderScale(24, 48, { scale: 8, scaleMode: "auto" })).toBe(8);
  });

  it("refreshes after map/graphic changes without overwriting an in-progress squash", () => {
    const project = createBlankProject();
    const map = { ...project.maps[project.startMapId]!, tileSize: 48 };
    const player = { width: 24, setScale: vi.fn() };
    syncPlayerCharacterScale({ map, player });
    syncPlayerCharacterScale({ map, player });
    expect(player.setScale.mock.calls).toEqual([[2]]);
    map.tileSize = 16;
    syncPlayerCharacterScale({ map, player });
    map.tileSize = 48;
    syncPlayerCharacterScale({ map, player });
    player.width = 48;
    syncPlayerCharacterScale({ map, player });
    expect(player.setScale.mock.calls).toEqual([[2], [1], [2], [1]]);
  });

  it("applies the same rule to charset NPCs/followers, leaving props and fitted monsters alone", () => {
    const project = createBlankProject();
    const charset = resolveEventSpriteTexture(project, "tex_easyrpg_charset_actor1", 0);
    expect(isCharsetSpriteTexture(charset)).toBe(true);
    expect(eventSpriteScale(charset, { width: 24, height: 32 }, undefined, 48)).toBe(2);
    expect(eventSpriteScale(charset, { width: 24, height: 32 }, 1, 48)).toBe(1);
    expect(eventSpriteScale({ texture: "door", frame: 0 }, { width: 16, height: 32 }, undefined, 48)).toBe(1);
    expect(eventSpriteScale({ texture: "monster", frame: 0, fitSize: 32 }, { width: 384, height: 192 }, 2, 48)).toBe(1 / 6);
  });
});
