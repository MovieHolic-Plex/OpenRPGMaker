// 설정 모달 「이미지」 절(배경·대형 / 도트 저작) 화면 증거 — 모델 호출 없음.
//   unshare -rn bash -c 'ip link set lo up; node scripts/qa/image-model-split.mjs <태그> [언어,..]'
// 이 기기의 크로미움은 네트워크 알림이 모듈 요청을 끊어 백지가 되므로 격리 netns 에서 돌린다(openwiki/testing.md).
// dev 서버(npm run dev:worktree)를 스스로 띄웠다 끈다. 캡처 시나리오:
//   fresh   저장값 없음(새 설정)            legacy  pixelModel 이 없던 옛 저장값(보존 확인)
//   claude  사용자가 Claude 를 골라 저장한 값  switch  새 설정에서 모달로 Claude 를 골라 저장되는지
import { spawn } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "playwright";

const [tag = "after", langsArg = "ko,en"] = process.argv.slice(2);
const out = resolve("output/evidence/image-model-split");
await mkdir(out, { recursive: true });
const html = resolve("ims-qa.html");
await writeFile(html, `<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body><script type="module">
import "/src/styles/index.css";
import { initI18n } from "/src/i18n/index.ts";
await initI18n();
const { openAiSettingsModal } = await import("/src/editor/panels/aiSettingsModal.ts");
window.openSettings = openAiSettingsModal; openAiSettingsModal(); await document.fonts.ready; console.log("ims-ready");
</script></body></html>`);

const legacyBlob = JSON.stringify({ authMode: "chatgpt", providerId: "openai-codex", model: "gpt-6.1-sol", liteModel: "gpt-6.1-sol",
  imageProviderId: "google-antigravity", imageModel: "gemini-3.1-flash-image",
  ultrabrainProviderId: "google-antigravity", ultrabrainModel: "gemini-4-argon", ultrabrainReasoningEffort: "high",
  roleModels: { deep: { provider: "openai-codex", model: "gpt-6.1-sol", thinkingLevel: "medium" } }, roleModelsPolicyVersion: 1, maxTokens: 12345 });
const claudeBlob = JSON.stringify({ ...JSON.parse(legacyBlob), pixelModel: { provider: "google-antigravity", model: "claude-sonnet-4-6", thinkingLevel: "high" }, modelSelectionOverrides: { pixel: true, image: true } });

const dev = spawn("npm", ["run", "dev:worktree"], { stdio: ["ignore", "pipe", "pipe"], env: process.env });
let base = "";
dev.stdout.on("data", (chunk) => { const match = /http:\/\/(?:127\.0\.0\.1|localhost):(\d+)/.exec(String(chunk)); if (match && !base) base = `http://127.0.0.1:${match[1]}`; });
const deadline = Date.now() + 180000;
while (!base && Date.now() < deadline) await new Promise((r) => setTimeout(r, 500));
if (!base) { dev.kill(); throw new Error("dev 서버 주소를 못 찾았습니다."); }
for (let i = 0; i < 120; i++) { try { if ((await fetch(base + "/")).ok) break; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 1000)); }

const browser = await chromium.launch({ headless: true, args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const report = [];
try {
  for (const scenario of ["fresh", "legacy", "claude", "switch"]) {
    for (const lang of langsArg.split(",")) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1500 } });
      await page.route("**/auth/**", (r) => r.fulfill({ json: { connected: false } }));
      const seed = scenario === "legacy" ? legacyBlob : scenario === "claude" ? claudeBlob : "";
      if (seed) await page.addInitScript(([k, v]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); } }, ["oprn:ai-config", seed]);
      page.on("pageerror", (e) => console.log("PAGEERR", String(e).slice(0, 300)));
      const ready = page.waitForEvent("console", { predicate: (m) => m.text() === "ims-ready", timeout: 150000 });
      await page.goto(`${base}/ims-qa.html?lang=${lang}`);
      await ready;
      await page.getByTestId("ai-settings-tab-models").click();
      await page.getByTestId("ai-settings-section-image").scrollIntoViewIfNeeded();
      const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("oprn:ai-config") ?? "null"));
      const opened = await stored();
      const row = { scenario, lang, storedOnOpen: opened ? { pixelModel: opened.pixelModel ?? null, imageModel: opened.imageModel, maxTokens: opened.maxTokens } : null };
      row.pixelSelect = await page.getByTestId("ai-config-pixel-model").inputValue();
      row.pixelStatus = (await page.getByTestId("ai-config-pixel-status").textContent())?.slice(0, 90);
      if (scenario === "switch") {
        await page.getByTestId("ai-config-pixel-model").selectOption("google-antigravity::claude-opus-4-6");
        await page.waitForTimeout(500);
        const after = await stored();
        row.afterSwitch = { pixelModel: after.pixelModel, pinned: after.modelSelectionOverrides, imageModel: after.imageModel };
      }
      if (scenario === "legacy") {
        // 옛 설정으로 연 뒤 도트 칸을 만지지 않고 다른 칸(글자 수 예산)을 바꿔 저장시켜 본다 — pixelModel 이 몰래 생기면 안 된다.
        await page.getByTestId("ai-settings-tab-behavior").click();
        const budget = page.getByTestId("ai-config-maxtokens");
        await budget.fill("12400"); await budget.dispatchEvent("change"); await page.waitForTimeout(500);
        const saved = await stored();
        row.legacyAfterOtherEdit = { hasPixelModel: "pixelModel" in saved, imageModel: saved.imageModel, imageProviderId: saved.imageProviderId, maxTokens: saved.maxTokens, deep: saved.roleModels?.deep };
        await page.getByTestId("ai-settings-tab-models").click();
        await page.getByTestId("ai-settings-section-image").scrollIntoViewIfNeeded();
      }
      await page.screenshot({ path: resolve(out, `${tag}-${scenario}-${lang}-models.png`) });
      report.push(row);
      await page.close();
    }
  }
} finally {
  await browser.close();
  dev.kill();
  await rm(html, { force: true });
}
await writeFile(resolve(out, `${tag}-report.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
