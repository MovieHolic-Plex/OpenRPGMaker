import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
await p.goto("http://localhost:9999/?project=rpg-zzu-quest-demo&map=map_snow_cirque_52", { waitUntil: "domcontentloaded" });
await p.getByTestId("project-export-json").waitFor({ state: "attached", timeout: 60_000 });
await p.waitForFunction(() => (document.querySelector('[data-testid="project-export-json"]')?.textContent?.length ?? 0) > 100, undefined, { timeout: 60_000 });
const state = await p.evaluate(() => {
  const el = document.querySelector('[data-testid="project-export-json"]');
  const proj = JSON.parse(el?.textContent ?? "{}") as { project?: { maps?: Record<string, { name: string }> } };
  return Object.keys(proj.project?.maps ?? {});
});
console.log("editor sees maps:", state.join(", "));
await p.waitForTimeout(3500);
await p.screenshot({ path: "tmp/snow-variants/editor-cirque.png" });
await b.close();
