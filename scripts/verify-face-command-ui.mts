import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { createBlankProject } from "../src/project/defaults.ts";
import { createDefaultGameEvent } from "../src/editor/eventActions.ts";
import type { Command, Project } from "../src/project/types.ts";

const EVIDENCE = "output/evidence/face-command-ui-fix";
const APP = process.env.APP_URL ?? "http://127.0.0.1:9173/?blankProject=1";

function seedProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("missing start map");
  const event = createDefaultGameEvent(2, 2, { kind: "action" });
  event.id = "ev_face_ui";
  const commands: Command[] = [
    {
      kind: "changeFace",
      resourceId: "easyrpg-faceset-actor1",
      faceIndex: 0,
      position: "left",
      flipHorizontally: false,
    },
    { kind: "text", speaker: "", body: "대사 창에 이 얼굴이 표시됩니다." },
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
  page.on("pageerror", (error) => console.error("PAGEERROR", error.message));
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
  // tool-event may be in basic rail; click visible one
  const tool = page.locator('[data-testid="tool-event"]:visible').first();
  if ((await tool.count()) > 0) await tool.click();

  const row = page.getByTestId("event-list-row-ev_face_ui");
  await row.waitFor({ timeout: 10_000 });
  await row.click();
  await page.getByTestId("event-editor-open").click();
  await page.getByTestId("event-editor-modal").waitFor();

  const command = page.getByTestId("event-command-changeFace").first();
  await command.scrollIntoViewIfNeeded();
  await command.dblclick();

  const setBtn = page.getByTestId("event-command-face-resource-set").first();
  await setBtn.waitFor({ timeout: 10_000 });
  await page.screenshot({ path: `${EVIDENCE}/01-face-form.png`, fullPage: true });

  const metrics = await setBtn.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    const parent = node.closest(".event-command-face-resource-row") ?? node.parentElement;
    const prect = parent?.getBoundingClientRect();
    const text = (node.textContent ?? "").replace(/\s+/g, "");
    return {
      text,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      overflow: style.overflow,
      parentWidth: prect ? Math.round(prect.width) : null,
      fullyVisible: rect.width > 40 && rect.height > 16 && rect.right <= window.innerWidth - 8,
      labelComplete: text.includes("설정"),
    };
  });

  await setBtn.click();
  const picker = page.getByTestId("event-command-face-resource-dialog");
  await picker.waitFor({ timeout: 5_000 });
  const zOrder = await page.evaluate(() => {
    const pickerEl = document.querySelector('[data-testid="event-command-face-resource-dialog"]');
    const eventBackdrop = document.querySelector(".event-subdialog-backdrop");
    const pz = pickerEl ? Number(getComputedStyle(pickerEl).zIndex) || 0 : -1;
    const ez = eventBackdrop ? Number(getComputedStyle(eventBackdrop).zIndex) || 0 : -1;
    return { pickerZ: pz, eventBackdropZ: ez, pickerOnTop: pz > ez };
  });
  await page.screenshot({ path: `${EVIDENCE}/02-face-picker.png`, fullPage: true });

  const ok = page.getByTestId("event-command-face-resource-dialog-ok");
  if ((await ok.count()) > 0) await ok.click();
  else await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  const flip = page.getByTestId("event-command-face-flip-horizontal").first();
  const flipBefore = await flip.evaluate((node) => (node as HTMLInputElement).checked);
  await flip.click({ force: true });
  const flipAfter = await flip.evaluate((node) => (node as HTMLInputElement).checked);
  await page.screenshot({ path: `${EVIDENCE}/03-face-form-after-flip.png`, fullPage: true });

  const report = { metrics, zOrder, flipBefore, flipAfter };
  await writeFile(`${EVIDENCE}/verify.json`, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));

  if (!metrics.fullyVisible || !metrics.labelComplete) {
    throw new Error(`설정 button layout broken: ${JSON.stringify(metrics)}`);
  }
  if (!zOrder.pickerOnTop) throw new Error(`picker not above event dialog: ${JSON.stringify(zOrder)}`);
  if (flipBefore === flipAfter) throw new Error("flip checkbox did not toggle");

  await browser.close();
}

await main();
