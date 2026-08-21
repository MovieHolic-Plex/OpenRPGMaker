/* 전투 애니메이션 앵커 회귀 가드.
 *
 * 실측으로 확정된 결함(지금은 고쳐진 상태):
 * `.battle-animation` 이 width/height 0 인데 `transform: translate(-50%, -55%)` 가 걸려 있어
 * 퍼센트 translate 가 (0, 0) 으로 무효였다. 자식 `.battle-animation-sheet` 는 240×240 인플로우
 * 요소라 앵커에서 오른쪽·아래로 뻗고, 셀은 battleAnimationDom.ts 가
 * `left: calc(50% + x*2px)`(= 시트의 50% = 120px) 로 심는다. 결과: 애니메이션 중심이 대상
 * 배틀러가 아니라 배틀러 +120, +120 논리px 에 놓였다(논리 320 시절엔 +60, +60).
 * 수정: battle.css `.battle-animation` 에 `width/height: 240px` 를 주어 translate 가 동작하게 했다.
 *
 * 두 번째 결함(이것도 지금은 고쳐진 상태):
 * `--battle-node-x/y` 는 백분율("35%"/"65%")인데 이를 소비하는 두 요소의 컨테이닝 블록이
 * 달랐다. `.battle-animation-layer` 는 `grid-row: 1`(끝선 auto)이었고, **절대배치** 그리드
 * 아이템의 auto 끝선은 span 1 이 아니라 그리드 컨테이너의 패딩 끝선으로 풀리므로 레이어
 * 박스가 [top 0, height 480](씬 전체)이 됐다. 반면 `.battle-enemy-group` 은 `.battle-field`
 * 패딩 박스 + 무대 여백 = [top 50, height 292] 였다. 같은 65% 가 312 vs 240 으로 풀려
 * 애니메이션이 적 스프라이트(y 88~200) 아래 바깥(셀 중심 y 308)에 그려졌다.
 * 수정: battle.css `.battle-animation-layer` 에 `grid-row: 1 / 2` + 필드 테두리
 * (`--battle-field-border-width`)와 무대 여백(`--battle-stage-inset-top`)만큼의 inset 을 주어
 * 레이어 박스를 그룹 박스와 일치시켰다. 실측: layer == enemyGroup == [50, 292], dy 68 → -4.
 *
 * 이 가드는 그 수정이 브라우저에서 실제로 유지되는지를 실제 플레이 경로로 확인한다.
 * 음성 대조(negative control)로 검증했다: `.battle-animation { width: 0; height: 0 }` 를
 * 주입하면 셀이 박스 중심에서 +120, +120 논리px 로 밀리고 세 단정 묶음이 모두 깨진다(실측).
 *
 * 좌표계 함정: getBoundingClientRect() 는 조상 transform 이 곱해진 **시각 px** 다. 전투 씬은
 * 논리 640×480 을 `transform: scale()` 로 그리므로, 논리 px 로 환산하려면 640 / sceneRect.width 를
 * 곱해야 한다. getComputedStyle 의 px 는 이미 논리 px 이므로 곱하면 안 된다.
 */
import { expect, test } from "@playwright/test";
import { confirmBattleTarget, seedAnimationAnchorBattleProject } from "./battleReferenceProject";
import { startNewGameFromTitle } from "./runtimeInput";

/* ── 임계값 상수 (실측 기반) ───────────────────────────────────────────────
   1280×900 창 · 누적 배율 1 · 논리 640×480 · 기본 스킨(vxace) 실측:
     dxLogical 12 · dyLogical -4 · cellVsBox (12, 8)
     layer [top 50, height 292] == enemyGroup [top 50, height 292]
   dx 12 / cellVsBox (12, 8) 은 컨테이너 불일치가 아니라 **셀 자신의 크기** 때문이다 —
   셀은 `left/top: calc(50% + 0px)` 로 좌상단이 시트 중심에 놓이고 centering translate 가
   없으므로, 셀 중심은 박스 중심 + (셀폭/2, 셀높이/2) = (+12, +8) 이다.
   dy -4 = -5%×240(= -12, translate(-50%,-55%)) + 셀 높이 절반(+8). */
