import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { normalizeDatabaseRecords } from "@/project/databaseRecordModel";
import { deserialize, serialize } from "@/project/io";
import type { ProjectDatabaseRecords } from "@/project/types";

describe("RPG2003 animation schema", () => {
  it("ships effect animations with sheet frames cells timings and display flags", () => {
    // Given: the blank project owns the canonical starter animation database.
    const project = createBlankProject();

    // When: an effect animation is read by editor/runtime surfaces.
    const hit = project.database.battleAnimations.find((animation) => animation.id === "anim_hit");

    // Then: it is not a shallow id/name/resource record.
    expect(hit).toMatchObject({
      id: "anim_hit",
      resourceId: "scarloxy-battle-anim-scratch",
      sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
      scope: "singleTarget",
      position: "center",
      large: false,
    });
    expect(hit?.frames?.[0]?.cells[0]).toMatchObject({
      pattern: 0,
      x: 0,
      y: -8,
      zoom: 100,
      opacity: 255,
      visible: true,
    });
    expect(hit?.timings?.[0]).toMatchObject({
      frameIndex: 0,
      flash: { target: "target", color: { red: 255, green: 255, blue: 255, gray: 0 }, durationFrames: 4 },
    });
  });

  it("normalizes legacy shallow battle animations into runtime-safe effect records", () => {
    // Given: an existing save only has legacy battle animation fields.
    const legacyDatabase: ProjectDatabaseRecords = {
      actors: [],
      classes: [],
      skills: [],
      items: [],
      equipment: [],
      enemies: [],
      troops: [],
      states: [],
      battleAnimations: [{ id: "anim_legacy", name: "Legacy", resourceId: "scarloxy-battle-anim-scratch" }],
    };

    // When: the database passes through runtime normalization.
    const normalized = normalizeDatabaseRecords(legacyDatabase);

    // Then: the effect animation gains safe playback fields.
    expect(normalized.battleAnimations[0]).toMatchObject({
      id: "anim_legacy",
      name: "Legacy",
      resourceId: "scarloxy-battle-anim-scratch",
      sheet: { frameWidth: 96, frameHeight: 96, columns: 5 },
      frames: [{ cells: [{ pattern: 0, visible: true }] }],
      timings: [],
    });
  });

  it("round-trips default effect animation records through project IO", () => {
    // Given: the starter project includes expanded animation records.
    const project = createBlankProject();

    // When: the project is serialized and deserialized through the real IO layer.
    const restored = deserialize(serialize(project));

    // Then: the animation collection survives validation.
    expect(restored.database.battleAnimations[0]?.frames?.length).toBeGreaterThan(0);
  });
});
