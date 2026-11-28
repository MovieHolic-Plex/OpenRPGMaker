// 편집기의 업데이트 「다시 시작」:
// - 조수가 한가하면 바로 저장하고 다시 시작한다.
// - 조수가 일하는 중이면 대화상자에서 「작업 마치고 업데이트」(비차단 예약) 또는 「지금 강제로 업데이트」(작업 중단 후 즉시 저장·재시작)를 고른다.
import { abortAiAssistantTurn } from "@/editor/aiAssistantBridge";
import {
  flushForAppUpdateRestart,
  type AppUpdateAssistantWork,
  type AppUpdateRestartOptions,
} from "@/app/appUpdateChip";
import { isActive, stopAllPresences, subscribeAiPresence } from "@/editor/panels/aiPresence";

const FORCE_FLUSH_TIMEOUT_MS = 5_000;

export function activeAssistantWorkCount(): number {
  let count = 0;
  const off = subscribeAiPresence((presences) => {
    count = presences.filter(isActive).length;
  });
  off();
  return count;
}

export const editorAppUpdateAssistantWork: AppUpdateAssistantWork = {
  activeCount: activeAssistantWorkCount,
  subscribe: (listener) => subscribeAiPresence((presences) => {
    listener(presences.filter(isActive).length);
  }),
  stopAll: () => {
    stopAllPresences();
    abortAiAssistantTurn();
  },
};

function waitForAssistantIdle(say: (text: string) => void): Promise<void> {
  return new Promise((resolve) => {
    let idle = false;
    let unsubscribe: (() => void) | null = null;
    unsubscribe = subscribeAiPresence((presences) => {
      if (idle) return;
      if (presences.some(isActive)) {
        say("조수 일이 끝나면 다시 시작");
        return;
      }
      idle = true;
      unsubscribe?.();
      resolve();
    });
    // 구독이 현재 값을 바로 주므로 이미 한가했으면 여기서 뗀다.
    if (idle) unsubscribe();
  });
}

export async function prepareEditorForAppUpdateRestart(
  say: (text: string) => void,
  options?: AppUpdateRestartOptions,
): Promise<boolean> {
  if (options?.mode === "force") {
    editorAppUpdateAssistantWork.stopAll();
    say("진행 중인 작업을 중단하고 저장 중…");
    // 강제 업데이트는 저장을 최선으로 시도하되, 중단 직후 저장이 막히더라도 영원히 대기하지 않고 재시작한다.
    await Promise.race([
      flushForAppUpdateRestart().catch(() => false),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), FORCE_FLUSH_TIMEOUT_MS)),
    ]);
    return true;
  }
  await waitForAssistantIdle(say);
  say("저장 중…");
  return flushForAppUpdateRestart();
}
