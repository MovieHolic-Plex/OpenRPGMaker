/**
 * 퍼즐 프리셋 카탈로그(list_puzzle_presets 12종) + 원큐 시공기(author_map_puzzle) +
 * JRPG 장(author_jrpg_chapter) 2상태 기물/프리셋 연동 E2E 실증 (player.html 실제 플레이).
 *
 * 실행:
 *   ./node_modules/.bin/tsx scripts/qa/jrpg-puzzle-presets-qa.mts
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { runTool } from "@/editor/tools/toolRunner";
import { PUZZLE_PRESET_CATALOG, PUZZLE_PRESET_IDS } from "@/editor/tools/puzzleAuthoringTools";
import { JRPG_CHAPTER_IDS } from "@/editor/tools/jrpgChapterTools";
import { createBlankProject } from "@/project/defaults";
import { serialize } from "@/project/io";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";
declare global {
  interface Window {
    __OPENRPG_BOOT__?: Record<string, unknown>;
    __oprnDebug: {
      readState: () => {
        currentMapId: string;
        x: number;
        y: number;
        gold: number;
        inventory: Record<string, number>;
        switches: Record<string, boolean>;
        variables: Record<string, number>;
      };
      teleport: (mapId: string, x: number, y: number) => void;
    };
    __oprnInput: {
      dir: (dir: string | null) => void;
      face: (dir: string) => void;
    };
    /** PlayScene(Phaser) — 해제 연출 중 살아 있는 입자 수와 카메라 흔들림·번쩍임을 읽는 데만 쓴다. */
    __oprnHooksScene?: unknown;
  }
}

const OUT_DIR = path.resolve("/home/main/claude-viz/jrpg-puzzles");
const THUMB_DIR = path.resolve("/home/main/claude-viz/_thumbs");
const FRAMES_ROOT = path.resolve("output/evidence/jrpg-puzzles/frames");
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(THUMB_DIR, { recursive: true });
fs.mkdirSync(FRAMES_ROOT, { recursive: true });

interface PresetSmokeRecord {
  readonly index: number;
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly mapId: string;
  readonly eventCount: number;
  readonly changeTileCount: number;
  readonly solveSwitchId: string;
  readonly reward: { readonly itemId: string; readonly itemName: string; readonly gold: number };
  readonly events: ReadonlyArray<{ readonly id: string; readonly name: string; readonly x: number; readonly y: number; readonly role: string }>;
  readonly solveSteps: readonly string[];
  readonly walkabilityVerified: boolean;
}

// ============================================================================
// 1. list_puzzle_presets & 12종 전수 시공 + check_reachability / run_lint 검증
// ============================================================================
console.log("1) Verifying list_puzzle_presets & all 12 presets via author_map_puzzle...");
const catalogCtx = { project: createBlankProject() };
const listRes = runTool(catalogCtx, "list_puzzle_presets", {});
assert.equal(listRes.ok, true, `list_puzzle_presets failed: ${listRes.summary}`);
assert.equal(PUZZLE_PRESET_CATALOG.length, 12, "Catalog must have 12 presets");

const all12Smoke: PresetSmokeRecord[] = [];
for (const preset of PUZZLE_PRESET_CATALOG) {
  const mId = `map_smoke_${preset.index}_${preset.id}`;
  const createdMap = runTool(catalogCtx, "create_map", {
    id: mId,
    name: `검증맵 ${preset.index} · ${preset.title}`,
    width: 24,
    height: 18,
  });
  assert.equal(createdMap.ok, true, `create_map failed for ${mId}`);
  const authored = runTool(catalogCtx, "author_map_puzzle", {
    mapId: mId,
    presetId: preset.id,
  });
  assert.equal(authored.ok, true, `author_map_puzzle failed for ${preset.id}: ${authored.summary}`);
  const d = authored.data as {
    mapId: string;
    origin: { x: number; y: number };
    events: Array<{ id: string; name: string; x: number; y: number; role: string }>;
    changeTileCount: number;
    solveSwitchId: string;
    reward: { itemId: string; itemName: string; gold: number };
    solveSteps: string[];
    walkabilityVerified: boolean;
  };
  assert.equal(d.walkabilityVerified, true);
  assert.ok(d.events.length >= 2, `${preset.id} should create >=2 events`);
  assert.ok(d.changeTileCount >= 1, `${preset.id} should wire >=1 changeTile command`);

  const reach = runTool(catalogCtx, "check_reachability", {
    mapId: mId,
    from: d.origin,
    targets: d.events.map((e) => ({ x: e.x, y: e.y })),
  });
  assert.equal(reach.ok, true, `check_reachability failed for ${mId}: ${reach.summary}`);
  const reachData = reach.data as { reachable: boolean };
  assert.equal(reachData.reachable, true, `unreachable events in ${mId}: ${reach.summary}`);

  all12Smoke.push({
    index: preset.index,
    id: preset.id,
    title: preset.title,
    category: preset.category,
    mapId: mId,
    eventCount: d.events.length,
    changeTileCount: d.changeTileCount,
    solveSwitchId: d.solveSwitchId,
    reward: d.reward,
    events: d.events,
    solveSteps: d.solveSteps,
    walkabilityVerified: d.walkabilityVerified,
  });
}
console.log(`   -> All ${all12Smoke.length}/12 presets built and verified reachability PASS!`);

