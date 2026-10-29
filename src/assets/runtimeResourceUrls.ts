// 플레이어가 실행 중에 그려 만든 그림의 주소(예: 타이틀 배경 opening-still:<컷>@<ms>).
// 그림 파일이 없는 가상 리소스라 resolveAssetResourceUrl 이 여기서 찾는다. 아직 그리지 않았으면 null.
const urls = new Map<string, string>();

export function registerRuntimeResourceUrl(resourceId: string, url: string): void {
  urls.set(resourceId, url);
}

export function runtimeResourceUrl(resourceId: string): string | null {
  return urls.get(resourceId) ?? null;
}
