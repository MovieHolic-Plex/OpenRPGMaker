/**
 * 퍼즐 프리셋 실기 플레이 QA — 출하 플레이어(player.html, exportProjectStoreShim 경로)에서 프리셋마다 방 하나를 짓고
 * 실제 입력(방향키 걸음·조사 키·선택지)으로 풀어 본다. 프레임을 찍어 GIF·핵심 프레임(대기→해제 중→해제 후)을 남기고,
 * 해결 스위치가 실제로 켜졌는지·오답/리셋이 실제로 되돌리는지를 단언한다.
 *
 * 실행:
 *   ./node_modules/.bin/vite-node --script scripts/qa/jrpg-puzzle-play.mts -- [--only id,id] [--legacy] [--out dir]
 *
 * --legacy 를 주면 2026-10-19 까지의 16종(구 카탈로그)을 옛 방식(인접 칸 순간이동+조사)으로 푼다 — 적대 검수 증거용.
 * 기본은 품질 카탈로그(PUZZLE_PRESET_CATALOG 중 tier !== "legacy")를 프리셋이 실은 playtest 절차(진짜 걸음)로 푼다.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import { runTool } from "@/editor/tools/toolRunner";
import { PUZZLE_PRESET_CATALOG, type PuzzlePlayStep } from "@/editor/tools/puzzleAuthoringTools";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import type { GameMap } from "@/project/types";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";
import { initLocalProjectStore, openLocalProjectStore } from "../../electron/local-store/store";

declare global {
  interface Window {
    __OPENRPG_BOOT__?: Record<string, unknown>;
    __oprnDebug: {
      readState: () => { currentMapId: string; x: number; y: number; switches: Record<string, boolean>; variables: Record<string, number>; inventory: Record<string, number> };
      teleport: (mapId: string, x: number, y: number) => void;
    };
    __oprnInput: { dir: (dir: string | null) => void; face: (dir: string) => void; action: () => void };
    __oprnHooksScene?: unknown;
  }
}

const argv = process.argv.slice(2);
const argValue = (flag: string): string | undefined => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};
const LEGACY = argv.includes("--legacy");
/** 디버그: 프리셋 절차 대신 이 JSON 절차(PuzzlePlayStep[])로 푼다. */
const STEPS_OVERRIDE = argValue("--steps");
const ONLY = argValue("--only")?.split(",").map((s) => s.trim()).filter(Boolean);
const OUT = path.resolve(argValue("--out") ?? "/tmp/pz2/play");
const FRAMES = path.join(OUT, "frames");
fs.mkdirSync(FRAMES, { recursive: true });

/** 구 16종은 playtest 절차가 없다 — 이벤트 id 꼬리로 인접 칸에 서서 조사하는 옛 QA 방식으로 푼다. */
type LegacyStep = { readonly act: string; readonly choose?: readonly number[] } | { readonly touch: string };
const LEGACY_DRIVERS: Readonly<Record<string, readonly LegacyStep[]>> = {
  lever_secret_passage: [{ act: "lever", choose: [0] }],
  two_step_sequence: [{ act: "clue" }, { act: "console", choose: [0, 1] }],
  cathedral_organ_tuning: [{ act: "score" }, { act: "organ", choose: [0, 0] }],
  brazier_ignition_order: [{ act: "brazier_2" }, { act: "brazier_1" }, { act: "brazier_2" }, { act: "brazier_3" }],
  statue_pressure_plates: [{ touch: "plate_1" }, { touch: "plate_2" }],
  ice_conveyor_slide: [{ touch: "slide" }, { act: "diverter", choose: [0] }],
  time_gate_causality: [{ act: "past_altar", choose: [0] }, { act: "future_chest" }],
  dynamite_rock_blast: [{ act: "supply" }, { act: "boulder" }],
  riddle_mimic_chests: [{ act: "tablet" }, { act: "chest_true" }],
  sluice_lava_bridge: [{ act: "valve", choose: [0] }],
  stealth_guard_patrol: [{ act: "cache" }, { act: "bell", choose: [0] }, { act: "cache" }],
  boss_seal_monoliths: [{ act: "monolith_1" }, { act: "monolith_2" }, { act: "monolith_3" }],
  rolling_boulder_chasm: [{ act: "winch" }, { act: "stopper" }],
  mirror_beam_refraction: [{ act: "mirror_1" }, { act: "mirror_2" }],
  minecart_track_switch: [{ act: "track_switch" }, { act: "minecart" }],
  elemental_pedestal_swap: [{ act: "pedestal_1" }, { act: "pedestal_2" }, { act: "pedestal_3" }, { act: "pedestal_4" }],
};

