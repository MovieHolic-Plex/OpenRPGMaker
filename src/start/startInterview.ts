// Draft-only planning in the launcher. No project repository, editor shell or Phaser boot.
import type { GameDesignBrief } from "@/project/gameDesignBrief";
import type { NewProjectChoiceId } from "@/editor/newProjectChoices";

export type LauncherInterviewOptions = {
  container?: HTMLElement;
  signal?: AbortSignal;
  onConfirm?: (brief: GameDesignBrief) => Promise<boolean>;
};

export async function interviewBeforeProject(choiceId: NewProjectChoiceId | null, intent: string, options: LauncherInterviewOptions = {}): Promise<GameDesignBrief | null> {
  const presetId = choiceId ?? "story-cutscene";
  const { showProjectInterview } = await import("@/editor/ui/projectInterviewDialog");
  if (options.signal?.aborted || (options.container && !options.container.isConnected)) return null;
  return showProjectInterview(presetId, { initialAnswer: intent, confirmLabel: "제작 시작", clickThrough: true, ...options });
}
