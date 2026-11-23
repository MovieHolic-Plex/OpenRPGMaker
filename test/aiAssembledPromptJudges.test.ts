// 첫 화면 지시문(사용자 글 + 우리가 조립한 안내)을 넣어도 낱말 판정은 사용자 글로만 나와야 한다 — 모델 호출 없음.
// 2026-11-23 assistant-prompt-review: 한 문자열로 합친 지시문을 판정기가 통째로 읽어 안내 글의 «SF» 가 판타지 모험을 우주 정거장으로(F1),
// «요청하지 않은 …퀘스트·상점·보스… 할당하지 마세요» 가 빵집 게임에 전투·보스·퀘스트 주제를 켰고(F2), 지시문 전문이 «사용자 지시»·앞선 요청으로 다시 실렸다(F3).
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { classifyRequest } from "@/ai/v2/request/intent";
import { worldRequestWords } from "@/ai/v2/request/world";
import { WELCOME_GENRE_PRESETS, buildWelcomeFreeTextPrompt, buildWelcomeGenrePresetPrompt, textAsksForTurnBattle } from "@/editor/welcomeGenrePresets";
import { GOAL_GENRE_PRESET_BRIEF_PREFIX } from "@/ai/genrePresetBrief";
import { auditedUserText, withoutIntentNote } from "@/ai/piAgent/monsterGameRequest";
import { goalCampaignTask, goalCommandBody } from "@/ai/piAgent/goalCommand";
import { PI_TEAM_ROLES } from "@/ai/piAgent/team";
import { priorRequestsNote } from "@/ai/v2/prompt/priorRequests";

const project = createBlankProject() as Project;
const judged = (task: string) => {
  const intent = classifyRequest(task, project);
  return { scope: intent.scope, topics: [...intent.topics].sort(), combat: intent.combat.mentioned, audioOnly: intent.audio.only };
};

describe("start-screen free text is judged on the user's words only", () => {
  const samples = [
    "판타지 회상 스토리, 용사의 모험",
    "조선 시대 사또가 되어 고을 민원을 해결하는 게임",
    "작은 마을 빵집 주인이 되어 손님과 이야기하는 게임",
    "회상 스토리: 잃어버린 동생을 찾는 짧은 이야기",
  ];
  it.each(samples)("%s", (user) => {
    const prompt = buildWelcomeFreeTextPrompt(user);
    expect(judged(prompt)).toEqual(judged(`사용자 의도: ${user}`));
    expect(worldRequestWords(prompt)).toBe(user);
    expect(worldRequestWords(prompt)).not.toMatch(/SF|veil/u);
  });
  it("does not read the «do not add quests or bosses» sentence as a bakery quest", () => {
    const topics = judged(buildWelcomeFreeTextPrompt("작은 마을 빵집 주인이 되어 손님과 이야기하는 게임")).topics;
    expect(topics).not.toContain("battle");
    expect(topics).not.toContain("boss");
    expect(topics).not.toContain("quest");
  });
});

describe("a declined fight is not a fight", () => {
  const user = "전투 없이 마을 사람과 이야기만 하는 빵집 게임";
  it("turns on no battle topic and no battle-screen guidance", () => {
    const own = judged(user);
    expect(own.combat).toBe(false);
    expect(own.topics).not.toContain("battle");
    expect(textAsksForTurnBattle(user)).toBe(false);
    expect(buildWelcomeFreeTextPrompt(user)).not.toContain("전투 화면:");
    expect(textAsksForTurnBattle("용사와 마왕의 전투")).toBe(true);
  });
});

describe("genre chips are judged like their label alone", () => {
  it.each(WELCOME_GENRE_PRESETS.map((preset) => [preset.id, preset] as const))("%s", (_id, preset) => {
    const prompt = buildWelcomeGenrePresetPrompt(preset);
    const label = `${GOAL_GENRE_PRESET_BRIEF_PREFIX} ${preset.label}`;
    expect(judged(prompt)).toEqual(judged(label));
    expect(worldRequestWords(prompt)).toBe(label);
    // 「이브 같은 갤러리 호러」의 «이브 같은» 은 음악 결 낱말이지만 장르 칩은 게임을 고른 것이다.
    expect(judged(prompt).audioOnly).toBe(false);
  });
});

describe("records and the team lead carry the user's words, not the assembled guidance", () => {
  const jrpg = WELCOME_GENRE_PRESETS.find((preset) => preset.id === "adventure-jrpg")!;
  const prompt = buildWelcomeGenrePresetPrompt(jrpg);
  it("puts only the chosen chip on the lead's «사용자 지시» line and keeps the guidance as system notes", () => {
    const task = goalCampaignTask(goalCommandBody(prompt)!);
    const lines = PI_TEAM_ROLES.orchestrator.systemPrompt(createBlankProject(), [], task);
    const user = lines.filter((line) => line.startsWith("사용자 지시:"));
    expect(user).toEqual([`사용자 지시: 장르 프리셋: ${jrpg.label}`]);
    const notes = lines.find((line) => line.startsWith("시스템이 붙인 작업 지침"))!;
    expect(notes).toContain("체크리스트");
    expect(notes).toContain("하드 완료 조건");
    expect(withoutIntentNote(task)).toBe(`장르 프리셋: ${jrpg.label}`);
  });
  it("audits the user's words and keeps the panel's context footer", () => {
    const footer = "\n\n[컨텍스트] 현재 맵: map_a";
    expect(auditedUserText(`${prompt}${footer}`)).toBe(`${GOAL_GENRE_PRESET_BRIEF_PREFIX} ${jrpg.label}${footer}`);
    expect(auditedUserText(`집 지어 줘${footer}`)).toBe(`집 지어 줘${footer}`);
  });
  it("does not replay the checklist as an earlier user request", () => {
    const note = priorRequestsNote([{ kind: "user", text: prompt }], "촌장 대사를 바꿔 줘")!;
    expect(note).toContain(`1. ${GOAL_GENRE_PRESET_BRIEF_PREFIX} ${jrpg.label}`);
    expect(note).not.toContain("체크리스트");
  });
});