interface Authored {
  readonly presetId: string;
  readonly mapId: string;
  readonly origin: { x: number; y: number };
  readonly roomOrigin: { x: number; y: number };
  readonly solveSwitchId: string;
  readonly events: ReadonlyArray<{ id: string; x: number; y: number }>;
  readonly steps: readonly PuzzlePlayStep[] | undefined;
}

const selected = PUZZLE_PRESET_CATALOG.filter((p) => (LEGACY ? p.index <= 16 : p.tier !== "legacy")).filter(
  (p) => !ONLY || ONLY.includes(p.id),
);
assert.ok(selected.length > 0, "no presets selected");

const ctx = { project: createBlankProject() };
const authored: Authored[] = [];
for (const preset of selected) {
  const mapId = `map_pz_${preset.id}`;
  const made = runTool(ctx, "create_map", { id: mapId, name: preset.title, width: 20, height: 15, tilesetId: "atlas_biome_interior" });
  assert.equal(made.ok, true, made.summary);
  const res = runTool(ctx, "author_map_puzzle", { mapId, presetId: preset.id, puzzleId: preset.id });
  assert.equal(res.ok, true, `${preset.id}: ${res.summary}`);
  const d = res.data as {
    origin: { x: number; y: number };
    roomOrigin?: { x: number; y: number };
    solveSwitchId: string;
    events: Array<{ id: string; x: number; y: number }>;
    playtest?: PuzzlePlayStep[];
  };
  authored.push({
    presetId: preset.id,
    mapId,
    origin: d.origin,
    roomOrigin: d.roomOrigin ?? { x: 0, y: 0 },
    solveSwitchId: d.solveSwitchId,
    events: d.events,
    steps: LEGACY ? undefined : STEPS_OVERRIDE ? (JSON.parse(STEPS_OVERRIDE) as PuzzlePlayStep[]) : d.playtest,
  });
}
ctx.project.startMapId = authored[0]!.mapId;
ctx.project.startPos = { ...authored[0]!.origin };
const sqliteDir = path.join(OUT, "canonical-project");
fs.rmSync(sqliteDir, { recursive: true, force: true });
const initStore = await initLocalProjectStore({ projectDir: sqliteDir });
const saved = await initStore.saveProject(ctx.project);
assert.equal(saved.kind, "saved", "project.sqlite save failed");
initStore.close();
const reopenedStore = await openLocalProjectStore({ projectDir: sqliteDir });
const snapshot = reopenedStore.loadSnapshot();
assert.ok(snapshot, "project.sqlite reload snapshot missing");
for (const a of authored) {
  const reloadedMap = snapshot.project.maps[a.mapId];
  assert.ok(reloadedMap, `reloaded project.sqlite missing map ${a.mapId}`);
  assert.equal(reloadedMap.events.length, a.events.length, `reloaded map ${a.mapId} event count mismatch`);
  assert.ok(snapshot.project.switches.some((s) => s.id === a.solveSwitchId), `reloaded project.sqlite missing solveSwitch ${a.solveSwitchId}`);
}
const sqliteRoundtrip = {
  sqliteFile: path.join(sqliteDir, "project.sqlite"),
  sha256: snapshot.sha256,
  revision: snapshot.revision,
  mapsVerified: authored.length,
  eventsVerified: authored.reduce((n, a) => n + a.events.length, 0),
};
reopenedStore.close();
fs.rmSync(sqliteDir, { recursive: true, force: true });
const projectJson = serialize(snapshot.project);
if (argv.includes("--sqlite-only")) {
  console.log(JSON.stringify(sqliteRoundtrip));
  process.exit(0);
}

