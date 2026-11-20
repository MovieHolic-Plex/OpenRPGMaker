// playMovie(동영상) 표시면의 실제 재생.
//
// showAnimation 표시면(showAnimationPlayback.ts)과 같은 규약이다: 고르는 곳과 재생되는 곳이
// 한 표면 안에 있고, 가짜 연출을 그리지 않는다 — 진짜 <video> 를 걸고 브라우저가 재생한다.
//
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { uploadedAssetUrl } from "@/project/persistence/assetAccessors";

/** 브라우저 <video> 가 확실히 재생하는 컨테이너만 통과시킨다(업로드 데이터 URL 화이트리스트). */
const MOVIE_DATA_URL_PREFIXES = ["data:video/webm", "data:video/mp4", "data:video/ogg"] as const;

/** 번들 경로로 들어온 동영상 파일 확장자. */
const MOVIE_FILE_EXTENSIONS = [".webm", ".mp4", ".m4v", ".ogv"] as const;

/**
 * 프로젝트 업로드가 없어도 미리 볼 수 있는 번들 클립. 기존 명령에서 명시적으로
 * 지정한 경우에는 픽커에도 유지한다.
 */
const SAMPLE_MOVIE_ID = "sample-movie.webm";
export const SAMPLE_MOVIE_RESOURCE = {
  id: SAMPLE_MOVIE_ID,
  name: "샘플 동영상",
  url: `/assets/movies/${SAMPLE_MOVIE_ID}`,
} as const;

export type MovieResourceEntry = {
  readonly id: string;
  readonly name: string;
  readonly group?: string;
};

/**
 * 프로젝트에 올라온 동영상 리소스(이름 오름차순).
 *
 * 플레이어와 같은 리소스 해석 순서로 확인한다. 같은 ID의 번들 자료가 동영상이 아니면 목록에서 뺀다.
 */
export function listMovieResources(project: Pick<Project, "assets">, selectedId?: string): readonly MovieResourceEntry[] {
  const entries = Object.values(project.assets.uploaded)
    .filter((asset) => resolveMovieResourceUrl(asset.id, project) !== null)
    .map((asset) => ({ id: asset.id, name: asset.name.trim() || asset.id }));
  if (selectedId === SAMPLE_MOVIE_RESOURCE.id && !Object.hasOwn(project.assets.uploaded, selectedId)) {
    entries.push({ id: selectedId, name: SAMPLE_MOVIE_RESOURCE.name });
  }
  return entries.sort((left, right) => left.name.localeCompare(right.name, "ko"));
}

/**
 * 재생 가능한 URL 을 돌려준다. SQLite 동영상의 해시 주소는 확장자 없이도 쓴다.
 */
export function resolveMovieResourceUrl(
  resourceId: string | undefined,
  project: Pick<Project, "assets">
): string | null {
  if (!resourceId) return null;
  const uploadedAsset = Object.hasOwn(project.assets.uploaded, resourceId) ? project.assets.uploaded[resourceId] : undefined;
  const resolved = resolveAssetResourceUrl(resourceId, { project });
  if (resolved === null) return null;
  const movieRef = uploadedAsset?.kind === "movie" && uploadedAsset.ref && resolved === uploadedAssetUrl(uploadedAsset);
  return movieRef || isMovieMedia(resolved) ? resolved : null;
}

export type MoviePreviewStage = {
  readonly stage: HTMLElement;
  readonly video: HTMLVideoElement;
};

/**
 * 동영상 재생면. url 이 없으면 번들 샘플을 걸고 그 사실을 라벨로 밝힌다.
 * 열릴 때 음소거 자동 재생을 시도하고(브라우저 정책상 muted 만 허용된다),
 * 막히면 controls 로 사용자가 직접 돌린다.
 */
export function renderMoviePreviewStage(url: string | null): MoviePreviewStage {
  const usingSample = url === null;
  const video = el("video", {
    class: "page3-movie-video",
    dataset: { testid: "play-movie-preview-video" },
    attrs: {
      src: usingSample ? SAMPLE_MOVIE_RESOURCE.url : url,
      preload: "metadata",
      controls: "",
      muted: "",
      playsinline: "",
      loop: "",
      "aria-label": usingSample ? `${SAMPLE_MOVIE_RESOURCE.name} 미리보기` : "동영상 미리보기",
    },
  });
  // 속성만으로는 자동 재생 정책을 못 넘는 브라우저가 있다 — 프로퍼티도 같이 세운다.
  video.muted = true;
  const stage = el("div", {
    class: "page3-preview-stage page3-movie-stage",
    dataset: { testid: "play-movie-preview-stage" },
    children: [el("span", { class: "page3-preview-stage-label", text: "재생" }), video],
  });
  if (usingSample) {
    stage.append(
      el("span", {
        class: "page3-movie-sample-note",
        dataset: { testid: "play-movie-sample-note" },
        text: `${SAMPLE_MOVIE_RESOURCE.name}(번들) · 프로젝트 리소스가 아니므로 명령에는 쓰이지 않습니다`,
      })
    );
  }
  // fakeDom 에는 play() 가 없다. 실제 브라우저에서만 자동 재생을 시도한다.
  video.play?.()?.catch(() => {});
  return { stage, video };
}

function isMovieMedia(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  if (MOVIE_DATA_URL_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true;
  const withoutQuery = normalized.split("?")[0] ?? normalized;
  return MOVIE_FILE_EXTENSIONS.some((extension) => withoutQuery.endsWith(extension));
}