const LOGICAL_WIDTH = 640;
// 시트 크기 = 애니메이션 박스 크기. 0 으로 회귀하면 퍼센트 translate 가 죽는다.
const ANIMATION_BOX_SIZE = 240;
// 실측 12 / -4 → 20 으로 조인다(수정 전 dy 68 은 확실히 잡힌다).
const MAX_DX_LOGICAL = 20;
const MAX_DY_LOGICAL = 20;
// 셀 중심과 애니메이션 박스 중심의 차이는 셀 크기 절반(실측 12, 8)뿐이어야 한다.
// 0×0 회귀 시 +120.
const MAX_CELL_VS_BOX_LOGICAL = 20;
/* 구조적 가드 — 애니메이션 레이어와 배틀러 그룹의 **컨테이닝 블록이 같은 박스** 여야
   `--battle-node-x/y`(백분율)가 같은 점으로 풀린다. 어긋나면 레이어의 그리드 영역이
   씬 전체로 부풀었던 예전 결함(72px 하향 오프셋)이 되돌아온 것이다. 반올림 오차만 허용. */
const MAX_STAGE_BOX_DELTA_LOGICAL = 1;

type AnchorProbe = {
  readonly cumulativeScale: number;
  /* 셀 중심 - 대상 배틀러 앵커 (논리 px). 이게 가드 대상이다. */
  readonly dxLogical: number;
  readonly dyLogical: number;
  /* 셀 중심 - 대상 스프라이트 bbox 중심 (논리 px). 진단용 — 적 노드는 발밑 앵커라
     스프라이트 중심과 앵커는 설계상 스프라이트 높이의 절반만큼 어긋난다. */
  readonly spriteCenterDxLogical: number;
  readonly spriteCenterDyLogical: number;
  /* 적 노드 기하(논리 px) — 앵커가 노드 하단 중앙인지 확인하는 근거 */
  readonly enemyNodeHeightLogical: number;
  readonly spriteHeightLogical: number;
  readonly nodeStyleX: string;
  readonly nodeStyleY: string;
  /* getComputedStyle 값 — 이미 논리 px */
  readonly animationBoxWidth: number;
  readonly animationBoxHeight: number;
  readonly cellStyleLeft: string;
  readonly cellStyleTop: string;
  readonly spriteSelector: string;
  /* 셀 중심 - `.battle-animation` 박스 중심 (논리 px). 컨테이너와 무관하게
     퍼센트 translate 가 실제로 먹었는지만 보는 값 — 0×0 회귀 시 +120 이 된다. */
  readonly cellVsBoxDxLogical: number;
  readonly cellVsBoxDyLogical: number;
  /* 진단: 씬 상단 기준 [top, height] 논리 px. 애니메이션 레이어와 적 그룹의
     퍼센트 기준 박스가 다르면 같은 35%/65% 가 다른 점으로 풀린다. */
  readonly containerGeometry: string;
  /* 가드: 레이어 박스 − 적 그룹 박스 (논리 px). 컨테이닝 블록 일치 여부 그 자체. */
  readonly stageBoxDeltaTopLogical: number;
  readonly stageBoxDeltaHeightLogical: number;
  readonly stageBoxDeltaLeftLogical: number;
  readonly stageBoxDeltaWidthLogical: number;
};

