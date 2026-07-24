import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import {
  createProjectPackage,
  LEGACY_RPGZZU_EXTENSION,
  projectPackageFileName,
  readProjectPackage,
  readProjectPackageEntryNames,
  RPGZZU_EXTENSION,
} from "@/project/package";
import { describe, expect, it } from "vitest";

describe("project package", () => {
  it("writes the canonical .oprn package when a project is exported", async () => {
    // Given
    const project = createBlankProject();
    project.meta.title = "Village Test";

    // When
    const file = createProjectPackage(project);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const names = await readProjectPackageEntryNames(file);
    const restored = await readProjectPackage(file);

    // Then
    expect(RPGZZU_EXTENSION).toBe(".oprn");
    expect(projectPackageFileName(project)).toBe("Village-Test.oprn");
    expect(Array.from(bytes.slice(0, 2)).map((byte) => String.fromCharCode(byte)).join("")).toBe("PK");
    expect(names).toContain("project.json");
    expect(names).toContain("data/database.json");
    expect(names).toContain("data/tilesets.json");
    expect(names).toContain("metadata/ai-tile-labels.json");
    expect(names).toContain(`maps/${project.startMapId}.json`);
    expect(serialize(restored)).toBe(serialize(project));
  }, 15_000);

  it("reads a legacy .rpgzzu package when its bytes use the supported package format", async () => {
    // Given
    const project = createBlankProject();
    project.meta.title = "Legacy Village";
    const bytes = await createProjectPackage(project).arrayBuffer();
    const legacyFile = new File([bytes], `legacy${LEGACY_RPGZZU_EXTENSION}`);

    // When
    const restored = await readProjectPackage(legacyFile);

    // Then
    expect(LEGACY_RPGZZU_EXTENSION).toBe(".rpgzzu");
    expect(serialize(restored)).toBe(serialize(project));
  });

  it("reloads an editor-normalized package without changing boot-critical project data", async () => {
    // Given
    const project = createBlankProject();
    project.meta.title = "Normalization Contract";
    project.assets.uploaded.asset_contract = {
      id: "asset_contract",
      name: "Contract Asset",
      kind: "picture",
      dataUrl: "data:image/png;base64,AA==",
      meta: { width: 1, height: 1 },
    };
    const uploaded = createProjectPackage(project);

    // When
    const opened = await readProjectPackage(uploaded);
    const normalized = createProjectPackage(opened);
    const reloaded = await readProjectPackage(normalized);

    // Then
    expect(reloaded.meta.title).toBe(project.meta.title);
    expect(reloaded.startMapId).toBe(project.startMapId);
    expect(Object.keys(reloaded.maps)).toHaveLength(Object.keys(project.maps).length);
    expect(reloaded.assets.uploaded).toEqual(project.assets.uploaded);
  });
});
