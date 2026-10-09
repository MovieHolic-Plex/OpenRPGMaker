import { expect, test, type Page } from "@playwright/test";
import { createEmptyToolProject } from "@/editor/tools/emptyProject";
import { seedProjectForEditor } from "./projectSeed";
import { exportedProject, openDatabase } from "./oprn-database-helpers";

/**
 * 데이터베이스 「마을」탭의 저작 표면을 실제 브라우저에서 본다.
 *
 * 이 탭이 사슬의 입력단이다 — 여기서 만든 레코드가 그대로 시공 하네스로 흘러가고 AI 컨텍스트에
 * 실린다. 단위 테스트(`test/databaseVillageView.test.ts`)는 가짜 DOM 위에서 돌기 때문에
 * 아코디언·CSS·가상 요소 배지처럼 **실제 렌더에서만 드러나는** 것을 보증하지 못한다.
 *
 * 세 가지를 본다:
 *  1. 「세계」그룹이 접힌 채로도 안에 「마을」이 있다는 걸 알려주는가(툴팁 + 합계 배지).
 *  2. 마을 원형 6갈래를 눌러 배치 프리셋을 만들 수 있는가, 값이 실제 프로젝트에 남는가.
 *  3. 내장과 같은 ID 를 쓰면 「덮음」이라고 말하는가 — 후보 수가 늘지 않는 것까지.
 */

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
    window.localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
});

async function openVillageTab(page: Page): Promise<void> {
  await openDatabase(page);
  // 29개 탭은 아코디언 안이고 한 그룹만 펼쳐진다 — 「마을」은 「세계」 소속이다.
  await page.getByTestId("db-tab-group-world").click();
  await page.getByTestId("db-tab-villages").click();
  await expect(page.getByTestId("db-village-workspace")).toBeVisible();
}

test("접힌 「세계」 그룹이 안에 든 탭과 레코드 합계를 알려준다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await seedProjectForEditor(page, createEmptyToolProject("마을 저작"));
  await openDatabase(page);

  const world = page.getByTestId("db-tab-group-world");
  // 라벨 텍스트 계약(db-desktop-matrix)은 정확 일치다 — 배지는 가상 요소로만 나온다.
  await expect(world).toHaveText("세계");
  await expect(world).toHaveAttribute("title", /마을/);
  await expect(world).toHaveAttribute("aria-expanded", "false");

  const badge = await world.evaluate((node) => {
    const before = window.getComputedStyle(node, "::before");
    const after = window.getComputedStyle(node, "::after");
    return {
      content: before.content,
      // db-ux-probe 의 tinyPseudo 문턱이 11px 다 — 그 밑으로 내려가면 게이트가 잡는다.
      fontSize: Number.parseFloat(before.fontSize),
      beforeOrder: before.order,
      afterOrder: after.order,
    };
  });
  expect(badge.content).toMatch(/^"\d+"$/);
  expect(badge.fontSize).toBeGreaterThanOrEqual(11);
  // 배지가 라벨 뒤·셰브론 앞이어야 한다. `::before` 는 기본값이면 라벨보다 앞으로 온다.
  expect(Number(badge.beforeOrder)).toBeLessThan(Number(badge.afterOrder));

  await page.screenshot({ path: testInfo.outputPath("world-group-collapsed.png") });
});

