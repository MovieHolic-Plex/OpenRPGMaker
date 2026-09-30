// 사용법: node which-normalizers.mjs <url>
// 부팅 뒤 편집 감사 로그에서 「프로젝트 정규화」 항목(어느 정규화기가 손댔는지)을 읽는다.
import { chromium } from "playwright";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const [url] = process.argv.slice(2);
const profile = mkdtempSync(join(tmpdir(), "f-wn-"));
const ctx = await chromium.launchPersistentContext(profile, { headless: true, viewport: { width: 1600, height: 900 }, args: ["--disable-features=NetworkChangeNotifier"] });
const page = ctx.pages()[0] ?? (await ctx.newPage());
const ready = () => page.waitForFunction(() => !document.getElementById("oprn-boot-loader") && document.querySelector("canvas"), null, { timeout: 240000, polling: 100 });
await page.goto(url, { waitUntil: "commit" });
await ready();
for (let i = 0; i < 2; i += 1) {
  await page.reload({ waitUntil: "commit" });
  await ready();
  await page.waitForTimeout(2500);
  const out = await page.evaluate(() => {
    const fn = window.__oprnEditActivityText;
    const act = window.__oprnEditActivity?.({ limit: 8 });
    return { text: fn ? fn().slice(0, 1500) : "(no fn)", act: JSON.stringify(act)?.slice(0, 2500) };
  });
  console.log(`--- reload ${i + 1}`);
  console.log(out.text);
  console.log(out.act);
}
await ctx.close();
rmSync(profile, { recursive: true, force: true });
