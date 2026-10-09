import { describe, expect, it } from "vitest";
import { requestPiCheckpoint, resolvePiCheckpoint } from "../scripts/lib/piCheckpointBroker";
import { runPiAgentViaCompanion } from "@/ai/piAgent/client";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import type { Project } from "@/project/types";
const project = { maps: {} } as Project;

describe("checkpoint transport", () => {
  it("does not release a worker until a one-use matching decision arrives", async () => {
    let event!: Extract<PiAgentEvent, { type: "checkpoint" }>;
    let released = false;
    const pending = requestPiCheckpoint({ project, label: "stage", toolName: "paint_tiles" }, e => { event = e as typeof event; }, new AbortController().signal).then(() => { released = true; });
    await Promise.resolve();
    expect(released).toBe(false);
    expect(resolvePiCheckpoint("foreign", { ok: true })).toBe(false);
    expect(resolvePiCheckpoint(event.checkpointId, { ok: true })).toBe(true);
    await pending;
    expect(released).toBe(true);
    expect(resolvePiCheckpoint(event.checkpointId, { ok: true })).toBe(false);
  });
  it("abort retires the pending capability", async () => {
    const controller = new AbortController();
    let id = "";
    const pending = requestPiCheckpoint({ project, label: "stage", toolName: "paint_tiles" }, e => { if (e.type === "checkpoint") id = e.checkpointId; }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toThrow("중단");
    expect(resolvePiCheckpoint(id, { ok: true })).toBe(false);
  });
  it("client acknowledges only after local application and sends the accepted project", async () => {
    let send!: (event: PiAgentEvent) => void;
    let close!: () => void;
    let release!: () => void;
    let reached!: () => void;
    const atCheckpoint = new Promise<void>(resolve => { reached = resolve; });
    const acks: Record<string, unknown>[] = [];
    const encoder = new TextEncoder();
    const done = { type: "done", project, changedKeys: [], stats: { ms: 1, turns: 1, toolCalls: 1, toolErrors: 0 } } as const;
    const task = runPiAgentViaCompanion({ provider: "google-antigravity", task: "edit", mapIds: [], project }, {
      onCheckpoint: async () => { reached(); await new Promise<void>(resolve => { release = resolve; }); return project; },
      fetchImpl: (async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        if (body.checkpointId) { acks.push(body); send(done); close(); return new Response("{}", { status: 200 }); }
        return new Response(new ReadableStream({ start(c) {
          send = event => c.enqueue(encoder.encode(JSON.stringify(event) + "\n")); close = () => c.close();
          send({ type: "checkpoint", checkpointId: "one", project, label: "stage", toolName: "paint_tiles" });
        } }));
      }) as typeof fetch,
    });
    await atCheckpoint;
    expect(acks).toHaveLength(0);
    release();
    await task;
    expect(acks).toEqual([{ checkpointId: "one", ok: true, project }]);
  });
});
