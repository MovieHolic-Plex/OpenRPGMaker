import { vi } from "vitest";
import * as activityLog from "@/ai/activityLog";
import { whenAiChatPanelSettled } from "@/editor/panels/aiChatPanel";
import { signal } from "./aiTestSignals";

export async function completeRegionTurn(panel: { classList: { remove(...tokens: string[]): void } }, trigger: () => void): Promise<void> {
  const done = signal("region running state cleared");
  const remove = panel.classList.remove.bind(panel.classList);
  const observer = vi.spyOn(panel.classList, "remove").mockImplementation((...tokens) => {
    remove(...tokens);
    if (tokens.includes("is-turn-running")) done.resolve();
  });
  try {
    trigger();
    await done.promise;
    await whenAiChatPanelSettled();
  } finally { observer.mockRestore(); }
}

/** Subscribe to the terminal audit receipt, after DOM/apply completion, before sending. */
export async function completeChatTurn(trigger: () => void): Promise<activityLog.AiActivityLogInput> {
  const done = signal<activityLog.AiActivityLogInput>("terminal chat audit");
  const record = vi.spyOn(activityLog, "recordAiActivity").mockImplementation(async (entry) => {
    if (entry.channel === "chat" && entry.result && entry.result.pending !== true) done.resolve(entry);
    return activityLog.buildAiActivityLogRecord(entry);
  });
  try {
    trigger();
    const receipt = await done.promise;
    await whenAiChatPanelSettled();
    return receipt;
  } finally { record.mockRestore(); }
}
