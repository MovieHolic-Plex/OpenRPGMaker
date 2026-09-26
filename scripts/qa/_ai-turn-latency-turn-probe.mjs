#!/usr/bin/env node
// 턴 단위 실측 프로브 — 실제 편집기에서 **실제 모델**로 한 턴을 돌리고, 그 턴이 기록한 단계별 소요를 읽는다.
//
// 왜(2026-09-26): 모델 콜 하나는 ~2초인데 사용자는 "몇 분"을 겪는다. 그 차이는 턴 안의 **단계 수와 직렬성**
// 에서 온다 — 그래서 스테이지별 벽시계가 필요하다. 이 프로브는 편집기 브리지(window.__oprnAiBridge)로
// 턴을 실제로 돌리고, DEV 디스크 미러(output/ai-activity/)에 남은 그 턴의 timing 레코드를 표로 찍는다.
//
// 전제: 이 워크트리의 dev 서버가 떠 있어야 한다 — `npm run dev:worktree` (고정 포트는 .env.local).
//   QA_BASE_URL=http://127.0.0.1:9901 node scripts/qa/_ai-turn-latency-turn-probe.mjs
//
// 옵션: --base URL / --prompt "..." / --out FILE / --timeout-ms N / --keep-open
// 증거: verify-shots/ai-turn-latency/turn.json + turn.png
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { chromium } from "playwright";

const ROOT = resolve(process.cwd());
const DEFAULT_BASE = process.env.QA_BASE_URL ?? "http://127.0.0.1:9901";
const OUT_DIR = join(ROOT, "verify-shots", "ai-turn-latency");
const MIRROR_DIR = join(ROOT, "output", "ai-activity");
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) { args[key] = true; continue; }
    args[key] = next;
    i += 1;
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const base = String(args.base ?? DEFAULT_BASE);
const prompt = String(args.prompt ?? "현재 맵의 좌상단 빈 칸 하나에 흙길 한 칸만 놓고, 무엇을 했는지 한 줄로 보고하세요.");
const timeoutMs = Number(args["timeout-ms"] ?? 900_000);
// --label before|after — 전/후를 덮어쓰지 않고 나란히 남긴다(증거 파일 이름이 곧 주장의 근거다).
const label = typeof args.label === "string" && args.label.trim() ? `-${args.label.trim().replace(/[^a-z0-9_-]/gi, "")}` : "";
const RECORD_NAME = `turn${label}.json`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function log(line) {
  process.stdout.write(`${line}\n`);
}

/** DEV 미러에서 이번 턴의 행을 찾는다. 미러가 없으면 null(기록 경로 자체가 안 돈 것). */
function readMirroredTurn(sinceMs) {
  const latestPath = join(MIRROR_DIR, "latest.json");
  try {
    const latest = JSON.parse(readFileSync(latestPath, "utf8"));
    const at = Date.parse(latest.at ?? "");
    if (Number.isFinite(at) && at >= sinceMs - 60_000) return latest;
  } catch {
    /* 최신 1건이 없으면 index 를 본다 */
  }
  try {
    const index = JSON.parse(readFileSync(join(MIRROR_DIR, "index.json"), "utf8"));
    const rows = Array.isArray(index) ? index : (index.entries ?? []);
    const candidates = rows.filter((row) => {
      const at = Date.parse(row.at ?? "");
      return Number.isFinite(at) && at >= sinceMs - 60_000 && (row.channel === "pi" || row.channel === "chat");
    });
    return candidates.at(-1) ?? null;
  } catch {
    return null;
  }
}