test("마을 원형을 눌러 배치 프리셋을 만들고 값을 덮어쓴다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 940 });
  await seedProjectForEditor(page, createEmptyToolProject("마을 저작"));
  await openVillageTab(page);

  await page.getByTestId("db-village-kind-preset").click();
  const gallery = page.getByTestId("db-village-archetypes");
  await expect(gallery).toBeVisible();
  await expect(gallery.locator("button")).toHaveCount(6);
  // 이름만으로는 무엇이 달라지는지 알 수 없다 — 값 요약이 칩 안에 있어야 한다.
  await expect(gallery).toContainText("모래길");
  await expect(gallery).toContainText("광장 장터");
  await page.screenshot({ path: testInfo.outputPath("archetype-gallery.png") });

  await page.getByTestId("db-village-archetype-harbor-coast").click();
  await expect(page.getByTestId("db-village-preset-name")).toHaveValue("어촌·항구");
  await expect(page.getByTestId("db-village-preset-path-style")).toHaveAttribute("data-value", "sand");
  await expect(page.getByTestId("db-village-preset-plaza-layout")).toHaveAttribute("data-value", "south");
  // 갤러리는 빈 상태 전용이다 — 상세로 들어오면 「값 가져오기」가 그 역할을 잇는다.
  await expect(gallery).toBeHidden();
  await expect(page.getByTestId("db-village-archetype-source")).toBeVisible();
  await expect(page.getByTestId("db-village-archetype-source")).toHaveAttribute("data-value", "castle-stone");
  await expect(page.getByTestId("db-village-preset-ground")).toHaveAttribute("data-value", "");

  const houses = page.getByTestId("db-village-preset-house-count");
  await houses.fill("7");
  await houses.dispatchEvent("change");
  await page.getByTestId("db-village-preset-ground-snow").click();
  await expect(page.getByTestId("db-village-preset-ground")).toHaveAttribute("data-value", "snow");
  await page.getByTestId("db-village-archetype-source-mine-mountain").click();
  await expect(page.getByTestId("db-village-archetype-source")).toHaveAttribute("data-value", "mine-mountain");
  await page.getByTestId("db-village-archetype-apply").click();

  // 분위기만 덮고 규모는 남는다 — 원형은 집 수·길 폭·바닥을 정하지 않는다.
  await expect(houses).toHaveValue("7");
  await expect(page.getByTestId("db-village-preset-ground")).toHaveAttribute("data-value", "snow");
  await expect(page.getByTestId("db-village-preset-path-style")).toHaveAttribute("data-value", "dirt");
  await expect(page.getByTestId("db-village-preset-kit-mix")).toHaveAttribute("data-value", "blue-stone");
  // 광산 원형은 광장 위치를 안 정한다 — 남겨 두면 두 원형이 섞인 값이 된다.
  await expect(page.getByTestId("db-village-preset-plaza-layout")).toHaveAttribute("data-value", "");
  await page.screenshot({ path: testInfo.outputPath("archetype-import.png") });

  const project = await exportedProject(page) as unknown as {
    readonly villagePresets?: readonly Record<string, unknown>[];
  };
  expect(project.villagePresets).toHaveLength(1);
  expect(project.villagePresets?.[0]).toMatchObject({
    id: "harbor-coast",
    houseCount: 7,
    groundTheme: "snow",
    pathStyle: "dirt",
    yardStyle: "workshop",
    kitMix: "blue-stone",
  });
  expect(project.villagePresets?.[0]).not.toHaveProperty("plazaLayout");
});

test("내장과 같은 ID 는 「덮음」으로 읽히고 후보 수를 늘리지 않는다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1500, height: 940 });
  await seedProjectForEditor(page, createEmptyToolProject("마을 저작"));
  await openVillageTab(page);

  await page.getByTestId("db-village-create").click();
  const stats = page.getByTestId("db-village-template-stats");
  await expect(stats).toContainText("내장에 더함");
  await expect(page.getByTestId("db-village-template-override-count")).toContainText("0");
  await expect(stats).toContainText("35");
  await expect(page.getByTestId("db-village-template-id-usage")).toContainText("더해집니다");

  const idInput = page.getByTestId("db-village-template-id");
  await idInput.fill("rect-small");
  await idInput.dispatchEvent("change");

  await expect(page.getByTestId("db-village-template-row-rect-small")).toContainText("내장 덮음");
  await expect(page.getByTestId("db-village-template-override-count")).toContainText("1");
  await expect(page.getByTestId("db-village-template-hero")).toContainText("내장 덮음");
  await expect(page.getByTestId("db-village-template-id-usage")).toContainText("내장 대신 이 레코드가 시공됩니다");
  // 덮음이므로 시공 후보는 34 그대로다 — 이 숫자가 35 면 배지가 거짓말을 한 것이다.
  await expect(stats).toContainText("34");
  await expect(stats).not.toContainText("35");
  await page.screenshot({ path: testInfo.outputPath("template-override.png") });
});
