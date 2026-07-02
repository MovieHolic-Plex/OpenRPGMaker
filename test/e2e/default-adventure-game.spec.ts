import { writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

type RuntimeState = {
  readonly mapId: string;
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  readonly inventory: Record<string, number>;
};

test.setTimeout(90_000);

test("fresh editor project plays as the built-in adventure game", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/?freshProject=1&defaultAdventure=1", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => (await projectTitle(page))).toBe("별등 마을과 세 개의 봉인");
  await page.screenshot({ path: testInfo.outputPath("01-editor-adventure-start.png"), fullPage: true });

  await page.getByTestId("mode-play").click();
  await expect(page.getByTestId("title-screen")).toBeVisible();
  await expect(page.getByTestId("title-screen").getByRole("heading", { name: "별등 마을" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("02-title-screen.png"), fullPage: true });
  await page.getByTestId("title-new-game").click();
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe("map_lantern_village");

  await page.getByTestId("event-ev_lantern_elder").click();
  await expect(page.getByTestId("dialogue-box")).toContainText("별등 마을의 등불");
  await advancePastText(page, "별등 마을의 등불");
  await expect(page.getByTestId("dialogue-box")).toContainText("숲과 광산의 봉인");
  await advancePastText(page, "숲과 광산의 봉인");
  await expect(page.getByTestId("runtime-choices")).toBeVisible();
  await expect(page.getByTestId("runtime-choice-0")).toContainText("받는다");
  await page.screenshot({ path: testInfo.outputPath("03-elder-choice.png"), fullPage: true });
  await page.getByTestId("runtime-choice-0").click();
  await expect.poll(async () => (await runtimeState(page)).switches.sw_lantern_quest_started).toBe(true);
  await dismissDialogue(page);

  await page.getByTestId("event-ev_to_forest").click();
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe("map_moonwell_forest");
  await page.screenshot({ path: testInfo.outputPath("04-forest-map.png"), fullPage: true });
  await page.getByTestId("event-ev_map_moonwell_forest_seal").click();
  await expect(page.getByTestId("dialogue-box")).toContainText("달샘 숲의 봉인");
  await advancePastText(page, "달샘 숲의 봉인");
  await expect(page.getByTestId("battle-scene")).toBeVisible();
  await expect(page.getByTestId("actor-command-attack")).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("05-forest-seal-battle.png"), fullPage: true });

  await writeFile(testInfo.outputPath("runtime-state-at-battle.json"), `${JSON.stringify(await runtimeState(page), null, 2)}\n`, "utf8");
});

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  return JSON.parse(text) as RuntimeState;
}

async function projectTitle(page: Page): Promise<string> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) throw new Error("missing project export");
  const parsed = JSON.parse(text) as { readonly project?: { readonly meta?: { readonly title?: string } } };
  return parsed.project?.meta?.title ?? "";
}

async function dismissDialogue(page: Page): Promise<void> {
  while ((await page.getByTestId("dialogue-box").count()) > 0) {
    await advanceDialogue(page);
    await page.waitForTimeout(80);
  }
}

async function advanceDialogue(page: Page): Promise<void> {
  const dialogue = page.getByTestId("dialogue-box");
  if ((await dialogue.count()) > 0) {
    await dialogue.click({ force: true });
    return;
  }
  await page.keyboard.press("Enter");
}

async function advancePastText(page: Page, currentText: string): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if ((await page.getByTestId("runtime-choices").count()) > 0) return;
    const dialogue = page.getByTestId("dialogue-box");
    if ((await dialogue.count()) === 0) return;
    if (!((await dialogue.textContent()) ?? "").includes(currentText)) return;
    await advanceDialogue(page);
    await page.waitForTimeout(160);
  }
}
