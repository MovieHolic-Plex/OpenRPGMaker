import { describe, expect, it } from "vitest";
import { deserialize, serialize, serializePretty, ProjectFormatError } from "@/project/io";
import { createProjectPackage, readProjectPackage } from "@/project/package";
import { prepareWebExport } from "@/project/webExport";
import { collectUsedUploadedAssetIds } from "@/project/webExportAssets";
import { summarizeChanges } from "@/editor/tools/changeset";
import { combineDiffs } from "@/project/projectCommitLog";
import { searchResources } from "@/assets/resourceSearch";
import { listDatabaseResourceOptions } from "@/editor/panels/databaseResourcePickerDialog";
import { audioDescriptionProject } from "./helpers/audioDescriptionPersistenceTransport";

const metadata = { terrainTemplates: { name: " Stored name ", tags: [" exact ", " exact "], description: "\n stored \n" }, ["__proto__"]: { description: "" } };

describe("monster metadata foundation", () => {
  it.each([null, [], 3, { raw: null }, { raw: { name: " " } }, { raw: { name: "x".repeat(121) } },
    { raw: { tags: [3] } }, { raw: { tags: Array.from({ length: 33 }, () => "x") } },
    { raw: { tags: ["x".repeat(65)] } }, { raw: { description: "x".repeat(4001) } },
  ])("rejects malformed metadata when loading %j", (monsterMetadata) => {
    // Given
    const project = { ...audioDescriptionProject(undefined), monsterMetadata };
    // When / Then
    expect(() => deserialize(JSON.stringify(project))).toThrow(ProjectFormatError);
  });

  it.each([serialize, serializePretty])("preserves exact stored overrides and raw IDs when serializing with %s", (write) => {
    // Given
    const project = { ...audioDescriptionProject(undefined), monsterMetadata: metadata };
    // When
    const loaded = deserialize(write(project));
    // Then
    expect(Reflect.get(loaded, "monsterMetadata")).toEqual(metadata);
  });

  it("preserves overrides when round-tripping an editor package", async () => {
    // Given
    const project = { ...audioDescriptionProject(undefined), monsterMetadata: metadata };
    // When
    const loaded = await readProjectPackage(createProjectPackage(project));
    // Then
    expect(Reflect.get(loaded, "monsterMetadata")).toEqual(metadata);
  });

  it("strips metadata without retaining metadata-only uploads when preparing playable data", () => {
    // Given
    const project = { ...audioDescriptionProject(undefined), monsterMetadata: { orphan: { description: "unused_monster", tags: ["unused_monster"] } } };
    project.assets.uploaded.unused_monster = { id: "unused_monster", name: "Unused", kind: "monster", dataUrl: "data:image/png;base64,AA==", meta: {} };
    const before = structuredClone(project);
    // When
    const prepared = prepareWebExport(project);
    // Then
    expect(Object.hasOwn(prepared.project, "monsterMetadata")).toBe(false);
    expect(collectUsedUploadedAssetIds(project).has("unused_monster")).toBe(false);
    expect(Object.hasOwn(prepared.project.assets.uploaded, "unused_monster")).toBe(false);
    expect(project).toEqual(before);
  });

  it("counts metadata-only resource changes when creating and combining diffs", () => {
    // Given
    const before = { ...audioDescriptionProject(undefined), monsterMetadata: { a: { name: "A", tags: ["old"] }, b: { description: "" } } };
    const after = { ...before, monsterMetadata: { a: { name: "B", tags: [] }, c: { description: "C" } } };
    // When
    const diff = summarizeChanges(before, after);
    // Then
    expect(diff).toMatchObject({ monsterMetadataChanged: 3, systemChanged: false, tilesChanged: 0 });
    expect(combineDiffs([diff, diff])).toMatchObject({ monsterMetadataChanged: 6 });
  });

  it("uses effective monster metadata when searching and enumerating the picker", () => {
    // Given
    const project = { ...audioDescriptionProject(undefined), monsterMetadata: { "generated-enemy-slime-01": { name: "OVERRIDE_NAME", tags: ["OVERRIDE_TAG"], description: "OVERRIDE_DESC" } } };
    // When
    const found = searchResources("monster", "OVERRIDE_DESC", { monsterProject: project });
    const options = listDatabaseResourceOptions("monster", project);
    // Then
    expect(found.map(entry => entry.id)).toEqual(["generated-enemy-slime-01"]);
    expect(options.find(entry => entry.id === "generated-enemy-slime-01")).toMatchObject({ name: "OVERRIDE_NAME", searchTerms: ["OVERRIDE_TAG", "OVERRIDE_DESC"] });
  });

  it("excludes explicit picture uploads from monsters while retaining general image picking", () => {
    // Given
    const project = audioDescriptionProject(undefined);
    const id = "generated-enemy-slime-01";
    project.assets.uploaded[id] = { id, name: "Picture", kind: "picture", dataUrl: "data:image/png;base64,AA==", meta: {} };
    project.resourceProfiles.push({ kind: "monster", assetId: id, name: "Misleading profile" });
    // When
    const monsters = listDatabaseResourceOptions("monster", project);
    const images = listDatabaseResourceOptions("image", project);
    // Then
    expect(monsters.some(entry => entry.id === id)).toBe(false);
    expect(images.some(entry => entry.id === id)).toBe(true);
  });
});
