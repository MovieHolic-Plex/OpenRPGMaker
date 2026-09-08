import { afterEach, describe, expect, it, vi } from "vitest";
import type { Context } from "@oh-my-pi/pi-ai";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import { defaultAiConfig } from "@/ai/llmClient";
import { parseImageDelivery } from "@/ai/imageDelivery";
import * as messageBudget from "@/ai/messageBudget";
import { createBlankProject } from "@/project/defaults";
import { completeProvider } from "../scripts/lib/ohMyPiPiAiRuntime";
import { handleCompanionRequest } from "../scripts/lib/ohMyPiHttp.mjs";
import { fixedDeclarer } from "./intentFixture";

const transport = vi.hoisted(() => {
  const requests: Context[] = [];
  const respond: (context: Context) => unknown = () => ({ content: [], stopReason: "stop" });
  return { requests, respond };
});
// The Bun-only SDK/catalog are replaced. Session, HTTP client, companion router and
// production OpenAI-to-pi conversion execute unchanged; Bun tests cover the real catalog/SDK wire JSON.
vi.mock("@oh-my-pi/pi-catalog", () => ({
  getBundledModel: () => ({ id: "gemini-3.7-flash", input: ["text", "image"] }),
  getBundledModels: () => [],
}));
vi.mock("@oh-my-pi/pi-ai", () => ({ complete: async (_model: unknown, context: Context) => {
  transport.requests.push(context);
  return transport.respond(context);
} }));

const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
type Call = { readonly name: string; readonly arguments: Record<string, unknown> };
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); transport.requests.length = 0; });

function fixture(mode: "delivered" | "dropped" | "rejected" | "partial" | "malformed" | "compacted" | "aborted") {
  const project = createBlankProject();
  const first = project.startMapId;
  project.maps.second = { ...structuredClone(project.maps[first]), id: "second", name: "Second" };
  const events: SessionEvent[] = [];
  const review: Call = { name: "review_acceptance", arguments: { itemId: "images", verdict: "pass", note: "Inspected both maps" } };
  const batches: readonly (readonly Call[])[] = [
    [{ name: "set_work_plan", arguments: { goal: "Review maps", acceptance: [{ id: "images", title: "Images", criteria: [first, "second"].map(mapId => ({ kind: "imageReviewed", target: { mapId } })) }], layers: [{ title: "Review", items: [{ id: "work", title: "Review", instruction: "Review maps" }] }] } }, { name: "skip_work_item", arguments: {} }],
    [first, "second"].map(mapId => ({ name: "show_map_region", arguments: { mapId, x: 0, y: 0, w: 20, h: 15 } })),
    [review],
  ];
  let round = 0;
  let followup = false;
  let failed = false;
  const controller = new AbortController();
  if (mode === "compacted") vi.spyOn(messageBudget, "resolveRequestCharBudget").mockReturnValue(1);
  transport.respond = context => {
    const hasImages = context.messages.some(message => message.role === "user" && Array.isArray(message.content) && message.content.some(part => part.type === "image"));
    if (mode === "rejected" && hasImages && !failed) {
      failed = true;
      return { content: [], errorMessage: "offline provider rejection", errorStatus: 400, stopReason: "error" };
    }
    if (mode === "aborted" && hasImages && !failed) { failed = true; controller.abort(); }
    const batch = followup ? [review] : batches[round++];
    followup = false;
    return { content: batch?.map((call, index) => ({ type: "toolCall", id: `call-${round}-${index}`, ...call })) ?? [{ type: "text", text: "DONE" }], stopReason: batch ? "toolUse" : "stop" };
  };
  vi.stubGlobal("fetch", async (_input: unknown, init?: RequestInit) => {
    const body: unknown = JSON.parse(String(init?.body));
    try {
      const result: { status: number; body: unknown } = await handleCompanionRequest({ method: "POST", url: "/v1/chat/completions", body }, {
        complete: async (provider: string, payload: Record<string, unknown>) => {
          const result = await completeProvider(provider, payload);
          // Exercise worker JSON serialization without starting/writing a server.
          const wire = JSON.stringify(result);
          const decoded: unknown = JSON.parse(wire);
          return decoded;
        },
      });
      if (result.body && typeof result.body === "object" && "image_delivery" in result.body) {
        const deliveries = parseImageDelivery(result.body.image_delivery);
        if (deliveries?.length && !failed && (mode === "dropped" || mode === "partial")) {
          failed = true;
          if (mode === "dropped") delete result.body.image_delivery;
          else result.body.image_delivery = deliveries.slice(0, 1);
        }
      }
      return Response.json(result.body, { status: result.status });
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      return Response.json({ error: error.message }, { status: 400 });
    }
  });
  const session = new AssistantSession(project, {
    config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 7 },
    declareIntent: fixedDeclarer({ mode: "modify", targetMapId: first }),
    yieldToUi: async () => {},
    renderImages: async (_project, _name, data) => [{ label: JSON.stringify(data), dataUrl: mode === "malformed" ? "data:image/png;base64,broken" : `data:image/png;base64,${png}` }],
  });
  return { session, events, run: () => session.sendUserMessage("Review the authored maps", event => events.push(event), controller.signal), followup: async (retry = false) => {
    followup = true;
    if (mode === "compacted") vi.restoreAllMocks();
    return retry ? session.retryLastTurn(event => events.push(event)) : session.sendUserMessage("Continue reviewing", event => events.push(event));
  } };
}

describe("session to companion image delivery", () => {
  it("delivers multiple labeled map images through the real conversion before accepting review", async () => {
    const { session, events, run } = fixture("delivered");
    await run();
    const imageRequest = transport.requests.find(context => context.messages.some(message => message.role === "user" && Array.isArray(message.content) && message.content.some(part => part.type === "image")));
    expect(imageRequest).toBeDefined();
    const imageMessage = imageRequest?.messages.find(message => message.role === "user" && Array.isArray(message.content) && message.content.some(part => part.type === "image"));
    expect(imageMessage).toMatchObject({ role: "user", content: [
      { type: "text" }, { type: "text" }, { type: "image", mimeType: "image/png", data: png },
      { type: "text" }, { type: "image", mimeType: "image/png", data: png },
    ] });
    expect(events.find(event => event.type === "tool_call" && event.name === "review_acceptance")).toMatchObject({ result: { ok: true } });
    expect(session.getAcceptanceSnapshot()?.status).toBe("verified");
  });

  it.each(["dropped", "partial", "rejected", "malformed", "compacted", "aborted"] as const)("keeps %s delivery blocked on later turns and retries", async mode => {
    const { session, events, run, followup } = fixture(mode);
    await run();
    expect(session.getAcceptanceSnapshot()?.status).not.toBe("verified");
    await followup(mode === "rejected" || mode === "malformed");
    expect(session.getAcceptanceSnapshot()?.status).not.toBe("verified");
    const reviews = events.filter(event => event.type === "tool_call" && event.name === "review_acceptance");
    if (mode !== "malformed") expect(reviews.length).toBeGreaterThan(0);
    expect(reviews.every(event => event.type === "tool_call" && !event.result.ok)).toBe(true);
  });
});
