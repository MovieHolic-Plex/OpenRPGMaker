// /agent/run 의 NDJSON 응답 본문. 실행 이벤트를 한 줄씩 쓰고, 줄 사이가 비면 heartbeat 를 끼운다.
//
// 진행 이벤트만으로는 모델이 생각하는 동안 와이어가 비고, 그 침묵을 유휴 타임아웃 층이 끊는다
// (실측 2026-09-14). 이 스트림은 무슨 일이 있어도 PI_AGENT_HEARTBEAT_MS 안에 한 줄은 쓴다.

import { encodePiAgentEvent, PI_AGENT_HEARTBEAT_MS, type PiAgentEvent } from "../../src/ai/piAgent/protocol.ts";

export interface PiAgentStreamOptions {
  readonly heartbeatMs?: number;
  /** 시험용 — 줄 인코더를 바꿔 «인코딩 실패» 를 만든다. 기본은 encodePiAgentEvent. */
  readonly encodeEvent?: (event: PiAgentEvent) => string;
}

export function createPiAgentNdjsonStream(
  run: (onEvent: (event: PiAgentEvent) => void) => Promise<unknown>,
  options: PiAgentStreamOptions = {},
): ReadableStream<Uint8Array> {
  const heartbeatMs = options.heartbeatMs ?? PI_AGENT_HEARTBEAT_MS;
  const encoder = new TextEncoder();
  let beat: ReturnType<typeof setInterval> | null = null;
  let open = true;
  const stop = () => {
    open = false;
    if (beat) { clearInterval(beat); beat = null; }
  };
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (event: PiAgentEvent) => {
        if (!open) return;
        // 인코딩 실패(JSON.stringify 가 던짐 — 순환·BigInt·너무 큰 값)와 스트림 닫힘(enqueue 가 던짐)은 다르다. 앞의 것까지 stop() 하면 heartbeat 도 영구히
        // 멎어 호스트가 본문 무음 300초(undici bodyTimeout)로 «terminated» 를 낸다(2026-11-09 monster 진단: 약 226초 뒤 이벤트·heartbeat 가 함께 0, 대형 프로젝트).
        let line: Uint8Array;
        try { line = encoder.encode((options.encodeEvent ?? encodePiAgentEvent)(event)); }
        catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          const type = String((event as { type?: unknown }).type);
          console.error(`[pi-agent-stream] event could not be encoded: type=${type} reason=${reason}`);
          // 모델·사용자에게 «줄이 빠졌다» 를 알린다 — 조용히 버리면 결과가 말없이 달라진다. 이 줄은 작고 단순해(문자열 둘) 인코딩이 다시 실패하지 않는다.
          try { controller.enqueue(encoder.encode(`{"type":"error","message":"worker dropped an event (${type.replace(/[^a-z_.-]/giu, "")}) that could not be encoded: ${reason.replace(/["\\\n\r]/gu, " ").slice(0, 160)}"}\n`)); } catch { stop(); }
          return;
        }
        try { controller.enqueue(line); } catch { stop(); }
      };
      let lastBeat = Date.now();
      beat = setInterval(() => {
        const now = Date.now();
        // 진단: 이 타이머가 예정보다 한참 늦게 돌아왔다 = 그 사이 동기 작업이 워커 이벤트 루프를 막았다.
        if (now - lastBeat > heartbeatMs + 2_000) console.error(`[pi-agent-stream] event loop blocked ${Math.round((now - lastBeat) / 1000)}s (heartbeat due ${Math.round(heartbeatMs / 1000)}s)`);
        lastBeat = now;
        write({ type: "heartbeat", at: now });
      }, heartbeatMs);
      run(write)
        .catch((error) => write({ type: "error", message: error instanceof Error ? error.message : String(error) }))
        .finally(() => {
          stop();
          try { controller.close(); } catch { /* 이미 닫힘 */ }
        });
    },
    cancel() {
      stop();
    },
  });
}
