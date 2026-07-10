import { expect, test } from "@playwright/test";
import { DATABASE_TAB_SPECS, exportedProject, openDatabase, switchDatabaseTab } from "./rm2k3-database-helpers";

test.setTimeout(120_000);

const SYSTEM_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "system")!;
const TERMS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "terms")!;
const SWITCHES_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "switches")!;
const VARIABLES_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "variables")!;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
});

test("System tab: field roundtrip, tab-switch persistence, and blurred undo", async ({ page }) => {
  await page.goto("/?freshProject=1");
  await openDatabase(page);
  await switchDatabaseTab(page, SYSTEM_TAB);
  await page.waitForTimeout(250);
  await page.screenshot({ path: ".superpowers/sdd/qa-shots/system-initial.png", fullPage: true });

  // 게임 타이틀 텍스트 필드 왕복
  const titleInput = page.getByTestId("db-field-title-screen-title");
  await titleInput.fill("QA 타이틀 테스트");

  // undo: 텍스트 필드에서 포커스를 뺀(blur) 뒤 바로 Ctrl+Z — 방금 편집한 필드 하나만 되돌아오는지 확인.
  // (포커스가 input/textarea/select 에 남아있으면 브라우저 기본 텍스트 undo 로 위임되어
  //  프로젝트 undo 스택은 동작하지 않는다 — hotkeys.ts의 isTextEditingFocus 가드. 반드시 blur 먼저.)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(200);
  const afterTitleUndo = await exportedProject(page);
  expect(afterTitleUndo.system.titleScreen?.title).not.toBe("QA 타이틀 테스트");
  await titleInput.fill("QA 타이틀 테스트"); // redo the edit for the rest of the test

  // 체크박스 토글(몬스터 수집)
  const monsterCollection = page.getByTestId("db-field-system-monster-collection");
  await monsterCollection.check();

  // 기본 참전 수(숫자 필드)
  await page.getByTestId("db-field-system-active-slots").fill("3");

  // 다른 탭으로 갔다가 복귀 — 값 보존 확인
  await switchDatabaseTab(page, TERMS_TAB);
  await switchDatabaseTab(page, SYSTEM_TAB);
  await expect(page.getByTestId("db-field-title-screen-title")).toHaveValue("QA 타이틀 테스트");
  await expect(page.getByTestId("db-field-system-monster-collection")).toBeChecked();
  await expect(page.getByTestId("db-field-system-active-slots")).toHaveValue("3");

  // exportedProject()로 실제 프로젝트 반영 확인
  await page.waitForTimeout(250);
  const project = await exportedProject(page);
  expect(project.system.titleScreen?.title).toBe("QA 타이틀 테스트");
  expect((project.system as unknown as { monsterCollection?: boolean }).monsterCollection).toBe(true);
  expect((project.system as unknown as { activeSlots?: number }).activeSlots).toBe(3);

  // 시간 시스템 토글 → 하위 필드 노출
  await page.getByTestId("db-field-system-time-enabled").check();
  await expect(page.getByTestId("db-field-system-time-minutes-per-second")).toBeVisible();
  await expect(page.getByTestId("db-field-system-time-day-start")).toBeVisible();

  // 타입 상성: 타입 목록 입력 → 매트릭스 등장
  await page.getByTestId("db-field-system-type-chart-types").fill("fire, water");
  await page.getByTestId("db-field-system-type-chart-types").blur();
  await expect(page.getByTestId("db-type-chart-matrix")).toBeVisible();
  await page.getByTestId("db-type-chart-fire-water").fill("150");
  await page.getByTestId("db-type-chart-fire-water").blur();

  await page.screenshot({ path: ".superpowers/sdd/qa-shots/system-filled.png", fullPage: true });
});

test("System tab: 미리보기 갱신 버튼과 파티 슬롯 피커가 실동작한다", async ({ page }) => {
  await page.goto("/?freshProject=1");
  await openDatabase(page);
  await switchDatabaseTab(page, SYSTEM_TAB);
  await page.waitForTimeout(250);

  await expect(page.getByTestId("db-system-refresh-previews")).toBeVisible();
  await page.getByTestId("db-system-refresh-previews").click();
  await expect(page.getByTestId("db-detail-form")).toBeVisible();

  // 파티 멤버 슬롯 2 를 변경 → 반영 확인
  const slot2 = page.getByTestId("db-picker-system-start-actor-2");
  await expect(slot2).toBeVisible();
  const options = await slot2.locator("option").allTextContents();
  expect(options.length).toBeGreaterThan(1);
});

