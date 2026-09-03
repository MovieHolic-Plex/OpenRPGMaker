// util/pendingWork.ts
// 화면이 띄운 비동기 작업(저장·복원·목록 갱신)을 모아 «지금 떠 있는 게 없다» 를 기다릴 수 있게 한다.
//
// 왜: 대화 기록이 IndexedDB(비동기)로 가면서 패널·모달의 저장/복원이 fire-and-forget 이 됐다. 테스트와
// 헤드리스 하네스는 «렌더 직후» 가 아니라 «정착 뒤» 를 봐야 하는데, setTimeout 폴링은 흔들린다.
// 작업을 등록해 두면 정확히 그 순간을 기다릴 수 있다. 실패한 작업도 정착으로 친다(호출자가 처리한다).
export interface PendingWorkTracker {
  /** 작업을 등록하고 그대로 돌려준다 — `void track(save())` 로 쓴다. */
  track<T>(work: Promise<T>): Promise<T>;
  /** 등록된 작업이 모두 끝날 때까지 기다린다. 기다리는 동안 새로 등록된 작업도 포함한다. */
  settled(): Promise<void>;
  readonly size: number;
}

export function createPendingWorkTracker(): PendingWorkTracker {
  const pending = new Set<Promise<unknown>>();
  return {
    track<T>(work: Promise<T>): Promise<T> {
      const entry: Promise<unknown> = work.then(
        () => undefined,
        () => undefined,
      ).finally(() => pending.delete(entry));
      pending.add(entry);
      return work;
    },
    async settled(): Promise<void> {
      while (pending.size > 0) await Promise.all(Array.from(pending));
    },
    get size() {
      return pending.size;
    },
  };
}
