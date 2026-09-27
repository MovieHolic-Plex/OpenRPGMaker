/** 시작 화면이 최근 목록에서 기본으로 숨기는 이유. */
export type RecentProjectHiddenReason = "temporary" | "missing";

/**
 * 시작 화면 최근 목록 한 줄. 데스크톱은 폴더의 project.sqlite 에서 제목·편집 시각·맵 수를 읽어 채운다.
 * 팀 호스트(브라우저 브리지)는 projectDir·title 만 준다 — 나머지는 없을 수 있다.
 */
export type RecentProjectEntry = {
  readonly projectDir: string;
  readonly title: string;
  readonly lastOpenedAt?: string | null;
  readonly updatedAt?: string | null;
  readonly mapCount?: number | null;
  /** data:image/jpeg;base64 — 편집기가 남긴 cover.jpg. 없으면 null. */
  readonly cover?: string | null;
  readonly hiddenReason?: RecentProjectHiddenReason | null;
};

export type SuggestedProjectDir = {
  /** 새 폴더가 들어갈 상위 위치. */
  readonly root: string;
  /** 만들 폴더의 절대 경로(아직 없거나 비어 있다). */
  readonly projectDir: string;
};
