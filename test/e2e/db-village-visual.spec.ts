import { expect, test, type Locator, type Page } from "@playwright/test";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";
import { openDatabase } from "./oprn-database-helpers";

/**
 * 데이터베이스 「마을」탭의 **픽셀**을 본다.
 *
 * 단위 테스트로는 여기까지 못 온다 — `test/fakeDom.ts` 의 `getContext()` 가 의도적으로 null 을
 * 주기 때문에 `test/villageHousePreview.test.ts` 는 스탬프된 GameMap 의 타일 배열까지만
 * 단정한다. 캔버스에 정말 그림이 들어갔는지, 구운 PNG 가 실제로 서빙되는지, 손잡이를 끌면
 * 그림이 따라 바뀌는지는 진짜 브라우저에서만 확인된다.
 *
 * 다섯 가지를 본다:
 *  1. 빈 프로젝트를 열면 시작 화면에 원형 PNG 6장이 실제로 뜬다(자리끼우기 아님).
 *  2. 집 형태 히어로 캔버스가 단색이 아니다 — 타일이 들어갔다.
 *  3. 날개 손잡이를 끌면 값이 커밋되고 히어로 그림이 새로 그려진다.
 *  4. 프리셋 「미리보기 만들기」가 실제 시공 결과를 그린다.
 *  5. 프리셋 형태 화이트리스트 행에 집 그림이 들어간다.
 */

type CanvasStats = {
  readonly colors: number;
  readonly opaque: number;
  readonly signature: string;
  readonly width: number;
};

// 기본 30초 예산으로는 부족하다 — 앱 부팅 + 프로젝트 시드만으로 병렬 부하에서 수십 초가
// 가고, 그 뒤에 타일셋 PNG 를 받아 캔버스를 굽는다. 시간 초과를 기능 고장으로 오독하지 않게
// 넉넉히 준다.
test.describe.configure({ timeout: 150_000 });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
    window.localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
});

async function openVillageTab(page: Page): Promise<void> {
  await openDatabase(page);
  await page.getByTestId("db-tab-group-world").click();
  await page.getByTestId("db-tab-villages").click();
  await expect(page.getByTestId("db-village-workspace")).toBeVisible();
}

/**
 * 캔버스 픽셀 요약. `colors` 로 단색을 걸러내고 `signature` 로 「그림이 바뀌었다」를 본다.
 * 색 수만 보면 그림이 달라져도 같은 팔레트를 쓰므로 못 잡는다.
 */
async function canvasStats(locator: Locator): Promise<CanvasStats> {
  return locator.evaluate((node) => {
    const canvas = node as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { colors: 0, opaque: 0, signature: "", width: canvas.width };
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const seen = new Set<number>();
    let opaque = 0;
    let hash = 0;
    for (let i = 0; i < data.length; i += 4) {
      const rgb = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
      seen.add(rgb);
      if (data[i + 3]! > 8) opaque += 1;
      hash = (Math.imul(hash, 31) + rgb) | 0;
    }
    return { colors: seen.size, opaque, signature: String(hash), width: canvas.width };
  });
}

test("빈 프로젝트의 시작 화면이 원형 전경 PNG 6장으로 열린다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await seedProjectFromSupabaseCanonical(page, createEmptyToolProject("마을 그림"));
  await openVillageTab(page);

  // 시작 화면은 빈 상태를 **감싼다** — 두 빈 판 testid 가 그대로 살아 있어야 기존 계약이 산다.
  await expect(page.getByTestId("db-village-start-hero")).toBeVisible();
  await expect(page.getByTestId("db-village-template-blank")).toBeVisible();
  await expect(page.getByTestId("db-village-preset-blank")).toBeVisible();

  const archetypeIds = ["castle-stone", "harbor-coast", "market-fair", "farm-rural", "mine-mountain", "garden-bloom"];
  for (const id of archetypeIds) {
    const shot = page.getByTestId(`db-village-archetype-shot-${id}`);
    await expect(shot, id).toBeVisible();
    // 구운 PNG 가 정말 서빙됐는지 — 404 면 naturalWidth 가 0 이고 화면엔 빈 칸이 남는다.
    const size = await shot.evaluate((node) => {
      const image = node as HTMLImageElement;
      return { natural: image.naturalWidth, complete: image.complete };
    });
    expect(size.complete, id).toBe(true);
    expect(size.natural, id).toBeGreaterThan(100);
  }

  // 모양 팔레트는 구운 그림이 아니라 실시간 캔버스다 — 여기서 이미 픽셀이 나와야 한다.
  const firstShape = page.getByTestId("db-village-start-shape-l").locator("canvas");
  await expect(firstShape).toHaveAttribute("data-preview-state", "ready", { timeout: 15_000 });
  const shapeStats = await canvasStats(firstShape);
  expect(shapeStats.colors).toBeGreaterThan(8);

  // 상세 창 전체를 찍는다 — 「예시부터 보인다」는 낱장 카드가 아니라 첫 화면의 인상이다.
  await page.getByTestId("db-village-detail-pane").screenshot({
    path: testInfo.outputPath("village-start-screen.png"),
  });
});

