// 런타임 QA 하네스 — 부수효과 담당(vite 서버 · 브라우저 구동 · 디스크 쓰기).
// 순수 판정 로직은 ./runtimeQa.mjs 에 있고 여기서 소비만 한다.
// 설계: docs/superpowers/specs/2026-08-28-runtime-vision-qa-design.md
import { createServer as createNetServer } from "node:net";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import {
  evaluateExpect,
  normalizeScenario,
  renderSummary,
  shotFileName,
  shouldCaptureShot,
} from "./runtimeQa.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** exportEntry.ts 가 fetch 할 주소. 실제 파일이 아니라 page.route 로 가로채 채운다. */
const PROJECT_URL = "/__runtime-qa/project.json";
const PROJECT_ROUTE = "**/__runtime-qa/project.json";

/** 훅을 요구하는 op — 이들 앞에서는 런타임 훅 설치를 기다린다. */
const HOOK_OPS = new Set(["seed", "dir", "face", "action", "attack", "skill", "teleport"]);

async function freePort() {
  return await new Promise((resolvePort, reject) => {
    const probe = createNetServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(() => resolvePort(port));
    });
  });
}

/**
 * player-QA 전용 vite dev 서버를 띄운다.
 * 빈 포트를 직접 잡으므로 동시에 도는 워크트리들과 포트 경합이 없고,
 * 전용 cacheDir 을 쓰므로 공유 node_modules/.vite 를 흔들지 않는다.
 */
export async function startPlayerQaServer(opts = {}) {
  const port = opts.port ?? (await freePort());
  const server = await createServer({
    configFile: join(REPO_ROOT, "vite.player-qa.config.ts"),
    server: { port, strictPort: true, host: "127.0.0.1" },
    logLevel: opts.logLevel ?? "warn",
  });
  await server.listen();
  return {
    url: `http://127.0.0.1:${port}`,
    port,
    close: async () => {
      await server.close();
    },
  };
}

async function requireHooks(page) {
  await page.waitForFunction(
    () => typeof window.__oprnDebug === "object" && window.__oprnDebug !== null,
    undefined,
    { timeout: 120_000 },
  );
}

async function testidMatches(page, op) {
  const present = await page.evaluate(
    (testid) => document.querySelector(`[data-testid='${testid}']`) !== null,
    op.testid,
  );
  return op.state === "absent" ? !present : present;
}

async function waitForTestid(page, op) {
  await page.waitForFunction(
    ([testid, state]) => {
      const present = document.querySelector(`[data-testid='${testid}']`) !== null;
      return state === "absent" ? !present : present;
    },
    [op.testid, op.state],
    { timeout: op.timeoutMs ?? 30_000 },
  );
}

async function applyOp(page, op) {
  switch (op.kind) {
    case "wait":
      await page.waitForTimeout(op.ms);
      return;
    case "key":
      for (let i = 0; i < (op.times ?? 1); i += 1) {
        await page.keyboard.press(op.key);
        await page.waitForTimeout(op.delayMs ?? 250);
      }
      return;
    case "seed":
      await page.evaluate((seed) => window.__oprnDebug.setSeed(seed), op.seed);
      return;
    case "teleport":
      await page.evaluate(
        ([mapId, x, y]) => window.__oprnDebug.teleport(mapId, x, y),
        [op.mapId, op.x, op.y],
      );
      return;
    case "dir":
      await page.evaluate((dir) => window.__oprnInput.dir(dir), op.dir ?? null);
      return;
    case "face":
      await page.evaluate((dir) => window.__oprnInput.face(dir), op.dir);
      return;
    case "action":
    case "attack":
    case "skill":
      await page.evaluate((kind) => window.__oprnInput[kind](), op.kind);
      return;
    case "waitFor":
      await waitForTestid(page, op);
      return;
    case "pressUntil": {
      // 매 입력 후 조건을 확인하므로 초과 입력이 구조적으로 불가능하다.
      // 정해진 횟수만 누르면 대사가 닫힌 뒤 남은 입력이 이벤트를 재발동시킨다.
      const max = op.maxPresses ?? 12;
      for (let i = 0; i < max; i += 1) {
        if (await testidMatches(page, op)) return;
        await page.keyboard.press(op.key);
        await page.waitForTimeout(op.delayMs ?? 250);
      }
      if (!(await testidMatches(page, op))) {
        throw new Error(
          `pressUntil: ${op.key} ${max}회 뒤에도 ${op.testid} 가 ${op.state} 가 되지 않았다`,
        );
      }
      return;
    }
    default:
      throw new Error(`구현되지 않은 op: ${op.kind}`);
  }
}

