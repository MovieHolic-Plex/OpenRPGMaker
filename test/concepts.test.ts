import { describe, expect, it } from "vitest";
import { CONCEPT_TAGS, conceptSlug, normalizeGameConcept } from "@/concepts/format";
import { conceptBrief } from "@/concepts/brief";
import { conceptArtPrompt, conceptForbiddenNameHits } from "@/concepts/art";
import { normalizeGameDesignBrief } from "@/project/gameDesignBrief";

const RAW = {
  slug: "body-swap-villainess",
  title: "몸이 뒤바뀐 악역영애",
  hook: "처형 3일 전, 눈을 떠 보니 그 아이의 몸이었다.",
  description: "왕립 아카데미 무도회에서 시작하는 뒤바뀐 두 사람의 이야기.",
  tags: ["웹소설", "연애"],
  presetId: "story-cutscene",
  protagonist: "악역영애(평민 소녀의 몸)",
  stage: "왕립 아카데미",
  firstScene: "무도회장 거울 앞",
  brief: { experience: "뒤바뀐 몸으로 처형을 피한다", activity: "대화·조사", progression: "3일 카운트다운", detail: "거울·무도회", scope: "첫날 밤까지" },
  thumb: { full: "/assets/concepts/body-swap-villainess.full.webp", card: "/assets/concepts/body-swap-villainess.card.webp" },
  source: "official",
  aiGenerated: true,
};

describe("concept format", () => {
  it("normalizes a valid concept", () => {
    const concept = normalizeGameConcept(RAW);
    expect(concept.presetId).toBe("story-cutscene");
    expect(concept.tags).toEqual(["웹소설", "연애"]);
    expect(concept.aiGenerated).toBe(true);
  });

  it("rejects unknown preset, tag, too-long title and an empty brief slot", () => {
    expect(() => normalizeGameConcept({ ...RAW, presetId: "rts" })).toThrow();
    expect(() => normalizeGameConcept({ ...RAW, tags: ["없는분류"] })).toThrow();
    expect(() => normalizeGameConcept({ ...RAW, title: "가".repeat(41) })).toThrow();
    expect(() => normalizeGameConcept({ ...RAW, brief: { ...RAW.brief, scope: "" } })).toThrow();
    expect(() => normalizeGameConcept({ ...RAW, slug: "Bad Slug" })).toThrow();
  });

  it("offers the user's categories", () => {
    for (const tag of ["웹소설", "패러디", "퓨전 사극", "정통 JRPG", "몬스터 수집", "추리", "연애", "호러", "힐링"]) {
      expect(CONCEPT_TAGS).toContain(tag);
    }
  });

  it("makes ascii kebab slugs, also for hangul-only titles", () => {
    expect(conceptSlug("마법사 in 조선")).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(conceptSlug("몸이 뒤바뀐 악역영애")).toMatch(/^concept-[a-z0-9]{6}$/);
    expect(conceptSlug("같은 제목", "a")).not.toBe(conceptSlug("같은 제목", "b"));
  });
});

describe("conceptBrief", () => {
  it("maps the five brief slots and survives brief normalization", () => {
    const brief = conceptBrief(normalizeGameConcept(RAW));
    expect(brief.presetId).toBe("story-cutscene");
    expect(brief.answers.experience.text).toBe("뒤바뀐 몸으로 처형을 피한다");
    expect(brief.answers.experience.source).toBe("recommended");
    expect(brief.concept).toEqual({ slug: "body-swap-villainess", title: "몸이 뒤바뀐 악역영애", hook: RAW.hook });
    expect(normalizeGameDesignBrief(brief)).toEqual(brief);
  });

  it("keeps a cleaned 300-char tweak as the last summary line", () => {
    const brief = conceptBrief(normalizeGameConcept(RAW), "  주인공을 고양이로\n<b>x</b>" + "가".repeat(400));
    const last = brief.summary.split("\n").at(-1)!;
    expect(last.startsWith("사용자 변경: 주인공을 고양이로 <b>x</b>")).toBe(true);
    expect(brief.concept!.tweak!.length).toBe(300);
    expect(normalizeGameDesignBrief(brief).concept!.tweak).toBe(brief.concept!.tweak);
  });

  it("keeps the tweak even when the brief slots are at their limit", () => {
    const long = { ...RAW, brief: Object.fromEntries(Object.keys(RAW.brief).map((slot) => [slot, "나".repeat(1000)])) };
    const brief = conceptBrief(normalizeGameConcept(long), "엔딩은 해피엔딩");
    expect(brief.summary.length).toBeLessThanOrEqual(4000);
    expect(brief.summary.endsWith("사용자 변경: 엔딩은 해피엔딩")).toBe(true);
    expect(() => normalizeGameDesignBrief(brief)).not.toThrow();
  });
});

describe("concept art", () => {
  it("carries the SNES pixel contract and the no-text rule", () => {
    const prompt = conceptArtPrompt(normalizeGameConcept(RAW));
    expect(prompt).toContain("16-bit SNES");
    expect(prompt).toContain("No letters");
  });

  it("flags original IP names and passes parody names", () => {
    expect(conceptForbiddenNameHits("TS 말포이와 호그와트")).toEqual(["호그와트", "말포이"]);
    expect(conceptForbiddenNameHits("TS 금발 라이벌 도련님")).toEqual([]);
    expect(conceptForbiddenNameHits("파이널 판타지아 999")).toEqual([]);
    expect(conceptForbiddenNameHits("파이널 판타지 999")).toEqual(["파이널 판타지"]);
  });
});
