// 죽은 callMapEvent 경고 증거 캡처 (2026-09-21).
// E2E 진입 항(__OPRN_E2E_PROJECT__)으로 완전한 프로젝트를 주입하고
// 실제 마커 툴팁 · 이벤트 에디터 경고 종(벨지)을 찍는다.
import { chromium } from "/home/main/z-project/rpg-zzu/node_modules/playwright/index.mjs";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const PORT = process.env.DEV_SERVER_PORT ?? "9829";
const BASE = "http://127.0.0.1:" + PORT;
const OUT = "verify-shots/callmapevent-warning";
mkdirSync(OUT, { recursive: true });

// 검증 기본(ember-quest): 완전한 database/시스템을 가진 전이 자료. 이 맵을 연결 진행.
const baseProject = JSON.parse(readFileSync("/home/main/z-project/rpg-zzu/.playwright-mcp/ember-quest.json", "utf8"));

// 죽은 문 재현 — 웹 워크스페이스에서 발견된 상태 그대로:
// 문 본체 = 페이지 명령 0개, 발판 = callMapEvent(문 본체), 대상 transfer 맵 소실.
const deadDoorEvent = {
  id: "ev_house_door_1_map_blank_start_4",
  name: "밀러의 집 문",
  x: 10, y: 8,
  trigger: { kind: "playerTouch" },
  commands: [],
  pages: [{
    id: "ev_house_door_1_map_blank_start_4_page",
    name: "밀러의 집 문",
    conditions: [],
    graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_object1" }, pattern: 24 },
    trigger: { kind: "playerTouch" },
    priority: "below",
    overlapForbidden: false,
    animationType: "fixedGraphic",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: []
  }]
};
const deadStepEvent = {
  id: "ev_house_door_1_map_blank_start_4_step",
  name: "밀러의 집 문 발판",
  x: 10, y: 9,
  trigger: { kind: "playerTouch" },
  commands: [],
  pages: [{
    id: "ev_house_door_1_map_blank_start_4_step_page",
    name: "밀러의 집 문 발판",
    conditions: [],
    graphic: { transparent: true },
    trigger: { kind: "playerTouch" },
    priority: "below",
    overlapForbidden: false,
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [{ kind: "callMapEvent", eventId: "ev_house_door_1_map_blank_start_4" }]
  }]
};

const startMapId = baseProject.startMapId;
const startMap = baseProject.maps[startMapId];
startMap.events = [deadDoorEvent, deadStepEvent];

const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const context = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.addInitScript((json) => {
  for (let i = 1; i <= 3; i++) {
    localStorage.removeItem("oprn:save-slot:v5:" + i);
    localStorage.removeItem("oprn:save-slot:" + i);
  }
  window.__OPRN_E2E_PROJECT__ = JSON.parse(json);
  localStorage.setItem("oprn:editor-ui-mode", "expert");
}, JSON.stringify(baseProject));

await page.goto(BASE + "/?devProject=1&mode=event", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__oprnEditorStore != null, undefined, { timeout: 90000 });
await page.waitForTimeout(1500);

// 이벤트 레이어로 전환 — 목록 패널이 이 레이어에서만 렌더된다.
const eventLayerBtn = page.locator("button[title*='이벤트']").first();
try { await eventLayerBtn.click({ timeout: 4000 }); } catch (e) { console.log('layer btn miss'); }
await page.waitForTimeout(600);

const state = await page.evaluate(() => {
  const store = window.__oprnEditorStore;
  const project = store.getCurrent();
  const mapId = project.startMapId;
  const map = project.maps[mapId];
  const ids = (map && map.events ? map.events : []).map((event) => event.id);
  return { mapId: mapId, ids: ids, hasStep: ids.indexOf("ev_house_door_1_map_blank_start_4_step") >= 0 };
});
console.log("state:", JSON.stringify(state));

const shots = [];
async function shot(name) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: OUT + "/" + name + ".png" });
  shots.push(name);
  console.log("shot", name);
}

if (state.hasStep) {
  const rowSel = "[data-testid='event-list-row-ev_house_door_1_map_blank_start_4_step']";
  const row = page.locator(rowSel).first();
  const rowAlt = page.locator("text=밀러의 집 문 발판").first();
  const hoverTarget = (await row.count()) ? row : rowAlt;
  try {
    await hoverTarget.hover({ timeout: 5000 });
    await page.waitForTimeout(600);
    const tipVisible = await page.locator("[data-testid='event-list-tooltip']").count();
    console.log("list tooltip visible:", tipVisible);
    await shot("01-list-tooltip-warning");
  } catch (error) {
    console.log("list hover failed:", String(error).slice(0, 120));
  }

  await hoverTarget.dblclick({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);
  const modal = page.locator("[data-testid='event-editor-modal']");
  if (await modal.count()) {
    await shot("02-event-editor-callmapevent");
    const tally = page.locator("[data-testid='event-draft-validation-tally']");
    const tallyText = await tally.textContent().catch(() => "");
    console.log("validation tally:", tallyText);
    const badge = page.locator("[data-testid^='event-command-issue-badge-']").first();
    const badgeCount = await badge.count();
    console.log("issue badge count:", badgeCount);
    await shot("03-validation-bell");
  } else {
    console.log("event editor modal did not open");
  }
} else {
  console.log("skip: step event missing");
}

writeFileSync(OUT + "/_state.json", JSON.stringify({ state: state, shots: shots }, null, 1));
await browser.close();
console.log("done");
