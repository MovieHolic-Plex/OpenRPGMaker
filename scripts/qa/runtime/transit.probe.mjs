// 맵 위 탈것(차 흐름·버스) 비전 QA — 출하 player.html 에서 «정말 그려지고, 달리고, 주인공 앞에서 서고, 정류장에서 타는가».
//
//   node scripts/qa/runtime/transit.probe.mjs
//
// 픽스처는 transit-fixture.mts 가 조수 도구 set_map_transit(auto + 버스 정류장)로 小学校 맵에 깐다.
// 판정 축(하나라도 실패하면 exit 1):
//   1. 배선 — 노선 3개(동쪽행·서쪽행 차 흐름, 동쪽행 버스)가 런타임 시뮬레이션에 도달하고 탈것 스프라이트가 화면 좌표에 그려진다.
//   2. 흐름 — 1.5초 사이 같은 탈것(key)이 진행 방향으로 움직인다(동쪽행 +x, 서쪽행 −x).
//   3. 렌더 — 그 1.5초 사이 화면 픽셀이 실제로 달라진다.
//   4. 막힘 — 주인공을 동쪽행 차선 칸에 세우면 차가 그 앞에서 서고(몸이 주인공 칸을 덮지 않음, 막힌 초 증가).
//   5. 정류장 — 버스가 学校前 에 서서 문을 연다(*_open 프레임), 정문에서 버스를 보고 「조사」하면 board 맵으로 이동한다.
// 결과: verify-shots/runtime-qa/transit/{SUMMARY.md,*.png}
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import { startPlayerQaServer } from "../../lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const OUT = join(REPO_ROOT, "verify-shots/runtime-qa/transit");
const FIXTURE = join(OUT, "_fixture.json");
const PROJECT_URL = "/__qa/transit-project.json";
const VIEWPORT = { width: 960, height: 720 };
const SCHOOL = "jp-city-school";
const BLOCK_CELL = { x: 20, y: 44 };   // 동쪽행 차선 윗줄
const GATE_VIEW = { x: 36, y: 43 };    // 정문 열린 칸 — 아래(길)를 보면 버스 몸 (36,44)
const BOARD_MAP = "map_lantern_village";

const failures = [];
const lines = [];
const record = (ok, label, detail) => {
  lines.push(`- ${ok ? "PASS" : "FAIL"} — ${label}: ${detail}`);
  if (!ok) failures.push(`${label}: ${detail}`);
};

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const built = spawnSync("npx", ["--no-install", "tsx", "--import", "./tiledata/jp-city/refs/css-stub.mjs", "scripts/qa/runtime/transit-fixture.mts", "--out", FIXTURE], { cwd: REPO_ROOT, encoding: "utf8" });
if (built.status !== 0) { console.error(built.stdout, built.stderr); process.exit(2); }
lines.push("픽스처(조수 도구 set_map_transit 실물):", "```", built.stdout.trim(), "```", "");
const projectJson = await readFile(FIXTURE, "utf8");

