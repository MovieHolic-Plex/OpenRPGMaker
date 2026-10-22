// 공방 「한 번에 만들기」의 캐릭터(char-gen)·지형(tile-gen) 실행기 — 호스트(동반 서비스: vite dev/preview·로컬 서버·Electron)에서 돈다.
//
// 왜 호스트인가(2026-10-23): char-gen·tile-gen 은 비공개 파이썬 생성기다. 지시문·판정 기준을 공개 모노레포(브라우저 번들)로 옮기면
// 비공개 글이 새고(openwiki/editor-workshop.md 「생성기 저장소 고정」), 7천 줄 넘는 마스크·검사기를 TS 로 다시 짜는 것은 갈래(fork)다.
// 그래서 lock(tiledata/gen-kits.lock.json)이 고정한 커밋을 이 컴퓨터 캐시에 풀어 그 CLI 를 그대로 부른다 — 사람이 부탁 글을 복사해
// 자기 에이전트에 붙여 넣던 일을 호스트가 대신한다. 모델은 사용자 컴퓨터의 에이전트 CLI(claude·codex·gemini — 사용자 자기 로그인)다.
// 우리 키·유료 대체 경로는 없다.
//
// 입구(scripts/lib/ohMyPiHttp.mjs):
//   POST /v1/workshop/gen          { generator:"char-gen"|"tile-gen", text, count?, cli?, model?, mode?, tileset?:{png,refs} } → { ok, jobId }
//   GET  /v1/workshop/gen?jobId=   → 상태(stage·progress·elapsedMs) · 끝나면 pack:{manifest, blobs:{sha:base64}}
//   POST /v1/workshop/gen/cancel   { jobId }
// 작업은 이 프로세스 메모리에 있다 — 호스트가 다시 뜨면 사라지고, 브라우저는 「못 그림 · 다시」로 보인다.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const KITS = ["char-gen", "tile-gen"];
const CLIS = ["claude", "codex", "gemini"];
/** 사용자가 CLI 모델을 고르지 않았을 때 — 생성기 README 권장(char-gen·tile-gen 둘 다 Opus 로 실측). char-gen 은 Sonnet 으로도 통과(2026-10-23, 2번째 시도). */
const DEFAULT_MODEL = { "char-gen": { claude: "sonnet" }, "tile-gen": { claude: "opus" } };
const JOB_TTL_MS = 6 * 60 * 60 * 1000;
const jobs = new Map();

function repoRoot() {
  return process.env.OPRN_REPO_ROOT || resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
}
function cacheRoot() {
  return process.env.OPRN_GEN_KITS_CACHE || join(homedir(), ".cache", "oprn", "gen-kits");
}
function workRoot() {
  return process.env.OPRN_WORKSHOP_GEN_WORK || join(homedir(), ".cache", "oprn", "workshop-gen");
}

function lockOf(kit) {
  const lock = JSON.parse(readFileSync(join(repoRoot(), "tiledata", "gen-kits.lock.json"), "utf8"));
  const entry = lock.kits?.[kit];
  if (!entry?.commit) throw new Error(`gen-kits lock 에 ${kit} 이 없다`);
  return entry;
}

const KIT_HINT = (kit) => `${kit} 생성기가 이 컴퓨터에 없어요. 편집기 저장소에서 \`npm run gen-kits:sync\` 를 한 번 돌리거나, OPRN_GEN_KIT_${kit.toUpperCase().replace("-", "_")} 를 ${kit} 체크아웃 폴더로 지정하세요.`;

/** 고정 커밋의 생성기 폴더. 캐시에 없으면 .gen-kits/<kit>.git(gen-kits:sync 가 받은 bare)에서 그 커밋을 풀어 둔다. */
export function genKitDir(kit) {
  const override = process.env[`OPRN_GEN_KIT_${kit.toUpperCase().replace("-", "_")}`];
  if (override) return override;
  const { commit } = lockOf(kit);
  const dir = join(cacheRoot(), `${kit}-${commit.slice(0, 12)}`);
  const marker = kit === "char-gen" ? join(dir, "cli.py") : join(dir, "tilegen", "cli.py");
  if (existsSync(marker)) return dir;
  const bare = join(repoRoot(), ".gen-kits", `${kit}.git`);
  if (!existsSync(bare)) throw new Error(KIT_HINT(kit));
  mkdirSync(dir, { recursive: true });
  try {
    const tar = execFileSync("git", ["--git-dir", bare, "archive", commit], { maxBuffer: 512 * 1024 * 1024 });
    execFileSync("tar", ["-x", "-C", dir], { input: tar });
  } catch (error) {
    throw new Error(`${KIT_HINT(kit)} (${error instanceof Error ? error.message.slice(0, 200) : String(error)})`);
  }
  if (!existsSync(marker)) throw new Error(KIT_HINT(kit));
  return dir;
}

