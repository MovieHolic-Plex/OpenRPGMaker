import { describe, expect, it } from "vitest";
import { applyMonsterMetadataDelta, resetMonsterMetadataOverride, setMonsterMetadataOverride } from "@/project/monsterMetadata";
import { ProjectFormatError } from "@/project/io";
import type { MonsterMetadataOverrides } from "@/project/types";

const scenarios: readonly { readonly name: string; readonly base?: MonsterMetadataOverrides; readonly local?: MonsterMetadataOverrides; readonly latest?: MonsterMetadataOverrides; readonly expected?: MonsterMetadataOverrides }[] = [
  { name: "different fields", base: { raw: { name: "B", tags: ["B"] } }, local: { raw: { name: "L", tags: ["B"] } }, latest: { raw: { name: "B", tags: ["R"], description: "R" } }, expected: { raw: { name: "L", tags: ["R"], description: "R" } } },
  { name: "same-field local wins", base: { raw: { description: "B" } }, local: { raw: { description: "L" } }, latest: { raw: { description: "R" } }, expected: { raw: { description: "L" } } },
  { name: "explicit clears", base: { raw: { description: "B", tags: ["B"] } }, local: { raw: { description: "", tags: [] } }, latest: { raw: { description: "R", tags: ["R"] } }, expected: { raw: { description: "", tags: [] } } },
  { name: "local reset preserves remote-only fields", base: { raw: { name: "B" } }, latest: { raw: { name: "R", tags: ["R"] } }, expected: { raw: { tags: ["R"] } } },
  { name: "last field reset prunes containers", base: { raw: { name: "B" } }, latest: { raw: { name: "R" } } },
  { name: "remote reset", base: { raw: { name: "B" } }, local: { raw: { name: "B" } } },
  { name: "remote addition", latest: { remote: { description: "R" } }, expected: { remote: { description: "R" } } },
  { name: "different resources", local: { local: { name: "L" } }, latest: { remote: { name: "R" } }, expected: { local: { name: "L" }, remote: { name: "R" } } },
  { name: "own raw IDs and stored whitespace", local: { ["__proto__"]: { description: " \nL " } }, latest: { constructor: { name: "R" } }, expected: { ["__proto__"]: { description: " \nL " }, constructor: { name: "R" } } },
];

describe("monster metadata writes", () => {
  it("trims and deduplicates new fields when patching one resource", () => {
    // Given
    const before = { raw: { name: "Original", description: " unchanged " }, orphan: { tags: ["legacy"] } };
    const snapshot = structuredClone(before);
    // When
    const result = setMonsterMetadataOverride(before, "raw", { name: " New ", tags: [" bat ", "bat", " ", "wing"], description: " \nnew\ntext \n" });
    // Then
    expect(result).toEqual({ raw: { name: "New", tags: ["bat", "wing"], description: "new\ntext" }, orphan: { tags: ["legacy"] } });
    expect(before).toEqual(snapshot);
  });

  it("preserves sibling fields and raw key identity when writing a partial patch", () => {
    // Given
    const before = { ["__proto__"]: { name: "Original", tags: ["old"] } };
    // When
    const result = setMonsterMetadataOverride(before, "__proto__", { description: "" });
    // Then
    expect(result).toEqual({ ["__proto__"]: { name: "Original", tags: ["old"], description: "" } });
    expect(Object.hasOwn(result, "__proto__")).toBe(true);
  });

  it.each([{ name: " " }, { name: "x".repeat(121) }, { description: "x".repeat(4001) }, { tags: ["x".repeat(65)] }, { tags: Array.from({ length: 33 }, (_, index) => String(index)) }, { tags: [7] }])("rejects invalid new fields when patch is %j", (patch) => {
    // Given / When / Then
    expect(() => setMonsterMetadataOverride(undefined, "raw", patch)).toThrow(ProjectFormatError);
  });

  it("prunes the final override when resetting a resource", () => {
    // Given
    const before = { raw: { description: "" } };
    // When
    const result = resetMonsterMetadataOverride(before, "raw");
    // Then
    expect(result).toBeUndefined();
    expect(before).toEqual({ raw: { description: "" } });
  });

  it("ignores inherited keys when resetting an unknown resource", () => {
    // Given
    const before = { other: { name: "Other" } };
    // When
    const result = resetMonsterMetadataOverride(before, "constructor");
    // Then
    expect(result).toBe(before);
  });
});

describe("monster metadata three-way delta", () => {
  it.each(scenarios)("merges per-field state when $name", ({ base, local, latest, expected }) => {
    // Given
    const snapshot = structuredClone({ base, local, latest });
    // When
    const result = applyMonsterMetadataDelta(base, local, latest);
    // Then
    expect(result).toEqual(expected);
    expect({ base, local, latest }).toEqual(snapshot);
  });
});
