import { randomUuid } from "@/util/id";

type AiConfigProvider = () => { readonly model: string };
let aiConfigProvider: AiConfigProvider | null = null;

/** 부트가 AI 설정 로더를 주입한다. 미설정이면 agent 이름에 undefined 를 쓴다. */
export function setAiConfigProvider(provider: AiConfigProvider | null): void {
  aiConfigProvider = provider;
}

export type EditorIdentity = {
  id: string;
  label: string;
  kind: "human" | "agent";
  agentName?: string;
};

const SESSION_KEY = "oprn:editor-session-id";
const OWNER_LABEL_KEY = "oprn:editor-owner-label";

export function currentHumanEditorIdentity(): EditorIdentity {
  return {
    id: editorSessionId(),
    label: ownerLabel(),
    kind: "human",
  };
}

export function currentAgentEditorIdentity(agentName = aiConfigProvider?.().model): EditorIdentity {
  return {
    id: editorSessionId(),
    label: ownerLabel(),
    kind: "agent",
    agentName: agentName?.trim() || undefined,
  };
}

export function editorSessionId(): string {
  const storage = browserStorage();
  const existing = storage?.getItem(SESSION_KEY);
  if (existing) return existing;
  const next = randomUuid();
  storage?.setItem(SESSION_KEY, next);
  return next;
}

export function ownerLabel(): string {
  const customLabel = browserStorage()?.getItem(OWNER_LABEL_KEY)?.trim();
  return customLabel || `브라우저 ${editorSessionId().slice(0, 4)}`;
}

export function setOwnerLabel(label: string): void {
  const trimmed = label.trim();
  const storage = browserStorage();
  if (!storage) return;
  if (trimmed) storage.setItem(OWNER_LABEL_KEY, trimmed);
  else storage.removeItem(OWNER_LABEL_KEY);
}

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
