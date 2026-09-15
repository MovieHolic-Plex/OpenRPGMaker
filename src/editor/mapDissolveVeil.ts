// editor/mapDissolveVeil.ts
// 맵 전환의 크로스페이드 — 판정은 `assistantViewTransition` 이 하고, 여기는 **그것을 튼다**.
//
// 왜 베일인가(캔버스 자체를 페이드하지 않는 이유):
//  - Phaser 는 `Phaser.AUTO` 라 보통 WebGL 이고 `preserveDrawingBuffer` 가 꺼져 있다. 옛 프레임을
//    실제로 떠서 겹치려면 `renderer.snapshot()` 의 전체 캔버스 readPixels 가 필요하다 — 전환마다
//    한 프레임 늦고 큰 캔버스에서 비싸다.
//  - 캔버스 엘리먼트의 opacity 를 건드리면 그 위에 절대 배치된 DOM 오버레이(로케이션 상자,
//    고스트 마커, 활동 칩)는 그대로 남아 **옛 맵 좌표에 붙은 상자만 떠 있는** 화면이 된다.
// 그래서 편집 캔버스 호스트 안에 종이색 판 하나를 덮는다. 캔버스와 그 위 오버레이가 한꺼번에
// 잠기고, 잠긴 동안 맵·카메라를 갈아 끼우고, 새 화면이 같은 종이색에서 떠오른다.
//
// 색은 `--bg-canvas` 다 — 그 호스트가 이미 그 색을 깔고 있으므로(figma 셸
// `05-canvas-statusbar.css`) 다 덮인 순간의 화면은 «빈 편집 캔버스» 이지 검은 판이 아니다.

import { remainingCoverMs } from "@/editor/assistantViewTransition";

type Run = {
  /** 덮이는 즉시 실행할 교체 — 새 요청이 오면 **최신 것으로 갈아 끼운다**(코얼레싱). */
  readonly swap: () => void;
  /** 새 요청이 끼어들면 이전 실행의 뒷정리가 화면을 걷어 가면 안 된다. */
  cancelled: boolean;
};

/** rAF 가 오지 않는 환경(백그라운드 탭)에서 베일이 종이색에 갇히지 않게 하는 탈출구. */
const PAINT_WAIT_TIMEOUT_MS = 400;

let veil: HTMLElement | null = null;
let run: Run | null = null;

/**
 * 편집 캔버스 호스트.
 *
 * `.phaser-container` 로 찾으면 안 된다 — **플레이어도 같은 클래스를 쓴다**
 * (`player/playSurface.ts`). 편집기 안에서 테스트 플레이 창을 열면 `querySelector` 가
 * 어느 쪽을 집을지 DOM 순서에 달리고, 조수의 맵 전환이 게임 화면을 덮을 수 있다.
 * `edit-canvas` 는 씬 자신이 이미 쓰는 편집 캔버스의 이름이다(EditScene.ts).
 */
const EDIT_CANVAS_SELECTOR = "[data-testid='edit-canvas']";

function host(): HTMLElement | null {
  const found = document.querySelector<HTMLElement>(EDIT_CANVAS_SELECTOR);
  if (!found) return null;
  // 절대 배치 오버레이와 같은 규약(mapLocationLayer.ensureHost).
  if (getComputedStyle(found).position === "static") found.style.position = "relative";
  return found;
}

/** 덮을 캔버스가 실제로 붙어 있는가 — `planAssistantViewTransition` 의 `canDissolve`. */
export function canDissolveMapView(): boolean {
  if (typeof document === "undefined" || typeof Element === "undefined") return false;
  if (typeof Element.prototype.animate !== "function") return false;
  return document.querySelector(EDIT_CANVAS_SELECTOR) !== null;
}

function ensureVeil(): HTMLElement | null {
  if (veil?.isConnected) return veil;
  const parent = host();
  if (!parent) return null;
  const node = document.createElement("div");
  node.className = "map-dissolve-veil";
  node.dataset.testid = "map-dissolve-veil";
  // 전환은 시각 장식이다 — 보조기술에 «내용이 사라졌다» 고 알리지 않는다.
  node.setAttribute("aria-hidden", "true");
  node.style.opacity = "0";
  parent.appendChild(node);
  veil = node;
  return node;
}

/** 지금 화면에 실제로 보이는 불투명도. 애니메이션 중이면 보간된 값이 나온다. */
function currentOpacity(node: HTMLElement): number {
  const raw = Number.parseFloat(getComputedStyle(node).opacity);
  return Number.isFinite(raw) ? raw : 0;
}

