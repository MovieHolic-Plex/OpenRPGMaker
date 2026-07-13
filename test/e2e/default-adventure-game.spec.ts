import { writeFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { createSampleAdventureProject } from "@/project/defaults";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

type RuntimeState = {
  readonly mapId: string;
  readonly switches: Record<string, boolean>;
  readonly variables: Record<string, number>;
  readonly inventory: Record<string, number>;
};

test.setTimeout(90_000);
test.use({ serviceWorkers: "block" });

test("fresh editor project plays as the dew village sample adventure", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  const project = createSampleAdventureProject();
  await seedProjectFromSupabaseCanonical(page, project);
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15_000 });
  await expect.poll(async () => (await projectTitle(page)), { timeout: 20_000 }).toBe("이슬 마을의 종");
  await page.screenshot({ path: testInfo.outputPath("01-editor-adventure-start.png"), fullPage: true });

  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("title-screen")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("title-screen").getByRole("heading", { name: "이슬 마을" })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("02-title-screen.png"), fullPage: true });
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 15_000 });

  const startMapId = (await runtimeState(page)).mapId;
  expect(startMapId).toBe(project.startMapId);

  const markers = page.locator("[data-testid^='event-']");
  const count = await markers.count();
  let opened = false;
  for (let i = 0; i < count; i += 1) {
    await markers.nth(i).click({ force: true });
    if ((await page.getByTestId("dialogue-box").count()) > 0) {
      const text = (await page.getByTestId("dialogue-box").textContent()) ?? "";
      if (text.includes("이슬 마을") || text.includes("미르") || text.includes("종")) {
        opened = true;
        break;
      }
      await page.getByTestId("dialogue-box").click({ force: true }).catch(() => undefined);
    }
  }
  expect(opened).toBe(true);

  await expect(page.getByTestId("dialogue-box")).toContainText("이슬 마을");
  await advancePastText(page, "이슬 마을의 종이 깨져 아침이 오지 않아요.");
  await advancePastText(page, "갈대 언덕에서 종 조각을 찾아 주시겠어요?");
  await expect(page.getByTestId("runtime-choices")).toBeVisible();
  await expect(page.getByTestId("runtime-choice-0")).toContainText("간다");
  await page.screenshot({ path: testInfo.outputPath("03-elder-choice.png"), fullPage: true });
  // 디버그 마커가 choice 버튼을 가릴 수 있어 키보드/DOM 클릭으로 선택한다.
  await page.getByTestId("runtime-choice-0").focus().catch(() => undefined);
  await page.keyboard.press("Enter");
  if ((await runtimeState(page)).switches.sw_0001 !== true) {
    await page.keyboard.press("1");
  }
  if ((await runtimeState(page)).switches.sw_0001 !== true) {
    await page.evaluate(() => {
      const btn = document.querySelector<HTMLButtonElement>('[data-testid="runtime-choice-0"]');
      btn?.click();
    });
  }
  await expect.poll(async () => (await runtimeState(page)).switches.sw_0001, { timeout: 10_000 }).toBe(true);
  await dismissDialogue(page);

  await writeFile(testInfo.outputPath("runtime-state-after-accept.json"), `${JSON.stringify(await runtimeState(page), null, 2)}\n`, "utf8");
});

async function runtimeState(page: Page): Promise<RuntimeState> {
  const text = await page.getByTestId("runtime-state-json").textContent();
  if (!text) throw new Error("missing runtime state");
  return JSON.parse(text) as RuntimeState;
}

async function projectTitle(page: Page): Promise<string> {
  const text = await page.getByTestId("project-export-json").textContent();
  if (!text) return "";
  try {
    const parsed = JSON.parse(text) as { readonly project?: { readonly meta?: { readonly title?: string } } };
    return parsed.project?.meta?.title ?? "";
  } catch {
    return "";
  }
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
