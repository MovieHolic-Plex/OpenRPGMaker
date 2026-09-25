// 바로 깔기 켜짐/꺼짐 — 조수 입력줄 토글과 우클릭 드래그 바 토글이 같은 값을 본다.
// 한쪽에서 켜고 다른 쪽에서 보내면 모드가 어긋나 「분명 켰는데 조수가 계획부터 세운다」가 된다.
const STAMP_PLACE_KEY = "oprn:ai-stamp-place";

type Listener = (on: boolean) => void;
const listeners = new Set<Listener>();
let cached: boolean | null = null;

function storage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function isStampPlaceOn(): boolean {
  if (cached === null) cached = storage()?.getItem(STAMP_PLACE_KEY) === "1";
  return cached;
}

export function setStampPlaceOn(on: boolean): void {
  if (isStampPlaceOn() === on) return;
  cached = on;
  try {
    storage()?.setItem(STAMP_PLACE_KEY, on ? "1" : "0");
  } catch {
    // 저장 실패(사생활 모드)는 이번 세션 값만 유지한다.
  }
  for (const listener of [...listeners]) listener(on);
}

export function subscribeStampPlace(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 테스트 전용 — 모듈 캐시를 비운다. */
export function resetStampPlaceModeForTest(): void {
  cached = null;
  listeners.clear();
}
