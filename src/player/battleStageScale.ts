// 전투 화면의 논리 해상도 스케일링.
//
// 왜 필요한가 (실측): 전투 UI 는 DOM 이라 리터럴 px 로 그려진다. 그런데 예전에는 씬이
// 컨테이너에 transform 없이 1배로 붙어서, 스킨이 의도한 치수가 화면에서 절반으로 보였다
// (명령 레일 84px = 320 화면의 26% 인데 640 화면에서는 13%; 주인공 스프라이트 30×36).
//
// 맵은 Phaser 가 320×240 을 캔버스 배율로 키워 이 문제가 없고, playSurface.ts 가
// `--play-scale` 로 같은 일을 한다. 전투 화면은 그 뷰포트 밖(.test-play-modal-body 등)에
// 마운트되므로 그 변수를 못 받는다. 그래서 같은 방식을 전투에도 붙인다.
//
// 방식: 씬의 레이아웃 박스를 논리 해상도로 고정하고 컨테이너에 맞춰 transform: scale 한다.
// 정수 배율을 우선해 픽셀아트가 흐려지지 않게 하고, 정수로는 남는 여백이 크면 소수 배율을 쓴다.
//
// ── 논리 해상도를 640×480 으로 올린 이유 (320×240 에서 옮겨왔다) ──────────────
// 맵은 320×240(RM2003 해상도)이지만 **전투 화면만** 640×480 을 쓴다. 전투 UI 는 픽셀아트가
// 아니라 DOM 텍스트·창이고, 320 논리 좌표에서는 표현할 수 있는 최소 단위가 너무 컸다:
// VX Ace 계열 UI 를 옮기려니 명령 글자가 논리 8px, 적 번호 배지 숫자가 논리 4px 이 되어
// 참조 비율대로 줄이면 읽히지 않았다(실측). 640 에서는 같은 비율이 16px / 8px 이 된다.
//
// 화면에 나오는 크기는 그대로다 — 논리값이 2배가 되고 배율이 절반이 되어 상쇄된다.
// 두 마운트 경로 모두 정확히 맞는다(test/e2e/battle-stage-scale.spec.ts 가 가드):
//   · 실제 플레이  host 레이아웃 320×240(조상이 이미 scale 2) → 자체 배율 0.5 → 시각 640×480
//   · 전투 테스트  host 레이아웃 640×480(조상 transform 없음) → 자체 배율 1.0 → 시각 640×480
//
// 주의: 자산 px(스프라이트 시트 프레임, 애니메이션 셀 좌표)는 320 시대 기준이므로
// 논리 px 로 옮길 때 BATTLE_ASSET_PIXEL_SCALE 을 곱해야 한다.

export const BATTLE_LOGICAL_WIDTH = 640;
export const BATTLE_LOGICAL_HEIGHT = 480;

/** 자산 px(320×240 시대 기준) → 논리 px 환산 계수. 640×480 논리 해상도에서 1 자산 px = 2 논리 px. */
export const BATTLE_ASSET_PIXEL_SCALE = 2;

/**
 * 컨테이너 크기에 맞는 배율. 정수 배율이 컨테이너의 88% 이상을 채우면 정수를 쓴다
 * (픽셀 보간 없음). 그렇지 않으면 꽉 채우는 소수 배율을 쓴다.
 */
export function calculateBattleStageScale(width: number, height: number): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 1;
  const exact = Math.min(width / BATTLE_LOGICAL_WIDTH, height / BATTLE_LOGICAL_HEIGHT);
  if (exact <= 0) return 1;
  const integer = Math.floor(exact);
  if (integer >= 1 && integer / exact >= 0.88) return integer;
  return Math.max(0.5, exact);
}

type ScaleBinding = { readonly sync: () => void; readonly cleanup: () => void };

/**
 * host 크기를 관찰해 scene 에 `--battle-stage-scale` 과 중앙 정렬 오프셋을 세팅한다.
 * scene 은 CSS 에서 640×480 고정 + transform-origin: top left 를 전제로 한다.
 */
export function bindBattleStageScale(host: HTMLElement, scene: HTMLElement): ScaleBinding {
  const sync = (): void => {
    // **레이아웃 크기**(clientWidth/Height)를 쓴다. getBoundingClientRect 는 조상의 transform 이
    // 곱해진 시각 크기를 돌려주는데, 실제 플레이 경로에서 host 는 `.play-stage`(레이아웃 320×240,
    // 이미 `scale(--play-scale)` 적용) 안에 있다. 거기서 rect 를 읽으면 조상 배율이 곱해진 시각
    // 크기(640×480)가 나와 그걸 또 확대한다. 이 실수의 결과는 측정 시점의 논리 해상도에 따라 달라진다:
    //   - 논리 320 시절 **실측**: rect 640×480 을 논리 320×240 으로 나눠 배율 2 가 나오고, 조상 배율 2 와
    //     합쳐 **총 4×** 였다.
    //   - 현재(논리 640) **계산값**: rect 640×480 을 논리 640×480 으로 나눠 배율 1.0, 조상 배율 2 와 합쳐
    //     **총 2×** 가 되고 화면 좌상단 1/4 만 보인다. 이건 다시 계산한 값이지 실측이 아니다.
    // 측정값과 계산값을 섞지 말 것 — 어느 쪽이 어느 해상도에서 나온 값인지 위에 명시했다.
    // 레이아웃 크기로 읽으면 플레이 경로는 320×240 → 배율 0.5(조상이 이미 확대),
    // 전투 테스트 모달(레이아웃 640×480)은 배율 1.0 으로 각각 맞는다.
    const width = host.clientWidth || host.offsetWidth;
    const height = host.clientHeight || host.offsetHeight;
    const scale = calculateBattleStageScale(width, height);
    // transform-origin 이 top left 라 스케일 후 남는 여백을 직접 반으로 나눠 중앙에 놓는다.
    const offsetX = Math.max(0, (width - BATTLE_LOGICAL_WIDTH * scale) / 2);
    const offsetY = Math.max(0, (height - BATTLE_LOGICAL_HEIGHT * scale) / 2);
    scene.style.setProperty("--battle-stage-scale", String(scale));
    scene.style.setProperty("--battle-stage-offset-x", `${Math.round(offsetX)}px`);
    scene.style.setProperty("--battle-stage-offset-y", `${Math.round(offsetY)}px`);
    scene.dataset.battleStageScale = scale.toFixed(3);
  };

  sync();
  const frame = requestAnimationFrame(sync);
  let observer: ResizeObserver | null = null;
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(sync);
    observer.observe(host);
  }
  return {
    sync,
    cleanup: () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    },
  };
}
