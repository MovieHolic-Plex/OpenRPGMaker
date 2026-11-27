import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { IMAGE_IMPORT_MAX_BYTES, decideImageImport } from "@/editor/panels/resourceManagerImageImport";
import { AUDIO_IMPORT_MAX_BYTES, MOVIE_IMPORT_MAX_BYTES, mediaImportRuleFor } from "@/editor/panels/resourceManagerMediaImport";
import { applyBatchImportToProject, type BatchImportFileLike } from "@/editor/panels/resourceManagerBatchImport";

function makeFile(name: string, type: string, size: number): BatchImportFileLike {
  return { name, type, size };
}

describe("commercial asset limits and resourceManagerBatchImport", () => {
  it("uses commercial-grade size caps (16MB image, 32MB audio, 128MB video)", () => {
    expect(IMAGE_IMPORT_MAX_BYTES).toBe(16 * 1024 * 1024);
    expect(AUDIO_IMPORT_MAX_BYTES).toBe(32 * 1024 * 1024);
    expect(MOVIE_IMPORT_MAX_BYTES).toBe(128 * 1024 * 1024);
    expect(mediaImportRuleFor("music").maxBytes).toBe(32 * 1024 * 1024);
    expect(mediaImportRuleFor("sound").maxBytes).toBe(32 * 1024 * 1024);
    expect(mediaImportRuleFor("movie").maxBytes).toBe(128 * 1024 * 1024);
    expect(decideImageImport({ fileName: "cg.png", mimeType: "image/png", sizeBytes: 12 * 1024 * 1024 }).ok).toBe(true);
    expect(decideImageImport({ fileName: "huge.png", mimeType: "image/png", sizeBytes: 17 * 1024 * 1024 }).ok).toBe(false);
  });

  it("supports overwrite policy preserving existing UploadedAsset.id and updating profile in place", async () => {
    const project = createBlankProject();
    project.assets.uploaded["pic_existing_1"] = {
      id: "pic_existing_1",
      name: "hero_bust",
      kind: "picture",
      dataUrl: "data:image/png;base64,OLD_DATA",
      meta: { width: 128, height: 128, transparentColor: "#ff00ff" },
    };
    project.resourceProfiles.push({
      kind: "picture",
      name: "hero_bust",
      imageWidth: 128,
      imageHeight: 128,
      assetId: "pic_existing_1",
    });

    const report = await applyBatchImportToProject(
      project,
      [
        makeFile("hero_bust.png", "image/png", 2048),
        makeFile("villain_bust.png", "image/png", 4096),
      ],
      {
        kind: "picture",
        conflictPolicy: "overwrite",
        readAsDataUrl: async (file) => `data:image/png;base64,NEW_${file.name}`,
        prepareImage: async (dataUrl) => ({ dataUrl, width: 512, height: 512 }),
        generateId: (prefix) => `${prefix}_generated_1`,
      },
    );

    expect(report.overwritten).toHaveLength(1);
    expect(report.overwritten[0]).toEqual({
      fileName: "hero_bust.png",
      assetId: "pic_existing_1",
      assetName: "hero_bust",
    });
    expect(report.imported).toHaveLength(1);
    expect(report.imported[0]?.assetName).toBe("villain_bust");

    // Existing ID kept, bytes updated, custom meta preserved, profile updated without duplication
    const updated = project.assets.uploaded["pic_existing_1"]!;
    expect(updated.dataUrl).toBe("data:image/png;base64,NEW_hero_bust.png");
    expect(updated.meta.width).toBe(512);
    expect(updated.meta.transparentColor).toBe("#ff00ff");
    expect(project.resourceProfiles.filter((p) => p.assetId === "pic_existing_1")).toHaveLength(1);
    expect(project.resourceProfiles.find((p) => p.assetId === "pic_existing_1")?.imageWidth).toBe(512);
  });

  it("supports skip and rename policies while isolating per-file validation failures", async () => {
    const project = createBlankProject();
    project.assets.uploaded["bgm_orig"] = {
      id: "bgm_orig",
      name: "boss_theme",
      kind: "music",
      dataUrl: "data:audio/ogg;base64,ORIG",
      meta: {},
    };

    const skipReport = await applyBatchImportToProject(
      project,
      [
        makeFile("boss_theme.ogg", "audio/ogg", 1024),
        makeFile("too_big.wav", "audio/wav", 40 * 1024 * 1024),
        makeFile("bad_ext.flac", "audio/flac", 1024),
      ],
      {
        kind: "music",
        conflictPolicy: "skip",
        readAsDataUrl: async () => "data:audio/ogg;base64,NEW",
      },
    );

    expect(skipReport.skipped).toHaveLength(1);
    expect(skipReport.skipped[0]?.existingAssetId).toBe("bgm_orig");
    expect(skipReport.failed.map((f) => f.reason)).toEqual(["size", "format"]);
    expect(project.assets.uploaded["bgm_orig"]?.dataUrl).toBe("data:audio/ogg;base64,ORIG");

    let seq = 0;
    const renameReport = await applyBatchImportToProject(
      project,
      [
        makeFile("boss_theme.ogg", "audio/ogg", 1024),
        makeFile("boss_theme.mp3", "audio/mpeg", 2048),
      ],
      {
        kind: "music",
        conflictPolicy: "rename",
        readAsDataUrl: async (file) => `data:audio/mpeg;base64,${file.name}`,
        generateId: (prefix) => `${prefix}_${++seq}`,
      },
    );

    expect(renameReport.imported).toEqual([
      { fileName: "boss_theme.ogg", assetId: "bgm_1", assetName: "boss_theme (2)", renamedFrom: "boss_theme" },
      { fileName: "boss_theme.mp3", assetId: "bgm_2", assetName: "boss_theme (3)", renamedFrom: "boss_theme" },
    ]);
  });
});
