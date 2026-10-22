// 양쪽 전신(dual-fullbody-veil) 대화창 프로젝트에서 자료집 「게임 설정 → 화면」 해상도가 바뀌는지 재현·증명.
//   2026-10-21 신고 「해상도 변경이 안 됨」: 480×320 이하를 고르면 1024×768·3.2배로 말없이 되돌아갔다.
// 사용(격리 netns 권장): DEV_SERVER_PORT=<포트> node scripts/qa/db-system-veil-resolution.mjs <캡처 접두>
//   찍는 것: 고른 직후 「화면」 구획, 그다음 시연 실행 창의 게임 캔버스 크기.
import { chromium } from "playwright";
const PREFIX = process.argv[2] ?? "/tmp/db-system-veil";
const PORT = process.env.DEV_SERVER_PORT ?? "9823";
const browser = await chromium.launch({ args: ["--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.addInitScript(() => localStorage.setItem("oprn:editor-ui-mode", "expert"));
await page.goto(`http://127.0.0.1:${PORT}/?freshProject=1`, { timeout: 180000, waitUntil: "commit" });
await page.waitForFunction(() => !!window.__oprnEditorStore, null, { timeout: 180000 });
await page.waitForTimeout(6000);
// 새 프로젝트 비동기 로드가 늦게 끝나면 먼저 넣은 값이 덮인다 — 남을 때까지 다시 넣는다.
for (let attempt = 0; attempt < 20; attempt += 1) {
  await page.evaluate(() => { if (window.__oprnEditorStore.getCurrent().system.dialogueStyle !== "dual-fullbody-veil") window.__oprnEditorStore.update((d) => { d.system.dialogueStyle = "dual-fullbody-veil"; }, { scope: "system", label: "qa" }); });
  await page.waitForTimeout(1500);
  if (await page.evaluate(() => window.__oprnEditorStore.getCurrent().system.dialogueStyle === "dual-fullbody-veil")) break;
}
await page.evaluate(async () => { (await import("/src/editor/panels/databaseModal.ts")).openDatabaseModal("system"); });
await page.getByTestId("database-modal").waitFor();
await page.getByTestId("db-system-nav-display").click();
const sys = () => page.evaluate(() => { const s = window.__oprnEditorStore.getCurrent().system; return JSON.stringify({ res: s.playResolution, zoom: s.cameraZoom, dlg: s.dialogueStyle }); });
const vals = () => page.evaluate(() => JSON.stringify({
  view: document.querySelector('[data-testid="db-field-system-view-preset"]')?.value,
  preset: document.querySelector('[data-testid="db-field-system-resolution-preset"]')?.value,
  w: document.querySelector('input[data-testid="db-field-system-resolution-width"]')?.value,
  h: document.querySelector('input[data-testid="db-field-system-resolution-height"]')?.value,
  z: document.querySelector('input[data-testid="db-field-system-camera-zoom"]')?.value,
}));
console.log("veil start", await sys(), await vals());
for (const p of ["480x270", "640x360", "320x240"]) {
  await page.getByTestId("db-field-system-resolution-preset").selectOption(p);
  await page.waitForTimeout(300);
  console.log("pick", p, await sys(), await vals());
}
await page.getByTestId("db-field-system-view-preset").selectOption("default");
await page.waitForTimeout(300);
console.log("view default", await sys(), await vals());
await page.getByTestId("database-modal").screenshot({ path: `${PREFIX}-display.png` });
// 시연 실행 — 게임 캔버스가 고른 크기로 뜨는가
await page.keyboard.press("Escape");
await page.waitForTimeout(500);
await page.evaluate(async () => { (await import("/src/editor/panels/testPlayModal.ts")).openTestPlayModal(); });
// 게임 캔버스(Phaser)는 맵 굽기 뒤에 붙는다 — 편집기 캔버스 말고 하나 더 생길 때까지 기다린다.
await page.waitForFunction(() => document.querySelectorAll("canvas").length >= 2, null, { timeout: 90000 }).catch(() => {});
await page.waitForTimeout(3000);
const canvases = await page.evaluate(() => [...document.querySelectorAll("canvas")].map((c) => `${c.width}x${c.height}`).join(" | "));
console.log("test-play canvases", canvases);
await page.screenshot({ path: `${PREFIX}-testplay.png` });
await browser.close();
