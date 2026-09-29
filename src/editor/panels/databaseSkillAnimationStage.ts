// 스킬 탭 `연출` 카드의 애니메이션 스테이지.
//
// 개편 전: 시트의 첫 칸을 backgroundPosition "0 0" 으로 잘라 보여주는 정지 이미지 한 장이었다
// (databaseSkillRecordView 의 animationFramePreviewBox). 프레임 수도 셀 배치도 편집기에서
// 볼 수 없었고, 같은 애니메이션이 이벤트 편집기에선 자동 재생, 여기선 정지로 두 얼굴을 가졌다.
//
// 개편 후: 이벤트 편집기 표시면과 **같은 재생 엔진**(eventEditor/showAnimationPlayback)을
// loop 옵션으로 돌린다. 이 모듈은 자기 타이머 루프를 만들지 않는다 — 15fps·시트 좌표·크로마키
// 규약이 한 곳에만 있어야 한다.
//
// 타이머 수명은 하드룰이다(커밋 2ed96476 회귀). 각 스테이지 루트의 컨트롤러를
// WeakMap 에 등록하고, DOM 을 교체·제거하는 소유자가 범위 기반 stop/resume 헬퍼를 호출한다.
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { battleAnimationSheetRmScale } from "@/player/battleAnimationPlayback";
import {
  SHOW_ANIMATION_FRAME_MS,
  playShowAnimation,
  renderShowAnimationFrame,
  showAnimationPlaybackSource,
  type ShowAnimationPlaybackHandle,
} from "@/editor/panels/eventEditor/showAnimationPlayback";
import type { BattleAnimationSheet, Project, SkillRecord } from "@/project/types";
import { el } from "@/util/dom";
import { resumeRetroSkillStagesIn, stopRetroSkillStagesIn } from "@/editor/panels/databaseSkillRetroStage";
import { resumeEnemyPixelPreviewsIn, stopEnemyPixelPreviewsIn } from "@/editor/panels/databaseEnemyPixelPreview";

const DEFAULT_ANIMATION_SHEET: BattleAnimationSheet = { frameWidth: 96, frameHeight: 96, columns: 5 };
const PLAYBACK_FPS = Math.round(1000 / SHOW_ANIMATION_FRAME_MS);

type SkillAnimationStageController = {
  readonly stop: () => void;
  readonly resume: () => void;
  readonly canAutoplay: boolean;
};

const stageControllers = new WeakMap<HTMLElement, SkillAnimationStageController>();

export type SkillAnimationStage = {
  /** 카드에 붙일 표시면 루트(db-skill-animation-preview). */
  readonly element: HTMLElement;
  /** 표시면을 버리기 전에 반드시 호출한다. 재생 인터벌을 확정적으로 정리한다. */
  readonly stop: () => void;
};

/**
 * 스킬이 참조하는 애니메이션의 살아 있는 스테이지를 만든다.
 * 프레임 2장 이상 + reduced-motion 아님이면 즉시 자동 반복 재생한다.
 */
