// LLM 에이전트가 **출하 플레이어**(player.html + export shim)를 직접 플레이하기 위한 세션 엔진.
//
// 왜 이 파일이 있나: 런타임 QA(runtimeQaRun.mjs)는 한 번 돌고 끝나는 시나리오용이다. 에이전트는
// 대화처럼 짧은 명령을 계속 보내며 같은 화면을 들여다본다. 그래서 브라우저·페이지를 오래 살려 두고,
// op 실행은 **런타임 QA 의 applyOp 를 그대로** 쓴다(복제하지 않는다). 여기에는 op 집합 위에
// 플레이 전용 몇 가지(move·click·wait·waitBodyText)만 더한다.
//
// 도구: scripts/qa/play/qp.mjs(세션 CLI) · repro.mjs(재현) · to-scenario.mjs(회귀 시나리오).
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { HOOK_OPS, applyOp, requireHooks } from "./runtimeQaRun.mjs";

/**
 * 이 머신의 tailscale·docker 인터페이스 때문에 크로미움이 «네트워크 바뀜» 으로 vite 모듈 요청을
 * 통째로 끊는다(net::ERR_NETWORK_CHANGED → 백지). 런타임 QA 런처와 같은 플래그를 쓴다.
 */
export const PLAY_BROWSER_ARGS = [
  "--no-sandbox",
  "--use-gl=swiftshader",
  "--disable-gpu",
  "--disable-background-networking",
  "--disable-features=NetworkChangeNotifier",
];

/** 프로젝트 JSON 을 가로채는 경로. 실제 파일이 아니라 page.route 로 채운다. */
export const PLAY_PROJECT_PATH = "/__qp/project.json";

/** 게임 상태를 바꾸지 않는 관측 전용 op — actions.jsonl 에는 남지만 재생에서는 건너뛴다. */
export const OBSERVE_ONLY_KINDS = new Set(["shot", "state", "text", "errors"]);

/** 메뉴로 읽을 testid 패턴은 readPlayState 안에서 정의한다(페이지 함수는 모듈 스코프를 못 본다). */

export async function launchPlayBrowser({ headless = true } = {}) {
  return chromium.launch({ headless, args: PLAY_BROWSER_ARGS });
}

/** 콘솔·페이지 오류를 모은다. 반환한 배열을 errors 명령이 비운다. */
export function capturePageErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error?.message ?? error)));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}

/**
 * 플레이어를 띄우고 타이틀이 뜰 때까지 기다린다.
 *
 * 두 가지 부팅 길이 있다 — 둘 다 **출하 플레이어**다(exportEntry.ts):
 *  1. `projectJson`/`projectFile` — exportEntry 가 projectUrl 을 fetch 해 deserialize 한다. 70MB 급 프로젝트는
 *     라우트로 몸통을 넘기면 렌더러가 죽는다(실측: 첫사랑 82MB — `Target page … closed`). 그래서 파일 경로를
 *     주면 `route.fulfill({ path })` 로 디스크에서 흘려보낸다.
 *  2. `query` — 제품의 데모 분기(`?demo=first-love` 등). 플래그십 데모는 이 길이 정본이고 체크포인트도 이 길을 쓴다.
 *     큰 JSON 을 아예 옮기지 않는다.
 */
