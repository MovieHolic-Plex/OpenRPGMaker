// electron/shared/updates.ts
// 데스크톱 업데이트 상태 — 메인(electron/main/updates.ts)과 렌더러(src/editor/whatsNew/*)가 같은 모양을 쓴다.
//
// 업데이트 파일은 **설정한 주소**(OPRN_UPDATE_URL)에서 받는다. 저장소가 비공개라 앱이 GitHub Release 를
// 토큰 없이 읽을 수 없어서다. 주소가 없는 빌드는 확인하지 않고 릴리스 페이지 링크만 보인다.
// 절차·결정은 openwiki/release-and-version.md 「앱 안 새 소식과 업데이트」.
//
// 이 파일은 node 가 .ts 를 그대로 읽는 곳(electron-builder 설정)에서도 import 된다 — 지울 수 있는 타입 문법만 쓴다.

/** 사람이 새 버전을 내려받는 곳. 비공개 저장소라 팀원만 열린다. */
export const OPRN_RELEASES_URL = "https://github.com/MovieHolic-Plex/rpg-zzu/releases";

/** electron-builder 가 AppImage 옆에 만드는 채널 파일. 모든 OS 가 같은 태그에서 나오므로 버전 확인은 이 파일 하나로 한다. */
export const UPDATE_CHANNEL_FILE = "latest-linux.yml";

export type UpdateStatus =
  /** 확인하지 않는다. dev = 패키지 안 된 개발 실행, unconfigured = 업데이트 주소 없이 만든 빌드. */
  | { readonly kind: "unavailable"; readonly reason: "dev" | "unconfigured"; readonly releasesUrl: string }
  | { readonly kind: "idle"; readonly checkedAt: string | null; readonly releasesUrl: string }
  | { readonly kind: "checking"; readonly releasesUrl: string }
  | { readonly kind: "downloading"; readonly version: string; readonly percent: number; readonly releasesUrl: string }
  /** 받아 두었다. 다시 시작하면 적용된다(리눅스 AppImage 만). */
  | { readonly kind: "ready"; readonly version: string; readonly releasesUrl: string }
  /** 새 버전이 있지만 이 설치 방식은 스스로 바꿀 수 없다(윈도우 zip·서명 없는 맥·AppImage 밖 실행). */
  | { readonly kind: "manual"; readonly version: string; readonly downloadUrl: string; readonly releasesUrl: string }
  | { readonly kind: "error"; readonly message: string; readonly releasesUrl: string };

export type UpdateCheckResult = { readonly status: UpdateStatus };

/** 렌더러가 preload 로 받는 표면. 브라우저 로컬 서버(팀 호스트) 브리지에는 없다. */
export type OprnUpdatesBridge = {
  status(): Promise<UpdateStatus>;
  check(): Promise<UpdateStatus>;
  /** 받아 둔 업데이트를 적용하며 다시 시작한다. 저장은 호출하는 쪽이 먼저 끝낸다. */
  install(): Promise<boolean>;
  onStatus(callback: (status: UpdateStatus) => void): () => void;
};

/**
 * 업데이트 주소를 검사한다. https 만 받고, 시험용으로 루프백 http 는 허용한다.
 * 이 주소가 곧 «이 앱에서 실행될 코드의 출처» 라서 평문 원격 주소를 받지 않는다.
 */
export function normalizeFeedUrl(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) return null;
  if (url.username || url.password) return null;
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/+$/, "");
}

/** 릴리스 페이지 주소 덮어쓰기(https 만). 잘못된 값이면 기본값. */
export function normalizeReleasesUrl(raw: unknown): string {
  if (typeof raw !== "string") return OPRN_RELEASES_URL;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" ? url.toString().replace(/\/+$/, "") : OPRN_RELEASES_URL;
  } catch {
    return OPRN_RELEASES_URL;
  }
}

export function releaseTagUrl(releasesUrl: string, version: string): string {
  return `${releasesUrl}/tag/v${encodeURIComponent(version)}`;
}

/** 채널 파일(latest-linux.yml)의 `version:` 줄. 없거나 semver 가 아니면 null. */
export function parseChannelVersion(yml: string): string | null {
  const match = /^version:\s*['"]?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)['"]?\s*$/m.exec(String(yml ?? ""));
  return match ? match[1] : null;
}

type ParsedVersion = { readonly core: readonly [number, number, number]; readonly pre: string | null };

function parseVersion(value: string): ParsedVersion | null {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(value ?? "").trim());
  if (!match) return null;
  return { core: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] ?? null };
}

/**
 * semver 비교. a 가 크면 양수. 해석 못 하는 쪽은 가장 작게 본다.
 * 프리릴리스(`0.40.0-dev.3`)는 같은 코어의 정식판보다 작다 — 개발 빌드가 정식판 알림을 받는다.
 */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return left ? 1 : right ? -1 : 0;
  for (let i = 0; i < 3; i += 1) {
    const diff = left.core[i]! - right.core[i]!;
    if (diff !== 0) return diff;
  }
  if (left.pre === right.pre) return 0;
  if (left.pre === null) return 1;
  if (right.pre === null) return -1;
  return left.pre < right.pre ? -1 : 1;
}

export function isNewerVersion(candidate: string, current: string): boolean {
  return compareVersions(candidate, current) > 0;
}