/**
 * 새 맵이 **실제로 한 번 그려진 뒤에** 콜백을 부른다.
 *
 * `swap()` 은 Phaser 표시 객체를 동기로 다시 만들 뿐이고 화면에 나오는 것은 다음 렌더 틱이다.
 * 그 틱을 안 기다리고 베일을 걷으면 «빈 종이색 캔버스» 가 드러난다 — 실측(swiftshader,
 * 24×18 맵)에서 교체 직후 프레임이 통째로 비어 있었고, 그건 하드컷보다 나쁘다.
 * rAF 두 번이 「다음 페인트가 끝났다」의 표준 관용구다. 탭이 백그라운드면 rAF 가 아예
 * 안 오므로 타이머로 반드시 빠져나온다.
 */
function afterNextPaint(callback: () => void): void {
  if (typeof requestAnimationFrame !== "function") {
    callback();
    return;
  }
  let done = false;
  const fire = (): void => {
    if (done) return;
    done = true;
    callback();
  };
  requestAnimationFrame(() => requestAnimationFrame(fire));
  setTimeout(fire, PAINT_WAIT_TIMEOUT_MS);
}

/** 인라인 style 을 목적지 값으로 먼저 세우므로 fill 없이도 그 값에 머문다(fill 누수 없음). */
function fade(node: HTMLElement, from: number, to: number, durationMs: number, easing: string): Animation | null {
  node.style.opacity = String(to);
  if (durationMs <= 0) return null;
  return node.animate([{ opacity: from }, { opacity: to }], { duration: durationMs, easing });
}

/**
 * 화면을 종이색으로 덮고, 덮인 동안 `swap()` 을 실행하고, 다시 걷는다.
 *
 * 덮을 곳이 없으면(헤드리스·테스트) `swap()` 을 **동기로** 실행한다 — 전환은 장식이고
 * 교체가 본체다. 호출부는 어느 경로든 교체가 일어났다고 믿어도 된다.
 *
 * 끼어들기: 실행 중에 다시 부르면 새 디졸브를 처음부터 틀지 않는다. 지금 실제로 보이는
 * 불투명도에서 남은 만큼만 이어 덮으므로(`remainingCoverMs`) 「밝아졌다 다시 어두워지는」
 * 두 번째 깜빡임이 생기지 않는다. 아직 안 덮인 상태에서 연달아 오는 전환은 한 번의
 * 깜빡임으로 흡수된다.
 */
export function dissolveMapView(
  plan: { readonly coverMs: number; readonly revealMs: number },
  swap: () => void
): void {
  const node = ensureVeil();
  if (!node) {
    swap();
    return;
  }

  const from = currentOpacity(node);
  if (run) run.cancelled = true;
  for (const animation of node.getAnimations?.() ?? []) animation.cancel();
  const current: Run = { swap, cancelled: false };
  run = current;

  const reveal = (): void => {
    if (current.cancelled) return;
    // 교체는 **다 덮인 뒤**에만 한다. 한 프레임이라도 일찍 하면 하드컷이 그대로 보인다.
    // 교체가 던져도 베일은 반드시 걷는다 — 화면이 종이색에 영영 갇히는 것이 최악이다.
    try {
      current.swap();
    } catch (error) {
      queueMicrotask(() => { throw error; });
    }
    // 그리고 새 맵이 실제로 그려진 뒤에 걷는다 — 안 기다리면 빈 캔버스가 드러난다.
    afterNextPaint(() => {
      if (current.cancelled) return;
      const out = fade(node, 1, 0, plan.revealMs, "cubic-bezier(0.22, 0.61, 0.36, 1)");
      if (!out) {
        run = null;
        return;
      }
      const settle = (): void => {
        if (current.cancelled) return;
        run = null;
      };
      out.onfinish = settle;
      out.oncancel = settle;
    });
  };

  const cover = fade(node, from, 1, remainingCoverMs(plan.coverMs, from), "cubic-bezier(0.4, 0, 1, 1)");
  if (!cover) {
    reveal();
    return;
  }
  cover.onfinish = reveal;
  // 탭이 백그라운드로 가거나 씬이 멈추면 onfinish 가 오지 않을 수 있다 — 화면이 종이색에
  // 갇히는 것은 하드컷보다 나쁘다. 취소도 완료와 같은 자리로 보낸다.
  cover.oncancel = reveal;
}

/** 씬 정리·모드 전환용. 진행 중인 전환을 끊고 베일을 걷는다. */
export function clearMapDissolveVeil(): void {
  if (run) run.cancelled = true;
  run = null;
  if (!veil) return;
  for (const animation of veil.getAnimations?.() ?? []) animation.cancel();
  veil.remove();
  veil = null;
}
