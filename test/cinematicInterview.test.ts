import { describe, expect, it } from "vitest";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { deserialize, serialize } from "@/project/io";
import { normalizeGameDesignBrief, type GameDesignAnswers } from "@/project/gameDesignBrief";
import { interviewPreset, type GameInterview } from "@/project/gameInterview";
import { cinematicInterviewSummary, INTERVIEW_SCENES, SCENE_SLOTS } from "@/editor/cinematicInterviewQuestions";
import { buildWelcomeGenrePresetPrompt, welcomeGenrePresetById, welcomeGenrePresetDisplayText } from "@/editor/welcomeGenrePresets";

function mixedBrief() {
  const answers: GameDesignAnswers = {};
  for (const q of INTERVIEW_SCENES[0]!.questions) answers[SCENE_SLOTS[q.id]!] = {
    question: q.title, label: q.label, text: q.options[0]!.label, source: "user",
  };
  const interview: GameInterview = { version: 1, genre: "romance", secondary: "monster", concept: "사용자의 세계", protagonist: "약사", notes: "교감 중심", choiceIds: {},
    blend: { question: "두 장르를 어떻게 잇나요?", label: "장르의 연결", text: "생물의 성장 사건이 관계를 바꾼다", source: "recommended" } };
  return normalizeGameDesignBrief({ version: 1, presetId: interviewPreset(interview.genre, interview.secondary), answers,
    summary: cinematicInterviewSummary(interview, answers), interview });
}
describe("cinematic interview persistence and internal handoff", () => {
  it("roundtrips author genre, mixture and protagonist through the real project serializer", () => {
    const project = createNewProjectSeed("monster-collect");
    project.gameDesignBrief = mixedBrief();
    const loaded = deserialize(serialize(project));
    expect(loaded.gameDesignBrief).toEqual(project.gameDesignBrief);
    expect(loaded.system.monsterCollection).toBe(true);
    const brief = loaded.gameDesignBrief!;
    const preset = welcomeGenrePresetById(brief.presetId)!;
    expect(buildWelcomeGenrePresetPrompt(preset, brief)).toContain("약사");
    expect(buildWelcomeGenrePresetPrompt(preset, brief)).toContain("F03");
    expect(welcomeGenrePresetDisplayText(preset, brief)).not.toContain("F03");
    expect(welcomeGenrePresetDisplayText(preset, brief)).toMatch(/^관계·연애 \+ 몬스터 수집·육성 · 확정한 게임 기획/u);
  });
  it("rejects lost blend answers and engine/genre mismatches instead of silently dropping them", () => {
    const brief = mixedBrief();
    expect(() => normalizeGameDesignBrief({ ...brief, presetId: "story-cutscene" })).toThrow();
    expect(() => normalizeGameDesignBrief({ ...brief, interview: { ...brief.interview, blend: undefined } })).toThrow();
    expect(() => normalizeGameDesignBrief({ ...brief, interview: { ...brief.interview, secondary: "romance" } })).toThrow();
  });
});
