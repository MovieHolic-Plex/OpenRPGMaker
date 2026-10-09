import { describe, expect, it, vi } from "vitest";
import { automaticCharacterScale, characterRenderScale, mapCharacterScale } from "@/project/characterScale";
import { syncPlayerCharacterScale } from "@/player/playerCharacterScale";
import { eventSpriteScale, isCharsetSpriteTexture, resolveEventSpriteTexture } from "@/player/eventSpriteResources";
import { createBlankProject } from "@/project/defaults/blankProject";
import { store } from "@/project/store";

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
    // Single-size project: the store's maps object is replaced on every edit, so hand out a fresh one.
    vi.spyOn(store, "getCurrent").mockImplementation(() => ({ ...project, maps: { [map.id]: { ...map } } }));
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
    vi.restoreAllMocks();
  });

  it("keeps the reference-cell fit on maps whose cell differs, so the on-screen size holds", () => {
    // 16px project with one 32px map: fit on 16 (1x), then x2 in 32px world pixels.
    expect(mapCharacterScale(24, 32, 16)).toBe(2);
    expect(mapCharacterScale(24, 48, 16)).toBe(3);
    // 32px project visiting a 16px map: 1x on 32, half in 16px world pixels (camera zooms x2).
    expect(mapCharacterScale(24, 16, 32)).toBe(0.5);
    // Same cell as the reference is exactly the old rule.
    expect([16, 32, 48].map(size => mapCharacterScale(24, size))).toEqual([1, 1, 2]);
    expect(characterRenderScale(24, 32, undefined, 16)).toBe(2);
    expect(characterRenderScale(24, 32, { scale: 1, scaleMode: "manual" }, 16)).toBe(1); // manual stays absolute
    expect(characterRenderScale(24, 32, { scale: 2, scaleMode: "auto" }, 16)).toBe(4);
  });

  it("applies the same rule to charset NPCs/followers, leaving props and fitted monsters alone", () => {
    const project = createBlankProject();
    const charset = resolveEventSpriteTexture(project, "tex_easyrpg_charset_actor1", 0);
    expect(isCharsetSpriteTexture(charset)).toBe(true);
    expect(eventSpriteScale(charset, { width: 24, height: 32 }, undefined, 48)).toBe(2);
    expect(eventSpriteScale(charset, { width: 24, height: 32 }, 1, 48)).toBe(1);
    expect(eventSpriteScale({ texture: "door", frame: 0 }, { width: 16, height: 32 }, undefined, 48)).toBe(1);
    expect(eventSpriteScale({ texture: "monster", frame: 0, fitSize: 32 }, { width: 384, height: 192 }, 2, 48)).toBe(1 / 6);
    expect(eventSpriteScale(charset, { width: 24, height: 32 }, undefined, 32, undefined, 16)).toBe(2);
    expect(eventSpriteScale({ texture: "door", frame: 0 }, { width: 16, height: 32 }, undefined, 32, undefined, 16)).toBe(1);
  });
});
