import { describe, expect, it } from "vitest";
import { normalizeSystemRecords } from "@/project/databaseRecordModel";
import { deserialize, serialize } from "@/project/io";
import { resolvePlayerBody } from "@/project/playerFootprint";
import { startSession } from "@/project/session";
import { createLegacyLifeProject } from "./fixtures/life-full/legacyProject";

describe("player body Project persistence", () => {
  it("keeps legacy absent fields absent and Project4 bytes stable", () => {
    const project = createLegacyLifeProject();
    const raw = serialize(project);
    const loaded = deserialize(raw);
    expect(loaded.version).toBe(4);
    expect(serialize(loaded)).toBe(raw);
    expect(Object.hasOwn(loaded.system, "playerFootprint")).toBe(false);
    expect(Object.hasOwn(loaded.system, "playerPassRows")).toBe(false);
    expect(resolvePlayerBody(loaded, startSession(loaded, 52))).toEqual({
      footprint: { width: 1, height: 1 }, passRows: 1,
    });
    expect(normalizeSystemRecords(loaded.system)).toEqual(loaded.system);
    expect(serialize(deserialize(serialize(loaded)))).toBe(raw);
  });
});
