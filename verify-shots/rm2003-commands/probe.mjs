// RM2003 배우별 명령 + 공통 이벤트 명령 실화면: 정찰병(이 전투 첫 차례)만 「기도」(공통 이벤트) 가 든 고유 메뉴를 갖는다.
// node verify-shots/rm2003-commands/probe.mjs
import { chromium } from "@playwright/test";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { runRuntimeQa, startPlayerQaServer } from "../../scripts/lib/runtimeQaRun.mjs";
import battleScenario from "../../scripts/qa/runtime/battle.scenario.mjs";

const out = "verify-shots/rm2003-commands";
await mkdir(out, { recursive: true });
const project = JSON.parse(await readFile(battleScenario.projectFixture ?? "test/fixtures/projects/editor-authored-demo-v3.json", "utf8"));
project.system.battleUiStyle = "retro2003";
project.database.battleCommands.push({ id: "cmd_pray", name: "기도", kind: "commonEvent", commonEventId: "ce_pray" });
project.commonEvents.push({ id: "ce_pray", name: "기도", trigger: "none", commands: [
  { kind: "text", body: "정찰병은 하늘을 향해 기도했다…" },
  { kind: "text", body: "따스한 빛이 일행을 감쌌다!" },
] });
project.database.actors.find((actor) => actor.id === "actor_scout").battleCommandIds = ["cmd_attack", "cmd_pray", "cmd_skill", "cmd_escape"];
const fixture = join(out, "fixture.json");
await writeFile(fixture, JSON.stringify(project));
const scenario = { ...battleScenario, projectFixture: fixture, beats: battleScenario.beats.slice(0, 4).map((b) => ({ ...b, shot: false })) };
const server = await startPlayerQaServer();
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-background-networking", "--disable-features=NetworkChangeNotifier"] });
try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await runRuntimeQa(page, scenario, { serverUrl: server.url, outDir: join(out, "qa") });
  await page.waitForTimeout(1500);
  const menu = await page.evaluate(() => [...document.querySelectorAll("[data-testid^=actor-command-]")].map((el) => `${el.dataset.testid}:${el.textContent.trim()}`));
  await page.screenshot({ path: join(out, "1-menu.png") });
  // 메뉴는 키보드로 움직인다(격자가 포인터를 가로챈다). 순서: 공격 · 기도 · 스킬 · 도주.
  await page.keyboard.press("ArrowRight"); await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, "1b-cursor-pray.png") });
  await page.keyboard.press("z");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(out, "2-pray-text.png") });
  const sceneText = () => page.evaluate(() => document.querySelector("[data-testid=battle-scene]")?.innerText.slice(0, 400));
  const text = await sceneText();
  // 문장 두 장을 넘기면 다음 배우(직업 명령) 차례 — 고유 메뉴가 그 배우에게 새지 않는지 본다.
  for (let i = 0; i < 2; i += 1) { await page.keyboard.press("z"); await page.waitForTimeout(900); }
  const text2 = await sceneText();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(out, "3-next-actor.png") });
  const menu2 = await page.evaluate(() => [...document.querySelectorAll("[data-testid^=actor-command-]")].map((el) => `${el.dataset.testid}:${el.textContent.trim()}`));
  const result = { menu, text, text2, menu2 };
  await writeFile(join(out, "probe.json"), JSON.stringify(result, null, 1));
  console.log(JSON.stringify(result, null, 1));
} finally {
  await browser.close();
  await server.close();
}
