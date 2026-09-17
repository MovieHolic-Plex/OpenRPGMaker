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
        .resolves.toHaveLength(1);

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
      // Fresh ungrafted baseline Session: real write must produce the changed PNG itself.
      // Do not seed the ready Session from an already-grafted project clone.
      const readyProject = createBlankProject();
      const readySeed = seedBlankRegion(readyProject);
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
              tilesetId: readySeed.tileset.id,
              grafts: [{ targetTile: 0, sourceChipset: GRAFT_SOURCE, sourceTile: 100 }],
              reason: "write graft from ungrafted baseline",
            }, "graft-ready");
          }
          if (readyRound === 2) {
            // Allow the exact bake scheduled by the write path to finish before show.
            const draftTileset = readySession.getProposedProject().tilesets[readySeed.tileset.id];
            if (!draftTileset) throw new Error("ready draft tileset missing");
            await waitForExactGraftBake(draftTileset);
            return toolCall("show_map_region", { ...readySeed.region, reason: "review after exact bake" }, "show-ready");
          }
          return { message: { role: "assistant", content: "Done ready proof" }, finishReason: "stop" };
        },
      });

      const readyResult = await readySession.sendUserMessage("Write graft from baseline and show the ready atlas");
      const draftTileset = readySession.getProposedProject().tilesets[readySeed.tileset.id];
      if (!draftTileset) throw new Error("draft tileset missing");
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
          // Production Session error handling must see the raw renderer failure.
          const images = await renderToolImages(draft, name, data);
          renderedCount += images.length;
          return images;
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

  it("does not certify a warmed colliding graft bake for a different real Session write", async () => {
    const restore = installToolImageRasterDom();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
    try {
      const project = createBlankProject();
      const { map, tileset, region } = seedBlankRegion(project);
      const grafts = (tiles: number[]) =>
        tiles.map((sourceTile, targetTile) => ({
          targetTile,
          sourceChipset: GRAFT_SOURCE,
          sourceTile,
        }));
      // Deterministic interior tuples that collide under the old 32-bit texture suffix hash.
      const firstGrafts = grafts([65, 309, 431]);
      const secondGrafts = grafts([387, 227, 361]);

      tileset.tileGrafts = firstGrafts;
      await waitForExactGraftBake(tileset);
      const warmedA = await renderToolImages(project, "show_map_region", regionPayload(map));
      const warmedAHash = pngHash(requireRendered(warmedA).dataUrl);
      // Keep warmed A in the ready cache across the Session write — do not clear.

      const writeProject = createBlankProject();
      const writeSeed = seedBlankRegion(writeProject);
      let certifiedHash: string | null = null;
      let renderRejected = false;
      let round = 0;
      const reviews: Array<{ revision: number; imageCount: number }> = [];
      const session = new AssistantSession(writeProject, {
        config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 8 },
        declareIntent: fixedDeclarer({
          mode: "modify",
          targetMapId: null,
          tools: ["set_tile_grafts", "show_map_region"],
        }),
        renderImages: async (draft, name, data) => {
          try {
            const images = await renderToolImages(draft, name, data);
            certifiedHash = pngHash(requireRendered(images).dataUrl);
            return images;
          } catch (error) {
            renderRejected = true;
            throw error;
          }
        },
        chat: async (_config, request): Promise<ChatResult> => {
          const input = independentReviewPayload(request);
          if (input) {
            const imageCount = request.messages
              .flatMap((message) => (Array.isArray(message.content) ? message.content : []))
              .filter((part) => part.type === "image_url").length;
            reviews.push({ revision: input.revision, imageCount });
            return approvedReviewResponse(request)!;
          }
          round += 1;
          if (round === 1) {
            return toolCall("set_tile_grafts", {
              tilesetId: writeSeed.tileset.id,
              grafts: secondGrafts,
              reason: "replace three visible grafts",
            }, "collision-write");
          }
          if (round === 2) {
            return toolCall("show_map_region", {
              ...writeSeed.region,
              reason: "review changed grafts",
            }, "collision-show");
          }
          return { message: { role: "assistant", content: "Done" }, finishReason: "stop" };
        },
      });

      const result = await session.sendUserMessage("Replace these grafts and review the actual current image");
      const draft = session.getProposedProject();
      const draftTileset = requireTileset(draft, writeSeed.tileset.id);
      expect(draftTileset.tileGrafts).toEqual(secondGrafts);
      expect(requiresVisualReview(createBlankProject(), draft, writeSeed.map.id)).toBe(true);

      // A cold B bake is awaited; warmed A must never be delivered or certified.
      expect(certifiedHash).not.toBe(warmedAHash);
      expect(session.isDraftReviewApproved()).toBe(true);
      expect(result.review?.status).toBe("approved");
      expect(renderRejected).toBe(false);
      expect(reviews.some((entry) => entry.imageCount > 0)).toBe(true);

      // Complete B's exact bake without clearing the warmed A cache entry.
      await waitForExactGraftBake(draftTileset);
      const actualB = await renderToolImages(draft, "show_map_region", regionPayload(requireStartMap(draft)));
      const actualBHash = pngHash(requireRendered(actualB).dataUrl);
      expect(actualBHash).not.toBe(warmedAHash);
      expect(certifiedHash).toBe(actualBHash);

      // Fresh ungrafted baseline Session with real B write admits actual B PNG + authority.
      const releaseProject = createBlankProject();
      const releaseSeed = seedBlankRegion(releaseProject);
      let releaseHash: string | null = null;
      let releaseRound = 0;
      const releaseReviews: Array<{ imageCount: number }> = [];
      const releaseSession = new AssistantSession(releaseProject, {
        config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 8 },
        declareIntent: fixedDeclarer({
          mode: "modify",
          targetMapId: null,
          tools: ["set_tile_grafts", "show_map_region"],
        }),
        renderImages: async (draftProject, name, data) => {
          const images = await renderToolImages(draftProject, name, data);
          releaseHash = pngHash(requireRendered(images).dataUrl);
          return images;
        },
        chat: async (_config, request): Promise<ChatResult> => {
          const input = independentReviewPayload(request);
          if (input) {
            const imageCount = request.messages
              .flatMap((message) => (Array.isArray(message.content) ? message.content : []))
              .filter((part) => part.type === "image_url").length;
            releaseReviews.push({ imageCount });
            return approvedReviewResponse(request)!;
          }
          releaseRound += 1;
          if (releaseRound === 1) {
            return toolCall("set_tile_grafts", {
              tilesetId: releaseSeed.tileset.id,
              grafts: secondGrafts,
              reason: "write B from ungrafted baseline",
            }, "b-write");
          }
          if (releaseRound === 2) {
            const baked = requireTileset(releaseSession.getProposedProject(), releaseSeed.tileset.id);
            await waitForExactGraftBake(baked);
            return toolCall("show_map_region", { ...releaseSeed.region, reason: "review B" }, "b-show");
          }
          return { message: { role: "assistant", content: "Done B" }, finishReason: "stop" };
        },
      });
      const releaseResult = await releaseSession.sendUserMessage("Write B and review current image");
      expect(releaseHash).toBe(actualBHash);
      expect(releaseHash).not.toBe(warmedAHash);
      expect(releaseResult.review?.status).toBe("approved");
      expect(releaseSession.isDraftReviewApproved()).toBe(true);
      expect(releaseReviews.some((entry) => entry.imageCount >= 1)).toBe(true);

      writeJson("cache-collision-ready.json", {
        case: "warmed-ready-collision-no-stale-authority",
        firstGrafts,
        secondGrafts,
        warmedAHash,
        certifiedHash,
        actualBHash,
        releaseHash,
        pendingAuthority: session.isDraftReviewApproved(),
        releaseAuthority: releaseSession.isDraftReviewApproved(),
        reviews,
        releaseReviews,
        renderRejected,
        stoppedReason: result.stoppedReason,
        releaseStoppedReason: releaseResult.stoppedReason,
      });
    } finally {
      restore();
    }
  });


  it("bakes the snapshotted composition when live graft fields mutate while the source is held", async () => {
    const restore = installToolImageRasterDom();
    try {
      const project = createBlankProject();
      const { map, tileset } = seedBlankRegion(project);
      const baseUrl = tilesetBaseImageUrl(tileset);
      // Live mutable objects owned by the project — not frozen literals.
      const liveGraft = {
        targetTile: 0,
        sourceChipset: GRAFT_SOURCE,
        sourceTile: 65,
      };
      tileset.tileGrafts = [liveGraft];

      const gate = installToolImageUrlHoldGate(GRAFT_SOURCE_PATH_SNIP);
      const heldBake = awaitGraftedTilesetImageUrl(tileset, baseUrl);
      await gate.sourceHeld;
      expect(gate.isHolding()).toBe(true);

      // In-place edit while the A bake is still awaiting its source load.
      liveGraft.sourceTile = 387;
      expect(tileset.tileGrafts?.[0]?.sourceTile).toBe(387);

      gate.release();
      const urlA = await heldBake;
      expect(urlA).not.toBeNull();

      const tilesetA: TilesetDef = {
        ...tileset,
        tileGrafts: [{ targetTile: 0, sourceChipset: GRAFT_SOURCE, sourceTile: 65 }],
      };
      const tilesetB: TilesetDef = {
        ...tileset,
        tileGrafts: [{ targetTile: 0, sourceChipset: GRAFT_SOURCE, sourceTile: 387 }],
      };

      // Original request key still maps to the A bake; edited inputs need their own exact bake.
      expect(peekGraftedTilesetImageUrl(tilesetA, baseUrl)).toBe(urlA);
      expect(peekGraftedTilesetImageUrl(tilesetB, baseUrl)).toBeNull();

      const urlB = await awaitGraftedTilesetImageUrl(tilesetB, baseUrl);
      expect(urlB).not.toBeNull();
      expect(urlB).not.toBe(urlA);
      const hashA = pngHash(urlA!);
      const hashB = pngHash(urlB!);
      expect(hashA).not.toBe(hashB);

      // Independent fresh A bake (no clear of A entry) still matches the held snapshot result.
      const confirmA = await awaitGraftedTilesetImageUrl(tilesetA, baseUrl);
      expect(confirmA).toBe(urlA);

      writeJson("snapshot-held-mutate.json", {
        case: "held-source-mutate-keeps-snapshotted-A",
        requestedSourceTile: 65,
        mutatedSourceTile: 387,
        hashA,
        hashB,
        hashesDiffer: hashA !== hashB,
        peekAMatchesHeld: peekGraftedTilesetImageUrl(tilesetA, baseUrl) === urlA,
        peekBEmptyBeforeOwnBake: true,
        confirmAReusesExactKey: confirmA === urlA,
      });
    } finally {
      restore();
    }
  });

  it("does not alias an in-flight bake across colliding graft compositions", async () => {
    const restore = installToolImageRasterDom();
    try {
      const projectA = createBlankProject();
      const projectB = createBlankProject();
      const seedA = seedBlankRegion(projectA);
      const seedB = seedBlankRegion(projectB);
      const grafts = (tiles: number[]) =>
        tiles.map((sourceTile, targetTile) => ({
          targetTile,
          sourceChipset: GRAFT_SOURCE,
          sourceTile,
        }));
      const firstGrafts = grafts([65, 309, 431]);
      const secondGrafts = grafts([387, 227, 361]);
      seedA.tileset.tileGrafts = firstGrafts;
      seedB.tileset.tileGrafts = secondGrafts;

      // Start A bake in-flight; without clearing, schedule B under the same short-hash legacy key.
      const baseA = tilesetBaseImageUrl(seedA.tileset);
      const baseB = tilesetBaseImageUrl(seedB.tileset);
      const inflightA = awaitGraftedTilesetImageUrl(seedA.tileset, baseA);
      // B must not share A's in-flight promise: peek stays empty until B's own bake completes.
      expect(peekGraftedTilesetImageUrl(seedB.tileset, baseB)).toBeNull();
      const startedB = awaitGraftedTilesetImageUrl(seedB.tileset, baseB);
      const [urlA, urlB] = await Promise.all([inflightA, startedB]);
      expect(urlA).not.toBeNull();
      expect(urlB).not.toBeNull();
      expect(urlA).not.toBe(urlB);
      expect(pngHash(urlA!)).not.toBe(pngHash(urlB!));
      expect(peekGraftedTilesetImageUrl(seedA.tileset, baseA)).toBe(urlA);
      expect(peekGraftedTilesetImageUrl(seedB.tileset, baseB)).toBe(urlB);

      writeJson("cache-collision-inflight.json", {
        case: "in-flight-alias-separated",
        firstGrafts,
        secondGrafts,
        hashA: pngHash(urlA!),
        hashB: pngHash(urlB!),
        urlsDiffer: urlA !== urlB,
        hashesDiffer: pngHash(urlA!) !== pngHash(urlB!),
      });
    } finally {
      restore();
    }
  });

});
