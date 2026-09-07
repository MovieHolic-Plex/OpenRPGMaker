import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { AssistantSession } from "@/ai/assistantSession";
import { renderToolImages, type RenderedToolImage } from "@/ai/toolImageRenderer";
import { requiresVisualReview } from "@/ai/mapVisualEvidence";
import {
  awaitGraftedTilesetImageUrl,
  clearTileGraftImageCache,
  peekGraftedTilesetImageUrl,
} from "@/assets/tileGraftImageCache";
import { clearTilesetImageCache } from "@/ai/toolImageCanvas";
import { tilesetBaseImageUrl } from "@/editor/tilesetImage";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import type { GameMap, Project, TilesetDef } from "@/project/types";
import { fixedDeclarer } from "./intentFixture";
import { independentReviewPayload, approvedReviewResponse } from "./independentReviewFixture";
import {
  installToolImageRasterDom,
  installToolImageUrlHoldGate,
  installToolImageUrlLoadFailure,
} from "./toolImageRasterDom";

const EVIDENCE_DIR = path.resolve(".omo/evidence/graft-proof");
/** Interior chipset is a valid set_tile_grafts source and a distinct atlas from the default town sheet. */
const GRAFT_SOURCE = "tex_easyrpg_chipset_interior";
const GRAFT_SOURCE_PATH_SNIP = "easyrpg-chipset-interior";

afterEach(() => {
  vi.unstubAllGlobals();
  clearTileGraftImageCache();
  clearTilesetImageCache();
});

function pngHash(dataUrl: string): string {
  const parts = dataUrl.split(",");
  const payload = parts[1];
  if (!payload) throw new Error("expected base64 png data url");
  return createHash("sha256").update(Buffer.from(payload, "base64")).digest("hex");
}

function writeJson(name: string, value: unknown): void {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE_DIR, name), `${JSON.stringify(value, null, 2)}\n`);
}

function requireStartMap(project: Project): GameMap {
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("start map missing");
  return map;
}

function requireTileset(project: Project, tilesetId: string): TilesetDef {
  const tileset = project.tilesets[tilesetId];
  if (!tileset) throw new Error(`tileset missing: ${tilesetId}`);
  return tileset;
}

function requireRendered(images: readonly RenderedToolImage[]): RenderedToolImage {
  const image = images[0];
  if (!image) throw new Error("expected rendered image");
  return image;
}

function seedBlankRegion(project: Project): {
  readonly map: GameMap;
  readonly tileset: TilesetDef;
  readonly region: { readonly mapId: string; readonly x: number; readonly y: number; readonly w: number; readonly h: number };
} {
  const map = requireStartMap(project);
  map.width = 4;
  map.height = 4;
  map.lowerTiles = Array(16).fill(0);
  map.upperTiles = Array(16).fill(-1);
  map.events = [];
  const tileset = requireTileset(project, map.tilesetId);
  return { map, tileset, region: { mapId: map.id, x: 0, y: 0, w: 4, h: 4 } };
}

function regionPayload(map: GameMap): {
  readonly mapId: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly lower: number[];
  readonly upper: number[];
} {
  return { mapId: map.id, x: 0, y: 0, w: 4, h: 4, lower: map.lowerTiles, upper: map.upperTiles };
}

function applyInteriorGraft(tileset: TilesetDef): void {
  tileset.tileGrafts = [{ targetTile: 0, sourceChipset: GRAFT_SOURCE, sourceTile: 100 }];
}

async function waitForExactGraftBake(tileset: TilesetDef): Promise<string> {
  const baseUrl = tilesetBaseImageUrl(tileset);
  const cached = peekGraftedTilesetImageUrl(tileset, baseUrl);
  if (cached) return cached;
  const baked = await awaitGraftedTilesetImageUrl(tileset, baseUrl);
  if (!baked) throw new Error("expected complete graft bake");
  return baked;
}

function toolCall(name: string, args: object, id: string): ChatResult {
  return {
    message: {
      role: "assistant",
      content: null,
      tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
    },
    finishReason: "tool_calls",
  };
}

function nonDataLoads(loads: readonly string[]): string[] {
  return loads.filter((url) => !url.startsWith("data:"));
}

