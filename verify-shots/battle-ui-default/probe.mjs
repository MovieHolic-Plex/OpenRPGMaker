// 기본 전투 UI(rm2000) 실측: 출하 player.html 로 전투에 들어가 커맨드 창이 뜬 뒤 1.5초 기다려 찍고 창 사각형을 잰다.
// node verify-shots/battle-ui-default/probe.mjs [--skin <id>] [--width 1024 --height 768] [--out DIR]
import { chromium } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { runRuntimeQa, startPlayerQaServer } from "../../scripts/lib/runtimeQaRun.mjs";
import battleScenario from "../../scripts/qa/runtime/battle.scenario.mjs";

const arg = (name, fallback) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : fallback; };
const skin = arg("--skin", "");
const systemPatch = JSON.parse(arg("--system", "{}"));
const width = Number(arg("--width", 1024)), height = Number(arg("--height", 768));
const out = arg("--out", `verify-shots/battle-ui-default/${skin || "default"}-${width}x${height}`);
await mkdir(out, { recursive: true });
let fixture = battleScenario.projectFixture ?? "test/fixtures/projects/editor-authored-demo-v3.json";
if (skin || Object.keys(systemPatch).length) {
  const project = JSON.parse(await readFile(fixture, "utf8"));
  if (skin) project.system.battleUiStyle = skin;
  Object.assign(project.system, systemPatch);
  fixture = join(out, "fixture.json");
  await writeFile(fixture, JSON.stringify(project));
}
const scenario = { ...battleScenario, projectFixture: fixture, beats: battleScenario.beats.slice(0, 4).map((b) => ({ ...b, shot: false })) };
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
try {
  const page = await browser.newPage({ viewport: { width, height } });
  await runRuntimeQa(page, scenario, { serverUrl: server.url, outDir: join(out, "qa") });
  const measure = async (label) => {
    await page.screenshot({ path: join(out, `${label}.png`) });
    return page.evaluate(() => {
      const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height), z: cs.zIndex, vis: cs.visibility, op: cs.opacity, tr: cs.transform === "none" ? "" : cs.transform }; };
      const scene = document.querySelector("[data-testid=battle-scene]");
      const pick = {};
      for (const el of scene.querySelectorAll("[data-testid], [class*=battle-]")) {
        const key = el.dataset?.testid || String(el.getAttribute("class") ?? "").split(" ")[0];
        if (!key || pick[key]) continue;
        const b = el.getBoundingClientRect();
        if (b.width < 30 || b.height < 12) continue;
        pick[key] = r(el);
      }
      return { attrs: { ...scene.dataset }, pick };
    });
  };
  const at0 = await measure("t0");
  await page.waitForTimeout(1500);
  const at1 = await measure("t1500");
  const steps = {};
  const press = async (key, label) => { await page.keyboard.press(key); await page.waitForTimeout(700); steps[label] = await measure(label); };
  await press("ArrowRight", "s1-cursor-skill");
  await press("z", "s2-skill-list");
  await press("x", "s3-back");
  await press("ArrowLeft", "s4-cursor-attack");
  await press("z", "s5-target");
  await press("z", "s6-attack-run");
  await page.waitForTimeout(1500);
  steps["s7-after"] = await measure("s7-after");
  await writeFile(join(out, "rects.json"), JSON.stringify({ at0, at1, steps }, null, 2));
  console.log(JSON.stringify(at1.attrs));
} finally {
  await browser.close();
  await server.close();
}
