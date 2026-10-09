// 결과 국면 도달 경로 진단 — 왜 12개 스킨 전부 result 가 not-mounted 였는지 실측한다.
// 전투가 끝나는 순간의 phase/director-step/패널 존재를 시간축으로 찍는다.
import { chromium } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROJECT_URL = "/__runtime-qa/project.json";
const FIXTURE = "test/fixtures/projects/editor-authored-demo-v3.json";

const raw = JSON.parse(await readFile(new URL(FIXTURE, `file://${REPO_ROOT}`), "utf8"));
raw.system = { ...raw.system, battleUiStyle: "retro2003" };
const startMap = raw.maps[raw.startMapId];
startMap.events = startMap.events.filter((e) => e.id !== "ev_probe");
const commands = [{ kind: "battleProcessing", troopId: "troop_slime_pair", canEscape: true, canLose: true }];
startMap.events.push({
  id: "ev_probe",
  x: startMap.startX ?? 1,
  y: startMap.startY ?? 1,
  trigger: { kind: "auto" },
  commands,
  pages: [
    {
      id: "page_1",
      name: "probe",
      conditions: [],
      graphic: { transparent: true },
      trigger: { kind: "auto" },
      priority: "below",
      overlapForbidden: false,
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands,
    },
  ],
});

const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.route(`**${PROJECT_URL}`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(raw) }));
// exportEntry.ts 는 최상위에서 직시 부패하므로 주입은 addInitScript 여야 한다.
await page.addInitScript(
  ([projectUrl, saveNamespace]) => {
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace };
  },
  [PROJECT_URL, "probe-battle-result"],
);
await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
await page.keyboard.press("Enter");
await page.waitForSelector("[data-testid='battle-scene']", { timeout: 60_000 });

const read = () =>
  page.evaluate(() => {
    const scene = document.querySelector("[data-testid='battle-scene']");
    return {
      mounted: Boolean(scene),
      phase: scene?.dataset.battlePhase ?? null,
      step: scene?.dataset.battleDirectorStep ?? null,
      panel: Boolean(document.querySelector("[data-testid='battle-result-panel']")),
      dialogue: Boolean(document.querySelector("[data-testid='dialogue-box']")),
      enemyHp: [...document.querySelectorAll("[data-testid^='battle-enemy-hp-']")].map((n) => n.textContent),
    };
  });

let sawPanel = false;
for (let i = 0; i < 140; i += 1) {
  const s = await read();
  if (s.panel) sawPanel = true;
  console.log(
    `${String(i).padStart(3)} mounted=${s.mounted ? 1 : 0} phase=${String(s.phase).padEnd(13)} step=${String(s.step).padEnd(9)} panel=${s.panel ? 1 : 0} dlg=${s.dialogue ? 1 : 0} hp=${s.enemyHp.join(",")}`,
  );
  if (s.panel) break;
  if (!s.mounted && i > 3) break;
  if (s.phase !== "resolved") await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
}
console.log(`\n패널 관측=${sawPanel}`);
await browser.close();
await server.close();
