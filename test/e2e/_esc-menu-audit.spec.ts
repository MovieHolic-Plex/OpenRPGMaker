import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { openTestPlayWindow } from "./oprnPlayerStatusMenuHelpers";
import { startNewGameFromTitle } from "./runtimeInput";

const DIR = ".omo/evidence/esc-menu-audit-20260827";

type Measure = {
  readonly testid?: string;
  readonly cls: string;
  readonly text: string;
  readonly rect: { x: number; y: number; w: number; h: number };
  readonly overflowX: number;
  readonly overflowY: number;
  readonly fontSize: string;
  readonly color: string;
  readonly bg: string;
  readonly clippedText: boolean;
};

async function measureMenu(page: Page, label: string): Promise<unknown> {
  return page.evaluate((lbl) => {
    const menu = document.querySelector("[data-testid='main-menu']");
    const stage = document.querySelector("[data-testid='play-stage']");
    if (!(menu instanceof HTMLElement)) return { label: lbl, missing: true };
    const menuRect = menu.getBoundingClientRect();
    const stageRect = stage instanceof HTMLElement ? stage.getBoundingClientRect() : undefined;
    const overflowing: unknown[] = [];
    const brokenImages: unknown[] = [];
    const outside: unknown[] = [];
    const tiny: unknown[] = [];
    const scrollables: unknown[] = [];
    for (const node of Array.from(menu.querySelectorAll<HTMLElement>("*"))) {
      const r = node.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(node);
      const info = {
        testid: node.dataset.testid,
        cls: node.className?.toString().slice(0, 90),
        text: (node.textContent ?? "").trim().slice(0, 40),
        rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
        fontSize: cs.fontSize,
      };
      const ox = node.scrollWidth - node.clientWidth;
      const oy = node.scrollHeight - node.clientHeight;
      const ownText = Array.from(node.childNodes).some((c) => c.nodeType === 3 && (c.textContent ?? "").trim().length > 0);
      if (ownText && ox > 1 && (cs.overflowX === "hidden" || cs.textOverflow === "ellipsis")) {
        overflowing.push({ ...info, overflowX: ox, overflowY: oy, overflowStyle: `${cs.overflowX}/${cs.textOverflow}/${cs.whiteSpace}` });
      }
      if (oy > 2 && (cs.overflowY === "auto" || cs.overflowY === "scroll" || cs.overflowY === "hidden")) {
        scrollables.push({ ...info, overflowY: oy, overflowStyle: cs.overflowY });
      }
      if (node instanceof HTMLImageElement && node.naturalWidth === 0) {
        brokenImages.push({ ...info, src: (node.currentSrc || node.src).slice(0, 200) });
      }
      if (ownText && Number.parseFloat(cs.fontSize) < 11) tiny.push({ ...info, color: cs.color });
      if (stageRect) {
        if (r.right > stageRect.right + 1 || r.bottom > stageRect.bottom + 1 || r.left < stageRect.left - 1 || r.top < stageRect.top - 1) {
          outside.push(info);
        }
      }
    }
    return {
      label: lbl,
      menuRect: { x: Math.round(menuRect.left), y: Math.round(menuRect.top), w: Math.round(menuRect.width), h: Math.round(menuRect.height) },
      stageRect: stageRect
        ? { x: Math.round(stageRect.left), y: Math.round(stageRect.top), w: Math.round(stageRect.width), h: Math.round(stageRect.height) }
        : undefined,
      overflowing,
      scrollables,
      brokenImages,
      outside,
      tiny,
    };
  }, label);
}

async function shot(page: Page, name: string): Promise<void> {
  const stage = page.getByTestId("play-stage");
  if (await stage.count()) await stage.first().screenshot({ path: `${DIR}/${name}.png` });
  else await page.screenshot({ path: `${DIR}/${name}.png` });
}

