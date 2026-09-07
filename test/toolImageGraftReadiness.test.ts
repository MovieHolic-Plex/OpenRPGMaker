import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { AssistantSession } from "@/ai/assistantSession";
import { renderToolImages } from "@/ai/toolImageRenderer";
import { requiresVisualReview } from "@/ai/mapVisualEvidence";
import { clearTileGraftImageCache } from "@/assets/tileGraftImageCache";
import { clearTilesetImageCache } from "@/ai/toolImageCanvas";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";
import { independentReviewPayload, approvedReviewResponse } from "./independentReviewFixture";
import { installToolImageRasterDom } from "./toolImageRasterDom";

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
  return createHash("sha256").update(Buffer.from(dataUrl.split(",")[1]!, "base64")).digest("hex");
}

function writeJson(name: string, value: unknown): string {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const filePath = path.join(EVIDENCE_DIR, name);
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
  return filePath;
}

type HoldGate = {
  readonly sourceHeld: Promise<void>;
  readonly loads: string[];
  release: () => void;
  isHolding: () => boolean;
};

function installUrlHoldGate(holdUrlSnippet: string): HoldGate {
  const RasterImage = globalThis.Image as unknown as {
    new (): HTMLImageElement & {
      src: string;
      onload: ((this: GlobalEventHandlers, ev: Event) => unknown) | null;
      onerror: OnErrorEventHandler;
    };
  };
  const loads: string[] = [];
  let heldImage: HTMLImageElement | null = null;
  let heldUrl = "";
  let releaseSource = false;
  let heldResolve!: () => void;
  const sourceHeld = new Promise<void>((resolve) => { heldResolve = resolve; });
  const parentSetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(new RasterImage()), "src")?.set
    ?? Object.getOwnPropertyDescriptor(RasterImage.prototype, "src")?.set;

  class HeldImage extends RasterImage {
    override get src() {
      return super.src;
    }
    override set src(url: string) {
      loads.push(url);
      if (!releaseSource && heldImage === null && url.includes(holdUrlSnippet)) {
        heldUrl = url;
        heldImage = this as unknown as HTMLImageElement;
        heldResolve();
        return;
      }
      super.src = url;
    }
  }
  vi.stubGlobal("Image", HeldImage);

  return {
    sourceHeld,
    loads,
    isHolding: () => heldImage !== null && !releaseSource,
    release: () => {
      releaseSource = true;
      if (!heldImage || !parentSetter) return;
      parentSetter.call(heldImage, heldUrl);
    },
  };
}

function installSourceLoadFailure(failUrlSnippet: string): string[] {
  const RasterImage = globalThis.Image;
  const loads: string[] = [];
  class FailImage extends RasterImage {
    override get src() { return super.src; }
    override set src(url: string) {
      loads.push(url);
      if (url.includes(failUrlSnippet)) {
        queueMicrotask(() => this.onerror?.(new Error(`forced load failure: ${url}`)));
        return;
      }
      super.src = url;
    }
  }
  vi.stubGlobal("Image", FailImage);
  return loads;
}

