import { afterEach, describe, expect, it, vi } from "vitest";
import { runPiAgentViaCompanion } from "@/ai/piAgent/client";
import { resetHeavyWireForTests } from "@/ai/piAgent/heavyWire";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  resetHeavyWireForTests();
});

describe("Pi checkpoints while background rendering and timers are stalled", () => {
  it("applies two checkpoints and sends both ACKs without a frame or timer tick", async () => {
    vi.useFakeTimers();
    const doc = Object.assign(new EventTarget(), {
      visibilityState: "hidden", hasFocus: () => false, defaultView: new EventTarget(),
    });
    vi.stubGlobal("document", doc);
    const raf = vi.fn(() => 1);
    vi.stubGlobal("requestAnimationFrame", raf);
    const project = createEmptyToolProject();
    // Force the gzip path, including its cooperative yields, for requests and ACKs.
    project.meta.title = "background fixture ".repeat(60_000);
    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => (clock += 20));
    const acks: string[] = [];
    let stream: ReadableStreamDefaultController<Uint8Array>;
    const emit = (event: unknown) => stream.enqueue(new TextEncoder().encode(JSON.stringify(event) + "\n"));
    const checkpoint = (id: string) => emit({ type: "checkpoint", checkpointId: id, toolName: "rename_map", label: id, project });
    const fetchImpl: typeof fetch = async (input, init) => {
      if (String(input).includes("/checkpoint")) {
        const response = new Response(init?.body as BodyInit);
        const body = new Headers(init?.headers).get("content-encoding") === "gzip"
          ? await new Response(response.body!.pipeThrough(new DecompressionStream("gzip"))).json()
          : await response.json();
        expect(body.ok).toBe(true);
        acks.push(body.checkpointId);
        if (acks.length === 1) checkpoint("second");
        else {
          emit({ type: "done", project, changedKeys: [], stats: { ms: 1, turns: 2, toolCalls: 2, toolErrors: 0 } });
          stream.close();
        }
        return new Response("{}");
      }
      return new Response(new ReadableStream({ start(controller) {
        stream = controller;
        checkpoint("first");
      } }));
    };
    const applied: string[] = [];
    await runPiAgentViaCompanion({ provider: "google-antigravity", task: "background", mapIds: [], project }, {
      fetchImpl, onCheckpoint: async event => { applied.push(event.checkpointId); return project; },
    });
    expect(applied).toEqual(["first", "second"]);
    expect(acks).toEqual(applied);
    expect(raf).not.toHaveBeenCalled();
  });
});