test("audit: esc status menu on the real legacyDb project", async ({ page }) => {
  test.setTimeout(240_000);
  mkdirSync(DIR, { recursive: true });
  const consoleLines: string[] = [];
  const failed: string[] = [];
  page.on("console", (m) => consoleLines.push(`[${m.type()}] ${m.text()}`.slice(0, 400)));
  page.on("pageerror", (e) => consoleLines.push(`[pageerror] ${e.message}`.slice(0, 400)));
  page.on("requestfailed", (r) => failed.push(`${r.failure()?.errorText ?? "?"} ${r.url()}`));
  page.on("response", (r) => { if (r.status() >= 400) failed.push(`HTTP${r.status()} ${r.url()}`); });

  const report: Record<string, unknown> = {};

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30000 });
  report.projectName = await page.evaluate(() => {
    const w = window as unknown as { __oprnProject?: { name?: string } };
    return w.__oprnProject?.name ?? document.title;
  });

  await openTestPlayWindow(page);
  if (await page.getByTestId("title-screen").count()) {
    await startNewGameFromTitle(page).catch(() => undefined);
  }
  await expect(page.getByTestId("play-stage")).toBeVisible({ timeout: 30000 });
  await page.waitForTimeout(1500);
  await shot(page, "01-field-before-menu");

  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  if ((await page.getByTestId("main-menu").count()) === 0) {
    await page.keyboard.press("x");
    await page.waitForTimeout(500);
  }
  report.menuOpened = await page.getByTestId("main-menu").count();
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(600);
  await shot(page, "02-menu-open-1440x900");
  report.main1440 = await measureMenu(page, "main@1440x900");

  report.rail = await page.evaluate(() => {
    const rail = document.querySelector("[data-testid='status-menu-command-rail']");
    if (!(rail instanceof HTMLElement)) return { missing: true };
    return {
      items: Array.from(rail.querySelectorAll<HTMLElement>("[data-testid^='status-menu-command-']")).map((n) => ({
        testid: n.dataset.testid,
        text: (n.textContent ?? "").trim().slice(0, 30),
        disabled: n.getAttribute("aria-disabled") ?? (n as HTMLButtonElement).disabled ?? false,
        rect: (() => { const r = n.getBoundingClientRect(); return { y: Math.round(r.top), h: Math.round(r.height) }; })(),
      })),
    };
  });

  const keyboardTrail: unknown[] = [];
  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(180);
    keyboardTrail.push(await page.evaluate(() => {
      const sel = document.querySelector("[data-testid='main-menu'] [aria-selected='true'], [data-testid='main-menu'] .is-selected, [data-testid='main-menu'] [data-selected='true']");
      const title = document.querySelector("[data-testid='status-menu-detail-title']");
      return {
        selected: sel instanceof HTMLElement ? (sel.dataset.testid ?? sel.className.toString().slice(0, 60)) : null,
        selectedText: sel instanceof HTMLElement ? (sel.textContent ?? "").trim().slice(0, 24) : null,
        detailTitle: title instanceof HTMLElement ? (title.textContent ?? "").trim().slice(0, 30) : null,
      };
    }));
  }
  report.keyboardTrail = keyboardTrail;
  await shot(page, "03-after-8-arrowdown");

  const groups: Readonly<Record<string, string>> = {
    status: "party-menu", row: "party-menu", formation: "party-menu", monsters: "party-menu",
    quests: "record-menu", relationships: "record-menu",
    save: "system-menu", load: "system-menu", wait: "system-menu", "to-title": "system-menu",
  };
  const panels: unknown[] = [];
  for (const cmd of ["items", "skills", "equipment", "status", "row", "formation", "quests", "save"]) {
    const group = groups[cmd];
    try {
      if (group) {
        const g = page.getByTestId(`status-menu-command-${group}`);
        if (await g.count()) await g.first().click();
        await page.waitForTimeout(200);
        const sub = page.getByTestId(`status-menu-group-command-${cmd}`);
        if (await sub.count()) await sub.first().click();
        else { panels.push({ cmd, error: "group command missing" }); continue; }
      } else {
        const b = page.getByTestId(`status-menu-command-${cmd}`);
        if (await b.count()) await b.first().click();
        else { panels.push({ cmd, error: "command missing" }); continue; }
      }
      await page.waitForTimeout(450);
      await shot(page, `04-panel-${cmd}`);
      panels.push(await measureMenu(page, `panel:${cmd}`));
    } catch (error) {
      panels.push({ cmd, error: String(error).slice(0, 200) });
    }
  }
  report.panels = panels;

  for (const size of [{ width: 1024, height: 700 }, { width: 800, height: 600 }]) {
    await page.setViewportSize(size);
    await page.waitForTimeout(700);
    await shot(page, `05-menu-${size.width}x${size.height}`);
    report[`main${size.width}`] = await measureMenu(page, `main@${size.width}x${size.height}`);
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(400);
  const escPresses: unknown[] = [];
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(350);
    escPresses.push({
      press: i + 1,
      menuCount: await page.getByTestId("main-menu").count(),
      detailTitle: await page.getByTestId("status-menu-detail-title").count()
        ? (await page.getByTestId("status-menu-detail-title").first().textContent())?.trim().slice(0, 30)
        : null,
    });
  }
  report.escPresses = escPresses;
  await shot(page, "06-after-esc-presses");

  writeFileSync(`${DIR}/report.json`, JSON.stringify(report, null, 2));
  writeFileSync(`${DIR}/console.txt`, consoleLines.join("\n"));
  writeFileSync(`${DIR}/failed-requests.txt`, failed.join("\n"));
});
