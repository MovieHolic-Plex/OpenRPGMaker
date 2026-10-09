import { afterEach, describe, expect, it, vi } from "vitest";
import { AssistantSession, type AssistantSessionOptions } from "@/ai/assistantSession";
import { defaultAiConfig, type ChatRequest, type ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { fixedDeclarer } from "./intentFixture";
import { independentReviewPayload, approvedReviewResponse } from "./independentReviewFixture";
import { FLOOR_PAINT_ARGS, WALL_PAINT_ARGS, PRESERVED_PAINT_SPEC, preservedPaintContext } from "./fixtures/preservedPaint";

const ack = (request: ChatRequest) => request.messages.flatMap((message, messageIndex) => Array.isArray(message.content)
  ? message.content.flatMap((part, partIndex) => part.type === "image_url" ? [{ messageIndex, partIndex }] : []) : []);
const call = (name: string, args: object): ChatResult => ({ message: { role: "assistant", content: null, tool_calls: [
  { id: name, type: "function", function: { name, arguments: JSON.stringify(args) } },
] }, finishReason: "tool_calls" });
const final: ChatResult = { message: { role: "assistant", content: "WRITER_SENTINEL" }, finishReason: "stop" };
afterEach(() => vi.restoreAllMocks());

describe("non-history integration contracts", () => {
  // 2026-09-17 독립 검수 해체: 검수 봉투의 requiredProblems(밑그림 미이행 벽 행)·이미지 전달 확인을 검증하던
  // partial / review-image-undelivered 모드는 삭제했다 — 그 봉투 자체가 더 이상 만들어지지 않는다.
  it("independent review retains native preserved-wall accounting: complete", async () => {
    const { project } = preservedPaintContext();
    let reviews = 0;
    const rounds = [
      call("set_build_spec", PRESERVED_PAINT_SPEC), call("paint_tiles", FLOOR_PAINT_ARGS),
      call("paint_tiles", WALL_PAINT_ARGS),
      call("repair_acceptance", { itemId: "acceptance-contract", criteria: [
        { kind: "mapDimensions", target: { mapId: "map_basement" }, width: 12, height: 10 },
      ] }),
      call("show_map_region", { mapId: "map_basement", x: 0, y: 0, w: 12, h: 10 }),
    ];
    let writer = 0;
    const session = new AssistantSession(project, {
      config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 20, maxTokens: 64000 },
      declareIntent: fixedDeclarer({ mode: "modify", targetMapId: "map_basement" }),
      renderImages: async () => [{ label: "Native basement render fixture", dataUrl: "data:image/png;base64,AA==" }],
      chat: async (_config, request) => {
        if (independentReviewPayload(request)) { reviews += 1; return { ...approvedReviewResponse(request)!, imageDelivery: ack(request) }; }
        return { ...(rounds[writer++] ?? final), imageDelivery: ack(request) };
      },
    });
    const result = await session.sendUserMessage("Paint the floor and maintain both wall rows");
    // 검수 모델은 호출되지 않는다 — 승인은 결정적 검사(변경 맵 lint error 0)로 난다.
    expect(reviews).toBe(0);
    const paints = result.proposedCalls.filter(entry => entry.name === "paint_tiles");
    expect(paints.map(entry => entry.result.diff?.tilesChanged)).toEqual([80, 0]);
    expect(project.maps.map_basement.lowerTiles).not.toEqual(session.getProposedProject().maps.map_basement.lowerTiles);
    expect(result.review?.status).toBe("approved");
    expect(result.review?.summary).toContain("lint error 0건");
    expect(session.isDraftReviewApproved()).toBe(true);
    expect(result.appliedCalls ?? []).toEqual([]);
    expect(result.runOutcome?.delivery).not.toBe("persisted");
  });

  it.each([false, true])("owned wiki timeout preserves world and cannot bypass authored-baseline drift (%s)", async stale => {
    const project = createBlankProject();
    const before = structuredClone(project);
    let writer = 0;
    const options: AssistantSessionOptions = {
      config: { ...defaultAiConfig(), agentMode: "chat", maxToolCalls: 8 },
      declareIntent: fixedDeclarer({ mode: "modify" }),
      prepareProjectWiki: async () => {
        if (stale) {
          const external = structuredClone(project);
          external.meta.title = "Concurrent authored change";
          session.refreshAcceptance(external);
        }
        return { kind: "deferred", reason: "extraction-timeout" };
      },
      chat: async (_config, request) => approvedReviewResponse(request)
        ?? (writer++ === 0 ? call("set_title_screen", { title: "Reviewed after deferral" }) : final),
    };
    const session = new AssistantSession(project, options);
    const result = await session.sendUserMessage("Change only the title");
    expect(project).toEqual(before);
    expect(session.getProposedProject().world).toEqual(before.world);
    expect(session.getAuditEntries().some(entry => entry.kind === "status" && entry.text.startsWith("wiki:deferred"))).toBe(true);
    if (stale) {
      expect(writer).toBe(0);
      expect(result.error).toContain("independent-review-stale-baseline");
      expect(session.isDraftReviewApproved()).toBe(false);
    } else {
      expect(result.review?.status).toBe("approved");
      expect(session.getProposedProject().meta.title).toBe("Reviewed after deferral");
    }
  });
});