describe("tool image graft atlas readiness", () => {
  it("fails closed while a graft source is held, then yields a changed PNG after release", async () => {
    const restore = installToolImageRasterDom();
    try {
      const project = createBlankProject();
      const { map, tileset } = seedBlankRegion(project);
      const region = regionPayload(map);

      const before = await renderToolImages(project, "show_map_region", region);
      expect(before).toHaveLength(1);
      const beforeHash = pngHash(requireRendered(before).dataUrl);

      applyInteriorGraft(tileset);
      expect(requiresVisualReview(createBlankProject(), project, map.id)).toBe(true);

      const gate = installToolImageUrlHoldGate(GRAFT_SOURCE_PATH_SNIP);
      await expect(renderToolImages(project, "show_map_region", region))
        .rejects.toThrow(/tileset-graft-rendering-unavailable/);
      expect(gate.isHolding()).toBe(true);

      gate.release();
      await waitForExactGraftBake(tileset);
      const after = await renderToolImages(project, "show_map_region", region);
      expect(after).toHaveLength(1);
      const afterHash = pngHash(requireRendered(after).dataUrl);
      writeJson("held-release-renderer.json", {
        case: "held-fail-closed-then-release",
        beforeHash,
        afterHash,
        samePng: beforeHash === afterHash,
        loads: nonDataLoads(gate.loads),
        dependencyHeld: true,
      });
      expect(afterHash).not.toBe(beforeHash);
    } finally {
      restore();
    }
  });

  it("fails closed for a missing graft source and never certifies the base atlas", async () => {
    const restore = installToolImageRasterDom();
    try {
      const project = createBlankProject();
      const { map, tileset } = seedBlankRegion(project);
      const region = regionPayload(map);
      const before = await renderToolImages(project, "show_map_region", region);
      expect(before).toHaveLength(1);

      tileset.tileGrafts = [{
        targetTile: 0,
        sourceChipset: "tex_not_a_real_chipset_for_graft",
        sourceTile: 1,
      }];

      await expect(renderToolImages(project, "show_map_region", region))
        .rejects.toThrow(/tileset-graft-rendering-unavailable/);
      writeJson("missing-source-renderer.json", {
        case: "missing-source",
        grafts: tileset.tileGrafts,
        beforeHash: pngHash(requireRendered(before).dataUrl),
      });
    } finally {
      restore();
    }
  });

  it("does not reuse a ready graft bake after atlas geometry changes", async () => {
    const restore = installToolImageRasterDom();
    try {
      const project = createBlankProject();
      const { map, tileset } = seedBlankRegion(project);
      const region = regionPayload(map);
      applyInteriorGraft(tileset);
      await waitForExactGraftBake(tileset);
      const first = await renderToolImages(project, "show_map_region", region);
      expect(first).toHaveLength(1);
      const firstHash = pngHash(requireRendered(first).dataUrl);
      const firstReady = peekGraftedTilesetImageUrl(tileset, tilesetBaseImageUrl(tileset));
      expect(firstReady).not.toBeNull();

      tileset.tilesPerRow += 1;
      expect(peekGraftedTilesetImageUrl(tileset, tilesetBaseImageUrl(tileset))).toBeNull();
      await expect(renderToolImages(project, "show_map_region", region))
        .rejects.toThrow(/tileset-graft-rendering-unavailable/);

      await waitForExactGraftBake(tileset);
      const secondReady = peekGraftedTilesetImageUrl(tileset, tilesetBaseImageUrl(tileset));
      const second = await renderToolImages(project, "show_map_region", region);
      expect(second).toHaveLength(1);
      writeJson("geometry-cache-bind.json", {
        case: "geometry-change-invalidates-ready-bake",
        firstHash,
        firstReadyUrlPrefix: typeof firstReady === "string" ? firstReady.slice(0, 32) : null,
        secondReadyUrlPrefix: typeof secondReady === "string" ? secondReady.slice(0, 32) : null,
        urlsDiffer: firstReady !== secondReady,
        tilesPerRow: tileset.tilesPerRow,
      });
      expect(secondReady).not.toBeNull();
      expect(secondReady).not.toBe(firstReady);
    } finally {
      restore();
    }
  });

  it("withholds session approval while pending, then admits a changed PNG after a ready bake", async () => {
    const restore = installToolImageRasterDom();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
    try {
      const project = createBlankProject();
      const { map, tileset, region } = seedBlankRegion(project);
      const before = await renderToolImages(project, "show_map_region", regionPayload(map));
      const beforeHash = pngHash(requireRendered(before).dataUrl);

      const gate = installToolImageUrlHoldGate(GRAFT_SOURCE_PATH_SNIP);
      const pendingReviews: Array<{ imageCount: number }> = [];
      let pendingRound = 0;
      const pendingSession = new AssistantSession(project, {
        config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 8 },
        declareIntent: fixedDeclarer({
          mode: "modify",
          targetMapId: null,
          tools: ["set_tile_grafts", "show_map_region"],
        }),
        renderImages: async (draft, name, data) => renderToolImages(draft, name, data),
        chat: async (_config, request): Promise<ChatResult> => {
          const input = independentReviewPayload(request);
          if (input) {
            const images = request.messages
              .flatMap((message) => (Array.isArray(message.content) ? message.content : []))
              .filter((part) => part.type === "image_url");
            pendingReviews.push({ imageCount: images.length });
            const approved = approvedReviewResponse(request);
            if (!approved) throw new Error("expected approvedReviewResponse");
            return approved;
          }
          pendingRound += 1;
          if (pendingRound === 1) {
            return toolCall("set_tile_grafts", {
              tilesetId: tileset.id,
              grafts: [{ targetTile: 0, sourceChipset: GRAFT_SOURCE, sourceTile: 100 }],
              reason: "replace visible tile zero",
            }, "graft");
          }
          if (pendingRound === 2) {
            return toolCall("show_map_region", { ...region, reason: "review while pending" }, "show-pending");
          }
          return { message: { role: "assistant", content: "Done pending attempt" }, finishReason: "stop" };
        },
      });

      const pendingResult = await pendingSession.sendUserMessage("Graft and inspect while source is held");
      expect(gate.isHolding()).toBe(true);
      expect(pendingSession.isDraftReviewApproved()).toBe(false);
      expect(pendingResult.review?.status).not.toBe("approved");
      expect(pendingReviews.every((entry) => entry.imageCount === 0)).toBe(true);

      gate.release();
      const draftTileset = pendingSession.getProposedProject().tilesets[tileset.id];
      if (!draftTileset) throw new Error("draft tileset missing");
      await waitForExactGraftBake(draftTileset);

      const readyProject = structuredClone(pendingSession.getProposedProject());
      const readyReviews: Array<{ imageCount: number }> = [];
      let readyHash: string | null = null;
      let readyRound = 0;
      const readySession = new AssistantSession(readyProject, {
        config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 8 },
        declareIntent: fixedDeclarer({
          mode: "modify",
          targetMapId: null,
          tools: ["set_tile_grafts", "show_map_region"],
        }),
        renderImages: async (draft, name, data) => {
          const images = await renderToolImages(draft, name, data);
          const image = images[0];
          readyHash = image ? pngHash(image.dataUrl) : null;
          return images;
        },
        chat: async (_config, request): Promise<ChatResult> => {
          const input = independentReviewPayload(request);
          if (input) {
            const images = request.messages
              .flatMap((message) => (Array.isArray(message.content) ? message.content : []))
              .filter((part) => part.type === "image_url");
            readyReviews.push({ imageCount: images.length });
            const approved = approvedReviewResponse(request);
            if (!approved) throw new Error("expected approvedReviewResponse");
            return approved;
          }
          readyRound += 1;
          if (readyRound === 1) {
            return toolCall("set_tile_grafts", {
              tilesetId: tileset.id,
              grafts: [{ targetTile: 0, sourceChipset: GRAFT_SOURCE, sourceTile: 100 }],
              reason: "confirm graft still present for review",
            }, "graft-ready");
          }
          if (readyRound === 2) {
            return toolCall("show_map_region", { ...region, reason: "review after exact bake" }, "show-ready");
          }
          return { message: { role: "assistant", content: "Done ready proof" }, finishReason: "stop" };
        },
      });

      const readyResult = await readySession.sendUserMessage("Confirm graft and show the ready atlas");
      writeJson("session-held-release.json", {
        case: "session-pending-then-ready-bake",
        beforeHash,
        readyHash,
        samePng: readyHash === beforeHash,
        pendingReviews,
        readyReviews,
        pendingAuthority: pendingSession.isDraftReviewApproved(),
        readyAuthority: readySession.isDraftReviewApproved(),
        pendingReview: pendingResult.review,
        readyReview: readyResult.review,
        loads: nonDataLoads(gate.loads),
        grafts: draftTileset.tileGrafts ?? null,
      });
      writeJson("session-held-release-png-meta.json", {
        beforeHash,
        afterHash: readyHash,
        changed: readyHash !== beforeHash,
      });

      expect(readyHash).not.toBeNull();
      expect(readyHash).not.toBe(beforeHash);
      expect(readyReviews.some((entry) => entry.imageCount >= 1)).toBe(true);
      expect(readyResult.review?.status).toBe("approved");
      expect(readySession.isDraftReviewApproved()).toBe(true);
      expect(pendingSession.isDraftReviewApproved()).toBe(false);
    } finally {
      restore();
    }
  });

  it("aborts a held-graft turn without receipt or authority; later bake cannot revive it", async () => {
    const restore = installToolImageRasterDom();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
    try {
      const project = createBlankProject();
      const { tileset, region } = seedBlankRegion(project);
      const gate = installToolImageUrlHoldGate(GRAFT_SOURCE_PATH_SNIP);
      const controller = new AbortController();
      let round = 0;
      let renderedCount = 0;

      const session = new AssistantSession(project, {
        config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 8 },
        declareIntent: fixedDeclarer({
          mode: "modify",
          targetMapId: null,
          tools: ["set_tile_grafts", "show_map_region"],
        }),
        renderImages: async (draft, name, data) => {
          try {
            const images = await renderToolImages(draft, name, data);
            renderedCount += images.length;
            return images;
          } catch {
            return [];
          }
        },
        chat: async (_config, request): Promise<ChatResult> => {
          const input = independentReviewPayload(request);
          if (input) {
            const approved = approvedReviewResponse(request);
            if (!approved) throw new Error("expected approvedReviewResponse");
            return approved;
          }
          round += 1;
          if (round === 1) {
            return toolCall("set_tile_grafts", {
              tilesetId: tileset.id,
              grafts: [{ targetTile: 0, sourceChipset: GRAFT_SOURCE, sourceTile: 100 }],
              reason: "graft then abort",
            }, "graft");
          }
          if (round === 2) {
            return toolCall("show_map_region", { ...region, reason: "attempt proof while held" }, "show");
          }
          return { message: { role: "assistant", content: "Done" }, finishReason: "stop" };
        },
      });

      const result = await session.sendUserMessage(
        "Graft and inspect, then cancel",
        (event) => {
          if (event.type === "tool_call" && event.name === "show_map_region") {
            void gate.sourceHeld.then(() => {
              if (!controller.signal.aborted) controller.abort();
            });
          }
        },
        controller.signal,
      );

      expect(gate.isHolding()).toBe(true);
      expect(result.stoppedReason).toBe("aborted");
      expect(session.isDraftReviewApproved()).toBe(false);
      expect(renderedCount).toBe(0);

      gate.release();
      const draftTileset = session.getProposedProject().tilesets[tileset.id];
      if (!draftTileset) throw new Error("draft tileset missing");
      await waitForExactGraftBake(draftTileset);
      expect(session.isDraftReviewApproved()).toBe(false);

      writeJson("session-held-abort.json", {
        case: "session-held-abort-no-revive",
        stoppedReason: result.stoppedReason,
        authority: session.isDraftReviewApproved(),
        renderedCount,
        heldThroughAbort: true,
        bakeCompletedAfterAbort: peekGraftedTilesetImageUrl(draftTileset, tilesetBaseImageUrl(draftTileset)) !== null,
        grafts: draftTileset.tileGrafts ?? null,
      });
    } finally {
      restore();
    }
  });

  it("keeps failed graft source loads unapproved in the public session reviewer", async () => {
    const restore = installToolImageRasterDom();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
    try {
      const project = createBlankProject();
      const { tileset, region } = seedBlankRegion(project);
      const failure = installToolImageUrlLoadFailure(GRAFT_SOURCE_PATH_SNIP);
      let round = 0;
      const reviews: Array<{ imageCount: number }> = [];
      const session = new AssistantSession(project, {
        config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 8 },
        declareIntent: fixedDeclarer({
          mode: "modify",
          targetMapId: null,
          tools: ["set_tile_grafts", "show_map_region"],
        }),
        renderImages: async (draft, name, data) => renderToolImages(draft, name, data),
        chat: async (_config, request): Promise<ChatResult> => {
          const input = independentReviewPayload(request);
          if (input) {
            const images = request.messages
              .flatMap((message) => (Array.isArray(message.content) ? message.content : []))
              .filter((part) => part.type === "image_url");
            reviews.push({ imageCount: images.length });
            const approved = approvedReviewResponse(request);
            if (!approved) throw new Error("expected approvedReviewResponse");
            return approved;
          }
          round += 1;
          if (round === 1) {
            return toolCall("set_tile_grafts", {
              tilesetId: tileset.id,
              grafts: [{ targetTile: 0, sourceChipset: GRAFT_SOURCE, sourceTile: 100 }],
              reason: "broken source bytes",
            }, "graft");
          }
          if (round === 2) {
            return toolCall("show_map_region", { ...region, reason: "attempt proof" }, "show");
          }
          return { message: { role: "assistant", content: "Done" }, finishReason: "stop" };
        },
      });

      const result = await session.sendUserMessage("Graft from a failing chipset load and inspect");
      // Let the scheduled failing bake settle so the next peek stays empty.
      await awaitGraftedTilesetImageUrl(
        requireTileset(session.getProposedProject(), tileset.id),
        tilesetBaseImageUrl(requireTileset(session.getProposedProject(), tileset.id)),
      );
      const observation = {
        case: "session-failed-source-load",
        reviews,
        review: result.review,
        authority: session.isDraftReviewApproved(),
        grafts: session.getProposedProject().tilesets[tileset.id]?.tileGrafts ?? null,
        loads: nonDataLoads(failure.loads),
      };
      writeJson("session-failed-source.json", observation);
      expect(observation.grafts).toHaveLength(1);
      expect(session.isDraftReviewApproved()).toBe(false);
      expect(result.review?.status).not.toBe("approved");
    } finally {
      restore();
    }
  });
});
