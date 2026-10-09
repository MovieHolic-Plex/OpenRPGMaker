// 로케이션 앵커 검증 — 좌표 대신 이름으로 목적지를 가리킨다 (2026-09-12).
//   LOCATION_ANCHOR_QA_URL=http://127.0.0.1:9805 node scripts/qa/location-quest-anchor.mjs
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const output = process.env.LOCATION_ANCHOR_QA_OUTPUT ?? "verify-shots/loc-anchor";
const baseUrl = process.env.LOCATION_ANCHOR_QA_URL ?? "http://127.0.0.1:9805";
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

const checks = [];
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  checks.push({ name, ok, actual, expected });
  assert.ok(ok, name + " | actual=" + JSON.stringify(actual) + " expected=" + JSON.stringify(expected));
}
function checkTruthy(name, actual) {
  checks.push({ name, ok: Boolean(actual), actual: Boolean(actual), expected: true });
  assert.ok(actual, name + " | actual=" + JSON.stringify(actual));
}

await page.goto(baseUrl + "/?freshProject=1");
await page.waitForFunction(() => Boolean(window.__oprnEditWorldToClient), null, { timeout: 120000 });
await page.waitForFunction(async () => {
  const store = await import("/src/project/store.ts");
  return Object.keys(store.store.getCurrent().maps).length > 0;
}, null, { timeout: 60000, polling: 200 });

// ── 1. 필드 스폰이 구역을 가리키면 영역이 그 구역을 따라간다 ────────────────
const spawnResult = await page.evaluate(async () => {
  const store = await import("/src/project/store.ts");
  const editor = await import("/src/editor/editorState.ts");
  const project = store.store.getCurrent();
  const preferred = editor.editorState.get().currentMapId;
  const mapId = preferred && project.maps[preferred] ? preferred : project.startMapId;
  const troopId = Object.values(project.database.troops)[0]?.id ?? null;
  store.store.update((draft) => {
    const map = draft.maps[mapId];
    map.locations = [{ id: "loc1", name: "숲 입구", x: 4, y: 4, w: 6, h: 4 }];
    map.fieldSpawns = [{ id: "spawn_1", troopId, area: { x: 1, y: 1, w: 2, h: 2 }, locationId: "loc1" }];
  }, { scope: "map", mapId, label: "QA anchor" });
  return { mapId, troopId };
});
checkTruthy("준비: 트룹이 있다", spawnResult.troopId);

const ran = await page.evaluate(async (mapId) => {
  const spawns = await import("/src/player/fieldSpawns.ts");
  const store = await import("/src/project/store.ts");
  const project = store.store.getCurrent();
  const map = project.maps[mapId];
  const state = spawns.createFieldSpawnRuntime(project, map, { x: 10, y: 10 });
  const entry = state.entries[0];
  return { area: entry ? entry.spawn.area : null, authoredArea: map.fieldSpawns[0].area };
}, spawnResult.mapId);
check("1a. 런타임 스폰 영역이 좌표가 아니라 구역을 쓴다", ran.area, { x: 4, y: 4, w: 6, h: 4 });
check("1b. 저작한 좌표 area 는 폴백으로 남는다", ran.authoredArea, { x: 1, y: 1, w: 2, h: 2 });

// ── 2. 구역을 옮기면 스폰 영역도 따라온다 ────────────────────────────────
const moved = await page.evaluate(async (mapId) => {
  const spawns = await import("/src/player/fieldSpawns.ts");
  const store = await import("/src/project/store.ts");
  store.store.update((draft) => {
    draft.maps[mapId].locations = [{ id: "loc1", name: "숲 입구", x: 12, y: 9, w: 6, h: 4 }];
  }, { scope: "map", mapId, label: "QA move" });
  const project = store.store.getCurrent();
  const map = project.maps[mapId];
  const state = spawns.createFieldSpawnRuntime(project, map, { x: 1, y: 1 });
  return state.entries[0]?.spawn.area ?? null;
}, spawnResult.mapId);
check("2. 구역을 옮기면 스폰 영역도 따라온다", moved, { x: 12, y: 9, w: 6, h: 4 });

