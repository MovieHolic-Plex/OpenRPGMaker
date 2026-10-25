import { describe, expect, it } from "vitest";
import { ImageGenerationError } from "@/ai/imageGenerationClient";
import { closestLibraryPictures, imageFailureNextStep, isImageCredentialFailure } from "@/editor/imageGenerationFallback";
import { generateOpeningStill } from "@/editor/openingImageGeneration";
import { generateTitleArt } from "@/editor/titleArtGeneration";

// 2026-10-25 심사(salad-omo-1 「그림 생성이 Google 로그인 요구」 7건): 그림 연결이 없을 때 실패 안내가 «제작을 멈추라»고 시켜 턴이 멈췄다.
const LOGIN = "이미지를 만들려면 AI 설정 → Google Antigravity 로그인에서 연결해 주세요.";
const noLogin = async () => { throw new ImageGenerationError(LOGIN, 401); };

describe("image generation fallback when the image login is missing", () => {
  it("treats a missing login as a failure that won't clear up during this run", () => {
    expect(isImageCredentialFailure(new ImageGenerationError(LOGIN, 401))).toBe(true);
    expect(isImageCredentialFailure(new ImageGenerationError("이미지 생성이 시간 안에 끝나지 않았습니다."))).toBe(false);
  });

  it("names the closest library pictures by description, skipping city skylines for a fairy-tale scene", () => {
    const picks = closestLibraryPictures("동화 같은 숲 마을의 밤");
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.some((pick) => /skyline|city/u.test(pick.id))).toBe(false);
  });

  it("the next step says to keep building, never to stop", () => {
    const step = imageFailureNextStep("title", "숲 마을", new ImageGenerationError(LOGIN, 401));
    expect(step).toContain("다시 부르지 마라");
    expect(step).toContain("계속한다");
    expect(step).toContain("턴을 멈추지 않는다");
    expect(step).not.toContain("멈추고");
  });

  it("opening and title-art failures carry the fallback instead of a stop order", async () => {
    const opening = await generateOpeningStill({ prompt: "새벽 안개 낀 숲속 마을 광장, 아무도 없는 풍경" }, { generateImage: noLogin });
    expect(opening.ok).toBe(false);
    if (!opening.ok) {
      expect(opening.summary).toContain("Antigravity");
      expect(opening.summary).toContain("턴을 멈추지 않는다");
      expect(opening.summary).not.toContain("제작을 멈추고");
    }
    const title = await generateTitleArt({ prompt: "동화 공방의 오르골" }, { generateImage: noLogin, fitEffects: false });
    expect(title.ok).toBe(false);
    if (!title.ok) expect(title.summary).toContain("set_title_screen");
  });
});
