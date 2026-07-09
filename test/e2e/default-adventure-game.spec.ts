import { writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { startNewGameFromTitle } from "./runtimeInput";

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
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => (await runtimeState(page)).mapId).toBe("map_lantern_village");

  await page.getByTestId("event-ev_lantern_elder").click();
  await advancePastText(page, "별등 마을의 등불이 셋으로 갈라졌네.");
  await advancePastText(page, "수문장, 치유사, 정찰병이 각자 길의 단서를 알고 있으니 말을 들어보게.");
  await advancePastText(page, "숲과 광산의 봉인을 풀고 별조각 두 개를 모아주게.");
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
  await advancePastText(page, "달샘 숲의 봉인이 흔들립니다.");
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
  await expect(page.getByTestId("dialogue-box")).toContainText(currentText);
  await page.waitForTimeout(80);
  await advanceDialogue(page);
  if (await waitForDialogueTextChange(page, currentText, 750)) return;
  await advanceDialogue(page);
  await waitForDialogueTextChange(page, currentText, 5_000);
}

async function dialogueIncludes(page: Page, text: string): Promise<boolean> {
  if ((await page.getByTestId("runtime-choices").count()) > 0) return false;
  const dialogue = page.getByTestId("dialogue-box");
  if ((await dialogue.count()) === 0) return false;
  return ((await dialogue.textContent()) ?? "").includes(text);
}

async function waitForDialogueTextChange(page: Page, text: string, timeout: number): Promise<boolean> {
  try {
    await expect.poll(async () => dialogueIncludes(page, text), { timeout }).toBe(false);
    return true;
  } catch {
    return false;
  }
}
