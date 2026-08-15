// W2 task-2 manual QA — DB modal sidebar DOM probe.
// Loads the editor, hard-reloads (stale_state), opens the DB modal via the classic
// toolbar, and asserts the grouped sidebar structure: 4 group headers, 23 tab
// buttons, exactly one .active, all inside .db-tabs. Prints actual counts.
// Usage: node scripts/qa-sidebar-dom-probe.mjs <base-url>
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:9173";
const SHOT = ".superpowers/sdd/qa-shots/sidebar-dom-probe.png";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

const consoleLines = [];
page.on("console", (msg) => consoleLines.push(`[console.${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => consoleLines.push(`[pageerror] ${err.message}`));

// expert 모드에서만 클래식 툴바(toolbar-database 포함)가 렌더된다
// (editorUiMode.ts EXPERT_CHROME.classicToolbar=true). 초기 스크립트로 로드 전 세팅.
await page.addInitScript(() => {
  try {
    localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
  } catch {}
});

try {
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByTestId("toolbar-database").waitFor({ state: "visible", timeout: 20_000 });

  // stale_state: hard reload before the DOM probe so no cached markup/scripts reach it.
  await page.reload({ waitUntil: "networkidle", timeout: 60_000 });
  await page.getByTestId("toolbar-database").waitFor({ state: "visible", timeout: 20_000 });

  await page.getByTestId("toolbar-database").click();
  await page.getByTestId("database-modal").waitFor({ state: "visible", timeout: 10_000 });

  const probe = await page.evaluate(() => {
    const nav = document.querySelector(".database-modal-body .db-tabs");
    if (!(nav instanceof HTMLElement)) return { error: ".db-tabs not found under .database-modal-body" };
    const groups = [...nav.querySelectorAll(".db-tab-group")].map((g) => g.textContent.trim());
    const tabs = [...nav.querySelectorAll(".db-tab")].map((b) => b.getAttribute("data-testid"));
    const active = tabs.filter((id, i) => nav.querySelectorAll(".db-tab")[i].classList.contains("active"));
    return { groups, groupCount: groups.length, tabIds: tabs, tabCount: tabs.length, active };
  });

  console.log(`GROUPS=${probe.groupCount} ${JSON.stringify(probe.groups)}`);
  console.log(`TAB_COUNT=${probe.tabCount}`);
  console.log(`ACTIVE_TABS=${JSON.stringify(probe.active)} (count=${probe.active?.length ?? 0})`);

  const expectedGroups = ["전투", "수집", "세계", "시스템"];
  const failures = [];
  if (probe.groupCount !== 4) failures.push(`groupCount=${probe.groupCount} (want 4)`);
  if (JSON.stringify(probe.groups) !== JSON.stringify(expectedGroups)) failures.push(`group order ${JSON.stringify(probe.groups)}`);
  if (probe.tabCount !== 23) failures.push(`tabCount=${probe.tabCount} (want 23)`);
  if (new Set(probe.tabIds).size !== 23) failures.push(`duplicate testids (unique=${new Set(probe.tabIds).size})`);
  if ((probe.active?.length ?? 0) !== 1) failures.push(`active count=${probe.active?.length ?? 0} (want 1)`);

  await page.screenshot({ path: SHOT, fullPage: false });
  console.log(`SHOT_SAVED=${SHOT}`);

  if (failures.length > 0) throw new Error(`QA FAIL: ${failures.join("; ")}`);
  console.log("QA_PASS");
} finally {
  await browser.close();
  const { writeFileSync, mkdirSync } = await import("node:fs");
  mkdirSync(".omo/evidence/start-work/task-2", { recursive: true });
  writeFileSync(".omo/evidence/start-work/task-2/probe-console.txt", consoleLines.join("\n") + "\n");
}
