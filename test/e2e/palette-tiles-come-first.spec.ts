// 칠하기 탭에서 타일 팔레트가 집 킷 선반보다 위에 있고, 더 넓은지 지킨다.
//
// ── 있었던 결함(2026-07-27 실측) ──────────────────────────────────────────────
// 칠하기 탭 조립 순서가 [툴바 · 스탬프상태 · 집킷선반 · 타일팔레트] 였다. 실측:
//     팔레트 창 446px 중  집 킷 선반 192px(43%)  ·  타일 팔레트 210px(47%, y=415)
// 타일 선택이 이 탭의 주 작업인데 접힘선 아래로 밀려 행이 잘렸다.
//
// ── 원인 ─────────────────────────────────────────────────────────────────────
// 선반을 위에 둘 때 붙은 주석은 "등록 전에는 렌더 안 됨" 이었다 — 학습된 킷만 있을 때는
// 참이었고, 보통 비어 있으니 최상단에 둬도 공짜였다. 그런데 2026-07-20 에 내장 파라메트릭
// 집 킷이 같은 선반에 합류하면서(structureKitShelf.ts 헤더 주석) 선반이 **상시 렌더**로
// 바뀌었다. `if (builtinKits.length === 0 && learnedKits.length === 0) return null` 은
// 그 뒤로 한 번도 참이 되지 않는다. 주석이 기술하는 계약은 깨졌는데 순서는 아무도 다시 안 봤다.
//
// ── 수정 ─────────────────────────────────────────────────────────────────────
// 선반을 팔레트 **아래**로 옮기고, 내장 집 킷은 <details> 기본 접힘으로 둔다(펼침 상태는
// 모듈 변수 — 팔레트는 붓질마다 재렌더되므로 DOM 에 맡기면 매번 닫힌다).
// 결과 실측: 타일 팔레트 210 → 366px(+74%), 선반 192 → 36px(접힌 한 줄).
import { expect, test } from "@playwright/test";
import { createSampleAdventureProject } from "@/project/defaults";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test.setTimeout(120_000);
test.use({ serviceWorkers: "block" });

test("칠하기 탭은 타일 팔레트를 집 킷 선반보다 먼저·넓게 보여준다", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await seedProjectFromSupabaseCanonical(page, createSampleAdventureProject());
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });

  // 에디터는 이벤트 레이어로 열린다 — 타일 팔레트는 타일 레이어에만 있다.
  await page.getByTestId("layer-lower").first().click({ force: true });
  await page.getByTestId("palette-work-tab-paint").first().click({ force: true });
  await expect(page.getByTestId("palette-work-pane-paint")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("tile-palette")).toBeVisible({ timeout: 15_000 });

  const geom = await page.evaluate(() => {
    const box = (testid: string) => {
      const node = document.querySelector(`[data-testid='${testid}']`);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { y: Math.round(rect.y), height: Math.round(rect.height) };
    };
    return { palette: box("tile-palette"), shelf: box("structure-kit-shelf") };
  });

  expect(geom.palette, "타일 팔레트가 없다").not.toBeNull();
  const palette = geom.palette!;

  // 선반이 없으면(킷 0개 타일셋) 이 계약은 자동 충족 — 있을 때만 순서를 따진다.
  if (geom.shelf) {
    const shelf = geom.shelf;
    expect(palette.y, `팔레트(y=${palette.y})가 킷 선반(y=${shelf.y}) 아래로 밀렸다`)
      .toBeLessThan(shelf.y);
    // 접힌 선반은 제목 한 줄이어야 한다 — 펼친 채로 두면 다시 창을 절반 먹는다.
    expect(shelf.height, `킷 선반이 ${shelf.height}px — 기본 접힘이 아니다`).toBeLessThan(80);
    expect(palette.height, "타일 팔레트가 킷 선반보다 좁다").toBeGreaterThan(shelf.height);
  }

  // 주 작업 영역이므로 최소 높이를 요구한다(결함 당시 210px, 수정 후 366px).
  expect(palette.height, `타일 팔레트가 ${palette.height}px 로 너무 좁다`).toBeGreaterThan(260);
});

test("접힌 집 킷 선반은 펼치면 킷 버튼을 보여준다", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1440, height: 950 });
  await seedProjectFromSupabaseCanonical(page, createSampleAdventureProject());
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("layer-lower").first().click({ force: true });
  await page.getByTestId("palette-work-tab-paint").first().click({ force: true });
  await expect(page.getByTestId("palette-work-pane-paint")).toBeVisible({ timeout: 15_000 });

  const toggle = page.getByTestId("structure-kit-shelf-house-toggle");
  if ((await toggle.count()) === 0) return; // 내장 킷 없는 타일셋 — 검사 대상 아님

  // 접힘이 기본이므로 그리드는 숨어 있다.
  await expect(page.getByTestId("structure-kit-shelf-house")).toBeHidden();
  await toggle.click({ force: true });
  await expect(page.getByTestId("structure-kit-shelf-house")).toBeVisible({ timeout: 5_000 });
  const kitCount = await page.locator("[data-testid='structure-kit-shelf-house'] button").count();
  expect(kitCount, "펼쳤는데 집 킷 버튼이 없다").toBeGreaterThan(0);
});
