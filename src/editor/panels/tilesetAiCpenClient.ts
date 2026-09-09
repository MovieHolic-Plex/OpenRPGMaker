import { isAssistantEndpointReady } from "@/ai/assistantEndpoint";
import { loadAiConfig } from "@/ai/llmClient";
import { getAiConnectionStatus } from "@/editor/panels/aiConnectionStatus";
import { JobSubmitError } from "@/editor/aiJobs/jobSubmitError";
import type { CpenTilesetRequest } from "@/editor/tilesetAiRequest";
export { normalizeCpenResponseText, type CpenTilesetRequest } from "@/editor/tilesetAiRequest";

export async function requestCpenTilesetMapping(_request: CpenTilesetRequest): Promise<string> {
  throw new JobSubmitError("unavailable", "타일셋 분석은 작업함으로 맡깁니다.");
}

export function hasCpenTilesetApiKey(): boolean {
  const config = loadAiConfig();
  return isAssistantEndpointReady(config, getAiConnectionStatus(config));
}