function whichCli(name) {
  try {
    execFileSync(process.platform === "win32" ? "where" : "which", [name], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** 사용자가 고른 CLI(조수 엔진 설정) → 없으면 깔린 첫 CLI. */
function chooseCli(wanted) {
  if (wanted && CLIS.includes(wanted) && whichCli(wanted)) return wanted;
  const found = CLIS.find(whichCli);
  if (!found) throw new Error("이 컴퓨터에 AI 에이전트 CLI(Claude Code·Codex·Gemini CLI)가 없어요. 하나를 설치하고 로그인하면 캐릭터·지형도 한 번에 만들 수 있어요.");
  return found;
}

const now = () => Date.now();
const newId = () => `g${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function note(job, text) {
  job.log.push({ at: now(), text });
  if (job.log.length > 40) job.log.splice(0, job.log.length - 40);
}

/** 자식 프로세스 하나 — 프로세스 묶음으로 띄워 그만두기에서 손자(에이전트 CLI)까지 함께 끈다. */
function run(job, command, args, options = {}) {
  return new Promise((resolvePromise) => {
    if (job.state === "cancelled") { resolvePromise({ code: -1, stdout: "", stderr: "cancelled" }); return; }
    let child;
    try {
      child = spawn(command, args, { cwd: options.cwd, env: { ...process.env, ...(options.env ?? {}) }, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" });
    } catch (error) {
      resolvePromise({ code: -1, stdout: "", stderr: String(error) });
      return;
    }
    job.children.add(child);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d; if (stdout.length > 4_000_000) stdout = stdout.slice(-2_000_000); });
    child.stderr.on("data", (d) => { stderr += d; if (stderr.length > 400_000) stderr = stderr.slice(-200_000); });
    const timer = options.timeoutMs ? setTimeout(() => killTree(child), options.timeoutMs) : null;
    const done = (code) => { if (timer) clearTimeout(timer); job.children.delete(child); resolvePromise({ code, stdout, stderr }); };
    child.on("close", (code) => done(code ?? -1));
    child.on("error", (error) => { stderr += String(error); done(-1); });
  });
}

function killTree(child) {
  try {
    if (process.platform !== "win32" && child.pid) process.kill(-child.pid, "SIGTERM");
    else child.kill("SIGTERM");
  } catch { /* 이미 끝남 */ }
}

function lastJson(text) {
  const start = text.lastIndexOf("\n{");
  const body = start >= 0 ? text.slice(start + 1) : text.trim().startsWith("{") ? text.trim() : "";
  try { return body ? JSON.parse(body) : null; } catch { return null; }
}

/** 묶음 폴더(manifest.json + blobs/<sha>) → 응답 몸통. */
function readPack(dir) {
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
  const blobs = {};
  for (const blob of manifest.blobs ?? []) blobs[blob.sha256] = readFileSync(join(dir, "blobs", blob.sha256)).toString("base64");
  return { manifest, blobs };
}

function fail(job, message) {
  if (job.state === "cancelled") return;
  job.state = "failed";
  job.error = message;
  job.finishedAt = now();
  note(job, message);
}

function finish(job, packDir, extra = {}) {
  job.pack = readPack(packDir);
  job.state = "done";
  job.stage = "done";
  job.finishedAt = now();
  Object.assign(job, extra);
  note(job, "묶음을 만들었어요");
}

// ── 캐릭터(char-gen) ───────────────────────────────────────────

/**
 * 바탕 칩 — Scarloxy People1(CC BY 4.0, char-gen 이 번들한 시트, 칸마다 부위 마스크 사양이 있다: 0~6).
 * 0 모자 쓴 소년 · 1 금발 소녀 · 2 모자 쓴 갈색 피부 · 3 긴 머리 여성(의사 예제) · 4 양갈래 여자아이 · 5 짧은 머리 소년(학생 예제) · 6 밀짚모자 농부.
 * 한 줄 부탁에서 낱말로 고른다 — 모델이 옷·머리·소품을 바꾸므로 바탕은 키·성별 실루엣만 맞으면 된다.
 */
export function chooseCharBase(text) {
  const t = String(text ?? "").toLowerCase();
  if (/(아이|어린|꼬마|소녀|girl\b|child|kid)/u.test(t) && !/(여고생|여학생|여대생)/u.test(t)) return /(소녀|girl|여자아이|딸)/u.test(t) ? 4 : 0;
  if (/(농부|할아버지|노인|어부|farmer|old man|fisher)/u.test(t)) return 6;
  if (/(여|녀|누나|언니|아줌마|할머니|공주|마녀|무녀|왕비|woman|lady|female|girl|queen|witch|nun|maid)/u.test(t)) return 3;
  return 5;
}

const CHAR_COMMON = "RPG walking chip (24x32, big head) of a person. Do not copy any existing game or anime character. Keep the base's face, skin, hands, body proportions and walk; change clothes, hair and large gear only.";
const CHAR_CREDITS = "Base chip: Scarloxy People1 (Monster Taming Game Essentials, https://scarloxy.itch.io/mpwsp01) by Scarloxy, CC BY 4.0 — adapted with char-gen";

async function runCharGen(job, input) {
  const kit = genKitDir("char-gen");
  const cli = chooseCli(input.cli);
  const model = input.model || DEFAULT_MODEL["char-gen"][cli] || "";
  job.engine = `${cli}${model ? `/${model}` : ""}`;
  const slot = chooseCharBase(input.text);
  const n = Math.max(1, Math.min(4, Math.round(Number(input.count) || 1)));
  const order = {
    title: input.text,
    common: CHAR_COMMON,
    bases: { b: { ref: join(kit, "assets", "cc-by", "scarloxy-people1.png") + `:${slot}`, spec: join(kit, "examples", "showcase", `scarloxy-people1.${slot}.spec.json`) } },
    chips: Array.from({ length: n }, (_, i) => ({
      id: `c${i + 1}`, name: n > 1 ? `${input.text} ${i + 1}` : input.text, base: "b",
      brief: n > 1 ? `${input.text} (variation ${i + 1} of ${n}: make each one clearly different in colours and outfit details)` : input.text,
    })),
  };
  writeFileSync(join(job.dir, "order.json"), JSON.stringify(order, null, 1));
  job.stage = "drawing";
  // 실측(2026-10-23, Sonnet CLI): 1명 4.5~5.6분(검사 탈락 한 번 포함). --par 2 라 둘씩 함께 그린다.
  job.expectMs = 300_000 * Math.ceil(n / 2);
  note(job, `바탕 칩 People1 ${slot}번에 「${input.text}」 ${n}명을 그려요(${job.engine})`);
  const env = { CHARGEN_DRAWER: cli, ...(model ? { CHARGEN_DRAWER_MODEL: model } : {}) };
  const draw = await run(job, "python3", [join(kit, "cli.py"), "draw", "order.json", "--out", "run", "--backend", "agent", "--par", "2"], { cwd: job.dir, env, timeoutMs: 45 * 60 * 1000 });
  if (job.state === "cancelled") return;
  const ok = [];
  const reasons = [];
  for (const chip of order.chips) {
    try {
      const meta = JSON.parse(readFileSync(join(job.dir, "run", chip.id, "meta.json"), "utf8"));
      if (meta.ok) ok.push(chip.id);
      else reasons.push(...(meta.attempts?.at(-1)?.errors ?? []).slice(0, 2));
    } catch { /* 그 칩은 못 그렸다 */ }
  }
  if (!ok.length) {
    fail(job, `캐릭터를 그리지 못했어요${reasons.length ? ` — 검사: ${reasons.slice(0, 2).join(" / ").slice(0, 300)}` : draw.code !== 0 ? ` — ${(draw.stderr || draw.stdout).trim().split("\n").slice(-2).join(" ").slice(0, 300)}` : ""}`);
    return;
  }
  job.stage = "packing";
  const pack = await run(job, "python3", [join(kit, "cli.py"), "pack", ...ok.map((id) => `run/${id}`), "pack", "--title", input.text.slice(0, 60), "--license", "CC-BY-4.0", "--credits", CHAR_CREDITS], { cwd: job.dir, timeoutMs: 5 * 60 * 1000 });
  if (pack.code !== 0 || !existsSync(join(job.dir, "pack", "manifest.json"))) {
    fail(job, `묶음을 만들지 못했어요 — ${(pack.stderr || pack.stdout).trim().slice(-300)}`);
    return;
  }
  finish(job, join(job.dir, "pack"), { made: ok.length, asked: n });
}

function charProgress(job) {
  // 시도 폴더 수로 센다(칩마다 최대 3번). 시간 기대치와 섞어 막대가 멈춰 보이지 않게 한다.
  let attempts = 0;
  try {
    for (const chip of readdirSync(join(job.dir, "run"))) {
      try { attempts += readdirSync(join(job.dir, "run", chip, "attempts")).length; } catch { /* 아직 */ }
    }
  } catch { /* 아직 */ }
  job.attempts = attempts;
}

// ── 지형(tile-gen) ─────────────────────────────────────────────

const TILE_MODES = new Set(["floor", "autotile", "water", "forest", "cliff", "lava", "swamp", "poison", "deep_water", "beach", "snow", "ice", "sand", "road", "cobble", "meadow"]);

async function tileStatus(job, kit) {
  const status = await run(job, "python3", ["-m", "tilegen", "status", "job"], { cwd: job.dir, env: { PYTHONPATH: kit }, timeoutMs: 60_000 });
  return lastJson(status.stdout);
}

/** 고른 후보 하나를 묶는다 — tile-gen pack 라이브러리를 그 글자로 부른다(사람 고르기 기록 pick.json 은 쓰지 않는다: 편집기의 「알아서 고르기」다). */
async function packTileLetter(job, kit, letter, title) {
  const script = [
    "import json, sys",
    "from pathlib import Path",
    "from tilegen import job as J, pack as PK",
    "root, job = J.load('job')",
    "pieces = J.current_pieces(root, job, sys.argv[1])",
    "r = PK.write([(root, job, sys.argv[1], pieces)], Path('pack').resolve(), title=sys.argv[2], license='CC-BY-4.0', agent=sys.argv[3], draw_model=sys.argv[4])",
    "print(json.dumps({'ok': True}))",
  ].join("\n");
  const result = await run(job, "python3", ["-c", script, letter, title.slice(0, 60), `oprn-workshop/${job.engine}`, job.engine], { cwd: job.dir, env: { PYTHONPATH: kit }, timeoutMs: 5 * 60 * 1000 });
  if (result.code !== 0 || !existsSync(join(job.dir, "pack", "manifest.json"))) throw new Error(`묶음을 만들지 못했어요 — ${(result.stderr || result.stdout).trim().slice(-300)}`);
}

async function runTileGen(job, input) {
  const kit = genKitDir("tile-gen");
  const cli = chooseCli(input.cli);
  const model = input.model || DEFAULT_MODEL["tile-gen"][cli] || "";
  job.engine = `${cli}${model ? `/${model}` : ""}`;
  const mode = TILE_MODES.has(input.mode) ? input.mode : "floor";
  const png = String(input.tileset?.png ?? "").match(/^data:image\/png;base64,(.+)$/u)?.[1];
  const refs = Array.isArray(input.tileset?.refs) ? input.tileset.refs.filter((r) => Array.isArray(r) && r.length >= 2 && r.every((v) => Number.isInteger(v) && v >= 0)).slice(0, 4) : [];
  if (!png) throw new Error("지금 맵 칩셋 그림을 받지 못했어요.");
  if (!refs.length) throw new Error("지금 맵에서 참고할 땅 칸을 찾지 못했어요. 바닥을 조금 칠한 맵에서 다시 해 주세요.");
  writeFileSync(join(job.dir, "sheet.png"), Buffer.from(png, "base64"));
  const candidates = Math.max(1, Math.min(2, Math.round(Number(input.count) || 1)));
  const created = await run(job, "python3", ["-m", "tilegen", "new", "job", "--mode", mode, "--brief", input.text, "--name", input.text.slice(0, 40),
    "--tileset", "sheet.png", ...refs.flatMap((r) => ["--ref", r.join(",")]), "--candidates", "AB".slice(0, candidates)], { cwd: job.dir, env: { PYTHONPATH: kit }, timeoutMs: 120_000 });
  if (created.code !== 0) { fail(job, `지형 작업을 열지 못했어요 — ${(lastJson(created.stdout)?.error ?? created.stderr ?? "").toString().slice(-300)}`); return; }
  job.stage = "drawing";
  job.mode = mode;
  job.expectMs = 25 * 60 * 1000;
  note(job, `「${input.text}」(${mode})을 그려요 — 그리기·검수·다시 그리기(${job.engine})`);
  const auto = await run(job, "python3", ["-m", "tilegen", "auto", "job", "--drawer", cli, "--judge", cli, ...(model ? ["--model", model, "--judge-model", model] : [])],
    { cwd: job.dir, env: { PYTHONPATH: kit, TILEGEN_AGENT_TIMEOUT: "1800" }, timeoutMs: 110 * 60 * 1000 });
  if (job.state === "cancelled") return;
  const status = await tileStatus(job, kit);
  const cands = status?.candidates ?? {};
  job.candidates = Object.fromEntries(Object.entries(cands).map(([letter, c]) => [letter, { status: c.status, attempt: c.attempt, vqa: c.vqa ?? null }]));
  const passed = Object.keys(cands).sort().find((letter) => cands[letter].status === "checked" && cands[letter].vqa === "PASS");
  if (!passed) {
    // 사람에게 관문 판정을 넘기지 않는다(2026-10-23 사용자 규칙) — 검수 통과가 없으면 못 그림.
    fail(job, Object.values(cands).some((c) => c.status === "checked")
      ? "검수를 통과한 지형이 나오지 않았어요. 설명을 조금 바꿔 다시 만들어 보세요."
      : `지형을 그리지 못했어요${auto.code !== 0 ? ` — ${(lastJson(auto.stdout)?.error ?? auto.stderr ?? "").toString().trim().slice(-200)}` : " — 모든 후보가 기계 검사에서 떨어졌어요"}`);
    return;
  }
  job.stage = "packing";
  try {
    await packTileLetter(job, kit, passed, input.text);
  } catch (error) {
    fail(job, error instanceof Error ? error.message : String(error));
    return;
  }
  finish(job, join(job.dir, "pack"), { picked: passed, review: "PASS" });
}

function tileProgress(job) {
  try {
    const dir = join(job.dir, "job", "candidates");
    let attempts = 0;
    let states = [];
    for (const letter of readdirSync(dir)) {
      try {
        const st = JSON.parse(readFileSync(join(dir, letter, "state.json"), "utf8"));
        attempts += st.attempt ?? 0;
        states.push(`${letter}:${st.status}`);
      } catch { /* 아직 */ }
    }
    job.attempts = attempts;
    job.detail = states.join(" ");
    job.reviewing = existsSync(join(job.dir, "job", "vqa"));
  } catch { /* 아직 */ }
}

// ── 바깥 입구 ─────────────────────────────────────────────────

function prune() {
  const t = now();
  for (const [id, job] of jobs) if (job.finishedAt && t - job.finishedAt > JOB_TTL_MS) jobs.delete(id);
}

export function startWorkshopGen(body = {}) {
  prune();
  const generator = body.generator;
  if (!KITS.includes(generator)) return { ok: false, error: `generator 는 ${KITS.join("·")} 중 하나다` };
  const text = String(body.text ?? "").trim().slice(0, 200);
  if (!text) return { ok: false, error: "무엇을 만들지 한 줄 적어 주세요." };
  const id = newId();
  const dir = join(workRoot(), id);
  mkdirSync(dir, { recursive: true });
  const job = { id, generator, text, dir, state: "running", stage: "starting", startedAt: now(), finishedAt: null, error: null, log: [], children: new Set(), engine: "", expectMs: 0, attempts: 0 };
  jobs.set(id, job);
  const body2 = { ...body, text };
  const runner = generator === "char-gen" ? runCharGen : runTileGen;
  runner(job, body2).catch((error) => fail(job, error instanceof Error ? error.message : String(error)));
  return { ok: true, jobId: id };
}

export function workshopGenStatus(jobId) {
  const job = jobs.get(String(jobId ?? ""));
  if (!job) return { ok: false, state: "missing", error: "이 작업을 호스트가 모릅니다(호스트가 다시 시작됐을 수 있어요). 다시 만들어 주세요." };
  if (job.state === "running") (job.generator === "char-gen" ? charProgress : tileProgress)(job);
  const elapsedMs = (job.finishedAt ?? now()) - job.startedAt;
  const progress = job.state === "done" ? 1 : Math.min(0.95, job.expectMs ? elapsedMs / job.expectMs : 0.05);
  return {
    ok: true, jobId: job.id, generator: job.generator, text: job.text, state: job.state, stage: job.stage, engine: job.engine,
    progress, elapsedMs, expectMs: job.expectMs, attempts: job.attempts, detail: job.detail ?? null, reviewing: job.reviewing ?? false,
    error: job.error, picked: job.picked ?? null, review: job.review ?? null,
    made: job.made ?? null, asked: job.asked ?? null, candidates: job.candidates ?? null,
    log: job.log.slice(-6), ...(job.state === "done" && job.pack ? { pack: job.pack } : {}),
  };
}

export function cancelWorkshopGen(jobId) {
  const job = jobs.get(String(jobId ?? ""));
  if (!job) return { ok: false };
  if (job.state === "running") {
    job.state = "cancelled";
    job.finishedAt = now();
    for (const child of job.children) killTree(child);
  }
  return { ok: true };
}
