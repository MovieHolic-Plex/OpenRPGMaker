import { expect, test } from "@playwright/test";
import { applyDatabaseChanges, closeAndReopenDatabase, exportedProject, openDatabase, switchDatabaseTab } from "./rm2k3-database-helpers";

const CLASSES_TAB = { label: "Classes", slug: "classes", testId: "db-tab-classes" } as const;

test.setTimeout(90_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
});

test("classes 탭 CRUD 왕복 — 정체성/전투명령/옵션/스킬/승급/유효도/장비/곡선이 저장·복원·내보내기까지 보존된다", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await openDatabase(page);
  await switchDatabaseTab(page, CLASSES_TAB);

  await page.screenshot({ path: ".superpowers/sdd/qa-shots/classes-initial.png" });

  // 레코드 추가
  const rowsBefore = await page.locator('[data-testid^="db-record-row-"]').count();
  await page.getByTestId("db-add-record").click();
  await expect(page.locator('[data-testid^="db-record-row-"]')).toHaveCount(rowsBefore + 1);

  // 정체성/애니메이션
  await page.getByTestId("db-field-name").fill("QA 직업");
  await page.getByTestId("db-picker-class-animation").selectOption("anim_magic");

  // 전투 명령
  await page.getByTestId("db-field-class-command-name").fill("QA기술");
  await page.getByTestId("db-field-class-command-kind").selectOption("skillSubset");
  await page.getByTestId("db-field-class-command-subset").fill("QA계열");
  await page.getByTestId("db-picker-class-command-skill").selectOption("skill_heal");

  // 옵션
  await page.getByTestId("db-field-class-option-dualWield").check();
  await page.getByTestId("db-field-class-option-mightyGuard").check();

  // 스킬
  await page.getByTestId("db-field-class-skill-level").fill("15");
  await page.getByTestId("db-picker-class-skill").selectOption("skill_heal");

  // 유효도
  await page.getByTestId("db-picker-class-state-rate-state_death").selectOption("A");
  await page.getByTestId("db-picker-class-element-rate-fire").selectOption("D");

  // 장비 허용 — 2파에서 단일 select(배열 파괴 Critical)를 다중 체크박스로 교체.
  await page.getByTestId("db-field-class-equipment-equip_mage_staff").check();

  // 능력치 곡선
  await page.getByTestId("db-class-curve-edit-maxHp").click();
  await expect(page.getByTestId("db-class-parameter-dialog")).toBeVisible();
  await page.getByTestId("db-class-parameter-level").fill("9");
  await page.getByTestId("db-class-parameter-value").fill("321");
  await page.getByTestId("db-class-parameter-apply").click();
  await page.getByTestId("db-class-parameter-close").click();
  await expect(page.getByTestId("db-class-parameter-dialog")).toHaveCount(0);

  // 경험치 곡선
  await page.getByTestId("db-class-exp-edit").click();
  await expect(page.getByTestId("db-class-exp-dialog")).toBeVisible();
  await page.getByTestId("db-class-exp-base").fill("6");
  await page.getByTestId("db-class-exp-extra").fill("66");
  await page.getByTestId("db-class-exp-acceleration").fill("12");
  await page.getByTestId("db-class-exp-close").click();
  await expect(page.getByTestId("db-class-exp-dialog")).toHaveCount(0);

  // 승급
  await page.getByTestId("db-picker-class-promotion-to").selectOption({ index: 1 });
  await page.getByTestId("db-field-class-promotion-level").fill("20");
  await page.getByTestId("db-field-class-promotion-at-least").fill("3");

  await page.screenshot({ path: ".superpowers/sdd/qa-shots/classes-filled.png" });

  // 다른 탭 다녀와서 값 보존 확인
  await switchDatabaseTab(page, { label: "Skills", slug: "skills", testId: "db-tab-skills" });
  await switchDatabaseTab(page, CLASSES_TAB);
  await expect(page.getByTestId("db-field-name")).toHaveValue("QA 직업");
  await expect(page.getByTestId("db-picker-class-animation")).toHaveValue("anim_magic");
  await expect(page.getByTestId("db-field-class-command-name")).toHaveValue("QA기술");
  await expect(page.getByTestId("db-field-class-option-dualWield")).toBeChecked();

  await applyDatabaseChanges(page);
  await closeAndReopenDatabase(page);
  await switchDatabaseTab(page, CLASSES_TAB);
  // 모달을 닫았다 열면 선택 레코드가 항상 목록 첫 행으로 리셋된다(전 탭 공통 동작,
  // classes 한정 결함 아님) — 이름으로 방금 추가한 행을 다시 선택해 값 보존을 확인한다.
  await page.locator(".db-list-row", { hasText: "QA 직업" }).click();
  await expect(page.getByTestId("db-field-name")).toHaveValue("QA 직업");

  const packet = await exportedProject(page);
  const klass = packet.database.classes.find((entry) => entry.name === "QA 직업");
  expect(klass).toBeTruthy();
  expect(klass?.animationId).toBe("anim_magic");
  expect(klass?.battleCommands[0]).toMatchObject({ name: "QA기술", kind: "skillSubset" });
  expect(klass?.learnedSkills).toContainEqual({ level: 15, skillId: "skill_heal" });
  expect(klass?.options?.dualWield).toBe(true);
  expect(klass?.options?.mightyGuard).toBe(true);
  expect(klass?.stateRates.state_death).toBe("A");
  expect(klass?.elementRates.fire).toBe("D");
  expect(klass?.equipmentPermissions?.equipmentIds).toEqual(["equip_mage_staff"]);
  expect(klass?.parameterCurves.maxHp).toHaveLength(99);
  expect(klass?.parameterCurves.maxHp[8]).toBe(321);
  expect(klass?.expCurve).toEqual({ base: 6, extra: 66, acceleration: 12 });

  // 복제
  const rowsBeforeDuplicate = await page.locator('[data-testid^="db-record-row-"]').count();
  await page.getByRole("button", { name: "복제" }).click();
  await expect(page.locator('[data-testid^="db-record-row-"]')).toHaveCount(rowsBeforeDuplicate + 1);

  // 삭제 2단계 확인 (참조 없는 방금 복제본 대상)
  const deleteButton = page.getByTestId("db-delete-selected");
  await deleteButton.click();
  await expect(deleteButton).toHaveText("정말 삭제?");
  await deleteButton.click();
  await expect(page.locator('[data-testid^="db-record-row-"]')).toHaveCount(rowsBeforeDuplicate);

  // 127.0.0.1:17831(devtools bridge) 연결 거부는 알려진 노이즈 — 콘솔 메시지에는 URL이
  // 찍히지 않고 "Failed to load resource: net::ERR_CONNECTION_REFUSED"만 남으므로 함께 걸러낸다.
  const noisyErrors = consoleErrors.filter(
    (text) => !text.includes("127.0.0.1:17831") && !text.includes("ERR_CONNECTION_REFUSED")
  );
  expect(noisyErrors, `unexpected console errors: ${noisyErrors.join(" | ")}`).toEqual([]);
});

