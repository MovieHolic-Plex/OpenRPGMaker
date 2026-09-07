import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import { createProjectPackage, readProjectPackage } from "@/project/package";
import { preparePublication, forkPublication, upgradePublication } from "@/project/publication";

const target = "a".repeat(64);
describe("explicit publication identity", () => {
  it("keeps legacy reads identity-free", () => {
    const project = deserialize(serialize(createBlankProject()));
    expect(project.meta.publication).toBeUndefined();
  });
  it("preserves identity through rename and package round-trip", async () => {
    const project = createBlankProject();
    project.meta.publication = preparePublication(target);
    project.meta.title = "renamed";
    const result = await readProjectPackage(createProjectPackage(project));
    expect(result.meta.publication).toEqual(project.meta.publication);
  });
  it("upgrades only the draft and starts an isolated lineage", () => {
    const original = preparePublication(target);
    const before = structuredClone(original);
    const upgraded = upgradePublication(original, "b".repeat(64));
    expect(upgraded.gameId).toBe(original.gameId);
    expect(upgraded.saveCompatibilityId).not.toBe(original.saveCompatibilityId);
    expect(upgraded.acceptedSaveCompatibilityIds).toEqual([]);
    expect(original).toEqual(before);
  });
  it("forks game and save identity", () => {
    const original = preparePublication(target);
    const fork = forkPublication(original);
    expect(fork.gameId).not.toBe(original.gameId);
    expect(fork.saveCompatibilityId).not.toBe(original.saveCompatibilityId);
  });
  it("rejects malformed identity instead of repairing it", () => {
    const raw = JSON.parse(serialize(createBlankProject()));
    raw.meta.publication = { gameId: "x" };
    expect(() => deserialize(JSON.stringify(raw))).toThrow();
  });
});