const server = await startPlayerQaServer();
let browser;
try {
  browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const page = await browser.newPage();
  const log = [];
  page.on("pageerror", (e) => log.push(`pageerror: ${String(e?.message ?? e).split("\n")[0]}`));
  page.on("console", (m) => { if (m.type() === "error") log.push(`console: ${m.text()}`); });
  await page.setViewportSize(VIEWPORT);
  await page.addInitScript((projectUrl) => {
    try { localStorage.clear(); } catch { /* 없음 */ }
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: "runtime-qa:transit", qaInstrumentation: true };
  }, PROJECT_URL);
  await page.route(`**${PROJECT_URL}`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-testid='title-screen']", { state: "detached", timeout: 90_000 });
  await page.waitForFunction(() => typeof window.__oprnTransit === "function" && window.__oprnTransit()?.vehicles?.some((v) => v.sprite), undefined, { timeout: 90_000 });
  await page.waitForTimeout(800);

  const transit = () => page.evaluate(() => window.__oprnTransit());
  const state = () => page.evaluate(() => window.__oprnDebug.readState());
  const shot = async (name) => { const png = await page.screenshot(); await writeFile(join(OUT, name), png); return png; };

  // 1. 배선
  const t0 = await transit();
  const s0 = await state();
  record(s0.currentMapId === SCHOOL, "시작 맵", `${s0.currentMapId} (${s0.x},${s0.y})`);
  record(t0.routes.length === 3, "노선이 런타임에 도달", t0.routes.join(", "));
  const onMap = (v) => v.rect.x + v.rect.w > 0 && v.rect.x < 68 && v.rect.y + v.rect.h > 0 && v.rect.y < 48;
  const drawn = t0.vehicles.filter((v) => onMap(v) && v.sprite?.visible);
  record(drawn.length >= 3, "맵 위에 그려진 탈것", `${drawn.length}대 / 전체 ${t0.vehicles.length}대 — ${drawn.slice(0, 6).map((v) => `${v.id}@${v.rect.x.toFixed(1)},${v.rect.y}(${v.sprite.frame})`).join(" ")}`);
  const png0 = await shot("t0.png");

  // 2·3. 흐름·렌더
  await page.waitForTimeout(1500);
  const t1 = await transit();
  const png1 = await shot("t1.png");
  const moved = { right: [], left: [] };
  for (const a of t0.vehicles) {
    const b = t1.vehicles.find((v) => v.key === a.key);
    if (!b || a.open || b.open || b.blockedSec > a.blockedSec) continue;   // 정차·줄 선 차(버스 뒤)는 흐름 판정에서 뺀다
    if (a.dir === "right" || a.dir === "left") moved[a.dir].push(b.rect.x - a.rect.x);
  }
  const med = (xs) => (xs.length ? [...xs].sort((p, q) => p - q)[Math.floor(xs.length / 2)] : 0);
  record(moved.right.length > 0 && med(moved.right) > 1.5, "동쪽행이 동쪽으로 달린다", `안 막힌 ${moved.right.length}대 중앙값 Δx ${med(moved.right).toFixed(2)}칸/1.5초`);
  record(moved.left.length > 0 && med(moved.left) < -1.5, "서쪽행이 서쪽으로 달린다", `안 막힌 ${moved.left.length}대 중앙값 Δx ${med(moved.left).toFixed(2)}칸/1.5초`);
  const diff = pixelDelta(png0, png1);
  record(diff.changedRatio > 0.003, "화면이 실제로 달라진다", `변한 픽셀 ${(diff.changedRatio * 100).toFixed(2)}%`);

  // 4. 막힘 — 주인공을 동쪽행 차선에 세운다
  await page.evaluate(([m, x, y]) => window.__oprnDebug.teleport(m, x, y), [SCHOOL, BLOCK_CELL.x, BLOCK_CELL.y]);
  await page.waitForTimeout(9000);
  const t2 = await transit();
  const covering = t2.vehicles.filter((v) => BLOCK_CELL.x >= Math.floor(v.rect.x) && BLOCK_CELL.x < Math.ceil(v.rect.x + v.rect.w) && BLOCK_CELL.y >= v.rect.y && BLOCK_CELL.y < v.rect.y + v.rect.h);
  const waiting = t2.vehicles.filter((v) => v.dir === "right" && v.rect.y === 44 && v.rect.x + v.rect.w <= BLOCK_CELL.x + 0.01 && v.rect.x + v.rect.w > BLOCK_CELL.x - 1.5 && v.blockedSec > 1);
  record(covering.length === 0, "차가 주인공 칸을 덮지 않는다", covering.length ? covering.map((v) => `${v.id}@${v.rect.x.toFixed(1)}`).join(" ") : "없음");
  record(waiting.length >= 1, "주인공 바로 앞에서 차가 선다", waiting.map((v) => `${v.id} 꼬리..머리 x ${v.rect.x.toFixed(1)}~${(v.rect.x + v.rect.w).toFixed(1)} 막힘 ${v.blockedSec}초`).join(" ") || `동쪽행 ${t2.vehicles.filter((v) => v.dir === "right").map((v) => `${v.id}@${v.rect.x.toFixed(1)}`).join(" ")}`);
  await shot("blocked.png");

  // 5. 정류장 — 주인공을 정문 안으로 비키고 버스가 学校前 에 서기를 기다린다
  await page.evaluate(([m, x, y]) => window.__oprnDebug.teleport(m, x, y), [SCHOOL, GATE_VIEW.x, GATE_VIEW.y]);
  let bus = null;
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const t = await transit();
    bus = t.vehicles.find((v) => v.id === "jp-bus-city" && v.open && v.stopAt !== null) ?? null;
    if (bus) break;
    await page.waitForTimeout(400);
  }
  record(!!bus, "버스가 学校前 에 서서 문을 연다", bus ? `${bus.id} x ${bus.rect.x}~${bus.rect.x + bus.rect.w} y ${bus.rect.y} 프레임 ${bus.sprite?.frame}` : "60초 안에 정차 없음");
  if (bus) {
    record(bus.sprite?.frame === "right_open" || bus.sprite?.frame === "right", "정차 프레임", `${bus.sprite?.frame} (동쪽행 = 오른쪽 면 — 문은 왼쪽 면에만 있어 right_open = right 그림)`);
    await shot("bus-stop.png");
    await page.evaluate(() => window.__oprnInput.face("down"));
    await page.evaluate(() => window.__oprnInput.action());
    await page.waitForFunction((m) => window.__oprnDebug.readState().currentMapId === m, BOARD_MAP, { timeout: 15_000 }).catch(() => {});
    const s3 = await state();
    record(s3.currentMapId === BOARD_MAP, "「조사」로 버스를 타면 board 맵으로 간다", `${s3.currentMapId} (${s3.x},${s3.y})`);
    await page.waitForTimeout(800);
    await shot("boarded.png");
    const t3 = await transit();
    record(t3 === null || t3.vehicles.length === 0, "다른 맵에서는 탈것을 치운다", t3 ? `${t3.vehicles.length}대` : "시뮬레이션 없음");
  }
  if (log.length) lines.push("", "페이지 오류:", ...log.slice(0, 10).map((l) => `- ${l}`));
} catch (error) {
  record(false, "probe 완주", String(error?.stack ?? error).split("\n").slice(0, 4).join(" | "));
} finally {
  if (browser) await browser.close();
  await server.close();
}

const report = [
  "# 맵 위 탈것 비전 QA",
  "",
  `판정: **${failures.length === 0 ? "통과" : "실패"}**`,
  "",
  ...lines,
  "",
  "## 증거 파일",
  "",
  "- `t0.png`·`t1.png` — 1.5초 간격(차 흐름) · `blocked.png` — 주인공 앞에 선 차 · `bus-stop.png` — 学校前 버스 정차 · `boarded.png` — 탄 뒤 도착 맵",
].join("\n");
await writeFile(join(OUT, "SUMMARY.md"), `${report}\n`, "utf8");
console.log(report);
process.exit(failures.length > 0 ? 1 : 0);

function pixelDelta(a, b) {
  const pa = PNG.sync.read(a), pb = PNG.sync.read(b);
  let changed = 0;
  const n = Math.min(pa.data.length, pb.data.length) / 4;
  for (let i = 0; i < n; i += 1) {
    const k = i * 4;
    if (Math.abs(pa.data[k] - pb.data[k]) + Math.abs(pa.data[k + 1] - pb.data[k + 1]) + Math.abs(pa.data[k + 2] - pb.data[k + 2]) > 24) changed += 1;
  }
  return { changedRatio: changed / n };
}
