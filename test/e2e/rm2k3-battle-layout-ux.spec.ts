import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import {
  confirmBattleTarget,
  seedLayoutResultBattleProject,
  seedPokemonLayoutBattleProject,
  seedReferenceBattleProject,
  startReferenceBattle,
} from "./battleReferenceProject";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rpg-zzu:editor-ui-mode", "expert"));
});

type Rect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly right: number;
  readonly bottom: number;
};

type BattleLayoutMetrics = {
  readonly scene: Rect;
  readonly field: Rect;
  readonly backdrop: Rect;
  readonly commandPanel: Rect;
  readonly party: Rect;
  readonly message: Rect;
  readonly firstEnemy: Rect;
  readonly firstActor: Rect;
  readonly partyRows: readonly Rect[];
  readonly battleStep: string;
  readonly commandPanelColumnCount: string;
  readonly commandPanelBackground: string;
  readonly commandPanelVisibility: string;
  readonly commandPanelDisplay: string;
  readonly enemyListPanelVisibility: string;
  readonly enemyListPanelDisplay: string;
  readonly partyVisibility: string;
  readonly partyDisplay: string;
  readonly actorGroupVisibility: string;
  readonly actorGroupDisplay: string;
  readonly enemyGroupVisibility: string;
  readonly enemyGroupDisplay: string;
  readonly backdropBackground: string;
  readonly messageDisplay: string;
  readonly resultPanel?: Rect;
  readonly resultRows: readonly string[];
  readonly targetPromptText?: string;
  readonly targetMenu?: Rect;
  readonly targetKeyPrompts?: Rect;
  readonly targetBracket?: Rect;
  readonly targetControls: readonly Rect[];
  readonly unitRects: readonly Rect[];
};

const evidenceDir = "output/evidence/rm2k3-battle-layout-ux";