test("classes 탭 검색이 이름 부분일치로 실동작한다", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await openDatabase(page);
  await switchDatabaseTab(page, CLASSES_TAB);

  const rows = page.locator('[data-testid^="db-record-row-"]');
  const totalBefore = await rows.count();
  expect(totalBefore).toBeGreaterThan(0);

  const search = page.locator(".db-search input").first();
  await search.fill("사");
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "전사" })).toHaveCount(1);
  await expect(rows.filter({ hasText: "마도사" })).toHaveCount(1);

  await search.fill("존재하지않는직업검색어zzz");
  await expect(rows).toHaveCount(0);

  await search.fill("");
  await expect(rows).toHaveCount(totalBefore);
});

test("classes 탭에서 이름 편집 후 Ctrl+Z 로 되돌린다", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/?freshProject=1");
  await openDatabase(page);
  await switchDatabaseTab(page, CLASSES_TAB);

  const nameInput = page.getByTestId("db-field-name");
  await expect(nameInput).toHaveValue("전사");
  await nameInput.fill("전사-수정됨");
  await expect(nameInput).toHaveValue("전사-수정됨");

  // 텍스트 필드에 포커스가 있으면 브라우저 자체 undo가 우선되므로 포커스를 뺀 뒤 Ctrl+Z.
  await page.locator("h3", { hasText: "직업" }).click();
  await page.keyboard.press("Control+z");
  await expect(nameInput).toHaveValue("전사");
});
