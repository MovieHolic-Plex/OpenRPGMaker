/**
 * 정리 후 워킹트리가 실제로 부팅되는지 확인하는 스모크.
 *
 * 왜 필요한가: 정리 직전 이 트리는 부팅이 깨져 있었다.
 *   - (옛) src/styles/runtime/battle-skins/index.css 가 없는 ./_mv.css 를 @import
 *   - src/editor/panels/databaseBasicRecordFields.ts 가 없는 quickBattleModal 을 import
 * 둘 다 "import 만 있고 파일이 없는" 미완성 편집이었다. typecheck 통과는 부팅을 증명하지
 * 않으므로(CSS @import 는 tsc 가 안 본다) 실제 렌더까지 확인한다.
 */
import { expect, test } from "@playwright/test";

test("정리된 워크트리에서 에디터가 실제로 부팅되고 렌더된다", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(err.message));

  await page.goto("/?blankProject=1");

  // 에디터 캔버스가 뜨면 모듈 그래프와 CSS 가 전부 해석된 것이다.
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });

  // 배틀 스킨 CSS 가 실제로 로드됐는지 — 유리 변형 시트(_glass-variants.css)가 빠지면 여기서 잡힌다.
  // (2026-09-25 전에는 _mv.css 를 쟀다. 스킨별 시트는 그날 지웠다.)
  const skinCssLoaded = await page.evaluate(() => {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin sheet
      }
      for (const rule of Array.from(rules)) {
        // 실제 셀렉터는 .battle-scene[...]:not([data-battle-skin="pokemon"]) 이다(_glass-variants.css).
        // (2026-10-02 정면 스킨과 함께 data-battle-hud="boxes" 변형을 지웠다.)
        if (rule.cssText.includes(':not([data-battle-skin="pokemon"])')) return true;
      }
    }
    return false;
  });

  // 모듈 해석 실패는 pageerror 로 터진다. 부팅 판정의 핵심.
  const fatal = pageErrors.filter((m) => /Failed to (resolve|fetch)|Cannot find module|is not defined/i.test(m));
  expect(fatal, `치명적 부팅 오류: ${fatal.join(" | ")}`).toEqual([]);

  const importErrors = consoleErrors.filter((m) => /Failed to (resolve|load).*(import|module)|_glass-variants\.css/i.test(m));
  expect(importErrors, `import 해석 실패: ${importErrors.join(" | ")}`).toEqual([]);

  console.log(`[boot] edit-canvas visible. glass variants css present=${skinCssLoaded}`);
  console.log(`[boot] console errors=${consoleErrors.length} pageErrors=${pageErrors.length}`);
  // _glass-variants.css 는 index.css 를 통해 번들에 들어간다. 없으면 부팅이 깨지므로 존재를 단정한다.
  expect(skinCssLoaded, "_glass-variants.css 규칙이 로드되지 않았다 — index.css @import 체인이 깨졌다").toBe(true);

  await page.screenshot({ path: "docs/worktree-boot-smoke.png" });
});
