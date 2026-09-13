// project/sharedDemoProject.ts
// 첫 방문 공용 데모의 정본 식별자와 부트 게이트.
//
// 왜 전용 행인가: 배포 기본 프로젝트(gallery)를 데모로 쓰면 방문자의 자동저장이
// 공유 정본을 덮어쓴다(openwiki/large-village-generation.md 의 실측 사고). 전용 id +
// store 의 읽기 전용 가드로 어떤 클라이언트 경로도 이 행에 쓸 수 없게 한다.
// 내용 갱신은 scripts/publish-first-visit-demo.mts --apply 만이 담당한다(스토어를 거치지 않는다).

/** 모든 첫 방문자가 읽기 전용으로 여는 공용 데모 행. */
export const SHARED_DEMO_PROJECT_ID = "rpg-zzu-first-visit-demo";

export function isSharedDemoProjectId(projectId: string | null | undefined): boolean {
  return projectId === SHARED_DEMO_PROJECT_ID;
}

export type SharedDemoBootGate = {
  /** ?project= / ?projectId= 딥링크 — 요청한 작업이 우선한다. */
  readonly deepLinkedProject: boolean;
  /** 자동화/e2e 부팅 문맥(isAutomationBootContext) — 기존 계약을 유지한다. */
  readonly automation: boolean;
  /** dev showcase 팩토리가 켜진 주소(?freshProject 등) — showcase 가 우선한다. */
  readonly devShowcase: boolean;
  /** Supabase 연결(배포 env 또는 저장된 자격증명)이 있어야 데모 행을 읽을 수 있다. */
  readonly dbConfigured: boolean;
  /** 이 기기가 이미 작업을 선택했다 — 방문자의 기존 작업을 데모로 덮지 않는다. */
  readonly storedSelection: boolean;
};

/**
 * 진짜 첫 방문(딥링크·저장 선택·자동화·showcase 없음)에만 데모를 연다.
 * mode.ts 가 부트 시점 값을 모아 넘기고, 반환 false 면 기존 로드 경로가 그대로 탄다.
 */
export function shouldOpenSharedDemoAtBoot(options: SharedDemoBootGate): boolean {
  return !options.deepLinkedProject
    && !options.automation
    && !options.devShowcase
    && options.dbConfigured
    && !options.storedSelection;
}