// ============================================================================
// 2. author_jrpg_chapter 8개 장 전수 빌드 + 린트/기믹 검증
// ============================================================================
console.log("2) Verifying author_jrpg_chapter across all 8 chapters...");
const chapterCtx = { project: createBlankProject() };
const chapterRecords: Array<Record<string, unknown>> = [];
let firstHubId: string | undefined;
for (let i = 0; i < JRPG_CHAPTER_IDS.length; i += 1) {
  const chId = JRPG_CHAPTER_IDS[i]!;
  const res = runTool(chapterCtx, "author_jrpg_chapter", {
    chapter: chId,
    seed: 7,
    ...(firstHubId ? { timeGateFrom: firstHubId } : {}),
  });
  assert.equal(res.ok, true, `author_jrpg_chapter(${chId}) failed: ${res.summary}`);
  const data = res.data as {
    chapter: string;
    title: string;
    era: string;
    hubMapId: string;
    maps: Array<{ key: string; mapId: string; name: string; kind: string }>;
    gimmicks: string[];
    moods: string[];
  };
  if (!firstHubId) firstHubId = data.hubMapId;
  chapterRecords.push({
    chapter: data.chapter,
    title: data.title,
    era: data.era,
    hubMapId: data.hubMapId,
    maps: data.maps,
    gimmicks: data.gimmicks,
    moods: data.moods,
    warnings: res.warnings ?? [],
  });
}
const lintRes = runTool(chapterCtx, "run_lint", { scope: "all" });
console.log(`   -> 8 chapters built (${Object.keys(chapterCtx.project.maps).length} maps). Lint summary: ${lintRes.summary}`);

// ============================================================================
// 3. player.html 실기 플레이 검증용 프로젝트 구성 (6종 핵심 퍼즐 맵)
// ============================================================================
console.log("3) Building live player.html showcase project with 6 distinct puzzle rooms...");
const playCtx = { project: createBlankProject() };
// 퍼즐 방은 author_map_puzzle 이 손 도트 v5 실내 칩셋으로 20×15 한 화면을 통째로 짓는다 — 빈 한 화면 맵만 만든다.
const createPuzzleRoomMap = (id: string, name: string): void => {
  const made = runTool(playCtx, "create_map", { id, name, width: 20, height: 15, tilesetId: "atlas_biome_interior" });
  assert.equal(made.ok, true, made.summary);
};
// 방 전체가 한 칩셋으로 이어 깔리므로 해제 연출은 바뀌는 기물 칸(계단·다리·문·불)에만 생긴다 — 예전 15% 기준은
// 맵 위에 큰 판을 덧찍던 시공을 전제로 했다. 지금은 눈에 보이는 변화가 있는지만 잰다.
const MIN_STAGE_CHANGED_PCT = 1.5;

// Room 1: 성당 파이프 오르간·별자리 조율 (cathedral_organ_tuning)
createPuzzleRoomMap("map_p1_cathedral", "600 AD 대성당 · 파이프 오르간과 별자리 계단");
const p1 = runTool(playCtx, "author_map_puzzle", {
  mapId: "map_p1_cathedral",
  presetId: "cathedral_organ_tuning",
  puzzleId: "cathedral_organ",
  title: "대성당 파이프 오르간",
});
assert.equal(p1.ok, true, p1.summary);

// Room 2: 원시 화산 사원 · 3화로 점화 순서 퍼즐 (brazier_ignition_order)
createPuzzleRoomMap("map_p2_brazier", "티라노 화산 사원 · 삼연 화로 점화");
const p2 = runTool(playCtx, "author_map_puzzle", {
  mapId: "map_p2_brazier",
  presetId: "brazier_ignition_order",
  puzzleId: "volcano_braziers",
  title: "화산 토템 화로",
});
assert.equal(p2.ok, true, p2.summary);

// Room 3: 마왕성 예배당 · 석상 압력 발판 스위치 퍼즐 (statue_pressure_plates)
createPuzzleRoomMap("map_p3_plates", "마왕성 지하 · 압력 발판과 심연 돌다리");
const p3 = runTool(playCtx, "author_map_puzzle", {
  mapId: "map_p3_plates",
  presetId: "statue_pressure_plates",
  puzzleId: "chapel_plates",
  title: "마왕성 비밀 제단문",
});
assert.equal(p3.ok, true, p3.summary);

// Room 4: 나르셰 탄광 · 다이너마이트 낙석 폭파 퍼즐 (dynamite_rock_blast)
createPuzzleRoomMap("map_p4_dynamite", "나르셰 탄광 갱도 · 다이너마이트 낙석 폭파");
const p4 = runTool(playCtx, "author_map_puzzle", {
  mapId: "map_p4_dynamite",
  presetId: "dynamite_rock_blast",
  puzzleId: "narshe_dynamite",
  title: "갱도 거대 낙석 바위",
});
assert.equal(p4.ok, true, p4.summary);

// Room 5: 케프카의 탑 · 미믹/진실의 보물상자 수수께끼 (riddle_mimic_chests)
createPuzzleRoomMap("map_p5_riddle", "고대 신전 · 스핑크스 수수께끼 석판과 비밀 계단");
const p5 = runTool(playCtx, "author_map_puzzle", {
  mapId: "map_p5_riddle",
  presetId: "riddle_mimic_chests",
  puzzleId: "zozo_riddle",
  title: "시계탑 수수께끼 비석",
});
assert.equal(p5.ok, true, p5.summary);

// Room 6: 제알 해저신전 · 보스 봉인 결계 3비석 해제 (boss_seal_monoliths)
createPuzzleRoomMap("map_p6_monoliths", "마왕성 보스 전실 · 태양·달·별 3비석 봉인 해제");
const p6 = runTool(playCtx, "author_map_puzzle", {
  mapId: "map_p6_monoliths",
  presetId: "boss_seal_monoliths",
  puzzleId: "zeal_monoliths",
  title: "해저신전 삼중 봉인 결계문",
});
assert.equal(p6.ok, true, p6.summary);

