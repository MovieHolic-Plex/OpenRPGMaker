import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

test.setTimeout(180_000);

const EVIDENCE_DIR = "output/evidence/event-editor-actor-battle-review";

const REPRESENTATIVE_COMMANDS = [
  { testId: "command-picker-add-battleProcessing", label: "전투" },
  { testId: "command-picker-add-changePartyMember", label: "파티 멤버" },
  { testId: "command-picker-add-changeExp", label: "경험치" },
  { testId: "command-picker-add-changeHp", label: "HP" },
  { testId: "command-picker-add-changeParameters", label: "능력치" },
  { testId: "command-picker-add-recoverAll", label: "전체 회복" },
  { testId: "command-picker-add-changeActorFaceset", label: "얼굴" },
] as const;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem("oprn:editor-session-id", "e2e-actor-battle-review");
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
    window.localStorage.setItem("oprn:coachmarks-basic-v1", "1");
  });
});

test("adversarial review of event-editor companions and battle tab", async ({ page }) => {
  await mkdir(EVIDENCE_DIR, { recursive: true });
  await page.setViewportSize({ width: 1478, height: 926 });
  console.log("goto blankProject");
  await page.goto("/?blankProject=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 20_000 });
  console.log("canvas visible");

  const editor = await openEventEditor(page);
  await expect(editor).toBeVisible();
  await shot(page, "01-event-editor-open.png");

  await openCommandPicker(page);
  const picker = page.getByTestId("event-command-picker");
  await expect(picker).toBeVisible();
  await picker.getByTestId("event-command-picker-tab-2").click();
  await expect(picker.getByTestId("event-command-picker-tab-2")).toHaveAttribute("aria-selected", "true");
  await shot(page, "02-picker-tab2-list.png", picker);

  const tab2Inventory = await inventoryPicker(picker);
  await writeJson("02-picker-tab2-inventory.json", tab2Inventory);

  const gridToggle = picker.getByTestId("event-command-picker-grid-toggle");
  if ((await gridToggle.count()) > 0) {
    await gridToggle.click();
    await shot(page, "03-picker-tab2-grid.png", picker);
    await gridToggle.click();
  }

  const search = picker.getByTestId("event-command-picker-search");
  if ((await search.count()) > 0) {
    await search.fill("전투");
    await shot(page, "04-picker-search-battle.png", picker);
    await search.fill("");
  }

  const findings: Record<string, unknown>[] = [];
  const opened: string[] = [];

  for (const command of REPRESENTATIVE_COMMANDS) {
    const button = await resolvePickerButton(picker, command.testId, command.label);
    if (!button) {
      findings.push({ id: command.testId, status: "missing-in-picker", label: command.label });
      continue;
    }
    const meta = {
      testId: command.testId,
      label: (await button.getAttribute("aria-label")) ?? command.label,
      disabled: await button.isDisabled(),
      ariaDisabled: await button.getAttribute("aria-disabled"),
      runtimeSupport: await button.getAttribute("data-runtime-support"),
      category: await button.getAttribute("data-category"),
    };
    await button.scrollIntoViewIfNeeded();
    if (meta.ariaDisabled === "true" || meta.disabled) {
      findings.push({ ...meta, status: "not-selectable" });
      continue;
    }
    await button.click();
    const dialog = page.getByTestId("event-command-edit-dialog");
    const appeared = await dialog.waitFor({ state: "visible", timeout: 4_000 }).then(() => true).catch(() => false);
    if (!appeared) {
      findings.push({ ...meta, status: "did-not-open-editor" });
      await closePickerIfOpen(page);
      await openCommandPicker(page);
      await page.getByTestId("event-command-picker-tab-2").click();
      continue;
    }

    const stacked = await page.getByTestId("event-command-picker").isVisible();
    const preview = dialog.getByTestId("event-command-preview");
    const previewProbe = await probePreview(dialog);
    const englishLeak = await collectEnglishLeak(dialog);
    const slug = slugify(command.testId);
    await shot(page, `05-${slug}-dialog.png`);
    if ((await preview.count()) > 0) {
      await shot(page, `05-${slug}-preview.png`, preview);
    }
    findings.push({
      ...meta,
      status: "opened",
      stackedPickerBehind: stacked,
      preview: previewProbe,
      englishLeak,
      formText: ((await dialog.innerText()) ?? "").slice(0, 1200),
    });
    opened.push(command.testId);

    await dialog.getByTestId("event-command-edit-cancel").click();
    await expect(dialog).toHaveCount(0);
    if (!(await picker.isVisible())) {
      await openCommandPicker(page);
      await page.getByTestId("event-command-picker-tab-2").click();
    }
  }

  await closePickerIfOpen(page);
  await writeJson("05-command-findings.json", { opened, findings });

  await openCommandPicker(page);
  await page.getByTestId("event-command-picker-tab-2").click();
  const battleBtn = await resolvePickerButton(picker, "command-picker-add-battleProcessing", "전투");
  expect(battleBtn, "battle command missing from tab 2").toBeTruthy();
  await battleBtn!.click();
  const battleDialog = page.getByTestId("event-command-edit-dialog");
  await expect(battleDialog).toBeVisible();
  await shot(page, "06-battle-empty-preview.png");

  const troopPicker = battleDialog.locator('[data-testid*="troop"]').first();
  const troopClicked = (await troopPicker.count()) > 0;
  if (troopClicked) {
    await troopPicker.click();
    await page.waitForTimeout(200);
    await shot(page, "06-battle-troop-picker.png");
    const option = page.locator('[role="option"], .record-picker-item, [data-testid*="record-option"]').first();
    if ((await option.count()) > 0 && (await option.isVisible().catch(() => false))) {
      await option.click();
    } else {
      await page.keyboard.press("Escape");
    }
  }

  const branch = battleDialog.getByTestId("battle-processing-branch-on-result");
  if ((await branch.count()) > 0) await branch.check({ force: true });
  await shot(page, "06-battle-configured.png", battleDialog);

  const persistPreview = await probePreview(battleDialog);
  await battleDialog.getByTestId("event-command-edit-ok").first().click({ force: true });
  await page.waitForTimeout(400);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  await shot(page, "07-battle-command-on-list.png", editor);

  const listBattle = editor.locator(".cmd-item").filter({ hasText: /전투/ }).first();
  if ((await listBattle.count()) > 0) {
    await listBattle.click();
    await shot(page, "07-battle-inspector.png");
    await listBattle.dblclick();
    const reopen = page.getByTestId("event-command-edit-dialog");
    const reopened = await reopen.waitFor({ state: "visible", timeout: 3_000 }).then(() => true).catch(() => false);
    await shot(page, "07-battle-reopen.png");
    await writeJson("07-battle-persist.json", {
      troopPickerPresent: troopClicked,
      reopened,
      persistPreview,
      inspectorText: ((await page.getByTestId("event-inspector-body").innerText().catch(() => "")) ?? "").slice(0, 800),
      reopenText: reopened ? ((await reopen.innerText()) ?? "").slice(0, 800) : "",
    });
    if (reopened) await reopen.getByTestId("event-command-edit-cancel").click();
  }

  await page.setViewportSize({ width: 800, height: 900 });
  await shot(page, "08-compact-800-editor.png");
  await openCommandPicker(page);
  await page.getByTestId("event-command-picker-tab-2").click();
  await shot(page, "08-compact-800-picker-tab2.png", page.getByTestId("event-command-picker"));
  await closePickerIfOpen(page);

  await page.setViewportSize({ width: 1280, height: 900 });
  await shot(page, "09-1280-editor.png");

  await writeJson("00-run-meta.json", {
    viewportFinal: await page.viewportSize(),
    url: page.url(),
    openedCommandCount: opened.length,
    pickerInventory: tab2Inventory,
  });
});

async function openEventEditor(page: Page): Promise<Locator> {
  await page.getByTestId("layer-event").click();
  const visibleEventTool = page.locator('[data-testid="tool-event"]:visible').first();
  if ((await visibleEventTool.count()) > 0) await visibleEventTool.click();
  const canvas = page.getByTestId("edit-canvas").locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("missing editor canvas");
  await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
  const editor = page.getByTestId("event-editor-modal");
  try {
    await editor.waitFor({ state: "visible", timeout: 1_500 });
  } catch {
    const openButton = page.getByTestId("event-editor-open");
    if (await openButton.isVisible().catch(() => false)) await openButton.click();
    else await canvas.dblclick({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });
  }
  await expect(editor).toBeVisible();
  return editor;
}

async function openCommandPicker(page: Page): Promise<void> {
  const picker = page.getByTestId("event-command-picker").first();
  if (await picker.isVisible().catch(() => false)) return;
  const searchTemplate = page.getByTestId("event-template-empty-search").first();
  const templateVisible = await searchTemplate.isVisible().catch(() => false);
  console.log("openCommandPicker templateVisible", templateVisible);
  if (templateVisible) {
    await searchTemplate.click();
  } else {
    const emptyLine = page.getByTestId("event-command-empty-line").first();
    await emptyLine.evaluate((node) => {
      node.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));
    });
  }
  await expect(picker).toBeVisible({ timeout: 8_000 });
  console.log("picker visible");
}