async function readObserved(page) {
  return await page.evaluate(() => {
    const debug = window.__oprnDebug;
    const full = debug ? debug.readState() : null;
    // 매니페스트에는 압축 상태만 남긴다 — switches/inventory 전량은 노이즈이고
    // 이 하네스의 목적(컨텍스트 절약)에 역행한다.
    const state = full
      ? { currentMapId: full.currentMapId, x: full.x, y: full.y, gold: full.gold }
      : null;
    const sprite = window.__oprnPlayerSprite ? window.__oprnPlayerSprite() : null;
    return {
      state,
      testids: [...document.querySelectorAll("[data-testid]")].map((node) => node.dataset.testid),
      playerSpriteResourceId: sprite ? sprite.resourceId : null,
      playerSpriteTextureKey: sprite ? sprite.textureKey : null,
    };
  });
}

/** 리포트를 디스크에 쓴다. SUMMARY.md 가 에이전트가 먼저 읽는 진입점이다. */
export async function writeReport(outDir, report) {
  await writeFile(join(outDir, "manifest.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(join(outDir, "SUMMARY.md"), renderSummary(report), "utf8");
}

/**
 * 시나리오를 실행하고 리포트를 반환한다(+ outDir 에 기록).
 * 게이트 판정은 호출자가 report.errors / report.beats[].failures 로 한다.
 */
export async function runRuntimeQa(page, rawScenario, opts = {}) {
  const scenario = normalizeScenario(rawScenario);
  const projectPath = resolve(REPO_ROOT, scenario.projectFixture);
  const projectJson = await readFile(projectPath, "utf8");
  const outDir = opts.outDir ?? join(REPO_ROOT, "verify-shots/runtime-qa", scenario.id);

  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.message ?? error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });

  await page.setViewportSize(scenario.viewport);
  // exportEntry.ts 는 최상위에서 즉시 부팅하므로 주입은 addInitScript 여야 한다.
  // localStorage.clear() 는 이전 실행의 세이브가 타이틀 화면을 바꾸는 것을 막는다.
  await page.addInitScript(
    ([projectUrl, saveNamespace]) => {
      try {
        localStorage.clear();
      } catch {
        // 접근 불가 환경이면 그대로 진행한다.
      }
      window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace };
    },
    [PROJECT_URL, `runtime-qa:${scenario.id}`],
  );
  await page.route(PROJECT_ROUTE, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: projectJson }),
  );

  await page.goto(`${opts.serverUrl}/player.html`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-testid='title-screen']", { timeout: 120_000 });

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  let hooksReady = false;
  const beats = [];
  for (const [index, beat] of scenario.beats.entries()) {
    // op 이 던져도 런을 죽이지 않는다. 던진 사유를 그 비트의 실패로 기록하고
    // 계속 진행해야 리포트·샷이 남는다 — 초기 구현은 raw 스택만 남기고 죽어서
    // 정작 진단할 증거가 하나도 없었다(실측).
    const opFailures = [];
    for (const op of beat.ops) {
      try {
        if (!hooksReady && HOOK_OPS.has(op.kind)) {
          await requireHooks(page);
          hooksReady = true;
        }
        await applyOp(page, op);
      } catch (error) {
        const reason = String(error?.message ?? error).split("\n")[0];
        opFailures.push(`op ${op.kind} 실패: ${reason}`);
        break; // 같은 비트의 남은 op 은 전제가 깨졌으므로 건너뛴다.
      }
    }
    const observed = await readObserved(page);
    const failures = [...opFailures, ...evaluateExpect(beat.expect ?? {}, observed)];
    let shot = null;
    if (shouldCaptureShot(beat, failures)) {
      shot = shotFileName(index, beat.id);
      await page.screenshot({ path: join(outDir, shot) });
    }
    beats.push({ index, id: beat.id, note: beat.note, shot, failures, state: observed.state });
  }

  const report = {
    scenarioId: scenario.id,
    projectPath: relative(REPO_ROOT, projectPath),
    seed: scenario.seed,
    viewport: scenario.viewport,
    errors,
    beats,
  };
  await writeReport(outDir, report);
  return report;
}