test("battle command screen uses an RM2003-style field and bottom HUD layout", async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 768 });
  await seedReferenceBattleProject(page, { battleUiStyle: "rm2003" });
  await startReferenceBattle(page);
  await expect(page.getByTestId("actor-command-attack")).toBeVisible({ timeout: 15_000 });
  await mkdir(`${evidenceDir}/red-green`, { recursive: true });
  await page.screenshot({ path: `${evidenceDir}/red-green/battle-command-layout.png`, fullPage: true });

  const metrics = await battleLayoutMetrics(page);
  await writeFile(`${evidenceDir}/red-green/battle-command-layout.json`, `${JSON.stringify(metrics, null, 2)}\n`, "utf8");

  expect(metrics.battleStep).toBe("command");
  expect(metrics.scene.y).toBeGreaterThanOrEqual(0);
  expect(metrics.scene.bottom).toBeLessThanOrEqual(768);
  expect(metrics.field.height / metrics.scene.height).toBeGreaterThan(0.58);
  expect(metrics.backdrop.width / metrics.field.width).toBeGreaterThan(0.96);
  expect(metrics.backdrop.height / metrics.field.height).toBeGreaterThan(0.96);
  expect(metrics.firstEnemy.right).toBeLessThan(metrics.firstActor.x);
  expect(Math.abs(metrics.commandPanel.y - metrics.party.y)).toBeLessThanOrEqual(2);
  expect(metrics.commandPanel.height / metrics.scene.height).toBeLessThan(0.42);
  expect(metrics.party.height / metrics.scene.height).toBeLessThan(0.42);
  expect(metrics.partyRows.length).toBeGreaterThan(0);
  expect(Math.max(...metrics.partyRows.map((row) => row.bottom))).toBeLessThanOrEqual(metrics.party.bottom - 2);
  for (const [index, left] of metrics.unitRects.entries()) {
    for (const right of metrics.unitRects.slice(index + 1)) {
      expect(rectanglesOverlap(left, right)).toBe(false);
    }
  }
  await expect(page.locator(".battle-party .battle-stat-bar-mp")).toHaveCount(4);
  expect(metrics.messageDisplay).toBe("none");
  expect(metrics.commandPanelDisplay).toBe("grid");
  expect(metrics.backdropBackground).toContain("url(");

  await page.getByTestId("actor-command-defend").click();
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${evidenceDir}/red-green/battle-after-defend.png`, fullPage: true });

  const actionMetrics = await battleLayoutMetrics(page);
  await writeFile(
    `${evidenceDir}/red-green/battle-after-defend.json`,
    `${JSON.stringify(actionMetrics, null, 2)}\n`,
    "utf8"
  );
  expect(actionMetrics.scene.bottom).toBeLessThanOrEqual(768);
  expect(actionMetrics.commandPanel.bottom).toBeLessThanOrEqual(actionMetrics.scene.bottom - 2);
});

test("battle target and result states stay readable without HUD collision", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1360, height: 768 });
  await mkdir(`${evidenceDir}/red-green`, { recursive: true });
  await seedReferenceBattleProject(page, { battleUiStyle: "rm2003" });
  await startReferenceBattle(page);

  await page.getByTestId("actor-command-attack").click();
  await expect(page.getByTestId("battle-target-brackets")).toBeVisible();
  await expect(page.getByTestId("battle-target-prompt")).toHaveCount(0);
  const targetMetrics = await battleLayoutMetrics(page);
  await writeFile(`${evidenceDir}/red-green/battle-target-layout.json`, `${JSON.stringify(targetMetrics, null, 2)}\n`, "utf8");
  expect(targetMetrics.targetPromptText).toBeUndefined();
  expect(targetMetrics.messageDisplay).toBe("grid");
  expect(targetMetrics.targetMenu).toBeUndefined();
  expect(targetMetrics.targetBracket).toBeTruthy();
  for (const [index, left] of targetMetrics.targetControls.entries()) {
    for (const right of targetMetrics.targetControls.slice(index + 1)) {
      expect(rectanglesOverlap(left, right)).toBe(false);
    }
  }

  await seedLayoutResultBattleProject(page, { battleUiStyle: "rm2003" });
  await startReferenceBattle(page);
  await page.getByTestId("actor-command-attack").click();
  await confirmBattleTarget(page);
  await expect(page.getByTestId("battle-result-panel")).toBeVisible({ timeout: 20_000 });
  const resultMetrics = await battleLayoutMetrics(page);
  await page.screenshot({ path: `${evidenceDir}/red-green/battle-result-layout.png`, fullPage: true });
  await writeFile(`${evidenceDir}/red-green/battle-result-layout.json`, `${JSON.stringify(resultMetrics, null, 2)}\n`, "utf8");

  expect(resultMetrics.resultPanel).toBeTruthy();
  expect(resultMetrics.scene.y).toBeGreaterThanOrEqual(0);
  expect(resultMetrics.scene.bottom).toBeLessThanOrEqual(768);
  expect(resultMetrics.resultRows).toEqual(expect.arrayContaining(["경험치", "골드"]));
  expect(resultMetrics.messageDisplay).toBe("none");
  expect(resultMetrics.commandPanelVisibility).toBe("hidden");
  expect(resultMetrics.enemyListPanelVisibility).toBe("hidden");
  expect(resultMetrics.partyVisibility).toBe("hidden");
  expect(resultMetrics.actorGroupVisibility).toBe("visible");
  expect(resultMetrics.enemyGroupVisibility).toBe("visible");
  expect(resultMetrics.field.height / resultMetrics.scene.height).toBeGreaterThan(0.9);
  expect(resultMetrics.resultPanel?.bottom ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(resultMetrics.scene.bottom - 2);
});

test("pokemon battle keeps submenu actions, duplicate targets, and rewards readable", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1360, height: 768 });
  await seedPokemonLayoutBattleProject(page);
  await startReferenceBattle(page);

  const itemHitTarget = await page.getByTestId("actor-command-item").evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      topClass: top?.className ?? "",
      topTestId: top instanceof HTMLElement ? top.dataset.testid ?? "" : "",
      buttonContainsTop: Boolean(top && button.contains(top)),
      pointerEvents: getComputedStyle(button).pointerEvents,
      zIndex: getComputedStyle(button).zIndex,
      stack: document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
        .slice(0, 8)
        .map((element) => ({
          className: String(element.className),
          testId: element instanceof HTMLElement ? element.dataset.testid ?? "" : "",
        })),
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    };
  });
  expect(itemHitTarget.buttonContainsTop, JSON.stringify(itemHitTarget)).toBe(true);
  await page.getByTestId("actor-command-item").click();
  await expect(page.getByTestId("actor-command-back")).toBeVisible();
  const submenuLayout = await page.evaluate(() => {
    const back = document.querySelector<HTMLElement>("[data-testid='actor-command-back']");
    const prompt = document.querySelector<HTMLElement>(".battle-key-prompts");
    const menu = document.querySelector<HTMLElement>(".battle-command-menu");
    if (!back || !prompt || !menu) throw new Error("pokemon submenu layout nodes are missing");
    const backRect = back.getBoundingClientRect();
    const promptRect = prompt.getBoundingClientRect();
    return {
      backBottom: backRect.bottom,
      promptTop: promptRect.top,
      menuClientHeight: menu.clientHeight,
      menuScrollHeight: menu.scrollHeight,
    };
  });
  expect(submenuLayout.backBottom).toBeLessThanOrEqual(submenuLayout.promptTop + 1);
  expect(submenuLayout.menuScrollHeight).toBeLessThanOrEqual(submenuLayout.menuClientHeight + 1);

  await page.keyboard.press("Escape");
  await page.getByTestId("actor-command-attack").click();
  await expect(page.getByTestId("battle-target-prompt")).toBeVisible();
  const targetLayout = await page.evaluate(() => {
    const labels = [...document.querySelectorAll<HTMLElement>(".battle-target-menu [data-battle-target-id]")]
      .map((node) => node.querySelector("strong")?.textContent?.trim() ?? "");
    const textWithinButtons = [...document.querySelectorAll<HTMLElement>(".battle-target-menu [data-battle-target-id]")]
      .every((button) => {
        const bounds = button.getBoundingClientRect();
        return [...button.querySelectorAll<HTMLElement>("strong, small")].every((text) => {
          const rect = text.getBoundingClientRect();
          return rect.top >= bounds.top - 1 && rect.bottom <= bounds.bottom + 1;
        });
      });
    const cancel = document.querySelector<HTMLElement>("[data-testid='battle-target-cancel']");
    const prompt = document.querySelector<HTMLElement>(".battle-key-prompts");
    if (!cancel || !prompt) throw new Error("pokemon target layout nodes are missing");
    return {
      labels,
      textWithinButtons,
      cancelBottom: cancel.getBoundingClientRect().bottom,
      promptTop: prompt.getBoundingClientRect().top,
    };
  });
  expect(new Set(targetLayout.labels).size).toBe(targetLayout.labels.length);
  expect(targetLayout.textWithinButtons).toBe(true);
  expect(targetLayout.cancelBottom).toBeLessThanOrEqual(targetLayout.promptTop + 1);

  await seedLayoutResultBattleProject(page, { battleUiStyle: "pokemon" });
  await startReferenceBattle(page);
  await page.getByTestId("actor-command-attack").click();
  await page.getByTestId("battle-target-enemy-1").click();
  const resultPanel = page.getByTestId("battle-result-panel");
  await expect(resultPanel).toBeVisible({ timeout: 20_000 });
  await expect(resultPanel.locator(".battle-result-title")).toHaveText("승리");
  await expect(resultPanel.locator(".battle-result-reward-label")).toHaveCount(2);
  await expect(resultPanel.locator(".battle-result-reward-label").first()).toBeVisible({ timeout: 5_000 });
  await expect(resultPanel.locator(".battle-result-reward-label").nth(1)).toBeVisible({ timeout: 5_000 });
  const resultLayout = await resultPanel.evaluate((panel) => {
    const panelRect = panel.getBoundingClientRect();
    const required = [
      panel.querySelector<HTMLElement>(".battle-result-title"),
      panel.querySelector<HTMLElement>(".battle-result-cards"),
      panel.querySelector<HTMLElement>(".battle-result-confirm"),
    ];
    return {
      overflows: panel.scrollHeight > panel.clientHeight + 1,
      clientHeight: panel.clientHeight,
      scrollHeight: panel.scrollHeight,
      panel: { top: panelRect.top, bottom: panelRect.bottom },
      children: required.map((node) => {
        const rect = node?.getBoundingClientRect();
        return rect ? { className: node?.className ?? "", top: rect.top, bottom: rect.bottom } : null;
      }),
      childrenWithin: required.every((node) => {
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.top >= panelRect.top - 1 && rect.bottom <= panelRect.bottom + 1;
      }),
    };
  });
  expect(resultLayout.overflows, JSON.stringify(resultLayout)).toBe(false);
  expect(resultLayout.childrenWithin).toBe(true);
});

async function battleLayoutMetrics(page: Page): Promise<BattleLayoutMetrics> {
  return page.evaluate((): BattleLayoutMetrics => {
    const requiredElement = (selector: string): HTMLElement => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing element ${selector}`);
      return element;
    };
    const rectOf = (element: HTMLElement): Rect => {
      const rect = element.getBoundingClientRect();
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom,
      };
    };
    const scene = requiredElement("[data-testid='battle-scene']");
    const field = requiredElement(".battle-field");
    const backdrop = requiredElement("[data-testid='battle-backdrop']");
    const commandPanel = requiredElement(".battle-command-panel");
    const enemyListPanel = requiredElement(".battle-enemy-list-panel");
    const actorGroup = requiredElement(".battle-actor-group");
    const enemyGroup = requiredElement(".battle-enemy-group");
    const party = requiredElement("[data-testid='battle-party']");
    const message = requiredElement("[data-testid='battle-message-window']");
    const firstEnemy = requiredElement("[data-testid='enemy-1']");
    const firstActor = requiredElement(".battle-actor-group .battle-actor");
    const partyRows = [...document.querySelectorAll<HTMLElement>(".battle-actor-status")].map(rectOf);
    const commandPanelStyle = getComputedStyle(commandPanel);
    const enemyListPanelStyle = getComputedStyle(enemyListPanel);
    const actorGroupStyle = getComputedStyle(actorGroup);
    const enemyGroupStyle = getComputedStyle(enemyGroup);
    const partyStyle = getComputedStyle(party);
    const backdropStyle = getComputedStyle(backdrop);
    const messageStyle = getComputedStyle(message);
    const resultPanel = document.querySelector<HTMLElement>("[data-testid='battle-result-panel']");
    const targetPrompt = document.querySelector<HTMLElement>("[data-testid='battle-target-prompt']");
    return {
      scene: rectOf(scene),
      field: rectOf(field),
      backdrop: rectOf(backdrop),
      commandPanel: rectOf(commandPanel),
      party: rectOf(party),
      message: rectOf(message),
      firstEnemy: rectOf(firstEnemy),
      firstActor: rectOf(firstActor),
      partyRows,
      battleStep: scene.dataset.battleDirectorStep ?? "",
      commandPanelColumnCount: commandPanelStyle.gridTemplateColumns,
      commandPanelBackground: commandPanelStyle.backgroundImage,
      commandPanelVisibility: commandPanelStyle.visibility,
      commandPanelDisplay: commandPanelStyle.display,
      enemyListPanelVisibility: enemyListPanelStyle.visibility,
      enemyListPanelDisplay: enemyListPanelStyle.display,
      partyVisibility: partyStyle.visibility,
      partyDisplay: partyStyle.display,
      actorGroupVisibility: actorGroupStyle.visibility,
      actorGroupDisplay: actorGroupStyle.display,
      enemyGroupVisibility: enemyGroupStyle.visibility,
      enemyGroupDisplay: enemyGroupStyle.display,
      backdropBackground: backdropStyle.backgroundImage,
      messageDisplay: messageStyle.display,
      resultPanel: resultPanel ? rectOf(resultPanel) : undefined,
      resultRows: [...document.querySelectorAll<HTMLElement>(".battle-result-reward-label")].map((node) => node.textContent ?? ""),
      targetPromptText: targetPrompt?.textContent ?? undefined,
      targetMenu: document.querySelector<HTMLElement>(".battle-target-menu")
        ? rectOf(document.querySelector<HTMLElement>(".battle-target-menu")!)
        : undefined,
      targetKeyPrompts: document.querySelector<HTMLElement>(".battle-key-prompts")
        ? rectOf(document.querySelector<HTMLElement>(".battle-key-prompts")!)
        : undefined,
      targetBracket: document.querySelector<HTMLElement>("[data-testid='battle-target-brackets']")
        ? rectOf(document.querySelector<HTMLElement>("[data-testid='battle-target-brackets']")!)
        : undefined,
      targetControls: [...document.querySelectorAll<HTMLElement>(".battle-target-menu .battle-command")].map(rectOf),
      unitRects: [...document.querySelectorAll<HTMLElement>(".battle-enemy, .battle-actor")].map(rectOf),
    };
  });
}

function rectanglesOverlap(left: Rect, right: Rect): boolean {
  return left.x < right.right && left.right > right.x && left.y < right.bottom && left.bottom > right.y;
}
