// test/e2e/responsive-shell.spec.ts
// 스펙 §5 검증: 1024/1280/1440에서 기본·전문가 모드 줄바꿈·잘림·겹침 없음.
//
// 조수 띠로 넘어오면서 이 파일의 축이 하나 줄었다. 원래는 `dock ∈ {side, float}` 를 돌면서
// **접힘 상태**를 씨딩하고, 복귀 알약(`ai-collapsed-restore`)을 눌러 컴포저가 돌아오는지 봤다.
// 이제 배치가 하나고 접힘이 없다 — 컴포저는 유휴 56px 띠에 **상주**하므로, 되살릴 것이 없고
// 대신 "상주하는 그것이 어느 뷰포트에서도 잘리거나 겹치지 않는가" 가 계약이 된다.
import { expect, test, type Locator } from "@playwright/test";
import { writeFile } from "node:fs/promises";

type Box = { x: number; y: number; width: number; height: number };

/**
 * `boundingBox()` 가 null 을 그만 돌려줄 때까지 다시 읽는다.
 *
 * `toBeVisible()` 을 통과한 직후에도 null 이 나온다 — `__oprnEditorUiMode.set()` 이 셸을
 * 통째로 다시 그리므로, 가시성 검사와 박스 읽기 사이에 노드가 교체되면 그 사이에 낀 읽기가
 * null 로 떨어진다. `boundingBox()` 는 다른 어서션과 달리 재시도하지 않아서 그대로 실패한다.
 * 실제로 1024·1440 만 이 레이스에 걸리고 1280 은 운으로 통과해, 실패가 뷰포트 탓처럼 보였다.
 */
async function boxOf(locator: Locator, label: string): Promise<Box> {
  await expect(locator, `${label} 가 보이지 않는다`).toBeVisible();
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const box = await locator.boundingBox();
    if (box && box.width > 0 && box.height > 0) return box;
    await locator.page().waitForTimeout(200);
  }
  throw new Error(`${label} 의 boundingBox 가 5s 동안 계속 null 이다 — 셸이 계속 다시 그려진다.`);
}