export async function bootPlayPage(page, {
  projectJson,
  projectFile,
  query,
  viewport = { width: 1024, height: 768 },
  seed = 1,
  serverUrl,
  entryPath = "/player.html",
  timeoutMs = 180_000,
  checkpoint = null,
}) {
  await page.setViewportSize(viewport);
  await page.addInitScript(([projectUrl, namespace, qaCheckpoint]) => {
    try {
      if (!sessionStorage.getItem("qp:booted")) {
        localStorage.clear();
        sessionStorage.setItem("qp:booted", "1");
      }
    } catch {
      // 저장소 접근이 막힌 표면이면 그대로 진행한다.
    }
    // qaCheckpoint boots straight into a captured save (same path as scripts/qa/runtime/checkpoints), skipping the title.
    window.__OPENRPG_BOOT__ = { projectUrl, saveNamespace: namespace, qaInstrumentation: true, ...(qaCheckpoint ? { qaCheckpoint } : {}) };
  }, [PLAY_PROJECT_PATH, `qp:${seed}`, checkpoint]);
  if (!query) {
    if (!projectJson && !projectFile) throw new Error("bootPlayPage: projectJson·projectFile·query 중 하나가 필요하다");
    await page.route(`**${PLAY_PROJECT_PATH}`, (route) =>
      projectFile
        ? route.fulfill({ status: 200, contentType: "application/json", path: projectFile })
        : route.fulfill({ status: 200, contentType: "application/json", body: projectJson }));
  }
  const search = query ? `?${new URLSearchParams(query).toString()}` : "";
  await page.goto(`${serverUrl}${entryPath}${search}`, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  if (checkpoint) await page.waitForSelector("[data-testid='runtime-state-json']", { state: "attached", timeout: timeoutMs });
  else await page.waitForSelector("[data-testid='title-screen']", { timeout: timeoutMs });
}

/** The live session as a save snapshot (null on the title or when instrumentation is off). */
export async function captureSaveSnapshot(page) {
  return await page.evaluate(() => {
    try {
      return window.__oprnDebug?.captureSave?.() ?? null;
    } catch {
      return null;
    }
  });
}

/**
 * 카탈로그 게임 하나의 부팅 재료를 만든다.
 * - `entry.query` 가 있으면 그 쿼리로 띄운다(제품 데모 분기 — 큰 JSON 을 옮기지 않는다).
 * - 아니면 오프닝을 끈 사본을 세션 폴더에 써서 **파일 경로**로 넘긴다(디스크에서 흘려보낸다).
 *   원본은 절대 고치지 않는다 — 사본만 만진다.
 */
export async function prepareBoot({ projectFile, entry, dir, keepOpening = false }) {
  if (entry?.query) return { query: entry.query };
  if (!projectFile) throw new Error("이 게임은 project.json 이 필요하다 — node scripts/qa/play/build-games.mjs 를 먼저 돌려라");
  const raw = projectFile.endsWith(".gz")
    ? gunzipSync(await readFile(projectFile)).toString("utf8")
    : await readFile(projectFile, "utf8");
  const patch = {
    ...(keepOpening ? {} : { opening: { enabled: false, skippable: true, scenes: [] } }),
    ...(entry?.systemPatch ?? {}),
  };
  if (Object.keys(patch).length === 0) return { projectFile };
  const project = JSON.parse(raw);
  project.system = { ...project.system, ...patch };
  const target = join(dir, "boot-project.json");
  await writeFile(target, JSON.stringify(project));
  return { projectFile: projectForPlayer(target, dir) };
}

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));

/**
 * 편집기 저장본을 **출하 내보내기 투영**(prepareWebExport)으로 바꿔 플레이어에 넘긴다 — 실제 출하물과 같은 project.json 이다.
 * 왜(2026-10-25 S4): 저장본 그대로(안 쓰는 타일셋·참고문서·번들 정의 통째, 98MB)를 띄우면 출하물(5~14MB)보다 훨씬 무거워
 * 상자에서 부팅 중 렌더러가 닫혔고, 출하물을 검증하지도 않았다. 이미 투영된 파일(번들 참조가 있는 것)은 그대로 쓴다.
 * 투영이 실패하면(vite-node 없음 등) 원본 경로로 돌아가 예전처럼 띄운다.
 */
function projectForPlayer(file, dir) {
  const out = join(dir, "player-project.json");
  const viteNode = [resolve(REPO_ROOT, "node_modules/vite-node/dist/cli.mjs"), resolve(REPO_ROOT, "node_modules/vite-node/vite-node.mjs")].find((path) => existsSync(path));
  if (!viteNode) return file;
  try {
    execFileSync(process.execPath, [viteNode, "--config", resolve(REPO_ROOT, "vite.config.ts"),
      resolve(REPO_ROOT, "src/harnesses/assistant-capability/node/runtimeProjection.ts"), "--", file, out],
    { cwd: REPO_ROOT, stdio: "pipe", maxBuffer: 1024 * 1024 });
    return out;
  } catch (error) {
    process.stderr.write(`playSession: 내보내기 투영 실패 — 저장본 그대로 띄운다: ${String(error?.stderr ?? error?.message ?? error).slice(0, 300)}\n`);
    return file;
  }
}

