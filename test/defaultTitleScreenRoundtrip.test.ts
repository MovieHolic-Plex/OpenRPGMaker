import { describe, expect, it } from "vitest";
import { defaultSystem } from "@/project/defaults/defaultDatabase";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";

describe("default title screen wire contract", () => {
  it("keeps the emitted settings byte-identical when normalized for loading", () => {
    // Given: a fresh system carries the factory's title screen settings.
    const system = defaultSystem();
    const original = JSON.stringify(system.titleScreen);

    // When: loading applies the real system normalizer.
    const restored = normalizeSystemRecords(system);

    // Then: the factory already emits the canonical title screen representation.
    expect(JSON.stringify(restored.titleScreen)).toBe(original);
  });
});