// 애니메이션은 짧으므로(1프레임) 폴링으로는 프레임을 놓칠 수 있다. 대상 확정 **전에**
// rAF 루프를 심어, `.battle-animation-cell` 이 처음 보이는 프레임에서 즉시 계측한다.
const installAnchorProbe = (options: { readonly enemyTestId: string; readonly logicalWidth: number }): void => {
  const { enemyTestId, logicalWidth } = options;
  const scope = window as unknown as {
    __anchorProbe?: AnchorProbe;
    __anchorProbeError?: string;
    __anchorProbeFrames?: number;
  };
  delete scope.__anchorProbe;
  delete scope.__anchorProbeError;
  scope.__anchorProbeFrames = 0;

  const numeric = (value: string): number => Number.parseFloat(value) || 0;

  const tick = (): void => {
    scope.__anchorProbeFrames = (scope.__anchorProbeFrames ?? 0) + 1;
    if (!scope.__anchorProbe) {
      // 보이는 프레임의 셀만 본다 — 숨은 프레임의 셀도 DOM 에 남아 있다.
      const cell = document.querySelector<HTMLElement>(
        ".battle-animation-frame:not([hidden]) [data-testid='battle-animation-cell']"
      );
      const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
      const animation = document.querySelector<HTMLElement>("[data-testid='battle-animation']");
      const enemy = document.querySelector<HTMLElement>(`.battle-enemy[data-testid='${enemyTestId}']`);
      if (cell && scene && animation && enemy) {
        const sceneRect = scene.getBoundingClientRect();
        if (sceneRect.width > 0) {
          const toLogical = logicalWidth / sceneRect.width;
          const rectOf = (selector: string): readonly number[] => {
            const node = document.querySelector<HTMLElement>(selector);
            if (!node) return [];
            const rect = node.getBoundingClientRect();
            return [Math.round((rect.top - sceneRect.top) * toLogical), Math.round(rect.height * toLogical)];
          };
          const boxOf = (selector: string): DOMRect | undefined =>
            document.querySelector<HTMLElement>(selector)?.getBoundingClientRect();
          const layerBox = boxOf(".battle-animation-layer");
          const groupBox = boxOf(".battle-enemy-group");
          const boxDelta = (pick: (rect: DOMRect) => number): number =>
            layerBox && groupBox ? Math.round((pick(layerBox) - pick(groupBox)) * toLogical) : 9999;
          const sprite = enemy.querySelector<HTMLElement>(".battle-enemy-image");
          const spriteNode = sprite ?? enemy;
          const spriteRect = spriteNode.getBoundingClientRect();
          const cellRect = cell.getBoundingClientRect();
          const cellCenterX = cellRect.left + cellRect.width / 2;
          const cellCenterY = cellRect.top + cellRect.height / 2;
          const animationStyle = getComputedStyle(animation);
          const animationRect = animation.getBoundingClientRect();
          const enemyRect = enemy.getBoundingClientRect();
          // 배틀러 앵커 = `--battle-node-x/y`. `.battle-enemy` 는 left/top 이 그 값이고
          // `transform: translate(-50%, -100%)` 라(battle.css) 앵커는 노드 박스의
          // **하단 중앙** 이다. 그래서 rect 로 앵커를 직접 되짚을 수 있고, 조상 scale 이
          // 곱해진 시각 px 끼리 비교하므로 좌표계가 섞이지 않는다.
          const anchorX = enemyRect.left + enemyRect.width / 2;
          const anchorY = enemyRect.bottom;
          scope.__anchorProbe = {
            cumulativeScale: Math.round((sceneRect.width / logicalWidth) * 1000) / 1000,
            dxLogical: Math.round((cellCenterX - anchorX) * toLogical),
            dyLogical: Math.round((cellCenterY - anchorY) * toLogical),
            spriteCenterDxLogical: Math.round((cellCenterX - (spriteRect.left + spriteRect.width / 2)) * toLogical),
            spriteCenterDyLogical: Math.round((cellCenterY - (spriteRect.top + spriteRect.height / 2)) * toLogical),
            enemyNodeHeightLogical: Math.round(enemyRect.height * toLogical),
            spriteHeightLogical: Math.round(spriteRect.height * toLogical),
            nodeStyleX: enemy.style.getPropertyValue("--battle-node-x"),
            nodeStyleY: enemy.style.getPropertyValue("--battle-node-y"),
            animationBoxWidth: Math.round(numeric(animationStyle.width)),
            animationBoxHeight: Math.round(numeric(animationStyle.height)),
            cellStyleLeft: cell.style.left,
            cellStyleTop: cell.style.top,
            spriteSelector: sprite ? ".battle-enemy-image" : ".battle-enemy",
            cellVsBoxDxLogical: Math.round((cellCenterX - (animationRect.left + animationRect.width / 2)) * toLogical),
            cellVsBoxDyLogical: Math.round((cellCenterY - (animationRect.top + animationRect.height / 2)) * toLogical),
            containerGeometry: JSON.stringify({
              layer: rectOf(".battle-animation-layer"),
              enemyGroup: rectOf(".battle-enemy-group"),
              animation: [Math.round((animationRect.top - sceneRect.top) * toLogical), Math.round(animationRect.height * toLogical)],
              enemy: [Math.round((enemyRect.top - sceneRect.top) * toLogical), Math.round(enemyRect.height * toLogical)],
              sprite: [Math.round((spriteRect.top - sceneRect.top) * toLogical), Math.round(spriteRect.height * toLogical)],
              cellCenterY: Math.round((cellCenterY - sceneRect.top) * toLogical),
            }),
            stageBoxDeltaTopLogical: boxDelta((rect) => rect.top),
            stageBoxDeltaHeightLogical: boxDelta((rect) => rect.height),
            stageBoxDeltaLeftLogical: boxDelta((rect) => rect.left),
            stageBoxDeltaWidthLogical: boxDelta((rect) => rect.width),
          };
        }
      }
    }
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.setViewportSize({ width: 1280, height: 900 });
});

