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
// 전체 UI가 잘리지 않는 최대 균일 배율을 쓴다. 비율 차이로 남는 여백은 battle-stage가 덮는다.
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
 * 배틀러 도트 정수 배율. 자산 1px 이 host 레이아웃 px(= 게임 px) 몇 개로 그려지는지를 정수로 맞추는
 * 필드 zoom 을 돌려준다. 무대 배율 s 에서 자산 1px = 2·s 게임 px 인데, 640×360 은 1.5, 480×270 은 1.125
 * 라 선이 번졌다(2026-10-20 battle-feel 녹화 실측). 가장 가까운 정수 n(최소 1)으로 맞춘다: zoom = n / (2·s).
 *   640×360 → s 0.75, n 2, zoom 1.333 · 480×270 → s 0.5625, n 1, zoom 0.889 · 320×240 → s 0.5, n 1, zoom 1
 * 전투 테스트 모달(host 640×480, 조상 배율 없음)은 s 1 → n 2 → zoom 1 로 그대로다.
 */
export function calculateBattleAssetZoom(stageScale: number): { readonly zoom: number; readonly pixels: number } {
  const exact = BATTLE_ASSET_PIXEL_SCALE * stageScale;
  if (!Number.isFinite(exact) || exact <= 0) return { zoom: 1, pixels: BATTLE_ASSET_PIXEL_SCALE };
  const pixels = Math.max(1, Math.round(exact));
  return { zoom: pixels / exact, pixels };
}

/** 넓은 화면(16:9) 게임에서 도트 측면 전투가 쓰는 최대 논리 폭. 480 × 16/9 ≈ 853.3. */
export const BATTLE_WIDE_LOGICAL_WIDTH_MAX = 854;

/**
 * 전투 무대의 논리 폭. 높이는 480 으로 두고 폭만 host 비율을 따른다(640~854).
 * 2026-10-20 battle-feel: 새 프로젝트 기본이 640×360(16:9)이 된 뒤 4:3 무대가 가운데에 떠
 * 좌우 25% 가 남색 띠였다(출하 player 녹화 실측). 도트 측면 전투만 넓힌다 — 배틀러 좌표는
 * 무대 폭의 백분율이라 그대로 넓게 퍼지고, 그림 칸은 px 라 늘어나지 않는다.
 */
export function calculateBattleStageWidth(width: number, height: number, wide: boolean): number {
  if (!wide || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return BATTLE_LOGICAL_WIDTH;
  const fit = Math.round(BATTLE_LOGICAL_HEIGHT * (width / height));
  return Math.max(BATTLE_LOGICAL_WIDTH, Math.min(BATTLE_WIDE_LOGICAL_WIDTH_MAX, fit));
}

/** Largest uniform fit without cropping; the host's own transform is applied once by its parent. */
export function calculateBattleStageScale(width: number, height: number, logicalWidth = BATTLE_LOGICAL_WIDTH): number {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return 1;
  return Math.min(width / logicalWidth, height / BATTLE_LOGICAL_HEIGHT);
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
    const logicalWidth = calculateBattleStageWidth(width, height, scene.dataset.battleMotion === "retro");
    const fit = calculateBattleStageScale(width, height, logicalWidth);
    // 확대할 때는 1/4 단위로 내린다. 1.167·1.707 같은 배율에서는 도트 글꼴(12·16·20px)이 23.3·34.1px 처럼 소수 크기로
    // 그려져 「할」「킬」의 획이 뭉개졌다(HIG C-98). 1/4 단위면 이 글자 크기들이 모두 정수 px 이다. 남는 여백은 아래 중앙 정렬과
    // battle-stage 바탕이 덮는다. 축소(플레이 경로의 0.5 등)는 조상 배율이 맞추므로 그대로 둔다.
    const scale = fit >= 1 ? Math.floor(fit * 4) / 4 : fit;
    // transform-origin 이 top left 라 스케일 후 남는 여백을 직접 반으로 나눠 중앙에 놓는다.
    const offsetX = Math.max(0, (width - logicalWidth * scale) / 2);
    const offsetY = Math.max(0, (height - BATTLE_LOGICAL_HEIGHT * scale) / 2);
    scene.style.setProperty("--battle-stage-width", `${logicalWidth}px`);
    if (logicalWidth !== BATTLE_LOGICAL_WIDTH) scene.dataset.battleStageWide = "true";
    else delete scene.dataset.battleStageWide;
    scene.style.setProperty("--battle-stage-scale", String(scale));
    scene.style.setProperty("--battle-stage-offset-x", `${offsetX}px`);
    scene.style.setProperty("--battle-stage-offset-y", `${offsetY}px`);
    scene.dataset.battleStageScale = scale.toFixed(3);
    // 도트 측면 전투만: 배틀러 필드를 정수 배율로 맞춘다(calculateBattleAssetZoom).
    if (scene.dataset.battleMotion === "retro") {
      const asset = calculateBattleAssetZoom(scale);
      scene.style.setProperty("--battle-asset-zoom", String(asset.zoom));
      scene.dataset.battleAssetScale = String(asset.pixels);
    } else {
      scene.style.removeProperty("--battle-asset-zoom");
      delete scene.dataset.battleAssetScale;
    }
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
