// 모델 스트림 조각(thinking/text delta)을 짧은 간격으로 합쳐 `delta` 이벤트로 내보낸다.
//
// 왜 필요한가 (2026-09-14): pi-agent-core 는 모델을 스트리밍으로 부르고 델타마다 `message_update` 를
// 내는데, 우리 런타임은 턴·툴·응답 끝 네 가지만 중계하고 이 이벤트를 버렸다. 그래서 모델이 생각하는
// 동안 브라우저까지의 와이어가 완전히 비었고, 유휴 타임아웃이 그 침묵을 끊었다. 토큰마다 줄을 쓰면
// NDJSON 이 수천 줄이 되므로 여기서 합친다.
//
// 순서 계약: 다른 종류(thinking→text)가 들어오면 앞의 것을 먼저 비운다. 호출자는 턴 시작·툴 호출·응답 끝
// 직전에 flush() 를 불러 «조각이 완성문 뒤에 도착» 하는 역전을 막는다.

import type { PiAgentEvent } from "./protocol";
import { PI_AGENT_DELTA_FLUSH_MS } from "./protocol";

export type PiDeltaEvent = Extract<PiAgentEvent, { type: "delta" }>;
export type PiDeltaKind = PiDeltaEvent["kind"];

export interface DeltaRelay {
  push(kind: PiDeltaKind, text: string): void;
  /** 쌓인 조각을 지금 내보낸다. 빈 버퍼면 아무 일도 없다. */
  flush(): void;
  /** 타이머를 정리하고 남은 조각을 내보낸다. 실행이 끝날 때 한 번. */
  dispose(): void;
}

export interface DeltaRelayOptions {
  readonly flushMs?: number;
  /** 한 이벤트에 실을 최대 글자. 넘치면 간격을 기다리지 않고 바로 비운다. */
  readonly maxChars?: number;
}

export function createDeltaRelay(emit: (event: PiDeltaEvent) => void, options: DeltaRelayOptions = {}): DeltaRelay {
  const flushMs = options.flushMs ?? PI_AGENT_DELTA_FLUSH_MS;
  const maxChars = options.maxChars ?? 2_000;
  let kind: PiDeltaKind | null = null;
  let buffer = "";
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = (): void => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (kind === null || !buffer) { kind = null; buffer = ""; return; }
    const event: PiDeltaEvent = { type: "delta", kind, text: buffer };
    kind = null;
    buffer = "";
    emit(event);
  };

  return {
    push(nextKind, text) {
      if (!text) return;
      if (kind !== null && kind !== nextKind) flush();
      kind = nextKind;
      buffer += text;
      if (buffer.length >= maxChars) { flush(); return; }
      if (!timer) timer = setTimeout(flush, flushMs);
    },
    flush,
    dispose() {
      flush();
    },
  };
}
