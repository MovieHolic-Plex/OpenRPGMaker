import type { Project } from "@/project/types";

/** 브라우저 <video> 가 확실히 재생하는 컨테이너만 통과시킨다(업로드 데이터 URL 화이트리스트). */
const MOVIE_DATA_URL_PREFIXES = ["data:video/webm", "data:video/mp4", "data:video/ogg"] as const;

/** 번들 경로로 들어온 동영상 파일 확장자. */
const MOVIE_FILE_EXTENSIONS = [".webm", ".mp4", ".m4v", ".ogv"] as const;

export type MovieResourceEntry = {
  readonly id: string;
  readonly name: string;
  readonly group?: string;
};

/**
 * 프로젝트에 올라온 동영상 리소스(이름 오름차순).
 *
 * 종류(kind)가 근거다 — "movie" 로 등재된 업로드는 데이터 URL 이 무엇이든 동영상이다.
 * 전용 종류가 생기기 전에 다른 kind 로 올라간 레거시 업로드만 미디어 타입으로 구제한다.
 */
export function listMovieResources(project: Pick<Project, "assets">): readonly MovieResourceEntry[] {
  return Object.values(project.assets.uploaded)
    .filter((asset) => asset.kind === "movie" || isMovieMedia(asset.dataUrl))
    .map((asset) => ({ id: asset.id, name: asset.name.trim() || asset.id }))
    .sort((left, right) => left.name.localeCompare(right.name, "ko"));
}

export function isMovieMedia(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (MOVIE_DATA_URL_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true;
  const withoutQuery = normalized.split("?")[0] ?? normalized;
  return MOVIE_FILE_EXTENSIONS.some((extension) => withoutQuery.endsWith(extension));
}
