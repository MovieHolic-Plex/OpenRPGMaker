/** 진단: standard/expert 모드에서 좌패널 툴바(oprn-tile-toolbar) 버튼 잘림 여부 측정. */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.env.RPG_ZZU_URL ?? "http://127.0.0.1:9977";
const OUT = join(process.cwd(), "output", "evidence", "left-sidebar-review", "shots");
const MD = join(process.cwd(), "output", "evidence", "left-sidebar-review", "toolbar-clipping-measure.md");

type BtnRow = {
  testid: string;
  x: number; y: number; w: number; h: number;
  insideToolbar: boolean;
};

type ToolbarInfo = {
  found: boolean;
  rect?: { x: number; y: number; w: number; h: number };
  overflowX?: string;
  flexWrap?: string;
  scrollWidth?: number;
  clientWidth?: number;
  panelWidth?: number;
  buttons?: BtnRow[];
  clippedCount?: number;
};

async function measure(page: import("@playwright/test").Page): Promise<ToolbarInfo> {
  return page.evaluate(() => {
    const tb = document.querySelector('[data-testid="oprn-tile-toolbar"]') as HTMLElement | null;
    if (!tb) return { found: false };
    const r = tb.getBoundingClientRect();
    const st = getComputedStyle(tb);
    let panelWidth: number | undefined;
    const panel = tb.closest(".left-panel") ?? document.querySelector(".left-panel");
    if (panel) panelWidth = Math.round(panel.getBoundingClientRect().width);
    const tr = { x1: r.left, y1: r.top, x2: r.right, y2: r.bottom };
    const rows: BtnRow[] = [];
    for (const b of Array.from(tb.querySelectorAll("button"))) {
      const br = b.getBoundingClientRect();
      if (br.width === 0 && br.height === 0) continue;
      const inside =
        br.left >= tr.x1 - 0.5 && br.top >= tr.y1 - 0.5 &&
        br.right <= tr.x2 + 0.5 && br.bottom <= tr.y2 + 0.5;
      rows.push({
        testid: b.dataset.testid ?? "(none)",
        x: Math.round(br.left * 10) / 10,
        y: Math.round(br.top * 10) / 10,
        w: Math.round(br.width * 10) / 10,
        h: Math.round(br.height * 10) / 10,
        insideToolbar: inside,
      });
    }
    return {
      found: true,
      rect: { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) },
      overflowX: st.overflowX,
      flexWrap: st.flexWrap,
      scrollWidth: tb.scrollWidth,
      clientWidth: tb.clientWidth,
      panelWidth,
      buttons: rows,
      clippedCount: rows.filter((x) => !x.insideToolbar).length,
    };
  });
}

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const results: Record<string, ToolbarInfo> = {};

  for (const mode of ["standard", "expert"]) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.addInitScript((m: string) => {
      localStorage.setItem("oprn:editor-ui-mode", m);
      localStorage.setItem("oprn:coachmarks-basic-v1", "1");
      localStorage.setItem("oprn:standard-welcome-seen", "1");
      localStorage.setItem("oprn:ai-panel-collapsed", "1");
    }, mode);
    await page.goto(`${BASE}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded" });
    await page.locator('[data-testid="edit-canvas"]').waitFor({ state: "visible", timeout: 60_000 });
    results[mode] = await measure(page);

    if (mode === "standard") {
      await page.locator('[data-testid="oprn-tile-toolbar"]').screenshot({ path: join(OUT, "measure-toolbar-clip.png") });
      await page.screenshot({ path: join(OUT, "measure-toolbar-clip-full.png"), fullPage: true });
    }
    await page.close();
  }

  await browser.close();

  const lines: string[] = [
    "# Toolbar clipping measurement (left sidebar tool toolbar)",
    "",
    `Measured: ${new Date().toISOString()} - URL \`${BASE}/?devProject=1&marketTown=1\`, viewport 1440x900.`,
    "",
  ];
  for (const [mode, info] of Object.entries(results)) {
    lines.push(`## Mode: ${mode} (panel width ${info.panelWidth ?? "?"}px)`, "");
    if (!info.found || !info.rect) { lines.push("Toolbar `[data-testid=\"oprn-tile-toolbar\"]` NOT FOUND.", ""); continue; }
    lines.push(
      `- Toolbar rect: x=${info.rect.x}, y=${info.rect.y}, width=${info.rect.w}, height=${info.rect.h}`,
      `- computed overflow-x: \`${info.overflowX}\``,
      `- computed flex-wrap: \`${info.flexWrap}\``,
      `- scrollWidth=${info.scrollWidth}, clientWidth=${info.clientWidth}${(info.scrollWidth ?? 0) > (info.clientWidth ?? 0) ? " -> CONTENT OVERFLOWS" : ""}`,
      "",
      "| button data-testid | x | y | width | height | fully inside toolbar? |",
      "|---|---|---|---|---|---|",
    );
    for (const b of info.buttons ?? []) {
      lines.push(`| \`${b.testid}\` | ${b.x} | ${b.y} | ${b.w} | ${b.h} | ${b.insideToolbar ? "YES" : "**NO (clipped/out)**"} |`);
    }
    lines.push("", `**Clipped/overflowing buttons in ${mode}: ${info.clippedCount}** of ${info.buttons?.length ?? 0}.`, "");
  }
  writeFileSync(MD, lines.join("\n"), "utf8");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
