import { afterEach, describe, expect, it } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { clearToolImageEventSpriteCache } from "@/ai/toolImageEventSprites";
import { renderToolImages } from "@/ai/toolImageRenderer";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { charsetGraphic } from "@/editor/tools/eventCompile";
import { createBlankProject } from "@/project/defaults";
import type { EventPage, EventPageGraphic, GameEvent, GameMap, Project } from "@/project/types";
import { approvedReviewResponse, imageDeliveryForRequest } from "./independentReviewFixture";
import { fixedDeclarer } from "./intentFixture";
import { installToolImageRasterDom } from "./toolImageRasterDom";

type Call = { readonly name: string; readonly args: Record<string, unknown> };

let restoreDom: (() => void) | null = null;

afterEach(() => {
  restoreDom?.();
  restoreDom = null;
  clearToolImageEventSpriteCache();
});

describe("session acceptance refuses unrepresentative multi-page event imagery", () => {
  it("cannot verify imageReviewed after a page2-only graphic change without representable coverage", async () => {
    restoreDom = installToolImageRasterDom();
    const project = seededProject();
    const map = requireMap(project);
    const shared = charsetGraphic("tex_easyrpg_charset_people1", 0);
    placeNpc(map, multiPageEvent("ev_pages", 2, 2, [
      pageGraphic("p0", shared),
      pageGraphic("p1", structuredClone(shared)),
    ]));

    const work = {
      goal: "NPC page graphics",
      layers: [{ title: "Edit", items: [{ id: "work", title: "Edit event pages", instruction: "Update page graphics" }] }],
    };
    const target = { mapId: map.id };
    const events: SessionEvent[] = [];
    const deliveredCounts: number[] = [];
    let round = 0;
    let divergePage2 = false;
    const session = new AssistantSession(project, {
      // Real raster bytes plus the full native catalog need a catalogued context window.
      // The unknown test model drops this PNG before delivery; do not fabricate its receipt.
      config: { ...defaultAiConfig(), agentMode: "chat", model: "gemini-2.5-flash", liteModel: "gemini-2.5-flash", apiKey: "test", maxToolCalls: 16 },
      declareIntent: fixedDeclarer({ mode: "modify", targetMapId: map.id }),
      renderImages: async (proj, toolName, data) => {
        // Mutate the live session draft (proj), not the outer fixture clone.
        if (divergePage2 && toolName === "show_map_region") {
          const liveMap = proj.maps[map.id];
          if (!liveMap) throw new Error("live map missing");
          const event = requireEvent(liveMap, "ev_pages");
          const page1 = requirePage(event, 1);
          page1.graphic = charsetGraphic("tex_easyrpg_charset_people1", 6);
        }
        try {
          const images = await renderToolImages(proj, toolName, data);
          if (toolName === "show_map_region") deliveredCounts.push(images.length);
          return images;
        } catch (cause) {
          if (toolName === "show_map_region") deliveredCounts.push(0);
          throw cause;
        }
      },
      chat: async (_config, request): Promise<ChatResult> => {
        const review = approvedReviewResponse(request);
        if (review) return review;
        // Establish actual outbound image delivery before the first passing review.
        if (round === 2) expect(imageDeliveryForRequest(request)).toHaveLength(1);
        // After the first pass, page2-only graphic change diverges claimed visuals.
        if (round === 3) divergePage2 = true;
        const scripted: readonly (readonly Call[])[] = [
          [{
            name: "set_work_plan",
            args: {
              ...work,
              acceptance: [{ id: "image", title: "Review", criteria: [{ kind: "imageReviewed", target }] }],
            },
          }, { name: "skip_work_item", args: {} }],
          [{ name: "show_map_region", args: { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height } }],
          [{ name: "review_acceptance", args: { itemId: "image", verdict: "pass", note: "Shared-page NPC looks correct" } }],
          [{ name: "show_map_region", args: { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height } }],
          [{ name: "review_acceptance", args: { itemId: "image", verdict: "pass", note: "Page2 graphic change approved from region image" } }],
        ];
        const batch = scripted[round];
        round += 1;
        if (!batch) return { imageDelivery: imageDeliveryForRequest(request), message: { role: "assistant", content: "done" }, finishReason: "stop" };
        return {
          imageDelivery: imageDeliveryForRequest(request),
          message: {
            role: "assistant",
            content: null,
            tool_calls: batch.map((call, index) => ({
              id: `c${round}_${index}`,
              type: "function",
              function: { name: call.name, arguments: JSON.stringify(call.args) },
            })),
          },
          finishReason: "tool_calls",
        };
      },
    });

    await session.sendUserMessage("Change the second page graphic", (event) => events.push(event));

    // Debug-friendly durable assertions for the multi-page fail-closed contract.
    expect(deliveredCounts, JSON.stringify({ deliveredCounts, snapshot: session.getAcceptanceSnapshot() })).toEqual([1, 0]);

    const reviews = events.filter((event) => event.type === "tool_call" && event.name === "review_acceptance");
    expect(reviews.map((event) => event.type === "tool_call" ? event.result.ok : null), JSON.stringify({
      reviews, status: events.filter(event => event.type === "status"), acceptance: session.getAcceptanceSnapshot(),
    })).toEqual([true, false]);
    expect(session.getAcceptanceSnapshot()?.status).not.toBe("verified");
    expect(session.getAcceptanceSnapshot()?.items[0]?.status).not.toBe("verified");
  });
});

function seededProject(): Project {
  const project = createBlankProject();
  const map = requireMap(project);
  map.width = 12;
  map.height = 10;
  map.lowerTiles = Array.from({ length: map.width * map.height }, () => 0);
  map.upperTiles = Array.from({ length: map.width * map.height }, () => -1);
  map.events = [];
  return project;
}

function requireMap(project: Project): GameMap {
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("start map missing");
  return map;
}

function requireEvent(map: GameMap, id: string): GameEvent {
  const event = map.events.find((entry) => entry.id === id);
  if (!event) throw new Error(`event missing: ${id}`);
  return event;
}

function requirePage(event: GameEvent, index: number): EventPage {
  const page = event.pages?.[index];
  if (!page) throw new Error(`page missing: ${event.id}#${index}`);
  return page;
}

function placeNpc(map: GameMap, event: GameEvent): void {
  map.events.push(event);
}

function multiPageEvent(id: string, x: number, y: number, pages: readonly EventPage[]): GameEvent {
  return {
    id,
    x,
    y,
    trigger: { kind: "action" },
    commands: [],
    pages: [...pages],
  };
}

function pageGraphic(id: string, graphic: EventPageGraphic): EventPage {
  return {
    id,
    name: id,
    conditions: [],
    graphic,
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [],
  };
}
