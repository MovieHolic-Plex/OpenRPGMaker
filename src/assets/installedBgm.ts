// Vite 가 설치된 팩 파일명을 주입한다. 헤드리스 메타데이터 도구에는 배포가 없어 define 도 없다.
declare const __OPRN_INSTALLED_BGM_FILES__: readonly string[] | undefined;

// 빌드타임 define 은 *부팅 시드* 다. 에디터가 팩 설치를 끝내면 런타임 값이 이를 대체해서
// 개발 서버를 재시작하지 않아도 판정이 바뀐다. null 이면 시드로 되돌아간다.
let runtimeInstalled: ReadonlySet<string> | null = null;

/** 설치 결과를 반영한다. null 은 빌드타임 시드로 복귀. */
export function setInstalledBgmFiles(names: readonly string[] | null): void {
  runtimeInstalled = names === null ? null : new Set(names);
}

export function isBgmFileInstalled(fileName: string): boolean {
  if (runtimeInstalled) return runtimeInstalled.has(fileName);
  // 시드는 매 호출마다 읽는다 — 모듈 로드 시점에 붙잡아 두면 테스트의 stubGlobal 이 무력해진다.
  return typeof __OPRN_INSTALLED_BGM_FILES__ === "undefined"
    || __OPRN_INSTALLED_BGM_FILES__.includes(fileName);
}