test("battle animation cells land on the target battler anchor", async ({ page }) => {
  test.setTimeout(150_000);
  await seedAnimationAnchorBattleProject(page);
  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("test-play-window")).toBeVisible();
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-canvas")).toBeVisible();

  await page.click('[data-testid="event-battle-start"]');
  await expect(page.getByTestId("battle-scene")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("actor-command-skill")).toBeVisible({ timeout: 25_000 });

  await page.evaluate(installAnchorProbe, { enemyTestId: "enemy-1", logicalWidth: LOGICAL_WIDTH });

  await page.getByTestId("actor-command-skill").click();
  const probeSkill = page.getByTestId("actor-skill-skill_anchor_probe");
  await expect(probeSkill).toBeVisible({ timeout: 10_000 });
  await expect(probeSkill).toHaveAttribute("data-battle-command-cursor", "true");
  await probeSkill.evaluate((button) => (button as HTMLButtonElement).click());
  await expect(page.getByTestId("battle-scene")).toHaveAttribute("data-battle-phase", "targetSelect", {
    timeout: 10_000,
  });
  await confirmBattleTarget(page);

  // 애니메이션은 짧다. 촘촘한 간격으로 충분히 반복해 rAF 계측 결과가 기록됐는지 확인한다.
  let probe: AnchorProbe | undefined;
  for (let attempt = 0; attempt < 400 && !probe; attempt += 1) {
    probe = await page.evaluate(
      () => (window as unknown as { __anchorProbe?: AnchorProbe }).__anchorProbe
    );
    if (!probe) await page.waitForTimeout(50);
  }

  if (!probe) {
    // 셀이 없으면 절대 조용히 통과시키지 않는다 — 가드가 죽으면 회귀를 못 잡는다.
    const diagnostics = await page.evaluate(() => {
      const scene = document.querySelector<HTMLElement>("[data-testid='battle-scene']");
      const animation = document.querySelector<HTMLElement>("[data-testid='battle-animation']");
      return {
        rafFrames: (window as unknown as { __anchorProbeFrames?: number }).__anchorProbeFrames ?? 0,
        sceneMounted: Boolean(scene),
        directorStep: scene?.dataset.battleDirectorStep ?? null,
        battlePhase: scene?.dataset.battlePhase ?? null,
        animationMounted: Boolean(animation),
        animationId: animation?.dataset.animationId ?? null,
        renderedFrameCount: animation?.dataset.renderedFrameCount ?? null,
        cellCount: document.querySelectorAll("[data-testid='battle-animation-cell']").length,
        enemyMounted: Boolean(document.querySelector(".battle-enemy[data-testid='enemy-1']")),
      };
    });
    throw new Error(
      `battle-animation-cell never appeared — 앵커 가드를 검증할 수 없다. ` +
        `renderedFrameCount 가 null 이면 battleAnimationDom.mountBattleAnimationPlayback 이 ` +
        `자산 URL(resolveAssetResourceUrl) 또는 record.sheet/frames 가 없어 시트를 만들지 않은 것이다. ` +
        `진단: ${JSON.stringify(diagnostics)}`
    );
  }

  console.log(`anchor probe: ${JSON.stringify(probe)}`);

  // 1) CSS 수정 자체의 가드 — 박스가 0 으로 되돌아가면 퍼센트 translate 가 죽는다.
  expect(probe.animationBoxWidth).toBe(ANIMATION_BOX_SIZE);
  expect(probe.animationBoxHeight).toBe(ANIMATION_BOX_SIZE);
  // 셀은 시트 50% 기준으로 심긴다(x = 0 이므로 오프셋 0).
  expect(probe.cellStyleLeft).toBe("calc(50% + 0px)");
  expect(probe.cellStyleTop).toBe("calc(50% + 0px)");

  // 2) translate 가 실제로 먹었는지 — 컨테이너와 무관한 직접 가드.
  //    셀은 시트 중심에 놓이므로 애니메이션 박스 중심과 겹쳐야 한다. 0×0 회귀가 나면
  //    박스 rect 는 앵커에 붙은 0×0 이 되고 셀은 +120, +120 이라 여기서 바로 깨진다.
  //    실측(수정 후): dx 12, dy 8.
  expect(Math.abs(probe.cellVsBoxDxLogical)).toBeLessThan(MAX_CELL_VS_BOX_LOGICAL);
  expect(Math.abs(probe.cellVsBoxDyLogical)).toBeLessThan(MAX_CELL_VS_BOX_LOGICAL);

  // 3) 앵커 가드 — 셀 중심이 대상 배틀러 앵커(노드 하단 중앙)에서 크게 벗어나지 않아야 한다.
  //    positionAnimationOnTarget(battleAnimationDom.ts:98) 이 대상 노드의
  //    `--battle-node-x/y` 를 그대로 복사하므로, 애니메이션의 기준점은 정의상 이 앵커다.
  //    `.battle-enemy` 는 left/top = 그 앵커 + `translate(-50%, -100%)`(battle.css:126) 이라
  //    앵커는 노드 박스의 하단 중앙 = rect 로 직접 되짚을 수 있다.
  //    회귀(퍼센트 translate 무효)가 나면 셀이 앵커 +120, +120 으로 밀려 두 단정이 깨진다.
  //
  //    실측(수정 후): dx 12, dy -4 — 둘 다 셀 자신의 크기 절반에서 오는 잔차뿐이다.
  expect(Math.abs(probe.dxLogical)).toBeLessThan(MAX_DX_LOGICAL);
  expect(Math.abs(probe.dyLogical)).toBeLessThan(MAX_DY_LOGICAL);

  // 4) 구조적 가드 — 컨테이닝 블록 일치. `--battle-node-x/y` 가 퍼센트라, 레이어와 적 그룹의
  //    퍼센트 기준 박스가 같아야 같은 35%/65% 가 같은 점으로 풀린다.
  //    수정 전에는 레이어가 [top 0, height 480](씬 전체)이고 그룹이 [top 50, height 292] 라
  //    72px 어긋났다. 원인: `.battle-animation-layer` 의 `grid-row: 1` 은 끝선이 auto 인데,
  //    **절대배치** 그리드 아이템의 auto 끝선은 span 1 이 아니라 그리드 컨테이너의 패딩
  //    끝선으로 풀린다. 수정: `grid-row: 1 / 2` + 필드 테두리/무대 여백만큼의 inset
  //    (battle.css `.battle-animation-layer`).
  expect(Math.abs(probe.stageBoxDeltaTopLogical)).toBeLessThanOrEqual(MAX_STAGE_BOX_DELTA_LOGICAL);
  expect(Math.abs(probe.stageBoxDeltaHeightLogical)).toBeLessThanOrEqual(MAX_STAGE_BOX_DELTA_LOGICAL);
  expect(Math.abs(probe.stageBoxDeltaLeftLogical)).toBeLessThanOrEqual(MAX_STAGE_BOX_DELTA_LOGICAL);
  expect(Math.abs(probe.stageBoxDeltaWidthLogical)).toBeLessThanOrEqual(MAX_STAGE_BOX_DELTA_LOGICAL);
});
