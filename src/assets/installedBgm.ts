// Vite 가 설치된 팩 파일명을 주입한다. 헤드리스 메타데이터 도구에는 배포가 없어 define 도 없다.
declare const __OPRN_INSTALLED_BGM_FILES__: readonly string[] | undefined;

// 빌드타임 define 은 *부팅 시드* 다. 에디터가 팩 설치를 끝내면 런타임 값이 이를 대체해서
// 개발 서버를 재시작하지 않아도 판정이 바뀐다. null 이면 시드로 되돌아간다.
let runtimeInstalled: ReadonlySet<string> | null = null;
// 대표 데모를 브라우저에서 직접 지을 때만 켠다. 데모 굽기(bake:demos)는 define 이 없어 모든 곡을 «설치됨»으로 보고
// 짓는다 — 같은 빌더를 편집기 안에서 돌릴 때도 같아야 한다. 아니면 기본 3곡만 든 데스크톱 앱에서
// 「미설치 BGM」으로 빌더가 죽는다(2026-10-27 폴른 스타 «데모를 열지 못했습니다»).
let assumeAllDepth = 0;

/** fn 을 도는 동안 모든 카탈로그 곡을 설치된 것으로 본다(동기 빌더 전용). */
export function withAllBgmAssumedInstalled<T>(fn: () => T): T {
  assumeAllDepth += 1;
  try {
    return fn();
  } finally {
    assumeAllDepth -= 1;
  }
}

/** 설치 결과를 반영한다. null 은 빌드타임 시드로 복귀. */
export function setInstalledBgmFiles(names: readonly string[] | null): void {
  runtimeInstalled = names === null ? null : new Set(names);
}

export function isBgmFileInstalled(fileName: string): boolean {
  if (assumeAllDepth > 0) return true;
  if (runtimeInstalled) return runtimeInstalled.has(fileName);
  // 시드는 매 호출마다 읽는다 — 모듈 로드 시점에 붙잡아 두면 테스트의 stubGlobal 이 무력해진다.
  return typeof __OPRN_INSTALLED_BGM_FILES__ === "undefined"
    || __OPRN_INSTALLED_BGM_FILES__.includes(fileName);
}
