// player/audio/audioQueue.ts
// 순수 자동재생 큐 상태머신. 브라우저 자동재생 정책상 사용자 첫 입력(unlock) 전에
// 재생 요청이 오면 큐잉했다가 unlock 시 순서대로 방출한다.
// 루프 채널은 최신 요청만 유지(교체), 원샷 채널은 순서대로 누적.

import type { AudioChannel } from "@/project/session";
import { isLoopingChannel } from "./audioResources";

export interface AudioRequest {
  readonly channel: AudioChannel;
  readonly resourceId: string;
  readonly url: string;
  readonly loop: boolean;
  // 이 요청의 페이드인 길이(ms). 없으면 엔진 기본값. 언락 대기 중에도 보존돼야
  // 방출 시점의 페이드가 요청 시점의 의도와 같다.
  readonly fadeInMs?: number;
}

export interface AudioQueueState {
  unlocked: boolean;
  // 루프 채널별 대기 중인 최신 요청(채널당 1개).
  loopPending: Partial<Record<AudioChannel, AudioRequest>>;
  // 원샷(me/se) 대기 요청. 방출 순서 보존.
  oneShotPending: AudioRequest[];
}

// unlock 시 루프 채널을 방출하는 안정 순서.
const LOOP_FLUSH_ORDER: readonly AudioChannel[] = ["bgm", "bgs"];

export function createAudioQueueState(): AudioQueueState {
  return { unlocked: false, loopPending: {}, oneShotPending: [] };
}

// 재생 요청. unlock 상태면 즉시 재생(immediate), 아니면 큐에 적재하고 immediate=null.
// 큐 적재는 상태를 불변으로 갱신한 새 state 를 반환한다.
export function requestAudio(
  state: AudioQueueState,
  request: AudioRequest
): { state: AudioQueueState; immediate: AudioRequest | null } {
  if (state.unlocked) {
    return { state, immediate: request };
  }
  if (isLoopingChannel(request.channel)) {
    return {
      state: {
        ...state,
        loopPending: { ...state.loopPending, [request.channel]: request },
      },
      immediate: null,
    };
  }
  return {
    state: { ...state, oneShotPending: [...state.oneShotPending, request] },
    immediate: null,
  };
}

// 사용자 입력으로 잠금 해제. 대기 큐를 순서대로(루프 채널 → 원샷) 방출하고 비운다.
export function unlockQueue(state: AudioQueueState): { state: AudioQueueState; flushed: AudioRequest[] } {
  const flushed: AudioRequest[] = [];
  for (const channel of LOOP_FLUSH_ORDER) {
    const pending = state.loopPending[channel];
    if (pending) flushed.push(pending);
  }
  flushed.push(...state.oneShotPending);
  return {
    state: { unlocked: true, loopPending: {}, oneShotPending: [] },
    flushed,
  };
}

// 대기 큐만 비운다(unlock 상태는 유지). 정지/전체 정리 시 사용.
export function clearPending(state: AudioQueueState): AudioQueueState {
  return { unlocked: state.unlocked, loopPending: {}, oneShotPending: [] };
}
