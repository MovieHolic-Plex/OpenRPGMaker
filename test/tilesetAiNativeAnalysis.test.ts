import { describe, expect, it } from "vitest";

import {
  analyzeTilesetKnowledge,
  tilesetKnowledgeFingerprint,
} from "@/editor/tilesetAiNativeAnalysis";
import { createBlankProject } from "@/project/defaults";
import type { TilesetDef } from "@/project/types";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openAiJobsRepository } from "../scripts/lib/aiJobs/repository.mjs";
import { jsonValue, parseProject } from "@/ai/jobs/checkpointState";

function firstTileset(): TilesetDef {
  const project = createBlankProject();
  const tileset = Object.values(project.tilesets)[0];
  if (!tileset) throw new Error("missing tileset fixture");
  return tileset;
}

describe("AI-native whole tileset analysis", () => {
  it("retains review identity after canonical job storage without hiding a tileset change", async () => {
    const seed = createBlankProject();
    const tilesetId = seed.maps[seed.startMapId].tilesetId;
    seed.tilesets[tilesetId].tileGroups = [{
      id: "review-group", name: "Group", tileIds: [4, 5], defaultLayer: "lower",
      role: "prop", description: "", placementRules: "", origin: "ai", source: "ai",
    }];
    const project = parseProject(jsonValue(seed));
    const before = tilesetKnowledgeFingerprint(project.tilesets[tilesetId]);
    const directory = await mkdtemp(join(tmpdir(), "tileset-review-identity-"));
    const repository = await openAiJobsRepository({ directory });
    try {
      const ref = await repository.putJson(jsonValue(project));
      const restored = parseProject(await repository.readJson(ref));
      expect(restored.tilesets[tilesetId]).toEqual(project.tilesets[tilesetId]);
      expect(tilesetKnowledgeFingerprint(restored.tilesets[tilesetId])).toBe(before);
    } finally {
      await repository.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it.each(["tile size", "tile order"])("changes review identity for a meaningful %s change", kind => {
    const before = firstTileset();
    before.tileGroups = [{
      id: "review-group", name: "Group", tileIds: [4, 5], defaultLayer: "lower",
      role: "prop", description: "", placementRules: "", origin: "ai", source: "ai",
    }];
    const changed = structuredClone(before);
    if (kind === "tile size") changed.tileSize += 1;
    else changed.tileGroups = [{ ...before.tileGroups[0], tileIds: [5, 4] }];
    expect(tilesetKnowledgeFingerprint(changed)).not.toBe(tilesetKnowledgeFingerprint(before));
  });

  it("sends the whole image and returns detached typed proposals", async () => {
    // Given
    const tileset = firstTileset();
    tileset.tileGroups = [];
    const before = JSON.stringify(tileset);
    const imageDataUrl = "data:image/png;base64,d2hvbGUtdGlsZXNldA==";
    let capturedPrompt = "";
    let capturedImage = "";

    // When
    const result = await analyzeTilesetKnowledge(tileset, {
      feedback: ["The upper row is tree canopy"],
      renderImage: async () => imageDataUrl,
      request: async (request) => {
        capturedPrompt = request.prompt;
        capturedImage = request.imageDataUrl;
        return JSON.stringify({
          proposals: [
            {
              cellLayers: ["upper", "upper", "lower", "lower"],
              confidence: 0.91,
              description: "Tree canopy and trunks",
              evidence: "A connected 2x2 object",
              name: "Forest tree",
              passage: { down: false, left: false, right: false, up: false },
              placementRules: "Place as one object",
              question: "Is the canopy on the upper layer?",
              quickReplies: ["Yes", "No"],
              template: "tree",
              tileIds: [0, 1, tileset.tilesPerRow, tileset.tilesPerRow + 1],
            },
          ],
          summary: "One semantic group",
        });
      },
    });

    // Then
    expect(result.kind).toBe("success");
    if (result.kind !== "success") throw new Error("analysis failed");
    expect(capturedImage).toBe(imageDataUrl);
    const prompt = JSON.parse(capturedPrompt);
    expect(prompt).toEqual(expect.objectContaining({
      humanFeedback: ["The upper row is tree canopy"],
      outputSchemaVersion: 1,
      task: "analyze_tileset_knowledge",
    }));
    expect(prompt.tileset).toEqual(expect.objectContaining({ count: tileset.count, tilesPerRow: tileset.tilesPerRow }));
    expect(result.review.proposals).toEqual([
      expect.objectContaining({
        confidence: 0.91,
        name: "Forest tree",
        question: "Is the canopy on the upper layer?",
        quickReplies: ["Yes", "No"],
        status: "pending",
        template: "tree",
      }),
    ]);
    expect(result.review.fingerprint).toBe(tilesetKnowledgeFingerprint(tileset));
    expect(JSON.stringify(tileset)).toBe(before);
  });

  it("preserves human knowledge and reports malformed proposals as partial", async () => {
    // Given
    const tileset = firstTileset();
    tileset.tileGroups = [{
      defaultLayer: "upper",
      description: "Human desk",
      id: "human-desk",
      name: "Human desk",
      origin: "user",
      placementRules: "Keep this",
      role: "prop",
      source: "user",
      tileIds: [0, 1],
    }];

    // When
    const result = await analyzeTilesetKnowledge(tileset, {
      renderImage: async () => "data:image/png;base64,dA==",
      request: async () => JSON.stringify({
        proposals: [
          { confidence: 0.96, name: "Overwrite", template: "desk", tileIds: [0, 1] },
          { confidence: 0.8, name: "Outside", template: "desk", tileIds: [tileset.count + 1] },
          { confidence: 0.79, name: "Partially outside", template: "desk", tileIds: [6, 7, tileset.count + 1] },
          { confidence: 0.78, name: "Duplicate", template: "desk", tileIds: [8, 8] },
          { cellLayers: ["upper", "lower"], confidence: 0.75, name: "Unsorted", template: "tree", tileIds: [10, 9] },
          { confidence: 0.72, name: "Valid", template: "desk", tileIds: [4, 5] },
        ],
        summary: "Mixed response",
      }),
    });

    // Then
    expect(result.kind).toBe("success");
    if (result.kind !== "success") throw new Error("analysis failed");
    expect(result.review.proposals.map((proposal) => proposal.name)).toEqual(["Valid"]);
    expect(result.review.warnings).toHaveLength(5);
  });
});
