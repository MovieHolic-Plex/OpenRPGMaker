// 노면전차 거리 런타임 QA — 출하 player.html 에서 «복선 전차가 두 방향으로 달리고, 차는 양쪽 일방 차로로만 다니며(레일 위 금지),
// 서쪽행 전차가 안전지대 옆에 서서 문을 열고, 섬에서 「조사」하면 탄다, 지하철 출입구 계단은 콘코스로 간다».
//   unshare -rn sh -c 'ip link set lo up; node scripts/content/jp-city/qa/tram-street.probe.mjs'
// 증거: verify-shots/jp-city/tram-runtime/{SUMMARY.md,*.png}
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startPlayerQaServer } from "../../../lib/runtimeQaRun.mjs";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const OUT = join(ROOT, "verify-shots/jp-city/tram-runtime");
const FIXTURE = "/tmp/oprn-tram-fixture.json";
const PROJECT_URL = "/__qa/tram.json";
const MAP = "jp-city-tram-street";
const ISLAND_W = { x: 28, y: 22 };        // 서쪽행 섬 윗줄(점자 띠) — 위(서쪽행 궤도 20~21)를 본다
const ISLAND_E = { x: 12, y: 17 };        // 동쪽행 섬(가운데 띠) 윗줄 점자 띠 — 위(동쪽행 궤도 15~16)를 본다
const TRACK_N = 15, TRACK_S = 20;
const CW = [18, 21];                      // 횡단보도 열 — 정차 스크린샷에 차가 횡단보도 위에 서 있지 않을 때 찍는다
const failures = [], lines = [];
const record = (ok, label, detail) => { lines.push(`- ${ok ? "PASS" : "FAIL"} — ${label}: ${detail}`); if (!ok) failures.push(label); };

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const built = spawnSync("npx", ["--no-install", "tsx", "--import", "./tiledata/jp-city/refs/css-stub.mjs", "scripts/content/jp-city/qa/tram-fixture.mts", "--out", FIXTURE], { cwd: ROOT, encoding: "utf8" });
if (built.status !== 0) { console.error(built.stdout, built.stderr); process.exit(2); }
const body = await readFile(FIXTURE, "utf8");
// 섬에 선 주인공 몸(발 칸 + 머리 칸) 위로 4층(가선 등)이 지나가지 않는다 — 3/4 에서 가선이 승객 얼굴을 긋던 관문 지적
{
  const mp = JSON.parse(body).maps[MAP];
  const l4 = (x, y) => (mp.upperOverlayTiles?.[y * mp.width + x] ?? -1) >= 0;   // 빈 칸 = -1
  const hits = [];
  for (const [label, isl] of [["서쪽행 섬", { x0: 22, x1: 33, y: ISLAND_W.y }], ["동쪽행 섬", { x0: 6, x1: 17, y: ISLAND_E.y }]])
    for (let x = isl.x0; x <= isl.x1; x++) for (const y of [isl.y, isl.y - 1]) if (l4(x, y)) hits.push(`${label}(${x},${y})`);
  record(hits.length === 0, "섬 위 승객 몸(발·머리 칸)에 4층 가선이 겹치지 않는다", hits.length ? hits.slice(0, 6).join(" ") : "없음");
  // 정보: 섬 아랫줄(난간·표지) 3층 시설 위를 지나는 4층 — 3/4 투영(가선 높이)으로 의도한 겹침, 몸 칸 검사와 따로 센다
  const l3 = (x, y) => (mp.upperTiles?.[y * mp.width + x] ?? -1) >= 0;
  const below = [];
  for (const [label, isl] of [["서쪽행 섬", { x0: 22, x1: 33, y: ISLAND_W.y + 1 }], ["동쪽행 섬", { x0: 6, x1: 17, y: ISLAND_E.y + 1 }]])
    for (let x = isl.x0; x <= isl.x1; x++) if (l4(x, isl.y) && l3(x, isl.y)) below.push(`${label}(${x},${isl.y})`);
  lines.push(`  (정보 — 섬 아랫줄 시설 위를 지나는 4층 가선 ${below.length}칸${below.length ? `: ${below[0]} … ${below[below.length - 1]}` : ""} · 3/4 투영으로 의도한 겹침, 승객 몸 칸은 위 검사)`);
}
const server = await startPlayerQaServer();
let browser;
try {
  browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
  const page = await browser.newPage();
  const log = [];
  page.on("pageerror", (e) => log.push(String(e?.message ?? e).split("\n")[0]));
  await page.setViewportSize({ width: 960, height: 720 });
  await page.addInitScript((u) => { try { localStorage.clear(); } catch { /* 없음 */ } window.__OPENRPG_BOOT__ = { projectUrl: u, saveNamespace: "runtime-qa:tram", qaInstrumentation: true }; }, PROJECT_URL);
  await page.route(`**${PROJECT_URL}`, (route) => route.fulfill({ status: 200, contentType: "application/json", body }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
  await page.keyboard.press("Enter");
  await page.waitForSelector("[data-testid='title-screen']", { state: "detached", timeout: 90_000 });
  await page.waitForFunction(() => typeof window.__oprnTransit === "function" && window.__oprnTransit()?.vehicles?.some((v) => v.sprite), undefined, { timeout: 90_000 });
  // 증거 사진은 필드 HUD(하트) 없이 — 거리·매표기·간판을 가리지 않게
  await page.addStyleTag({ content: "[data-testid='field-hud']{visibility:hidden!important}" });
  const transit = () => page.evaluate(() => window.__oprnTransit());
  const t0 = await transit();
  record(t0.routes.length === 4, "노선 4개(차 동·서, 전차 동·서)", t0.routes.join(", "));
  await page.waitForTimeout(1500);
  const t1 = await transit();
  const dx = { tram: { right: [], left: [] }, car: { right: [], left: [] } };
  for (const a of t0.vehicles) {
    const b = t1.vehicles.find((v) => v.key === a.key);
    if (!b || a.open || b.open || b.blockedSec > a.blockedSec) continue;
    (a.id === "jp-tram" ? dx.tram : dx.car)[a.dir]?.push(b.rect.x - a.rect.x);
  }
  const med = (xs) => (xs.length ? [...xs].sort((p, q) => p - q)[Math.floor(xs.length / 2)] : 0);
  record(dx.car.right.length > 0 && med(dx.car.right) > 1 && dx.car.left.length > 0 && med(dx.car.left) < -1, "차가 양쪽 일방 차로로 달린다", `동쪽행 ${dx.car.right.length}대 Δx ${med(dx.car.right).toFixed(2)} · 서쪽행 ${dx.car.left.length}대 Δx ${med(dx.car.left).toFixed(2)}`);
  // 차는 레일 행에 몸을 두지 않는다
  const onRail = t1.vehicles.filter((v) => v.id !== "jp-tram" && [TRACK_N, TRACK_N + 1, TRACK_S, TRACK_S + 1].some((y) => y >= v.rect.y && y < v.rect.y + v.rect.h));
  record(onRail.length === 0, "차가 궤도 위를 달리지 않는다", onRail.length ? onRail.map((v) => `${v.id}@y${v.rect.y}`).join(" ") : "없음");
  const carRows = [...new Set(t1.vehicles.filter((v) => v.id !== "jp-tram").map((v) => `${v.dir}:y${v.rect.y}`))].join(" ");
  lines.push(`  (차 행: ${carRows})`);
  await page.screenshot({ path: join(OUT, "flow.png") });

  // 두 방향 전차가 각자 섬 옆에 서서 문 연다 → 섬에서 「조사」로 탄다
  const board = async (dir, view, face, trackY, shotName, dest) => {
    await page.evaluate(([m, x, y]) => window.__oprnDebug.teleport(m, x, y), [MAP, view.x, view.y]);
    let tram = null;
    const deadline = Date.now() + 100_000;
    while (Date.now() < deadline) {
      const t = await transit();
      tram = t?.vehicles.find((v) => v.id === "jp-tram" && v.dir === dir && v.open && v.stopAt !== null) ?? null;
      if (tram) break;
      await page.waitForTimeout(400);
    }
    const label = dir === "left" ? "서쪽행" : "동쪽행";
    record(!!tram, `${label} 전차가 섬 옆에 서서 문을 연다`, tram ? `x ${tram.rect.x}~${tram.rect.x + tram.rect.w - 1} y ${tram.rect.y} 프레임 ${tram.sprite?.frame}` : "100초 안에 정차 없음");
    if (!tram) return;
    record(tram.rect.y === trackY && tram.rect.x <= view.x && tram.rect.x + tram.rect.w > view.x, `${label} 전차 몸이 섬 앞(궤도 ${trackY}~${trackY + 1}, 주인공 x)`, `x ${tram.rect.x}~${tram.rect.x + tram.rect.w - 1}`);
    // 정차 증거는 횡단보도 위에 차가 없을 때 찍는다(빨간 보행 신호 밑 횡단보도에 차가 서 있는 그림은 오해를 부른다)
    const clearUntil = Date.now() + 6000;
    let cwCars = [];
    while (Date.now() < clearUntil) {
      const t = await transit();
      cwCars = t.vehicles.filter((v) => v.id !== "jp-tram" && v.rect.x <= CW[1] && v.rect.x + v.rect.w - 1 >= CW[0]);
      if (!cwCars.length) break;
      await page.waitForTimeout(250);
    }
    lines.push(`  (${label} 정차 사진 — 횡단보도 위 차: ${cwCars.length ? cwCars.map((v) => `${v.id}@x${v.rect.x}`).join(" ") : "없음"})`);
    await page.screenshot({ path: join(OUT, shotName) });
    await page.evaluate((f) => window.__oprnInput.face(f), face);
    await page.evaluate(() => window.__oprnInput.action());
    await page.waitForFunction((id) => window.__oprnDebug.readState().currentMapId === id, dest.mapId, { timeout: 15_000 }).catch(() => {});
    const s = await page.evaluate(() => window.__oprnDebug.readState());
    record(s.currentMapId === dest.mapId, `「조사」로 ${label} 전차를 타면 ${dest.label}`, `${s.currentMapId} (${s.x},${s.y})`);
  };
  await board("left", ISLAND_W, "up", TRACK_S, "tram-stop.png", { mapId: "jp-city-town", label: "동네 역 앞(駅前)으로" });
  await board("right", ISLAND_E, "up", TRACK_N, "tram-stop-e.png", { mapId: "jp-city-school", label: "학교 앞(学校前)으로" });
  // 지하철 출입구 계단 → 콘코스
  await page.evaluate(([m]) => window.__oprnDebug.teleport(m, 20, 10), [MAP]);
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__oprnInput.face("up"));
  await page.keyboard.down("ArrowUp"); await page.waitForTimeout(450); await page.keyboard.up("ArrowUp");
  await page.waitForFunction(() => window.__oprnDebug.readState().currentMapId === "jp-city-station-concourse", undefined, { timeout: 10_000 }).catch(() => {});
  const s2 = await page.evaluate(() => window.__oprnDebug.readState());
  record(s2.currentMapId === "jp-city-station-concourse", "지하철 출입구 계단으로 들어가면 콘코스", `${s2.currentMapId} (${s2.x},${s2.y})`);
  // 콘코스 → 개찰 통로(15열) 걸어서 통과 → 승강장 계단 남쪽 입구로 내려가 승강장 → 승강장 올라가는 계단 → 콘코스 계단 입구 앞(15행)
  const CONC = "jp-city-station-concourse", PLAT = "jp-city-station-platform";
  /** 한 칸씩 걷기 — 입력 계층에 방향 탭 하나(키보드와 같은 계약: dir(d)→dir(null) 이 한 걸음), 밟는 이동 이벤트를 칸마다 확인한다. */
  const DIRS = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
  const steps = async (key, until, n = 6) => {
    let st;
    for (let i = 0; i < n; i++) {
      await page.evaluate((d) => { window.__oprnInput.dir(d); window.__oprnInput.dir(null); }, DIRS[key]);
      await page.waitForTimeout(700);
      st = await page.evaluate(() => window.__oprnDebug.readState());
      if (until(st)) break;
    }
    return st;
  };
  // 입력 계층 방향 탭만으로 점자 길을 칸마다 따라간다: →(13…15,4) ↓(15,5…15) ←(14,15)(13,15) ↑ 계단 입구(13,14) = 승강장
  // 지상 출입구로 들어온 도착 칸(12,4)에서 그대로 걷는다 — 4행 → 꺾임 (15,4) → 15열(개찰 통로) → 15행 → 계단 입구 앞 (13,15)
  const trail = [`${s2.x},${s2.y}`];
  const stepTo = async (key, want) => {
    const st = await steps(key, (q) => q.currentMapId !== CONC || (q.x === want[0] && q.y === want[1]), 2);   // 방향만 바뀌는 첫 탭 대비 2번까지
    trail.push(`${st.x},${st.y}`);
    return st.currentMapId === CONC && st.x === want[0] && st.y === want[1];
  };
  let okTrail = s2.currentMapId === CONC && s2.x === 12 && s2.y === 4;
  for (const x of [13, 14, 15]) if (okTrail) okTrail = await stepTo("ArrowRight", [x, 4]);
  for (let y = 5; y <= 15 && okTrail; y++) okTrail = await stepTo("ArrowDown", [15, y]);   // 9행 = 개찰 통로 15열
  for (const x of [14, 13]) if (okTrail) okTrail = await stepTo("ArrowLeft", [x, 15]);
  record(okTrail, "콘코스 점자 길을 방향 입력으로 칸마다 걷는다(출입구 도착 (12,4) → 꺾임 (15,4) → 개찰 통로 15열 → 계단 입구 앞 15행)", trail.join(" → "));
  await page.evaluate(() => window.__oprnInput.face("up"));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, "concourse-stairs.png") });   // (13,15) 경고 블록 위, 계단을 본다
  const d = await steps("ArrowUp", (st) => st.currentMapId === PLAT, 3);
  record(d.currentMapId === PLAT, "콘코스 계단 남쪽 입구(13,14)를 밟으면 승강장", `${d.currentMapId} (${d.x},${d.y})`);
  if (d.currentMapId === PLAT) {
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT, "platform-arrive.png") });
    const u = await steps("ArrowUp", (st) => st.currentMapId === CONC, 3);
    record(u.currentMapId === CONC && u.y === 15 && (u.x === 12 || u.x === 13), "승강장 올라가는 계단 → 콘코스 계단 입구 앞 칸(15행)", `${u.currentMapId} (${u.x},${u.y})`);
    await page.waitForTimeout(500);
    const back = await steps("ArrowLeft", (st) => st.x <= (u.x ?? 0) - 1, 1);   // 도착 칸에서 한 걸음 — 도착 사진이 진입 사진과 같은 프레임이 되지 않게
    lines.push(`  (복귀 뒤 한 걸음: (${back.x},${back.y}))`);
    await page.screenshot({ path: join(OUT, "concourse-return.png") });
    const [h1, h2] = await Promise.all(["concourse-stairs.png", "concourse-return.png"].map(async (f) => createHash("sha256").update(await readFile(join(OUT, f))).digest("hex").slice(0, 12)));
    record(h1 !== h2, "진입 사진과 복귀 사진이 다른 프레임", `${h1} / ${h2}`);
  }
  if (log.length) lines.push("", "페이지 오류:", ...log.slice(0, 8).map((l) => `- ${l}`));
} catch (error) {
  record(false, "probe 완주", String(error?.stack ?? error).split("\n").slice(0, 3).join(" | "));
} finally {
  await browser?.close();
  await server.close();
}
const report = ["# 노면전차 거리 런타임 QA", "", `판정: **${failures.length ? "실패" : "통과"}**`, "", ...lines, "", "증거: `flow.png`(차·전차 흐름) · `tram-stop.png`(서쪽행 섬 옆 전차) · `tram-stop-e.png`(동쪽행 섬 옆 전차) · `concourse-stairs.png`(점자 길 끝 경고 블록 위에서 계단을 봄) · `platform-arrive.png`(승강장 도착) · `concourse-return.png`(승강장에서 올라와 한 걸음)"].join("\n");
await writeFile(join(OUT, "SUMMARY.md"), report + "\n");
console.log(report);
process.exit(failures.length ? 1 : 0);
