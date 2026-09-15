// MP 부족 스킬 행의 이름 폭 계측 프로브 (2026-09-16).
// 비용 배지와 거절 사유 배지가 둘 다 비축소(flex:0 0 auto)라 행을 다 먹으면,
// min-width:0 인 strong(이름)이 0px 로 줄어 어느 기술인지 읽을 수 없다.
//
//   node scripts/qa/runtime/battle-skill-badge.probe.mjs
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const out = resolve(process.env.QA_OUT_DIR ?? "verify-shots/runtime-qa/battle-skill-badge");
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const project = JSON.parse(await readFile(new URL("../../../test/fixtures/projects/battle-v3.json", import.meta.url), "utf8"));
const actor = project.database.actors[0];
actor.skillIds = ["skill_fire", "skill_claw"];
const claw = project.database.skills.find((s) => s.id === "skill_claw");
const fire = project.database.skills.find((s) => s.id === "skill_fire");
if (claw) claw.mpCost = { flat: 999, percentMax: 0 };
if (fire) fire.mpCost = { flat: 3, percentMax: 0 };

const MEASURE = `(() => {
  const rows = [...document.querySelectorAll('button[data-testid^="actor-skill-"]')];
  return rows.map((row) => {
    const name = row.querySelector(".battle-command-text strong");
    const smalls = [...row.querySelectorAll(".battle-command-text small")];
    const reason = row.querySelector(".battle-command-reason");
    return {
      testid: row.dataset.testid,
      nameText: name ? name.textContent : null,
      nameClientWidth: name ? Math.round(name.clientWidth) : null,
      nameScrollWidth: name ? Math.round(name.scrollWidth) : null,
      rowWidth: Math.round(row.getBoundingClientRect().width),
      smalls: smalls.map((s) => ({ text: (s.textContent || "").trim(), width: Math.round(s.getBoundingClientRect().width), truncated: s.scrollWidth > s.clientWidth + 1 })),
      reasonText: reason ? reason.textContent : null,
      inert: row.dataset.battleCommandInert === "true",
    };
  });
})()`;

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const server = await startPlayerQaServer();
const report = { errors: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (e) => report.errors.push(String(e)));
  await page.addInitScript(() => {
    window.__OPENRPG_BOOT__ = { projectUrl: "/__skillbadge/project.json", saveNamespace: "skillbadge-qa", qaInstrumentation: true };
  });
  await page.route("**/__skillbadge/project.json", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify(project) }));
  await page.goto(server.url + "/player.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 60_000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__oprnDebug?.readState?.().currentMapId, undefined, { timeout: 60_000 });
  await page.evaluate(() => { window.__oprnInput.face("right"); window.__oprnInput.action(); });
  for (let i = 0; i < 24; i += 1) {
    if (await page.locator('[data-testid="battle-scene"]').count()) break;
    await page.keyboard.press("z");
    await page.waitForTimeout(300);
  }
  await page.waitForSelector('[data-testid="actor-command-attack"]', { state: "attached", timeout: 30_000 });
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  await page.keyboard.press("z");
  await page.waitForTimeout(700);
  report.rows = await page.evaluate(MEASURE);
  await page.screenshot({ path: resolve(out, "skill-submenu.png") });
} finally {
  await browser.close();
  await server.close();
}
const target = (report.rows ?? []).find((r) => r.testid === "actor-skill-skill_claw") ?? (report.rows ?? []).find((r) => r.inert) ?? null;
report.target = target;
report.pass = !!target && typeof target.nameClientWidth === "number" && target.nameClientWidth >= 24;
await writeFile(resolve(out, "result.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify({ rows: report.rows, pass: report.pass, errors: report.errors.slice(0, 2) }, null, 1));
