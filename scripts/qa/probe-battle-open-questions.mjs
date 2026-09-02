// 적대 채점에서 남은 미지수를 실측한다. 추측으로 CSS 를 고치면 이 저장소의
// 캐스케이드(스킨 12종 × 파일 20여 개)에서 반드시 빗나간다.
//   Q1 확인 버튼이 왜 라벤더인가 → --battle-accent 실값 + computed background
//   Q2 결과 패널 배경 알파
//   Q3 적 이름/HP 가 왜 화면에 없는가 → computed display/visibility/rect
//   Q4 파티 행 우측 핑크 게이지의 정체와 라벨 유무
//   Q5 행동 해결 중 좌측이 왜 검은 공백인가 → 명령 패널/HUD 밴드 rect
//   Q6 필드 대비 몬스터 점유 면적(여백 과다 판단 근거)
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROJECT_URL = "/__runtime-qa/project.json";
const OUT = "verify-shots/runtime-qa/battle-open-questions";
await mkdir(OUT, { recursive: true });

const raw = JSON.parse(
  await readFile(new URL("test/fixtures/projects/editor-authored-demo-v3.json", `file://${REPO_ROOT}`), "utf8"),
);
const startMap = raw.maps[raw.startMapId];
const commands = [{ kind: "battleProcessing", troopId: "troop_slime_pair", canEscape: true, canLose: true }];
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
  [PROJECT_URL, "probe-open"]);
await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
await page.keyboard.press("Enter");
await page.waitForSelector("[data-testid='actor-command-attack']", { timeout: 120_000 });
await page.waitForTimeout(900);

const measure = (label) => page.evaluate((lbl) => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  const box = (sel) => { const el = document.querySelector(sel); if (!el) return { sel, present: false };
    const cs = getComputedStyle(el);
    return { sel, present: true, rect: r(el), display: cs.display, visibility: cs.visibility,
             opacity: cs.opacity, bg: cs.backgroundColor, color: cs.color,
             border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
             radius: cs.borderRadius, font: `${cs.fontSize}/${cs.fontWeight}`,
             text: (el.textContent || "").trim().slice(0, 40) }; };
  const scene = document.querySelector("[data-testid='battle-scene']");
  const sceneCs = scene ? getComputedStyle(scene) : null;
  const tok = (n) => sceneCs?.getPropertyValue(n).trim() || null;
  return {
    label: lbl,
    step: scene?.dataset.battleDirectorStep ?? null,
    phase: scene?.dataset.battlePhase ?? null,
    tokens: {
      accent: tok("--battle-accent"), accentSoft: tok("--battle-accent-soft"),
      gold: tok("--battle-gold"), panelHi: tok("--battle-panel-hi"),
      text: tok("--battle-text"), rmCard: tok("--rm-card"),
    },
    // Q5 좌측 공백 — 명령 패널과 HUD 밴드의 실제 상자
    commandHost: box(".battle-command-host"),
    commandPanel: box(".battle-command-panel"),
    hudBand: box(".battle-party"),
    messageWindow: box(".battle-message-window"),
    field: box(".battle-field"),
    scene: box("[data-testid='battle-scene']"),
    // Q3 적 이름 / HP
    enemyName: box(".battle-enemy-name"),
    enemyChrome: box(".battle-enemy-chrome"),
    enemyHud: box(".battle-enemy-hud"),
    // Q4 게이지
    atbBar: box(".battle-atb-bar"),
    actorRow: box(".battle-party .battle-actor"),
    // Q6 몬스터 점유
    enemies: [...document.querySelectorAll(".battle-enemy")].map((n) => r(n)),
  };
}, label);

const results = [];
results.push(await measure("command"));
await page.screenshot({ path: `${OUT}/command.png` });

// 행동 해결 단계로 진입시켜 좌측 공백을 그 상태에서 잰다.
await page.keyboard.press("z");
await page.waitForTimeout(400);
await page.keyboard.press("z");
await page.waitForTimeout(700);
results.push(await measure("resolving"));
await page.screenshot({ path: `${OUT}/resolving.png` });

for (const m of results) {
  console.log(`\n########## ${m.label} (step=${m.step} phase=${m.phase}) ##########`);
  console.log("tokens:", JSON.stringify(m.tokens));
  for (const key of ["scene", "field", "commandHost", "commandPanel", "hudBand", "messageWindow",
                     "enemyChrome", "enemyName", "enemyHud", "atbBar", "actorRow"]) {
    console.log(`  ${key.padEnd(14)}`, JSON.stringify(m[key]));
  }
  console.log("  enemies:", JSON.stringify(m.enemies));
}
await writeFile(`${OUT}/open-questions.json`, JSON.stringify(results, null, 2));
console.log(`\n[done] ${OUT}`);
await browser.close();
await server.close();
