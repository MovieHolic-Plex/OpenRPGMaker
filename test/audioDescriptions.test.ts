import { describe, expect, it } from "vitest";
import {
  getAudioDescriptionOverride,
  resetAudioDescriptionOverride,
  setAudioDescriptionOverride,
} from "@/project/audioDescriptions";
import { ProjectFormatError } from "@/project/io/errors";
import type { AudioDescriptionOverrides } from "@/project/types";

const music = { kind: "music", resourceId: "raw_audio_1" } as const;
const sound = { kind: "sound", resourceId: "raw_audio_1" } as const;

describe("audio description overrides", () => {
  it.each([undefined, {}, { music: {} }])("inherits when an own raw-ID key is absent in %j", (overrides) => {
    // Given / When
    const value = getAudioDescriptionOverride(overrides, music);
    // Then
    expect(value).toBeUndefined();
  });

  it.each(["", "AUDIO_DESC_QA_20260906"])("preserves the authored state when reading %j", (description) => {
    // Given
    const overrides = { music: { [music.resourceId]: description } };
    // When
    const value = getAudioDescriptionOverride(overrides, music);
    // Then
    expect(value).toBe(description);
  });

  it.each(["__proto__", "constructor", "toString"])("inherits when %s is only a prototype property", (resourceId) => {
    // Given
    const overrides = { music: {} };
    // When
    const value = getAudioDescriptionOverride(overrides, { kind: "music", resourceId });
    // Then
    expect(value).toBeUndefined();
  });

  it.each(["", " \n\t ", "  first\nsecond  "])("trims only outer whitespace when writing %j", (input) => {
    // Given
    const before = Object.freeze({});
    // When
    const result = setAudioDescriptionOverride(before, music, input);
    // Then
    expect(result).toEqual({ music: { [music.resourceId]: input.trim() } });
    expect(before).toEqual({});
  });

  it.each(["x".repeat(4000), "\uD83C\uDFB5".repeat(2000)])("accepts exactly 4000 UTF-16 units when writing a boundary string", (input) => {
    // Given / When
    const result = setAudioDescriptionOverride(undefined, music, ` ${input} `);
    // Then
    expect(getAudioDescriptionOverride(result, music)).toBe(input);
  });

  it.each([null, [], 7, false, {}, undefined, "x".repeat(4001), "\uD83C\uDFB5".repeat(2001)])("rejects invalid input without changing the source when writing case %#", (input) => {
    // Given
    const before = Object.freeze({ music: Object.freeze({ [music.resourceId]: "original" }) });
    // When / Then
    expect(() => setAudioDescriptionOverride(before, music, input)).toThrow(ProjectFormatError);
    expect(before.music[music.resourceId]).toBe("original");
  });

  it("isolates projects, IDs and kinds when writing a same-name resource", () => {
    // Given
    const resources = [
      { ...music, name: "same-name" },
      { ...music, resourceId: "raw_audio_2", name: "same-name" },
    ];
    const projectA: AudioDescriptionOverrides = Object.freeze({
      music: Object.freeze(Object.fromEntries(resources.map(resource => [resource.resourceId, "original"]))),
      sound: Object.freeze({ [sound.resourceId]: "sound-original" }),
    });
    const projectB = projectA;
    // When
    const result = setAudioDescriptionOverride(projectA, music, "changed");
    // Then
    expect(result).toEqual({ music: { raw_audio_1: "changed", raw_audio_2: "original" }, sound: { raw_audio_1: "sound-original" } });
    expect(projectB.music).toEqual({ raw_audio_1: "original", raw_audio_2: "original" });
  });

  it.each(["__proto__", "constructor", "toString"])("stores an own key when writing raw ID %s", (resourceId) => {
    // Given
    const resource = { kind: "music", resourceId } as const;
    // When
    const result = setAudioDescriptionOverride(undefined, resource, "authored");
    // Then
    expect(Object.hasOwn(result.music ?? {}, resourceId)).toBe(true);
    expect(getAudioDescriptionOverride(result, resource)).toBe("authored");
  });

  it("retains an explicit override when the written value equals the existing value", () => {
    // Given
    const before = { music: { [music.resourceId]: "unchanged" } };
    // When
    const result = setAudioDescriptionOverride(before, music, "unchanged");
    // Then
    expect(result).toEqual(before);
    expect(Object.hasOwn(result.music ?? {}, music.resourceId)).toBe(true);
  });

  it("preserves sibling IDs and kinds when resetting one override", () => {
    // Given
    const before = Object.freeze({
      music: Object.freeze({ [music.resourceId]: "", orphan: "  kept  " }),
      sound: Object.freeze({ [sound.resourceId]: "sound" }),
    });
    // When
    const result = resetAudioDescriptionOverride(before, music);
    // Then
    expect(result).toEqual({ music: { orphan: "  kept  " }, sound: { [sound.resourceId]: "sound" } });
    expect(before.music[music.resourceId]).toBe("");
  });

  it("removes the empty partition when resetting its last override", () => {
    // Given
    const before = { music: { [music.resourceId]: "" }, sound: { orphan: "kept" } };
    // When
    const result = resetAudioDescriptionOverride(before, music);
    // Then
    expect(result).toEqual({ sound: { orphan: "kept" } });
  });

  it("restores absence when resetting the last override", () => {
    // Given
    const before = { music: { [music.resourceId]: "" } };
    // When
    const result = resetAudioDescriptionOverride(before, music);
    // Then
    expect(result).toBeUndefined();
  });

  it.each([undefined, {}, { sound: { orphan: "kept" } }])("does not create data when resetting a missing key in %j", (before) => {
    // Given / When
    const result = resetAudioDescriptionOverride(before, music);
    // Then
    expect(result).toBe(before);
  });
});
