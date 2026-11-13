import { describe, expect, it } from "vitest";
import { deriveFieldFoeSheet, fieldFoeGain } from "@/player/fieldFoeSprite";
import { eventSpriteScale, withDerivedFieldFoe } from "@/player/eventSpriteResources";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";

/** 64x64 battler stand-in: a 40x30 body facing right with a bright "head" block on the right edge. */
function battler(): { w: number; h: number; data: Uint8ClampedArray } {
  const w = 64, h = 64, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 30; y < 60; y += 1) for (let x = 10; x < 50; x += 1) {
    const i = (y * w + x) * 4;
    const head = x >= 42;
    data.set(head ? [230, 200, 60, 255] : [90, 96, 110, 255], i);
  }
  return { w, h, data };
}

describe("derived field-foe sheet", () => {
  it("halves 64px battle art exactly (40x30 body → 20x15 + 2px outline/rim each side) in a 3x4 charset grid", () => {
    const sheet = deriveFieldFoeSheet(battler())!;
    expect(sheet.frameW).toBe(20 + 4);
    expect(sheet.w).toBe(sheet.frameW * 3);
    expect(sheet.h).toBe(sheet.frameH * 4);
  });

  it("faces right in the right row and mirrored in the left row", () => {
    const sheet = deriveFieldFoeSheet(battler())!;
    const headSide = (row: number): "left" | "right" => {
      const y = row * sheet.frameH + sheet.frameH - 6;
      let left = 0, right = 0;
      for (let x = 0; x < sheet.frameW; x += 1) {
        const i = (y * sheet.w + sheet.frameW + x) * 4; // column 1 (standing)
        if (sheet.data[i] === 230) (x < sheet.frameW / 2 ? (left += 1) : (right += 1));
      }
      return right > left ? "right" : "left";
    };
    expect(headSide(1)).toBe("right");
    expect(headSide(3)).toBe("left");
  });

  it("adds a dark outline and a light outer rim around the body", () => {
    const sheet = deriveFieldFoeSheet(battler())!;
    const y = sheet.frameH + Math.floor(sheet.frameH / 2);
    const row = Array.from({ length: sheet.frameW }, (_, x) => Array.from(sheet.data.subarray((y * sheet.w + sheet.frameW + x) * 4, (y * sheet.w + sheet.frameW + x) * 4 + 4)));
    const first = row.findIndex((p) => p[3]! > 0);
    expect(row[first]![0]).toBeGreaterThan(200); // rim
    expect(row[first + 1]![0]).toBeLessThan(90); // outline
  });

  it("cuts a whole-number enlarged foe at that much more detail instead of stretching the small chip (64px art ×2 → 1:1 body)", () => {
    expect(fieldFoeGain(64, 64, 2)).toBe(2);
    expect(fieldFoeGain(128, 128, 2)).toBe(2);
    expect(fieldFoeGain(128, 128, 3)).toBe(2);
    expect(fieldFoeGain(32, 32, 2)).toBe(1);
    const sheet = deriveFieldFoeSheet(battler(), 2)!;
    expect(sheet.frameW).toBe(40 + 4);
    // the authored ×2 is divided by the gain: same size on the map, drawn from the battle art's own pixels
    const derived = { texture: "__oprn_field_foe:x@2", frame: 0, charset: true, derived: true, gain: 2 };
    const plain = { texture: "__oprn_field_foe:x", frame: 0, charset: true, derived: true };
    expect(eventSpriteScale(derived, { width: 44 }, 2, 16, "manual")).toBe(1);
    expect(eventSpriteScale(plain, { width: 24 }, 2, 16, "manual")).toBe(2);
  });

  it("returns null for fully transparent art", () => {
    expect(deriveFieldFoeSheet({ w: 8, h: 8, data: new Uint8ClampedArray(256) })).toBeNull();
  });

  it("leaves explicit charsets alone and falls back to the static battler when the source is not loaded", () => {
    const scene = { textures: { exists: () => false, get: () => undefined, addCanvas: () => null } };
    const charset = { texture: "tex_easyrpg_charset_actor1", frame: charsetFrameIndex({ characterIndex: 0, direction: "down", pattern: 1 }) };
    expect(withDerivedFieldFoe(scene, charset)).toBe(charset);
    const monster = { texture: "generated-enemy-wolf-grey", frame: "__BASE", fitSize: 32, monster: true };
    expect(withDerivedFieldFoe(scene, monster)).toBe(monster);
  });
});