export function renderSkillAnimationStage(record: SkillRecord, project: Project): SkillAnimationStage {
  const wrap = el("div", { class: "db-skill-animation-preview", dataset: { testid: "db-skill-animation-preview" } });
  const animation = record.animationId
    ? project.database.battleAnimations.find((entry) => entry.id === record.animationId)
    : undefined;
  if (!animation || !animation.resourceId || !resolveAssetResourceUrl(animation.resourceId, { project })) {
    wrap.append(el("div", { class: "db-skill-animation-preview-empty", text: "(애니메이션 없음)" }));
    return { element: wrap, stop: () => undefined };
  }

  const sheet = animation.sheet ?? DEFAULT_ANIMATION_SHEET;
  // 스테이지는 RM px 좌표계 — 시트 배율(레거시 1, 384px 고해상도 0.25)로 96px 셀에 맞춘다.
  const rmScale = battleAnimationSheetRmScale(sheet);
  const frameWidth = positiveNumber(sheet.frameWidth, DEFAULT_ANIMATION_SHEET.frameWidth) * rmScale;
  const frameHeight = positiveNumber(sheet.frameHeight, DEFAULT_ANIMATION_SHEET.frameHeight) * rmScale;
  const columns = Math.max(1, Math.floor(positiveNumber(sheet.columns, DEFAULT_ANIMATION_SHEET.columns)));

  const cells = el("div", {
    class: "db-animation-stage-cells db-skill-animation-cells",
    dataset: { testid: "db-skill-animation-cells", frameIndex: "0" },
  });
  const stage = el("div", {
    class: "db-skill-animation-preview-frame db-skill-animation-stage",
    dataset: { testid: "db-skill-animation-stage" },
    attrs: { role: "img", "aria-label": `${animation.name || animation.id} 연출 미리보기` },
    children: [
      el("div", { class: "db-skill-animation-stage-grid", attrs: { "aria-hidden": "true" } }),
      el("div", { class: "db-skill-animation-stage-crosshair", attrs: { "aria-hidden": "true" } }),
      cells,
    ],
  });
  stage.style.setProperty("--animation-frame-width", `${frameWidth}px`);
  stage.style.setProperty("--animation-frame-height", `${frameHeight}px`);
  stage.style.setProperty("--animation-sheet-columns", String(columns));

  const source = showAnimationPlaybackSource(animation, project);
  const total = source?.frames.length ?? 0;
  const counter = chip("db-skill-animation-frame-counter", frameCounterText(0, total));
  const toggle = el("button", {
    class: "db-skill-animation-toggle",
    dataset: { testid: "db-skill-animation-toggle" },
    attrs: { type: "button", "aria-pressed": "false" },
    text: "▶ 재생",
  });
  wrap.append(
    stage,
    el("div", {
      class: "db-skill-animation-info",
      children: [
        el("span", { class: "db-skill-animation-preview-caption", text: animation.name || animation.id }),
        counter,
        chip("db-skill-animation-sheet-meta", `${frameWidth}×${frameHeight} · ${columns}열 · ${PLAYBACK_FPS}fps`),
        toggle,
      ],
    })
  );

  const setRunning = (running: boolean): void => {
    toggle.textContent = running ? "■ 정지" : "▶ 재생";
    toggle.setAttribute("aria-pressed", running ? "true" : "false");
  };

  // 재생할 수 없는 상태(프레임 없음 / 1장)는 정지 렌더가 정답이다 — 토글도 잠근다.
  if (!source || total < 2) {
    if (source) renderShowAnimationFrame(cells, source, 0);
    toggle.disabled = true;
    stageControllers.set(stage, {
      stop: () => setRunning(false),
      resume: () => undefined,
      canAutoplay: false,
    });
    return { element: wrap, stop: () => setRunning(false) };
  }

  const canAutoplay = autoplayAllowed();
  let handle: ShowAnimationPlaybackHandle | null = null;
  const stop = (): void => {
    const running = handle;
    handle = null;
    running?.stop();
    setRunning(false);
  };
  const play = (): void => {
    if (handle) return;
    handle = playShowAnimation(stage, cells, source, {
      loop: true,
      onFrame: (frameIndex, frameTotal) => {
        counter.textContent = frameCounterText(frameIndex, frameTotal);
      },
      // 엔진이 스스로 멈추는 경우(스테이지가 문서에서 떨어짐)에도 버튼 상태를 맞춘다.
      onStop: () => {
        handle = null;
        setRunning(false);
      },
    });
    setRunning(true);
  };
  toggle.addEventListener("click", () => {
    if (handle) {
      stop();
      return;
    }
    play();
  });

  const controller: SkillAnimationStageController = {
    stop,
    resume: () => {
      // 별도 사용자 일시정지 상태는 두지 않는다. 캐시 재부착의 자동재생 계약을 우선해,
      // 자동재생 가능한 정지 스테이지라면 resume 소유자가 다시 시작한다.
      if (canAutoplay && !handle) play();
    },
    canAutoplay,
  };
  stageControllers.set(stage, controller);

  if (!canAutoplay) {
    renderShowAnimationFrame(cells, source, 0);
    return { element: wrap, stop };
  }
  play();
  return { element: wrap, stop };
}

/** scope 가 소유한 모든 스킬 애니메이션 인터벌을 즉시 정리한다. */
export function stopSkillAnimationStagesIn(scope: ParentNode): void {
  for (const stage of scope.querySelectorAll<HTMLElement>("[data-testid='db-skill-animation-stage']")) {
    stageControllers.get(stage)?.stop();
  }
  // 같은 카드의 도트 전투 미리보기(retro2003)도 같은 소유자 경로로 멈춘다.
  stopRetroSkillStagesIn(scope);
  // 적 탭 도트 미리보기 카드도 같은 소유자(탭 전환·레코드 전환·모달 닫기) 경로를 탄다.
  stopEnemyPixelPreviewsIn(scope);
}

/** 캐시에서 다시 붙은 자동재생 가능 스테이지를 재시작한다. */
export function resumeSkillAnimationStagesIn(scope: ParentNode): void {
  for (const stage of scope.querySelectorAll<HTMLElement>("[data-testid='db-skill-animation-stage']")) {
    const controller = stageControllers.get(stage);
    if (controller?.canAutoplay) controller.resume();
  }
  resumeRetroSkillStagesIn(scope);
  resumeEnemyPixelPreviewsIn(scope);
}

function chip(testid: string, text: string): HTMLElement {
  return el("span", { class: "db-skill-animation-chip", dataset: { testid }, text });
}

function frameCounterText(frameIndex: number, total: number): string {
  return `${total === 0 ? 0 : frameIndex + 1} / ${total}`;
}

function autoplayAllowed(): boolean {
  // 재생기는 window 의 인터벌 타이머 API 를 쓴다. 그게 없는 호스트(헤드리스 렌더 하네스)에서는
  // 자동재생하지 않고 첫 프레임에 선다. reduced-motion 도 같은 정지 경로다.
  if (
    typeof window === "undefined" ||
    typeof window.setInterval !== "function" ||
    typeof window.clearInterval !== "function"
  ) return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches !== true;
}

function positiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
