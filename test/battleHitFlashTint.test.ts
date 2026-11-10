import { describe, expect, it } from "vitest";
import { DEFAULT_CONTACT_PALETTE, contactPalette, drawContactFrame } from "@/player/battleImpactDom";
import { normalizeActorRecord, normalizeActorPatch, normalizeBattleHitFlash } from "@/project/actorModel";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io/serialize";

/** 착탄 섬광을 그릴 때 쓰인 색을 칠한 순서대로 모은다(캔버스 대신 기록기). */
function paintedColors(frame: number, strength: number, palette?: Parameters<typeof drawContactFrame>[3]): string[] {
  const colors: string[] = [];
  const ctx = {
    fillStyle: "" as string,
    clearRect() {},
    fillRect() { colors.push(String(ctx.fillStyle)); },
  };
  drawContactFrame(ctx as unknown as CanvasRenderingContext2D, frame, strength, palette);
  return colors;
}

describe("battle hit flash tint", () => {
  it("draws today's white/gold contact when no tint is given", () => {
    expect(contactPalette(undefined)).toBe(DEFAULT_CONTACT_PALETTE);
    expect(DEFAULT_CONTACT_PALETTE).toEqual({ early: "#fff5b8", late: "#ffc75a", core: "#ffffff" });
    const early = new Set(paintedColors(0, 0));
    const late = new Set(paintedColors(3, 2));
    expect(early).toEqual(new Set(["#fff5b8", "#ffffff", "#ffc75a"]));
    expect(late).toEqual(new Set(["#ffc75a", "#ffffff"]));
    expect(paintedColors(1, 4)).toEqual(paintedColors(1, 4, DEFAULT_CONTACT_PALETTE));
  });

  it("draws only the given colours when a tint is set", () => {
    const palette = contactPalette({ core: "#e8eef4", edge: "#ff8a2a" });
    expect(palette).toEqual({ early: "#f4bc8f", late: "#ff8a2a", core: "#e8eef4" });
    const used = new Set([...paintedColors(0, 0, palette), ...paintedColors(4, 2, palette)]);
    expect(used).toEqual(new Set(["#f4bc8f", "#ff8a2a", "#e8eef4"]));
    for (const legacy of ["#fff5b8", "#ffc75a", "#ffffff"]) expect(used.has(legacy)).toBe(false);
    expect(paintedColors(2, 2, palette)).toHaveLength(paintedColors(2, 2).length);
  });

  it("accepts only #RRGGBB pairs on the actor record", () => {
    expect(normalizeBattleHitFlash({ core: "#E8EEF4", edge: " #ff8a2a " })).toEqual({ core: "#e8eef4", edge: "#ff8a2a" });
    for (const bad of [undefined, null, "#fff", { core: "#fff", edge: "#ff8a2a" }, { core: "red", edge: "#ff8a2a" }, { core: "#e8eef4" }, { core: "#e8eef4", edge: "url(x)" }]) {
      expect(normalizeBattleHitFlash(bad)).toBeUndefined();
    }
    const base = createBlankProject().database.actors[0]!;
    expect("battleHitFlash" in normalizeActorRecord(base)).toBe(false);
    expect(normalizeActorRecord({ ...base, battleHitFlash: { core: "#zzzzzz", edge: "#ff8a2a" } } as never).battleHitFlash).toBeUndefined();
    expect(normalizeActorPatch({ battleHitFlash: { core: "#112233", edge: "#445566" } }).battleHitFlash).toEqual({ core: "#112233", edge: "#445566" });
  });

  it("round-trips through save and load, and old projects load without it", () => {
    const project = createBlankProject();
    const before = deserialize(serialize(project));
    expect(before.database.actors.every((actor) => actor.battleHitFlash === undefined)).toBe(true);
    project.database.actors[0]!.battleHitFlash = { core: "#e8eef4", edge: "#ff8a2a" };
    const loaded = deserialize(serialize(project));
    expect(loaded.database.actors[0]!.battleHitFlash).toEqual({ core: "#e8eef4", edge: "#ff8a2a" });
  });
});