test("집 형태 히어로 캔버스에 실제 타일이 들어간다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await seedProjectFromSupabaseCanonical(page, createEmptyToolProject("마을 그림"));
  await openVillageTab(page);

  await page.getByTestId("db-village-start-shape-l").click();

  const hero = page.getByTestId("db-village-template-shot");
  await expect(hero).toBeVisible();
  await expect(hero).toHaveAttribute("data-preview-state", "ready", { timeout: 15_000 });
  const heroStats = await canvasStats(hero);
  // 단색 폴백이면 색이 1~2개다. 타일 그림은 지붕·벽·잔디가 섞여 수십 색이 나온다.
  expect(heroStats.colors).toBeGreaterThan(16);
  expect(heroStats.opaque).toBeGreaterThan(heroStats.width * heroStats.width * 0.5);

  // 목록 행 썸네일도 같은 형태를 같은 파이프로 그린다 — 캐시 재사용이 실제로 채워지는지.
  const thumb = page.getByTestId("db-village-template-thumb-my-l").first();
  await expect(thumb).toHaveAttribute("data-preview-state", "ready", { timeout: 15_000 });
  expect((await canvasStats(thumb)).colors).toBeGreaterThan(8);

  // 내장 34종 갤러리 — 카드 그림이 비면 「그림으로 고르기」가 성립하지 않는다.
  const gallery = page.getByTestId("db-village-import-gallery");
  await expect(gallery).toBeVisible();
  const rectShot = page.getByTestId("db-village-import-rect-small-shot");
  await rectShot.scrollIntoViewIfNeeded();
  await expect(rectShot).toHaveAttribute("data-preview-state", "ready", { timeout: 15_000 });
  expect((await canvasStats(rectShot)).colors).toBeGreaterThan(8);

  await page.getByTestId("db-village-template-hero").screenshot({
    path: testInfo.outputPath("village-template-hero.png"),
  });
  await gallery.screenshot({ path: testInfo.outputPath("village-import-gallery.png") });
});

