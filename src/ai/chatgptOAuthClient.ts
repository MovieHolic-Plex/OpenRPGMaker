import { DEFAULT_CHATGPT_BASE_URL } from "@/ai/llmClient";

const companionOrigin = DEFAULT_CHATGPT_BASE_URL.replace(/\/v1\/?$/u, "");

export interface ChatGptAuthStatus {
  readonly connected: boolean;
  readonly planType?: string;
}

export interface ChatGptLoginStart {
  readonly verificationUrl: string;
  readonly userCode: string;
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? Object.fromEntries(Object.entries(value)) : null;
}

export async function fetchChatGptAuthStatus(): Promise<ChatGptAuthStatus> {
  const response = await fetch(`${companionOrigin}/auth/status`);
  if (!response.ok) throw new Error(`OAuth companion status ${response.status}`);
  const payload = objectValue(await response.json());
  return {
    connected: payload?.connected === true,
    planType: typeof payload?.planType === "string" ? payload.planType : undefined,
  };
}

export async function startChatGptLogin(): Promise<ChatGptLoginStart> {
  const response = await fetch(`${companionOrigin}/auth/login`, { method: "POST" });
  if (!response.ok) throw new Error(`OAuth companion login ${response.status}`);
  const payload = objectValue(await response.json());
  if (typeof payload?.verificationUrl !== "string" || typeof payload.userCode !== "string") {
    throw new Error("OAuth companion returned an invalid device-login response");
  }
  return { verificationUrl: payload.verificationUrl, userCode: payload.userCode };
}
