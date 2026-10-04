// Draft-only planning in the launcher. No project repository, editor shell or Phaser boot.
import type { GameDesignBrief } from "@/project/gameDesignBrief";
import type { NewProjectChoiceId } from "@/editor/newProjectChoices";

export async function interviewBeforeProject(choiceId: NewProjectChoiceId | null, intent: string): Promise<GameDesignBrief | null> {
  const presetId = choiceId ?? "story-cutscene";
  const { showProjectInterview } = await import("@/editor/ui/projectInterviewDialog");
  return showProjectInterview(presetId, { initialAnswer: intent, confirmLabel: "이 게임 만들기" });
}
