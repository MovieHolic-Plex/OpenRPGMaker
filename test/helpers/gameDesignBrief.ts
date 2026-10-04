import { vi } from "vitest";
import { GAME_BRIEF_SLOTS, gameDesignSummary, normalizeGameDesignBrief, type GameDesignAnswers, type GameDesignBrief, type GamePresetId } from "@/project/gameDesignBrief";
import { projectInterviewQuestions } from "@/editor/projectInterviewQuestions";

export function interviewBrief(presetId: GamePresetId = "monster-collect"): GameDesignBrief {
  const answers: GameDesignAnswers = {};
  for (const slot of GAME_BRIEF_SLOTS) {
    const question = projectInterviewQuestions(presetId, answers).find(q => q.slot === slot)!;
    answers[slot] = { question: question.title, label: question.label, text: slot === "experience" && presetId === "monster-collect" ? "공포" : question.choices[0]!, source: "user" };
  }
  return normalizeGameDesignBrief({ version: 1, presetId, answers, summary: gameDesignSummary(answers) });
}

export async function completeInterviewChoices(): Promise<void> {
  document.querySelector<HTMLButtonElement>('[data-testid="project-interview-begin"]')?.click();
  vi.useFakeTimers();
  try {
    for (let i = 0; i < 5; i++) {
      document.querySelector<HTMLButtonElement>('[data-testid="project-interview-option-0"]')!.click();
      document.querySelector<HTMLButtonElement>('[data-testid="project-interview-next"]')!.click();
      await vi.advanceTimersByTimeAsync(2000);
    }
    document.querySelector<HTMLButtonElement>('[data-testid="project-interview-confirm"]')!.click();
    await Promise.resolve();
  } finally { vi.useRealTimers(); }
}
