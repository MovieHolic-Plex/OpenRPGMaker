import { describe, expect, it } from "vitest";
import { listDatabaseResourceOptionsForTest } from "@/editor/panels/databaseResourcePickerDialog";
import { createBlankProject } from "@/project/defaults";

describe("sound/music resource catalogs in editor", () => {
  it("lists bundled EasyRPG SE and CC0 tones for sound picker", () => {
    const project = createBlankProject();
    const sound = listDatabaseResourceOptionsForTest("sound", project);
    const music = listDatabaseResourceOptionsForTest("music", project);
    expect(sound.length).toBeGreaterThan(50);
    expect(sound.some((entry) => entry.id === "easyrpg-sound-decision1")).toBe(true);
    expect(sound.some((entry) => entry.id === "cc0-sound-ui-confirm")).toBe(true);
    expect(music.some((entry) => entry.id === "cc0-music-field-loop")).toBe(true);
    expect(project.resourceProfiles.filter((profile) => profile.kind === "sound").length).toBeGreaterThan(50);
  });

  it("keeps EasyRPG SE ids available for event SE pickers", () => {
    const project = createBlankProject();
    const ids = new Set(
      project.resourceProfiles
        .filter((profile) => profile.kind === "sound" && profile.assetId)
        .map((profile) => profile.assetId as string)
    );
    // m2 Play SE picker reads resourceProfiles; ensure common SE ids are present.
    for (const id of ["easyrpg-sound-decision1", "easyrpg-sound-cursor1", "easyrpg-sound-attack1", "cc0-sound-ui-confirm"]) {
      expect(ids.has(id), id).toBe(true);
    }
  });
});
