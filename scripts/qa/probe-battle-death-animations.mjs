// 막타 직후 `.battle-enemy.defeated` 노드에서 **실제로 돌고 있는 애니메이션**을
// Web Animations API 로 직접 열거한다. computed `animation-name` 한 줄로는
// 여러 애니메이션이 겹칠 때 누가 opacity 를 쥐고 있는지 알 수 없다.
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const PROJECT_URL = "/__runtime-qa/project.json";
const OUT = "verify-shots/runtime-qa/battle-death-anim";
await mkdir(OUT, { recursive: true });

const raw = JSON.parse(
  await readFile(new URL("test/fixtures/projects/editor-authored-demo-v3.json", `file://${REPO_ROOT}`), "utf8"),
);
const startMap = raw.maps[raw.startMapId];
const commands = [{ kind: "battleProcessing", troopId: "troop_slime", canEscape: true, canLose: true }];
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
  [PROJECT_URL, "probe-death"]);
await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
await page.keyboard.press("Enter");
await page.waitForSelector("[data-testid='actor-command-attack']", { timeout: 120_000 });
await page.waitForTimeout(800);

// 브라우저 안에서 고빈도로 샘플링한다. 왕복하면 60ms 해상도를 못 낸다.
await page.evaluate(() => {
  window.__deathSamples = [];
  const t0 = performance.now();
  const tick = () => {
    const node = document.querySelector(".battle-enemy");
    if (node) {
      const cs = getComputedStyle(node);
      const img = node.querySelector(".battle-enemy-image");
      window.__deathSamples.push({
        t: Math.round(performance.now() - t0),
        defeated: node.classList.contains("defeated"),
        classes: node.className,
        opacity: cs.opacity,
        imgOpacity: img ? getComputedStyle(img).opacity : null,
        animationName: cs.animationName,
        // 실제 활성 애니메이션 — 이게 진실이다.
        running: node.getAnimations().map((a) => ({
          name: a.animationName ?? a.constructor.name,
          playState: a.playState,
          time: Math.round(a.currentTime ?? -1),
          // 이 애니메이션이 opacity 를 건드리는가
          props: (() => { try { return [...new Set(a.effect.getKeyframes().flatMap((k) => Object.keys(k)))]
            .filter((k) => !["offset", "computedOffset", "easing", "composite"].includes(k)); }
            catch { return ["?"]; } })(),
        })),
      });
    }
    if (performance.now() - t0 < 3000) requestAnimationFrame(tick);
  };
  tick();
});
await page.keyboard.press("z");
await page.waitForTimeout(400);
await page.keyboard.press("z");
await page.waitForTimeout(3200);

const samples = await page.evaluate(() => window.__deathSamples);
// 죽은 뒤 구간만, 60ms 간격으로 솎아 출력한다.
const dead = samples.filter((s) => s.defeated);
let last = -999;
console.log(`총 ${samples.length} 샘플 / defeated ${dead.length}`);
for (const s of dead) {
  if (s.t - last < 60) continue;
  last = s.t;
  console.log(`t=${String(s.t).padStart(4)}ms opacity=${s.opacity.padEnd(6)} animName="${s.animationName}"`);
  for (const a of s.running) console.log(`        ↳ ${a.name} state=${a.playState} t=${a.time} props=${JSON.stringify(a.props)}`);
}
await writeFile(`${OUT}/samples.json`, JSON.stringify(samples, null, 2));
console.log(`\n[done] ${OUT}`);
await browser.close();
await server.close();
