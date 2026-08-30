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
// 타이머 수명은 하드룰이다(커밋 2ed96476 회귀). 이 모듈은 stop() 을 돌려주고,
// 호출자(databaseSkillRecordView)는 표시면을 교체하기 전에 반드시 그걸 부른다.
import {
  SHOW_ANIMATION_FRAME_MS,
  playShowAnimation,
  renderShowAnimationFrame,
  showAnimationPlaybackSource,
  type ShowAnimationPlaybackHandle,
} from "@/editor/panels/eventEditor/showAnimationPlayback";
import type { BattleAnimationSheet, Project, SkillRecord } from "@/project/types";
import { el } from "@/util/dom";

const DEFAULT_ANIMATION_SHEET: BattleAnimationSheet = { frameWidth: 96, frameHeight: 96, columns: 5 };
const PLAYBACK_FPS = Math.round(1000 / SHOW_ANIMATION_FRAME_MS);

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
  if (!animation) {
    wrap.append(el("div", { class: "db-skill-animation-preview-empty", text: "(애니메이션 없음)" }));
    return { element: wrap, stop: () => undefined };
  }

  const sheet = animation.sheet ?? DEFAULT_ANIMATION_SHEET;
  const frameWidth = positiveNumber(sheet.frameWidth, DEFAULT_ANIMATION_SHEET.frameWidth);
  const frameHeight = positiveNumber(sheet.frameHeight, DEFAULT_ANIMATION_SHEET.frameHeight);
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

  // 재생할 수 없는 상태(프레임 없음 / 1장)는 정지 렌더가 정답이다 — 토글도 잠근다.
  if (!source || total < 2) {
    if (source) renderShowAnimationFrame(cells, source, 0);
    toggle.disabled = true;
    return { element: wrap, stop: () => undefined };
  }

  let handle: ShowAnimationPlaybackHandle | null = null;
  const setRunning = (running: boolean): void => {
    toggle.textContent = running ? "■ 정지" : "▶ 재생";
    toggle.setAttribute("aria-pressed", running ? "true" : "false");
  };
  const stop = (): void => {
    const running = handle;
    handle = null;
    running?.stop();
    setRunning(false);
  };
  const play = (): void => {
    stop();
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

  if (!autoplayAllowed()) {
    renderShowAnimationFrame(cells, source, 0);
    return { element: wrap, stop };
  }
  play();
  return { element: wrap, stop };
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
  if (typeof window === "undefined" || typeof window.clearInterval !== "function") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches !== true;
}

function positiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}
