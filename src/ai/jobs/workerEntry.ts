import { executeAssistantJob } from "./executors/assistantJob";
import type { AiJobInput, AiJobResult } from "./contracts";
import type { AiJobHost } from "../../../scripts/lib/aiJobs/scheduler.mjs";

declare global {
  interface Window {
    __aiJobReady(): Promise<void>;
    __aiJobHost(method: string, args: unknown[]): Promise<unknown>;
    __executeAiJob(input: AiJobInput, identity: Pick<AiJobHost, "jobId" | "attemptId" | "dependencies">): Promise<AiJobResult>;
  }
}
window.__executeAiJob = async (input, identity) => {
  const call = <T>(method: string, ...args: unknown[]) => window.__aiJobHost(method, args) as Promise<T>;
  const host: AiJobHost = {
    ...identity,
    readBlob: async ref => new Uint8Array(await call<number[]>("readBlob", ref)),
    readJson: ref => call("readJson", ref),
    putBlob: (bytes, mediaType) => call("putBlob", Array.from(bytes), mediaType),
    putJson: value => call("putJson", value),
    loadCheckpoint: () => call("loadCheckpoint"),
    saveCheckpoint: value => call("saveCheckpoint", value),
    providerOperation: value => call("providerOperation", value),
  };
  if (input.family !== "assistant") throw new Error(`Job family executor not implemented: ${input.family}`);
  return executeAssistantJob(input, host);
};
if (window.__aiJobReady) await window.__aiJobReady();
