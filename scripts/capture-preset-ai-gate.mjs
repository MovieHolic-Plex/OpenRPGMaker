// Browser evidence for the preset AI connection gate (src/editor/ui/aiConnectGate.ts).
// Real modules in isolation: the companion auth status is stubbed as signed out, then signed in.
// No model requests, project host, or authored game writes.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const base = process.env.AI_GATE_CAPTURE_URL ?? "http://127.0.0.1:9923";
const folder = "verify-shots/preset-ai-connect-gate";
mkdirSync(folder, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let signedIn = false;
  await page.route("**/auth/status**", (route) => route.fulfill({ json: { connected: signedIn, planType: signedIn ? "plus" : undefined } }));
  await page.route("**/__ai_gate_capture", (route) => route.fulfill({ contentType: "text/html", body: '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' }));
  await page.goto(base + "/__ai_gate_capture");
  await page.evaluate(async () => {
    await import("/src/styles/index.css");
    const { showNewProjectDialog } = await import("/src/editor/ui/newProjectDialog.ts");
    const { ensureAiConnectedForPreset } = await import("/src/editor/ui/aiConnectGate.ts");
    window.gateCalls = [];
    window.captureResult = "pending";
    void showNewProjectDialog({
      defaultValue: "기억을 먹는 숲",
      ensureAiConnected: async (presetLabel) => {
        const ok = await ensureAiConnectedForPreset({ presetLabel });
        window.gateCalls.push({ presetLabel, ok });
        return ok;
      },
    }).then((result) => { window.captureResult = result; });
  });
  await page.getByTestId("new-project-next").click();
  await page.getByTestId("new-project-genre-option-monster-collect").check();
  await page.getByTestId("new-project-next").click();
  await page.getByTestId("new-project-confirm").click();

  const gate = page.getByTestId("ai-connect-gate");
  await gate.waitFor({ state: "visible", timeout: 15_000 });
  await page.getByTestId("ai-connect-gate-status").filter({ hasNotText: "^$" }).waitFor();
  await page.screenshot({ path: folder + "/01-gate-disconnected.png" });
  const gateText = await gate.innerText();
  const interviewBeforeConnect = await page.getByTestId("project-interview").count();

  // 「나중에」: 관문이 닫히고 다이얼로그에 그대로 남는다.
  await page.getByTestId("ai-connect-gate-later").click();
  await gate.waitFor({ state: "detached" });
  const dialogStillOpen = await page.getByTestId("new-project-dialog").count();

  // 다시 시도 → 연결하기 → 설정 창이 앞에 뜬다.
  await page.getByTestId("new-project-confirm").click();
  await gate.waitFor({ state: "visible" });
  await page.getByTestId("ai-connect-gate-connect").click();
  const settings = page.getByTestId("ai-settings-modal");
  await settings.waitFor({ state: "visible", timeout: 15_000 });
  const gateHiddenWhileSettings = await gate.evaluate((node) => node.hidden);
  const settingsOnTop = await page.evaluate(() => {
    const window_ = document.querySelector(".ai-settings-window").getBoundingClientRect();
    const hit = document.elementFromPoint(window_.x + window_.width / 2, window_.y + 20);
    return Boolean(hit?.closest("[data-testid='ai-settings-modal']"));
  });
  await page.screenshot({ path: folder + "/02-settings-over-dialog.png" });

  // 로그인했다고 치고 설정을 닫는다 → 관문이 스스로 닫히고 기획 인터뷰가 열린다.
  signedIn = true;
  await page.getByTestId("ai-settings-close").click();
  await page.getByTestId("project-interview").waitFor({ state: "visible", timeout: 15_000 });
  const gateGoneAfterConnect = (await gate.count()) === 0;
  await page.screenshot({ path: folder + "/03-interview-after-connect.png" });

  // 390px 폭에서도 관문이 넘치지 않는다.
  await page.keyboard.press("Escape");
  signedIn = false;
  await page.setViewportSize({ width: 390, height: 780 });
  await page.evaluate(async () => {
    const { resetAiConnectionStatusCache } = await import("/src/editor/panels/aiConnectionStatus.ts");
    resetAiConnectionStatusCache();
    const { ensureAiConnectedForPreset } = await import("/src/editor/ui/aiConnectGate.ts");
    void ensureAiConnectedForPreset({ presetLabel: "회상 스토리" });
  });
  await gate.waitFor({ state: "visible" });
  const narrow = await page.evaluate(() => ({
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    card: document.querySelector(".ai-connect-gate-card").getBoundingClientRect().toJSON(),
  }));
  await page.screenshot({ path: folder + "/04-gate-390.png" });

  const gateCalls = await page.evaluate(() => window.gateCalls);
  const summary = { gateText, interviewBeforeConnect, dialogStillOpen, gateHiddenWhileSettings, settingsOnTop, gateGoneAfterConnect, gateCalls, narrow, errors };
  writeFileSync(folder + "/SUMMARY.json", JSON.stringify(summary, null, 2) + "\n");
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
}

