// project/sharedDemoProject.ts
// 첫 방문 공용 데모의 정본 식별자.
//
// 왜 전용 행이었나: 배포 기본 프로젝트(gallery)를 데모로 쓰면 방문자의 자동저장이
// 공유 정본을 덮어쓴다(openwiki/large-village-generation.md 의 실측 사고). 전용 id +
// store 의 읽기 전용 가드로 어떤 클라이언트 경로도 이 행에 쓸 수 없게 한다.
// P6 이후 정본은 로컬 폴더라 이 행은 열리지 않는다 — 식별자와 읽기 전용 가드만 남긴다.

/** 모든 첫 방문자가 읽기 전용으로 여는 공용 데모 행. */
export const SHARED_DEMO_PROJECT_ID = "rpg-zzu-first-visit-demo";

export function isSharedDemoProjectId(projectId: string | null | undefined): boolean {
  return projectId === SHARED_DEMO_PROJECT_ID;
}
