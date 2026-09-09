import { describe, expect, it } from "vitest";
import {
  IMAGE_GENERATION_MODEL,
  IMAGE_GENERATION_PROVIDER_ID,
  ImageGenerationError,
  generateAiImage,
  imageGenerationEndpoint,
  imageGenerationUsesOtherProvider,
} from "@/ai/imageGenerationClient";
import { defaultAiConfig } from "@/ai/llmClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("imageGenerationClient", () => {
  it("defaults to the actual image-output model", () => {
    expect(IMAGE_GENERATION_MODEL).toBe("gemini-3.1-flash-image");
  });

  it("동반 서비스의 같은 오리진 /v1 경로를 친다", () => {
    expect(imageGenerationEndpoint()).toBe("/v1/images/generations");
  });

  it("그림은 항상 이미지 지원 제공자로 보낸다", async () => {
    const seen: { url: string; provider: string; body: unknown }[] = [];
    const image = await generateAiImage(
      { prompt: "슬라임" },
      {
        fetch: async (input, init) => {
          const headers = new Headers(init?.headers);
          seen.push({
            url: String(input),
            provider: headers.get("X-Rpgzzu-Provider") ?? "",
            body: JSON.parse(String(init?.body ?? "{}")),
          });
          return jsonResponse({
            image: {
              dataUrl: "data:image/png;base64,AAA",
              mimeType: "image/png",
              model: IMAGE_GENERATION_MODEL,
              provider: IMAGE_GENERATION_PROVIDER_ID,
            },
          });
        },
      },
    );

    expect(seen).toHaveLength(1);
    expect(seen[0]!.url).toBe("/v1/images/generations");
    expect(seen[0]!.provider).toBe(IMAGE_GENERATION_PROVIDER_ID);
    expect(seen[0]!.body).toEqual({ prompt: "슬라임", model: IMAGE_GENERATION_MODEL });
    expect(image.dataUrl).toBe("data:image/png;base64,AAA");
  });

  it("빈 프롬프트는 요청 전에 거부한다", async () => {
    let calls = 0;
    await expect(
      generateAiImage({ prompt: "  " }, { fetch: async () => { calls += 1; return jsonResponse({}); } }),
    ).rejects.toThrow(ImageGenerationError);
    expect(calls).toBe(0);
  });

  it("사용자 중단과 요청 시간 초과를 구분한다", async () => {
    const abortError = new DOMException("중단", "AbortError");
    const controller = new AbortController();
    controller.abort();

    await expect(
      generateAiImage({ prompt: "슬라임", signal: controller.signal }, { fetch: async () => { throw abortError; } }),
    ).rejects.toThrow("생성을 취소했습니다");
    await expect(
      generateAiImage({ prompt: "슬라임" }, { fetch: async () => { throw abortError; } }),
    ).rejects.toThrow("이미지 생성이 시간 안에 끝나지 않았습니다.");
  });

  it("서버 오류 본문의 사람이 읽는 메시지를 그대로 올린다", async () => {
    await expect(
      generateAiImage({ prompt: "슬라임" }, { fetch: async () => jsonResponse({ error: "이미지 생성은 …만 지원합니다." }, 409) }),
    ).rejects.toThrow("이미지 생성은 …만 지원합니다.");
  });

  it("인증 안내를 상태와 함께 그대로 올린다", async () => {
    const message = "이미지를 만들려면 AI 설정 → Google Antigravity 로그인에서 연결해 주세요.";
    let failure: unknown;
    try {
      await generateAiImage({ prompt: "슬라임" }, { fetch: async () => jsonResponse({ error: message }, 401) });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(ImageGenerationError);
    expect((failure as ImageGenerationError).message).toBe(message);
    expect((failure as ImageGenerationError).status).toBe(401);
  });

  it("dataUrl 이 없는 200 응답도 실패로 본다", async () => {
    await expect(
      generateAiImage({ prompt: "슬라임" }, { fetch: async () => jsonResponse({ image: { mimeType: "image/png" } }) }),
    ).rejects.toThrow(ImageGenerationError);
  });

  it("기본 제공자(Antigravity)면 다른 제공자 안내가 필요 없다", () => {
    const config = defaultAiConfig();
    expect(config.providerId).toBe(IMAGE_GENERATION_PROVIDER_ID);
    expect(imageGenerationUsesOtherProvider(config)).toBe(false);
    expect(imageGenerationUsesOtherProvider({ ...config, providerId: "openai-codex" })).toBe(true);
  });
});
