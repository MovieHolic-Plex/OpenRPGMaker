// Screenshots of the 장소 grid filtered to the RPG interiors (search box), read-only session.
import fs from "node:fs";
import { chromium } from "playwright";
const out = "verify-shots/rpg-interiors";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1050 } });
  await page.route("**/rest/v1/**", (r) => r.fulfill({ json: [] }));
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    localStorage.setItem("oprn:ai-panel-collapsed", "1");
    for (const k of ["oprn:editor-welcome-dismissed", "oprn:standard-welcome-seen", "oprn:coachmarks-basic-v1"]) localStorage.setItem(k, "1");
  });
  await page.goto(`${process.env.BASE ?? "http://127.0.0.1:9816"}/?devProject=1&marketTown=1`, { waitUntil: "domcontentloaded", timeout: 12e4 });
  const guest = page.getByTestId("login-guest");
  await page.getByTestId("ai-input").or(guest).first().waitFor({ timeout: 12e4 });
  if (await guest.isVisible()) await guest.click();
  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("database-modal").waitFor();
  const world = page.getByTestId("db-tab-group-world");
  if (await world.isVisible() && await world.getAttribute("aria-expanded") === "false") await world.click();
  await page.getByTestId("db-tab-spatial-places").click();
  const search = page.getByPlaceholder("장소 이름·용도로 검색");
  for (const [name, q] of [["grid-inn-homes", "여관"], ["grid-homes", "민가"], ["grid-castle", "성 ·"], ["grid-leisure", "카지노"], ["grid-ship", "배 ·"], ["grid-civic", "마법"]]) {
    await search.fill(q);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/${name}.png` });
  }
} finally {
  await browser.close();
}
