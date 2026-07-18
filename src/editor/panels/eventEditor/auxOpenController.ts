// 이벤트 에디터 하단 보조 패널(AI / 미리보기 / 플로우) 배타 아코디언.
// 스키마 프리즈: open-state 는 EventPage 가 아니라 모듈 캐시만 소유한다.
// 키는 mapId:eventId:pageId 합성 키.

export type AuxWhich = "ai" | "preview" | "flow";

const openByKey = new Map<string, AuxWhich | null>();
const hostsByKey = new Map<string, Partial<Record<AuxWhich, HTMLDetailsElement>>>();

// details.open 프로그래밍 설정 시 toggle 핸들러 재진입 방지.
let applyingOpen = false;

export function auxCompositeKey(mapId: string, eventId: string, pageId: string): string {
  return `${mapId}:${eventId}:${pageId}`;
}

export function getAuxOpen(key: string): AuxWhich | null {
  return openByKey.get(key) ?? null;
}

export function isAuxOpenApplying(): boolean {
  return applyingOpen;
}

/** details 호스트 등록 + 현재 open 상태 복원(재진입 가드 하에서). */
export function bindAuxDetails(key: string, which: AuxWhich, details: HTMLDetailsElement): void {
  let hosts = hostsByKey.get(key);
  if (!hosts) {
    hosts = {};
    hostsByKey.set(key, hosts);
  }
  hosts[which] = details;
  // details.open 설정은 브라우저에서 toggle 을 발생시키므로 applying 가드 필수.
  applyingOpen = true;
  try {
    applyDetailsOpen(details, getAuxOpen(key) === which);
  } finally {
    applyingOpen = false;
  }
}

/**
 * 배타 open 설정. which=null 이면 전부 접기.
 * 등록된 details 에 open 을 동기화하고, 호출 측 토글 핸들러는 isAuxOpenApplying 으로 구분한다.
 */
export function setAuxOpen(key: string, which: AuxWhich | null): void {
  openByKey.set(key, which);
  const hosts = hostsByKey.get(key);
  if (!hosts) return;
  applyingOpen = true;
  try {
    for (const panel of ["ai", "preview", "flow"] as const) {
      const details = hosts[panel];
      if (!details) continue;
      applyDetailsOpen(details, which === panel);
    }
  } finally {
    applyingOpen = false;
  }
}

function applyDetailsOpen(details: HTMLDetailsElement, open: boolean): void {
  if (details.open === open) return;
  details.open = open;
}
