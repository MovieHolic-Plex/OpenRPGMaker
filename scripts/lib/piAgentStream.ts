// /agent/run 의 NDJSON 응답 본문. 실행 이벤트를 한 줄씩 쓰고, 줄 사이가 비면 heartbeat 를 끼운다.
//
// 진행 이벤트만으로는 모델이 생각하는 동안 와이어가 비고, 그 침묵을 유휴 타임아웃 층이 끊는다
// (실측 2026-09-14). 이 스트림은 무슨 일이 있어도 PI_AGENT_HEARTBEAT_MS 안에 한 줄은 쓴다.

import { encodePiAgentEvent, PI_AGENT_HEARTBEAT_MS, type PiAgentEvent } from "../../src/ai/piAgent/protocol.ts";

export interface PiAgentStreamOptions {
  readonly heartbeatMs?: number;
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
        try { controller.enqueue(encoder.encode(encodePiAgentEvent(event))); } catch { stop(); }
      };
      beat = setInterval(() => write({ type: "heartbeat", at: Date.now() }), heartbeatMs);
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
