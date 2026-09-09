import { toast } from "@/util/toast";
import { submitRegionJob } from "@/editor/aiJobs/submitRegionJob";
import { jobSubmitMessage } from "@/editor/aiJobs/jobSubmitError";
import { jobOriginLink } from "@/editor/aiJobs/jobOriginLink";
import type { AiRunSurface } from "./aiRunSurface";

export interface AiRegionTaskRunnerDeps {
  readonly surface: AiRunSurface;
  readonly status: HTMLElement;
  selectionTaskActive: boolean;
  activeSelectionRegionController: AbortController | null;
  activeSelectionRegionKey: string | null;
  readonly currentSelectionForRegionTask: () =>
    | {
      readonly mapId: string;
      readonly region: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
    }
    | null;
  readonly refreshContextChips: () => void;
}

export interface AiRegionTaskRunner {
  readonly sendSelectionRegionTask: (text: string) => Promise<void>;
}

export function createAiRegionTaskRunner(deps: AiRegionTaskRunnerDeps): AiRegionTaskRunner {
  const sendSelectionRegionTask = async (text: string): Promise<void> => {
    const selection = deps.currentSelectionForRegionTask();
    if (!selection) {
      deps.selectionTaskActive = false;
      deps.refreshContextChips();
      await deps.surface.sendText(text);
      return;
    }
    if (deps.surface.turnBusy) {
      toast("진행 중인 응답이 끝난 뒤 다시 시도하세요", "info");
      return;
    }
    const trimmed = text.trim();
    if (!trimmed) return;
    deps.surface.turnBusy = true;
    deps.surface.sendButton.disabled = true;
    deps.surface.appendBubble("user", trimmed);
    try {
      const receipt = await submitRegionJob({
        mapId: selection.mapId,
        region: selection.region,
        instruction: trimmed,
        mode: "task",
      });
      deps.surface.setStatus(`작업함에 맡겼습니다 · ${receipt.job.id}`);
      const note = deps.surface.appendBubble("system", `영역 작업을 작업함에 맡겼습니다 · ${receipt.job.id}`);
      note.append(jobOriginLink(receipt.job.id, deps.surface.sendButton));
    } catch (error) {
      deps.surface.setStatus(jobSubmitMessage(error));
    } finally {
      deps.surface.turnBusy = false;
      deps.surface.sendButton.disabled = false;
      deps.surface.drainPendingSends();
    }
  };
  return { sendSelectionRegionTask };
}
