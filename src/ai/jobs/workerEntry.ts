import type { AiJobInput, AiJobResult } from "./contracts";
import type { AiJobHost, AiReportHost } from "../../../scripts/lib/aiJobs/scheduler.mjs";
import type { renderJobReport } from "./renderJobReport";
import type { ReportContext } from "./reportModel";

declare global {
  interface Window {
    __aiJobReady(): Promise<void>;
    __renderAiJobReport(report: ReportContext, identity: Pick<AiJobHost, "jobId" | "attemptId" | "dependencies">): ReturnType<typeof renderJobReport>;
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
    case "assistant": return (await import("./executors/assistantJob")).executeAssistantJob(input, host);
    case "database": return (await import("./executors/databaseJob")).executeDatabaseJob(input, host);
    case "event-commands": return (await import("./executors/eventCommandsJob")).executeEventCommandsJob(input, host);
    case "image": return (await import("./executors/imageJob")).executeImageJob(input, host);
    case "tileset": return (await import("./executors/tilesetJob")).executeTilesetJob(input, host);
    case "region": return (await import("./executors/regionJob")).executeRegionJob(input, host);
    default: {
      const unexpected: never = input;
      throw new Error(`Unsupported AI job family: ${String(unexpected)}`);
    }
  }
};
window.__renderAiJobReport = async (report, identity) => {
  const call = <T>(method: string, ...args: unknown[]) => window.__aiJobHost(method, args) as Promise<T>;
  const host: AiReportHost = {
    ...identity, report,
    readBlob: async ref => new Uint8Array(await call<number[]>("readBlob", ref)),
    readJson: ref => call("readJson", ref),
    putBlob: (bytes, mediaType) => call("putBlob", Array.from(bytes), mediaType),
    putJson: value => call("putJson", value),
    saveReport: document => call("saveReport", document),
  };
  return (await import("./renderJobReport")).renderJobReport(report.result, host);
};
if (window.__aiJobReady) await window.__aiJobReady();
