// 로케이션 역할 + 이벤트 겹침 클릭 검증 — 실제 브라우저 경로.
//   npm run dev:worktree  (DEV_SERVER_PORT=9804)
//   LOCATION_ROLES_QA_URL=http://127.0.0.1:9804 node scripts/qa/location-roles.mjs
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const output = process.env.LOCATION_ROLES_QA_OUTPUT ?? "verify-shots/loc-roles";
const baseUrl = process.env.LOCATION_ROLES_QA_URL ?? "http://127.0.0.1:9804";
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

await page.route("**/*", async (route) => {
  const request = route.request();
  if (request.method() !== "GET" || new URL(request.url()).origin !== new URL(baseUrl).origin) return route.continue();
  const response = await fetch(request.url(), { signal: AbortSignal.timeout(90000) });
  await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.from(await response.arrayBuffer()) });
});
page.setDefaultTimeout(90000);

const IGNORED = /WebSocket|ERR_CONNECTION_REFUSED|autosave|APITOPIA_API_KEY|vite/;
const errors = [];
page.on("pageerror", (error) => errors.push("pageerror: " + error.message));
page.on("console", (message) => {
  if (message.type() !== "error") return;
  if (!IGNORED.test(message.text())) errors.push("console: " + message.text());
});

await page.addInitScript(() => {
  localStorage.setItem("rpg-zzu:editor-ui-mode", "standard");
  localStorage.setItem("oprn:ai-panel-collapsed", "1");
  localStorage.removeItem("oprn:map-location-layer");
});

const checks = [];
const steps = [];
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  checks.push({ name, ok, actual, expected });
  assert.ok(ok, name + " | actual=" + JSON.stringify(actual) + " expected=" + JSON.stringify(expected));
}
function checkTruthy(name, actual) {
  checks.push({ name, ok: Boolean(actual), actual: Boolean(actual), expected: true });
  assert.ok(actual, name + " | actual=" + JSON.stringify(actual));
}
async function shot(name, note) {
  await page.screenshot({ path: output + "/" + name + ".png", fullPage: false });
  steps.push({ name, note });
}
const testId = (id) => page.getByTestId(id);

async function tilePoint(tx, ty) {
  return page.evaluate(async ([x, y]) => {
    const module = await import("/src/editor/regionClientRect.ts");
    const rect = module.resolveRegionClientRect({ x, y, width: 1, height: 1 });
    return rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
  }, [tx, ty]);
}

await page.goto(baseUrl + "/?freshProject=1");
await testId("map-location-layer-toggle").waitFor({ state: "visible" });
await page.waitForFunction(() => Boolean(window.__oprnEditWorldToClient), null, { timeout: 120000 });
await page.waitForFunction(async () => {
  const registry = await import("/src/editor/regionClientRect.ts");
  return registry.resolveClientPointTile({ x: 700, y: 400 }) !== null;
}, null, { timeout: 120000, polling: 250 });
await testId("layer-lower").click().catch(() => {});
// 부팅 직후에는 currentMapId 가 아직 프로젝트에 없는 값을 가리킬 수 있다(실측).
// 씬이 맵을 그린 뒤에 심는다 — 지금 존재하는 맵을 고른다.
await page.waitForFunction(async () => {
  const store = await import("/src/project/store.ts");
  return Object.keys(store.store.getCurrent().maps).length > 0;
}, null, { timeout: 60000, polling: 200 });

const seeded = await page.evaluate(async () => {
  const store = await import("/src/project/store.ts");
  const editor = await import("/src/editor/editorState.ts");
  const project = store.store.getCurrent();
  const preferred = editor.editorState.get().currentMapId;
  // 씬이 그린 맵이 아니라 **존재하는** 맵을 고른다. 편집 상태의 currentMapId 는
  // 예제 프로젝트를 갈아끼운 직후 옛 값이 남아 있을 수 있다.
  const mapId = preferred && project.maps[preferred] ? preferred : project.startMapId;
  store.store.update((draft) => {
    const map = draft.maps[mapId];
    map.locations = [{ id: "loc1", name: "광장", x: 40, y: 40, w: 12, h: 10 }];
    map.events = [
      ...map.events,
      {
        id: "ev_overlap_npc",
        name: "겹친 NPC",
        x: 44,
        y: 44,
        trigger: { kind: "action" },
        commands: [],
        pages: [{ id: "p1", name: "p1", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [] }],
      },
    ];
  }, { scope: "map", mapId, label: "QA seed" });
  return { mapId };
});
checkTruthy("준비: 구역과 그 안의 이벤트를 만들었다", seeded.mapId);

// 씬·인스펙터가 그 맵을 봐야 한다. selectEditorMap 만으로는 currentMapId 가 옛 값으로
// 남을 수 있어(실측: map_blank_start 를 심었는데 이름을 계속 물었다) 상태를 직접 맞춘다.
await page.evaluate(async (mapId) => {
  const editor = await import("/src/editor/editorState.ts");
  editor.editorState.set({ currentMapId: mapId });
}, seeded.mapId);
await page.waitForFunction(async (mapId) => {
  const editor = await import("/src/editor/editorState.ts");
  return editor.editorState.get().currentMapId === mapId;
}, seeded.mapId, { timeout: 30000, polling: 150 });
await page.waitForTimeout(900);


await testId("map-location-layer-toggle").click();
await testId("map-location-inspector").waitFor({ state: "visible" });
await testId("map-location-list-loc1").click();
await testId("map-location-role-safeZone").waitFor({ state: "visible" });
check("1a. 역할 버튼이 인스펙터에 있다", (await testId("map-location-roles").count()) > 0, true);
await shot("01-role-picker", "구역을 고르면 인스펙터에 맵 시스템 역할(안전지대·경작지)이 있다.");

