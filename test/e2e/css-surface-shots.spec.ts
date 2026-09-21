// CSS 표면 격리 픽셀 기준선 — 스펙 §3.5.
// 기준선은 표면 작업 시작 전 main 에서 찍고, 표면 작업 중에는 갱신하지 않는다.
import { expect, test, type Page } from "@playwright/test";
import { mockupProject } from "./mockupProbeSeeds";
import { seedProjectForEditor } from "./projectSeed";

// 레일 버튼은 database.ts 의 tabs 레지스트리가 이미 `db-tab-<kebab>` testid 를 붙인다 — 그 이름을 그대로 쓴다.
const NAV_TESTID = (tab: string) => `db-tab-${tab.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`)}`;
const VIEWPORTS = [{ w: 1280, h: 800 }, { w: 1440, h: 900 }];
// 시계 고정 — 상대 시각·날짜 표기가 실행마다 달라지지 않게 한다.
const FROZEN_TIME = new Date("2026-09-11T00:00:00Z");
// 레일에 없는 탭의 진입 경로. terrain 은 spatialTiles 의 맵 컨텍스트 내비 자식이고,
// 오토타일/미분류는 타일 작업공간의 면(facet)이라 탭 검색으로만 드러난다.
// 옛 별칭 6개(tilesets·structureKits·tilesetSpaces·scratchConcepts·villages·worldGen)는
// LEGACY_SPATIAL_ROUTE 가 spatial* 로 흡수해 UI 진입점이 없으므로, 그 목적지인 spatial* 탭(레일의 「맵」 그룹
// 6개, spatialTiles 는 원래 목록에 있었음)을 대신 찍는다.
const CONTEXT_CHILD: Record<string, string> = { terrain: "spatialTiles" };
const SEARCH_ONLY = new Set(["tilesetAutotile", "tilesetUnlabeled"]);
const DB_TABS = [
  "overview", "characters", "characterGraphics", "characterAppearances", "elements", "monsterSpecies",
  "skillTrees", "promotionTree", "animations", "battleCommands", "battleScreen", "terrain",
  "commonEvents", "switches", "variables", "system", "opening", "gameOver", "terms",
  "spatialTiles", "tilesetAutotile", "tilesetUnlabeled", "spatialObjects", "spatialSpaces", "spatialPlaces",
  "spatialRegions", "spatialWorlds", "crops", "lifeCrafting", "dailyWeather", "farmAnimals", "farmSpatial",
  "factions", "lifeCollections", "worldCanon", "worldCodex",
  // 컬렉션 7탭 — 레일의 파티/몬스터/전투 규칙 그룹에 보이는 레코드 편집 표면.
  "actors", "classes", "skills", "items", "enemies", "troops", "states",
];

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

// 이 호스트는 도커 veth 가 수십 초마다 생겼다 사라지고, 크로미움은 netlink 변경마다 진행 중 요청을
// 전부 끊는다(net::ERR_NETWORK_CHANGED). vite dev 의 모듈 로드(~1000 요청)가 그 창에 걸리면 빈 화면이
// 된다 — 편집기가 마운트될 때까지 리로드한다. 스크린샷 단언은 재시도하지 않는다(retries: 0).
const BOOT_ATTEMPTS = 5;

// 저장값 없는 첫 방문은 applyFirstVisitEditorUiMode 가 초보 모드로 박는다(자동화 URL 예외 없음).
// 「표준」기준선이 우연히 초보 화면이 되지 않도록 모드를 항상 명시한다. parseEditorUiMode 는
// 날 문자열("beginner")을 받는다 — JSON 으로 감싸면 standard 로 떨어진다.
type UiMode = "standard" | "beginner" | "expert";

async function boot(page: Page, w: number, h: number, mode: UiMode = "standard") {
  // Date.now()/new Date() 를 고정 시각으로 못 박는다(타이머는 그대로 흐른다). 내비게이션 전에 걸어야 첫 렌더부터 적용된다.
  await page.clock.setFixedTime(FROZEN_TIME);
  await page.addInitScript((value) => localStorage.setItem("oprn:editor-ui-mode", value), mode);
  await page.setViewportSize({ width: w, height: h });
  const seed = mockupProject();
  let lastError: unknown;
  for (let attempt = 1; attempt <= BOOT_ATTEMPTS; attempt += 1) {
    try {
      if (attempt === 1) await seedProjectForEditor(page, seed.project);
      else {
        await page.reload();
        await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
      }
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      test.info().annotations.push({ type: "boot-retry", description: `attempt ${attempt} failed` });
    }
  }
  if (lastError) throw lastError;
  // 초보 모드엔 toolbar-database 가 없다(paletteRail) — 두 모드에 다 있는 저장 버튼을 앵커로 쓴다.
  await expect(page.getByTestId("toolbar-save")).toBeVisible({ timeout: 60_000 });
  if (mode !== "beginner") await expect(page.getByTestId("toolbar-database")).toBeVisible({ timeout: 60_000 });
  await settle(page);
  return seed;
}

// 게스트 신원 라벨은 부트마다 무작위다(editorIdentity) — 셸 샷에서는 그 버튼을 가린다.
function shellMasks(page: Page) {
  return [page.getByTestId("topbar-identity")];
}

// eventEditorCertEvidence.openEventEditor 는 전문가 모드 전제(tool-event 버튼)다. 표준 모드는 이벤트
// 레이어를 고르면 좌패널이 바로 이벤트 목록이 되고 tool-event 가 없다(tileToolbar.ts:106) — 있을 때만 누른다.
async function openEventEditorInShell(page: Page, eventId: string) {
  await page.getByTestId("layer-event").click();
  const tool = page.getByTestId("tool-event");
  if ((await tool.count()) > 0) await tool.click();
  await page.getByTestId(`event-list-row-${eventId}`).click();
  await page.getByTestId("event-editor-open").click();
  await expect(page.getByTestId("event-editor-modal")).toBeVisible();
}

for (const { w, h } of VIEWPORTS) {
  test(`shell ${w}x${h}`, async ({ page }) => {
    await boot(page, w, h);
    await expect(page).toHaveScreenshot(`shell-${w}.png`, { fullPage: false, mask: shellMasks(page) });
  });

  test(`shell beginner mode ${w}x${h}`, async ({ page }) => {
    await boot(page, w, h, "beginner");
    await expect(page.locator("body.editor-ui-beginner")).toHaveCount(1);
    await expect(page).toHaveScreenshot(`shell-beginner-${w}.png`, { mask: shellMasks(page) });
  });

  test(`shell expert mode ${w}x${h}`, async ({ page }) => {
    await boot(page, w, h, "expert");
    await expect(page.locator("body.editor-ui-expert")).toHaveCount(1);
    await expect(page).toHaveScreenshot(`shell-expert-${w}.png`, { mask: shellMasks(page) });
  });

  test(`event editor pages ${w}x${h}`, async ({ page }) => {
    const { eventId } = await boot(page, w, h);
    await openEventEditorInShell(page, eventId);
    const modal = page.getByTestId("event-editor-modal");
    await settle(page);
    await expect(page).toHaveScreenshot(`event-page1-${w}.png`);
    // 페이지 탭은 `.evt-page-segment`(testid evt-page-segment-N). mockupProject 는 3페이지 — 조건부 건너뛰기 없이 둘 다 찍는다.
    await expect(modal.getByTestId("evt-page-segment-2")).toHaveCount(1);
    await expect(modal.getByTestId("evt-page-segment-3")).toHaveCount(1);
    await modal.getByTestId("evt-page-segment-2").click();
    await settle(page);
    await expect(page).toHaveScreenshot(`event-page2-${w}.png`);
    await modal.getByTestId("evt-page-segment-3").click();
    await settle(page);
    await expect(page).toHaveScreenshot(`event-page3-${w}.png`);
    await modal.getByTestId("event-command-toolbar-add").first().click();
    await expect(page.getByTestId("event-command-picker")).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot(`event-command-picker-${w}.png`);
    await page.keyboard.press("Escape");
    await modal.getByTestId("event-page-graphic-set").click();
    await expect(page.getByTestId("event-graphic-dialog")).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot(`event-graphic-dialog-${w}.png`);
    await page.keyboard.press("Escape");
    // 움직임 select 는 접힌 곳에 있다. 표준 모드는 설정 아코디언(wrapPageSettingsAsAccordion)의 「움직임과 속도」
    // 그룹(한 번에 하나만 열림), 전문가 모드는 고전 collapsibleSection 의 summary — 있는 쪽을 연다.
    const railGroup = modal.getByTestId("evt-rail-group-move");
    if ((await railGroup.count()) > 0) {
      if (!(await railGroup.evaluate((node) => node.classList.contains("is-open")))) {
        await railGroup.locator(".event-editor-settings-accordion-header").click();
      }
    } else {
      const movementSection = modal.getByTestId("event-classic-movement-section");
      if (!(await movementSection.evaluate((node) => (node as HTMLDetailsElement).open))) {
        await movementSection.locator(":scope > summary").click();
      }
    }
    await modal.getByTestId("event-page-movement-type").selectOption("custom");
    await modal.getByTestId("event-page-custom-route").click();
    await expect(page.getByTestId("event-page-move-route-dialog")).toBeVisible();
    await settle(page);
    await expect(page).toHaveScreenshot(`event-move-route-${w}.png`);
  });
}

// 그룹 내비는 활성 탭의 그룹만 펼쳐 두고 나머지 탭 버튼은 hidden 이다(applyGroupCollapse). 접힌 그룹의
// 탭은 바로 앞 형제인 그룹 헤더(db-tab-group-<slug>)를 눌러 펼친 뒤 누른다 — 사용자 경로 그대로.
async function clickRailTab(page: Page, tab: string) {
  const nav = page.getByTestId(NAV_TESTID(tab));
  await expect(nav, `rail button for ${tab}`).toHaveCount(1);
  if (await nav.isHidden()) {
    const slug = await nav.evaluate((node) => {
      let sibling = node.previousElementSibling;
      while (sibling && !sibling.classList.contains("db-tab-group")) sibling = sibling.previousElementSibling;
      return sibling instanceof HTMLElement ? sibling.dataset.groupSlug ?? null : null;
    });
    if (slug) await page.getByTestId(`db-tab-group-${slug}`).click();
  }
  await nav.click();
}

// 진입 버튼이 없으면 조용히 건너뛰지 않고 실패한다 — 비교 집합이 소리 없이 줄어들면 기준선이 아니다.
async function navigateDbTab(page: Page, tab: string) {
  const parent = CONTEXT_CHILD[tab];
  if (parent) {
    await clickRailTab(page, parent);
    const child = page.getByTestId(`db-context-${tab}`);
    await expect(child, `context nav for ${tab}`).toHaveCount(1);
    await child.click();
    return;
  }
  if (SEARCH_ONLY.has(tab)) {
    await page.getByTestId("db-tab-search").fill(tab.toLowerCase());
    const nav = page.getByTestId(NAV_TESTID(tab));
    await expect(nav, `search result for ${tab}`).toHaveCount(1);
    await nav.click(); // 탭 클릭이 검색 상자를 비우고 보조 버튼을 걷어낸다.
    return;
  }
  await clickRailTab(page, tab);
}

test("database tabs 1440x900", async ({ page }) => {
  test.slow(); // 한 테스트에 43장 — 기본 180s 의 3배.
  await boot(page, 1440, 900);
  await page.getByTestId("toolbar-database").click();
  await expect(page.getByTestId("database-modal")).toBeVisible({ timeout: 30_000 });
  for (const tab of DB_TABS) {
    await navigateDbTab(page, tab);
    await settle(page);
    await expect(page).toHaveScreenshot(`db-${tab}.png`);
  }
});
