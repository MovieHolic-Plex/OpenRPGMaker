// player/preloadedAudio.ts
// 웹 판본이 시작 전에 받아 쥔 소리 파일(원래 주소 → blob 주소). scenePreload.ts 가 채우고, 소리 엔진·오프닝 음악이 읽는다.
// 의존 없는 잎 모듈이다 — 소리 엔진(편집기 테스트 플레이도 쓴다)이 미리 받기 모듈 전체를 끌어오지 않게 따로 둔다.
const retained = new Map<string, string>();

export function retainPreloadedAudio(url: string, blobUrl: string): void {
  retained.set(url, blobUrl);
}

/** 미리 받아 쥐고 있는 소리면 그 blob 주소, 아니면 null. */
export function preloadedAudioUrl(url: string): string | null {
  return retained.get(url) ?? null;
}
