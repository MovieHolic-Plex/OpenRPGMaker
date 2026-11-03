import { describe, expect, it } from "vitest";
import { normalizeGameDesignBrief } from "@/project/gameDesignBrief";
import { FIRST_RUN_DEFAULT_PRESET, firstRunBrief, firstRunTitle, pickFirstRunPreset } from "@/start/firstRun/firstRunBrief";

describe("첫 사용자 프롬프트 — AI 없이 장르 고르기", () => {
  it("예시 칩 네 문장은 각자 맞는 장르 틀로 간다", () => {
    expect(pickFirstRunPreset("첫 파트너와 풀숲에서 몬스터를 모으는 모험")).toBe("monster-collect");
    expect(pickFirstRunPreset("폐교에서 하룻밤을 버티는 공포 탈출")).toBe("school-horror");
    expect(pickFirstRunPreset("10년 만에 사수로 다시 만난 선배와의 오피스 로맨스")).toBe("story-cutscene");
    expect(pickFirstRunPreset("조선에 떨어진 서양 마법사의 점집 개업기")).toBe("story-cutscene");
  });

  it("먼저 나온 규칙이 이긴다 — 몬스터 + 공포는 수집 틀을 지킨다", () => {
    expect(pickFirstRunPreset("공포스러운 몬스터를 포획하는 게임")).toBe("monster-collect");
    expect(pickFirstRunPreset("저택에 갇힌 호러")).toBe("horror-gallery");
    expect(pickFirstRunPreset("A cozy FARM life")).toBe("farm-life");
  });

  it("맞는 낱말이 없으면 기본 JRPG", () => {
    expect(pickFirstRunPreset("회귀한 용사가 마왕의 비서로 취직하는 이야기")).toBe(FIRST_RUN_DEFAULT_PRESET);
    expect(pickFirstRunPreset("")).toBe(FIRST_RUN_DEFAULT_PRESET);
  });

  it("문장을 요약과 사용자 답변에 그대로 싣고, 편집기 인계 검증을 통과한다", () => {
    const sentence = "폐교에서   하룻밤을\n버티는 공포 탈출";
    const brief = firstRunBrief(sentence);
    expect(brief.presetId).toBe("school-horror");
    expect(brief.answers.experience).toMatchObject({ text: "폐교에서 하룻밤을 버티는 공포 탈출", source: "user" });
    expect(brief.summary.split("\n")[0]).toBe("사용자 문장: 폐교에서 하룻밤을 버티는 공포 탈출");
    expect(normalizeGameDesignBrief(brief)).toEqual(brief);
  });

  it("제목은 40자에서 자른다", () => {
    expect(firstRunTitle("  짧은 제목 ")).toBe("짧은 제목");
    expect(firstRunTitle("가".repeat(60))).toBe("가".repeat(40) + "…");
    expect(firstRunTitle("   ")).toBe("새 게임");
  });
});
