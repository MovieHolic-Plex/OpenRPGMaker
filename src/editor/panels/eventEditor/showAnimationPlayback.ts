// showAnimation 표시면의 실제 프레임 재생.
//
// 데이터베이스 애니메이션 스테이지(databaseAnimationPreview.ts)와 같은 재생 규약을 쓴다:
// 15fps setInterval, record.sheet 좌표로 패턴을 잘라낸 셀 스프라이트, 1회 재생 후 첫 프레임 복귀.
// 셀 배치 프리미티브(db-animation-stage-cells / -cell-sprite)도 그 스테이지와 공유한다 —
// 같은 애니메이션이 편집기 안에서 두 얼굴을 가지면 안 된다.
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { applyAutoChromaKeyToBackground } from "@/editor/panels/chromaKey";
import type {
  BattleAnimationCell,
  BattleAnimationFrame,
  BattleAnimationRecord,
  BattleAnimationSheet,
  Project,
} from "@/project/types";
import { el } from "@/util/dom";

/** 데이터베이스 스테이지와 같은 15fps. */
export const SHOW_ANIMATION_FRAME_MS = Math.round(1000 / 15);

const DEFAULT_SHEET: BattleAnimationSheet = { frameWidth: 96, frameHeight: 96, columns: 5 };

export type ShowAnimationPlaybackSource = {
  readonly sheet: BattleAnimationSheet;
  readonly frames: readonly BattleAnimationFrame[];
  readonly url: string | undefined;
};

export type ShowAnimationPlaybackHandle = {
  readonly play: () => void;
  readonly stop: () => void;
};

/**
 * 그릴 프레임이 있으면 재생 소스를, 없으면 undefined 를 돌려준다.
 * (프레임 배열이 빈 레코드는 런타임도 섬광 대체 연출로 떨어진다.)
 */
export function showAnimationPlaybackSource(
  record: BattleAnimationRecord | undefined,
  project: Project
): ShowAnimationPlaybackSource | undefined {
  const frames = (record?.frames ?? []).filter((frame) => frame.cells.length > 0);
  if (!record || frames.length === 0) return undefined;
  const url = record.resourceId
    ? resolveAssetResourceUrl(record.resourceId, { project }) ?? undefined
    : undefined;
  return { sheet: record.sheet ?? DEFAULT_SHEET, frames, url };
}

/** 프레임 하나를 셀 레이어에 그린다. 그린 프레임은 레이어의 data-frame-index 로 관측된다. */
export function renderShowAnimationFrame(
  layer: HTMLElement,
  source: ShowAnimationPlaybackSource,
  frameIndex: number
): void {
  const index = Math.max(0, Math.min(source.frames.length - 1, frameIndex));
  const frame = source.frames[index];
  layer.dataset.frameIndex = String(index);
  layer.replaceChildren(...(frame?.cells ?? []).map((cell, cellIndex) => frameCell(source, cell, cellIndex)));
}

/**
 * 셀 레이어를 1회 재생한다. 버튼이 없는 표시면(명령 프리뷰 카드)도 이걸 쓴다.
 * 재생은 항상 1프레임부터 전진하고, 끝나면 첫 프레임으로 돌아가 선다.
 */
export function playShowAnimationOnce(
  stage: HTMLElement,
  layer: HTMLElement,
  source: ShowAnimationPlaybackSource,
  onStop?: () => void
): ShowAnimationPlaybackHandle {
  let timer: ReturnType<typeof window.setInterval> | null = null;
  let frameIndex = 0;
  // 표시면은 문서에 붙기 전에 만들어진다. 한 번이라도 붙은 뒤 떨어졌을 때만 중단한다.
  let wasMounted = false;
  // 다만 «붙기 전» 유예는 무한이 아니다. 끝까지 붙지 않는 표시면(미리보기만 만들고 버리는 호출,
  // 표면 스냅샷 하네스)에서는 인터벌이 영원히 살아 분리된 DOM 에 프레임을 계속 그렸다.
  // 실측: jsdom 정리 후 tick 이 document.createElement 를 만져 «document is not defined» 로 터졌다.
  let unmountedTicks = 0;

  const clear = (): void => {
    if (timer !== null) {
      window.clearInterval(timer);
      timer = null;
    }
  };

  const stop = (): void => {
    clear();
    onStop?.();
  };

  const dropped = (): boolean => {
    if (stage.isConnected !== false) {
      wasMounted = true;
      unmountedTicks = 0;
      return false;
    }
    if (wasMounted) return true;
    unmountedTicks += 1;
    // 실제 UI 는 열자마자 붙으므로 두 프레임(약 130ms)이면 충분하다. 그 뒤에도 안 붙었으면
    // 이 표시면은 화면에 없다 — 멈춘다. 나중에 붙으면 재생 버튼(play)이 다시 켠다.
    return unmountedTicks >= 2;
  };

  const tick = (): void => {
    if (dropped()) {
      stop();
      return;
    }
    frameIndex += 1;
    if (frameIndex >= source.frames.length) {
      stop();
      renderShowAnimationFrame(layer, source, 0);
      return;
    }
    renderShowAnimationFrame(layer, source, frameIndex);
  };

  const play = (): void => {
    clear();
    frameIndex = 0;
    renderShowAnimationFrame(layer, source, 0);
    timer = window.setInterval(tick, SHOW_ANIMATION_FRAME_MS);
  };

  play();
  return { play, stop };
}