/** 지금 화면의 압축 상태. `state` 명령과 재현 관측이 같이 쓴다. */
export async function readPlayState(page) {
  return await page.evaluate(() => {
    // page.evaluate 안에서는 모듈 스코프 상수를 못 본다 — 안에서 정의한다.
    const MENU_PATTERN = /(^|-)menu(-|$)|^choice-list$|^shop|^world-atlas$|^ending-screen$|^game-over-screen$|^battle-scene$|^dialogue-box$/;
    const mirror = document.querySelector('[data-testid="runtime-state-json"]');
    let snapshot = null;
    if (mirror) {
      try {
        snapshot = JSON.parse(mirror.textContent || "null");
      } catch {
        snapshot = null;
      }
    }
    const testids = [...document.querySelectorAll("[data-testid]")].map((node) => node.dataset.testid);
    const textOf = (id) => {
      const node = document.querySelector(`[data-testid="${id}"]`);
      return node ? (node.textContent ?? "").replace(/\s+/g, " ").trim() : null;
    };
    const scene = window.__oprnHooksScene ?? null;
    const screen = testids.includes("title-screen") ? "title"
      : testids.includes("battle-scene") ? "battle"
        : testids.includes("ending-screen") ? "ending"
          : testids.includes("game-over-screen") ? "game-over"
            : snapshot ? "field" : "loading";
    const vitals = snapshot?.actorVitals ?? {};
    const party = (snapshot?.partyActorIds ?? []).map((actorId) => {
      const row = vitals[actorId] ?? {};
      return {
        id: actorId,
        hp: row.hp ?? null,
        maxHp: row.maxHp ?? null,
        mp: row.mp ?? null,
        maxMp: row.maxMp ?? null,
      };
    });
    return {
      screen,
      mapId: snapshot?.mapId ?? null,
      x: snapshot?.player?.x ?? null,
      y: snapshot?.player?.y ?? null,
      dir: scene?.facing ?? null,
      running: snapshot?.running ?? null,
      inputEnabled: snapshot?.inputEnabled ?? null,
      gold: snapshot?.gold ?? null,
      party,
      dialog: textOf("dialogue-box"),
      menus: testids.filter((id) => MENU_PATTERN.test(id)).sort(),
      switchCount: snapshot ? Object.keys(snapshot.switches ?? {}).length : null,
      variableCount: snapshot ? Object.keys(snapshot.variables ?? {}).length : null,
      itemCount: snapshot ? Object.keys(snapshot.inventory ?? {}).length : null,
      inventory: snapshot?.inventory ?? null,
      switches: snapshot?.switches ?? null,
      variables: snapshot?.variables ?? null,
      testids,
    };
  });
}

/** Where the player stands after an op — written into actions.jsonl so repro can start a log slice from there. */
export async function readAnchor(page) {
  const state = await readPlayState(page);
  return { screen: state.screen, mapId: state.mapId, x: state.x, y: state.y, dir: state.dir };
}

/**
 * Title -> new game -> field. A title with an intro sequence consumes the first input as "skip", so press only
 * when the menu is actually visible and wait long only after that press (fallen-star needed three presses).
 */
