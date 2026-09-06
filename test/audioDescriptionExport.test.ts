import { describe, expect, it } from "vitest";
import {
  createProjectBackup,
  deserialize,
  ProjectFormatError,
  restoreProjectBackup,
  serialize,
} from "@/project/io";
import { createProjectPackage, readProjectPackage } from "@/project/package";
import type { AudioDescriptionOverrides } from "@/project/types";
import { prepareWebExport } from "@/project/webExport";
import {
  collectUsedUploadedAssetIds,
  collectWebExportAssets,
} from "@/project/webExportAssets";
import { audioDescriptionProject } from "./fixtures/audioDescriptions";

describe("audio descriptions at export boundaries", () => {
  const states: readonly (AudioDescriptionOverrides | undefined)[] = [
    undefined,
    {},
    { music: {}, sound: {} },
    { music: { orphan: "" }, sound: { orphan: "AUDIO_EXPORT_VALUE" } },
    audioDescriptionProject().audioDescriptions,
  ];

  it.each(states)(
    "strips editor metadata without mutating the source when exporting %j",
    (descriptions) => {
      // Given
      const source = audioDescriptionProject();
      delete source.audioDescriptions;
      if (descriptions !== undefined) source.audioDescriptions = descriptions;
      const before = structuredClone(source);
      // When
      const prepared = prepareWebExport(source);
      // Then
      expect(Object.hasOwn(prepared.project, "audioDescriptions")).toBe(false);
      expect(Object.hasOwn(deserialize(prepared.projectJson), "audioDescriptions")).toBe(false);
      expect(source).toEqual(before);
    },
  );

  it.each(states)(
    "retains exact states in an editor package when packaging %j",
    async (descriptions) => {
      // Given
      const source = audioDescriptionProject();
      delete source.audioDescriptions;
      if (descriptions !== undefined) source.audioDescriptions = descriptions;
      const before = structuredClone(source);
      // When
      const restored = await readProjectPackage(createProjectPackage(source));
      // Then
      expect(restored.audioDescriptions).toEqual(descriptions);
      expect(Object.hasOwn(restored, "audioDescriptions")).toBe(descriptions !== undefined);
      expect(source).toEqual(before);
    },
  );

  it("retains clear and orphan states when restoring an earlier backup", () => {
    // Given
    const source = audioDescriptionProject();
    const descriptions = structuredClone(source.audioDescriptions);
    const backup = createProjectBackup(source);
    source.audioDescriptions = { sound: { replacement: "AFTER_BACKUP" } };
    // When
    const restored = restoreProjectBackup(backup);
    // Then
    expect(restored.audioDescriptions).toEqual(descriptions);
    expect(source.audioDescriptions).toEqual({ sound: { replacement: "AFTER_BACKUP" } });
  });

  it.each(["key-only", "value-reference"] as const)(
    "does not treat descriptions as upload usage when metadata is %s",
    (mode) => {
      // Given
      const source = audioDescriptionProject();
      source.assets.uploaded.unused_audio = {
        id: "unused_audio", name: "Unused", kind: "sound",
        dataUrl: "data:audio/wav;base64,AA==", meta: {},
      };
      source.audioDescriptions = {
        sound: {
          unused_audio: mode === "key-only" ? "AUDIO_EXPORT_UNUSED" : "unused_audio",
          orphan: mode === "key-only" ? "" : "unused_audio",
        },
      };
      const before = structuredClone(source);
      // When
      const used = collectUsedUploadedAssetIds(source);
      const assets = collectWebExportAssets(source);
      const prepared = prepareWebExport(source);
      // Then
      expect(used.has("unused_audio")).toBe(false);
      expect(assets.some((asset) => asset.zipPath === "assets/uploaded/unused_audio.wav")).toBe(false);
      expect(Object.hasOwn(prepared.project.assets.uploaded, "unused_audio")).toBe(false);
      expect(prepared.summary.uploadedAssetCount).toBe(0);
      expect(source).toEqual(before);
    },
  );

  it("retains a real upload reference when its description is cleared", () => {
    // Given
    const source = audioDescriptionProject();
    const upload = {
      id: "used_audio", name: "Used", kind: "music",
      dataUrl: "data:audio/wav;base64,AA==", meta: {},
    } as const;
    source.assets.uploaded.used_audio = upload;
    source.system.defaultBgmResourceId = upload.id;
    source.audioDescriptions = { music: { used_audio: "" } };
    // When
    const prepared = prepareWebExport(source);
    // Then
    expect(prepared.project.system.defaultBgmResourceId).toBe(upload.id);
    expect(prepared.project.assets.uploaded.used_audio).toEqual(upload);
    expect(prepared.assets).toContainEqual({
      kind: "uploaded", asset: upload, zipPath: "assets/uploaded/used_audio.wav",
    });
  });

  const malformed: readonly unknown[] = [
    null,
    [],
    7,
    { music: null },
    { sound: [] },
    { bgm: {} },
    { music: { orphan: 7 } },
    { sound: { orphan: "x".repeat(4001) } },
  ];

  it.each(malformed)("rejects malformed metadata when importing an editor package: %j", async (value) => {
    // Given: deliberately corrupt an in-memory fixture, not the Project type.
    const source = audioDescriptionProject();
    Reflect.set(source, "audioDescriptions", value);
    // When / Then
    await expect(readProjectPackage(createProjectPackage(source))).rejects.toBeInstanceOf(ProjectFormatError);
    expect(() => deserialize(serialize(source))).toThrow(ProjectFormatError);
  });

  it.each(malformed)("discards irrelevant malformed metadata when exporting playable data: %j", (value) => {
    // Given
    const source = audioDescriptionProject();
    Reflect.set(source, "audioDescriptions", value);
    const before = structuredClone(source);
    // When
    const prepared = prepareWebExport(source);
    // Then
    expect(Object.hasOwn(prepared.project, "audioDescriptions")).toBe(false);
    expect(Object.hasOwn(deserialize(prepared.projectJson), "audioDescriptions")).toBe(false);
    expect(source).toEqual(before);
  });
});