await testId("map-location-role-safeZone").click();
await page.waitForTimeout(350);
const afterSafe = await page.evaluate(async () => {
  const store = await import("/src/project/store.ts");
  const editor = await import("/src/editor/editorState.ts");
  const project = store.store.getCurrent();
  const mapId = editor.editorState.get().currentMapId;
  const map = project.maps[mapId];
  return { safeZones: map.safeZones ?? null, loc: map.locations?.[0] ?? null };
});
check("1b. 안전지대를 켜면 safeZones 로 투영된다", afterSafe.safeZones, [{ x: 40, y: 40, w: 12, h: 10 }]);
check("1c. 구역 태그에 역할이 남는다", afterSafe.loc?.tags, ["safeZone"]);
await shot("02-role-projected", "안전지대를 켜면 map.safeZones 에 구역 사각형이 투영된다.");

await page.evaluate(async () => {
  const state = await import("/src/editor/mapLocationLayerState.ts");
  state.resizeLocation("loc1", { x: 46, y: 46, w: 12, h: 10 });
});
await page.waitForTimeout(300);
const afterMove = await page.evaluate(async () => {
  const store = await import("/src/project/store.ts");
  const editor = await import("/src/editor/editorState.ts");
  const project = store.store.getCurrent();
  const map = project.maps[editor.editorState.get().currentMapId];
  return { safeZones: map.safeZones ?? null };
});
check("2. 구역을 옮겨도 투영이 하나만 남는다(유령 없음)", afterMove.safeZones, [{ x: 46, y: 46, w: 12, h: 10 }]);
await shot("03-role-follows-move", "구역을 옮기면 safeZones 사각형도 따라오고 옛 자리에는 남지 않는다.");

const handMade = await page.evaluate(async () => {
  const store = await import("/src/project/store.ts");
  const editor = await import("/src/editor/editorState.ts");
  const project = store.store.getCurrent();
  const mapId = editor.editorState.get().currentMapId;
  store.store.update((draft) => {
    const map = draft.maps[mapId];
    map.safeZones = [...(map.safeZones ?? []), { x: 5, y: 5, w: 2, h: 2 }];
  }, { scope: "map", mapId, label: "QA hand-made" });
  const state = await import("/src/editor/mapLocationLayerState.ts");
  state.setLocationRole("loc1", "safeZone");
  const project2 = store.store.getCurrent();
  return { safeZones: project2.maps[mapId].safeZones ?? null };
});
check("3. 출처 없는 사각형은 살아남는다", handMade.safeZones, [
  { x: 5, y: 5, w: 2, h: 2 },
  { x: 46, y: 46, w: 12, h: 10 },
]);

const npcPoint = await tilePoint(44, 44);
checkTruthy("4a. 겹친 NPC 의 화면 좌표를 얻었다", npcPoint);

await page.mouse.click(npcPoint.x, npcPoint.y);
await page.waitForTimeout(300);
const afterPlain = await page.evaluate(async () => {
  return { editorOpen: Boolean(document.querySelector("[data-testid='event-editor-modal']")) };
});
check("4b. 한 번 클릭은 이벤트를 열지 않는다", afterPlain.editorOpen, false);
await shot("04-plain-click-draws", "이벤트와 겹쳐도 한 번 클릭은 구역 그리기다 — 도구가 막히지 않는다.");

await page.keyboard.down("Alt");
await page.mouse.click(npcPoint.x, npcPoint.y);
await page.keyboard.up("Alt");
await page.waitForTimeout(800);
const afterAlt = await page.evaluate(async () => {
  const modal = document.querySelector("[data-testid='event-editor-modal']");
  const editor = await import("/src/editor/editorState.ts");
  return { open: Boolean(modal), selected: editor.editorState.get().selectedEventId };
});
check("4c. Alt+클릭은 그 칸의 이벤트를 연다", afterAlt.selected, "ev_overlap_npc");
check("4d. 이벤트 편집기가 실제로 열렸다", afterAlt.open, true);
await shot("05-alt-click-opens-event", "Alt+클릭은 겹친 이벤트를 편집기로 연다 — 도구를 끄지 않아도 된다.");

check("5. 예상 밖 페이지 오류 없음", errors, []);

const summary = [
  "# 로케이션 역할 + 이벤트 겹침 클릭 — 브라우저 증거",
  "",
  "- 실행: " + new Date().toISOString(),
  "- URL: " + baseUrl + "/?freshProject=1",
  "- 검사 " + checks.length + "건 중 실패 " + checks.filter((c) => !c.ok).length + "건",
  "",
  "## 검사",
  "",
  "| 단언 | 결과 |",
  "|---|---|",
  ...checks.map((c) => "| " + c.name + " | " + (c.ok ? "PASS" : "FAIL") + " |"),
  "",
  "## 즉시 확인할 PNG",
  "",
  "| 파일 | 무엇을 보여 주는가 |",
  "|---|---|",
  ...steps.map((s) => "| " + s.name + ".png | " + s.note + " |"),
  "",
];
await writeFile(output + "/SUMMARY.md", summary.join("\n"));
await writeFile(output + "/checks.json", JSON.stringify({ checks, errors, steps }, null, 2));
await browser.close();
console.log(JSON.stringify({ failed: checks.filter((c) => !c.ok).length, checks: checks.length, errors }, null, 2));
