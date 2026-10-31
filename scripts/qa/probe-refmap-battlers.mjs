// REFMAP 변형 인물 칩(RefmapDoll)을 입은 파티가 도트 측면 전투에 자기 전투 시트로 서는지 본다(2026-10-29).
// 파티 4명 걷기 칩을 RefmapDoll 칸으로 바꾸고 전투를 열어, 대기·공격 장면을 찍고 배우 노드의 시트 URL 을 센다.
//   node scripts/qa/probe-refmap-battlers.mjs   → verify-shots/runtime-qa/refmap-battlers/*.png
//   PLAYER_URL=http://127.0.0.1:<port> node …   — 빌드한 플레이어를 정적으로 띄운 주소(개발 서버가 느린 기계용)
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROJECT_URL = "/__runtime-qa/project.json";
const OUT = "verify-shots/runtime-qa/refmap-battlers";
const PARTY = { actor_hero: [105, 1], actor_guardian: [89, 0], actor_mage: [2, 6], actor_scout: [1, 2] };   // 기사·성직자·마법사·메이드

const raw = JSON.parse(await readFile(new URL("test/fixtures/projects/editor-authored-demo-v3.json", `file://${REPO_ROOT}`), "utf8"));
for (const actor of raw.database.actors) {
  const slot = PARTY[actor.id];
  if (!slot) continue;
  actor.characterResourceId = `oprn-charset-refmap-doll${slot[0]}`;
  actor.characterIndex = slot[1];
  delete actor.battleCharacterResourceId;
}
const startMap = raw.maps[raw.startMapId];
const commands = [{ kind: "battleProcessing", troopId: "troop_slime_pair", canEscape: true, canLose: true }];
startMap.events = startMap.events.filter((e) => e.id !== "ev_probe");
startMap.events.push({
  id: "ev_probe", x: startMap.startX ?? 1, y: startMap.startY ?? 1, trigger: { kind: "auto" }, commands,
  pages: [{ id: "page_1", name: "p", conditions: [], graphic: { transparent: true }, trigger: { kind: "auto" }, priority: "below", overlapForbidden: false, movement: { type: "fixed", speed: 3, frequency: 3 }, commands }],
});

await mkdir(OUT, { recursive: true });
const server = process.env.PLAYER_URL ? { url: process.env.PLAYER_URL } : await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await page.route(`**${PROJECT_URL}`, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(raw) }));
  await page.addInitScript(([u, n]) => { window.__OPENRPG_BOOT__ = { projectUrl: u, saveNamespace: n }; }, [PROJECT_URL, "probe-refmap-battlers"]);
  const failed = [];
  page.on("pageerror", (e) => console.error("pageerror", String(e).slice(0, 300)));
  page.on("console", (m) => { if (m.type() === "error") console.error("console", m.text().slice(0, 300)); });
  page.on("response", (res) => { if (res.status() >= 400) { failed.push(`${res.status()} ${res.url()}`); console.error("http", res.status(), res.url().slice(0, 200)); } });
  page.on("requestfailed", (req) => console.error("reqfail", req.url().slice(0, 200), req.failure()?.errorText));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 600_000 });
  // 빌드한 플레이어는 소리를 켜는 「시작하기」 문을 먼저 띄운다 — 타이틀이 나올 때까지 Enter 를 누른다.
  for (let k = 0; k < 600 && !(await page.$("[data-testid='title-screen']")); k++) { await page.keyboard.press("Enter").catch(() => {}); await page.waitForTimeout(1000); }
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 600_000 }).catch(async (e) => { await page.screenshot({ path: `${OUT}/stuck.png` }); throw e; });
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-testid='battle-scene']", { timeout: 120_000 });
  await page.waitForSelector("[data-testid='actor-command-attack']", { timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/idle.png` });
  const sheets = await page.evaluate(() => [...document.querySelectorAll("*")].map((el) => getComputedStyle(el).backgroundImage).filter((b) => b.includes("refmap-doll")));
  // 네 명 모두 「공격」→ 첫 적(커서가 이미 공격에 있다 — Enter 두 번씩). 그다음 행동 장면을 짧은 간격으로 찍는다.
  for (let k = 0; k < 8; k++) { await page.keyboard.press("Enter"); await page.waitForTimeout(350); }
  for (let k = 0; k < 16; k++) { await page.waitForTimeout(200); await page.screenshot({ path: `${OUT}/attack-${String(k).padStart(2, "0")}.png` }); }
  console.log(JSON.stringify({ refmapSheetsOnScreen: [...new Set(sheets)].length, sample: [...new Set(sheets)].slice(0, 4), failed }));
} finally {
  await browser.close();
  await server.close?.();
}