// 시작 맵을 map_p1_cathedral 로 설정
interface PuzzleRunData {
  origin: { x: number; y: number };
  events: Array<{ id: string; name: string; x: number; y: number; role: string }>;
  changeTileCount: number;
  changeTileCommands: Array<{ x: number; y: number; layer: string; tile: number }>;
  solveSwitchId: string;
}
const p1Data = p1.data as PuzzleRunData;
const p2Data = p2.data as PuzzleRunData;
const p3Data = p3.data as PuzzleRunData;
const p4Data = p4.data as PuzzleRunData;
const p5Data = p5.data as PuzzleRunData;
const p6Data = p6.data as PuzzleRunData;

playCtx.project.startMapId = "map_p1_cathedral";
playCtx.project.startPos = { x: p1Data.origin.x, y: p1Data.origin.y };

const serializedPlayProject = serialize(playCtx.project);

// ============================================================================
// 4. Headless Playwright + player.html 실제 플레이 & 해독 캡처
// ============================================================================
console.log("4) Launching player.html via startPlayerQaServer and solving puzzles...");
const server = await startPlayerQaServer({ logLevel: "error" });
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=swiftshader",
    "--disable-gpu",
    "--disable-dev-shm-usage",
  ],
});

const consoleErrors: string[] = [];

function buildGif(frameDir: string, outGifPath: string, fps = 4): void {
  execFileSync("ffmpeg", [
    "-y",
    "-loglevel",
    "error",
    "-framerate",
    String(fps),
    "-i",
    path.join(frameDir, "%03d.png"),
    "-vf",
    "split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=none",
    outGifPath,
  ]);
}

