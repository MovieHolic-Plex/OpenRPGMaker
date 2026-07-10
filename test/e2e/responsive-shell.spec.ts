// test/e2e/responsive-shell.spec.ts
// 스펙 §5 검증: 1024/1280/1440에서 기본·전문가 모드 줄바꿈·잘림·겹침 없음.
import { expect, test } from "@playwright/test";

const SIZES = [
  { name: "1024", width: 1024, height: 768 },
  { name: "1280", width: 1280, height: 800 },
  { name: "1440", width: 1440, height: 900 },
] as const;

for (const size of SIZES) {
  for (const mode of ["basic", "expert"] as const) {
    test(`${mode} 모드 ${size.name}px 셸 무결성`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto("/?freshProject=1");
      await page.waitForSelector("[data-testid='editor-layout']");
      await page.evaluate((m) => (window as never as { __rpgzzuEditorUiMode: { set(v: string): void } }).__rpgzzuEditorUiMode.set(m), mode);
      await page.waitForTimeout(300);

      // 1) 문서 가로 스크롤 없음
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);

      // 2) 메뉴바 한 줄 (두 줄 꺾임이면 높이가 커진다)
      const menuBar = page.locator(".rm2k3-menu-bar");
      const menuBox = await menuBar.boundingBox();
      expect(menuBox && menuBox.height).toBeLessThanOrEqual(48);

      // 3) 보내기 버튼이 뷰포트 안에 온전히 존재
      const send = page.locator(".ai-chat-send").first();
      await expect(send).toBeVisible();
      const box = await send.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.x + box!.width).toBeLessThanOrEqual(size.width + 1);

      if (mode === "expert") {
        // 4) 맵 트리 이름이 실제 폭을 가진다
        const name = page.locator(".map-tree-name").first();
        await expect(name).toBeVisible();
        const nameBox = await name.boundingBox();
        expect(nameBox && nameBox.width).toBeGreaterThan(20);
        // 5) 클래식 툴바 오버플로우: 1024px에서는 ⋯ 토글이 실제로 나타나야 한다
        if (size.width === 1024) {
          const overflowToggle = page.locator("[data-testid='toolbar-overflow-toggle']").first();
          await expect(overflowToggle).toBeVisible();
        }
      } else {
        // 기본 모드: 아이콘 레일 존재 + 폭 48
        const rail = page.locator("[data-testid='basic-left-rail']");
        await expect(rail).toBeVisible();
        const railBox = await rail.boundingBox();
        expect(railBox && railBox.width).toBeLessThanOrEqual(56);
      }

      await page.screenshot({ path: `test-results/responsive-${mode}-${size.name}.png` });
    });
  }
}
