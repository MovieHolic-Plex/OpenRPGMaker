import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { StepResult } from "@/player/interpreter";
import { isConfirmKey, CONFIRM_KEY_LABEL } from "@/player/keyBindings";
import { dialogueHost } from "@/player/playSceneDom";
import type { PlaySceneContext } from "@/player/playSceneTypes";
import { store } from "@/project/store";
import type { Project } from "@/project/types";
import { el } from "@/util/dom";

// playMovie 런타임: Phaser 캔버스 위에 HTML5 <video> 를 절대 배치로 얹는다.
// showAnimation(playMapAnimation) 과 같은 계약 — 재생 완료 시 resolve 하는 Promise 를 돌려
// 인터프리터의 pause step 을 재개시킨다. 영상은 Phaser 텍스처로 못 다루므로 DOM 오버레이가
// 유일한 경로다(화면 효과 오버레이와 같은 host 규칙을 쓴다).

export const MOVIE_OVERLAY_TESTID = "runtime-movie-overlay";
export const MOVIE_VIDEO_TESTID = "runtime-movie-video";

/** 로드가 끝내 시작되지 않아도 이벤트가 영원히 멈추지 않도록 두는 상한. */
const MOVIE_LOAD_TIMEOUT_MS = 10_000;

/** 확장자가 이미 붙은 리소스 id 는 그대로 파일명으로 쓴다(webm 샘플 등). */
const MOVIE_FILE_EXTENSION = /\.(mp4|webm|ogv|ogg|m4v|mov)$/i;

type PlayMovieStep = Extract<StepResult, { kind: "playMovie" }>;

/**
 * 리소스 프로필에서 동영상 URL을 해석한다. 프로필에 없는 id 는 public 동영상 경로로 폴백한다
 * (사용자가 /assets/movies 에 직접 넣은 파일을 쓰는 경로).
 */
export function resolveMovieResourceUrl(
  resourceId: string,
  project: Project = store.getCurrent()
): string | undefined {
  if (!resourceId) return undefined;
  const resolved = resolveAssetResourceUrl(resourceId, { project });
  if (resolved) return resolved;
  const fileName = MOVIE_FILE_EXTENSION.test(resourceId) ? resourceId : `${resourceId}.mp4`;
  return `/assets/movies/${encodeURIComponent(fileName)}`;
}

export function playMovieOverlay(scene: PlaySceneContext, step: PlayMovieStep): Promise<void> {
  const host = movieHost(scene);
  const url = resolveMovieResourceUrl(step.resourceId);
  if (!host || !url) {
    console.warn(`[player] playMovie 리소스를 해석할 수 없다: ${step.resourceId}`);
    return Promise.resolve();
  }

  const overlay = el("div", {
    class: "runtime-movie-overlay",
    dataset: { testid: MOVIE_OVERLAY_TESTID },
  });
  styleOverlay(overlay);
  const video = el("video", { dataset: { testid: MOVIE_VIDEO_TESTID } });
  video.setAttribute("src", url);
  video.setAttribute("autoplay", "");
  video.setAttribute("playsinline", "");
  styleVideo(video);
  overlay.append(video);
  if (step.skippable) overlay.append(skipHint());
  host.append(overlay);

  let settled = false;
  let loadTimer: ReturnType<typeof setTimeout> | undefined;
  const finishers: Array<() => void> = [];

  const done = new Promise<void>((resolve) => {
    const finish = (): void => {
      if (settled) return;
      settled = true;
      if (loadTimer !== undefined) clearTimeout(loadTimer);
      for (const off of finishers) off();
      video.pause?.();
      overlay.remove();
      resolve();
    };
    const onEnded = (): void => finish();
    const onError = (): void => {
      console.warn(`[player] playMovie 재생 실패: ${step.resourceId}`);
      finish();
    };
    const onLoaded = (): void => {
      if (loadTimer !== undefined) clearTimeout(loadTimer);
      loadTimer = undefined;
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!step.skippable || !isConfirmKey(event.key)) return;
      event.preventDefault();
      finish();
    };
    video.addEventListener("ended", onEnded);
    video.addEventListener("error", onError);
    video.addEventListener("loadeddata", onLoaded);
    video.addEventListener("playing", onLoaded);
    document.addEventListener("keydown", onKeyDown);
    finishers.push(() => {
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("error", onError);
      video.removeEventListener("loadeddata", onLoaded);
      video.removeEventListener("playing", onLoaded);
      document.removeEventListener("keydown", onKeyDown);
    });
    loadTimer = setTimeout(() => {
      console.warn(`[player] playMovie 로드 시간 초과: ${step.resourceId}`);
      finish();
    }, MOVIE_LOAD_TIMEOUT_MS);
  });

  // 브라우저 자동재생 정책상 play() 는 거부될 수 있다 — 그때는 error/타임아웃 경로가 정리한다.
  void video.play?.().catch(() => undefined);

  // wait:false 는 즉시 다음 커맨드로 넘어가고, 영상은 오버레이째로 떨어져 계속 재생된다.
  return step.wait ? done : Promise.resolve();
}

function movieHost(scene: PlaySceneContext): HTMLElement | undefined {
  const canvas = scene.game?.canvas;
  const stage = canvas instanceof HTMLElement ? canvas.closest(".play-stage") : null;
  if (stage instanceof HTMLElement) return stage;
  const fromRegistry = dialogueHost(scene);
  if (fromRegistry) return fromRegistry;
  const parent = canvas?.parentElement;
  return parent instanceof HTMLElement ? parent : undefined;
}

function styleOverlay(overlay: HTMLElement): void {
  overlay.style.position = "absolute";
  overlay.style.inset = "0";
  overlay.style.zIndex = "60";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.background = "rgba(0, 0, 0, 0.92)";
  // 재생 중 입력을 막는다 — 오버레이가 포인터를 전부 흡수한다.
  overlay.style.pointerEvents = "auto";
}

function styleVideo(video: HTMLElement): void {
  video.style.maxWidth = "100%";
  video.style.maxHeight = "100%";
  video.style.width = "auto";
  video.style.height = "auto";
  video.style.objectFit = "contain";
}

function skipHint(): HTMLElement {
  const hint = el("div", {
    class: "runtime-movie-skip-hint",
    text: `${CONFIRM_KEY_LABEL}로 건너뛰기`,
  });
  hint.style.position = "absolute";
  hint.style.right = "12px";
  hint.style.bottom = "10px";
  hint.style.color = "rgba(255, 255, 255, 0.72)";
  hint.style.font = "12px system-ui, sans-serif";
  hint.style.pointerEvents = "none";
  return hint;
}
