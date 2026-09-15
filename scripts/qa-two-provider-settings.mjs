/**
 * 에디터 AI 설정에서 두 제공자(Antigravity·Codex)를 실제로 고를 수 있는지 브라우저로 확인한다.
 *
 * 단위 테스트로는 "고를 수 있다"까지만 증명된다. 사용자가 겪는 것은 선택이 **다시 열어도
 * 남아 있는가** 이므로, 여기서는 선택 후 새로고침까지 통과시킨다.
 *
 * 실행: OPRN_URL=http://127.0.0.1:9801 node scripts/qa-two-provider-settings.mjs <출력디렉터리>
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { applyLegacyEnvAliases } from "./lib/oprnEnv.mjs";

applyLegacyEnvAliases();

const BASE = process.env.OPRN_URL ?? "http://127.0.0.1:9801";
const OUT = process.argv[2] ?? "output/evidence/two-provider-settings";
const EXPECTED = ["google-antigravity", "openai-codex"];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
page.on("dialog", (d) => d.accept());
await mkdir(OUT, { recursive: true });

const failures = [];
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "PASS" : "FAIL"} ${label}: ${JSON.stringify(actual)}${ok ? "" : ` (expected ${JSON.stringify(expected)})`}`);
  if (!ok) failures.push(label);
}

async function openSettings() {
  // 네트워크가 흔들리면(실측: ERR_NETWORK_CHANGED) 첫 로드가 실패하므로 몇 번 다시 시도한다.
  let booted = false;
  for (let attempt = 1; attempt <= 4 && !booted; attempt += 1) {
    try {
      await page.goto(`${BASE}/?freshProject=1`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await page.getByTestId("edit-canvas").waitFor({ state: "visible", timeout: 60_000 });
      booted = true;
    } catch (error) {
      console.log(`INFO boot attempt ${attempt} failed: ${String(error).split("\n")[0].slice(0, 120)}`);
    }
  }
  if (!booted) throw new Error("editor did not boot");
  await page.getByTestId("topbar-ai-settings").click();
  // 보이는 선택은 제공자 카드다 — select 는 숨은 값·change 원천으로만 남는다.
  await page.getByTestId("ai-auth-quick-google-antigravity").waitFor({ state: "visible", timeout: 30_000 });
  const select = page.getByTestId("ai-oh-my-pi-provider");
  await select.waitFor({ state: "attached", timeout: 30_000 });
  return select;
}

let select = await openSettings();
const options = await select.locator("option").evaluateAll((nodes) => nodes.map((n) => n.value));
check("provider select offers exactly the two backends", options, EXPECTED);
check("provider select is enabled (user really has a choice)", await select.isEnabled(), true);
check("factory default is Antigravity", await select.inputValue(), "google-antigravity");
await page.screenshot({ path: path.join(OUT, "01-provider-select-antigravity.png") });

const labels = await select.locator("option").evaluateAll((nodes) => nodes.map((n) => n.textContent?.trim()));
console.log(`INFO option labels: ${JSON.stringify(labels)}`);

// 보이는 경로(카드 클릭)로 고른다 — select 는 숨겨져 있다.
await page.getByTestId("ai-auth-quick-openai-codex").click();
await page.waitForTimeout(600);
check("selecting Codex sticks in the control", await select.inputValue(), "openai-codex");
await page.screenshot({ path: path.join(OUT, "02-provider-select-codex.png") });

const stored = await page.evaluate(() => {
  const raw = localStorage.getItem("oprn:ai-config");
  const blob = raw ? JSON.parse(raw) : {};
  return { providerId: blob.providerId, apiKey: blob.apiKey, model: blob.model };
});
check("the choice is persisted as providerId", stored.providerId, "openai-codex");
check("no secret is written to the browser", stored.apiKey ?? "", "");
console.log(`INFO stored model after switch: ${JSON.stringify(stored.model)}`);

select = await openSettings();
check("the Codex choice survives a full reload", await select.inputValue(), "openai-codex");
await page.screenshot({ path: path.join(OUT, "03-codex-survives-reload.png") });

await browser.close();
console.log(failures.length === 0 ? "ALL CHECKS PASSED" : `FAILURES: ${failures.join(", ")}`);
process.exit(failures.length === 0 ? 0 : 1);
