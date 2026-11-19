import { describe, expect, it } from "vitest";
import {
  IMAGE_GENERATION_MODEL,
  IMAGE_GENERATION_PROVIDER_ID,
  ImageGenerationError,
  generateAiImage,
  imageGenerationEndpoint,
  imageGenerationUsesOtherProvider,
} from "@/ai/imageGenerationClient";
import { IMAGE_CHATGPT_LOGIN_REQUIRED, RECOMMENDED_IMAGE_MODEL, RECOMMENDED_IMAGE_PROVIDER_ID } from "@/ai/imageModelCatalog";
import { defaultAiConfig } from "@/ai/llmClient";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("imageGenerationClient", () => {
  it("defaults to the ChatGPT image provider, not Gemini", () => {
    expect(IMAGE_GENERATION_PROVIDER_ID).toBe("openai-codex");
    expect(IMAGE_GENERATION_MODEL).toBe("codex-image-default");
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
            provider: headers.get("X-Oprn-Provider") ?? "",
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
    expect(seen[0]!.provider).toBe(RECOMMENDED_IMAGE_PROVIDER_ID);
    expect(seen[0]!.body).toEqual({ prompt: "슬라임", model: RECOMMENDED_IMAGE_MODEL });
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

  it("ChatGPT 인증에 실패하면 다른 제공자를 부르지 않고 로그인 안내를 올린다", async () => {
    const seen: [string | null, string][] = [];
    const result = generateAiImage(
      { prompt: "슬라임", model: "gemini-3.1-flash-image", providerId: "google-antigravity" },
      { fetch: async (_input, init) => {
        seen.push([new Headers(init?.headers).get("X-Oprn-Provider"), JSON.parse(String(init?.body)).model]);
        return jsonResponse({ error: "Unauthorized" }, 401);
      } },
    );
    await expect(result).rejects.toBeInstanceOf(ImageGenerationError);
    await expect(result).rejects.toMatchObject({ message: IMAGE_CHATGPT_LOGIN_REQUIRED, status: 401 });
    expect(seen).toEqual([["openai-codex", "codex-image-default"]]);
  });

  it("dataUrl 이 없는 200 응답도 실패로 본다", async () => {
    await expect(
      generateAiImage({ prompt: "슬라임" }, { fetch: async () => jsonResponse({ image: { mimeType: "image/png" } }) }),
    ).rejects.toThrow(ImageGenerationError);
  });

  it("대화 제공자와 그림 제공자가 같을 때만 다른 제공자 안내가 필요 없다", () => {
    const config = { ...defaultAiConfig(), providerId: "google-antigravity" };
    expect(config.imageProviderId).toBe(IMAGE_GENERATION_PROVIDER_ID);
    expect(imageGenerationUsesOtherProvider(config)).toBe(true);
    expect(imageGenerationUsesOtherProvider({ ...config, providerId: "openai-codex" })).toBe(false);
  });
});
