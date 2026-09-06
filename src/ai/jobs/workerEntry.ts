import { executeAssistantJob } from "./executors/assistantJob";
import { executeDatabaseJob } from "./executors/databaseJob";
import { executeEventCommandsJob } from "./executors/eventCommandsJob";
import { executeImageJob } from "./executors/imageJob";
import { executeTilesetJob } from "./executors/tilesetJob";
import { executeRegionJob } from "./executors/regionJob";
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
  switch (input.family) {
    case "assistant": return executeAssistantJob(input, host);
    case "database": return executeDatabaseJob(input, host);
    case "event-commands": return executeEventCommandsJob(input, host);
    case "image": return executeImageJob(input, host);
    case "tileset": return executeTilesetJob(input, host);
    case "region": return executeRegionJob(input, host);
    default: {
      const unexpected: never = input;
      throw new Error(`Unsupported AI job family: ${String(unexpected)}`);
    }
  }
};
if (window.__aiJobReady) await window.__aiJobReady();
