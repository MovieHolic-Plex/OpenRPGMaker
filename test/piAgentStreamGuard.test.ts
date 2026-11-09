// 오너 2026-11-09 monster «terminated» 조사: 이벤트 하나가 인코딩에서 던지면 예전 write() 가 stop() 으로 heartbeat 까지 영구 중지했다.
// 이 시험은 인코더가 한 번 던져도 heartbeat 가 계속 나가고 뒤 이벤트가 도착하며, 빠진 줄이 error 줄로 알려지는 것을 단언한다.
import { describe, expect, it } from "vitest";
import { encodePiAgentEvent, createPiAgentLineDecoder, type PiAgentEvent } from "@/ai/piAgent/protocol";
import { createPiAgentNdjsonStream } from "../scripts/lib/piAgentStream";

async function collect(stream: ReadableStream<Uint8Array>, until: (events: PiAgentEvent[]) => boolean): Promise<PiAgentEvent[]> {
  const events: PiAgentEvent[] = [];
  const decoder = createPiAgentLineDecoder((event) => events.push(event));
  const reader = stream.getReader();
  const text = new TextDecoder();
  while (!until(events)) {
    const { value, done } = await reader.read();
    if (done) break;
    decoder.push(text.decode(value, { stream: true }));
  }
  await reader.cancel();
  return events;
}

describe("worker NDJSON stream survives an event that cannot be encoded", () => {
  it("keeps the heartbeat running, reports the dropped event, and delivers later events", async () => {
    let encodes = 0;
    const encodeEvent = (event: PiAgentEvent): string => {
      encodes += 1;
      if ((event as { type?: string }).type === "execution_status" && (event as { name?: string }).name === "poison") throw new RangeError("Invalid string length");
      return encodePiAgentEvent(event);
    };
    let finish!: () => void;
    const finished = new Promise<void>((resolve) => { finish = resolve; });
    const stream = createPiAgentNdjsonStream(async (onEvent) => {
      onEvent({ type: "execution_status", name: "poison", ok: true, summary: "x" } as PiAgentEvent);
      await finished;
    }, { heartbeatMs: 15, encodeEvent });
    const reader = collect(stream, (events) => {
      const beats = events.filter((e) => e.type === "heartbeat").length;
      if (beats >= 3) finish();
      return beats >= 3 && events.some((e) => e.type === "error");
    });
    const events = await reader;
    expect(events.filter((e) => e.type === "heartbeat").length).toBeGreaterThanOrEqual(3);
    const error = events.find((e) => e.type === "error") as { message?: string } | undefined;
    expect(error?.message).toContain("could not be encoded");
    expect(error?.message).toContain("execution_status");
    expect(encodes).toBeGreaterThan(1);
  });

  it("a later event after the failed one still arrives", async () => {
    let calls = 0;
    const encodeEvent = (event: PiAgentEvent): string => {
      calls += 1;
      if (calls === 1) throw new Error("boom");
      return encodePiAgentEvent(event);
    };
    const stream = createPiAgentNdjsonStream(async (onEvent) => {
      onEvent({ type: "execution_status", name: "first", ok: true, summary: "dropped" } as PiAgentEvent);
      onEvent({ type: "execution_status", name: "second", ok: true, summary: "kept" } as PiAgentEvent);
    }, { heartbeatMs: 1000, encodeEvent });
    const events = await collect(stream, () => false);
    const names = events.filter((e) => e.type === "execution_status").map((e) => (e as { name?: string }).name);
    expect(names).toEqual(["second"]);
    expect(events.some((e) => e.type === "error")).toBe(true);
  });
});