const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu", "--disable-dev-shm-usage"] });
const pageErrors: string[] = [];
const results: Array<Record<string, unknown>> = [];
/** 실제로 내려받은 퍼즐 효과음 파일(주소·상태·sha256) — 「파일이 있다」가 아니라 플레이어가 받아 갔다는 증거. */
const sfxFetches: Array<{ file: string; status: number; bytes: number; sha256: string }> = [];

async function present(page: Page, id: string): Promise<boolean> {
  return (await page.locator(`[data-testid="${id}"]`).count()) > 0;
}

async function readVfx(page: Page): Promise<{ particles: number; shaking: boolean; flashing: boolean; running: boolean }> {
  return page.evaluate(() => {
    const scene = window.__oprnHooksScene as {
      running?: boolean;
      inputEnabled?: boolean;
      children?: { list?: unknown[] };
      cameras?: { main?: Record<string, { isRunning?: boolean }> };
    } | undefined;
    let particles = 0;
    for (const child of scene?.children?.list ?? []) {
      const c = child as { getAliveParticleCount?: () => number };
      if (typeof c.getAliveParticleCount === "function") particles += Number(c.getAliveParticleCount());
    }
    const main = scene?.cameras?.main;
    return {
      particles,
      shaking: Boolean(main?.shakeEffect?.isRunning),
      flashing: Boolean(main?.flashEffect?.isRunning),
      running: Boolean(scene?.running || scene?.inputEnabled === false),
    };
  });
}

