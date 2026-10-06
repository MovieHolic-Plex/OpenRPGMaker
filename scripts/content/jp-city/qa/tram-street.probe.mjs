// 노면전차 거리 런타임 QA — 출하 player.html 에서 «복선 전차가 두 방향으로 달리고, 차는 양쪽 일방 차로로만 다니며(레일 위 금지),
// 서쪽행 전차가 안전지대 옆에 서서 문을 열고, 섬에서 「조사」하면 탄다, 지하철 출입구 계단은 콘코스로 간다».
//   unshare -rn sh -c 'ip link set lo up; node scripts/content/jp-city/qa/tram-street.probe.mjs'
// 증거: verify-shots/jp-city/tram-runtime/{SUMMARY.md,*.png}
import { chromium } from "@playwright/test";
import { spawnSync } from "node:child_process";
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
  if (log.length) lines.push("", "페이지 오류:", ...log.slice(0, 8).map((l) => `- ${l}`));
} catch (error) {
  record(false, "probe 완주", String(error?.stack ?? error).split("\n").slice(0, 3).join(" | "));
} finally {
  await browser?.close();
  await server.close();
}
const report = ["# 노면전차 거리 런타임 QA", "", `판정: **${failures.length ? "실패" : "통과"}**`, "", ...lines, "", "증거: `flow.png`(차·전차 흐름) · `tram-stop.png`(서쪽행 섬 옆 전차) · `tram-stop-e.png`(동쪽행 섬 옆 전차)"].join("\n");
await writeFile(join(OUT, "SUMMARY.md"), report + "\n");
console.log(report);
process.exit(failures.length ? 1 : 0);
