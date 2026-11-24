import { describe, expect, it } from "vitest";
import { requestPiCheckpoint, resolvePiCheckpoint } from "../scripts/lib/piCheckpointBroker";
import { runPiAgentViaCompanion, pngLargerThan } from "@/ai/piAgent/client";
import type { PiAgentEvent } from "@/ai/piAgent/protocol";
import type { Project } from "@/project/types";
import { deflateSync } from "node:zlib";
import { PREVIEW_MAX } from "@/editor/openingAnimaticPreview";
import { isolateTimers } from "./mergedTeardown";

describe("piCheckpointProtocol", () => {
  isolateTimers();
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
      // 재전달은 409 대신 이미 받은 결정으로 인정한다(piCheckpointBroker `resolved` 집합, 재연결 workerJson). 두 번 풀리지는 않는다.
      expect(resolvePiCheckpoint(event.checkpointId, { ok: true })).toBe(true);
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
});

// 워커는 512×512 를 넘는 render PNG 를 거절하고(409) 그 거절이 턴 전체를 끊는다 — 2026-11-11 검수용 오프닝 표본이 384×648 이 돼 모든 턴이 끊겼다.
describe("piRenderSizeGuard", () => {
  isolateTimers();
  function png(width: number, height: number): string {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdr = Buffer.alloc(25);
    ihdr.writeUInt32BE(13, 0); ihdr.write("IHDR", 4, "ascii"); ihdr.writeUInt32BE(width, 8); ihdr.writeUInt32BE(height, 12); ihdr[16] = 8; ihdr[17] = 6;
    return Buffer.concat([signature, ihdr, deflateSync(Buffer.alloc(8))]).toString("base64");
  }
  describe("pi render size guard", () => {
    it("names a PNG larger than the worker limit and lets one inside it through", () => {
      expect(pngLargerThan(png(384, 648), 512)).toBe("384×648");
      expect(pngLargerThan(png(513, 10), 512)).toBe("513×10");
      expect(pngLargerThan(png(512, 512), 512)).toBeUndefined();
      expect(pngLargerThan(png(303, 512), 512)).toBeUndefined();
      expect(pngLargerThan("not a png", 512)).toBeUndefined();
    });

    it("the review preview of a 384×216 stage fits the limit for 1–4 frames", () => {
      for (const rows of [1, 2, 3, 4]) {
        const tileWidth = Math.min(PREVIEW_MAX, 384, Math.floor(PREVIEW_MAX / rows * 384 / 216));
        expect(Math.ceil(tileWidth)).toBeLessThanOrEqual(PREVIEW_MAX);
        expect(Math.ceil(rows * tileWidth * 216 / 384)).toBeLessThanOrEqual(PREVIEW_MAX);
      }
    });
  });
  // 늦은 그림 한 장은 턴을 끊지 않는다 — 워커가 그 그림을 이미 버렸으면(409) 그 도구만 실패하고 실행은 끝까지 간다.
  describe("a render reply the worker no longer wants", () => {
    it("is dropped without ending the run", async () => {
      const { runPiAgentViaCompanion } = await import("@/ai/piAgent/client");
      const { resetHeavyWireForTests } = await import("@/ai/piAgent/heavyWire");
      const { createBlankProject } = await import("@/project/defaults");
      const enc = new TextEncoder();
      const line = (value: unknown) => enc.encode(JSON.stringify(value) + "\n");
      const project = createBlankProject();
      const renderPosts: string[] = [];
      const fetchImpl = (async (url: string, init?: RequestInit) => {
        if (String(url).includes("/v1/agent/render")) { renderPosts.push(String(init?.body)); return new Response(JSON.stringify({ error: "gone" }), { status: 409 }); }
        return new Response(new ReadableStream({ start(c) {
          c.enqueue(line({ seq: 0, type: "render_request", renderId: "r-1", toolName: "preview_opening_reference", data: {}, project: {}, unchangedKeys: [] }));
          setTimeout(() => { c.enqueue(line({ seq: 1, type: "done", project, stats: { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 }, changedKeys: [] })); c.close(); }, 30);
        } }), { headers: { "X-Oprn-Run-Id": "run-1" } });
      }) as unknown as typeof fetch;
      const names: string[] = [];
      const result = await runPiAgentViaCompanion({ provider: "google-antigravity", task: "t", mapIds: [], project }, {
        fetchImpl, staleMs: 2_000, resumeDelayMs: 1, onEvent: (event) => { if (event.type === "execution_status") names.push(event.name); },
      });
      resetHeavyWireForTests();
      expect(renderPosts).toHaveLength(1);
      expect(JSON.parse(renderPosts[0]!).renderId).toBe("r-1");
      expect(names).toContain("render.dropped");
      expect(result.project).toBeTruthy();
    });
  });
});