function formatTiming(row) {
  const timing = row?.timing;
  if (!timing) return "timing 없음 — 계측 배선이 이 턴에 닿지 않았다(applied 여부: " + String(row?.result?.stoppedReason ?? "?") + ")";
  const stages = (timing.stages ?? []).map((stage) => `${stage.name}=${stage.ms}ms`).join(" · ");
  return `total=${timing.totalMs}ms · ${stages}`;
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
page.on("pageerror", (error) => log(`[page error] ${String(error.message).slice(0, 200)}`));
page.on("console", (message) => { if (message.type() === "error") log(`[page console] ${message.text().slice(0, 200)}`); });

const record = { base, prompt, startedAt: new Date().toISOString(), bootMs: null, turnMs: null, ok: null, status: null, error: null, timing: null, mirrorRow: null };

try {
  const bootStarted = Date.now();
  await page.goto(`${base}/?blankProject=1`, { waitUntil: "domcontentloaded", timeout: 180_000 });
  await page.waitForFunction(() => typeof window.__oprnAiBridge?.status === "function" && window.__oprnAiBridge.status().panelMounted === true, null, { timeout: 180_000 });
  record.bootMs = Date.now() - bootStarted;
  log(`editor ready in ${record.bootMs}ms (${base})`);
  const statusBefore = await page.evaluate(() => window.__oprnAiBridge.status());
  log(`status before: ${JSON.stringify(statusBefore).slice(0, 200)}`);
  if (args["boot-only"]) {
    // 부팅 준비도만 확인하는 모드 — 실제 턴을 태우지 않는다(모델 비용 0).
    await page.screenshot({ path: join(OUT_DIR, "turn.png"), fullPage: false });
    record.status = statusBefore;
    record.ok = statusBefore?.panelMounted === true;
    log(`boot-only: panelMounted=${statusBefore?.panelMounted} ready=${statusBefore?.ready}`);
  } else {
  const started = Date.now();
  // send() 는 패널 핸들러를 부른다 — 턴이 끝날 때까지 기다리지 않을 수 있으므로 turnBusy 전이를 함께 본다.
  await page.evaluate((text) => { void window.__oprnAiBridge.send(text).catch(() => undefined); }, prompt);
  let sawBusy = false;
  let finishedAt = null;
  while (Date.now() - started < timeoutMs) {
    const status = await page.evaluate(() => window.__oprnAiBridge?.status?.() ?? null);
    if (status?.turnBusy === true) sawBusy = true;
    if (sawBusy && status?.turnBusy === false) { finishedAt = Date.now(); record.status = status; break; }
    if (!sawBusy && Date.now() - started > 30_000) {
      // 30초 안에 busy 가 안 서면 전송이 거부된 것이다(설정 미비·슬롯 점유).
      record.error = `턴이 시작되지 않았다(status=${JSON.stringify(status).slice(0, 160)})`;
      break;
    }
    await sleep(1000);
  }
  record.turnMs = finishedAt ? finishedAt - started : null;
  log(`turn finished: ${record.turnMs === null ? "TIMEOUT/거부" : `${record.turnMs}ms`} sawBusy=${sawBusy}`);
  await page.screenshot({ path: join(OUT_DIR, "turn.png"), fullPage: false });
  const mirrored = readMirroredTurn(started);
  record.mirrorRow = mirrored ? { at: mirrored.at, channel: mirrored.channel, instruction: String(mirrored.instruction ?? "").slice(0, 80), timing: mirrored.timing ?? null } : null;
  record.timing = mirrored?.timing ?? null;
  log(`mirror: ${formatTiming(mirrored)}`);
  record.ok = record.turnMs !== null && Boolean(mirrored);
  }
} catch (error) {
  record.error = String(error?.message ?? error);
  log(`FAILED: ${record.error}`);
} finally {
  record.finishedAt = new Date().toISOString();
  mkdirSync(dirname(join(OUT_DIR, RECORD_NAME)), { recursive: true });
  writeFileSync(join(OUT_DIR, RECORD_NAME), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  if (!args["keep-open"]) await browser.close();
  log(`evidence: verify-shots/ai-turn-latency/${RECORD_NAME}`);
  log(record.ok ? "TURN_PROBE_OK" : "TURN_PROBE_FAILED");
}