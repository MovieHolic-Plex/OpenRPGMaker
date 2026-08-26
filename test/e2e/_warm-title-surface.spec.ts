import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

const EVIDENCE_DIR = ".omo/evidence/runtime-warm-skin";
const EVIDENCE_JSON = `${EVIDENCE_DIR}/title-surface.json`;
const EVIDENCE_PNG = `${EVIDENCE_DIR}/title-surface.png`;

function project(): Project {
  const p = createBlankProject();
  return p;
}

async function openTitlePlayWindow(page: Page): Promise<void> {
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 15000 });
  const modeButton = page.getByTestId("mode-play");
  if ((await modeButton.count()) > 0 && (await modeButton.isVisible())) {
    await modeButton.click();
  } else {
    await page.getByTestId("menu-game").click();
    await page.getByTestId("menu-game-play").click();
  }
  const modal = page.getByTestId("test-play-window");
  await page.waitForTimeout(250);
  if (!(await modal.isVisible())) {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("oprn:test-play-window")));
  }
  await expect(modal).toBeVisible({ timeout: 10000 });

  // If auto-start was enabled or if play started, click "타이틀부터" to get to the title screen
  const bootTitleButton = modal.getByTestId("test-play-title");
  const titleScreen = modal.getByTestId("title-screen");
  if ((await titleScreen.count()) === 0 && (await bootTitleButton.count()) > 0 && (await bootTitleButton.isVisible())) {
    await bootTitleButton.click();
  }
  await expect(titleScreen).toBeVisible({ timeout: 15000 });
}

test("verify title screen renders correctly under Neo둥근모 and warm skin without clipping", async ({ page }) => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const consoleLines: string[] = [];
  page.on("console", (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => consoleLines.push(`[pageerror] ${e.message}`));

  await page.setViewportSize({ width: 1280, height: 900 });

  await seedProjectFromSupabaseCanonical(page, project(), "/?e2eVitals=1");

  // Disable auto-start in localStorage so test play boots directly into Title Screen
  await page.evaluate(() => {
    window.localStorage.setItem("oprn:test-play-auto-start", "0");
  });

  await openTitlePlayWindow(page);

  const titleScreen = page.getByTestId("title-screen");
  await expect(titleScreen).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(600);

  // Take full screenshot of the title surface
  await titleScreen.screenshot({ path: EVIDENCE_PNG });

  // Scan all visible text nodes inside title screen
  const report = await page.evaluate(() => {
    const title = document.querySelector("[data-testid='title-screen']");
    if (!(title instanceof HTMLElement)) {
      return {
        unreachable: "title-screen element not found",
        nodes: [],
        skinVar: "",
      };
    }

    const csTitle = getComputedStyle(title);
    const nodes: Array<{
      testid?: string;
      cls: string;
      text: string;
      family: string;
      size: string;
      scrollWidth: number;
      clientWidth: number;
      scrollHeight: number;
      clientHeight: number;
      clipX: number;
      clipY: number;
    }> = [];

    const allElements = Array.from(title.querySelectorAll<HTMLElement>("*"));
    // include title root itself if it has text nodes
    for (const el of [title, ...allElements]) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") continue;

      const hasDirectText = Array.from(el.childNodes).some(
        (c) => c.nodeType === Node.TEXT_NODE && (c.textContent ?? "").trim().length > 0
      );
      if (!hasDirectText) continue;

      const clipX = el.scrollWidth - el.clientWidth;
      const clipY = el.scrollHeight - el.clientHeight;

      nodes.push({
        testid: el.dataset.testid,
        cls: el.className.toString().slice(0, 80),
        text: (el.textContent ?? "").trim(),
        family: cs.fontFamily,
        size: cs.fontSize,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        clipX,
        clipY,
      });
    }

    return {
      nodes,
      skinVar: csTitle.getPropertyValue("--runtime-window-skin").trim(),
    };
  });

  writeFileSync(EVIDENCE_JSON, JSON.stringify(report, null, 2));

  console.log(`Scanned ${report.nodes.length} text nodes on title surface.`);
  for (const n of report.nodes) {
    console.log(`Node: "${n.text}" [${n.testid ?? n.cls}] family=${n.family} size=${n.size} clipX=${n.clipX} clipY=${n.clipY}`);
  }

  // 1. Every scanned text node's computed font-family must contain NeoDunggeunmo
  const wrongFont = report.nodes.filter((n) => !/NeoDunggeunmo/.test(n.family));
  expect(wrongFont, `Nodes without NeoDunggeunmo font:\n${JSON.stringify(wrongFont, null, 2)}`).toEqual([]);

  // 2. Zero nodes have clipX > 1 or clipY > 1
  const clipped = report.nodes.filter((n) => n.clipX > 1 || n.clipY > 1);
  expect(clipped, `Clipped text nodes found:\n${JSON.stringify(clipped, null, 2)}`).toEqual([]);
});
