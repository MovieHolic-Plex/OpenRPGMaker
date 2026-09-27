// 브라우저 Pi 클라이언트 — 끊긴 스트림 이어 받기 · 무거운 키 해시 전송 (2026-09-27).
// 실측: 40분짜리 팀 첫 생성이 연결 한 번 끊김(Firefox 「Error in input stream」)에 「실패」로 끝났고, 요청 몸통이 151MB 였다.
import { afterEach, describe, expect, it } from "vitest";
import { runPiAgentViaCompanion } from "@/ai/piAgent/client";
import { resetHeavyWireForTests } from "@/ai/piAgent/heavyWire";
import { createBlankProject } from "@/project/defaults";

const enc = new TextEncoder();
const line = (value: unknown) => enc.encode(JSON.stringify(value) + "\n");
const project = createBlankProject();
const done = { type: "done", project, stats: { ms: 1, turns: 2, toolCalls: 0, toolErrors: 0 }, changedKeys: [] };

async function bodyOf(init?: RequestInit): Promise<Record<string, unknown>> {
  if (typeof init?.body === "string") return JSON.parse(init.body) as Record<string, unknown>;
  const raw = new Response(init?.body as BodyInit).body!.pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(raw).text()) as Record<string, unknown>;
}

afterEach(() => resetHeavyWireForTests());

describe("Pi 클라이언트 이어 받기", () => {
  it("도중에 끊기면 마지막 번호 다음부터 이어 받고, 겹친 줄은 한 번만 처리한다", async () => {
    const calls: string[] = [];
    let runId = "";
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? "GET"} ${url.replace(/^.*\/v1/, "/v1")}`);
      if (init?.method === "POST") {
        runId = String((await bodyOf(init)).runId);
        return new Response(new ReadableStream({ start(c) {
          c.enqueue(line({ seq: 0, type: "turn", index: 1 }));
          c.enqueue(line({ seq: 1, type: "turn", index: 2 }));
          setTimeout(() => c.error(new TypeError("Error in input stream")), 5);
        } }), { headers: { "X-Oprn-Run-Id": runId } });
      }
      return new Response(new ReadableStream({ start(c) {
        c.enqueue(line({ seq: 1, type: "turn", index: 2 }));
        c.enqueue(line({ seq: 2, ...done }));
        c.close();
      } }), { headers: { "X-Oprn-Run-Id": runId } });
    }) as unknown as typeof fetch;
    const turns: number[] = [];
    const result = await runPiAgentViaCompanion({ provider: "google-antigravity", task: "t", mapIds: [], project }, {
      fetchImpl, resumeDelayMs: 1, onEvent: (event) => { if (event.type === "turn") turns.push(event.index); },
    });
    expect(result.type).toBe("done");
    expect(turns).toEqual([1, 2]);
    expect(calls[1]).toContain(`runId=${runId}`);
    expect(calls[1]).toContain("after=2");
  });

  it("실행 기록을 모르는 호스트면 끊겼을 때 이어 받지 않고 오류로 끝낸다", async () => {
    let posts = 0;
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      posts += init?.method === "POST" ? 1 : 0;
      return new Response(new ReadableStream({ start(c) { c.enqueue(line({ type: "turn", index: 1 })); setTimeout(() => c.error(new TypeError("network")), 5); } }));
    }) as unknown as typeof fetch;
    await expect(runPiAgentViaCompanion({ provider: "google-antigravity", task: "t", mapIds: [], project }, { fetchImpl, resumeDelayMs: 1 }))
      .rejects.toThrow(/연결이 끊겼고/);
  });

  it("사용자 중단은 호스트에 cancel 을 보낸다", async () => {
    const controller = new AbortController();
    const calls: string[] = [];
    let runId = "";
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push(url.replace(/^.*\/v1/, "/v1").split("?")[0]!);
      if (url.includes("/agent/cancel")) return new Response("{}");
      runId = String((await bodyOf(init)).runId);
      return new Response(new ReadableStream({ start(c) {
        c.enqueue(line({ seq: 0, type: "turn", index: 1 }));
        init?.signal?.addEventListener("abort", () => c.error(Object.assign(new Error("aborted"), { name: "AbortError" })));
        setTimeout(() => controller.abort(), 5);
      } }), { headers: { "X-Oprn-Run-Id": runId } });
    }) as unknown as typeof fetch;
    await expect(runPiAgentViaCompanion({ provider: "google-antigravity", task: "t", mapIds: [], project }, { fetchImpl, signal: controller.signal, resumeDelayMs: 1 }))
      .rejects.toMatchObject({ name: "AbortError" });
    expect(calls).toContain("/v1/agent/cancel");
  });
});

describe("무거운 키 해시 전송", () => {
  it("타일셋·DB 는 해시로 보내고, 두 번째 요청은 내용 없이 해시만 보낸다", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      const body = await bodyOf(init);
      bodies.push(body);
      return new Response(new ReadableStream({ start(c) { c.enqueue(line({ seq: 0, ...done })); c.close(); } }), { headers: { "X-Oprn-Run-Id": String(body.runId) } });
    }) as unknown as typeof fetch;
    await runPiAgentViaCompanion({ provider: "google-antigravity", task: "t", mapIds: [], project }, { fetchImpl });
    await runPiAgentViaCompanion({ provider: "google-antigravity", task: "t", mapIds: [], project }, { fetchImpl });
    const [first, second] = bodies as { heavy?: Record<string, string>; heavyBlobs?: Record<string, string>; project: { tilesets: object } }[];
    expect(Object.keys(first!.heavy ?? {})).toEqual(expect.arrayContaining(["tilesets"]));
    expect(Object.keys(first!.project.tilesets)).toHaveLength(0);
    expect(Object.keys(first!.heavyBlobs ?? {}).length).toBeGreaterThan(0);
    expect(second!.heavy).toEqual(first!.heavy);
    expect(second!.heavyBlobs).toBeUndefined();
  });

  it("호스트가 해시를 잃었다고 하면(409) 그 내용만 실어 다시 보낸다", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      const body = await bodyOf(init);
      bodies.push(body);
      const heavy = body.heavy as Record<string, string>;
      if (bodies.length === 2) return new Response(JSON.stringify({ error: "heavy-missing", missing: [heavy.tilesets] }), { status: 409 });
      return new Response(new ReadableStream({ start(c) { c.enqueue(line({ seq: 0, ...done })); c.close(); } }), { headers: { "X-Oprn-Run-Id": String(body.runId) } });
    }) as unknown as typeof fetch;
    await runPiAgentViaCompanion({ provider: "google-antigravity", task: "t", mapIds: [], project }, { fetchImpl });
    await runPiAgentViaCompanion({ provider: "google-antigravity", task: "t", mapIds: [], project }, { fetchImpl });
    const retried = bodies[2] as { heavy: Record<string, string>; heavyBlobs?: Record<string, string> };
    expect(Object.keys(retried.heavyBlobs ?? {})).toEqual([retried.heavy.tilesets]);
  });
});
