import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { createBlankProject } from "@/project/defaults";
import { jsonValue, parseProject } from "@/ai/jobs/checkpointState";
import type { AiJobHost } from "../scripts/lib/aiJobs/scheduler.mjs";
import type { AiJobCheckpoint, AiJobInput, AiJobResult, BlobRef, JsonValue } from "@/ai/jobs/contracts";
import type { EventPage, Project } from "@/project/types";

beforeEach(() => vi.resetModules());
afterEach(() => vi.unstubAllGlobals());

async function routingFixture(baseline: Project, providerOperation: AiJobHost["providerOperation"]) {
  const blobs = new Map<string, JsonValue>();
  let checkpoint: AiJobCheckpoint | null = null;
  let inputHash = "";
  const host: AiJobHost = {
    jobId: "routing-job",
    attemptId: "routing-attempt",
    dependencies: [],
    readBlob: async () => { throw new Error("Unexpected binary read"); },
    putBlob: async () => { throw new Error("Unexpected binary write"); },
    putJson: async value => {
      const text = JSON.stringify(value);
      const sha256 = createHash("sha256").update(text).digest("hex");
      blobs.set(sha256, structuredClone(value));
      return { sha256, byteLength: Buffer.byteLength(text), mediaType: "application/json" };
    },
    readJson: async ref => {
      const value = blobs.get(ref.sha256);
      if (value === undefined) throw new Error("Missing fixture blob");
      return structuredClone(value);
    },
    loadCheckpoint: async () => checkpoint,
    saveCheckpoint: async value => {
      checkpoint = {
        version: 1, jobId: host.jobId, attemptId: host.attemptId,
        inputSha256: inputHash, ...structuredClone(value),
      };
      return host.putJson(jsonValue(checkpoint));
    },
    providerOperation,
  };
  const snapshot: BlobRef = await host.putJson(jsonValue(baseline));
  const surface: {
    __aiJobHost(method: string, args: unknown[]): Promise<unknown>;
    __executeAiJob(input: AiJobInput, identity: Pick<AiJobHost, "jobId" | "attemptId" | "dependencies">): Promise<AiJobResult>;
  } = {
    __aiJobHost: async (method, args) => {
      const handler = Reflect.get(host, method);
      if (typeof handler !== "function") throw new Error("Unknown fixture binding");
      return Reflect.apply(handler, host, args);
    },
    __executeAiJob: async () => { throw new Error("Worker not loaded"); },
  };
  vi.stubGlobal("window", surface);
  await import("@/ai/jobs/workerEntry");
  return { host, snapshot, async run(input: AiJobInput) {
    inputHash = (await host.putJson(jsonValue(input))).sha256;
    return surface.__executeAiJob(input, {
      jobId: host.jobId, attemptId: host.attemptId, dependencies: [],
    });
  } };
}

const config = {
  authMode: "chatgpt", providerId: "google-antigravity",
  model: "gemini-3.7-flash", maxToolCalls: 8, maxTokens: 4096,
};

const reportPin = { sha256: createHash("sha256").update("captured-artwork").digest("hex"), byteLength: 16, mediaType: "image/png" };

it.each([false, true])("routes a database request through the actual worker entry (report pins: %s) and returns a private generated record", async pinned => {
  const baseline = createBlankProject();
  const { host, snapshot, run } = await routingFixture(baseline, async ({ key }) => {
    expect(key).toBe("database/text");
    return { choices: [{
      finish_reason: "stop",
      message: { role: "assistant", content: JSON.stringify({ name: "Relay Potion", price: 37 }) },
    }] };
  });
  const input: AiJobInput = {
    version: 1, family: "database", project: { backend: "local", projectId: "routing-project" },
    projectSnapshot: snapshot, artwork: pinned ? [reportPin] : [], target: {}, mode: "review", dependsOn: [],
    payload: { kind: "item", brief: "Create a potion", withArtwork: false, config,
      ...(pinned ? { reportAssets: { atlas: reportPin } } : {}) },
  };
  const result = await run(input);
  expect(result.family).toBe("database");
  expect(result.project).toEqual(input.project);
  expect(result.generatedSnapshot).not.toBeNull();
  if (!result.generatedSnapshot) throw new Error("Missing generated snapshot");
  const generated = parseProject(await host.readJson(result.generatedSnapshot));
  expect(generated.database.items.find(item => item.name === "Relay Potion")?.price).toBe(37);
  expect(baseline.database.items.some(item => item.name === "Relay Potion")).toBe(false);
  expect(result.payload.persistence).toBe("not-applicable");
}, 60000);

it.each([false, true])("routes captured event drafts (report pins: %s) into a reviewed proposal without changing the saved commands", async pinned => {
  const baseline = createBlankProject();
  const page: EventPage = {
    id: "routing-page", name: "Greeting", commands: [{ kind: "text", body: "Saved greeting" }],
    conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
  };
  const mapId = baseline.startMapId;
  baseline.maps[mapId].events.push({
    id: "routing-event", x: 1, y: 1, trigger: page.trigger,
    commands: page.commands, pages: [page],
  });
  const { host, snapshot, run } = await routingFixture(baseline, async ({ key }) => {
    expect(key).toBe("event-commands/assist/0");
    return { choices: [{
      finish_reason: "stop",
      message: { role: "assistant", content: JSON.stringify([{ kind: "text", body: "Generated greeting" }]) },
    }] };
  });
  const result = await run({
    version: 1, family: "event-commands", project: { backend: "local", projectId: "routing-project" },
    projectSnapshot: snapshot, artwork: pinned ? [reportPin] : [], mode: "review", dependsOn: [],
    target: { kind: "map-event-page", mapId, eventId: "routing-event", pageId: page.id },
    payload: {
      prompt: "Rewrite this greeting", config,
      baseCommands: [{ kind: "text", body: "Unsaved draft greeting" }],
      selection: null, preferenceMemorySection: "",
      ...(pinned ? { reportAssets: { atlas: reportPin } } : {}),
    },
  });
  expect(result.generatedSnapshot).toBeNull();
  expect(result.payload.review).toBe("required");
  const proposalRef = result.artifacts[0];
  if (!proposalRef) throw new Error("Missing event proposal");
  expect(await host.readJson(proposalRef)).toMatchObject({
    kind: "event-commands-proposal",
    baseCommands: [{ kind: "text", body: "Unsaved draft greeting" }],
    finalCommands: [{ kind: "text", body: "Generated greeting" }],
  });
  expect(page.commands).toEqual([{ kind: "text", body: "Saved greeting" }]);
}, 60000);
