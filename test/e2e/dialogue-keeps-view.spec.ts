// 대화 중에도 게임 화면이 보이는지 지키는 회귀 테스트.
//
// ── 있었던 결함(2026-07-26 실측, 헤드리스·헤드 모두 재현) ─────────────────────────
// NPC 와 대화하면 재생 창이 완전히 검게 됐다. 캔버스가 뷰포트 밖으로 나갔다:
//     대화 전   canvas rect [320, 225]      대화 중   canvas rect [-1136, -1311]
//
// ── 원인 ──────────────────────────────────────────────────────────────────────
// `.play-stage` 가 **스크롤됐다**(대화 중 `scroll = 728,768` — 캔버스 국소 변위 -728,-768 과
// 정확히 일치, scale(2) 이므로 화면상 -1456,-1536). 두 조건이 겹쳐 발생한다:
//   1. 이벤트 마커(.runtime-debug-marker)가 **맵 타일 좌표**에 놓였다(카메라 오프셋 없음).
//      100×100 맵에서 무대의 스크롤 콘텐츠가 1552×1552 로 부풀었다(client 는 320×240).
//   2. `.play-stage` 는 `overflow: hidden` — 잘라내지만 **여전히 스크롤 컨테이너**다.
//      그래서 화면 밖 마커를 클릭하면 브라우저가 그것을 보이게 하려고 무대를 스크롤했다.
// 스크롤은 자식만 옮기고 컨테이너 rect 는 그대로여서, 측정이 자기모순처럼 보였다.
//
// ── 수정 ──────────────────────────────────────────────────────────────────────
// 마커를 **카메라 상대(화면) 좌표**로 놓고(runtimeDom.syncCameraOffset, PlayScene.update 에서
// 매 프레임 갱신), 무대 밖 마커는 좌상단으로 접고 `visibility: hidden` +
// `pointer-events: none` 으로 비활성화한다. 그러면 스크롤 오버플로 자체가 생기지 않는다.
// 덤으로 히트박스가 실제 NPC 스프라이트 위치와 맞게 됐다 — 이전에는 카메라 보정이 없어 어긋났다.
//
// 시도했다가 버린 두 가지(둘 다 다른 것을 깨뜨렸다):
//   · `.play-stage { overflow: clip }` → 검은 화면은 막히지만 화면 밖 마커 클릭이 타임아웃.
//   · scroll 이벤트에서 scrollLeft/Top 을 0 으로 되돌리는 가드 → 같은 이유로 클릭이 깨진다.
// 둘 다 "화면 밖 마커를 클릭 가능하게 둔다" 는 전제를 유지한 채 스크롤만 막으려 한 것이 원인이다.
import { expect, test } from "@playwright/test";
import { createSampleAdventureProject } from "@/project/defaults";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test.setTimeout(120_000);
test.use({ serviceWorkers: "block" });

test("대화 중에도 게임 화면이 재생 창 안에 남아 있다", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectFromSupabaseCanonical(page, createSampleAdventureProject());
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 20_000 });
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(1200);

  /** 캔버스가 재생 창 사각형과 겹치는지 — 겹치지 않으면 사용자에게 검은 화면이다. */
  const canvasInsideWindow = async (): Promise<{ inside: boolean; canvas: number[]; win: number[] }> =>
    await page.evaluate(() => {
      const win = document.querySelector("[data-testid='test-play-window']") as HTMLElement;
      const canvas = win.querySelector("canvas") as HTMLElement;
      const w = win.getBoundingClientRect();
      const c = canvas.getBoundingClientRect();
      return {
        inside: c.right > w.left && c.left < w.right && c.bottom > w.top && c.top < w.bottom,
        canvas: [Math.round(c.x), Math.round(c.y), Math.round(c.width), Math.round(c.height)],
        win: [Math.round(w.x), Math.round(w.y), Math.round(w.width), Math.round(w.height)],
      };
    });

  /** 무대는 어떤 경우에도 스크롤돼 있어서는 안 된다 — 스크롤이 곧 검은 화면이다. */
  const stageScroll = async (): Promise<number[]> =>
    await page.evaluate(() => {
      const stage = document.querySelector("[data-testid='test-play-window'] .play-stage") as HTMLElement;
      return [stage.scrollLeft, stage.scrollTop];
    });

  const before = await canvasInsideWindow();
  expect(before.inside, `대화 전부터 어긋남: canvas=${JSON.stringify(before.canvas)}`).toBe(true);
  expect(await stageScroll(), "대화 전부터 무대가 스크롤돼 있다").toEqual([0, 0]);

  await page.getByTestId("event-ev_kid").click({ force: true });
  await expect(page.getByTestId("dialogue-box")).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(600);

  const during = await canvasInsideWindow();
  expect(
    during.inside,
    `대화 중 캔버스가 창 밖으로 나갔다: canvas=${JSON.stringify(during.canvas)} win=${JSON.stringify(during.win)}`,
  ).toBe(true);
  // 근본 원인을 직접 지킨다 — 증상(캔버스 위치)만 보면 다른 경로로 재발할 수 있다.
  expect(await stageScroll(), "무대가 스크롤됐다 — 마커가 화면 밖에 놓였을 가능성").toEqual([0, 0]);
});