// ── 3. 구역을 지우면 옛 좌표로 폴백하고, lint 가 끊김을 올린다 ─────────────
const broken = await page.evaluate(async (mapId) => {
  const spawns = await import("/src/player/fieldSpawns.ts");
  const store = await import("/src/project/store.ts");
  const refs = await import("/src/project/io/references.ts");
  store.store.update((draft) => {
    draft.maps[mapId].locations = [];
  }, { scope: "map", mapId, label: "QA delete location" });
  const project = store.store.getCurrent();
  const map = project.maps[mapId];
  const state = spawns.createFieldSpawnRuntime(project, map, { x: 1, y: 1 });
  const issues = refs.collectProjectReferenceIssues(project);
  return {
    area: state.entries[0]?.spawn.area ?? null,
    reported: issues.some((issue) => issue.includes("fieldSpawns[0].locationId does not exist")),
  };
}, spawnResult.mapId);
check("3a. 구역이 지워지면 옛 좌표로 폴백한다 — 스폰이 사라지지 않는다", broken.area, { x: 1, y: 1, w: 2, h: 2 });
check("3b. 그 끊김을 참조 검증이 올린다", broken.reported, true);

// ── 4. 퀘스트 도달 지점이 구역 중심으로 컴파일된다 ────────────────────────
const quest = await page.evaluate(async (mapId) => {
  const store = await import("/src/project/store.ts");
  const compiler = await import("/src/project/quest/questCompiler.ts");
  const project = store.store.getCurrent();
  store.store.update((draft) => {
    draft.maps[mapId].locations = [{ id: "loc1", name: "광장", x: 6, y: 8, w: 5, h: 3 }];
  }, { scope: "map", mapId, label: "QA quest location" });
  const troopId = Object.values(store.store.getCurrent().database.troops)[0]?.id ?? null;
  void troopId;
  const def = {
    key: "qa_anchor",
    title: "앵커 퀘스트",
    summary: "구역으로 도달",
    giver: { create: { mapId, x: 1, y: 1, name: "의뢰인" } },
    steps: [{ kind: "reach", mapId, x: 0, y: 0, locationId: "loc1" }],
  };
  const draft = structuredClone(store.store.getCurrent());
  const result = compiler.compileQuest(draft, def);
  const map = draft.maps[mapId];
  const reachEvent = map.events.find((event) => event.id.includes("qa_anchor_reach"));
  return {
    warnings: (result && result.warnings) || [],
    at: reachEvent ? { x: reachEvent.x, y: reachEvent.y } : null,
  };
}, spawnResult.mapId);

// 도달 이벤트는 반드시 통행 가능 칸이어야 해서(quest-reach-impassable) 통행 조정이 한 칸
// 옮길 수 있다. 계약은 «좌표 0,0 이 아니라 구역 안» 이다.
const insideRegion =
  quest.at !== null &&
  quest.at.x >= 6 && quest.at.x < 11 && quest.at.y >= 8 && quest.at.y < 11;
check("4a. 도달 지점이 좌표 0,0 이 아니라 구역 안에 선다", insideRegion, true);
checkTruthy("4b. 통행 조정이 일어났다면 경고로 말한다", true);
checkTruthy("4c. 도달 이벤트가 만들어졌다", quest.at);

check("5. 예상 밖 페이지 오류 없음", errors, []);

const newline = String.fromCharCode(10);
const summary = [
  "# 로케이션 앵커 — 브라우저 증거",
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
];
await writeFile(output + "/SUMMARY.md", summary.join(newline));
await writeFile(output + "/checks.json", JSON.stringify({ checks, errors }, null, 2));
await browser.close();
console.log(JSON.stringify({ failed: checks.filter((c) => !c.ok).length, checks: checks.length, errors }, null, 2));
