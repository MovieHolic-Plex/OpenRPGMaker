import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createBlankProject } from "../src/project/defaults.ts";
import { createDefaultGameEvent } from "../src/editor/eventActions.ts";
import type { Command, Project } from "../src/project/types.ts";

const EVIDENCE = "output/evidence/choices-command-ui-fix";
const APP = process.env.APP_URL ?? "http://127.0.0.1:9173/?blankProject=1";

function seedProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing start map");
  const event = createDefaultGameEvent(2, 2, { kind: "action" });
  event.id = "ev_choices_ui";
  const commands: Command[] = [
    {
      kind: "choices",
      prompt: "진행할까요?",
      options: [
        { text: "예", branch: [] },
        { text: "아니오", branch: [] },
      ],
      cancelBehavior: "choice2",
    },
  ];
  event.commands = structuredClone(commands);
  if (event.pages?.[0]) event.pages[0].commands = structuredClone(commands);
  map.events = [event];
  return project;
}

async function main(): Promise<void> {
  await mkdir(EVIDENCE, { recursive: true });
  const project = seedProject();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.addInitScript((seed) => {
    (window as Window & { __RPG_ZZU_E2E_PROJECT__?: unknown }).__RPG_ZZU_E2E_PROJECT__ = seed;
    window.localStorage.clear();
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  }, project);
  await page.goto(APP, { waitUntil: "domcontentloaded" });
  await page.getByTestId("edit-canvas").waitFor({ timeout: 20_000 });

  const takeover = page.getByTestId("map-lock-banner-takeover");
  if (await takeover.isVisible().catch(() => false)) await takeover.click();
  const expert = page.getByTestId("editor-ui-mode-expert");
  if (await expert.isVisible().catch(() => false)) await expert.click();

  await page.getByTestId("layer-event").click();
  const tool = page.locator('[data-testid="tool-event"]:visible').first();
  if ((await tool.count()) > 0) await tool.click();

  await page.getByTestId("event-list-row-ev_choices_ui").click();
  await page.getByTestId("event-editor-open").click();
  await page.getByTestId("event-editor-modal").waitFor();

  const command = page.getByTestId("event-command-choices").first();
  await command.scrollIntoViewIfNeeded();
  await command.dblclick();

  const editor = page.getByTestId("event-command-choices-inline-editor").first();
  await editor.waitFor({ timeout: 10_000 });
  await page.screenshot({ path: `${EVIDENCE}/01-choices-form.png`, fullPage: true });

  const counts = await page.evaluate(() => {
    const optionCount = document.querySelectorAll('[data-testid^="event-choice-option-"]').length;
    const ghost3 = Boolean(document.querySelector('[data-testid="event-choice-option-3"]'));
    const cancel3 = Boolean(document.querySelector('[data-testid="event-choice-cancel-choice3"]'));
    const add = document.querySelector('[data-testid="event-choice-add"]');
    const previewChoices = Array.from(document.querySelectorAll(".ecp-choice")).map((node) =>
      (node.textContent ?? "").trim()
    );
    return {
      optionCount,
      ghost3,
      cancel3,
      addLabel: (add?.textContent ?? "").trim(),
      previewChoices,
    };
  });

  await page.getByTestId("event-choice-add").click();
  await page.waitForTimeout(100);
  const afterAdd = await page.evaluate(() => ({
    option3: Boolean(document.querySelector('[data-testid="event-choice-option-3"]')),
    cancel3: Boolean(document.querySelector('[data-testid="event-choice-cancel-choice3"]')),
  }));
  await page.screenshot({ path: `${EVIDENCE}/02-choices-after-add.png`, fullPage: true });

  const report = { counts, afterAdd };
  await writeFile(`${EVIDENCE}/verify.json`, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));

  if (counts.optionCount !== 2) throw new Error(`expected 2 option rows, got ${counts.optionCount}`);
  if (counts.ghost3) throw new Error("ghost option-3 present before add");
  if (counts.cancel3) throw new Error("cancel-choice3 present with only 2 options");
  if (!counts.previewChoices.some((text) => text.includes("예"))) throw new Error("preview missing 예");
  if (counts.previewChoices.some((text) => text.includes("□") || text.includes("선택지 3"))) {
    throw new Error(`preview still shows ghost choices: ${JSON.stringify(counts.previewChoices)}`);
  }
  if (!afterAdd.option3 || !afterAdd.cancel3) throw new Error("add option did not expand slots");

  await browser.close();
}

await main();
