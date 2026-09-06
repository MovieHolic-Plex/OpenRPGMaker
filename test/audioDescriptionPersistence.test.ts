import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createProjectBackup, deserialize, migrateV1toV2, ProjectFormatError, restoreProjectBackup, serialize, serializePretty } from "@/project/io";
import { createProjectPackage, readProjectPackage } from "@/project/package";
import { getAudioDescriptionOverride, resetAudioDescriptionOverride, setAudioDescriptionOverride } from "@/project/audioDescriptions";
import type { AudioDescriptionOverrides } from "@/project/types";
import eventPagesV3 from "./fixtures/projects/event-pages-v3.json";
import { makeV1 } from "./migrationFixtures";

describe("audio description serialization", () => {
  it.each([
    ["v1", () => makeV1()],
    ["v2", () => migrateV1toV2(makeV1())],
    ["v3", () => eventPagesV3],
    ["v4", () => createBlankProject()],
  ] as const)("preserves absent overrides when loading legacy %s", (_version, fixture) => {
    // Given
    const raw = JSON.stringify(fixture());
    // When
    const loaded = deserialize(raw);
    const restored = deserialize(serialize(loaded));
    // Then
    expect(Object.hasOwn(loaded, "audioDescriptions")).toBe(false);
    expect(Object.hasOwn(restored, "audioDescriptions")).toBe(false);
    expect(restored.version).toBe(4);
  });

  it("preserves serialized legacy fields when loading a blank project", () => {
    // Given
    const project = createBlankProject();
    const raw = serialize(project);
    // When
    const restored = deserialize(raw);
    // Then
    expect(restored.meta).toEqual(project.meta);
    expect(restored.assets).toEqual(project.assets);
  });
});

describe("audio description load boundary", () => {
  const project = createBlankProject();
  it.each([
    ["null map", null],
    ["array map", []],
    ["numeric map", 7],
    ["null music", { music: null }],
    ["array music", { music: [] }],
    ["numeric music", { music: 7 }],
    ["numeric sound", { sound: 7 }],
    ["string partition", { music: "invalid" }],
    ["null sound", { sound: null }],
    ["array sound", { sound: [] }],
    ["unknown partition", { bgm: {} }],
    ["non-audio partition", { picture: {} }],
    ["null value", { music: { orphan: null } }],
    ["array value", { sound: { orphan: [] } }],
    ["numeric value", { music: { orphan: 7 } }],
    ["boolean value", { sound: { orphan: false } }],
    ["object value", { sound: { orphan: {} } }],
    ["overlong value", { music: { orphan: "x".repeat(4001) } }],
    ["overlong UTF-16 value", { sound: { orphan: "\uD83C\uDFB5".repeat(2001) } }],
    ["overlong padded value", { music: { orphan: ` ${"x".repeat(4000)} ` } }],
  ])("rejects malformed audioDescriptions when loading %s", (_label, audioDescriptions) => {
    // Given
    const raw = JSON.stringify({ ...project, audioDescriptions });
    // When / Then
    expect(() => deserialize(raw)).toThrow(ProjectFormatError);
  });
});

describe("authored audio description round trips", () => {
  const project = createBlankProject();
  const resource = { kind: "music", resourceId: "raw_orphan_audio" } as const;
  it.each([serialize, serializePretty])("preserves raw audio IDs matching retired field names when using %s", (write) => {
    const audioDescriptions = {
      music: { terrainTemplates: "AUDIO_DESC_RESERVED_MUSIC" },
      sound: { terrainTemplates: "" },
    };
    const source = { ...project, audioDescriptions, terrainTemplates: { legacy: true } };

    const result = deserialize(write(source));

    expect(result.audioDescriptions).toEqual(audioDescriptions);
    expect(Object.hasOwn(JSON.parse(write(source)), "terrainTemplates")).toBe(false);
  });
  const authored: AudioDescriptionOverrides = {
    music: { raw_orphan_audio: " \tAUDIO_DESC_QA_20260906\n\"quoted\"\n ", cleared: "", ["__proto__"]: "own-key" },
    sound: { raw_orphan_audio: "\uD83C\uDFB5".repeat(2000), whitespace: " \t\n " },
  };

  it.each([serialize, serializePretty])("preserves exact stored strings and orphan IDs when round-tripping with %s", (write) => {
    // Given
    const source = { ...project, audioDescriptions: authored };
    // When
    const result = deserialize(write(deserialize(write(source))));
    // Then
    expect(result.audioDescriptions).toEqual(authored);
    expect(Object.hasOwn(result.audioDescriptions?.music ?? {}, "missing")).toBe(false);
    expect(getAudioDescriptionOverride(result.audioDescriptions, resource)).toBe(authored.music?.[resource.resourceId]);
    expect(result.version).toBe(4);
  });

  it.each([{}, { music: {} }, { music: {}, sound: {} }])("preserves empty optional maps without backfill when loading %j", (audioDescriptions) => {
    // Given
    const source = { ...project, audioDescriptions };
    // When
    const result = deserialize(serialize(source));
    // Then
    expect(result.audioDescriptions).toEqual(audioDescriptions);
  });

  it.each(["", "  AUDIO_DESC_QA_20260906  "])("preserves a new written state when round-tripping %j", (input) => {
    // Given
    const source = { ...project, audioDescriptions: setAudioDescriptionOverride(undefined, resource, input) };
    // When
    const result = deserialize(serialize(deserialize(serialize(source))));
    // Then
    expect(result.audioDescriptions).toEqual({ music: { [resource.resourceId]: input.trim() } });
  });

  it("restores inherited state across serialization when resetting an explicit clear", () => {
    // Given
    const before = { music: { [resource.resourceId]: "" } };
    const overrides = resetAudioDescriptionOverride(before, resource);
    const source = { ...project, ...(overrides === undefined ? {} : { audioDescriptions: overrides }) };
    // When
    const result = deserialize(serialize(source));
    // Then
    expect(Object.hasOwn(result, "audioDescriptions")).toBe(false);
  });
});

describe("audio description recovery snapshots", () => {
  it.each([
    undefined,
    {
      music: { orphan: " \tBACKUP_VALUE\n ", cleared: "", ["__proto__"]: "OWN_ID" },
      sound: { orphan: "SOUND_VALUE", terrainTemplates: "" },
    },
  ])("preserves description states when restoring a backup into an editor package: %j", async (descriptions) => {
    // Given
    const source = createBlankProject();
    if (descriptions !== undefined) source.audioDescriptions = descriptions;
    const backup = createProjectBackup(source);
    source.audioDescriptions = { music: { replacement: "AFTER_BACKUP" } };
    // When
    const restored = restoreProjectBackup(backup);
    const packaged = await readProjectPackage(createProjectPackage(restored));
    // Then
    expect(restored.audioDescriptions).toEqual(descriptions);
    expect(packaged.audioDescriptions).toEqual(descriptions);
    expect(Object.hasOwn(packaged, "audioDescriptions")).toBe(descriptions !== undefined);
    expect(source.audioDescriptions).toEqual({ music: { replacement: "AFTER_BACKUP" } });
  }, 15_000);
});