export async function enterFieldFromTitle(page, timeoutMs = 120_000) {
  const fieldReady = async () => page.evaluate(() => Boolean(window.__oprnDebug?.readState?.().currentMapId));
  const menuReady = async () => page.evaluate(() => {
    const titleEl = document.querySelector("[data-testid='title-screen']");
    if (!titleEl) return false;
    if (titleEl.dataset.seqState === "playing" && !titleEl.classList.contains("rm-title-seq-skipped")) return false;
    const button = titleEl.querySelector(".rm-title-menu-button");
    if (!button) return false;
    const rect = button.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await menuReady();
    await page.keyboard.press("Enter");
    const until = Date.now() + (ready ? 15_000 : 3_000);
    while (Date.now() < until) {
      if (await fieldReady()) return true;
      await page.waitForTimeout(200);
    }
  }
  return false;
}

/** 에이전트가 읽는 한 덩이 텍스트. JSON 덤프가 아니다. */
export function formatPlayState(state) {
  if (!state) return "state: unavailable (runtime hooks not installed yet)";
  const lines = [];
  if (state.screen === "title") return "screen=title (press Enter to start a new game, or check the title menu)";
  const party = state.party
    .map((member) => `${member.id}:${member.hp ?? "?"}/${member.maxHp ?? "?"}hp ${member.mp ?? "?"}/${member.maxMp ?? "?"}mp`)
    .join(" ");
  lines.push(`screen=${state.screen} map=${state.mapId ?? "?"} x=${state.x ?? "?"} y=${state.y ?? "?"} dir=${state.dir ?? "?"}`);
  lines.push(`gold=${state.gold ?? "?"} party=[${party || "none"}] running=${state.running} input=${state.inputEnabled}`);
  lines.push(`switches=${state.switchCount ?? "?"} variables=${state.variableCount ?? "?"} items=${state.itemCount ?? "?"}`);
  lines.push(`menus=[${state.menus.join(",")}]`);
  if (state.dialog) lines.push(`dialog="${state.dialog.slice(0, 300)}"`);
  return lines.join("\n");
}

/** 화면 글자 전량(공백 정리, 20k 상한). */
async function readBodyText(page) {
  return await page.evaluate(() => {
    const text = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim();
    return text.length > 20_000 ? text.slice(0, 20_000) : text;
  });
}

/**
 * 재현 판정용 관측 한 장. 기대치(expect)는 이 모양 위에서만 판정한다.
 */
export async function observeForExpect(page, { consoleErrors = [] } = {}) {
  const [state, bodyText] = await Promise.all([readPlayState(page), readBodyText(page)]);
  return {
    screen: state.screen,
    mapId: state.mapId,
    x: state.x,
    y: state.y,
    gold: state.gold,
    dir: state.dir,
    dialog: state.dialog,
    menus: state.menus,
    switches: state.switches,
    variables: state.variables,
    testids: state.testids,
    bodyText,
    consoleErrors: [...consoleErrors],
  };
}

/** 이동 한 걸음은 런타임 op("move")이 한다 — 실행기를 두 벌 두면 재현과 시나리오가 갈라진다. */

/**
 * 플레이 전용 op 를 실행한다. 나머지는 런타임 QA 의 applyOp 에 그대로 넘긴다.
 * @returns {Promise<{note?: string}>}
 */
export async function runPlayOp(page, op, runState = {}) {
  switch (op.kind) {
    case "move": {
      const steps = Math.max(1, Number(op.steps ?? 1));
      runState.notes = [];
      await applyOp(page, { kind: "move", dir: op.dir, steps, stepTimeoutMs: op.stepTimeoutMs }, runState);
      return { note: runState.notes.pop() };
    }
    case "click":
      await applyOp(page, { kind: "clickCanvas", x: op.x, y: op.y }, runState);
      return { note: `clicked canvas (${op.x},${op.y})` };
    case "holdKey": {
      await page.keyboard.down(op.key);
      await page.waitForTimeout(Math.max(0, Number(op.ms ?? 100)));
      await page.keyboard.up(op.key);
      return { note: `held ${op.key} ${op.ms}ms` };
    }
    case "wait": {
      await page.waitForTimeout(Math.max(0, Number(op.ms ?? 100)));
      return { note: `waited ${op.ms}ms` };
    }
    case "waitBodyText": {
      await applyOp(page, { kind: "waitForBodyText", text: op.text, timeoutMs: op.timeoutMs }, runState);
      return { note: `text appeared: ${op.text}` };
    }
    case "waitTestid": {
      const state = op.state ?? "present";
      if (state === "visible") await applyOp(page, { kind: "waitForVisible", testid: op.testid, timeoutMs: op.timeoutMs }, runState);
      else await applyOp(page, { kind: "waitFor", testid: op.testid, state, timeoutMs: op.timeoutMs }, runState);
      return { note: `testid ${op.testid} ${state}` };
    }
    case "reload": {
      await page.reload({ waitUntil: "domcontentloaded", timeout: op.timeoutMs ?? 180_000 });
      await page.waitForSelector("[data-testid='title-screen']", { timeout: op.timeoutMs ?? 180_000 });
      return { note: "reloaded to title" };
    }
    default: {
      // 훅이 필요한 op 만 훅 설치를 기다린다 — 타이틀에서 key 만 눌러도 되는 흐름을 막지 않는다.
      if (HOOK_OPS.has(op.kind)) await requireHooks(page);
      await applyOp(page, op, runState);
      return {};
    }
  }
}

/** op 목록을 순서대로 실행한다. 관측 전용 op 은 건너뛴다. */
export async function runPlayOps(page, ops, { runState = {}, onOp } = {}) {
  for (const op of ops) {
    if (OBSERVE_ONLY_KINDS.has(op.kind) || op.skip === true) {
      onOp?.(op, { ok: true, skipped: true });
      continue;
    }
    const startedAt = Date.now();
    try {
      const outcome = await runPlayOp(page, op, runState);
      onOp?.(op, { ok: true, ms: Date.now() - startedAt, note: outcome?.note });
    } catch (error) {
      onOp?.(op, { ok: false, ms: Date.now() - startedAt, error: String(error?.message ?? error) });
      throw error;
    }
  }
}

/**
 * 진행 정지 측정 — 서명(mapId·x·y·screen·dialog)이 noProgressMs 동안 한 번도 바뀌지 않으면
 * stuck 이다. 시간 자체가 증상인 유일한 축이라 여기서만 실제 시간을 잰다.
 */
export async function measureStuck(page, { noProgressMs, pollMs = 250 }) {
  const signature = (state) => `${state.mapId}|${state.x}|${state.y}|${state.screen}|${(state.dialog ?? "").slice(0, 120)}`;
  const first = await readPlayState(page);
  const base = signature(first);
  const deadline = Date.now() + Math.max(0, noProgressMs);
  const samples = [base];
  while (Date.now() < deadline) {
    await page.waitForTimeout(Math.min(pollMs, Math.max(1, deadline - Date.now())));
    const next = await readPlayState(page);
    const value = signature(next);
    samples.push(value);
    if (value !== base) return { stuck: false, samples };
  }
  return { stuck: true, samples };
}

const asList = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

function matches(text, pattern) {
  if (typeof pattern !== "string") return false;
  const regex = /^\/(.*)\/([a-z]*)$/.exec(pattern);
  if (!regex) return String(text).includes(pattern);
  try {
    return new RegExp(regex[1], regex[2]).test(String(text));
  } catch {
    return String(text).includes(pattern);
  }
}

/**
 * 증상 기대치 판정. 반환값이 빈 배열이면 기대가 성립한다(= 버그가 재현됐다).
 * 어휘: consoleErrorMatches · textPresent · textAbsent · stateEquals · testidPresent ·
 * testidAbsent · stuck{noProgressMs}. stuck 은 관측에 observed.stuck 이 실려 있어야 한다.
 */
export function evaluatePlayExpect(expect, observed) {
  const failures = [];
  if (!expect || typeof expect !== "object") return ["expect 파일이 비었다"];
  const known = new Set(["consoleErrorMatches", "textPresent", "textAbsent", "stateEquals", "testidPresent", "testidAbsent", "stuck", "note"]);
  for (const key of Object.keys(expect)) {
    if (!known.has(key)) failures.push(`expect: 알 수 없는 키 ${key}`);
  }
  const errors = observed.consoleErrors ?? [];
  for (const pattern of asList(expect.consoleErrorMatches)) {
    if (!errors.some((error) => matches(error, pattern))) {
      failures.push(`consoleErrorMatches: ${pattern} 와 맞는 오류가 없다 — 실제 ${errors.length}건: ${errors.slice(0, 3).join(" | ") || "없음"}`);
    }
  }
  const bodyText = observed.bodyText ?? "";
  for (const pattern of asList(expect.textPresent)) {
    if (!matches(bodyText, pattern)) failures.push(`textPresent: 화면 글자에 ${pattern} 가 없다`);
  }
  for (const pattern of asList(expect.textAbsent)) {
    if (matches(bodyText, pattern)) failures.push(`textAbsent: 화면 글자에 ${pattern} 가 있다`);
  }
  for (const [key, wanted] of Object.entries(expect.stateEquals ?? {})) {
    const actual = observed[key];
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
      failures.push(`stateEquals.${key}: 기대 ${JSON.stringify(wanted)}, 실제 ${JSON.stringify(actual)}`);
    }
  }
  for (const testid of asList(expect.testidPresent)) {
    if (!(observed.testids ?? []).includes(testid)) failures.push(`testidPresent: ${testid} 없음`);
  }
  for (const testid of asList(expect.testidAbsent)) {
    if ((observed.testids ?? []).includes(testid)) failures.push(`testidAbsent: ${testid} 잔존`);
  }
  if (expect.stuck) {
    if (!observed.stuck) failures.push("stuck: 관측에 stuck 측정이 없다(도구가 시간 창을 재지 않았다)");
    else if (!observed.stuck.stuck) failures.push(`stuck: ${expect.stuck.noProgressMs}ms 동안 진행이 있었다`);
  }
  return failures;
}
