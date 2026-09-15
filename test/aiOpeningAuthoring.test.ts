import { describe, expect, it } from "vitest";
import { AssistantSession, type SessionEvent } from "@/ai/assistantSession";
import type { AiConfig, ChatResult } from "@/ai/llmClient";
import { createBlankProject } from "@/project/defaults";
import { deserialize, serialize } from "@/project/io";
import type { Project } from "@/project/types";
import { offlineChatResponse } from "./fixtures/offlineChatResponse";
import { approvedReviewResponse } from "./independentReviewFixture";

const PICTURE = "picture-upload";
const MOVIE = "movie-upload";
const VOICE = "voice-upload";

function mediaProject(): Project {
  const project = createBlankProject();
  project.assets.uploaded[PICTURE] = {
    id: PICTURE, name: "표지 그림", kind: "picture", dataUrl: "data:image/png;base64,AAAA", meta: {},
  };
  project.assets.uploaded[MOVIE] = {
    id: MOVIE, name: "인트로 영상", kind: "movie", dataUrl: "data:video/webm;base64,AAAA", meta: {},
  };
  project.assets.uploaded[VOICE] = {
    id: VOICE, name: "내레이션", kind: "sound", dataUrl: "data:audio/ogg;base64,AAAA", meta: {},
  };
  return project;
}

function testConfig(): AiConfig {
  return {
    authMode: "apiKey",
    baseUrl: "http://127.0.0.1:9/v1",
    model: "test",
    liteModel: "test",
    apiKey: "test",
    maxToolCalls: 8,
    maxTokens: 2000,
    reasoningEffort: "low",
  } as AiConfig;
}

function toolCall(name: string, args: unknown, id: string): ChatResult {
  return {
    message: {
      role: "assistant",
      content: null,
      tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }],
    },
    finishReason: "tool_calls",
  } as ChatResult;
}

function final(text: string): ChatResult {
  return { message: { role: "assistant", content: text }, finishReason: "stop" } as ChatResult;
}

describe("어시스턴트 오프닝 저작 루프", () => {
  it("exposes the opening tools and applies set_opening through the real session", async () => {
    const project = mediaProject();
    const exposed: string[][] = [];
    const events: SessionEvent[] = [];
    let step = 0;

    const session = new AssistantSession(project, {
      config: testConfig(),
      chat: async (_config, request): Promise<ChatResult> => {
        const review = approvedReviewResponse(request);
        if (review) return offlineChatResponse(review);
        const names = (request.tools ?? []).map((tool) => tool.function.name);
        exposed.push(names);
        if (!names.includes("set_opening")) return offlineChatResponse(final(JSON.stringify({ mode: "create", needsPlan: false, summary: "오프닝" })));
        step += 1;
        if (step === 1) return offlineChatResponse(toolCall("list_opening_media", { kind: "image" }, "opening-1"));
        if (step === 2) {
          return offlineChatResponse(toolCall("set_opening", {
            enabled: true,
            skippable: true,
            scenes: [
              { kind: "text", narration: "폭풍우 치던 밤", durationMs: 0 },
              { kind: "image", resourceId: PICTURE, narration: "그날의 사진", durationMs: 4000, motion: "zoom" },
              { kind: "video", resourceId: MOVIE, narrationAudioResourceId: VOICE, narration: "영상", durationMs: 0 },
            ],
          }, "opening-2"));
        }
        return offlineChatResponse(final("오프닝을 저장했습니다."));
      },
    });

    const result = await session.sendUserMessage("커스텀 오프닝을 만들어줘", event => { events.push(event); }, undefined, { autonomous: false });

    expect(exposed[0], "본문 요청에 오프닝 툴이 노출되어야 한다").toEqual(expect.arrayContaining(["get_opening", "set_opening", "remove_opening", "list_opening_media"]));
    const opening = session.getProposedProject().system.opening;
    expect(opening).toEqual({
      enabled: true,
      skippable: true,
      scenes: [
        { id: "opening-scene-1", kind: "text", narration: "폭풍우 치던 밤", durationMs: 0 },
        { id: "opening-scene-2", kind: "image", resourceId: PICTURE, narration: "그날의 사진", durationMs: 4000, motion: "zoom" },
        { id: "opening-scene-3", kind: "video", resourceId: MOVIE, narrationAudioResourceId: VOICE, narration: "영상", durationMs: 0 },
      ],
    });
    expect(deserialize(serialize(session.getProposedProject())).system.opening).toEqual(opening);
    expect(result.review?.status).toBe("approved");
    const toolEvents = events.filter((event): event is Extract<SessionEvent, { type: "tool_call" }> => event.type === "tool_call");
    expect(toolEvents.map((event) => event.name)).toEqual(["list_opening_media", "set_opening"]);
  }, 30000);

  it("keeps a rejected media id recoverable for the next model round", async () => {
    const project = mediaProject();
    let step = 0;
    const auditTools: { name?: string; ok?: boolean }[] = [];

    const session = new AssistantSession(project, {
      config: testConfig(),
      chat: async (_config, request): Promise<ChatResult> => {
        const review = approvedReviewResponse(request);
        if (review) return offlineChatResponse(review);
        const names = (request.tools ?? []).map((tool) => tool.function.name);
        if (!names.includes("set_opening")) return offlineChatResponse(final(JSON.stringify({ mode: "create", needsPlan: false, summary: "오프닝" })));
        step += 1;
        if (step === 1) {
          return offlineChatResponse(toolCall("set_opening", { scenes: [{ kind: "image", resourceId: "picture-없음", narration: "그림", durationMs: 0, motion: "none" }] }, "bad-1"));
        }
        if (step === 2) {
          return offlineChatResponse(toolCall("set_opening", { scenes: [{ kind: "text", narration: "다시 시도", durationMs: 0 }] }, "good-2"));
        }
        return offlineChatResponse(final("고쳤습니다."));
      },
    });

    await session.sendUserMessage("커스텀 오프닝을 만들어줘", () => {}, undefined, { autonomous: false });

    const audit = JSON.parse(session.exportAudit()) as { entries?: { kind: string; name?: string; ok?: boolean }[] };
    for (const entry of audit.entries ?? []) {
      if (entry.kind === "tool") auditTools.push({ name: entry.name, ok: entry.ok });
    }
    expect(auditTools.map(entry => `${entry.name}:${entry.ok}`)).toEqual(["set_opening:false", "set_opening:true"]);
    expect(session.getProposedProject().system.opening?.scenes).toEqual([
      { id: "opening-scene-1", kind: "text", narration: "다시 시도", durationMs: 0 },
    ]);
  }, 30000);
});
