/** 시작 화면이 최근 목록에서 기본으로 숨기는 이유. */
export type RecentProjectHiddenReason = "temporary" | "missing";

/** 시작 화면 카드 그림 크기(cover.jpg). 편집기와 시작 화면이 같은 크기로 굽는다. */
export const PROJECT_COVER_WIDTH = 480;
export const PROJECT_COVER_HEIGHT = 300;

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
  /** cover.jpg 가 마지막 저장보다 오래됐다(다른 빌드·팀 호스트에서 고친 뒤). 시작 화면이 다시 굽는다. */
  readonly coverStale?: boolean;
  readonly hiddenReason?: RecentProjectHiddenReason | null;
};

/**
 * 시작 화면이 카드 그림을 직접 구울 재료 — 시작 맵 하나와 그 타일셋만.
 * 타일셋은 참고문서(referenceDocuments, 수 MB)를 뺀 채로 온다. 업로드 타일셋이면 그림을 data URL 로 싣는다.
 * 모양은 저장된 JSON 그대로다(렌더러가 GameMap·TilesetDef 로 읽는다) — 공유 폴더라 src 타입을 import 하지 않는다.
 */
export type ProjectCoverSource = {
  readonly map: unknown;
  readonly tileset: unknown;
  readonly focus: { readonly x: number; readonly y: number } | null;
  readonly uploadedImage: string | null;
};

export type SuggestedProjectDir = {
  /** 새 폴더가 들어갈 상위 위치. */
  readonly root: string;
  /** 만들 폴더의 절대 경로(아직 없거나 비어 있다). */
  readonly projectDir: string;
};
