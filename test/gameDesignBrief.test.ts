import { describe, expect, it } from "vitest";
import { GAME_PRESET_IDS, normalizeGameDesignBrief } from "@/project/gameDesignBrief";
import { createNewProjectSeed } from "@/editor/genrePacks";
import { deserialize, serialize } from "@/project/io";
import { buildWelcomeGenrePresetPrompt, welcomeGenrePresetById } from "@/editor/welcomeGenrePresets";
import { projectInterviewQuestions } from "@/editor/projectInterviewQuestions";
import { parseAdditionalInterviewAnswers } from "@/ai/projectInterviewAnswers";
import { buildPiAgentSystemPrompt } from "@/ai/piAgent/systemPrompt";
import { interviewBrief } from "./helpers/gameDesignBrief";

describe("confirmed new-project game brief", () => {
  it("round-trips authored answers, raw text, recommendation provenance and pending handoff without changing monster mechanics", () => {
    const seed = createNewProjectSeed("monster-collect");
    seed.gameDesignBrief = interviewBrief();
    seed.gameDesignBrief.generationPending = true;
    seed.gameDesignBrief.answers.detail.source = "recommended";
    seed.gameDesignBrief.summary = "포획할 때마다 주민의 기억이 사라지는 10분 공포 수집 게임";
    const loaded = deserialize(serialize(seed));
    expect(loaded.gameDesignBrief).toEqual(seed.gameDesignBrief);
    expect(loaded.system.monsterCollection).toBe(true);
    expect(loaded.system.battleModel).toBe("gen1");
    expect(loaded.worldCanon).toBeUndefined();
    expect(buildPiAgentSystemPrompt(loaded, [], false).join("\n")).toContain(seed.gameDesignBrief.summary);
  });

  it("leaves old projects unauthored and rejects incomplete or invalid authored decisions", () => {
    expect(deserialize(serialize(createNewProjectSeed(null))).gameDesignBrief).toBeUndefined();
    const brief = interviewBrief();
    expect(() => normalizeGameDesignBrief({ ...brief, answers: {} })).toThrow();
    expect(() => normalizeGameDesignBrief({ ...brief, presetId: "invented" })).toThrow();
    expect(() => normalizeGameDesignBrief({ ...brief, summary: "" })).toThrow();
    expect(() => normalizeGameDesignBrief({ ...brief, generationPending: "yes" })).toThrow();
  });

  it("each preset owns five distinct questions and user experience changes the consequential follow-up", () => {
    const firstQuestions = GAME_PRESET_IDS.map(id => projectInterviewQuestions(id, {}));
    expect(firstQuestions.every(questions => questions.length === 5)).toBe(true);
    expect(new Set(firstQuestions.map(q => q[0]!.title)).size).toBe(8);
    expect(projectInterviewQuestions("monster-collect", interviewBrief().answers)[3]!.title).toContain("공포");
    const gallery = interviewBrief("horror-gallery");
    gallery.answers.experience.text = "동행자를 믿을 수 없는 불안";
    expect(projectInterviewQuestions("horror-gallery", gallery.answers)[3]!.title).toContain("동료를 의심");
  });

  it("generation uses the confirmed revision, without the old sunny tone or arbitrary content quota", () => {
    const brief = interviewBrief();
    brief.summary = "공포 수집 게임. 첫 포획과 마을 조사까지만.";
    const prompt = buildWelcomeGenrePresetPrompt(welcomeGenrePresetById("monster-collect")!, brief);
    expect(prompt).toContain(brief.summary);
    expect(prompt).toContain("수집 시스템을 유지");
    expect(prompt).not.toContain("최소 2개");
    expect(prompt).not.toContain("스타터 몬스터와 간단한 풀숲");
    expect(() => buildWelcomeGenrePresetPrompt(welcomeGenrePresetById("farm-life")!, brief)).toThrow();
  });

  it("only explicitly quoted, unanswered slots can skip another question", () => {
    const original = "공포지만 점프스케어는 없이. 마을 사건을 조사하고 첫 포획까지만.";
    expect(parseAdditionalInterviewAnswers(JSON.stringify({
      experience: "공포", progression: "마을 사건을 조사", scope: "첫 포획까지만", detail: "매 포획마다 동료가 사라짐",
    }), original, ["progression", "scope", "detail"])).toEqual({ progression: "마을 사건을 조사", scope: "첫 포획까지만" });
  });
});
