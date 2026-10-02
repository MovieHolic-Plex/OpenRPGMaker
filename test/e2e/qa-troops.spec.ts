import { expect, test, type Page } from "@playwright/test";
import {
  DATABASE_TAB_SPECS,
  exportedProject,
  openDatabase,
  switchDatabaseTab,
} from "./oprn-database-helpers";

const TROOPS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "troops")!;
const ENEMIES_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "enemies")!;

type ExportedTroop = {
  id: string;
  name: string;
  enemyIds: string[];
  members?: { enemyId: string; x: number; y: number; hidden?: boolean }[];
  previewBackgroundResourceId?: string;
  autoAlign?: boolean;
  uncapturable?: boolean;
  activeSlots?: number;
  battleEventPages?: {
    span?: string;
    conditions: { kind: string }[];
    commands: { kind: string; commandId?: string; fields?: Record<string, unknown> }[];
  }[];
};

async function troopsFromExport(page: Page): Promise<ExportedTroop[]> {
  const project = await exportedProject(page);
  return project.database.troops as unknown as ExportedTroop[];
}

async function gotoTroopsTab(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await openDatabase(page);
  await switchDatabaseTab(page, TROOPS_TAB);
  await expect(page.getByTestId("db-troops-classic-workbench")).toBeVisible();
}

async function selectedTroopId(page: Page): Promise<string> {
  const row = page.locator(".db-list-row.active");
  await expect(row).toBeVisible();
  const id = await row.getAttribute("data-record-id");
  if (!id) throw new Error("no selected troop row");
  return id;
}

async function addTroop(page: Page): Promise<string> {
  await page.getByTestId("db-add-record").click();
  return selectedTroopId(page);
}

