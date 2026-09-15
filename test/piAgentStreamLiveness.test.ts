// Pi 스트림의 «살아 있음» 계약(2026-09-14). 실측: 런타임이 턴·툴 경계에만 줄을 써 모델이 생각하는 동안
// 와이어가 비었고, Bun 유휴 타임아웃이 그 침묵을 끊어 팀 모드 「마을 만들어줘」가 매번 `terminated` 로 죽었다.
// 세 겹으로 막는다: 델타 중계(내용) · 워커 heartbeat(맥박) · 브라우저 워치독(침묵 = 워커 사망).
import { describe, expect, it } from "vitest";
import { createDeltaRelay, type PiDeltaEvent } from "@/ai/piAgent/deltaRelay";
import { PiAgentClientError, runPiAgentViaCompanion } from "@/ai/piAgent/client";
import { createPiAgentLineDecoder, encodePiAgentEvent, type PiAgentEvent } from "@/ai/piAgent/protocol";
import { createTeamBoardState, reduceTeamBoard } from "@/ai/piAgent/teamBoardState";
import { createPiAgentNdjsonStream } from "../scripts/lib/piAgentStream";
import { createBlankProject } from "@/project/defaults";

function nextEvent<T>(subscribe: (listener: (event: T) => void) => void): Promise<T> {
  return new Promise((resolve) => subscribe(resolve));
}

async function readAllLines(stream: ReadableStream<Uint8Array>, onEvent?: (event: PiAgentEvent) => void): Promise<PiAgentEvent[]> {
  const events: PiAgentEvent[] = [];
  const decoder = createPiAgentLineDecoder((event) => { events.push(event); onEvent?.(event); });
  const reader = stream.getReader();
  const text = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    decoder.push(text.decode(value, { stream: true }));
  }
  decoder.flush();
  return events;
}

function ndjsonResponse(feed: (write: (event: PiAgentEvent) => void, close: () => void) => void): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      feed((event) => controller.enqueue(encoder.encode(encodePiAgentEvent(event))), () => controller.close());
    },
  });
  return new Response(body, { status: 200, headers: { "Content-Type": "application/x-ndjson" } });
}

const request = { provider: "google-antigravity", task: "t", mapIds: [], project: createBlankProject() } as const;

describe("델타 중계 — 조각을 합쳐 delta 이벤트로", () => {
  it("같은 종류는 간격 안에서 하나로 합친다", async () => {
    const emitted: PiDeltaEvent[] = [];
    let notify: ((event: PiDeltaEvent) => void) | null = null;
    const relay = createDeltaRelay((event) => { emitted.push(event); notify?.(event); }, { flushMs: 10 });
    const first = nextEvent<PiDeltaEvent>((listener) => { notify = listener; });
    relay.push("thinking", "마을은 ");
    relay.push("thinking", "20x15");
    expect(emitted).toEqual([]);
    expect(await first).toEqual({ type: "delta", kind: "thinking", text: "마을은 20x15" });
    relay.dispose();
    expect(emitted).toHaveLength(1);
  });

  it("종류가 바뀌면 앞 조각을 즉시 비우고, flush/dispose 는 남은 것을 내보낸다", () => {
    const emitted: PiDeltaEvent[] = [];
    const relay = createDeltaRelay((event) => emitted.push(event), { flushMs: 60_000 });
    relay.push("thinking", "생각");
    relay.push("text", "본문");
    expect(emitted).toEqual([{ type: "delta", kind: "thinking", text: "생각" }]);
    relay.flush();
    expect(emitted[1]).toEqual({ type: "delta", kind: "text", text: "본문" });
    relay.push("text", "");
    relay.dispose();
    expect(emitted).toHaveLength(2);
  });

  it("상한을 넘으면 간격을 기다리지 않는다", () => {
    const emitted: PiDeltaEvent[] = [];
    const relay = createDeltaRelay((event) => emitted.push(event), { flushMs: 60_000, maxChars: 5 });
    relay.push("text", "12345678");
    expect(emitted).toEqual([{ type: "delta", kind: "text", text: "12345678" }]);
    relay.dispose();
  });
});

describe("워커 NDJSON 스트림 — 줄 사이에 heartbeat", () => {
  it("실행이 조용해도 heartbeat 줄이 흐르고, 끝나면 닫힌다", async () => {
    let finish: (() => void) | null = null;
    const stream = createPiAgentNdjsonStream(async (onEvent) => {
      await new Promise<void>((resolve) => { finish = resolve; });
      onEvent({ type: "assistant", text: "끝" });
    }, { heartbeatMs: 10 });
    let beats = 0;
    const events = await readAllLines(stream, (event) => {
      if (event.type === "heartbeat" && ++beats === 3) finish?.();
    });
    expect(events.filter((event) => event.type === "heartbeat").length).toBeGreaterThanOrEqual(3);
    expect(events.at(-1)).toEqual({ type: "assistant", text: "끝" });
  });

  it("실행이 던지면 error 줄로 바꿔 쓰고 닫힌다", async () => {
    const stream = createPiAgentNdjsonStream(async () => { throw new Error("제공자 401"); }, { heartbeatMs: 60_000 });
    const events = await readAllLines(stream);
    expect(events).toEqual([{ type: "error", message: "제공자 401" }]);
  });
});

describe("브라우저 워치독 — 침묵은 워커 사망", () => {
  it("staleMs 동안 줄이 없으면 명확한 오류로 끊는다", async () => {
    const fetchImpl = (async () => ndjsonResponse((write) => {
      write({ type: "start", provider: "p", model: "m", toolCount: 1 });
    })) as unknown as typeof fetch;
    await expect(runPiAgentViaCompanion(request, { fetchImpl, staleMs: 40 })).rejects.toSatisfy((error: unknown) =>
      error instanceof PiAgentClientError && /신호가 없어 연결을 끊었습니다/.test(error.message));
  });

  it("heartbeat 가 오는 동안은 끊지 않고 done 까지 기다린다", async () => {
    const seen: string[] = [];
    const fetchImpl = (async () => ndjsonResponse((write, close) => {
      let beats = 0;
      const timer = setInterval(() => {
        write({ type: "heartbeat", at: Date.now() });
        if (++beats === 8) {
          clearInterval(timer);
          write({ type: "done", project: request.project, stats: { ms: 1, turns: 1, toolCalls: 0, toolErrors: 0 }, changedKeys: [] });
          close();
        }
      }, 10);
    })) as unknown as typeof fetch;
    const done = await runPiAgentViaCompanion(request, { fetchImpl, staleMs: 200, onEvent: (event) => seen.push(event.type) });
    expect(done.type).toBe("done");
    expect(seen.filter((type) => type === "heartbeat")).toHaveLength(8);
  });
});

describe("보드 — delta 는 「생각 중」 한 줄, heartbeat 는 무시", () => {
  it("delta 가 행의 마지막 줄을 갱신한다", () => {
    let state = createTeamBoardState("team", "마을");
    state = reduceTeamBoard(state, { type: "agent_spawn", agentId: "b1", role: "builder", mapId: "m", mapName: "빈 맵", task: "집" });
    state = reduceTeamBoard(state, { type: "agent_event", agentId: "b1", event: { type: "delta", kind: "thinking", text: "**도로**를 먼저 깐다" } });
    expect(state.agents[0]?.lastLine).toBe("생각 중 · 도로를 먼저 깐다");
    expect(state.agents[0]?.lastKind).toBe("text");
    const before = state;
    state = reduceTeamBoard(state, { type: "heartbeat", at: 1 });
    expect(state).toBe(before);
  });
});
