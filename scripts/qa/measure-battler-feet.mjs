// 배틀러 발 위치 실측 — test/fixtures/battleEnemyFeetRatios.json 의 skins[<id>] 항목을 만든다.
//
//   node scripts/qa/measure-battler-feet.mjs --skin=rm2003 [--troop=troop_bat_swarm] [--write=1]
//
// 하네스 qa-back-battler.html 에 3마리 적 그룹을 올리고, 적 스프라이트(.battle-enemy-image) 상자의
// 아랫변(발)·윗변(머리)을 필드(.battle-field) 높이로 나눈 비율을 소수 3자리로 적는다.
// `--write=1` 이면 픽스처에 병합해 저장한다(authoredY 는 배치표에서 다시 계산).
import { chromium } from "@playwright/test";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const FIXTURE = join(REPO_ROOT, "test/fixtures/projects/editor-authored-demo-v3.json");
const RATIOS = join(REPO_ROOT, "test/fixtures/battleEnemyFeetRatios.json");
const arg = (name, fallback) => {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const SKIN = arg("skin", "");
const TROOP = arg("troop", "troop_bat_swarm");
const WRITE = arg("write", "") === "1";
if (!SKIN) throw new Error("--skin=<id> 가 필요하다");

const fixture = JSON.parse(await readFile(FIXTURE, "utf8"));
fixture.system.battleUiStyle = SKIN;
const projectJson = JSON.stringify(fixture);
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
try {
  await page.goto(`${server.url}/qa-back-battler.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__qaBattle?.ready === true, null, { timeout: 120_000 });
  await page.evaluate(
    ([json, troop]) => window.__qaBattle.mount({ projectJson: json, troopId: troop, ensureBundledAnimations: true }),
    [projectJson, TROOP]
  );
  await page.waitForFunction(() => document.querySelector("[data-testid='actor-command-attack']") !== null, null, { timeout: 60_000 });
  // 이미지가 실제로 그려진 뒤(naturalWidth) 재야 contain 레터박스가 아니라 스프라이트 상자를 잰다.
  await page.waitForFunction(
    () => [...document.querySelectorAll(".battle-enemy .battle-enemy-image")].every((img) => !(img instanceof HTMLImageElement) || img.naturalWidth > 0),
    null,
    { timeout: 30_000 }
  );
  const measured = await page.evaluate(() => {
    const field = document.querySelector(".battle-field").getBoundingClientRect();
    const enemies = [...document.querySelectorAll(".battle-enemy-group .battle-enemy")];
    const feetRatio = [];
    const topRatio = [];
    for (const enemy of enemies) {
      const image = enemy.querySelector(".battle-enemy-image") ?? enemy;
      const r = image.getBoundingClientRect();
      feetRatio.push(Math.round(((r.bottom - field.top) / field.height) * 1000) / 1000);
      topRatio.push(Math.round(((r.top - field.top) / field.height) * 1000) / 1000);
    }
    return {
      skin: document.querySelector("[data-testid='battle-scene']")?.dataset.battleSkin ?? null,
      fieldTop: Math.round(field.top),
      fieldHeight: Math.round(field.height),
      feetRatio,
      topRatio,
    };
  });
  console.log(JSON.stringify(measured));
  if (measured.skin !== SKIN) throw new Error(`스킨이 ${measured.skin} 로 풀렸다 — 요청 ${SKIN}`);
  if (WRITE) {
    const ratios = JSON.parse(await readFile(RATIOS, "utf8"));
    const placements = await import(new URL("../../src/player/battleFieldDom.ts", import.meta.url).href).catch(() => null);
    const authoredY = ratios.skins[SKIN]?.authoredY ?? null;
    ratios.skins[SKIN] = {
      authoredY: authoredY ?? (placements ? [0, 1, 2].map((i) => placements.BATTLER_PLACEMENTS[SKIN].enemy(i, 3).y) : []),
      measured: { fieldTop: measured.fieldTop, fieldHeight: measured.fieldHeight, feetRatio: measured.feetRatio, topRatio: measured.topRatio },
    };
    await writeFile(RATIOS, `${JSON.stringify(ratios, null, 2)}\n`);
    console.log(`[written] ${RATIOS} skins.${SKIN}`);
  }
} finally {
  await browser.close();
  await server.close();
}
