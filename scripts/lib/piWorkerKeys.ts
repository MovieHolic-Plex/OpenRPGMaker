// 실행 중인 Pi 실행들이 쥔 요청 키 묶음. 호스트가 새 키를 밀어 넣으면 진행 중인 실행이 다음 모델 요청부터 그 키를 쓴다.
//
// 왜(2026-10-05 스트레스 실측): 호스트는 실행 시작 때 키를 한 번 풀어 넘긴다(남은 수명 ≥15분 보장). 팀 실행은 흔히 그보다
// 길다 — 「마을·들판·동굴」 팀 실행 18분 40초째 팀장 요청이 pi-ai 의 「OAuth token expired before request」로 끝났고,
// 팀장이 죽은 채 실행이 35분 상한까지 걸렸다. 워커에는 인증이 없으므로(oh-my-pi-worker.ts 머리말) 갱신은 호스트가 하고 밀어 준다.
type KeyRing = Record<string, string | undefined>;

const live = new Set<KeyRing>();

/** 실행 하나의 키 묶음을 등록한다. 돌려준 객체를 실행 옵션의 providerApiKeys 로 넘기고, 끝나면 release 한다. */
export function holdWorkerKeys(providerApiKeys: KeyRing | undefined, provider: string | undefined, apiKey: string | undefined): { keys: KeyRing; release: () => void } {
  const keys: KeyRing = { ...(providerApiKeys ?? {}) };
  if (provider && apiKey && !keys[provider]) keys[provider] = apiKey;
  live.add(keys);
  return { keys, release: () => { live.delete(keys); } };
}

/** 호스트가 갱신한 키를 진행 중인 실행에 반영한다. 실행이 이미 쓰던 제공자만 바꾼다(새 제공자를 끼워 넣지 않는다). */
export function refreshWorkerKeys(fresh: KeyRing): number {
  let updated = 0;
  for (const keys of live) {
    for (const [provider, key] of Object.entries(fresh)) {
      if (typeof key === "string" && key && provider in keys && keys[provider] !== key) { keys[provider] = key; updated += 1; }
    }
  }
  return updated;
}

export function liveWorkerKeyRings(): number { return live.size; }
