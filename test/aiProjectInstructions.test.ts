// test/aiProjectInstructions.test.ts
// 감독 지침(project.aiInstructions) — 정규화·블록 조립·시스템 프롬프트 생존.
//
// 마지막 케이스가 이 기능의 존재 이유다: 토큰 예산을 아무리 조여도 지침은 시스템 프롬프트에
// 남아야 한다. 예산 안(capability index 옆)에 넣으면 작은 예산에서 조용히 잘려 나가고,
// 사용자는 "규칙을 저장했는데 조수가 무시한다" 를 겪는다.

import { describe, expect, it } from "vitest";
import {
  AI_INSTRUCTIONS_MAX_CHARS,
  aiInstructionsSection,
  normalizeAiInstructions,
} from "@/ai/projectInstructions";
import { buildSystemPrompt } from "@/ai/contextBuilder";
import { createBlankProject } from "@/project/defaults";

describe("normalizeAiInstructions", () => {
  it("Given CRLF 와 앞뒤 공백 When 정규화 Then LF 로 통일되고 공백이 떨어진다", () => {
    expect(normalizeAiInstructions("  1줄\r\n2줄\r  ")).toBe("1줄\n2줄");
  });

  it("Given 비어 있거나 문자열이 아닌 값 When 정규화 Then 빈 문자열이다", () => {
    expect(normalizeAiInstructions("")).toBe("");
    expect(normalizeAiInstructions("   \n  ")).toBe("");
    expect(normalizeAiInstructions(null)).toBe("");
    expect(normalizeAiInstructions(undefined)).toBe("");
  });

  it("Given 상한 초과 When 정규화 Then 상한에서 잘린다", () => {
    const long = "가".repeat(AI_INSTRUCTIONS_MAX_CHARS + 500);

    expect(normalizeAiInstructions(long)).toHaveLength(AI_INSTRUCTIONS_MAX_CHARS);
  });
});

describe("aiInstructionsSection", () => {
  it("Given 미설정 When 블록 조립 Then null(프롬프트에 아무것도 붙지 않는다)", () => {
    expect(aiInstructionsSection("")).toBeNull();
    expect(aiInstructionsSection(undefined)).toBeNull();
  });

  it("Given 지침 When 블록 조립 Then 우선순위와 생존 규칙을 명시한다", () => {
    const section = aiInstructionsSection("이 게임은 4방향 이동이다.")!;

    expect(section).toContain("## 감독 지침(이 프로젝트 고정 규칙)");
    expect(section).toContain("이 절을 따른다");
    expect(section).toContain("이 게임은 4방향 이동이다.");
  });
});

describe("buildSystemPrompt 의 감독 지침 주입", () => {
  it("Given 지침 없는 프로젝트 When 프롬프트 조립 Then 지침 절이 없다", () => {
    const prompt = buildSystemPrompt(createBlankProject());

    expect(prompt).not.toContain("## 감독 지침");
  });

  it("Given 지침 있는 프로젝트 When 프롬프트 조립 Then 지침 절이 포함된다", () => {
    const project = { ...createBlankProject(), aiInstructions: "타일셋 B 는 쓰지 마라." };

    const prompt = buildSystemPrompt(project);

    expect(prompt).toContain("## 감독 지침(이 프로젝트 고정 규칙)");
    expect(prompt).toContain("타일셋 B 는 쓰지 마라.");
  });

  it("Given 극단적으로 작은 문자 예산 When 프롬프트 조립 Then 지침은 살아남는다(예산 밖 고정분)", () => {
    const project = { ...createBlankProject(), aiInstructions: "전투는 턴제다." };

    const prompt = buildSystemPrompt(project, { budgetChars: 400 });

    expect(prompt).toContain("전투는 턴제다.");
  });
});