const SIZES = [
  { name: "1024", width: 1024, height: 768 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
] as const;

const EDITOR_LAYOUT_VERSION_KEY = "oprn:editor-layout-version";
const EDITOR_LAYOUT_VERSION = "2026-07-24-maptree-300";

/** 스펙 §2 의 유휴 높이·상한. CSS 는 `--ai-strip-idle-height` / `--ai-strip-max-height`. */
const IDLE_HEIGHT = 56;
const MAX_HEIGHT = 480;

for (const size of SIZES) {
  for (const mode of ["basic", "expert"] as const) {
    test(`${mode} ${size.name}px 조수 띠가 잘림·겹침 없이 상주한다`, async ({ page }, testInfo) => {
      // 기본 30s 로는 편집기 부팅(60~90s)을 못 넘긴다. 예전 판은 `editor-layout` 이 뜨자마자
      // 끝나는 검사뿐이라 턱걸이로 통과했지만, 띠 기하를 재려면 캔버스가 실제로 마운트돼야 한다.
      test.setTimeout(180_000);
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.addInitScript(
        ({ layoutVersionKey, layoutVersion }) => {
          // 버전 키만 심는다. 예전에는 `oprn:editor-layout:v4` 에 `{ chatDock }` 를 넣었는데
          // 그 필드는 저장 스키마에서 사라졌다(배치가 하나다). 버전을 맞춰 두는 이유는
          // `editor.ts` 의 마이그레이션이 테스트 중간에 레이아웃을 지우지 않게 하는 것뿐이다.
          localStorage.removeItem("oprn:editor-layout");
          localStorage.removeItem("oprn:editor-layout:v2");
          localStorage.removeItem("oprn:editor-layout:v3");
          localStorage.setItem(layoutVersionKey, layoutVersion);
        },
        { layoutVersionKey: EDITOR_LAYOUT_VERSION_KEY, layoutVersion: EDITOR_LAYOUT_VERSION },
      );
      await page.goto("/?freshProject=1");
      // 로그인 모달을 걷어내야 편집기 본문이 뜬다. 예전 판은 `editor-layout` 하나만 기다렸고
      // 그건 모달 뒤에서도 붙어 있어서 통과했다 — 캔버스 기하는 그 뒤에나 잡힌다.
      const guest = page.getByTestId("login-guest");
      if (await guest.isVisible({ timeout: 10_000 }).catch(() => false)) await guest.click();
      await page.waitForSelector("[data-testid='editor-layout']", { timeout: 90_000 });
      await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 90_000 });
      await page.evaluate((m) => (window as never as { __oprnEditorUiMode: { set(v: string): void } }).__oprnEditorUiMode.set(m), mode);
      // 모드 전환은 셸을 다시 그린다 — 캔버스가 다시 붙는 것을 확인해야 기하가 안정된다.
      await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 60_000 });
      await page.waitForTimeout(300);

      // 1) 문서 가로 스크롤 없음
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);

      // 2) 메뉴바 한 줄 (두 줄 꺾임이면 높이가 커진다)
      const menuBox = await boxOf(page.locator(".oprn-menu-bar"), "메뉴바");
      expect(menuBox.height).toBeLessThanOrEqual(48);

      // 3) 띠는 유휴에서도 상주하고, 컴포저(입력 + 전송)가 그 안에 함께 보인다.
      //    구 스펙의 "접힘 → 복귀 알약 → 컴포저" 3단계가 여기서 1단계로 줄었다.
      const panel = page.getByTestId("ai-panel");
      const input = page.getByTestId("ai-input");
      const send = page.getByTestId("ai-send");
      await expect(panel).toBeVisible();
      await expect(panel).not.toHaveClass(/is-risen/);
      await expect(input).toBeVisible();
      await expect(send).toBeVisible();

      // 4) 유휴 높이는 한 줄이다. 구 구현의 `height: 100%` 가 만든 600px 공백이
      //    이 한 줄로 잡힌다(스펙 §2).
      const idleBox = await boxOf(panel, "유휴 띠");
      expect(Math.abs(idleBox.height - IDLE_HEIGHT)).toBeLessThanOrEqual(2);

      // 5) 잘림 없음: 띠 네 변이 캔버스 안에 있다. 캔버스는 `overflow: hidden` 이라
      //    넘치면 화면에서 그만큼 사라진다 — 실제로 폭 기준을 뷰포트로 잡았을 때
      //    1024px 전문가 모드에서 왼쪽 136px 가 잘려 나갔다.
      const canvasBox = await boxOf(page.locator(".canvas-area"), "캔버스");
      expect(idleBox.x).toBeGreaterThanOrEqual(canvasBox.x - 1);
      expect(idleBox.x + idleBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + 1);
      expect(idleBox.y + idleBox.height).toBeLessThanOrEqual(canvasBox.y + canvasBox.height + 1);

      // 6) 겹침 없음: 좌측 열(기본=아이콘 레일, 전문가=좌패널)과 가로로 만나지 않는다.
      const leftColumn = page.locator(mode === "basic" ? "[data-testid='basic-left-rail']" : ".left-panel").first();
      const leftBox = await boxOf(leftColumn, "좌측 열");
      expect(idleBox.x).toBeGreaterThanOrEqual(leftBox.x + leftBox.width - 1);

      // 7) 뷰포트 안에 온전히: 전송 버튼이 화면 밖으로 밀리지 않는다.
      const sendBox = await boxOf(send, "전송 버튼");
      expect(sendBox.x).toBeGreaterThanOrEqual(0);
      expect(sendBox.y).toBeGreaterThanOrEqual(0);
      expect(sendBox.x + sendBox.width).toBeLessThanOrEqual(size.width + 1);
      expect(sendBox.y + sendBox.height).toBeLessThanOrEqual(size.height + 1);

      // 8) 자라도 상한을 지키고 캔버스를 밀어내지 않는다. `position: absolute` 라
      //    리플로우가 없어야 한다 — 캔버스 박스가 자람 전후로 같은지로 잰다.
      await input.click();
      await input.fill("여기에 마을을 하나 만들어 줘");
      await expect(panel).toHaveClass(/is-risen/);
      const risenBox = await boxOf(panel, "자란 띠");
      expect(risenBox.height).toBeGreaterThan(IDLE_HEIGHT);
      expect(risenBox.height).toBeLessThanOrEqual(MAX_HEIGHT + 1);
      expect(risenBox.x + risenBox.width).toBeLessThanOrEqual(canvasBox.x + canvasBox.width + 1);
      const canvasAfter = await boxOf(page.locator(".canvas-area"), "자람 뒤 캔버스");
      expect(canvasAfter.width).toBe(canvasBox.width);
      expect(canvasAfter.height).toBe(canvasBox.height);

      if (mode === "expert") {
        // 9) 맵 트리 이름이 실제 폭을 가진다
        const nameBox = await boxOf(page.locator(".map-tree-name").first(), "맵 트리 이름");
        expect(nameBox.width).toBeGreaterThan(20);
        // 10) 클래식 툴바 오버플로우: 1024px에서는 ⋯ 토글이 실제로 나타나야 한다
        if (size.width === 1024) {
          const overflowToggle = page.locator("[data-testid='toolbar-overflow-toggle']").first();
          await expect(overflowToggle).toBeVisible();
        }
      } else {
        // 기본 모드: 아이콘 레일은 라벨을 품은 한 칸이다.
        //
        // 상한이 56 이었다 — 아이콘만 있던 시절의 값이다. 2026-08-18 `99b44216`
        // ("persistent beginner rail labels and 40px targets") 가 아이콘 아래 14px 굵은
        // 라벨을 상주시키면서 `--basic-rail-width` 를 72px 로 올렸고, 그때부터 이 줄은
        // 계속 빨간불이었다(조수 띠와 무관한 선행 실패). 상한을 실제 설계값에 맞춘다.
        const railBox = await boxOf(page.locator("[data-testid='basic-left-rail']"), "아이콘 레일");
        expect(railBox.width).toBeLessThanOrEqual(72);
      }

      await page.screenshot({ path: `test-results/ai-panel-${mode}-${size.name}.png` });
      await writeFile(
        testInfo.outputPath("ai-panel-metrics.json"),
        `${JSON.stringify({ viewport: size, mode, overflow, canvas: canvasBox, idle: idleBox, risen: risenBox, send: sendBox }, null, 2)}\n`,
      );
    });
  }
}
