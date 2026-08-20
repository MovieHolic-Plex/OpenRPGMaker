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
  if (current === "glass") return "옆에 붙이기";
  if (current === "side") return "아래 바로";
  return "왼쪽 유리";
}

export function chatDockHint(current: ChatDock): string {
  if (current === "glass") return "현재: 왼쪽 유리 카드. 클릭하면 사이드 패널로 전환";
  if (current === "side") return "현재: 사이드 패널. 클릭하면 아래 바로 전환";
  return "현재: 아래 바. 클릭하면 왼쪽 유리로 전환";
}
