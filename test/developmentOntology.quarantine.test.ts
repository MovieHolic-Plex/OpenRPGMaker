/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";
import {
  DEVELOPMENT_ONTOLOGY,
  ONTOLOGY_CLASSIFICATION_EXAMPLES,
  checkDevelopmentOntology,
  classifyOntologyTask,
  evaluateOntologyClassification,
  generatedDevelopmentOntologyMarkdown,
  queryOntologyByCapability,
  queryOntologyByEntity,
  queryOntologyByFile,
  queryOntologyByTask,
} from "@/project/ontology";

const REPO_FILE_PATHS = new Set(
  Object.keys(import.meta.glob(["../src/**/*", "./**/*", "../docs/**/*", "../public/**/*"], { query: "?raw", import: "default" })).map(
    (path) => path.replace(/^\.\.\//, "").replace(/^\.\//, "test/")
  )
);

function ontologySurfacePaths(): readonly string[] {
  return DEVELOPMENT_ONTOLOGY.capabilities.flatMap((capability) => [
    ...capability.typeSurfaces,
    ...capability.uiSurfaces,
    ...capability.runtimeSurfaces,
    ...capability.storageSurfaces,
    ...capability.testSurfaces,
    ...capability.docsSurfaces,
  ]);
}

describe("development ontology", () => {
  it("returns the event authoring surfaces when adding an event command", () => {
    const result = queryOntologyByTask(DEVELOPMENT_ONTOLOGY, "add event command");

    expect(result.map((capability) => capability.id)).toContain("EventAuthoring");
    const eventAuthoring = result.find((capability) => capability.id === "EventAuthoring");
    if (!eventAuthoring) throw new Error("expected EventAuthoring capability");
    expect(eventAuthoring.entities).toEqual(expect.arrayContaining(["Command", "EventPage", "GameEvent"]));
    expect(eventAuthoring.typeSurfaces).toContain("src/project/types/events.ts");
    expect(eventAuthoring.uiSurfaces).toEqual(expect.arrayContaining(["src/editor/panels/eventEditor/commandPicker.ts"]));
    expect(eventAuthoring.runtimeSurfaces).toContain("src/player/interpreter.ts");
    expect(eventAuthoring.storageSurfaces).toEqual(expect.arrayContaining(["src/project/io/shapeCommandFields.ts"]));
    expect(eventAuthoring.testSurfaces).toEqual(expect.arrayContaining(["test/interpreter.test.ts"]));
  });

  it("finds tileset semantics by capability id and entity ownership", () => {
    const capability = queryOntologyByCapability(DEVELOPMENT_ONTOLOGY, "TilesetSemantics");
    const entity = queryOntologyByEntity(DEVELOPMENT_ONTOLOGY, "TileGroupMetadata");

    expect(capability?.entities).toEqual(expect.arrayContaining(["TilesetDef", "TileGroupMetadata"]));
    expect(capability?.contracts).toEqual(expect.arrayContaining(["tile-group-ids-in-range"]));
    expect(entity?.ownerCapabilityIds).toEqual(["TilesetSemantics"]);
    expect(entity?.typeFiles).toEqual(["src/project/types/base.ts"]);
  });

  it("records Supabase as the resource root and local files as cache/bootstrap", () => {
    const resourcePipeline = queryOntologyByCapability(DEVELOPMENT_ONTOLOGY, "ResourcePipeline");
    const projectPersistence = queryOntologyByCapability(DEVELOPMENT_ONTOLOGY, "ProjectPersistence");
    const uploadedAsset = queryOntologyByEntity(DEVELOPMENT_ONTOLOGY, "UploadedAsset");

    expect(resourcePipeline?.purpose).toContain("Supabase-root");
    expect(projectPersistence?.purpose).toContain("Supabase current_json");
    expect(resourcePipeline?.contracts).toEqual(expect.arrayContaining(["supabase-resource-root"]));
    expect(projectPersistence?.contracts).toEqual(expect.arrayContaining(["supabase-resource-root"]));
    expect(uploadedAsset?.description).toContain("Supabase current_json.assets.uploaded");
    expect(generatedDevelopmentOntologyMarkdown(DEVELOPMENT_ONTOLOGY)).toContain("supabase-resource-root");
  });

  it("maps changed files back to affected capabilities", () => {
    const capabilities = queryOntologyByFile(DEVELOPMENT_ONTOLOGY, "src/project/types/events.ts");

    expect(capabilities.map((capability) => capability.id)).toEqual(expect.arrayContaining(["EventAuthoring", "ProjectPersistence"]));
  });

  it("generates readable markdown from the ontology source", () => {
    const markdown = generatedDevelopmentOntologyMarkdown(DEVELOPMENT_ONTOLOGY);

    expect(markdown).toContain("# Editor Development Ontology");
    expect(markdown).toContain("## Capabilities");
    expect(markdown).toContain("### EventAuthoring");
    expect(markdown).toContain("src/project/types/events.ts");
    expect(markdown).toContain("## Contracts");
    expect(markdown).toContain("tile-group-ids-in-range");
    expect(markdown).toContain("## Classification Evaluation");
    expect(markdown).toContain("Accuracy:");
  });

  it("passes internal ontology consistency checks", () => {
    const issues = checkDevelopmentOntology(DEVELOPMENT_ONTOLOGY);

    expect(issues).toEqual([]);
  });

  it("references only existing implementation, test, and documentation surfaces", () => {
    const missing = ontologySurfacePaths().filter((surface) => !REPO_FILE_PATHS.has(surface));

    expect(missing).toEqual([]);
  });

  it("classifies Korean feature requests with word-level evidence", () => {
    const result = classifyOntologyTask(DEVELOPMENT_ONTOLOGY, "상점 이벤트 명령 추가");

    expect(result.topCapabilityId).toBe("EventAuthoring");
    expect(result.predictions[0]).toEqual(expect.objectContaining({
      capabilityId: "EventAuthoring",
      similarity: expect.any(Number),
    }));
    expect(result.predictions[0]?.wordMatches).toEqual(expect.arrayContaining([
      expect.objectContaining({ inputWord: "이벤트" }),
      expect.objectContaining({ inputWord: "명령" }),
    ]));
  });

  it("evaluates classification accuracy and sensitivity by capability", () => {
    const evaluation = evaluateOntologyClassification(DEVELOPMENT_ONTOLOGY, ONTOLOGY_CLASSIFICATION_EXAMPLES);

    expect(evaluation.accuracy).toBeGreaterThanOrEqual(0.9);
    expect(evaluation.macroSensitivity).toBeGreaterThanOrEqual(0.9);
    expect(evaluation.categories.EventAuthoring.sensitivity).toBe(1);
    expect(evaluation.categories.TilesetSemantics.sensitivity).toBe(1);
  });
});