describe("tool image graft atlas readiness", () => {
  it("does not resolve a held graft source as the base atlas PNG", async () => {
    const restore = installToolImageRasterDom();
    try {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      map.width = 4;
      map.height = 4;
      map.lowerTiles = Array(16).fill(0);
      map.upperTiles = Array(16).fill(-1);
      map.events = [];
      const tileset = project.tilesets[map.tilesetId]!;
      const region = { mapId: map.id, x: 0, y: 0, w: 4, h: 4, lower: map.lowerTiles, upper: map.upperTiles };

      const before = await renderToolImages(project, "show_map_region", region);
      expect(before).toHaveLength(1);
      const beforeHash = pngHash(before[0]!.dataUrl);

      tileset.tileGrafts = [{
        targetTile: 0,
        sourceChipset: GRAFT_SOURCE,
        sourceTile: 100,
      }];
      expect(requiresVisualReview(createBlankProject(), project, map.id)).toBe(true);

      const gate = installUrlHoldGate(GRAFT_SOURCE_PATH_SNIP);
      const renderPromise = renderToolImages(project, "show_map_region", region);
      await gate.sourceHeld;
      await Promise.resolve();
      await Promise.resolve();
      const race = await Promise.race([
        renderPromise.then((images) => ({ status: "resolved" as const, images })),
        Promise.resolve({ status: "pending" as const }),
      ]);
      expect(race.status).toBe("pending");
      expect(gate.isHolding()).toBe(true);

      gate.release();
      const after = await renderPromise;
      expect(after).toHaveLength(1);
      const afterHash = pngHash(after[0]!.dataUrl);
      const observation = {
        case: "held-then-release-renderer",
        beforeHash,
        afterHash,
        samePng: before[0]!.dataUrl === after[0]!.dataUrl,
        loads: gate.loads,
        dependencyHeld: true,
      };
      writeJson("held-release-renderer.json", observation);
      expect(observation.samePng).toBe(false);
      expect(afterHash).not.toBe(beforeHash);
    } finally {
      restore();
    }
  });

  it("fails closed for a missing graft source and never certifies the base atlas", async () => {
    const restore = installToolImageRasterDom();
    try {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      map.width = 4;
      map.height = 4;
      map.lowerTiles = Array(16).fill(0);
      map.upperTiles = Array(16).fill(-1);
      map.events = [];
      const tileset = project.tilesets[map.tilesetId]!;
      const region = { mapId: map.id, x: 0, y: 0, w: 4, h: 4, lower: map.lowerTiles, upper: map.upperTiles };
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
        beforeHash: pngHash(before[0]!.dataUrl),
      });
    } finally {
      restore();
    }
  });

  it("withholds session approval while the graft source is held, then admits a changed PNG after release", async () => {
    const restore = installToolImageRasterDom();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
    try {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      map.width = 4;
      map.height = 4;
      map.lowerTiles = Array(16).fill(0);
      map.upperTiles = Array(16).fill(-1);
      map.events = [];
      const tileset = project.tilesets[map.tilesetId]!;
      const region = { mapId: map.id, x: 0, y: 0, w: 4, h: 4 };

      const before = await renderToolImages(project, "show_map_region", {
        ...region,
        lower: map.lowerTiles,
        upper: map.upperTiles,
      });
      expect(before).toHaveLength(1);
      const beforeHash = pngHash(before[0]!.dataUrl);

      const gate = installUrlHoldGate(GRAFT_SOURCE_PATH_SNIP);
      const reviews: Array<{ revision: number; requiredProblems: unknown; imageCount: number; held: boolean }> = [];
      let renderedHash: string | null = null;
      let round = 0;
      const session = new AssistantSession(project, {
        config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 8 },
        declareIntent: fixedDeclarer({
          mode: "modify",
          targetMapId: null,
          tools: ["set_tile_grafts", "show_map_region"],
        }),
        renderImages: async (draft, name, data) => {
          const images = await renderToolImages(draft, name, data);
          renderedHash = images[0] ? pngHash(images[0].dataUrl) : null;
          return images;
        },
        chat: async (_config, request): Promise<ChatResult> => {
          const input = independentReviewPayload(request);
          if (input) {
            const images = request.messages
              .flatMap((message) => (Array.isArray(message.content) ? message.content : []))
              .filter((part) => part.type === "image_url");
            reviews.push({
              revision: input.revision,
              requiredProblems: input.requiredProblems,
              imageCount: images.length,
              held: gate.isHolding(),
            });
            return approvedReviewResponse(request)!;
          }
          const calls = [
            {
              name: "set_tile_grafts",
              args: {
                tilesetId: tileset.id,
                grafts: [{ targetTile: 0, sourceChipset: GRAFT_SOURCE, sourceTile: 100 }],
                reason: "replace visible tile zero",
              },
            },
            {
              name: "show_map_region",
              args: { ...region, reason: "review current graft" },
            },
          ];
          const call = calls[round++];
          return call
            ? {
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [{
                    id: `c${round}`,
                    type: "function",
                    function: { name: call.name, arguments: JSON.stringify(call.args) },
                  }],
                },
                finishReason: "tool_calls",
              }
            : { message: { role: "assistant", content: "Done" }, finishReason: "stop" };
        },
      });

      const turnPromise = session.sendUserMessage("Replace the visible atlas tile with a graft and inspect it");
      await gate.sourceHeld;
      await Promise.resolve();
      await Promise.resolve();
      expect(session.isDraftReviewApproved()).toBe(false);
      expect(reviews.length).toBe(0);
      expect(gate.isHolding()).toBe(true);

      gate.release();
      const result = await turnPromise;

      const observation = {
        case: "session-held-then-release",
        beforeHash,
        renderedHash,
        samePng: renderedHash === beforeHash,
        reviews,
        review: result.review,
        stoppedReason: result.stoppedReason,
        authority: session.isDraftReviewApproved(),
        grafts: session.getProposedProject().tilesets[tileset.id]!.tileGrafts,
        loads: gate.loads,
      };
      writeJson("session-held-release.json", observation);
      writeJson("session-held-release-png-meta.json", {
        beforeHash,
        afterHash: renderedHash,
        changed: renderedHash !== beforeHash,
      });

      expect(observation.grafts).toHaveLength(1);
      expect(observation.samePng).toBe(false);
      expect(renderedHash).not.toBeNull();
      expect(observation.reviews.some((entry) => entry.imageCount >= 1)).toBe(true);
      expect(result.review?.status).toBe("approved");
      expect(session.isDraftReviewApproved()).toBe(true);
    } finally {
      restore();
    }
  });

  it("keeps failed graft source loads unapproved in the public session reviewer", async () => {
    const restore = installToolImageRasterDom();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 201 })));
    try {
      const project = createBlankProject();
      const map = project.maps[project.startMapId]!;
      map.width = 4;
      map.height = 4;
      map.lowerTiles = Array(16).fill(0);
      map.upperTiles = Array(16).fill(-1);
      map.events = [];
      const tileset = project.tilesets[map.tilesetId]!;
      const region = { mapId: map.id, x: 0, y: 0, w: 4, h: 4 };
      const loads = installSourceLoadFailure(GRAFT_SOURCE_PATH_SNIP);
      let round = 0;
      const reviews: Array<{ imageCount: number; requiredProblems: unknown }> = [];
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
            reviews.push({ imageCount: images.length, requiredProblems: input.requiredProblems });
            return approvedReviewResponse(request)!;
          }
          const calls = [
            {
              name: "set_tile_grafts",
              args: {
                tilesetId: tileset.id,
                grafts: [{ targetTile: 0, sourceChipset: GRAFT_SOURCE, sourceTile: 100 }],
                reason: "broken source bytes",
              },
            },
            {
              name: "show_map_region",
              args: { ...region, reason: "attempt proof" },
            },
          ];
          const call = calls[round++];
          return call
            ? {
                message: {
                  role: "assistant",
                  content: null,
                  tool_calls: [{
                    id: `c${round}`,
                    type: "function",
                    function: { name: call.name, arguments: JSON.stringify(call.args) },
                  }],
                },
                finishReason: "tool_calls",
              }
            : { message: { role: "assistant", content: "Done" }, finishReason: "stop" };
        },
      });

      const result = await session.sendUserMessage("Graft from a failing chipset load and inspect");
      const observation = {
        case: "session-failed-source-load",
        reviews,
        review: result.review,
        authority: session.isDraftReviewApproved(),
        grafts: session.getProposedProject().tilesets[tileset.id]!.tileGrafts,
        loads,
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
