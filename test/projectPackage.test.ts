import { createBlankProject } from "@/project/defaults";
import {
  createProjectPackage,
  projectPackageFileName,
  readProjectPackage,
  readProjectPackageEntryNames,
} from "@/project/package";
import { describe, expect, it } from "vitest";

describe("project package", () => {
  it("exports an ai-readable .rpgzzu package and imports project.json back", async () => {
    const project = createBlankProject();
    project.meta.title = "Village Test";

    const file = createProjectPackage(project);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const names = await readProjectPackageEntryNames(file);
    const restored = await readProjectPackage(file);

    expect(projectPackageFileName(project)).toBe("Village-Test.rpgzzu");
    expect(Array.from(bytes.slice(0, 2)).map((byte) => String.fromCharCode(byte)).join("")).toBe("PK");
    expect(names).toContain("project.json");
    expect(names).toContain("data/database.json");
    expect(names).toContain("data/tilesets.json");
    expect(names).toContain("metadata/ai-tile-labels.json");
    expect(names).toContain(`maps/${project.startMapId}.json`);
    expect(restored).toEqual(project);
  });
});
