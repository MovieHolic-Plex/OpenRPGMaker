// ai/pageFreezeGuard.ts
// 턴이 도는 동안 탭이 얼지 않게 Web Lock 을 하나 쥐고 있는다.
//
// 왜 필요한가 (2026-09-09 조사): 사용자가 조수를 돌려 두고 다른 탭·앱으로 넘어가면 진행이
// **완전히** 멈췄다. 원인 후보를 코드와 실측으로 하나씩 지웠다.
//   - 포커스: `yieldToUi.ts` 가 이미 비포커스를 감지해 MessageChannel 로 빠진다. 실측(헤드풀
//     크롬, 원본 모듈 주입)에서 포커스가 없을 때 툴 루프가 60/s → 26,000/s 로 **빨라졌다**.
//     포커스 손실은 원인이 아니다.
//   - 백그라운드 타이머 스로틀: 패널 턴 루프에는 타이머가 없다(재시도 백오프뿐). 느려질 수는
//     있어도 완전 정지는 설명하지 못한다.
//   - 남은 것: 크롬 메모리/에너지 세이버의 **탭 freeze**. 얼면 JS 가 통째로 서므로 fetch 기반
//     루프도 같이 죽는다. `yieldToUi.ts` 주석이 "탭 자체의 freeze/discard 는 별개다" 로 범위
//     밖이라 적어 둔 바로 그 구멍이다.
//
// 크롬은 Web Lock 을 쥔 페이지를 freeze 대상에서 제외한다. 그래서 턴 수명에만 딱 맞춰 락을
// 잡았다 놓는다. 무음 오디오 같은 우회는 탭에 소리 표시가 뜨고 자동재생 정책에 걸려 쓰지 않았다.
//
// 이 가드는 **어디까지나 keep-alive 다**. 락을 못 잡아도 턴은 그대로 진행해야 한다 — 획득을
// 기다리지 않고 즉시 해제 함수를 돌려주는 이유다. 여기서 턴을 볼모로 잡으면 고치려던 정지를
// 우리 손으로 만드는 셈이다.

export type ReleaseFreezeGuard = () => void;
export type FreezeGuard = () => Promise<ReleaseFreezeGuard>;

export const FREEZE_GUARD_LOCK_PREFIX = "oprn:ai-run";

const NOOP: ReleaseFreezeGuard = () => {};

type LockManagerLike = {
  readonly request: (name: string, callback: () => Promise<unknown>) => unknown;
};

/** 턴마다 고유 이름을 쓴다. 이름이 같으면 두 번째 턴이 첫 턴 해제까지 대기해 스스로 멈춘다. */
let lockSeq = 0;

function lockManager(): LockManagerLike | undefined {
  const nav = (globalThis as { navigator?: { locks?: LockManagerLike } }).navigator;
  const locks = nav?.locks;
  return typeof locks?.request === "function" ? locks : undefined;
}

export function defaultFreezeGuard(): Promise<ReleaseFreezeGuard> {
  const locks = lockManager();
  if (!locks) return Promise.resolve(NOOP);

  lockSeq += 1;
  const name = `${FREEZE_GUARD_LOCK_PREFIX}:${lockSeq}`;

  let finishHolding: () => void = NOOP;
  const holding = new Promise<void>((resolve) => {
    finishHolding = resolve;
  });
  let released = false;
  const release: ReleaseFreezeGuard = () => {
    if (released) return;
    released = true;
    finishHolding();
  };

  try {
    // 획득을 await 하지 않는다. 콜백이 도는 동안 락을 쥐고, release 가 그 콜백을 끝낸다.
    void Promise.resolve(locks.request(name, () => holding)).catch(release);
  } catch {
    return Promise.resolve(NOOP);
  }
  return Promise.resolve(release);
}
