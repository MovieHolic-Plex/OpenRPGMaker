// 편집기의 업데이트 「다시 시작」: 조수가 일하는 중이면 끝날 때까지 기다리고, 창 닫기와 같은 저장을 한 뒤에만 재시작한다.
import { flushForAppUpdateRestart } from "@/app/appUpdateChip";
import { isActive, subscribeAiPresence } from "@/editor/panels/aiPresence";

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

export async function prepareEditorForAppUpdateRestart(say: (text: string) => void): Promise<boolean> {
  await waitForAssistantIdle(say);
  say("저장 중…");
  return flushForAppUpdateRestart();
}
