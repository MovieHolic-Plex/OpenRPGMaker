// assets/installedStillPack.ts
// 오프닝 스틸 릴리스 팩(oprn-pack-still-*)이 이 설치에 실제로 있는지. installedBgm.ts 와 같은 계약이다.
//
// 왜: 팩 그림은 레포에 없고 `npm run stills:install` 이 public/assets/stills/pack/ 에 푼다. 설치 전에는
// 조수가 목록에서 팩 스틸을 골라 타이틀·오프닝에 깔아도 편집기·플레이에서 그림이 404 로 비고, 웹 내보내기는
// runtime-asset-unavailable 로 실패한다(2026-10-26 확인: 새 체크아웃·이 박스의 메인 체크아웃 모두 미설치, CDN 미설정).
// 그래서 조수와 고르기 목록은 설치된(또는 CDN 이 설정된) 팩 스틸만 보인다.
//
// Vite 플러그인(scripts/lib/stillPackDelivery.ts)이 설치된 파일명을 주입한다. 헤드리스 도구는 define 이 없으므로
// 실행기가 디스크에서 읽어 setInstalledStillPackFiles 로 시드한다(scripts/lib/piWorkerAudio.ts). 둘 다 없으면(플레이어 번들 등)
// 모두 있다고 본다 — 플레이어는 이 판정을 쓰지 않는다.
import { findOpeningStillPackEntry, listOpeningStillPackIds } from "./openingStillPackRuntime";
import { stillCdnBase } from "./openingStillPackCdn";

declare const __OPRN_INSTALLED_STILL_FILES__: readonly string[] | undefined;

let runtimeInstalled: ReadonlySet<string> | null = null;

/** 설치 결과를 반영한다. null 은 빌드타임 시드로 복귀. */
export function setInstalledStillPackFiles(names: readonly string[] | null): void {
  runtimeInstalled = names === null ? null : new Set(names);
}

function isStillFileInstalled(fileName: string): boolean {
  if (runtimeInstalled) return runtimeInstalled.has(fileName);
  return typeof __OPRN_INSTALLED_STILL_FILES__ === "undefined"
    || __OPRN_INSTALLED_STILL_FILES__.includes(fileName);
}

/** 팩 스틸이 아니면 true. 팩 스틸이면 CDN 이 설정됐거나 파일이 설치돼 있을 때만 true. */
export function isOpeningStillAvailable(resourceId: string): boolean {
  const entry = findOpeningStillPackEntry(resourceId);
  return !entry || stillCdnBase() !== null || isStillFileInstalled(entry.fileName);
}

/** 팩 스틸이 하나라도 빠졌으면 false — 실행기는 이때만 참조 검사를 돈다. */
export function allOpeningStillsAvailable(): boolean {
  return listOpeningStillPackIds().every(isOpeningStillAvailable);
}

/** 조수에게 돌려줄 거절 문구. 쓸 수 있으면 null. */
export function unavailableOpeningStillMessage(resourceId: string, field: string): string | null {
  if (isOpeningStillAvailable(resourceId)) return null;
  return `${field} '${resourceId}' 는 이 설치에 그림 파일이 없는 스틸 팩 그림입니다(npm run stills:install 전). `
    + "편집기·게임에서 빈 화면이 되고 내보내기가 실패하므로 쓸 수 없습니다. "
    + "list_opening_media·list_resources 가 보여 주는 그림(예: oprn-still-* 번들 스틸)으로 바꾸세요.";
}
