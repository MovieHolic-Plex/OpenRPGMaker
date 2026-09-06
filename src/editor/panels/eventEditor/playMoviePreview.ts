// playMovie(동영상) 표시면의 실제 재생.
//
// showAnimation 표시면(showAnimationPlayback.ts)과 같은 규약이다: 고르는 곳과 재생되는 곳이
// 한 표면 안에 있고, 가짜 연출을 그리지 않는다 — 진짜 <video> 를 걸고 브라우저가 재생한다.
//
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";
import { isMovieMedia } from "@/assets/movieResourceCatalog";
export { listMovieResources, type MovieResourceEntry } from "@/assets/movieResourceCatalog";

/**
 * 레포에 함께 실리는 샘플 클립. 프로젝트 리소스로 등록하지 않는다 —
 * 리소스 id 등록 지점(src/assets, 검증기)은 이 레인 밖이라, 등록했다고 말하면 거짓말이 된다.
 * 그래서 픽커 항목이 아니라 "동영상이 아직 없을 때 재생이 어떻게 보이는지" 보여 주는 표시면 대체다.
 */
export const SAMPLE_MOVIE_RESOURCE = {
  name: "샘플 동영상",
  url: "/assets/movies/sample-movie.webm",
} as const;

/**
 * 재생 가능한 URL 을 돌려준다. 업로드 동영상은 데이터 URL 을 직접 쓰고
 * (resolveAssetResourceUrl 의 화이트리스트는 이미지·오디오만 허용한다),
 * 그 밖에는 일반 리소스 해석 → 번들 파일 경로 순으로 떨어진다.
 */
export function resolveMovieResourceUrl(
  resourceId: string | undefined,
  project: Pick<Project, "assets">
): string | null {
  if (!resourceId) return null;
  const uploaded = project.assets.uploaded[resourceId]?.dataUrl;
  if (uploaded !== undefined) return isMovieMedia(uploaded) ? uploaded : null;
  const resolved = resolveAssetResourceUrl(resourceId, { project });
  if (resolved !== null && isMovieMedia(resolved)) return resolved;
  return null;
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
