import { describe, expect, it } from "vitest";
import { allTools, getTool, toOpenAiTools } from "@/editor/tools/toolRegistry";
import { generateToolCatalogMarkdown } from "@/editor/tools/toolCatalog";
import { runTool } from "@/editor/tools/toolRunner";
import { listHeadlessMcpTools, runHeadlessTool } from "@/headless";
import { audioDescriptionToolProject, MUSIC_ID } from "./support/audioDescriptionToolProject";

describe("audio description tool exposure", () => {
  it.each([
    ["get_audio_resource", "read"],
    ["set_audio_description", "write"],
  ] as const)("exposes %s through registry, schema, catalog, and discovery", (name, mode) => {
    // Given
    const project = audioDescriptionToolProject();
    // When
    const discovery = runTool({ project }, "find_tools", { query: name, domain: "system" });
    // Then
    expect(getTool(name)?.mode).toBe(mode);
    expect(allTools().some(tool => tool.name === name)).toBe(true);
    expect(toOpenAiTools().find(tool => tool.function.name === name)?.function.parameters.required)
      .toEqual(expect.arrayContaining(["kind", "resourceId"]));
    expect(toOpenAiTools(undefined, { mode: "system" }).some(tool => tool.function.name === name)).toBe(true);
    expect(listHeadlessMcpTools().some(tool => tool.name === name)).toBe(true);
    expect(generateToolCatalogMarkdown()).toContain(`\`${name}\``);
    expect(discovery.data).toMatchObject({ matches: expect.arrayContaining([expect.objectContaining({ name, mode })]) });
  });

  it("reports a headless description-only preview without modifying the supplied project", () => {
    // Given
    const project = audioDescriptionToolProject();
    const before = structuredClone(project);
    // When
    const result = runHeadlessTool(project, "set_audio_description", {
      kind: "music", resourceId: MUSIC_ID, action: "set", description: "headless sentinel",
    });
    // Then
    expect(result.ok, result.summary).toBe(true);
    expect(result.diff).toMatchObject({ audioDescriptionsChanged: 1 });
    expect(project).toEqual(before);
  });

  it("exposes the nested upsert description schema", () => {
    // Given
    const tools = toOpenAiTools();
    // When
    const resourceSchema = tools.find(tool => tool.function.name === "upsert_resource")
      ?.function.parameters.properties?.resource;
    // Then
    expect(resourceSchema?.properties?.description).toMatchObject({ type: "string" });
    expect(resourceSchema?.required).not.toContain("description");
  });
});
