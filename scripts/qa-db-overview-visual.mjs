// Visual QA probe — Database '개요' tab. Captures modal screenshots at several
// viewports plus scroll positions, and collects layout/overflow/clipping metrics.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.QA_BASE_URL ?? "http://127.0.0.1:9999";
const SHOT_DIR = process.env.QA_SHOT_DIR ?? ".omo/evidence/db-overview-visual-qa";
const ALL_VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "780x900", width: 780, height: 900 },
];
const only = process.env.QA_VIEWPORTS?.split(",").map((s) => s.trim()).filter(Boolean);
const VIEWPORTS = only?.length ? ALL_VIEWPORTS.filter((v) => only.includes(v.name)) : ALL_VIEWPORTS;

mkdirSync(SHOT_DIR, { recursive: true });
const browser = await chromium.launch();
const report = [];

for (const vp of VIEWPORTS) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
  });
  const consoleErrors = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(String(e)));
  await page.addInitScript(() => {
    try {
      localStorage.setItem("oprn:editor-ui-mode", "expert");
    } catch {}
  });
  const entry = { viewport: vp.name, shots: [], consoleErrors, error: null };
  try {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
        break;
      } catch (navErr) {
        if (attempt >= 3) throw navErr;
      }
    }
    await page.getByTestId("toolbar-database").click();
    await page.getByTestId("database-modal").waitFor({ state: "visible", timeout: 20000 });
    await page.getByTestId("db-tab-overview").click();
    // Dashboard content is injected on idle; wait for the deferred sections.
    await page.getByTestId("db-overview-curve").waitFor({ state: "visible", timeout: 20000 });
    await page.getByTestId("db-overview-ai").waitFor({ state: "attached", timeout: 20000 });

    const shot = (label) => {
      const path = `${SHOT_DIR}/overview-${vp.name}-${label}.png`;
      entry.shots.push(path);
      return page.screenshot({ path });
    };
    await shot("top");
    entry.metricsTop = await page.evaluate(() => {
      const nodes = [...document.querySelectorAll(".db-overview-pulse-card, .db-overview-stat")];
      return nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return {
          testid: n.dataset.testid,
          y: +r.y.toFixed(1),
          h: +r.height.toFixed(1),
          w: +r.width.toFixed(1),
        };
      });
    });

    // Scroll the shared workspace to the bottom in page-sized steps.
    const scrollInfo = await page.evaluate(() => {
      const scroller =
        document.querySelector(".db-body.db-shared-workspace") ??
        document.querySelector(".database-modal-body");
      if (!(scroller instanceof HTMLElement)) return null;
      return { scrollHeight: scroller.scrollHeight, clientHeight: scroller.clientHeight };
    });
    entry.scroll = scrollInfo;
    if (scrollInfo && scrollInfo.scrollHeight > scrollInfo.clientHeight + 4) {
      const steps = Math.min(4, Math.ceil(scrollInfo.scrollHeight / scrollInfo.clientHeight));
      for (let i = 1; i <= steps; i += 1) {
        await page.evaluate((frac) => {
          const s =
            document.querySelector(".db-body.db-shared-workspace") ??
            document.querySelector(".database-modal-body");
          if (s instanceof HTMLElement) s.scrollTop = s.scrollHeight * frac;
        }, i / steps);
        await page.waitForFunction(
          (frac) => {
            const s =
              document.querySelector(".db-body.db-shared-workspace") ??
              document.querySelector(".database-modal-body");
            if (!(s instanceof HTMLElement)) return true;
            return Math.abs(s.scrollTop - s.scrollHeight * frac) < 8 || s.scrollTop + s.clientHeight >= s.scrollHeight - 2;
          },
          i / steps,
          { timeout: 5000 },
        );
        await shot(`scroll${i}`);
      }
    }

    entry.metrics = await page.evaluate(() => {
      const sel = (s) => document.querySelector(s);
      const box = (node) => {
        if (!(node instanceof HTMLElement) && !(node instanceof SVGElement)) return null;
        const r = node.getBoundingClientRect();
        return { x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
      };
      const modal = sel("[data-testid='database-modal']");
      const workspace = sel(".db-body.db-shared-workspace") ?? sel(".database-modal-body");
      const pulse = sel("[data-testid='db-overview-game-pulse']");
      const rail = sel(".db-tabs");
      const clipped = [];
      const overflowX = [];
      const wsRect = workspace?.getBoundingClientRect();
      for (const node of document.querySelectorAll(
        "[data-testid='db-overview-game-pulse'] *, [data-testid='db-overview-charts'] *",
      )) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.scrollWidth > node.clientWidth + 1 && node.clientWidth > 0) {
          overflowX.push({
            cls: node.className,
            tag: node.tagName,
            text: (node.textContent ?? "").trim().slice(0, 40),
            scrollWidth: node.scrollWidth,
            clientWidth: node.clientWidth,
          });
        }
        if (node.scrollHeight > node.clientHeight + 1 && node.children.length === 0) {
          clipped.push({
            cls: node.className,
            text: (node.textContent ?? "").trim().slice(0, 40),
            scrollHeight: node.scrollHeight,
            clientHeight: node.clientHeight,
          });
        }
        if (wsRect) {
          const r = node.getBoundingClientRect();
          if (r.width > 0 && (r.right > wsRect.right + 1 || r.left < wsRect.left - 1)) {
            overflowX.push({
              cls: node.className,
              tag: node.tagName,
              text: (node.textContent ?? "").trim().slice(0, 40),
              escapesWorkspace: true,
              left: +r.left.toFixed(1),
              right: +r.right.toFixed(1),
            });
          }
        }
      }
      const cards = [...document.querySelectorAll(".db-overview-pulse-card")].map((c) => ({
        testid: c.dataset.testid,
        box: box(c),
        text: (c.textContent ?? "").trim().replace(/\s+/gu, " "),
      }));
      const stats = [...document.querySelectorAll(".db-overview-stat")].map((c) => ({
        testid: c.dataset.testid,
        box: box(c),
        text: (c.textContent ?? "").trim().replace(/\s+/gu, " "),
      }));
      const aiButtons = [...document.querySelectorAll("button")]
        .filter((b) => (b.textContent ?? "").includes("AI 어시스턴트"))
        .map((b) => ({ testid: b.dataset.testid, text: b.textContent?.trim(), box: box(b) }));
      const svgs = ["db-overview-curve", "db-overview-scatter"].map((t) => {
        const node = document.querySelector(`[data-testid='${t}']`);
        return { testid: t, box: box(node), present: Boolean(node) };
      });
      const railStyle = rail instanceof HTMLElement ? getComputedStyle(rail) : null;
      return {
        modal: box(modal),
        workspace: box(workspace),
        pulse: box(pulse),
        rail: { box: box(rail), width: railStyle?.width },
        cards,
        stats,
        aiButtons,
        svgs,
        heroTitle: sel(".db-overview-hero h2")?.textContent?.trim(),
        heroSub: sel(".db-overview-hero p")?.textContent?.trim(),
        issues: [...document.querySelectorAll(".db-overview-issue")].map((i) => ({
          testid: i.dataset.testid,
          text: (i.textContent ?? "").trim().replace(/\s+/gu, " ").slice(0, 160),
        })),
        issuesEmpty: Boolean(sel("[data-testid='db-overview-issues-empty']")),
        scatterEmpty: Boolean(sel("[data-testid='db-overview-scatter-empty']")),
        overflowX,
        clipped,
        sectionTitles: [...document.querySelectorAll(".db-overview-section-title")].map((t) =>
          t.textContent?.trim(),
        ),
      };
    });
  } catch (err) {
    entry.error = String(err).slice(0, 800);
  }
  report.push(entry);
  await page.close();
}

await browser.close();
writeFileSync(`${SHOT_DIR}/report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