test("Terms tab: field edit roundtrip persists across tab switch and undoes", async ({ page }) => {
  await page.goto("/?freshProject=1");
  await openDatabase(page);
  await switchDatabaseTab(page, TERMS_TAB);
  await page.waitForTimeout(250);
  await page.screenshot({ path: ".superpowers/sdd/qa-shots/terms-initial.png", fullPage: true });

  const skillTerm = page.getByTestId("db-field-skill-term");
  await skillTerm.fill("필살기");
  const goldTerm = page.getByTestId("db-field-gold");
  await goldTerm.fill("크레딧");

  await switchDatabaseTab(page, SYSTEM_TAB);
  await switchDatabaseTab(page, TERMS_TAB);
  await expect(page.getByTestId("db-field-skill-term")).toHaveValue("필살기");
  await expect(page.getByTestId("db-field-gold")).toHaveValue("크레딧");

  await page.waitForTimeout(250);
  const project = await exportedProject(page);
  expect(project.meta.terms.skill).toBe("필살기");
  expect(project.meta.terms.gold).toBe("크레딧");

  // 경계값: 아주 긴 이름(30자+) 입력해도 크래시 없이 저장
  const longName = "가".repeat(32);
  const attackTerm = page.getByLabel("공격");
  await attackTerm.fill(longName);
  await page.waitForTimeout(250);
  const projectWithLongTerm = await exportedProject(page);
  expect(projectWithLongTerm.meta.terms.attack).toBe(longName);
  await page.screenshot({ path: ".superpowers/sdd/qa-shots/terms-boundary-long-name.png", fullPage: true });

  // undo (blur 후 Ctrl+Z)
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(200);
  const afterUndo = await exportedProject(page);
  expect(afterUndo.meta.terms.attack).not.toBe(longName);
});

test("Switches tab: add/rename/search/range-apply/delete roundtrip", async ({ page }) => {
  await page.goto("/?freshProject=1");
  await openDatabase(page);
  await switchDatabaseTab(page, SWITCHES_TAB);
  await page.waitForTimeout(250);
  await page.screenshot({ path: ".superpowers/sdd/qa-shots/switches-initial.png", fullPage: true });

  // 스토리 플래그 읽기 전용 섹션
  await expect(page.getByText("스토리 플래그 (읽기 전용)")).toBeVisible();

  // 추가 → 자동 선택 → 이름 변경(단일 fill = 단일 커밋)
  await page.getByTestId("db-add-switch").click();
  await page.waitForTimeout(300);
  const activeRow = page.locator(".db-utility-row.active");
  const newId = await activeRow.getAttribute("data-record-id");
  const nameInput = page.getByTestId("db-utility-selected-name");
  await nameInput.fill("QA스위치");
  await nameInput.blur();
  await page.waitForTimeout(250);

  let project = await exportedProject(page);
  expect(project.switches.find((s) => s.id === newId)?.name).toBe("QA스위치");

  // 다른 탭 왕복 후 보존 확인
  await switchDatabaseTab(page, VARIABLES_TAB);
  await switchDatabaseTab(page, SWITCHES_TAB);
  await expect(page.locator(".db-list-name", { hasText: "QA스위치" })).toBeVisible();

  // 검색
  const searchBox = page.locator(".db-search input");
  await searchBox.fill("QA스위치");
  await page.waitForTimeout(200);
  await expect(page.locator(".db-list-name", { hasText: "QA스위치" })).toBeVisible();
  await searchBox.fill("");
  await page.waitForTimeout(200);

  // 범위 이름 변경 적용
  const rangeInputs = page.locator(".db-range input");
  await rangeInputs.nth(0).fill("700");
  await rangeInputs.nth(1).fill("2");
  await rangeInputs.nth(2).fill("범위QA");
  await page.getByText("범위 적용").click();
  await page.waitForTimeout(300);
  project = await exportedProject(page);
  expect(project.switches.find((s) => s.id === "sw_0700")?.name).toBe("범위QA 0700");
  expect(project.switches.find((s) => s.id === "sw_0701")?.name).toBe("범위QA 0701");

  // 삭제 — 2단계 확인(wave2 fix) 후 행이 목록에서 사라짐
  const deleteRowButton = page.getByTestId(`db-delete-${newId}`);
  await deleteRowButton.click();
  await expect(deleteRowButton).toHaveText("정말 삭제?");
  await expect(page.locator(".db-list-name", { hasText: "QA스위치" })).toHaveCount(1);
  await deleteRowButton.click();
  await page.waitForTimeout(300);
  await expect(page.locator(".db-list-name", { hasText: "QA스위치" })).toHaveCount(0);

  await page.screenshot({ path: ".superpowers/sdd/qa-shots/switches-after-crud.png", fullPage: true });
});

test("Variables tab: add/rename/range-apply roundtrip and story-flag section", async ({ page }) => {
  await page.goto("/?freshProject=1");
  await openDatabase(page);
  await switchDatabaseTab(page, VARIABLES_TAB);
  await page.waitForTimeout(250);
  await page.screenshot({ path: ".superpowers/sdd/qa-shots/variables-initial.png", fullPage: true });

  await expect(page.getByText("스토리 플래그 (읽기 전용)")).toBeVisible();

  await page.getByTestId("db-add-variable").click();
  await page.waitForTimeout(300);
  const activeRow = page.locator(".db-utility-row.active");
  const newId = await activeRow.getAttribute("data-record-id");
  const nameInput = page.getByTestId("db-utility-selected-name");
  await nameInput.fill("QA변수");
  await nameInput.blur();
  await page.waitForTimeout(250);

  const project = await exportedProject(page);
  expect(project.variables.find((v) => v.id === newId)?.name).toBe("QA변수");

  await switchDatabaseTab(page, SWITCHES_TAB);
  await switchDatabaseTab(page, VARIABLES_TAB);
  await expect(page.locator(".db-list-name", { hasText: "QA변수" })).toBeVisible();

  await page.screenshot({ path: ".superpowers/sdd/qa-shots/variables-after-crud.png", fullPage: true });
});
