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
const ISLAND_VIEW = { x: 28, y: 20 };     // 섬 윗줄(점자 띠) — 위(서쪽행 궤도 18~19)를 본다
const failures = [], lines = [];
const record = (ok, label, detail) => { lines.push(`- ${ok ? "PASS" : "FAIL"} — ${label}: ${detail}`); if (!ok) failures.push(label); };

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
const built = spawnSync("npx", ["--no-install", "tsx", "--import", "./tiledata/jp-city/refs/css-stub.mjs", "scripts/content/jp-city/qa/tram-fixture.mts", "--out", FIXTURE], { cwd: ROOT, encoding: "utf8" });
if (built.status !== 0) { console.error(built.stdout, built.stderr); process.exit(2); }
const body = await readFile(FIXTURE, "utf8");
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
  // 차는 레일 행(15~16·18~19)에 몸을 두지 않는다
  const onRail = t1.vehicles.filter((v) => v.id !== "jp-tram" && [15, 16, 18, 19].some((y) => y >= v.rect.y && y < v.rect.y + v.rect.h));
  record(onRail.length === 0, "차가 궤도 위를 달리지 않는다", onRail.length ? onRail.map((v) => `${v.id}@y${v.rect.y}`).join(" ") : "없음");
  const carRows = [...new Set(t1.vehicles.filter((v) => v.id !== "jp-tram").map((v) => `${v.dir}:y${v.rect.y}`))].join(" ");
  lines.push(`  (차 행: ${carRows})`);
  await page.screenshot({ path: join(OUT, "flow.png") });

  // 서쪽행 전차가 섬 옆에 서서 문 연다 → 「조사」로 탄다
  await page.evaluate(([m, x, y]) => window.__oprnDebug.teleport(m, x, y), [MAP, ISLAND_VIEW.x, ISLAND_VIEW.y]);
  let tram = null;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const t = await transit();
    tram = t.vehicles.find((v) => v.id === "jp-tram" && v.dir === "left" && v.open && v.stopAt !== null) ?? null;
    if (tram) break;
    await page.waitForTimeout(400);
  }
  record(!!tram, "서쪽행 전차가 안전지대 옆에 서서 문을 연다", tram ? `x ${tram.rect.x}~${tram.rect.x + tram.rect.w - 1} y ${tram.rect.y} 프레임 ${tram.sprite?.frame}` : "90초 안에 정차 없음");
  if (tram) {
    record(tram.rect.y === 18 && tram.rect.x <= ISLAND_VIEW.x && tram.rect.x + tram.rect.w > ISLAND_VIEW.x, "전차 몸이 섬 앞(궤도 18~19, 주인공 x 위)", `x ${tram.rect.x}~${tram.rect.x + tram.rect.w - 1}`);
    await page.screenshot({ path: join(OUT, "tram-stop.png") });
    await page.evaluate(() => window.__oprnInput.face("up"));
    await page.evaluate(() => window.__oprnInput.action());
    await page.waitForFunction(() => window.__oprnDebug.readState().currentMapId === "jp-city-town", undefined, { timeout: 15_000 }).catch(() => {});
    const s = await page.evaluate(() => window.__oprnDebug.readState());
    record(s.currentMapId === "jp-city-town", "「조사」로 전차를 타면 동네 역 앞으로", `${s.currentMapId} (${s.x},${s.y})`);
  }
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
const report = ["# 노면전차 거리 런타임 QA", "", `판정: **${failures.length ? "실패" : "통과"}**`, "", ...lines, "", "증거: `flow.png`(차·전차 흐름) · `tram-stop.png`(섬 옆에 선 전차)"].join("\n");
await writeFile(join(OUT, "SUMMARY.md"), report + "\n");
console.log(report);
process.exit(failures.length ? 1 : 0);
