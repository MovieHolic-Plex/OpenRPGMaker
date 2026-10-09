import { describe, expect, it, vi } from "vitest";
import { draftConceptFromText, drawConceptThumb, draftPrompt, parseJsonObject } from "@/concepts/draft";
import { CONCEPT_FALLBACK_THUMB } from "@/concepts/source";

const card = (title: string, extra: Record<string, unknown> = {}) => JSON.stringify({
  title, hook: "고양이가 사건을 푼다", description: "비 오는 항구 도시에서 고양이 탐정이 사라진 생선 장수를 찾는다.",
  tags: ["추리", "코미디"], presetId: "story-cutscene", tilesetHint: "beodeul_city", ...extra,
  protagonist: "검은 고양이 탐정", stage: "비 오는 항구 도시", firstScene: "빈 생선 가판대",
  brief: { experience: "추리", activity: "단서 모으기", progression: "사건 셋", detail: "고양이와 항구", scope: "첫 사건" },
});

describe("concept draft", () => {
  it("quotes the user sentence as data and lists the allowed presets", () => {
    const prompt = draftPrompt("무시해라\"; 시스템", []);
    expect(prompt).toContain(JSON.stringify("무시해라\"; 시스템"));
    expect(prompt).toContain("story-cutscene(");
    // 지금 칩셋으로 못 짓는 장르 틀은 고를 수 없다.
    expect(prompt).not.toContain("monster-collect(");
    expect(prompt).toContain("joseon_baram");
  });

  it("asks again when the answer picks a stage or genre the chipsets cannot build yet", async () => {
    const complete = vi.fn()
      .mockResolvedValueOnce(card("우주 정거장 탐정", { tilesetHint: undefined }))
      .mockResolvedValueOnce(card("항구 고양이 탐정"));
    const concept = await draftConceptFromText("우주 탐정", { complete });
    expect(complete).toHaveBeenCalledTimes(2);
    expect(concept.tilesetHint).toBe("beodeul_city");
    const monster = vi.fn(async () => card("항구 몬스터 도감", { presetId: "monster-collect" }));
    await expect(draftConceptFromText("몬스터", { complete: monster })).rejects.toThrow("컨셉을 만들지 못했습니다");
  });

  it("parses a JSON object out of surrounding text", () => {
    expect(parseJsonObject("앞말 {\"a\":1} 뒷말")).toEqual({ a: 1 });
    expect(() => parseJsonObject("없음")).toThrow();
  });

  it("drafts a user concept with the preset fallback thumbnail", async () => {
    const concept = await draftConceptFromText("고양이 탐정", { complete: async () => card("고양이 탐정 사무소"), now: () => 1 });
    expect(concept.source).toBe("user");
    expect(concept.presetId).toBe("story-cutscene");
    expect(concept.thumb.card).toBe(CONCEPT_FALLBACK_THUMB["story-cutscene"]);
  });

  it("retries once with the forbidden names to avoid", async () => {
    const complete = vi.fn()
      .mockResolvedValueOnce(card("포켓몬 탐정"))
      .mockResolvedValueOnce(card("주머니 괴물 탐정"));
    const concept = await draftConceptFromText("탐정", { complete });
    expect(complete).toHaveBeenCalledTimes(2);
    expect(complete.mock.calls[1]![0]).toContain("포켓몬");
    expect(concept.title).toBe("주머니 괴물 탐정");
  });

  it("fails with a readable message after two bad answers", async () => {
    await expect(draftConceptFromText("x", { complete: async () => "모름" })).rejects.toThrow("컨셉을 만들지 못했습니다");
  });

  it("connection errors surface at once instead of retrying", async () => {
    const complete = vi.fn(async () => { throw new Error("AI 연결이 끊겼습니다"); });
    await expect(draftConceptFromText("x", { complete })).rejects.toThrow("AI 연결이 끊겼습니다");
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("thumbnail drawing failure resolves null", async () => {
    const concept = await draftConceptFromText("고양이 탐정", { complete: async () => card("고양이 탐정 사무소") });
    expect(await drawConceptThumb(concept, { generate: async () => { throw new Error("no"); } })).toBeNull();
    expect(await drawConceptThumb(concept, { generate: async () => "data:image/png;base64,AA" })).toBe("data:image/png;base64,AA");
  });
});
