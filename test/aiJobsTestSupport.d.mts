import type { Server } from "node:http";
import type { AiJobEvent, AiJobInput, AiJobResult, AiJobsRepository, JsonObject } from "../src/ai/jobs/contracts";
import type { AiJobHost, AiJobsRuntime, AiJobsScheduler } from "../scripts/lib/aiJobs/scheduler.mjs";
import type { createAiJobsHttpHandler } from "../scripts/lib/aiJobs/http.mjs";
export interface TestCleanup { readonly signal?: AbortSignal; after(callback: () => unknown): void }
export interface JobsFixture {
  readonly repository: AiJobsRepository;
  readonly scheduler: AiJobsScheduler;
  readonly directory: string;
  readonly errors: unknown[];
}
export interface JobsHttpFixture extends JobsFixture {
  readonly server: Server;
  readonly origin: string;
  readonly headers: Record<string, string>;
  request(path?: string, options?: { method?: string; body?: unknown; headers?: Record<string, string> }): Promise<Response>;
  post(path: string, body: unknown, headers?: Record<string, string>): Promise<Response>;
}
export function fixture(t: TestCleanup, runtime?: AiJobsRuntime, options?: object): Promise<JobsFixture>;
export function inputFor(repository: AiJobsRepository, overrides?: Partial<AiJobInput>): Promise<AiJobInput>;
export function httpFixture(t: TestCleanup, runtime?: AiJobsRuntime, options?: object, httpOptions?: Partial<Parameters<typeof createAiJobsHttpHandler>[0]>): Promise<JobsHttpFixture>;
export function waitFor(scheduler: AiJobsScheduler, predicate: (event: AiJobEvent) => boolean): Promise<AiJobEvent>;
export function resultFor(input: AiJobInput, host: AiJobHost, payload?: JsonObject): AiJobResult;
