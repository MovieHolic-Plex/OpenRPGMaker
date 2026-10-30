// 결정 키 연타가 뒤이어 뜬 「고르는 창」(선택지·숫자 입력)으로 새지 않게 하는 공용 판정.
//
// 결함(회귀 벤치 ebfe-sl 방탈출·추리 sl3 terra, 판정자 A8 「Enter 10번」): 대사를 넘기려고 연타한 Enter 가
// 뒤이어 열린 선택지의 0번(오답)을 저절로 골랐다. 부하가 걸린 판에서는 연타 간격이 250~400ms 로 벌어져
// 「열린 뒤 300ms 유예」만으로는 못 막았다.
//
// 규칙(고르는 창이 받는 결정 키 하나마다):
//   1) 창이 열리기 전에, 또는 열린 뒤 OPEN_GRACE_MS 안에 「누른」 결정 키는 버린다(누른 시각 = event.timeStamp —
//      창을 그리느라 주 스레드가 막혀 늦게 배달된 키도 누른 시각으로 잰다).
//   2) 바로 앞 결정 키에서 MASH_GAP_MS 안에 다시 누른 결정 키는 연타의 일부로 보고 버린다. 버린 키도 다음 판단의
//      「바로 앞」이 되므로, 손을 멈췄다가 새로 누른 한 번만 결정이 된다. 그 사이에 다른 키(방향·숫자)를 눌렀으면
//      연타가 아니다 — 커서를 옮기고 바로 고르는 손은 막지 않는다.
//   3) 누른 채 반복(event.repeat)은 각 창이 따로 버린다(떼었다 다시 누른 것만 새 결정).
//
// 판정 대상은 플레이어 입력뿐이다: 실제 키(isTrusted)와 게임패드·가상 패드가 보낸 합성 키(markPlayerPadKey).
// 단위 테스트가 보내는 합성 키는 표시가 없어 그대로 지나간다. 대사 넘기기는 이 판정을 쓰지 않는다 — 연타로 대사를
// 빨리 넘기는 것은 정상 동작이고, 넘기기에 지연을 두지 않는다.

import { isConfirmKey, keyboardEventKey } from "@/player/keyBindings";

/** 창이 열린 뒤 결정 키를 받지 않는 시간. */
export const OPEN_GRACE_MS = 300;
/**
 * 결정 키 연타가 멈췄다고 보는 틈. 사람 손 연타는 초당 4~10번(100~250ms)이고 부하가 걸리면 배달이 250~400ms 로 벌어진다.
 * 선택지를 읽고 고르는 데는 이보다 오래 걸린다.
 */
export const MASH_GAP_MS = 450;

const padKeyEvents = new WeakSet<Event>();

/** 게임패드·가상 패드가 보내는 합성 키에 「플레이어 입력」 표시를 단다. dispatch 전에 부른다. */
export function markPlayerPadKey<E extends Event>(event: E): E {
  padKeyEvents.add(event);
  return event;
}

/** 실제 키보드 또는 패드가 보낸 플레이어 입력인가. */
export function isPlayerKeyInput(event: Event): boolean {
  return event.isTrusted || padKeyEvents.has(event);
}

let previousConfirmDownAt = Number.NEGATIVE_INFINITY;
let latestConfirmDownAt = Number.NEGATIVE_INFINITY;
let latestOtherKeyDownAt = Number.NEGATIVE_INFINITY;
let trackerInstalled = false;

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta", "CapsLock", "Process", "Unidentified"]);

/**
 * 플레이어가 결정 키·다른 키를 누른 시각을 기록한다. 창(window) 캡처 단계라 어느 창이 키를 삼켜도 놓치지 않는다.
 * 여러 번 불러도 한 번만 건다.
 */
export function installConfirmPressTracker(): void {
  if (trackerInstalled || typeof window === "undefined") return;
  trackerInstalled = true;
  window.addEventListener("keydown", (event) => {
    if (event.repeat || !isPlayerKeyInput(event)) return;
    const key = keyboardEventKey(event);
    if (isConfirmKey(key)) {
      previousConfirmDownAt = latestConfirmDownAt;
      latestConfirmDownAt = event.timeStamp;
    } else if (!MODIFIER_KEYS.has(key)) {
      latestOtherKeyDownAt = event.timeStamp;
    }
  }, true);
}

/**
 * 이 결정 키(keydown)가 앞 화면에서 이어진 연타라 고르는 창이 버려야 하는가.
 * `openedAt` 은 창이 열린 performance.now(). 플레이어 입력이 아니거나 결정 키가 아니면 false.
 */
export function isLeakedConfirmPress(event: KeyboardEvent, openedAt: number): boolean {
  if (event.repeat || !isPlayerKeyInput(event) || !isConfirmKey(keyboardEventKey(event))) return false;
  if (event.timeStamp - openedAt < OPEN_GRACE_MS) return true;
  // 추적기가 이 키를 이미 기록했다면 previous 가 바로 앞 결정 키다. (추적기가 없으면 latest 가 바로 앞이다.)
  const before = latestConfirmDownAt === event.timeStamp ? previousConfirmDownAt : latestConfirmDownAt;
  if (latestOtherKeyDownAt > before) return false;
  return event.timeStamp - before < MASH_GAP_MS;
}
