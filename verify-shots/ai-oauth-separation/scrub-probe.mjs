// 부팅 시 평문 키 삭제 실측. 레거시 blob 을 심고 에디터를 띄운 뒤 raw blob 을 다시 읽는다.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PROBE_BASE_URL ?? "http://127.0.0.1:9802";
const log = [];
const say = (l) => { log.push(l); console.log(l); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.addInitScript(() => {
  localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  localStorage.setItem("rpg-zzu:ai-config", JSON.stringify({
    authMode: "apiKey",
    apiKey: "sk-probe-LEAK",
    baseUrl: "/api/cliproxy",
    model: "cpen/gpt-5-6-luna",
    providerId: "zai",
  }));
});
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(7000);

const after = await page.evaluate(() => localStorage.getItem("rpg-zzu:ai-config"));
say(`[scrub] 부팅 후 blob=${after}`);
if ((after ?? "").includes("sk-probe-LEAK")) say("[FAIL] 평문 키가 여전히 디스크에 남아 있다");
if ((after ?? "").includes("/api/cliproxy")) say("[FAIL] 죽은 게이트웨이 주소가 남아 있다");
const blob = after ? JSON.parse(after) : {};
if (blob.providerId !== "zai") say(`[FAIL] 사용자 제공자가 보존되지 않았다 (${blob.providerId})`);
if (blob.configVersion !== 2) say(`[FAIL] configVersion 표식이 없다 (${blob.configVersion})`);
say(`[scrub] providerId=${blob.providerId} configVersion=${blob.configVersion} apiKey="${blob.apiKey}" baseUrl="${blob.baseUrl}"`);

writeFileSync(join(OUT, "scrub-probe-log.txt"), `${log.join("\n")}\n`, "utf8");
await browser.close();
