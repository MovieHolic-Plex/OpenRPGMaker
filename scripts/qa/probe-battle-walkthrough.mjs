// 전투를 끝까지 진행하며 매 단계의 적 스프라이트 불투명도를 실측한다.
// 목적: "몬스터가 반투명하다" 가 어느 단계에서 참인지 확정하고, 동시에 UI/UX 채점용
// 단계별 스크린샷을 남긴다. 단계를 하나만 재면(=명령 입력 화면) 반투명을 놓친다.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROJECT_URL = "/__runtime-qa/project.json";
const TROOP = process.env.TROOP ?? "troop_slime_pair";
const SKIN = process.env.SKIN ?? "";
const OUT = `verify-shots/runtime-qa/battle-walk/${SKIN || "default"}-${TROOP}`;
const STEPS = Number(process.env.STEPS ?? 26);

await mkdir(OUT, { recursive: true });

const raw = JSON.parse(
  await readFile(new URL("test/fixtures/projects/editor-authored-demo-v3.json", `file://${REPO_ROOT}`), "utf8"),
);
if (SKIN) {
  raw.database ??= {};
  raw.database.system ??= {};
  raw.database.system.battleSkinId = SKIN;
}
const startMap = raw.maps[raw.startMapId];
const commands = [{ kind: "battleProcessing", troopId: TROOP, canEscape: true, canLose: true }];
startMap.events = startMap.events.filter((e) => e.id !== "ev_probe");
startMap.events.push({
  id: "ev_probe", x: startMap.startX ?? 1, y: startMap.startY ?? 1, trigger: { kind: "auto" }, commands,
  pages: [{
    id: "page_1", name: "p", conditions: [], graphic: { transparent: true },
    trigger: { kind: "auto" }, priority: "below", overlapForbidden: false,
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands,
  }],
});

const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
await page.route(`**${PROJECT_URL}`, (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(raw) }));
await page.addInitScript(([u, n]) => { window.__OPENRPG_BOOT__ = { projectUrl: u, saveNamespace: n }; },
  [PROJECT_URL, "probe-walk"]);
await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
await page.keyboard.press("Enter");
await page.waitForSelector("[data-testid='battle-scene']", { timeout: 120_000 });

const SNAP = () => page.evaluate(() => {
  const cum = (el) => {
    let o = 1;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const v = Number.parseFloat(getComputedStyle(n).opacity);
      if (Number.isFinite(v)) o *= v;
    }
    return Math.round(o * 1000) / 1000;
  };
  const scene = document.querySelector("[data-testid='battle-scene']");
  return {
    phase: scene?.dataset.battlePhase ?? null,
    step: scene?.dataset.battleDirectorStep ?? null,
    message: document.querySelector(".battle-message-window")?.textContent?.trim().slice(0, 70) ?? null,
    enemies: [...document.querySelectorAll(".battle-enemy")].map((n) => {
      const img = n.querySelector(".battle-enemy-image");
      return {
        name: n.querySelector(".battle-enemy-name")?.textContent ?? n.dataset.recordId,
        defeated: n.classList.contains("defeated"),
        selected: n.classList.contains("battle-target-selected"),
        candidate: n.classList.contains("battle-target-candidate"),
        nodeOpacity: getComputedStyle(n).opacity,
        imgOpacity: img ? getComputedStyle(img).opacity : null,
        // 조상까지 곱한 실제 화면 불투명도. 1 미만이면 눈에 반투명이다.
        effective: img ? cum(img) : null,
        filter: img ? getComputedStyle(img).filter : null,
        anim: n ? getComputedStyle(n).animationName : null,
      };
    }),
    resultPanel: !!document.querySelector(".battle-result-panel"),
  };
});

const log = [];
const record = async (label) => {
  const s = await SNAP();
  s.label = label;
  log.push(s);
  const worst = Math.min(1, ...s.enemies.filter((e) => e.effective !== null).map((e) => e.effective));
  console.log(`[${label}] phase=${s.phase} step=${s.step} minEffectiveOpacity=${Number.isFinite(worst) ? worst : "n/a"} msg=${JSON.stringify(s.message)}`);
  for (const e of s.enemies) {
    console.log(`    ${e.name} defeated=${e.defeated} sel=${e.selected} node=${e.nodeOpacity} img=${e.imgOpacity} eff=${e.effective} anim=${e.anim} filter=${e.filter}`);
  }
  await page.screenshot({ path: `${OUT}/${String(log.length).padStart(2, "0")}-${label}.png` });
};

await page.waitForSelector("[data-testid='actor-command-attack']", { timeout: 60_000 });
await page.waitForTimeout(1000);
await record("command");

for (let i = 0; i < STEPS; i++) {
  await page.keyboard.press("z");
  await page.waitForTimeout(420);
  await record(`z${i + 1}`);
  const s = log.at(-1);
  if (s.resultPanel) { console.log("→ 결과 패널 도달, 종료"); break; }
  // 마지막 적이 죽으면 입력을 멈춘다. 계속 누르면 승리/보상 화면을 넘겨버려
  // "보상 화면이 없다" 는 잘못된 결론이 나온다.
  if (s.enemies.length > 0 && s.enemies.every((e) => e.defeated)) {
    console.log("→ 전멸 확인. 입력 중단하고 관찰만 한다.");
    for (const wait of [700, 1500, 2500, 4000]) {
      await page.waitForTimeout(wait);
      await record(`idle+${wait}ms`);
      if (log.at(-1).resultPanel) break;
    }
    break;
  }
}

await writeFile(`${OUT}/walk.json`, JSON.stringify(log, null, 2));
console.log(`\n[done] ${OUT}`);
await browser.close();
await server.close();
