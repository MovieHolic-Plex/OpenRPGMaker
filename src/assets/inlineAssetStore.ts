/**
 * 단일 HTML(스탠드얼론) 플레이어용 에셋 대체 표.
 *
 * `file://` 에서는 옆에 놓인 파일도 못 읽는다(출처가 null 이라 fetch·XHR 이 막힌다). 그래서
 * 스탠드얼론 빌드는 게임이 쓰는 public 에셋을 전부 data URL 로 HTML 안에 넣고, 실행 중
 * `/assets/...` 같은 경로가 나오면 여기서 data URL 로 바꿔치기한다.
 *
 * **호출부가 아니라 URL 을 만드는 쪽에서 막는다.** 소비처는 13곳이 넘지만(Phaser load.image,
 * new Image().src, new Audio(url) …) 생산자는 셋뿐이다 — resolveAssetResourceUrl, bundled.ts 의
 * 경로 상수, 그리고 CSS 의 폰트 url(빌드 때 치환).
 *
 * 편집기는 원래 경로를 유지한다. 내보내기 플레이어만 게임 디렉터리를 등록해
 * 루트 경로로 저작된 public 에셋도 게임이 배포된 위치에서 찾는다.
 */
let inlineSources = new Map<string,string>();
let table: Readonly<Record<string, string>> | null = null;
let exportAssetBase: URL | null = null;

export function registerExportAssetBase(base: URL | null): void {
  exportAssetBase = base;
}

/** null 을 주면 표를 걷어낸다 — 일반 빌드와 같은 상태로 되돌린다. */
export function registerInlineAssets(map: Readonly<Record<string, string>> | null): void {
  table = map;
  inlineSources = new Map(Object.entries(map??{}).map(([path,url])=>[url,normalizeAssetKey(path)]));
}

export function hasInlineAssets(): boolean {
  return table !== null;
}

/**
 * `/assets/x.png`, `assets/x.png`, `./assets/x.png` 를 같은 키로 본다.
 * data URL·절대 URL 은 그대로 두어야 하므로 null 을 돌려준다.
 */
export function inlineAssetUrl(pathOrUrl: string | null | undefined): string | null {
  if (table === null || typeof pathOrUrl !== "string" || pathOrUrl === "") return null;
  if (pathOrUrl.startsWith("data:") || pathOrUrl.includes("://")) return null;
  return table[normalizeAssetKey(pathOrUrl)] ?? null;
}

/** 내장 에셋을 우선하고, 웹 내보내기의 public 경로만 게임 디렉터리로 옮긴다. */
export function withInlineAsset(pathOrUrl: string): string {
  const embedded = inlineAssetUrl(pathOrUrl);
  if (embedded !== null) return embedded;
  if (exportAssetBase === null || !/^(?:\.\/|\/)?assets\//.test(pathOrUrl)) return pathOrUrl;
  return new URL(normalizeAssetKey(pathOrUrl), exportAssetBase).href;
}

export function normalizeAssetKey(pathOrUrl: string): string {
  return pathOrUrl.replace(/^\.?\//, "");
}

/** Original source key for geometry metadata when a standalone export uses blob/data URLs. */
export function inlineAssetSource(url:string):string|undefined {return inlineSources.get(url);}