async function closePickerIfOpen(page: Page): Promise<void> {
  const picker = page.getByTestId("event-command-picker");
  if (!(await picker.isVisible().catch(() => false))) return;
  const cancel = picker.getByRole("button", { name: /닫기|취소/ });
  if ((await cancel.count()) > 0) await cancel.first().click();
  else await page.keyboard.press("Escape");
  await picker.waitFor({ state: "hidden", timeout: 2_000 }).catch(() => undefined);
}

async function resolvePickerButton(picker: Locator, testId: string, label: string): Promise<Locator | null> {
  const byTestId = picker.getByTestId(testId);
  if ((await byTestId.count()) > 0) return byTestId.first();
  const byRole = picker.getByRole("button", { name: new RegExp(label) });
  if ((await byRole.count()) > 0) return byRole.first();
  return null;
}

async function inventoryPicker(picker: Locator): Promise<unknown> {
  return picker.evaluate((root) => {
    const tab = root.querySelector('[data-testid="event-command-picker-tab-2"]');
    const buttons = [...root.querySelectorAll<HTMLButtonElement>(".event-command-picker-command")];
    const headings = [...root.querySelectorAll(".event-command-picker-group-heading")].map((node) => node.textContent?.trim() ?? "");
    return {
      tabLabel: tab?.textContent?.trim() ?? "",
      tabSelected: tab?.getAttribute("aria-selected") ?? "",
      headingTexts: headings,
      commands: buttons.map((button) => ({
        testId: button.dataset.testid ?? "",
        label: button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "",
        category: button.dataset.category ?? "",
        runtimeSupport: button.dataset.runtimeSupport ?? "",
        selectable: button.dataset.commandEntry !== undefined,
        ariaDisabled: button.getAttribute("aria-disabled"),
      })),
    };
  });
}

