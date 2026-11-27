import { describe, expect, it } from "vitest";
import { normalizeGameDesignBrief } from "@/project/gameDesignBrief";
import {
  BLADE_EVENTS,
  BLADE_HEROES,
  BLADE_PLACES,
  FIRST_RUN_BLADES,
  composeBladeSentence,
  findPlaceTilesetHint,
  rollKeywordSlots,
} from "@/start/firstRun/firstRunBlades";
import { FIRST_RUN_DEFAULT_PRESET, firstRunBladeBrief, firstRunBrief, firstRunTitle, pickFirstRunPreset } from "@/start/firstRun/firstRunBrief";

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
    // 생활(농사) 시스템이 닫혀 있는 동안 「농장」 낱말은 장르를 고르지 않는다(electron/shared/lifeSim.ts) — 기본 JRPG.
    expect(pickFirstRunPreset("A cozy FARM life")).toBe(FIRST_RUN_DEFAULT_PRESET);
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

  it("5개 사선 블레이드는 원작 게임 이름을 포함하지 않고, 잠긴 슬롯만 유지하며 섞는다", () => {
    expect(FIRST_RUN_BLADES).toHaveLength(5);
    const forbidden = /포켓몬|투더문|다크소울|아오오니|이브|드퀘|파판/u;
    for (const blade of FIRST_RUN_BLADES) {
      expect(`${blade.spine} ${blade.kicker} ${blade.title} ${blade.desc}`).not.toMatch(forbidden);
    }
    const initial: [string, string, string] = [BLADE_PLACES[0]!.label, "직접 적은 주인공", BLADE_EVENTS[0]!];
    const next = rollKeywordSlots(initial, [false, true, false], () => 0.42);
    expect(next[1]).toBe("직접 적은 주인공");
    expect(next[0]).not.toBe(initial[0]);
    expect(next[2]).not.toBe(initial[2]);
    expect(BLADE_HEROES.length).toBeGreaterThanOrEqual(10);
  });

  it("3키워드 조합 기획은 normalizeGameDesignBrief 계약을 통과하고 선택한 presetId 를 보존한다", () => {
    const souls = FIRST_RUN_BLADES.find((b) => b.id === "souls")!;
    const place = BLADE_PLACES[10]!.label;
    const { brief, title, sentence } = firstRunBladeBrief({
      blade: souls,
      keywords: [place, "심야 편의점 알바생", "첫 체육관 배지 도전"],
      tilesetHint: findPlaceTilesetHint(place),
    });
    expect(brief.presetId).toBe("action-rpg");
    expect(title).toBe("첫 체육관 배지 도전");
    expect(sentence).toBe(composeBladeSentence(souls, [place, "심야 편의점 알바생", "첫 체육관 배지 도전"]));
    expect(brief.answers.detail.text).toContain("joseon_baram");
    expect(normalizeGameDesignBrief(brief)).toEqual(brief);
  });
});