try {
  const context = await browser.newContext({ viewport: { width: 640, height: 480 } });
  const page = await context.newPage();
  page.on("pageerror", (err) => pageErrors.push(String(err?.message ?? err)));
  page.on("response", (res) => {
    const m = /\/assets\/puzzle-sfx\/([^?#]+\.ogg)/.exec(res.url());
    if (!m) return;
    void res.body().then(
      (b) => sfxFetches.push({ file: m[1]!, status: res.status(), bytes: b.length, sha256: createHash("sha256").update(b).digest("hex") }),
      () => sfxFetches.push({ file: m[1]!, status: res.status(), bytes: -1, sha256: "" }),
    );
  });
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {}
    window.__OPENRPG_BOOT__ = { projectUrl: "/__runtime-qa/project.json", saveNamespace: "runtime-qa:puzzle-play", qaInstrumentation: true };
  });
  await page.route("**/__runtime-qa/project.json", (route) => route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 400_000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 400_000 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => Boolean(window.__oprnDebug?.readState?.()?.currentMapId), undefined, { timeout: 400_000 });
  for (let i = 0; i < 60; i += 1) {
    if (!(await present(page, "cinematic-sequence")) && !(await present(page, "dialogue-box")) && !(await present(page, "title-screen"))) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(150);
  }

  const state = () => page.evaluate(() => window.__oprnDebug.readState());

  for (const a of authored) {
    const dir = path.join(FRAMES, a.presetId);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    let frame = 0;
    const keyShots: Record<string, string> = {};
    let best = { score: -1, file: "" };
    const snap = async (): Promise<string> => {
      const file = path.join(dir, `${String(frame++).padStart(3, "0")}.png`);
      await page.screenshot({ path: file });
      return file;
    };
    const key = async (label: string): Promise<void> => {
      const file = path.join(OUT, `${a.presetId}-${label}.png`);
      await page.screenshot({ path: file });
      keyShots[label] = file;
      fs.copyFileSync(file, path.join(dir, `${String(frame++).padStart(3, "0")}.png`));
    };
    let sawVfx = false;
    let choiceQueue: number[] = [];
    let numberQueue: number[] = [];
    let presentQueue: string[] = [];
    /** 대사·선택지·숫자 입력을 넘기며 이벤트가 끝날 때까지 프레임을 찍는다. */
    const settle = async (initialMaxIdle = 4): Promise<void> => {
      let idle = 0;
      let maxIdle = initialMaxIdle;
      for (let i = 0; i < 220 && idle < maxIdle; i += 1) {
        const vfx = await readVfx(page);
        const hasUi =
          (await present(page, "dialogue-box")) ||
          (await present(page, "runtime-choices")) ||
          (await present(page, "runtime-input-number")) ||
          (await present(page, "present-item-scene"));
        const active = hasUi || vfx.running || vfx.particles > 0 || vfx.shaking || vfx.flashing;
        if (active) maxIdle = Math.max(maxIdle, 4);
        const file = active || i > 0 || initialMaxIdle > 1 ? await snap() : "";
        if (vfx.particles > 0 || vfx.shaking || vfx.flashing) {
          sawVfx = true;
          const score = vfx.particles + (vfx.shaking ? 40 : 0) + (vfx.flashing ? 40 : 0) + (hasUi ? 0 : 10_000);
          if (file && score > best.score) best = { score, file };
        }
        if (await present(page, "runtime-choices")) {
          idle = 0;
          const pick = choiceQueue.shift() ?? 0;
          await page.evaluate((idx) => (document.querySelector(`[data-testid="runtime-choice-${idx}"]`) as HTMLElement | null)?.click(), pick);
          await page.waitForTimeout(160);
          continue;
        }
        if ((await present(page, "runtime-input-number")) && numberQueue.length > 0) {
          idle = 0;
          await page.keyboard.type(String(numberQueue.shift()));
          await page.waitForTimeout(120);
          await snap();
          await page.keyboard.press("Enter");
          await page.waitForTimeout(160);
          continue;
        }
        if (await present(page, "present-item-scene")) {
          idle = 0;
          const want = presentQueue.shift();
          await page.evaluate((id) => {
            const btn = (id ? document.querySelector(`[data-testid="present-item-${id}"]`) : null) ?? document.querySelector('[data-testid="present-item-cancel"]');
            (btn as HTMLElement | null)?.click();
          }, want ?? "");
          await page.waitForTimeout(160);
          continue;
        }
        if (await present(page, "dialogue-box")) {
          idle = 0;
          await page.keyboard.press("Enter");
          await page.waitForTimeout(120);
          continue;
        }
        idle = vfx.running || vfx.particles > 0 || vfx.shaking || vfx.flashing ? 0 : idle + 1;
        await page.waitForTimeout(110);
      }
    };
    const room = (x: number, y: number) => ({ x: a.roomOrigin.x + x, y: a.roomOrigin.y + y });
    const teleport = async (x: number, y: number, face?: string): Promise<void> => {
      await page.evaluate(([m, tx, ty, f]) => {
        window.__oprnDebug.teleport(String(m), Number(tx), Number(ty));
        if (f) window.__oprnInput.face(String(f));
      }, [a.mapId, x, y, face ?? ""] as const);
      await page.waitForTimeout(350);
    };
    const DIRS: Record<string, { dx: number; dy: number; name: string }> = {
      U: { dx: 0, dy: -1, name: "up" },
      D: { dx: 0, dy: 1, name: "down" },
      L: { dx: -1, dy: 0, name: "left" },
      R: { dx: 1, dy: 0, name: "right" },
    };
    /** 한 칸 걸음 = 방향키를 누르고 칸이 바뀌거나(밀기 포함) 막힘이 확인될 때까지 기다린다. */
    const walk = async (moves: string): Promise<void> => {
      for (const ch of moves) {
        const d = DIRS[ch];
        assert.ok(d, `bad move ${ch}`);
        const before = await state();
        const moved = await page.evaluate(async (dirName) => {
          const b = window.__oprnDebug.readState();
          const scene = window.__oprnHooksScene as { moving?: boolean; playerHop?: unknown; playerSlide?: unknown } | undefined;
          window.__oprnInput.dir(dirName);
          const t0 = performance.now();
          let started = false;
          while (performance.now() - t0 < 1500) {
            await new Promise<void>((r) => requestAnimationFrame(() => r()));
            const s = window.__oprnDebug.readState();
            if (scene?.moving || scene?.playerHop || s.x !== b.x || s.y !== b.y || s.currentMapId !== b.currentMapId) {
              started = true;
              break;
            }
          }
          window.__oprnInput.dir(null);
          if (started) {
            const t1 = performance.now();
            // 빙판 미끄럼은 칸마다 이동 트윈이 끝나고 다음 칸을 잇는다 — 미끄럼이 끝날 때까지(두 프레임 연속 정지) 기다린다.
            let idle = 0;
            while (idle < 3 && performance.now() - t1 < 10_000) {
              await new Promise<void>((r) => requestAnimationFrame(() => r()));
              idle = scene?.moving || scene?.playerHop || scene?.playerSlide ? 0 : idle + 1;
            }
          }
          const after = window.__oprnDebug.readState();
          return after.x !== b.x || after.y !== b.y || after.currentMapId !== b.currentMapId;
        }, d.name);
        if (!moved) console.log(`   [${a.presetId}] blocked ${ch} at ${before.x},${before.y}`);
        if (frame % 1 === 0) await snap();
        await page.waitForTimeout(moved ? 70 : 40);
        await settle(1);
      }
    };
    const act = async (): Promise<void> => {
      await page.evaluate(() => window.__oprnInput.action());
      await page.waitForTimeout(120);
      await settle();
    };
    const standNextAndAct = async (suffix: string, choose: readonly number[] = []): Promise<void> => {
      const ev = a.events.find((e) => e.id.endsWith(`_${suffix}`));
      assert.ok(ev, `${a.presetId}: no event *_${suffix}`);
      const map: GameMap = ctx.project.maps[a.mapId]!;
      const cands = [
        { dx: 0, dy: 1, face: "up" },
        { dx: -1, dy: 0, face: "right" },
        { dx: 1, dy: 0, face: "left" },
        { dx: 0, dy: -1, face: "down" },
      ];
      const pick =
        cands.find((c) => {
          const x = ev.x + c.dx;
          const y = ev.y + c.dy;
          return x > 0 && y > 0 && x < map.width - 1 && y < map.height - 1 && !map.events.some((e) => e.x === x && e.y === y && e.pages?.[0]?.priority === "same");
        }) ?? cands[0]!;
      await teleport(ev.x + pick.dx, ev.y + pick.dy, pick.face);
      choiceQueue = [...choose];
      await act();
    };

    // 대기 화면: 시작점에서 한 장.
    await teleport(a.origin.x, a.origin.y, "up");
    await page.waitForTimeout(500);
    await key("idle");
    const marks: string[] = [];
    /** 단계마다 실제로 요청된 효과음(AudioEngine QA 관측) — 들리는지는 증명하지 않는다. */
    const sfx: Array<{ step: string; sounds: string[] }> = [];
    let audioSeen = await page.evaluate(() => (window as unknown as { __oprnAudioObserved?: string[] }).__oprnAudioObserved?.length ?? 0);
    const noteSfx = async (label: string): Promise<void> => {
      const all = await page.evaluate(() => [...((window as unknown as { __oprnAudioObserved?: string[] }).__oprnAudioObserved ?? [])]);
      const fresh = all.slice(audioSeen).map((id) => id.replace(/^easyrpg-sound-/, ""));
      audioSeen = all.length;
      const last = sfx[sfx.length - 1];
      if (last && last.step === label && fresh.length === 0) return;
      sfx.push({ step: label, sounds: fresh });
    };
    if (a.steps) {
      for (const step of a.steps) {
        switch (step.kind) {
          case "walk":
            for (const ch of step.moves) {
              await walk(ch);
              await noteSfx(`walk ${ch}`);
            }
            break;
          case "goto": {
            const c = room(step.x, step.y);
            await teleport(c.x, c.y, step.face);
            break;
          }
          case "face":
            await page.evaluate((f) => window.__oprnInput.face(f), step.dir);
            await page.waitForTimeout(80);
            break;
          case "act":
            choiceQueue = [...(step.choose ?? [])];
            numberQueue = step.number !== undefined ? [step.number] : [];
            presentQueue = [...(step.present ?? [])];
            await act();
            await noteSfx(`act${step.choose ? ` choose=${step.choose.join("/")}` : ""}${step.number !== undefined ? ` number=${step.number}` : ""}${step.present ? ` present=${step.present.join("/")}` : ""}`);
            break;
          case "wait":
            await page.waitForTimeout(step.ms);
            await settle();
            break;
          case "mark": {
            await noteSfx(`mark:${step.label}`);
            marks.push(step.label);
            await key(step.label);
            if (step.expectSolved !== undefined) {
              const s = await state();
              assert.equal(Boolean(s.switches[a.solveSwitchId]), step.expectSolved, `${a.presetId}: at mark ${step.label} solved should be ${step.expectSolved}`);
            }
            break;
          }
        }
      }
    } else {
      const driver = LEGACY_DRIVERS[a.presetId] ?? [];
      for (const step of driver) {
        if ("touch" in step) {
          const ev = a.events.find((e) => e.id.endsWith(`_${step.touch}`));
          assert.ok(ev);
          await teleport(ev.x, ev.y + 1, "up");
          await walk("U");
        } else {
          await standNextAndAct(step.act, step.choose ?? []);
        }
        await noteSfx("touch" in step ? `touch ${step.touch}` : `act ${step.act}`);
      }
    }
    await page.waitForTimeout(400);
    await settle();
    await noteSfx("end");
    const solvedState = await state();
    const solved = solvedState.switches[a.solveSwitchId] === true;
    // 해제 후: 같은 시작점 시점으로 돌아가 한 장.
    await teleport(a.origin.x, a.origin.y, "up");
    await page.waitForTimeout(500);
    await key("after");
    if (best.file) {
      const mid = path.join(OUT, `${a.presetId}-reveal.png`);
      fs.copyFileSync(best.file, mid);
      keyShots.reveal = mid;
    }
    const gif = path.join(OUT, `${a.presetId}.gif`);
    execFileSync("ffmpeg", [
      "-y", "-loglevel", "error", "-framerate", "8", "-i", path.join(dir, "%03d.png"),
      "-vf", "scale=320:240:flags=neighbor,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=none",
      gif,
    ]);
    const rec = { presetId: a.presetId, solved, sawVfx, frames: frame, marks, keyShots, gif, x: solvedState.x, y: solvedState.y, sfx: sfx.filter((e) => e.sounds.length > 0 || e.step.startsWith("mark")) };
    results.push(rec);
    console.log(JSON.stringify(rec));
  }
} finally {
  const reportPath = path.join(OUT, "play-report.json");
  const prevResults: Array<Record<string, unknown>> =
    ONLY && fs.existsSync(reportPath) ? ((JSON.parse(fs.readFileSync(reportPath, "utf8")).results as Array<Record<string, unknown>>) ?? []) : [];
  const byId = new Map<string, Record<string, unknown>>(prevResults.map((r) => [String(r.presetId), r]));
  for (const r of results) byId.set(String(r.presetId), r);
  const mergedResults = PUZZLE_PRESET_CATALOG.map((p) => byId.get(p.id)).filter((r): r is Record<string, unknown> => Boolean(r));
  fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), legacy: LEGACY, sqliteRoundtrip, results: mergedResults, sfxFetches, pageErrors }, null, 2));
  await browser.close();
  await server.close();
}
const unsolved = results.filter((r) => !r.solved).map((r) => r.presetId);
console.log(`solved ${results.length - unsolved.length}/${results.length}; unsolved: ${unsolved.join(",") || "none"}; pageErrors: ${pageErrors.length}`);
if (unsolved.length > 0) process.exitCode = 1;