async function probePreview(dialog: Locator): Promise<unknown> {
  const preview = dialog.getByTestId("event-command-preview");
  if ((await preview.count()) === 0) return { present: false };
  return preview.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const stylesOf = (selector: string) =>
      [...node.querySelectorAll<HTMLElement>(selector)].map((el) => {
        const cs = getComputedStyle(el);
        return {
          selector,
          text: (el.textContent ?? "").trim().slice(0, 80),
          color: cs.color,
          backgroundColor: cs.backgroundColor,
          opacity: cs.opacity,
          width: Math.round(el.getBoundingClientRect().width),
          height: Math.round(el.getBoundingClientRect().height),
        };
      });
    const imgs = [...node.querySelectorAll("img")].map((img) => ({
      src: img.currentSrc || img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete,
    }));
    const body = node.querySelector<HTMLElement>("[data-testid='event-command-preview-body']");
    return {
      present: true,
      kind: body?.dataset.previewKind ?? "",
      text: (node.textContent ?? "").trim().slice(0, 400),
      box: { w: Math.round(rect.width), h: Math.round(rect.height), x: Math.round(rect.x) },
      empty: (node.textContent ?? "").trim().length < 8 && imgs.length === 0,
      imgs,
      badges: [
        ...stylesOf(".ecp-gold-badge"),
        ...stylesOf(".ecp-battle-badge"),
        ...stylesOf(".ecp-exp-badge"),
        ...stylesOf(".ecp-skill-badge"),
        ...stylesOf(".ecp-lamp"),
        ...stylesOf(".ecp-battle-empty-warn"),
        ...stylesOf(".ecp-battle-field"),
        ...stylesOf(".ecp-icon-stage"),
        ...stylesOf(".ecp-op-strip"),
      ],
    };
  });
}

async function collectEnglishLeak(root: Locator): Promise<string[]> {
  const text = (await root.innerText()) ?? "";
  return [
    "Battle Processing",
    "Change Party",
    "Recover All",
    "troop id",
    "actorId",
    "canEscape",
    "branchOnResult",
    "undefined",
    "[object Object]",
  ].filter((needle) => text.includes(needle));
}

async function shot(page: Page, name: string, locator?: Locator): Promise<void> {
  const dest = path.join(EVIDENCE_DIR, name);
  if (locator && (await locator.count()) > 0) {
    await locator.screenshot({ path: dest });
    return;
  }
  await page.screenshot({ path: dest, fullPage: false });
}

async function writeJson(name: string, value: unknown): Promise<void> {
  await writeFile(path.join(EVIDENCE_DIR, name), `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function slugify(value: string): string {
  return value.replace(/command-picker-add-/, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
}