/**
 * 재생 버튼과 셀 레이어를 묶는다. 열릴 때 1회 자동 재생하고, 버튼으로 다시 켜고 끌 수 있다.
 */
export function bindShowAnimationPlayback(
  button: HTMLButtonElement,
  stage: HTMLElement,
  layer: HTMLElement,
  source: ShowAnimationPlaybackSource
): ShowAnimationPlaybackHandle {
  let running: ShowAnimationPlaybackHandle | null = null;

  const idle = (): void => {
    running = null;
    button.textContent = "▶ 재생";
    button.setAttribute("aria-pressed", "false");
  };

  const play = (): void => {
    running?.stop();
    button.textContent = "■ 정지";
    button.setAttribute("aria-pressed", "true");
    running = playShowAnimationOnce(stage, layer, source, idle);
  };

  const stop = (): void => {
    running?.stop();
    renderShowAnimationFrame(layer, source, 0);
  };

  button.addEventListener("click", () => {
    if (running) {
      stop();
      return;
    }
    play();
  });

  play();
  return { play, stop };
}

/** 시트 프레임이 없는 레코드용 대체면. 깨진 스테이지처럼 보이지 않게 라벨을 붙인다. */
export function renderShowAnimationFallback(stage: HTMLElement, recordName: string): void {
  stage.replaceChildren(
    el("div", { class: "page3-anim-fallback-flash", attrs: { "aria-hidden": "true" } }),
    el("div", {
      class: "page3-anim-fallback-label",
      dataset: { testid: "show-animation-preview-fallback" },
      text: `${recordName} · 시트 프레임 없음 — 런타임 섬광으로 재생`,
    })
  );
}

function frameCell(
  source: ShowAnimationPlaybackSource,
  cell: BattleAnimationCell,
  cellIndex: number
): HTMLElement {
  const sprite = el("div", {
    class: `db-animation-stage-cell-sprite page3-anim-cell${cell.visible ? "" : " muted"}`,
    dataset: { testid: "show-animation-frame-cell", pattern: String(cell.pattern), cellIndex: String(cellIndex) },
    attrs: { "aria-hidden": "true" },
  });
  sprite.style.setProperty("--animation-frame-width", `${source.sheet.frameWidth}px`);
  sprite.style.setProperty("--animation-frame-height", `${source.sheet.frameHeight}px`);
  const columns = Math.max(1, source.sheet.columns);
  const column = cell.pattern % columns;
  const row = Math.floor(cell.pattern / columns);
  sprite.style.backgroundPosition = `-${column * source.sheet.frameWidth}px -${row * source.sheet.frameHeight}px`;
  if (source.url) {
    sprite.style.backgroundImage = `url("${source.url}")`;
    sprite.style.backgroundSize = `${columns * source.sheet.frameWidth}px auto`;
    // 단색 배경 시트(마젠타/녹색 등) 자동 키아웃. 투명 PNG 면 no-op.
    applyAutoChromaKeyToBackground(sprite, source.url);
  }
  sprite.style.transform = `translate(${cell.x}px, ${cell.y}px) scale(${cell.zoom / 100})`;
  sprite.style.opacity = String(cell.visible ? cell.opacity / 255 : Math.min(cell.opacity / 255, 0.38));
  return sprite;
}
