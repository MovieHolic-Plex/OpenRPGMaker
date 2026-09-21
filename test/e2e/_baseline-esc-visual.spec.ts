// 진단 전용 스펙 — ESC 메뉴 타이포/그래픽/좌상단 포트레이트 기준선 채증.
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";
import { startNewGameFromTitle } from "./runtimeInput";
import { openTestPlayWindow } from "./oprnPlayerStatusMenuHelpers";

const DIR = ".omo/evidence/runtime-menu-visual";

function project(): Project {
  const p = createBlankProject();
  p.session.inventory = {
    item_potion: 3,
    item_ether: 1,
    item_antidote: 2,
    item_hi_potion: 1,
    equip_scout_dagger: 1,
    equip_iron_sword: 1,
    equip_oak_shield: 1,
    equip_leather_armor: 1,
  };
  p.session = { ...p.session, partyActorIds: p.database.actors.slice(0, 4).map((a) => a.id) };
  return p;
}

test("baseline: esc menu typography + graphics + hud portrait", async ({ page }) => {
  mkdirSync(DIR, { recursive: true });
  const consoleLines: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => consoleLines.push(`[pageerror] ${e.message}`));
  page.on("requestfailed", (r) => failedRequests.push(`${r.failure()?.errorText ?? "?"} ${r.url()}`));
  page.on("response", (r) => { if (r.status() >= 400) failedRequests.push(`HTTP${r.status()} ${r.url()}`); });

  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectForEditor(page, project(), "/?e2eVitals=1");
  await openTestPlayWindow(page);
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-stage")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1200);

  // 1) 메뉴 열기 전 플레이 화면 (좌상단 포트레이트 확인용)
  await page.getByTestId("play-stage").screenshot({ path: `${DIR}/baseline-01-play-stage.png` });

  // 좌상단(스테이지 기준 0..40% x, 0..30% y) 안에 있는 모든 요소 덤프
  const topLeft = await page.evaluate(() => {
    const stage = document.querySelector("[data-testid='play-stage']");
    if (!(stage instanceof HTMLElement)) return [];
    const s = stage.getBoundingClientRect();
    const out: unknown[] = [];
    for (const node of Array.from(stage.querySelectorAll<HTMLElement>("*"))) {
      const r = node.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.left > s.left + s.width * 0.45) continue;
      if (r.top > s.top + s.height * 0.35) continue;
      const cs = getComputedStyle(node);
      out.push({
        tag: node.tagName.toLowerCase(),
        cls: node.className?.toString().slice(0, 120),
        testid: node.dataset.testid,
        src: node instanceof HTMLImageElement ? node.currentSrc || node.src : undefined,
        naturalWidth: node instanceof HTMLImageElement ? node.naturalWidth : undefined,
        bg: cs.backgroundImage === "none" ? undefined : cs.backgroundImage.slice(0, 160),
        font: `${cs.fontFamily} / ${cs.fontSize}`,
        rect: { x: Math.round(r.left - s.left), y: Math.round(r.top - s.top), w: Math.round(r.width), h: Math.round(r.height) },
        text: (node.textContent ?? "").trim().slice(0, 40),
      });
    }
    return out;
  });
  writeFileSync(`${DIR}/baseline-topleft-nodes.json`, JSON.stringify(topLeft, null, 2));

  // 2) ESC 로 메뉴 열기
  await page.keyboard.press("Escape");
  let opened = await page.getByTestId("main-menu").count();
  if (opened === 0) {
    await page.keyboard.press("x");
    opened = await page.getByTestId("main-menu").count();
  }
  writeFileSync(`${DIR}/baseline-menu-opened.txt`, `main-menu nodes: ${opened}\n`);
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(400);
  await page.getByTestId("main-menu").screenshot({ path: `${DIR}/baseline-02-esc-main.png` });

  const dump = async (label: string) => page.evaluate((lbl) => {
    const menu = document.querySelector("[data-testid='main-menu']");
    if (!(menu instanceof HTMLElement)) return { label: lbl, nodes: [], fonts: [], images: [] };
    const nodes = Array.from(menu.querySelectorAll<HTMLElement>("*"));
    const fonts: unknown[] = [];
    const images: unknown[] = [];
    for (const n of nodes) {
      const r = n.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(n);
      const own = Array.from(n.childNodes).some((c) => c.nodeType === 3 && (c.textContent ?? "").trim().length > 0);
      if (own) fonts.push({ cls: n.className?.toString().slice(0, 80), testid: n.dataset.testid, family: cs.fontFamily, size: cs.fontSize, text: (n.textContent ?? "").trim().slice(0, 30) });
      if (cs.backgroundImage !== "none" && cs.backgroundImage.includes("url(")) images.push({ cls: n.className?.toString().slice(0, 80), testid: n.dataset.testid, bg: cs.backgroundImage.slice(0, 180) });
      if (n instanceof HTMLImageElement) images.push({ cls: n.className?.toString().slice(0, 80), testid: n.dataset.testid, src: (n.currentSrc || n.src).slice(0, 180), naturalWidth: n.naturalWidth });
    }
    return { label: lbl, count: nodes.length, fonts, images };
  }, label);

  const dumps: unknown[] = [await dump("main")];

  for (const [cmd, group] of [["items", null], ["equipment", null], ["skills", null], ["status", "party-menu"]] as const) {
    if (group) {
      const g = page.getByTestId(`status-menu-command-${group}`);
      if (await g.count()) await g.click();
      const sub = page.getByTestId(`status-menu-group-command-${cmd}`);
      if (await sub.count()) await sub.click();
    } else {
      const b = page.getByTestId(`status-menu-command-${cmd}`);
      if (await b.count()) await b.click();
    }
    await page.waitForTimeout(350);
    await page.getByTestId("main-menu").screenshot({ path: `${DIR}/baseline-03-esc-${cmd}.png` });
    dumps.push(await dump(cmd));
  }

  writeFileSync(`${DIR}/baseline-menu-dump.json`, JSON.stringify(dumps, null, 2));
  writeFileSync(`${DIR}/baseline-console.txt`, consoleLines.join("\n"));
  writeFileSync(`${DIR}/baseline-failed-requests.txt`, failedRequests.join("\n"));
});
