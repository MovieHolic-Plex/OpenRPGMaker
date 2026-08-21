import { expect, test } from "@playwright/test";
import {
  exportedProject,
  openDatabase,
  switchDatabaseTab,
  DATABASE_TAB_SPECS,
} from "./rm2k3-database-helpers";
import type { Page } from "@playwright/test";

const ANIM_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "animations")!;
const SCREEN_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "battle-screen")!;
const COMMANDS_TAB = DATABASE_TAB_SPECS.find((tab) => tab.slug === "battle-commands")!;

function collectConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    const url = msg.location().url ?? "";
    if (msg.type() === "error" && !url.includes("17831") && !msg.text().includes("17831")) {
      errors.push(`${msg.text()} @ ${url}`);
    }
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

async function boot(page: Page): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
  await page.goto("/?freshProject=1");
  await openDatabase(page);
}

test.describe("QA explore — battle tabs (animations / battler / screen / commands)", () => {
  test("animations tab: CRUD + frame/cell/timing editors + preview playback", async ({ page }) => {
    test.setTimeout(120_000);
    const consoleErrors = collectConsole(page);
    await boot(page);
    await switchDatabaseTab(page, ANIM_TAB);
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/battle-anim-01-initial.png" });

    // existing records + resources snapshot
    const project0 = await exportedProject(page);
    console.log("EXISTING_ANIMS", JSON.stringify(project0.database.battleAnimations.map((a) => ({ name: a.name, res: a.resourceId }))));

    // ---- CRUD: add record, fill fields ----
    await page.getByTestId("db-add-record").click();
    const longName = "전투애니".repeat(10); // 40 chars
    await page.getByTestId("db-field-name").fill(longName);
    await page.getByTestId("db-field-animation-resource").fill("qa-없는-리소스-id");
    await page.getByTestId("db-field-animation-scope").selectOption("allTargets");
    await page.getByTestId("db-field-animation-position").selectOption("screen");
    await page.getByTestId("db-field-animation-large").check();
    // boundary values on sheet
    await page.getByTestId("db-field-animation-frame-width").fill("0");
    await page.getByTestId("db-field-animation-frame-height").fill("-10");
    await page.getByTestId("db-field-animation-columns").fill("0");
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/battle-anim-02-boundary-sheet.png" });
    const boundaryExport = await exportedProject(page);
    const boundaryRec = boundaryExport.database.battleAnimations.find((a) => a.name === longName);
    console.log("BOUNDARY_SHEET", JSON.stringify(boundaryRec?.sheet));
    // restore sane sheet
    await page.getByTestId("db-field-animation-frame-width").fill("96");
    await page.getByTestId("db-field-animation-frame-height").fill("96");
    await page.getByTestId("db-field-animation-columns").fill("5");

    // ---- frame list: add / duplicate / prev / next / delete ----
    await page.getByTestId("db-animation-frame-add").click();
    await page.getByTestId("db-animation-frame-add").click();
    await expect(page.getByTestId("db-animation-frame-2")).toBeVisible();
    await expect(page.getByTestId("db-field-animation-max-frames")).toHaveValue("3");
    await page.getByTestId("db-animation-frame-duplicate").click();
    await expect(page.getByTestId("db-field-animation-max-frames")).toHaveValue("4");

    // --- frame selection probe (suspected dead: editorState.set without rerender) ---
    await page.getByTestId("db-animation-frame-prev").click();
    await page.waitForTimeout(400);
    const prevProbe = await page.getByTestId("db-animation-frame-2").getAttribute("class");
    await page.getByTestId("db-animation-frame-0").click();
    await page.waitForTimeout(400);
    const rowProbe = await page.getByTestId("db-animation-frame-0").getAttribute("class");
    console.log("FRAME_SELECT_PROBE", JSON.stringify({ afterPrevClickFrame2: prevProbe, afterRowClickFrame0: rowProbe }));

    // --- layout geometry probe: do editor panels overlap? ---
    const geometry = await page.evaluate(() => {
      const pick = (selector: string) => {
        const node = document.querySelector(selector);
        if (!(node instanceof HTMLElement)) return null;
        const r = node.getBoundingClientRect();
        return { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), display: getComputedStyle(node).display };
      };
      return {
        editor: pick("[data-testid='db-animation-rm2003-editor']"),
        topGrid: pick(".db-animation-top-grid"),
        frames: pick(".db-animation-frame-list-panel"),
        stage: pick(".db-animation-stage-panel"),
        stageSurface: pick("[data-testid='db-animation-sheet-preview-surface']"),
        timing: pick("[data-testid='db-animation-timing-panel']"),
        cells: pick("[data-testid='db-animation-cell-table']"),
        strip: pick("[data-testid='db-animation-pattern-strip']"),
        detailForm: pick(".rm2k3-detail-battleAnimations"),
      };
    });
    console.log("ANIM_LAYOUT_GEOMETRY", JSON.stringify(geometry));

    await page.getByTestId("db-animation-frame-delete").click();
    const framesAfterDelete = await page.getByTestId("db-field-animation-max-frames").inputValue();
    console.log("FRAMES_AFTER_DELETE", framesAfterDelete);

    // "+ 프레임" button in max-frame field: probe occlusion (stage panel overlays it), then force-click
    const occlusion = await page.evaluate(() => {
      const btn = document.querySelector("[data-testid='db-animation-add-frame']");
      if (!(btn instanceof HTMLElement)) return null;
      const r = btn.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return {
        btn: { top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height) },
        hitTag: hit?.tagName,
        hitText: (hit?.textContent ?? "").slice(0, 30),
        hitIsButtonItself: hit === btn || btn.contains(hit),
      };
    });
    console.log("ADD_FRAME_OCCLUSION", JSON.stringify(occlusion));
    // 결함: 실사용자는 포인터로 클릭 불가(스테이지 패널이 버튼을 덮음) — 핸들러 자체는 동작하므로 DOM click으로 검증
    await page.getByTestId("db-animation-add-frame").evaluate((btn) => (btn as HTMLButtonElement).click());
    await expect(page.getByTestId("db-field-animation-max-frames")).toHaveValue("4");

    // ---- cell table: edit boundary values, add, delete ----
    await page.getByTestId("db-animation-cell-x-0").fill("9999");
    await page.getByTestId("db-animation-cell-zoom-0").fill("0");
    await page.getByTestId("db-animation-cell-opacity-0").fill("9999");
    const cellInputEcho = {
      x: await page.getByTestId("db-animation-cell-x-0").inputValue(),
      zoom: await page.getByTestId("db-animation-cell-zoom-0").inputValue(),
      opacity: await page.getByTestId("db-animation-cell-opacity-0").inputValue(),
    };
    await page.getByTestId("db-animation-cell-add").click();
    await expect(page.getByTestId("db-animation-cell-pattern-1")).toBeVisible();
    await page.getByTestId("db-animation-cell-delete-1").click();
    await expect(page.getByTestId("db-animation-cell-pattern-1")).toHaveCount(0);
    const cellExport = await exportedProject(page);
    const cellRec = cellExport.database.battleAnimations.find((a) => a.name === longName) as
      | { frames?: { cells: { x: number; zoom: number; opacity: number }[] }[] }
      | undefined;
    console.log("CELL_BOUNDARY", JSON.stringify({ cellInputEcho, frames: cellRec?.frames }));

    // ---- cell batch dialog: OK path + cancel path ----
    await page.getByTestId("db-animation-cell-batch").click();
    await expect(page.getByTestId("db-animation-cell-batch-dialog")).toBeVisible();
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/battle-anim-03-batch-dialog.png" });
    await page.getByTestId("db-animation-batch-zoom").fill("200");
    await page.getByTestId("db-animation-batch-x").fill("12");
    await page.getByTestId("db-animation-cell-batch-ok").click();
    await expect(page.getByTestId("db-animation-cell-batch-dialog")).toHaveCount(0);
    await expect(page.getByTestId("db-animation-cell-zoom-0")).toHaveValue("200");
    await expect(page.getByTestId("db-animation-cell-x-0")).toHaveValue("12");
    await page.getByTestId("db-animation-cell-batch").click();
    await page.getByTestId("db-animation-cell-batch-cancel").click();
    await expect(page.getByTestId("db-animation-cell-batch-dialog")).toHaveCount(0);

    // ---- copy / paste / interpolate ----
    await page.getByRole("button", { name: "셀 복사" }).click();
    const pasteBtn = page.getByRole("button", { name: "셀 붙여넣기" });
    await expect(pasteBtn).toBeEnabled();
    await pasteBtn.click();
    // interpolate: middle frame selected (frame index 1 of 4)
    await page.getByTestId("db-animation-frame-1").click();
    await page.getByTestId("db-animation-cell-interpolate").click();
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/battle-anim-04-after-interpolate.png" });
    // interpolate on first frame -> info toast (no crash)
    await page.getByTestId("db-animation-frame-0").click();
    await page.getByTestId("db-animation-cell-interpolate").click();

    // ---- timing table: add / delete (겹침 회피를 위해 DOM click) ----
    await page.getByTestId("db-animation-timing-add").evaluate((btn) => (btn as HTMLButtonElement).click());
    await expect(page.getByTestId("db-animation-timing-delete-0")).toBeAttached();
    const timingInputs = await page.getByTestId("db-animation-timing-table").locator("input, select").count();
    console.log("TIMING_EDITABLE_CONTROLS", timingInputs); // 0 expected => sound/flash/shake not editable
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/battle-anim-05-timing-row.png" });
    await page.getByTestId("db-animation-timing-delete-0").evaluate((btn) => (btn as HTMLButtonElement).click());
    await expect(page.locator("[data-testid^='db-animation-timing-delete-']")).toHaveCount(0);

    // ---- pattern strip: dead-control probe (DOM click) ----
    const strip = page.getByTestId("db-animation-pattern-strip");
    const thirdPattern = strip.locator("button").nth(2);
    const activeBefore = await strip.locator("button.active").count();
    const classBefore = await thirdPattern.getAttribute("class");
    await thirdPattern.evaluate((btn) => (btn as HTMLButtonElement).click());
    await page.waitForTimeout(300);
    const classAfter = await thirdPattern.getAttribute("class");
    console.log("PATTERN_STRIP_CLICK", JSON.stringify({ activeBefore, classBefore, classAfter }));

    // ---- playback on a record with a real resource (default project record) ----
    const withRes = project0.database.battleAnimations.find((a) => a.resourceId);
    console.log("PLAYBACK_RECORD", JSON.stringify(withRes?.name));
    if (withRes) {
      const anyExport = await page.evaluate(() => document.querySelector("[data-testid='project-export-json']")?.textContent ?? "");
      const parsed = JSON.parse(anyExport) as { project: { database: { battleAnimations: { id: string; name: string }[] } } };
      const target = parsed.project.database.battleAnimations.find((a) => a.name === withRes.name);
      if (target) await page.getByTestId(`db-record-row-${target.id}`).click();
    }
    await expect(page.getByTestId("db-animation-sheet-preview-surface")).toBeVisible();
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/battle-anim-06-preview-idle.png" });
    const bgImage = await page.getByTestId("db-animation-stage-target").evaluate((node) => getComputedStyle(node).backgroundImage);
    console.log("STAGE_TARGET_BG", bgImage.slice(0, 120));
    await page.getByTestId("db-animation-play").click();
    // 짧은 애니메이션은 "■ 정지" 표시가 수백 ms만 유지되므로 전이는 관용적으로 기록만 한다.
    const playMidText = await page.getByTestId("db-animation-play").textContent();
    console.log("PLAY_BUTTON_MID", playMidText);
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/battle-anim-07-playing.png" });
    // 재생 종료 후 항상 "▶ 재생"으로 복귀해야 한다(안정 종단 상태).
    await expect(page.getByTestId("db-animation-play")).toHaveText("▶ 재생", { timeout: 10_000 });

    // ---- persistence round-trip ----
    await switchDatabaseTab(page, SCREEN_TAB);
    await switchDatabaseTab(page, ANIM_TAB);
    const afterRoundTrip = await exportedProject(page);
    expect(afterRoundTrip.database.battleAnimations.some((a) => a.name === longName)).toBe(true);

    // ---- undo probe (라운드트립 후에도 선택 레코드는 세션에 유지된다) ----
    await page.getByTestId("db-field-name").fill("UNDO 대상 이름");
    await page.getByTestId("db-field-name").blur();
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(400);
    const nameAfterUndo = await page.getByTestId("db-field-name").inputValue();
    console.log("ANIM_NAME_AFTER_UNDO", nameAfterUndo);

    // ---- duplicate + 2-step delete ----
    const toolbar = page.locator(".db-toolbar");
    await toolbar.getByRole("button", { name: "복제" }).click();
    const dupExport = await exportedProject(page);
    console.log("ANIM_COUNT_AFTER_DUP", dupExport.database.battleAnimations.length);
    await page.getByTestId("db-delete-selected").click();
    await expect(page.getByTestId("db-delete-selected")).toHaveText("정말 삭제?");
    await page.getByTestId("db-delete-selected").click();
    const delExport = await exportedProject(page);
    console.log("ANIM_COUNT_AFTER_DELETE", delExport.database.battleAnimations.length);

    console.log("CONSOLE_ERRORS_ANIM", JSON.stringify(consoleErrors));
  });

  test("battle screen tab: system fields edit + persistence + undo", async ({ page }) => {
    const consoleErrors = collectConsole(page);
    await boot(page);
    await switchDatabaseTab(page, SCREEN_TAB);
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/battle-screen-01-initial.png" });

    await page.getByTestId("db-field-battle-system-resource").fill("qa-전투-시스템-리소스");
    await page.getByTestId("db-field-battle-screen-flow").selectOption("strict");
    await page.getByTestId("db-field-battle-screen-active-slots").fill("-3"); // boundary
    await page.getByTestId("db-field-battle-screen-active-slots").fill("4");
    const troopPicker = page.getByTestId("db-picker-battle-initial-troop");
    const troopOptions = await troopPicker.locator("option").count();
    console.log("TROOP_OPTIONS", troopOptions);
    if (troopOptions > 1) await troopPicker.selectOption({ index: 1 });
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/battle-screen-02-edited.png" });

    // round-trip + export (system fields live outside typed helper -> raw read)
    await switchDatabaseTab(page, COMMANDS_TAB);
    await switchDatabaseTab(page, SCREEN_TAB);
    await expect(page.getByTestId("db-field-battle-system-resource")).toHaveValue("qa-전투-시스템-리소스");
    await expect(page.getByTestId("db-field-battle-screen-flow")).toHaveValue("strict");
    await expect(page.getByTestId("db-field-battle-screen-active-slots")).toHaveValue("4");
    const raw = await page.evaluate(() => document.querySelector("[data-testid='project-export-json']")?.textContent ?? "{}");
    const sys = (JSON.parse(raw) as { project?: { system?: Record<string, unknown> } }).project?.system ?? {};
    console.log("SYSTEM_EXPORT", JSON.stringify({ battleSystemResourceId: sys.battleSystemResourceId, battleFlow: sys.battleFlow, activeSlots: sys.activeSlots, initialTroopId: sys.initialTroopId }));
    expect(sys.battleSystemResourceId).toBe("qa-전투-시스템-리소스");
    expect(sys.battleFlow).toBe("strict");
    expect(sys.activeSlots).toBe(4);

    // undo on flow (project snapshot): make flow change the last mutation, then Ctrl+Z
    await page.getByTestId("db-field-battle-screen-flow").selectOption("gauge");
    await page.keyboard.press("Control+z");
    await page.waitForTimeout(400);
    const raw2 = await page.evaluate(() => document.querySelector("[data-testid='project-export-json']")?.textContent ?? "{}");
    const sys2 = (JSON.parse(raw2) as { project?: { system?: Record<string, unknown> } }).project?.system ?? {};
    console.log("SYSTEM_AFTER_UNDO", JSON.stringify({ battleFlow: sys2.battleFlow, activeSlots: sys2.activeSlots, initialTroopId: sys2.initialTroopId }));
    const flowFieldAfterUndo = await page.getByTestId("db-field-battle-screen-flow").inputValue();
    console.log("FLOW_FIELD_AFTER_UNDO", flowFieldAfterUndo);
    console.log("CONSOLE_ERRORS_SCREEN", JSON.stringify(consoleErrors));
  });

  test("battle commands tab: inline edit + kind labels + persistence + undo", async ({ page }) => {
    const consoleErrors = collectConsole(page);
    await boot(page);
    await switchDatabaseTab(page, COMMANDS_TAB);
    await page.screenshot({ path: ".superpowers/sdd/qa-shots/battle-commands-01-initial.png" });

    const project0 = await exportedProject(page);
    const commands = project0.database.battleCommands ?? [];
    const renderedRows = await page.locator("[data-testid^='db-field-battle-command-name-']").count();
    console.log("COMMANDS_TOTAL_VS_RENDERED", commands.length, renderedRows);

    if (renderedRows > 0) {
      // kind option labels probe (guard/switch untranslated?)
      const kindLabels = await page.getByTestId("db-field-battle-command-kind-0").locator("option").allTextContents();
      console.log("KIND_OPTION_LABELS", JSON.stringify(kindLabels));

      const longName = "명령이름".repeat(10);
      await page.getByTestId("db-field-battle-command-name-0").fill(longName);
      await page.getByTestId("db-field-battle-command-kind-0").selectOption("guard");
      await page.getByTestId("db-field-battle-command-subset-0").fill("qa-계열");
      await page.getByTestId("db-field-battle-command-skill-0").fill("존재하지-않는-스킬-id");
      await page.screenshot({ path: ".superpowers/sdd/qa-shots/battle-commands-02-edited.png" });

      await switchDatabaseTab(page, ANIM_TAB);
      await switchDatabaseTab(page, COMMANDS_TAB);
      await expect(page.getByTestId("db-field-battle-command-name-0")).toHaveValue(longName);
      const after = await exportedProject(page);
      const rec = after.database.battleCommands?.[0];
      console.log("COMMAND_EXPORT", JSON.stringify(rec));
      expect(rec?.name).toBe(longName);
      expect(rec?.kind).toBe("guard");
      console.log("BOGUS_SKILL_ACCEPTED", rec?.skillId);

      // undo
      await page.getByTestId("db-field-battle-command-name-0").fill("UNDO 명령");
      await page.keyboard.press("Control+z");
      await page.waitForTimeout(400);
      const undoName = (await exportedProject(page)).database.battleCommands?.[0]?.name;
      console.log("COMMAND_NAME_AFTER_UNDO", undoName);
    }
    console.log("CONSOLE_ERRORS_COMMANDS", JSON.stringify(consoleErrors));
  });

  test("layout probes: fieldset overlap/scroll metrics on utility battle tabs", async ({ page }) => {
    await boot(page);
    for (const tab of [SCREEN_TAB, COMMANDS_TAB]) {
      await switchDatabaseTab(page, tab);
      const metrics = await page.evaluate(() => {
        const form = document.querySelector(".db-parity-form");
        if (!(form instanceof HTMLElement)) return null;
        const fieldsets = Array.from(form.querySelectorAll(":scope > .rm2k3-db-fieldset")).map((node) => {
          const elx = node as HTMLElement;
          const r = elx.getBoundingClientRect();
          const legend = elx.querySelector("legend")?.textContent ?? "";
          return {
            legend,
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            h: Math.round(r.height),
            scrollH: elx.scrollHeight,
            clientH: elx.clientHeight,
            overflowY: getComputedStyle(elx).overflowY,
          };
        });
        const fr = form.getBoundingClientRect();
        return {
          form: { top: Math.round(fr.top), bottom: Math.round(fr.bottom), scrollH: form.scrollHeight, clientH: form.clientHeight, overflowY: getComputedStyle(form).overflowY },
          fieldsets,
        };
      });
      console.log(`LAYOUT_${tab.slug}`, JSON.stringify(metrics));
    }
  });
});
