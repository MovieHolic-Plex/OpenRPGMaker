/** 보고서 HTML 이 실제로 렌더되는지, 내장 이미지가 전부 로드되는지 검증한다. */
import { chromium } from "@playwright/test";
import { join } from "node:path";

const FILE = `file://${join(process.cwd(), "reports", "left-sidebar-tools-adversarial-review.html")}`;
const OUT = join(process.cwd(), "output", "evidence", "left-sidebar-review", "shots");

async function main(): Promise<void> {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(FILE, { waitUntil: "load" });

  const report = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll("img")];
    const broken = imgs.filter((i) => !i.complete || i.naturalWidth === 0).length;
    return {
      title: document.title,
      sections: document.querySelectorAll("section").length,
      images: imgs.length,
      brokenImages: broken,
      figures: document.querySelectorAll("figure").length,
      tables: document.querySelectorAll("table").length,
      tocLinks: document.querySelectorAll(".toc a").length,
      deadAnchors: [...document.querySelectorAll('a[href^="#"]')]
        .map((a) => (a as HTMLAnchorElement).hash.slice(1))
        .filter((id) => id && !document.getElementById(id)),
      docHeight: document.documentElement.scrollHeight,
      leftovers: document.body.innerHTML.includes("IMGCOUNT") ? "IMGCOUNT placeholder remains" : "none",
    };
  });
  console.log(JSON.stringify({ report, errors }, null, 2));
  await page.screenshot({ path: join(OUT, "report-top.png") });
  await page.evaluate(() => document.getElementById("s2")?.scrollIntoView());
  await page.screenshot({ path: join(OUT, "report-s2.png") });
  await page.evaluate(() => document.getElementById("s8")?.scrollIntoView());
  await page.screenshot({ path: join(OUT, "report-s8.png") });
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