try {
  const context = await browser.newContext({ viewport: { width: 960, height: 720 } });
  const page = await context.newPage();
  page.on("pageerror", (err) => consoleErrors.push(String(err?.message ?? err)));

  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {}
    window.__OPENRPG_BOOT__ = {
      projectUrl: "/__runtime-qa/project.json",
      saveNamespace: "runtime-qa:jrpg-puzzles",
      qaInstrumentation: true,
    };
  });
  await page.route("**/__runtime-qa/project.json", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: serializedPlayProject }),
  );

  await page.goto(`${server.url}/player.html`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });
  await page.waitForTimeout(800);
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => Boolean(window.__oprnDebug?.readState?.()?.currentMapId),
    undefined,
    { timeout: 120_000 },
  );

  const present = async (id: string): Promise<boolean> => (await page.locator(`[data-testid="${id}"]`).count()) > 0;
  const readState = async () =>
    page.evaluate(() => {
      const s = window.__oprnDebug.readState();
      return {
        map: s.currentMapId,
        x: s.x,
        y: s.y,
        gold: s.gold,
        inventory: s.inventory,
        switches: s.switches,
        variables: s.variables,
      };
    });

  // 오프닝 시퀀스 닫기
  for (let i = 0; i < 60; i += 1) {
    if (!(await present("cinematic-sequence")) && !(await present("dialogue-box")) && !(await present("title-screen"))) break;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
  }

  // 이벤트 인접 칸으로 이동해 그 이벤트를 바라보는 헬퍼
  const standNextAndFace = async (mapId: string, targetX: number, targetY: number): Promise<void> => {
    const dirs: ReadonlyArray<{ readonly dx: number; readonly dy: number; readonly face: "up" | "down" | "left" | "right" }> = [
      { dx: 0, dy: 1, face: "up" },
      { dx: 0, dy: -1, face: "down" },
      { dx: 1, dy: 0, face: "left" },
      { dx: -1, dy: 0, face: "right" },
    ];
    const map = playCtx.project.maps[mapId]!;
    let picked = dirs[0]!;
    for (const cand of dirs) {
      const nx = targetX + cand.dx;
      const ny = targetY + cand.dy;
      if (nx <= 0 || ny <= 0 || nx >= map.width - 1 || ny >= map.height - 1) continue;
      const occupied = (map.events ?? []).some((e) => e.x === nx && e.y === ny && e.pages?.[0]?.priority === "same");
      if (!occupied) {
        picked = cand;
        break;
      }
    }
    await page.evaluate(
      ([m, x, y, f]) => {
        window.__oprnDebug.teleport(String(m), Number(x), Number(y));
        window.__oprnInput.face(String(f));
      },
      [mapId, targetX + picked.dx, targetY + picked.dy, picked.face],
    );
    await page.waitForTimeout(450);
  };

  // 그 칸 위로 직접 걸어 올라가는 헬퍼 (playerTouch 발판 등)
  const stepOntoCell = async (mapId: string, targetX: number, targetY: number): Promise<void> => {
    const dirs: ReadonlyArray<{ readonly dx: number; readonly dy: number; readonly move: "up" | "down" | "left" | "right" }> = [
      { dx: 0, dy: 1, move: "up" },
      { dx: 0, dy: -1, move: "down" },
      { dx: 1, dy: 0, move: "left" },
      { dx: -1, dy: 0, move: "right" },
    ];
    const map = playCtx.project.maps[mapId]!;
    let picked = dirs[0]!;
    for (const cand of dirs) {
      const nx = targetX + cand.dx;
      const ny = targetY + cand.dy;
      if (nx > 0 && ny > 0 && nx < map.width - 1 && ny < map.height - 1) {
        picked = cand;
        break;
      }
    }
    await page.evaluate(
      ([m, x, y]) => {
        window.__oprnDebug.teleport(String(m), Number(x), Number(y));
      },
      [mapId, targetX + picked.dx, targetY + picked.dy],
    );
    await page.waitForTimeout(350);
    await page.evaluate((d) => window.__oprnInput.dir(d), picked.move);
    await page.waitForTimeout(260);
    await page.evaluate(() => window.__oprnInput.dir(null));
    await page.waitForTimeout(400);
  };

  const finishTypingIfOpen = async (): Promise<void> => {
    for (let i = 0; i < 16; i += 1) {
      if ((await present("dialogue-box")) || (await present("runtime-choices"))) break;
      await page.waitForTimeout(120);
    }
    await page.waitForTimeout(180);
    const shouldSkipTypewriter = await page.evaluate(() => {
      const box = document.querySelector('[data-testid="dialogue-box"]');
      const choices = document.querySelector('[data-testid="runtime-choices"]');
      return Boolean(box && !box.classList.contains("page-ready") && !choices);
    });
    if (shouldSkipTypewriter) {
      await page.keyboard.press("Enter");
      await page.waitForTimeout(180);
    }
  };

  const waitForChoices = async (): Promise<void> => {
    for (let i = 0; i < 35 && !(await present("runtime-choices")); i += 1) {
      if (await present("dialogue-box")) {
        await page.keyboard.press("Enter");
      }
      await page.waitForTimeout(200);
    }
  };

  const clickChoice = async (index: number): Promise<void> => {
    await waitForChoices();
    await page.evaluate((idx) => {
      const el = document.querySelector(`[data-testid="runtime-choice-${idx}"]`) as HTMLElement | null;
      if (!el) throw new Error(`Missing runtime-choice-${idx}`);
      el.click();
    }, index);
    await page.waitForTimeout(280);
  };

  const createFrameRecorder = (name: string) => {
    const dir = path.join(FRAMES_ROOT, name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    let idx = 0;
    return {
      snap: async (): Promise<string> => {
        const p = path.join(dir, `${String(idx++).padStart(3, "0")}.png`);
        await page.screenshot({ path: p });
        return p;
      },
      finishGif: (outGif: string, fps = 6) => {
        buildGif(dir, outGif, fps);
      },
    };
  };
  type FrameRecorder = ReturnType<typeof createFrameRecorder>;

  interface VfxProbe {
    readonly particles: number;
    readonly shaking: boolean;
    readonly flashing: boolean;
  }
  // 화면에 지금 살아 있는 입자 수와 카메라 흔들림·번쩍임 진행 여부.
  const readVfx = async (): Promise<VfxProbe> =>
    page.evaluate(() => {
      const scene = window.__oprnHooksScene;
      const running = (cam: object, key: string): boolean => {
        if (!(key in cam)) return false;
        const effect: unknown = Reflect.get(cam, key);
        return Boolean(effect && typeof effect === "object" && "isRunning" in effect && effect.isRunning === true);
      };
      let particles = 0;
      let shaking = false;
      let flashing = false;
      if (scene && typeof scene === "object") {
        const children: unknown = "children" in scene ? scene.children : undefined;
        const list: unknown = children && typeof children === "object" && "list" in children ? children.list : undefined;
        if (Array.isArray(list)) {
          for (const child of list) {
            if (child && typeof child === "object" && "getAliveParticleCount" in child && typeof child.getAliveParticleCount === "function") {
              particles += Number(child.getAliveParticleCount());
            }
          }
        }
        const cameras: unknown = "cameras" in scene ? scene.cameras : undefined;
        const main: unknown = cameras && typeof cameras === "object" && "main" in cameras ? cameras.main : undefined;
        if (main && typeof main === "object") {
          shaking = running(main, "shakeEffect");
          flashing = running(main, "flashEffect");
        }
      }
      return { particles, shaking, flashing };
    });

  interface BurstCapture {
    readonly framesDuringVfx: number;
    readonly maxParticles: number;
    readonly sawShake: boolean;
    readonly sawFlash: boolean;
  }

  /**
   * 대사·선택지를 넘기며 이벤트가 끝날 때까지 돈다. rec 를 주면 매 바퀴(대사를 넘긴 직후와, 대사 없이 해제 연출의
   * 입자·흔들림·changeTile 물결이 도는 동안) ~110ms 간격으로 프레임을 찍는다. burstShotPath 를 주면 입자·흔들림·번쩍임이
   * 가장 강한 프레임을 그 경로에 남긴다(= 해제 연출 한복판 스크린샷).
   */
  const flushDialogue = async (
    opts: { readonly rec?: FrameRecorder; readonly expectSwitchId?: string; readonly burstShotPath?: string } = {},
  ): Promise<BurstCapture> => {
    const { rec, expectSwitchId, burstShotPath } = opts;
    if (burstShotPath) fs.rmSync(burstShotPath, { force: true });
    let idleTicks = 0;
    let bestScore = -1;
    let framesDuringVfx = 0;
    let maxParticles = 0;
    let sawShake = false;
    let sawFlash = false;
    const capture = async (): Promise<void> => {
      if (!rec) return;
      const vfx = await readVfx();
      const covered = (await present("dialogue-box")) || (await present("runtime-choices"));
      const frame = await rec.snap();
      const active = vfx.particles > 0 || vfx.shaking || vfx.flashing;
      if (!active) return;
      framesDuringVfx += 1;
      maxParticles = Math.max(maxParticles, vfx.particles);
      sawShake ||= vfx.shaking;
      sawFlash ||= vfx.flashing;
      // 대사창이 덮지 않은 프레임을 먼저 고른다 — 해제 물결은 대사 전에 돌아서 입자·흔들림이 맨 화면에 보이는 순간이 있다.
      const score = (covered ? 0 : 10_000) + vfx.particles + (vfx.shaking ? 40 : 0) + (vfx.flashing ? 40 : 0);
      if (burstShotPath && score > bestScore) {
        bestScore = score;
        fs.copyFileSync(frame, burstShotPath);
      }
    };
    const tickMs = rec ? 110 : 200;
    for (let i = 0; i < 160; i += 1) {
      const hasDlg = await present("dialogue-box");
      const hasChoice = await present("runtime-choices");
      if (hasDlg || hasChoice) {
        idleTicks = 0;
        await capture();
        await page.keyboard.press("Enter");
        await page.waitForTimeout(tickMs);
        await capture();
        continue;
      }
      idleTicks += 1;
      await capture();
      if (expectSwitchId) {
        const st = await readState();
        if (st.switches[expectSwitchId] === true && idleTicks >= 3) break;
      } else if (idleTicks >= 6) {
        break;
      }
      await page.waitForTimeout(tickMs);
    }
    await page.waitForTimeout(250);
    return { framesDuringVfx, maxParticles, sawShake, sawFlash };
  };

  /** 해제 연출 한복판이 실제로 찍혔는지(입자·흔들림이 화면에 있던 프레임이 있는지) 확인한다. */
  const assertBurstCaptured = (label: string, burst: BurstCapture, burstShotPath: string): void => {
    console.log(`      ${label} VFX burst:`, burst);
    assert.ok(burst.maxParticles > 0 && burst.sawShake, `${label}: no particle+shake frame captured during the reveal`);
    assert.ok(fs.existsSync(burstShotPath), `${label}: missing mid-reveal shot ${burstShotPath}`);
  };

  const playProofs: Record<string, unknown> = {};
  const captureStationaryVantage = async (
    mapId: string,
    vantageX: number,
    vantageY: number,
    outPath: string,
  ): Promise<void> => {
    await flushDialogue();
    await page.evaluate(
      ([m, x, y]) => {
        window.__oprnDebug.teleport(String(m), Number(x), Number(y));
        window.__oprnInput.face("up");
      },
      [mapId, vantageX, vantageY],
    );
    await page.waitForTimeout(550);
    await page.screenshot({ path: outPath });
  };

  const computeImageDiffMetrics = async (
    beforePath: string,
    afterPath: string,
  ): Promise<{
    totalPixels: number;
    changedPixels: number;
    changedViewportPct: number;
    stagePixels: number;
    stageChangedPixels: number;
    stageChangedPct: number;
  }> => {
    const b64Before = fs.readFileSync(beforePath).toString("base64");
    const b64After = fs.readFileSync(afterPath).toString("base64");
    return page.evaluate(
      async ([srcA, srcB]) => {
        const loadImg = (src: string) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = `data:image/png;base64,${src}`;
          });
        const [imgA, imgB] = await Promise.all([loadImg(String(srcA)), loadImg(String(srcB))]);
        const w = imgA.width;
        const h = imgA.height;
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(imgA, 0, 0);
        const dataA = ctx.getImageData(0, 0, w, h).data;
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(imgB, 0, 0);
        const dataB = ctx.getImageData(0, 0, w, h).data;

        let changedPixels = 0;
        let stagePixels = 0;
        let stageChangedPixels = 0;
        const sx0 = Math.floor(w * 0.25);
        const sx1 = Math.floor(w * 0.75);
        const sy0 = Math.floor(h * 0.12);
        const sy1 = Math.floor(h * 0.72);

        for (let y = 0; y < h; y += 1) {
          for (let x = 0; x < w; x += 1) {
            const i = (y * w + x) * 4;
            const diff =
              Math.abs((dataA[i] ?? 0) - (dataB[i] ?? 0)) +
              Math.abs((dataA[i + 1] ?? 0) - (dataB[i + 1] ?? 0)) +
              Math.abs((dataA[i + 2] ?? 0) - (dataB[i + 2] ?? 0));
            const isChanged = diff > 24;
            if (isChanged) changedPixels += 1;
            if (x >= sx0 && x <= sx1 && y >= sy0 && y <= sy1) {
              stagePixels += 1;
              if (isChanged) stageChangedPixels += 1;
            }
          }
        }
        const totalPixels = w * h;
        return {
          totalPixels,
          changedPixels,
          changedViewportPct: Number(((changedPixels / totalPixels) * 100).toFixed(2)),
          stagePixels,
          stageChangedPixels,
          stageChangedPct: Number(((stageChangedPixels / stagePixels) * 100).toFixed(2)),
        };
      },
      [b64Before, b64After],
    );
  };

  const vqaMetrics: Record<string, unknown> = {};

  // --------------------------------------------------------------------------
  // Play 1: 대성당 파이프 오르간·별자리 조율 퍼즐 (cathedral_organ_tuning)
  // --------------------------------------------------------------------------
  console.log("   -> Solving Puzzle 1: cathedral_organ_tuning...");
  {
    const rec = createFrameRecorder("p1_organ");
    const scoreEv = p1Data.events[0]!;
    const organEv = p1Data.events[1]!;
    const stairEv = p1Data.events[2]!;

    const vantageX = stairEv.x;
    const vantageY = stairEv.y + 1;

    // 1. Before: 정지 시점(대사창 없음)에서 4×3 성당 봉인 석벽 & 철창문 촬영
    await captureStationaryVantage(
      "map_p1_cathedral",
      vantageX,
      vantageY,
      path.join(OUT_DIR, "p1-organ-before.png"),
    );
    await rec.snap();
    await page.keyboard.press("Enter");
    await finishTypingIfOpen();
    await rec.snap();
    await flushDialogue({ rec });

    // 2. 악보 단서 확인
    await standNextAndFace("map_p1_cathedral", scoreEv.x, scoreEv.y);
    await page.keyboard.press("Enter");
    await finishTypingIfOpen();
    await rec.snap();
    await flushDialogue({ rec });

    // 3. 오르간 연주 (선택지 0 -> 선택지 0)
    await standNextAndFace("map_p1_cathedral", organEv.x, organEv.y);
    await page.keyboard.press("Enter");
    await finishTypingIfOpen();
    await rec.snap();
    await clickChoice(0); // 「새벽의 별 화음을 연주한다」
    await waitForChoices();
    await rec.snap();
    await clickChoice(0); // 「오르간 아래 숨은 페달을 밟는다」
    const p1Burst = path.join(OUT_DIR, "p1-organ-solving.png");
    assertBurstCaptured("P1", await flushDialogue({ rec, expectSwitchId: p1Data.solveSwitchId, burstShotPath: p1Burst }), p1Burst);

    // 4. Unlocked: 정확히 동일한 시점(대사창 없음)에서 개방된 4×3 황금 카펫 회랑 + 대계단 + 보물상자 + 성소 크리스탈 촬영
    await captureStationaryVantage(
      "map_p1_cathedral",
      vantageX,
      vantageY,
      path.join(OUT_DIR, "p1-organ-unlocked.png"),
    );
    await rec.snap();
    rec.finishGif(path.join(OUT_DIR, "p1-organ-flow.gif"), 6);

    const diff = await computeImageDiffMetrics(
      path.join(OUT_DIR, "p1-organ-before.png"),
      path.join(OUT_DIR, "p1-organ-unlocked.png"),
    );
    const distinctCells = new Set(p1Data.changeTileCommands.map((c) => `${c.x},${c.y}`)).size;
    vqaMetrics.p1_organ = { ...diff, changeTileCount: p1Data.changeTileCount, distinctCells };
    console.log("      P1 VQA diff:", vqaMetrics.p1_organ);
    assert.ok(diff.stageChangedPct >= MIN_STAGE_CHANGED_PCT, `P1 stage visual diff too small: ${diff.stageChangedPct}%`);

    const st = await readState();
    assert.equal(st.switches[p1Data.solveSwitchId], true, "Puzzle 1 solveSwitch must be true");
    playProofs.p1_cathedral_organ = st;
  }

  // --------------------------------------------------------------------------
  // Play 2: 화산 사원 3화로 점화 순서 퍼즐 (brazier_ignition_order)
  // --------------------------------------------------------------------------
  console.log("   -> Solving Puzzle 2: brazier_ignition_order...");
  {
    const rec = createFrameRecorder("p2_brazier");
    const b1 = p2Data.events[0]!;
    const b2 = p2Data.events[1]!;
    const b3 = p2Data.events[2]!;
    const seal = p2Data.events[3]!;

    const vantageX = seal.x;
    const vantageY = seal.y + 2;

    // Before: 정지 시점(대사창 없음)에서 꺼진 3화로 + 5×3 용암 해자 & 5×2 검은 화염/가시 결계 촬영
    await captureStationaryVantage(
      "map_p2_brazier",
      vantageX,
      vantageY,
      path.join(OUT_DIR, "p2-brazier-before.png"),
    );
    await rec.snap();

    // 제1화로 점화
    await standNextAndFace("map_p2_brazier", b1.x, b1.y);
    await page.keyboard.press("Enter");
    await finishTypingIfOpen();
    await rec.snap();
    await flushDialogue({ rec });

    // 제2화로 점화 (Solving: 제1·제2화로 점화 + 불꽃 타일 455 점화 상태)
    await standNextAndFace("map_p2_brazier", b2.x, b2.y);
    await page.keyboard.press("Enter");
    await finishTypingIfOpen();
    await rec.snap();
    await flushDialogue({ rec });

    // 제3화로 점화 -> 5×3 대리석 다리 & 횃불 기둥 개방 + 수호자 보물상자 출현!
    await standNextAndFace("map_p2_brazier", b3.x, b3.y);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(350);
    await rec.snap();
    const p2Burst = path.join(OUT_DIR, "p2-brazier-solving.png");
    assertBurstCaptured("P2", await flushDialogue({ rec, expectSwitchId: p2Data.solveSwitchId, burstShotPath: p2Burst }), p2Burst);

    await captureStationaryVantage(
      "map_p2_brazier",
      vantageX,
      vantageY,
      path.join(OUT_DIR, "p2-brazier-unlocked.png"),
    );
    await rec.snap();
    rec.finishGif(path.join(OUT_DIR, "p2-brazier-flow.gif"), 6);

    const diff = await computeImageDiffMetrics(
      path.join(OUT_DIR, "p2-brazier-before.png"),
      path.join(OUT_DIR, "p2-brazier-unlocked.png"),
    );
    const distinctCells = new Set(p2Data.changeTileCommands.map((c) => `${c.x},${c.y}`)).size;
    vqaMetrics.p2_brazier = { ...diff, changeTileCount: p2Data.changeTileCount, distinctCells };
    console.log("      P2 VQA diff:", vqaMetrics.p2_brazier);
    assert.ok(diff.stageChangedPct >= MIN_STAGE_CHANGED_PCT, `P2 stage visual diff too small: ${diff.stageChangedPct}%`);

    const st = await readState();
    assert.equal(st.switches[p2Data.solveSwitchId], true, "Puzzle 2 solveSwitch must be true");
    playProofs.p2_brazier_order = st;
  }

  // --------------------------------------------------------------------------
  // Play 3: 마왕성 석상 압력 발판 스위치 퍼즐 (statue_pressure_plates)
  // --------------------------------------------------------------------------
  console.log("   -> Solving Puzzle 3: statue_pressure_plates...");
  {
    const rec = createFrameRecorder("p3_plates");
    const plateA = p3Data.events[0]!;
    const plateB = p3Data.events[1]!;
    const gate = p3Data.events[2]!;

    const vantageX = gate.x;
    const vantageY = gate.y + 1;

    // Before: 정지 시점(대사창 없음)에서 5×4 칠흑 심연 낭떠러지 & 석상 발판 촬영
    await captureStationaryVantage(
      "map_p3_plates",
      vantageX,
      vantageY,
      path.join(OUT_DIR, "p3-plates-before.png"),
    );
    await rec.snap();

    // 서쪽 발판 밟기 (playerTouch) -> 석상 이동 + 중앙 교각 일부 융기 (Solving)
    await stepOntoCell("map_p3_plates", plateA.x, plateA.y);
    await finishTypingIfOpen();
    await rec.snap();
    await flushDialogue({ rec });

    // 동쪽 발판 밟기 -> 3×4 돌다리 12칸 + 난간 가로등/촛대 완전 융기 + 황금 상자 출현!
    await stepOntoCell("map_p3_plates", plateB.x, plateB.y);
    await rec.snap();
    const p3Burst = path.join(OUT_DIR, "p3-plates-solving.png");
    assertBurstCaptured("P3", await flushDialogue({ rec, expectSwitchId: p3Data.solveSwitchId, burstShotPath: p3Burst }), p3Burst);

    await captureStationaryVantage(
      "map_p3_plates",
      vantageX,
      vantageY,
      path.join(OUT_DIR, "p3-plates-unlocked.png"),
    );
    await rec.snap();
    rec.finishGif(path.join(OUT_DIR, "p3-plates-flow.gif"), 6);

    const diff = await computeImageDiffMetrics(
      path.join(OUT_DIR, "p3-plates-before.png"),
      path.join(OUT_DIR, "p3-plates-unlocked.png"),
    );
    const distinctCells = new Set(p3Data.changeTileCommands.map((c) => `${c.x},${c.y}`)).size;
    vqaMetrics.p3_plates = { ...diff, changeTileCount: p3Data.changeTileCount, distinctCells };
    console.log("      P3 VQA diff:", vqaMetrics.p3_plates);
    assert.ok(diff.stageChangedPct >= MIN_STAGE_CHANGED_PCT, `P3 stage visual diff too small: ${diff.stageChangedPct}%`);

    const st = await readState();
    assert.equal(st.switches[p3Data.solveSwitchId], true, "Puzzle 3 solveSwitch must be true");
    playProofs.p3_pressure_plates = st;
  }

  // --------------------------------------------------------------------------
  // Play 4: 나르셰 탄광 다이너마이트 낙석 폭파 퍼즐 (dynamite_rock_blast)
  // --------------------------------------------------------------------------
  console.log("   -> Solving Puzzle 4: dynamite_rock_blast...");
  {
    const rec = createFrameRecorder("p4_dynamite");
    const supply = p4Data.events[0]!;
    const boulder = p4Data.events[1]!;

    const vantageX = boulder.x;
    const vantageY = boulder.y + 1;

    // Before: 정지 시점(대사창 없음)에서 5×3 거대 낙석 바위 더미 + 옆에 놓인 다이너마이트 화약통 촬영
    await captureStationaryVantage(
      "map_p4_dynamite",
      vantageX,
      vantageY,
      path.join(OUT_DIR, "p4-dynamite-before.png"),
    );
    await rec.snap();

    // 보급 상자에서 다이너마이트 입수 (Solving)
    await standNextAndFace("map_p4_dynamite", supply.x, supply.y);
    await page.keyboard.press("Enter");
    await finishTypingIfOpen();
    await rec.snap();
    await flushDialogue({ rec });

    // 낙석 바위 폭파! -> 5×3 암반이 광차 철길 + 발광 광맥 + 보물상자로 개방!
    await standNextAndFace("map_p4_dynamite", boulder.x, boulder.y);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(350);
    await rec.snap();
    const p4Burst = path.join(OUT_DIR, "p4-dynamite-solving.png");
    assertBurstCaptured("P4", await flushDialogue({ rec, expectSwitchId: p4Data.solveSwitchId, burstShotPath: p4Burst }), p4Burst);

    await captureStationaryVantage(
      "map_p4_dynamite",
      vantageX,
      vantageY,
      path.join(OUT_DIR, "p4-dynamite-unlocked.png"),
    );
    await rec.snap();
    rec.finishGif(path.join(OUT_DIR, "p4-dynamite-flow.gif"), 6);

    const diff = await computeImageDiffMetrics(
      path.join(OUT_DIR, "p4-dynamite-before.png"),
      path.join(OUT_DIR, "p4-dynamite-unlocked.png"),
    );
    const distinctCells = new Set(p4Data.changeTileCommands.map((c) => `${c.x},${c.y}`)).size;
    vqaMetrics.p4_dynamite = { ...diff, changeTileCount: p4Data.changeTileCount, distinctCells };
    console.log("      P4 VQA diff:", vqaMetrics.p4_dynamite);
    assert.ok(diff.stageChangedPct >= MIN_STAGE_CHANGED_PCT, `P4 stage visual diff too small: ${diff.stageChangedPct}%`);

    const st = await readState();
    assert.equal(st.switches[p4Data.solveSwitchId], true, "Puzzle 4 solveSwitch must be true");
    playProofs.p4_dynamite_blast = st;
  }

  // --------------------------------------------------------------------------
  // Play 5: 시계탑 금고 미믹/진실의 상자 수수께끼 (riddle_mimic_chests)
  // --------------------------------------------------------------------------
  console.log("   -> Solving Puzzle 5: riddle_mimic_chests...");
  {
    const rec = createFrameRecorder("p5_riddle");
    const tablet = p5Data.events[0]!;
    const wrongChest = p5Data.events[1]!;
    const trueChest = p5Data.events[3]!;

    const vantageX = trueChest.x;
    const vantageY = trueChest.y + 2;

    // Before: 정지 시점(대사창 없음)에서 해자/울타리에 둘러싸인 잠긴 제단 위 3색 상자 촬영
    await captureStationaryVantage(
      "map_p5_riddle",
      vantageX,
      vantageY,
      path.join(OUT_DIR, "p5-riddle-before.png"),
    );
    await rec.snap();

    // 비석 수수께끼 읽기
    await standNextAndFace("map_p5_riddle", tablet.x, tablet.y);
    await page.keyboard.press("Enter");
    await finishTypingIfOpen();
    await rec.snap();
    await flushDialogue({ rec });

    // 오답 상자 건드려 미믹 함정 확인 (Solving)
    await standNextAndFace("map_p5_riddle", wrongChest.x, wrongChest.y);
    await page.keyboard.press("Enter");
    await finishTypingIfOpen();
    await rec.snap();
    await flushDialogue({ rec });

    // 정답 상자 개봉! -> 진실의 상자 열림 + 2×2 지하 비밀 계단 개방 + 발광 성유물 출현!
    await standNextAndFace("map_p5_riddle", trueChest.x, trueChest.y);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(350);
    await rec.snap();
    const p5Burst = path.join(OUT_DIR, "p5-riddle-solving.png");
    assertBurstCaptured("P5", await flushDialogue({ rec, expectSwitchId: p5Data.solveSwitchId, burstShotPath: p5Burst }), p5Burst);

    await captureStationaryVantage(
      "map_p5_riddle",
      vantageX,
      vantageY,
      path.join(OUT_DIR, "p5-riddle-unlocked.png"),
    );
    await rec.snap();
    rec.finishGif(path.join(OUT_DIR, "p5-riddle-flow.gif"), 6);

    const diff = await computeImageDiffMetrics(
      path.join(OUT_DIR, "p5-riddle-before.png"),
      path.join(OUT_DIR, "p5-riddle-unlocked.png"),
    );
    const distinctCells = new Set(p5Data.changeTileCommands.map((c) => `${c.x},${c.y}`)).size;
    vqaMetrics.p5_riddle = { ...diff, changeTileCount: p5Data.changeTileCount, distinctCells };
    console.log("      P5 VQA diff:", vqaMetrics.p5_riddle);
    assert.ok(diff.stageChangedPct >= MIN_STAGE_CHANGED_PCT, `P5 stage visual diff too small: ${diff.stageChangedPct}%`);

    const st = await readState();
    assert.equal(st.switches[p5Data.solveSwitchId], true, "Puzzle 5 solveSwitch must be true");
    playProofs.p5_riddle_chests = st;
  }

  // --------------------------------------------------------------------------
  // Play 6: 제알 신전 보스 봉인 결계 3비석 해제 (boss_seal_monoliths)
  // --------------------------------------------------------------------------
  console.log("   -> Solving Puzzle 6: boss_seal_monoliths...");
  {
    const rec = createFrameRecorder("p6_monoliths");
    const m1 = p6Data.events[0]!;
    const m2 = p6Data.events[1]!;
    const m3 = p6Data.events[2]!;
    const gate = p6Data.events[3]!;

    const vantageX = gate.x;
    const vantageY = gate.y + 1;

    // Before: 정지 시점(대사창 없음)에서 어두운 3비석 & 봉인된 4×4 보스 포털 링 촬영
    await captureStationaryVantage(
      "map_p6_monoliths",
      vantageX,
      vantageY,
      path.join(OUT_DIR, "p6-monoliths-before.png"),
    );
    await rec.snap();

    // 태양 비석 공명
    await standNextAndFace("map_p6_monoliths", m1.x, m1.y);
    await page.keyboard.press("Enter");
    await finishTypingIfOpen();
    await rec.snap();
    await flushDialogue({ rec });

    // 달 비석 공명 (Solving: 2기 비석 발광 부유 수정으로 활성화!)
    await standNextAndFace("map_p6_monoliths", m2.x, m2.y);
    await page.keyboard.press("Enter");
    await finishTypingIfOpen();
    await rec.snap();
    await flushDialogue({ rec });

    // 별 비석 공명 -> 3비석 동시 발광 + 4×4 보스 포털 마법진 & 수정 신전 제단 + 성역 다리 개방!
    await standNextAndFace("map_p6_monoliths", m3.x, m3.y);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(350);
    await rec.snap();
    const p6Burst = path.join(OUT_DIR, "p6-monoliths-solving.png");
    assertBurstCaptured("P6", await flushDialogue({ rec, expectSwitchId: p6Data.solveSwitchId, burstShotPath: p6Burst }), p6Burst);

    await captureStationaryVantage(
      "map_p6_monoliths",
      vantageX,
      vantageY,
      path.join(OUT_DIR, "p6-monoliths-unlocked.png"),
    );
    await rec.snap();
    rec.finishGif(path.join(OUT_DIR, "p6-monoliths-flow.gif"), 6);

    const diff = await computeImageDiffMetrics(
      path.join(OUT_DIR, "p6-monoliths-before.png"),
      path.join(OUT_DIR, "p6-monoliths-unlocked.png"),
    );
    const distinctCells = new Set(p6Data.changeTileCommands.map((c) => `${c.x},${c.y}`)).size;
    vqaMetrics.p6_monoliths = { ...diff, changeTileCount: p6Data.changeTileCount, distinctCells };
    console.log("      P6 VQA diff:", vqaMetrics.p6_monoliths);
    assert.ok(diff.stageChangedPct >= MIN_STAGE_CHANGED_PCT, `P6 stage visual diff too small: ${diff.stageChangedPct}%`);

    const st = await readState();
    assert.equal(st.switches[p6Data.solveSwitchId], true, "Puzzle 6 solveSwitch must be true");
    playProofs.p6_boss_monoliths = st;
  }

  // 썸네일 복사
  fs.copyFileSync(path.join(OUT_DIR, "p1-organ-unlocked.png"), path.join(THUMB_DIR, "jrpg-puzzle-presets-1.png"));
  fs.copyFileSync(path.join(OUT_DIR, "p6-monoliths-unlocked.png"), path.join(THUMB_DIR, "jrpg-puzzle-presets-2.png"));

  const fullReport = {
    generatedAt: new Date().toISOString(),
    presetIds: PUZZLE_PRESET_IDS,
    all12Smoke,
    chapterRecords,
    chapterLintSummary: lintRes.summary,
    vqaMetrics,
    playProofs,
    consoleErrors,
  };
  fs.writeFileSync(path.join(OUT_DIR, "qa-report.json"), JSON.stringify(fullReport, null, 2));
  console.log("All 6 live puzzles solved in player.html with 0 softlocks! Report saved to", path.join(OUT_DIR, "qa-report.json"));
} finally {
  await browser.close();
  await server.close();
}