test.describe("QA — troops tab", () => {
  // 이 워크벤치는 store 업데이트마다 폼 전체를 재구축(+스프라이트 이미지 재로드)해서
  // 부하가 걸린 CI/공유 박스에서는 스텝이 느려진다. 기본 30s로는 간헐 타임아웃.
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await gotoTroopsTab(page);
  });

  test("recon: layout screenshots + console error watch", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.location().url.includes("17831") && !msg.text().includes("17831")) {
        consoleErrors.push(msg.text());
      }
    });

    // default first troop
    await page.locator(".db-list-row").first().click();
    await expect(page.getByTestId("db-troop-preview-stage")).toBeVisible();
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/troops-initial.png" });
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/troops-full.png", fullPage: true });

    // 설정 패널 (수동/자동/참전 수/포획 불가) 확대 캡처
    const configPanel = page.locator(".db-troop-top-controls > .db-troop-classic-panel").last();
    await expect(configPanel).toBeVisible();
    await configPanel.screenshot({ path: ".superpowers/sdd/qa-shots/troops-config-panel.png" });
    const topControls = page.locator(".db-troop-top-controls");
    await topControls.screenshot({ path: ".superpowers/sdd/qa-shots/troops-top-controls.png" });

    // 이벤트 패널 — 2026-09: 「전투 이벤트」 구획 탭 안에 있다.
    await page.getByTestId("db-troop-section-events-tab").click();
    const eventPanel = page.locator(".db-troop-event-panel");
    await expect(eventPanel).toBeVisible();
    await eventPanel.screenshot({ path: ".superpowers/sdd/qa-shots/troops-event-panel.png" });

    // horizontal overflow probe: does the 1048px workbench fit the modal body?
    const overflow = await page.evaluate(() => {
      const body = document.querySelector(".database-modal-body .db-body");
      const bench = document.querySelector(".db-troops-classic-workbench");
      if (!(body instanceof HTMLElement) || !(bench instanceof HTMLElement)) return null;
      return {
        bodyClientWidth: body.clientWidth,
        bodyScrollWidth: body.scrollWidth,
        benchWidth: bench.getBoundingClientRect().width,
        benchScrollHeight: bench.scrollHeight,
        benchClientHeight: bench.clientHeight,
      };
    });
    console.log("TROOPS OVERFLOW METRICS:", JSON.stringify(overflow));

    expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
  });

  test("CRUD round trip: add, members, placement, config, tab away/back, export, duplicate, delete", async ({ page }) => {
    const id = await addTroop(page);
    await page.getByTestId("db-field-name").fill("QA 트룹");

    // member add x2
    await page.getByTestId("db-troop-member-add").click();
    await expect(page.getByTestId("db-troop-member-row-1")).toBeVisible();
    await page.getByTestId("db-troop-member-add").click();
    await expect(page.getByTestId("db-troop-member-row-2")).toBeVisible();

    // placement X/Y on selected (2nd) member
    await page.getByTestId("db-field-troop-member-x").fill("200");
    await page.getByTestId("db-field-troop-member-y").fill("80");
    await expect(page.getByTestId("db-troop-member-row-2")).toContainText("X200 Y80");

    // hidden checkbox
    await page.getByTestId("db-field-troop-member-hidden").check();

    // enemy picker: switch selected member to a different enemy
    const enemySelect = page.getByTestId("db-picker-troop-member-enemy");
    const enemyOptions = await enemySelect.locator("option").all();
    expect(enemyOptions.length).toBeGreaterThan(1);
    const altEnemy = await enemyOptions[1].getAttribute("value");
    if (altEnemy) await enemySelect.selectOption(altEnemy);

    // 이름 생성 button: derives name from member enemy names
    await page.getByTestId("db-troop-generate-name").click();
    const generated = await page.getByTestId("db-field-name").inputValue();
    expect(generated).toContain("부대");

    // 배경 변경 button cycles the scenery kind (도트 측면, 2026-10-02 — 그림 칸이 아니라 종류 카드가 바뀐다)
    const checkedScenery = (): Promise<string | null> =>
      page.locator('[data-testid^="db-troop-scenery-"][aria-checked="true"]').first().getAttribute("data-testid");
    await page.getByTestId("db-troop-change-background").click();
    const backdrop1 = await checkedScenery();
    expect(backdrop1).toMatch(/^db-troop-scenery-(plains|forest|cave|snow|desert)$/);
    await page.getByTestId("db-troop-change-background").click();
    const backdrop2 = await checkedScenery();
    expect(backdrop2).toMatch(/^db-troop-scenery-(plains|forest|cave|snow|desert)$/);
    expect(backdrop2).not.toBe(backdrop1);

    // config: 수동 radio + 참전 수 + 포획 불가
    await page.locator(".db-troop-radio input[value='manual']").check();
    await page.getByTestId("db-field-troop-active-slots").fill("3");
    await page.getByTestId("db-field-troop-uncapturable").check();

    await page.screenshot({ path: ".superpowers/sdd/qa-shots/troops-crud-filled.png" });

    // tab away & back: persistence
    await switchDatabaseTab(page, ENEMIES_TAB);
    await switchDatabaseTab(page, TROOPS_TAB);
    await expect(page.getByTestId(`db-record-row-${id}`)).toHaveClass(/active/);
    await expect(page.getByTestId("db-field-name")).toHaveValue(generated);
    await expect(page.getByTestId("db-troop-member-row-2")).toBeVisible();
    await expect(page.locator(".db-troop-radio input[value='manual']")).toBeChecked();
    await expect(page.getByTestId("db-field-troop-active-slots")).toHaveValue("3");
    await expect(page.getByTestId("db-field-troop-uncapturable")).toBeChecked();

    // export reflects the record
    const troop = (await troopsFromExport(page)).find((entry) => entry.id === id);
    expect(troop, "exported troop should exist").toBeTruthy();
    expect(troop?.name).toBe(generated);
    expect(troop?.members?.length).toBe(2);
    expect(troop?.members?.[1]).toMatchObject({ x: 200, y: 80, hidden: true });
    expect(troop?.autoAlign).toBe(false);
    expect(troop?.activeSlots).toBe(3);
    expect(troop?.uncapturable).toBe(true);
    expect(troop?.previewBackgroundResourceId).toBe(backdrop2);

    // 자동 radio re-arranges members
    await page.locator(".db-troop-radio input[value='automatic']").check();
    const afterAuto = (await troopsFromExport(page)).find((entry) => entry.id === id);
    expect(afterAuto?.autoAlign).toBe(true);
    expect(afterAuto?.members?.[0]).toMatchObject({ x: 92, y: 92 });

    // sprite click selects the member (preview canvas interaction)
    await page.getByTestId("db-troop-member-sprite-1").click();
    await expect(page.getByTestId("db-troop-member-row-1")).toHaveClass(/active/);

    // 정렬 / RM2003 / 지우기
    await page.getByTestId("db-troop-member-arrange").click();
    await expect(page.getByTestId("db-troop-member-row-1")).toContainText("X92 Y92");
    await page.getByTestId("db-troop-member-rm2003-preset").click();
    await expect(page.getByTestId("db-troop-member-row-4")).toBeVisible();
    const rm2003 = (await troopsFromExport(page)).find((entry) => entry.id === id);
    expect(rm2003?.members?.length).toBe(4);
    await page.getByTestId("db-troop-member-clear").click();
    await expect(page.locator(".db-troop-member-row.empty")).toBeVisible();

    // duplicate (복제본 이름에는 " 사본" 접미사가 붙는다 — wave2 fix, 이름 충돌 시 번호 증가)
    await page.locator(".btn.small", { hasText: "복제" }).click();
    const duplicatedId = await selectedTroopId(page);
    expect(duplicatedId).not.toBe(id);
    await expect(page.getByTestId("db-field-name")).toHaveValue(`${generated} 사본`);

    // delete: two-step confirm
    const deleteButton = page.getByTestId("db-delete-selected");
    await deleteButton.click();
    await expect(deleteButton).toHaveText("정말 삭제?");
    await expect(page.getByTestId(`db-record-row-${duplicatedId}`)).toBeVisible();
    await deleteButton.click();
    await expect(page.getByTestId(`db-record-row-${duplicatedId}`)).toBeHidden();
  });

  test("battle event panel: page add/template/span/condition/commands/page delete", async ({ page }) => {
    const id = await addTroop(page);
    await page.getByTestId("db-field-name").fill("QA 이벤트 트룹");
    await page.getByTestId("db-troop-member-add").click();
    // 2026-09: 전투 이벤트는 「전투 이벤트」 구획 탭 안에 있다.
    await page.getByTestId("db-troop-section-events-tab").click();

    // no page yet → quality strip says missing payoff
    await expect(page.getByTestId("db-troop-event-quality")).toContainText("전투 후 보상/후속 연출 없음");

    // 새로 만들기: add a page
    await page.getByTestId("db-troop-event-add-page").click();
    await expect(page.getByTestId("db-troop-event-page-tab-1")).toHaveClass(/active/);

    // span select
    await page.getByTestId("db-field-troop-event-span").selectOption("turn");

    // condition kind select
    await page.getByTestId("db-field-troop-event-condition-kind").selectOption("switch");

    // command adds inside 실행 내용 fieldset
    await page.getByTestId("db-troop-event-add-change-enemy-hp").click();
    await expect(page.getByTestId("db-field-troop-event-change-enemy-hp-target")).toBeVisible();
    await page.getByTestId("db-field-troop-event-change-enemy-hp-value").fill("77");
    await page.getByTestId("db-troop-event-add-enemy-encounter").click();
    await expect(page.getByTestId("db-field-troop-event-enemy-encounter-target")).toBeVisible();
    await page.getByTestId("db-troop-event-add-force-escape").click();
    await expect(page.getByTestId("db-field-troop-event-force-escape-summary")).toBeVisible();
    await page.getByTestId("db-troop-event-add-action-times").click();
    await expect(page.getByTestId("db-field-troop-event-action-times-target")).toBeVisible();

    // command list shows ◆-style rows
    await expect(page.getByTestId("db-troop-event-command-list")).toBeVisible();
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/troops-event-commands.png", fullPage: true });

    // 보상 흐름 템플릿 on page 1 (adds battleback + result summary; encounter already present)
    await page.getByTestId("db-troop-event-apply-payoff-template").click();
    await expect(page.getByTestId("db-troop-event-quality")).toContainText("템플릿 적용됨");

    // second page via 새로 만들기, switch tabs between pages
    await page.getByTestId("db-troop-event-add-page").click();
    await expect(page.getByTestId("db-troop-event-page-tab-2")).toHaveClass(/active/);
    await page.getByTestId("db-troop-event-page-tab-1").click();
    await expect(page.getByTestId("db-troop-event-page-tab-1")).toHaveClass(/active/);
    await expect(page.getByTestId("db-field-troop-event-span")).toHaveValue("turn");

    // export check
    const troop = (await troopsFromExport(page)).find((entry) => entry.id === id);
    expect(troop?.battleEventPages?.length).toBe(2);
    const page1 = troop?.battleEventPages?.[0];
    expect(page1?.span).toBe("turn");
    expect(page1?.conditions?.[0]?.kind).toBe("switch");
    const commandIds = page1?.commands.map((command) => command.commandId) ?? [];
    expect(commandIds).toContain("m2-098-change-enemy-hp");
    expect(commandIds).toContain("m2-101-enemy-encounter");
    expect(commandIds).toContain("m2-107-force-escape");
    expect(commandIds).toContain("m2-108-action-times");
    expect(commandIds).toContain("m2-102-change-battleback");
    expect(commandIds).toContain("m2-109-result-summary");

    // 복사/붙여넣기/... are intentionally disabled (documented dead controls)
    const copyButton = page.locator(".db-troop-event-toolbar button", { hasText: "복사" });
    const pasteButton = page.locator(".db-troop-event-toolbar button", { hasText: "붙여넣기" });
    await expect(copyButton).toBeDisabled();
    await expect(pasteButton).toBeDisabled();

    // 삭제: remove page 1 → page tab 1 remains (former page 2)
    await page.getByTestId("db-troop-event-delete-page").click();
    const after = (await troopsFromExport(page)).find((entry) => entry.id === id);
    expect(after?.battleEventPages?.length).toBe(1);
    await expect(page.getByTestId("db-troop-event-page-tab-1")).toHaveClass(/active/);
    await expect(page.locator("[data-testid='db-troop-event-page-tab-2']")).toHaveCount(0);
  });

  test("battle test button: closes DB modal via hook, opens battle scene, returns to editor cleanly", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !msg.location().url.includes("17831") && !msg.text().includes("17831")) {
        consoleErrors.push(msg.text());
      }
    });

    // pick a default troop that has members
    await page.locator(".db-list-row").first().click();
    await page.getByTestId("db-troop-battle-test").click();

    // DB modal must be gone (proper close(), not DOM ripping)
    await expect(page.getByTestId("database-modal")).toHaveCount(0);
    const battleWindow = page.getByTestId("test-play-window");
    await expect(battleWindow).toBeVisible();
    await expect(page.getByTestId("test-play-window-title")).toContainText("전투 테스트");

    // battle scene actually mounts (enemy sprites / battle DOM inside body)
    const bodyHasContent = await page
      .getByTestId("test-play-window-body")
      .evaluate((node) => node.childElementCount > 0 && node.getBoundingClientRect().height > 100);
    expect(bodyHasContent).toBe(true);
    await page.waitForTimeout(600);
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/troops-battle-test.png" });

    // 복귀: "편집으로" closes battle window back to the editor
    await page.getByTestId("mode-edit").click();
    await expect(battleWindow).toBeHidden();
    await expect(page.getByTestId("edit-canvas")).toBeVisible();

    // listener-leak probe: after close, Escape must not throw / no stale DB modal appears
    await page.keyboard.press("Escape");
    await page.keyboard.press("Control+z");
    await expect(page.getByTestId("database-modal")).toHaveCount(0);

    // DB modal reopens fine afterwards
    await openDatabase(page);
    await switchDatabaseTab(page, TROOPS_TAB);
    await expect(page.getByTestId("db-troops-classic-workbench")).toBeVisible();

    expect(consoleErrors, `console errors: ${consoleErrors.join(" | ")}`).toEqual([]);
  });

  test("boundary values: long name, extreme XY, active slots clamp", ({ page }) =>
    (async () => {
      const id = await addTroop(page);

      // long name 40 chars
      await page.getByTestId("db-field-name").fill("적".repeat(40));
      await page.screenshot({ path: ".superpowers/sdd/qa-shots/troops-boundary-long-name.png" });

      await page.getByTestId("db-troop-member-add").click();

      // 참전 수 clamps 0/negative → cleared(미지정), huge → 99
      await page.getByTestId("db-field-troop-active-slots").fill("-5");
      await switchDatabaseTab(page, ENEMIES_TAB);
      await switchDatabaseTab(page, TROOPS_TAB);
      await expect(page.getByTestId("db-field-troop-active-slots")).toHaveValue("0");
      let troop = (await troopsFromExport(page)).find((entry) => entry.id === id);
      expect(troop?.activeSlots).toBeUndefined();

      await page.getByTestId("db-field-troop-active-slots").fill("500");
      await switchDatabaseTab(page, ENEMIES_TAB);
      await switchDatabaseTab(page, TROOPS_TAB);
      troop = (await troopsFromExport(page)).find((entry) => entry.id === id);
      expect(troop?.activeSlots).toBe(99);

      // extreme member X: preview must not explode; capture what is stored
      await page.getByTestId("db-field-troop-member-x").fill("9999");
      await page.getByTestId("db-field-troop-member-y").fill("-50");
      troop = (await troopsFromExport(page)).find((entry) => entry.id === id);
      console.log("EXTREME XY STORED:", JSON.stringify(troop?.members?.[0]));
      await page.screenshot({ path: ".superpowers/sdd/qa-shots/troops-boundary-xy.png" });
    })());

  test("undo: member add reverts with Ctrl+Z", async ({ page }) => {
    await page.locator(".db-list-row").first().click();
    const beforeRows = await page.locator(".db-troop-member-rows .db-troop-member-row").count();
    await page.getByTestId("db-troop-member-add").click();
    await expect(page.locator(".db-troop-member-rows .db-troop-member-row")).toHaveCount(beforeRows + 1);
    await page.keyboard.press("Control+z");
    await expect(page.locator(".db-troop-member-rows .db-troop-member-row")).toHaveCount(beforeRows);
  });
});
