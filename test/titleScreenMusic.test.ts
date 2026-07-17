import { describe, expect, it } from "vitest";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { defaultSystem, defaultTitleScreenSettings } from "@/project/defaults/defaultDatabase";
import { createBlankProject } from "@/project/defaults";

describe("titleScreen.musicResourceId", () => {
  it("preserves musicResourceId through system normalize", () => {
    const system = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        musicResourceId: "easyrpg-music-field-1",
      },
    });
    expect(system.titleScreen?.musicResourceId).toBe("easyrpg-music-field-1");
  });

  it("allows missing/empty musicResourceId (silent title)", () => {
    const without = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
      },
    });
    expect(without.titleScreen?.musicResourceId).toBeUndefined();

    const empty = normalizeSystemRecords({
      ...defaultSystem(),
      titleScreen: {
        ...defaultTitleScreenSettings(),
        musicResourceId: "",
      },
    });
    expect(empty.titleScreen?.musicResourceId).toBeUndefined();
  });

  it("keeps blank project titleScreen without music field", () => {
    const project = createBlankProject();
    expect(project.system.titleScreen?.musicResourceId).toBeUndefined();
  });
});
