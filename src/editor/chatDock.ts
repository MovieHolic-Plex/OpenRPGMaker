export type ChatDock = "float" | "side" | "glass";

export const DEFAULT_CHAT_DOCK: ChatDock = "glass";

export function parseChatDock(raw: unknown, fallback: ChatDock = DEFAULT_CHAT_DOCK): ChatDock {
  if (raw === "side" || raw === "float" || raw === "glass") return raw;
  return fallback;
}

export function cycleChatDock(current: ChatDock): ChatDock {
  if (current === "glass") return "side";
  if (current === "side") return "float";
  return "glass";
}

export function isOverlayChatDock(dock: ChatDock): boolean {
  return dock === "float" || dock === "glass";
}

export function nextChatDockActionLabel(current: ChatDock): string {
  if (current === "glass") return "오른쪽";
  if (current === "side") return "입력줄";
  return "카드";
}

export function chatDockHint(current: ChatDock): string {
  if (current === "glass") return "현재: 왼쪽 카드. 클릭하면 오른쪽 패널에 고정";
  if (current === "side") return "현재: 오른쪽 패널. 클릭하면 입력줄로 떼기";
  return "현재: 입력줄. 클릭하면 왼쪽 카드로 열기";
}