test("날개 손잡이를 끌면 값이 커밋되고 그림이 다시 그려진다", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await seedProjectFromSupabaseCanonical(page, createEmptyToolProject("마을 그림"));
  await openVillageTab(page);
  await page.getByTestId("db-village-start-shape-l").click();

  const hero = page.getByTestId("db-village-template-shot");
  await expect(hero).toHaveAttribute("data-preview-state", "ready", { timeout: 15_000 });
  const before = await canvasStats(hero);

  const grid = page.getByTestId("db-village-footprint-large");
  // testid 는 격자 자체를 가리켜야 한다 — 스크롤 칸에 붙으면 드래그 좌표가 칸 밖을 짚는다.
  await expect(grid).toHaveClass(/db-village-grid/);
  // 상세 창은 스크롤한다 — 격자는 기본 위치에서 뷰포트 **아래** 1500px 지점에 있다.
  // `boundingBox()` 는 스크롤을 해 주지 않으므로, 여기서 화면 안으로 끌어오지 않으면
  // `page.mouse` 가 뷰포트 밖을 짚고 손잡이는 pointerdown 을 아예 받지 못한다.
  await grid.evaluate((node) => (node as HTMLElement).scrollIntoView({ block: "center" }));
  const cell = await grid.evaluate((node) => {
    const box = node as HTMLElement;
    const cols = Number(box.style.getPropertyValue("--db-village-cols"));
    const rows = Number(box.style.getPropertyValue("--db-village-rows"));
    return { x: box.clientWidth / cols, y: box.clientHeight / rows };
  });
  expect(cell.y).toBeGreaterThan(4);

  // ㄱ자의 두 번째 날개는 h=6, 박스는 h=8 — 아래로 두 칸 늘릴 여유가 있다.
  const handle = page.getByTestId("db-village-wing-handle-1-s");
  const spot = (await handle.boundingBox())!;
  const viewport = page.viewportSize()!;
  // 끌고 갈 자리까지 뷰포트 안이어야 한다 — 밖으로 나가면 이벤트가 사라진다.
  expect(spot.y + cell.y * 2).toBeLessThan(viewport.height);
  await page.mouse.move(spot.x + spot.width / 2, spot.y + spot.height / 2);
  await page.mouse.down();
  await page.mouse.move(spot.x + spot.width / 2, spot.y + spot.height / 2 + cell.y * 2, { steps: 6 });
  await page.mouse.up();

  // 숫자칸은 「고급」 접기 안에 살아 있다 — 커밋 결과를 여기서 읽는다.
  await page.getByTestId("db-village-wing-numbers-toggle").click();
  await expect(page.getByTestId("db-village-wing-1-h")).toHaveValue("8");
  await expect(page.getByTestId("db-village-grid-status")).toHaveAttribute("data-valid", "true");

  const after = page.getByTestId("db-village-template-shot");
  await expect(after).toHaveAttribute("data-preview-state", "ready", { timeout: 15_000 });
  // 모양이 바뀌었으니 그림도 바뀌어야 한다. 안 바뀌면 미리보기가 캐시를 잘못 붙잡은 것이다.
  expect((await canvasStats(after)).signature).not.toBe(before.signature);
});

test("프리셋 「미리보기 만들기」가 실제 시공 결과를 그린다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await seedProjectFromSupabaseCanonical(page, createEmptyToolProject("마을 그림"));
  await openVillageTab(page);

  await page.getByTestId("db-village-archetype-farm-rural").click();
  await expect(page.getByTestId("db-village-preset-preview-card")).toBeVisible();

  const stage = page.getByTestId("db-village-preset-preview");
  await expect(stage).toHaveAttribute("data-preview-state", "idle");

  await page.getByTestId("db-village-preset-preview-run").click();
  const shot = page.getByTestId("db-village-preset-shot");
  await expect(shot).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
  expect((await canvasStats(shot)).colors).toBeGreaterThan(16);
  const note = page.getByTestId("db-village-preset-preview-note");
  // 씨앗값과 시공된 집 수를 말해야 「이 그림이 어느 판인지」를 알 수 있다.
  await expect(note).toContainText("씨앗 7");
  await expect(note).toContainText("채");

  await page.getByTestId("db-village-preset-preview-reseed").click();
  // 문구가 먼저 바뀐다(같은 `run()` 안) — 새 캔버스가 DOM 에 들어온 뒤라는 뜻이다.
  await expect(note).toContainText("씨앗 8");
  const reseeded = page.getByTestId("db-village-preset-shot");
  await expect(reseeded).toHaveAttribute("data-preview-state", "ready", { timeout: 30_000 });
  expect((await canvasStats(reseeded)).colors).toBeGreaterThan(16);

  await stage.screenshot({ path: testInfo.outputPath("village-preset-preview.png") });
});

test("프리셋 형태 화이트리스트에 집 그림이 들어간다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await seedProjectFromSupabaseCanonical(page, createEmptyToolProject("마을 그림"));
  await openVillageTab(page);

  await page.getByTestId("db-village-archetype-farm-rural").click();
  const picker = page.getByTestId("db-village-preset-template-picker");
  await expect(picker).toBeVisible();

  const shot = page.getByTestId("db-village-preset-template-rect-small-shot");
  await shot.scrollIntoViewIfNeeded();
  await expect(shot).toHaveAttribute("data-preview-state", "ready", { timeout: 15_000 });
  expect((await canvasStats(shot)).colors).toBeGreaterThan(8);

  await picker.screenshot({ path: testInfo.outputPath("village-preset-template-whitelist.png") });
});
