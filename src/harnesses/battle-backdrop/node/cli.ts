/**
 * npm run harness -- battle-backdrop <단계> [옵션]
 *
 *   capture  --project <project.json|프로젝트 폴더> (--map <id> | --troop <id>) [--cell x,y] [--window WxH] [--assets-root <체크아웃>] [--run <이름>] [--note "<지시>"]
 *   produce  <판> [--n 4] [--par 4]            생성기(god-tibo-imagen)에 캡처를 참고 그림으로 주고 후보 N장 → 바로 도트화
 *   pixelize <판> [글자…]                       원본 → 320×180 도트(맵 팔레트+덧색, 디더링·중간색 없음) + 640×360 저장본
 *   check    <판> [--judge claude:sonnet|agy:<모델>|none]   크기·색 수·아래 띠·밝기 + 그림 판정자(인물·글자·시간·시점). 통과 ≠ 합격
 *   sheet    <판> [<판>…] [--name <이름>]       ~/claude-viz/battle-backdrop-<이름>.html (캡처 옆 후보 1배·3배·전투 무대 미리보기)
 *   pick     <판> <글자> [--by <사람>]           사람이 고른 후보를 현재 도트 화소 해시에 묶는다(감독·에이전트는 고르지 않는다)
 *   build    <판> --project <project.json|폴더> [--target troop:<id>|map:<id>] [--out <새 json>] [--in-place]
 *   status   [<판>]
 *
 * 공용 핵심(프롬프트·팔레트·도트화·검사)은 src/editor/battleBackdropCore.ts — 편집기 조수 도구와 같은 코드다.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import {
  BACKDROP_GROUND_TOP, BACKDROP_NATIVE_HEIGHT, BACKDROP_NATIVE_WIDTH, BACKDROP_STORE_SCALE,
  backdropJudgePrompt, backdropMachineChecks, backdropPrompt, hexToRgb, inferTimeAndLight, judgeFindings, mapPalette,
  meanLuma, parseJudgeVerdict, pixelizeBackdrop, scaleNearest,
  type BackdropFacts, type JudgeVerdict, type MachineCheck, type Rgba,
} from "../../../editor/battleBackdropCore";
import { addRenderAssetRoot, renderMapPng } from "../../../../scripts/qa-game/render.mts";
import { restoreBundledTilesetDiffs } from "../../../project/bundledTilesetDiff";
import { generateImage, mapLimit } from "../../monster-collect-species/node/imageSource";

const ROOT = path.resolve(import.meta.dirname, "../../../..");
const DATA = path.join(ROOT, "harness-data/battle-backdrop");
const RUNS = path.join(ROOT, "qa-runs/harnesses/battle-backdrop");
const LEDGER = path.join(DATA, "ledger.json");
const VIZ = path.join(os.homedir(), "claude-viz");
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

type Candidate = {
  letter: string;
  promptSha256: string;
  rawSha256?: string;
  nativePixelSha256?: string;
  storedPixelSha256?: string;
  colors?: number;
  palette?: string[];
  extras?: string[];
  machine?: Record<string, MachineCheck>;
  judge?: { by: string; nativePixelSha256: string; verdict: JudgeVerdict | null; findings: string[]; raw?: string; at: string };
  error?: string;
};
type Run = {
  id: string;
  createdAt: string;
  project: { file: string; sha256: string; title?: string };
  assetsRoot: string;
  mapId: string;
  troopId?: string;
  window: { x: number; y: number; w: number; h: number };
  captureSha256: string;
  referenceSha256: string;
  facts: BackdropFacts;
  candidates: Candidate[];
  pick?: { letter: string; nativePixelSha256: string; storedPixelSha256: string; by: string; at: string };
  builds?: { at: string; target: string; resourceId: string; storedPixelSha256: string; into: string; reloaded: boolean }[];
};
type Ledger = { version: 1; runs: Record<string, Run> };

const dbg = (m: string) => { if (process.env.BB_DEBUG) console.error(`[bb ${new Date().toISOString().slice(11, 19)}] ${m}`); };
const now = () => new Date().toISOString().replace(/\.\d+Z$/u, "Z");
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const readLedger = (): Ledger => fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : { version: 1, runs: {} };
function writeJson(file: string, value: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + ".tmp", JSON.stringify(value, null, 1) + "\n");
  fs.renameSync(file + ".tmp", file);
}
const seed = () => JSON.parse(fs.readFileSync(path.join(DATA, "seed.json"), "utf8")) as { candidates: number; parallel: number; judge: string };

function readPng(file: string): Rgba {
  const png = PNG.sync.read(fs.readFileSync(file));
  return { width: png.width, height: png.height, data: new Uint8Array(png.data) };
}
function encodePng(img: Rgba): Buffer {
  const png = new PNG({ width: img.width, height: img.height });
  png.data = Buffer.from(img.data);
  return PNG.sync.write(png);
}
function writePng(file: string, img: Rgba): void { fs.writeFileSync(file, encodePng(img)); }
/** 화소 해시 — 같은 그림이면 PNG 인코딩이 달라도 같다(object-gate 와 같은 생각). */
const pixelSha = (img: Rgba) => sha(Buffer.concat([Buffer.from(`${img.width}x${img.height}:`), Buffer.from(img.data)]));

function opt(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}
const positional = (argv: string[]) => argv.filter((v, i) => !v.startsWith("--") && !(i > 0 && argv[i - 1]!.startsWith("--") && !["--in-place"].includes(argv[i - 1]!)));
const runDir = (id: string) => path.join(RUNS, id);
function getRun(ledger: Ledger, id: string | undefined): Run {
  if (!id || !ledger.runs[id]) throw new Error(`판이 없다: ${id ?? "(없음)"} — 있는 판: ${Object.keys(ledger.runs).join(", ") || "없음"}`);
  return ledger.runs[id]!;
}

// ---------- 프로젝트 읽기 ----------

type AnyProject = Record<string, any>;

async function loadProject(input: string): Promise<{ project: AnyProject; file: string; bytes: Buffer; sqlite: boolean }> {
  const abs = path.resolve(input);
  if (fs.existsSync(path.join(abs, "project.sqlite"))) {
    const { openLocalProjectStore } = await import("../../../../electron/local-store/store");
    const store = await openLocalProjectStore({ projectDir: abs });
    const snapshot = store.loadSnapshot();
    store.close();
    if (!snapshot) throw new Error(`정본 스냅숏이 없다: ${abs}`);
    const project = structuredClone(snapshot.project) as AnyProject;
    return { project, file: abs, bytes: Buffer.from(JSON.stringify(project)), sqlite: true };
  }
  const bytes = fs.readFileSync(abs);
  const raw = JSON.parse(bytes.toString("utf8")) as AnyProject;
  const project = (raw.project && raw.maps === undefined ? raw.project : raw) as AnyProject;
  // 번들 타일셋은 차이만 저장된다 — 그리기 전에 되돌린다. 로더 전체(검증)는 다른 브랜치 데모의 자원 id 를 거부하므로 쓰지 않는다.
  restoreBundledTilesetDiffs(project);
  return { project, file: abs, bytes, sqlite: false };
}

function findBattleSites(project: AnyProject, troopId: string): { mapId: string; texts: string[] }[] {
  const out: { mapId: string; texts: string[] }[] = [];
  for (const map of Object.values(project.maps ?? {}) as AnyProject[]) {
    for (const event of map.events ?? []) for (const page of event.pages ?? []) {
      const texts: string[] = [];
      let found = false;
      const walk = (cmds: AnyProject[]) => {
        for (const cmd of cmds ?? []) {
          if (found) return;
          if (cmd?.kind === "text" && typeof cmd.body === "string") texts.push(cmd.body);
          if (cmd?.kind === "battleProcessing" && cmd.troopId === troopId) { found = true; return; }
          for (const value of Object.values(cmd ?? {})) {
            if (Array.isArray(value) && value.some((v) => v && typeof v === "object" && "kind" in v)) walk(value);
            else if (Array.isArray(value)) for (const v of value) if (v && typeof v === "object" && Array.isArray(v.branch)) walk(v.branch);
          }
        }
      };
      walk(page.commands ?? []);
      if (found) out.push({ mapId: map.id, texts });
    }
  }
  return out;
}

// ---------- capture ----------

async function capture(argv: string[]): Promise<number> {
  const projectArg = opt(argv, "project");
  if (!projectArg) throw new Error("--project 가 필요하다");
  dbg("load");
  const { project, file, bytes } = await loadProject(projectArg);
  dbg("loaded");
  const troopId = opt(argv, "troop");
  let mapId = opt(argv, "map");
  let texts: string[] = [];
  if (troopId) {
    const sites = findBattleSites(project, troopId);
    if (!mapId) mapId = sites[0]?.mapId;
    texts = sites.find((s) => s.mapId === mapId)?.texts ?? [];
    if (!sites.length) console.warn(`[battle-backdrop] 트룹 ${troopId} 를 부르는 전투 명령을 못 찾았다 — 대사 근거 없이 간다`);
  }
  if (!mapId || !project.maps?.[mapId]) throw new Error(`맵이 없다: ${mapId ?? "(--map 또는 --troop 필요)"}`);
  const map = project.maps[mapId] as AnyProject;
  const tileset = project.tilesets?.[map.tilesetId] as AnyProject | undefined;
  const size = tileset?.tileSize ?? 16;

  // 그리기: 이벤트(캐릭터·표식)와 시작 표시를 빼고 타일만. 번들 칩셋 그림은 assets-root/public 에서 읽는다.
  const assetsRoot = path.resolve(opt(argv, "assets-root") ?? ROOT);
  for (const dir of [path.join(path.dirname(file), "assets"), path.join(file, "assets")]) if (fs.existsSync(dir)) addRenderAssetRoot(dir);
  const cwd = process.cwd();
  process.chdir(assetsRoot);
  let full: Rgba;
  try {
    const { png, note } = renderMapPng({ ...project, startMapId: "__battle_backdrop_none__" } as never, { ...map, events: [] } as never, 1);
    if (note) throw new Error(note);
    const decoded = PNG.sync.read(png);
    full = { width: decoded.width, height: decoded.height, data: new Uint8Array(decoded.data) };
  } finally { process.chdir(cwd); }
  dbg("rendered");

  // 창: 작은 맵은 통째, 큰 맵은 --cell 둘레 --window(칸).
  const [ww, wh] = (opt(argv, "window") ?? "").split("x").map(Number);
  const small = map.width * map.height <= 40 * 30;
  const winW = Math.min(map.width, ww || (small ? map.width : 32));
  const winH = Math.min(map.height, wh || (small ? map.height : 18));
  const [cx, cy] = (opt(argv, "cell") ?? "").split(",").map(Number);
  const fx = Number.isFinite(cx) ? cx! + 0.5 : map.width / 2, fy = Number.isFinite(cy) ? cy! + 0.5 : map.height / 2;
  const left = Math.max(0, Math.min(map.width - winW, Math.round(fx - winW / 2)));
  const top = Math.max(0, Math.min(map.height - winH, Math.round(fy - winH / 2)));
  const win = { x: left, y: top, w: winW, h: winH };
  const cap = cropPx(full, left * size, top * size, winW * size, Math.min(winH * size, full.height - top * size));

  // 참고 그림: 16:9 로 맞춘 판(어두운 테두리) → 정수배 최근접 확대(생성기 출력 비율이 참고 그림을 따른다).
  const ref169 = letterbox169(cap);
  const k = Math.max(1, Math.floor(1280 / ref169.width));
  const reference = scaleNearest(ref169, k);

  const indoor = map.climate?.mode === "indoor" || /실내|indoor|interior/iu.test(`${tileset?.name ?? ""}`);
  const locNames = (map.locations ?? []).map((l: AnyProject) => l?.name).filter((n: unknown): n is string => typeof n === "string");
  const troop = troopId ? (project.database?.troops ?? []).find((t: AnyProject) => t.id === troopId) : undefined;
  const tl = inferTimeAndLight({ lighting: map.defaultLighting, texts: [...texts, map.name ?? ""], indoor });
  const facts: BackdropFacts = {
    mapId, mapName: String(map.name ?? mapId), tilesetName: String(tileset?.name ?? map.tilesetId), indoor,
    timeOfDay: tl.time, light: tl.light, evidence: tl.evidence,
    placeWords: [String(map.name ?? ""), ...locNames, ...(troop?.name ? [String(troop.name)] : [])].filter(Boolean),
    captureLuma: Number(meanLuma(cap).toFixed(3)),
    palette: mapPalette(cap).map((c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("")),
    ...(opt(argv, "note") ? { note: opt(argv, "note")! } : {}),
  };
  const id = opt(argv, "run") ?? `${mapId.replace(/^map_/u, "")}${troopId ? "-" + troopId.replace(/^troop_/u, "") : ""}`.replace(/[^a-z0-9-]+/giu, "-").toLowerCase();
  const dir = runDir(id);
  fs.mkdirSync(dir, { recursive: true });
  writePng(path.join(dir, "capture.png"), cap);
  writePng(path.join(dir, "reference.png"), reference);
  writeJson(path.join(dir, "facts.json"), facts);
  const ledger = readLedger();
  if (ledger.runs[id]?.pick) throw new Error(`판 ${id} 에는 이미 사람 선택이 있다 — 다른 --run 이름을 쓴다`);
  ledger.runs[id] = {
    id, createdAt: now(), project: { file: path.relative(ROOT, file).startsWith("..") ? file : path.relative(ROOT, file), sha256: sha(bytes), ...(project.meta?.title ? { title: String(project.meta.title) } : {}) },
    assetsRoot, mapId, ...(troopId ? { troopId } : {}), window: win,
    captureSha256: pixelSha(cap), referenceSha256: pixelSha(reference), facts, candidates: [],
  };
  writeJson(LEDGER, ledger);
  console.log(JSON.stringify({ run: id, map: `${mapId} ${facts.mapName}`, window: win, time: facts.timeOfDay, light: facts.light, evidence: facts.evidence, colors: facts.palette.length, dir: path.relative(ROOT, dir) }, null, 1));
  return 0;
}

function cropPx(img: Rgba, x: number, y: number, w: number, h: number): Rgba {
  const data = new Uint8Array(w * h * 4);
  for (let row = 0; row < h; row += 1) {
    const s = ((y + row) * img.width + x) * 4;
    data.set(img.data.subarray(s, s + w * 4), row * w * 4);
  }
  return { width: w, height: h, data };
}

function letterbox169(img: Rgba): Rgba {
  const ratio = 16 / 9;
  const w = Math.max(img.width, Math.ceil(img.height * ratio));
  const h = Math.max(img.height, Math.ceil(w / ratio));
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = 16; data[i + 1] = 16; data[i + 2] = 20; data[i + 3] = 255; }
  const ox = Math.floor((w - img.width) / 2), oy = Math.floor((h - img.height) / 2);
  for (let row = 0; row < img.height; row += 1) data.set(img.data.subarray(row * img.width * 4, (row + 1) * img.width * 4), ((oy + row) * w + ox) * 4);
  return { width: w, height: h, data };
}

// ---------- produce / pixelize ----------

async function produce(argv: string[]): Promise<number> {
  const ledger = readLedger();
  const run = getRun(ledger, positional(argv)[1]);
  const n = Number(opt(argv, "n") ?? seed().candidates);
  const par = Number(opt(argv, "par") ?? seed().parallel);
  const dir = runDir(run.id);
  const reference = fs.readFileSync(path.join(dir, "reference.png"));
  if (pixelSha(readPng(path.join(dir, "reference.png"))) !== run.referenceSha256) throw new Error("참고 그림이 캡처 이후 바뀌었다 — capture 를 다시 한다");
  const start = run.candidates.length;
  const jobs = Array.from({ length: n }, (_, i) => start + i);
  const results = await mapLimit(jobs, par, async (index) => {
    const letter = LETTERS[index]!;
    const prompt = backdropPrompt(run.facts, index);
    fs.writeFileSync(path.join(dir, `prompt-${letter}.txt`), prompt);
    const t0 = Date.now();
    const bytes = await generateImage({ prompt, reference, slug: `battle-backdrop-${run.id}-${letter}` }, 3);
    fs.writeFileSync(path.join(dir, `raw-${letter}.png`), bytes);
    console.log(`[battle-backdrop] ${run.id} ${letter} 생성 ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    return { letter, promptSha256: sha(prompt), rawSha256: sha(bytes) } satisfies Candidate;
  });
  results.forEach((r, i) => run.candidates.push(r ?? { letter: LETTERS[start + i]!, promptSha256: sha(backdropPrompt(run.facts, start + i)), error: "생성 실패" }));
  writeJson(LEDGER, ledger);
  return pixelize(["pixelize", run.id]);
}

function pixelize(argv: string[]): number {
  const ledger = readLedger();
  const [, id, ...letters] = positional(argv);
  const run = getRun(ledger, id);
  const dir = runDir(run.id);
  const palette = run.facts.palette.map((h) => hexToRgb(h)!).filter(Boolean);
  for (const c of run.candidates) {
    if (letters.length && !letters.includes(c.letter)) continue;
    const rawFile = path.join(dir, `raw-${c.letter}.png`);
    if (!fs.existsSync(rawFile)) continue;
    if (c.rawSha256 && sha(fs.readFileSync(rawFile)) !== c.rawSha256) { c.error = "원본이 등록 이후 바뀌었다"; continue; }
    const raw = readPng(rawFile);
    const result = pixelizeBackdrop(raw, palette);
    const stored = scaleNearest(result.native, BACKDROP_STORE_SCALE);
    writePng(path.join(dir, `native-${c.letter}.png`), result.native);
    writePng(path.join(dir, `stored-${c.letter}.png`), stored);
    c.nativePixelSha256 = pixelSha(result.native);
    c.storedPixelSha256 = pixelSha(stored);
    c.colors = result.colors; c.palette = [...result.palette]; c.extras = [...result.extras];
    c.machine = backdropMachineChecks(result.native, run.facts);
    if (c.judge && c.judge.nativePixelSha256 !== c.nativePixelSha256) delete c.judge; // 그림이 바뀌면 판정은 무효
    delete c.error;
    console.log(`[battle-backdrop] ${run.id} ${c.letter} 원본 ${raw.width}×${raw.height} → ${result.native.width}×${result.native.height} 색 ${result.colors}(덧색 ${result.extras.length}) · 기계 ${Object.entries(c.machine).map(([k, v]) => `${k}:${v.ok ? "ok" : "X"}`).join(" ")}`);
  }
  writeJson(LEDGER, ledger);
  return 0;
}

// ---------- check (판정자) ----------

function runJudge(spec: string, refFile: string, candFile: string, prompt: string): Promise<string> {
  const [kind, model = ""] = spec.split(":");
  return new Promise((resolve) => {
    let child;
    if (kind === "agy") {
      child = spawn(process.env.AGY_BIN ?? "agy", ["-p", `@${refFile} @${candFile}\n${prompt}`, "--model", model || "gemini-3.8-flash", "--output-format", "text"], { cwd: path.dirname(candFile) });
    } else {
      const full = `Use the Read tool to open two image files, then judge.\nImage 1: ${refFile}\nImage 2: ${candFile}\n\n${prompt}`;
      child = spawn(process.env.CLAUDE_BIN ?? "claude", ["-p", full, "--model", model || "sonnet", "--allowedTools", "Read", "--output-format", "text"], { cwd: path.dirname(candFile) });
    }
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    const timer = setTimeout(() => child.kill("SIGTERM"), 6 * 60 * 1000);
    child.on("close", () => { clearTimeout(timer); resolve(out); });
  });
}

async function check(argv: string[]): Promise<number> {
  const ledger = readLedger();
  const run = getRun(ledger, positional(argv)[1]);
  const judge = opt(argv, "judge") ?? process.env.BATTLE_BACKDROP_JUDGE ?? seed().judge;
  const dir = runDir(run.id);
  const todo = run.candidates.filter((c) => c.nativePixelSha256);
  for (const c of todo) c.machine = backdropMachineChecks(readPng(path.join(dir, `native-${c.letter}.png`)), run.facts);
  if (judge !== "none") {
    await mapLimit(todo, 4, async (c) => {
      const native = readPng(path.join(dir, `native-${c.letter}.png`));
      if (pixelSha(native) !== c.nativePixelSha256) throw new Error(`${c.letter}: 도트 그림이 기록과 다르다 — pixelize 를 다시 한다`);
      if (c.judge && c.judge.nativePixelSha256 === c.nativePixelSha256 && c.judge.by === judge && c.judge.verdict) return;
      const raw = await runJudge(judge, path.join(dir, "reference.png"), path.join(dir, `stored-${c.letter}.png`), backdropJudgePrompt(run.facts));
      const verdict = parseJudgeVerdict(raw);
      c.judge = { by: judge, nativePixelSha256: c.nativePixelSha256!, verdict, findings: verdict ? judgeFindings(verdict, run.facts) : ["판정자 응답을 읽지 못했다"], ...(verdict ? {} : { raw: raw.slice(-600) }), at: now() };
      console.log(`[battle-backdrop] ${run.id} ${c.letter} 판정(${judge}) ${verdict ? (c.judge.findings.join(" · ") || "지적 없음") : "응답 실패: " + raw.slice(-160).replace(/\s+/gu, " ")}`);
    });
  }
  writeJson(LEDGER, ledger);
  for (const c of run.candidates) {
    const machine = c.machine ? Object.entries(c.machine).filter(([, v]) => !v.ok).map(([k]) => k) : ["없음"];
    console.log(`${c.letter}: 기계 ${machine.length ? "실패 " + machine.join(",") : "통과"} · 판정 ${c.judge ? (c.judge.findings.length ? c.judge.findings.join(" · ") : "지적 없음") : "-"}`);
  }
  console.log("기계·판정 통과는 합격이 아니다 — 사람이 시트에서 고른다(pick).");
  return 0;
}

// ---------- sheet ----------

const dataUri = (file: string) => `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
const esc = (s: string) => s.replace(/[&<>"]/gu, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function sheet(argv: string[]): number {
  const ledger = readLedger();
  const ids = positional(argv).slice(1);
  if (!ids.length) throw new Error("sheet <판> [<판>…]");
  const runs = ids.map((id) => getRun(ledger, id));
  const name = opt(argv, "name") ?? ids.join("--");
  const sections = runs.map((run) => {
    const dir = runDir(run.id);
    const f = run.facts;
    const cards = run.candidates.map((c) => {
      if (!c.nativePixelSha256) return `<div class="card bad"><h3>${c.letter}</h3><p>${esc(c.error ?? "도트 없음")}</p></div>`;
      const native = dataUri(path.join(dir, `native-${c.letter}.png`));
      const machine = Object.entries(c.machine ?? {}).map(([k, v]) => `<tr class="${v.ok ? "ok" : "no"}"><td>${k}</td><td>${esc(v.value)}</td><td>${esc(v.rule)}</td></tr>`).join("");
      const j = c.judge;
      const judgeHtml = j ? (j.verdict ? `<p class="${j.findings.length ? "no" : "ok"}">판정 ${esc(j.by)}: ${esc(j.findings.join(" · ") || "지적 없음")} — <i>${esc(j.verdict.notes)}</i></p>` : `<p class="no">판정 응답 실패</p>`) : `<p class="dim">판정 없음</p>`;
      const picked = run.pick?.letter === c.letter ? `<b class="pick">사람 선택됨</b>` : "";
      return `<div class="card" id="${run.id}-${c.letter}"><h3>${c.letter} ${picked} <span class="dim">색 ${c.colors} · 화소 해시 ${c.nativePixelSha256.slice(0, 12)}</span></h3>
<div class="row"><figure><img class="x1" src="${native}"><figcaption>1배 320×180</figcaption></figure>
<figure class="stage"><div class="stagebox" style="background-image:url(${native})"><div class="ground"></div>${battlers()}</div><figcaption>전투 무대 640×480 cover 미리보기(회색 상자 = 배틀러 자리, 점선 = 바닥 띠 시작)</figcaption></figure></div>
<figure><img class="x3" src="${native}"><figcaption>3배</figcaption></figure>
${judgeHtml}<table>${machine}</table>
<div class="pal">${(c.palette ?? []).map((h) => `<i style="background:${h}" title="${h}${c.extras?.includes(h) ? " (덧색)" : ""}" class="${c.extras?.includes(h) ? "extra" : ""}"></i>`).join("")}</div>
<details><summary>프롬프트</summary><pre>${esc(fs.existsSync(path.join(dir, `prompt-${c.letter}.txt`)) ? fs.readFileSync(path.join(dir, `prompt-${c.letter}.txt`), "utf8") : "")}</pre></details>
<details><summary>생성 원본(도트화 전)</summary><img class="raw" src="${dataUri(path.join(dir, `raw-${c.letter}.png`))}"></details>
<p class="cmd">고르기: <code>npm run harness -- battle-backdrop pick ${run.id} ${c.letter} --by &lt;이름&gt;</code></p></div>`;
    }).join("\n");
    return `<section><h2>${esc(run.id)} — ${esc(f.mapName)} ${run.troopId ? `· 트룹 <code>${esc(run.troopId)}</code>` : ""}</h2>
<div class="facts"><figure><img class="cap" src="${dataUri(path.join(dir, "capture.png"))}"><figcaption>맵 캡처(전투가 벌어지는 곳, 칸 ${run.window.x},${run.window.y} ${run.window.w}×${run.window.h}, 2배) — 생성기에 참고 그림으로 준 것</figcaption></figure>
<ul><li>시간 <b>${f.timeOfDay}</b> · 빛 <b>${f.light}</b> · ${f.indoor ? "실내" : "야외"} · 칩셋 ${esc(f.tilesetName)}</li>${f.evidence.map((e) => `<li class="dim">${esc(e)}</li>`).join("")}
<li>장소 낱말: ${esc(f.placeWords.join(" / "))}</li><li>맵 팔레트 ${f.palette.length}색 <span class="pal">${f.palette.map((h) => `<i style="background:${h}"></i>`).join("")}</span></li></ul></div>
<div class="cards">${cards}</div></section>`;
  }).join("\n");
  const html = `<!doctype html><meta charset="utf-8"><title>battle-backdrop · ${esc(name)}</title>
<style>body{background:#16181d;color:#dde;font:14px/1.5 system-ui,sans-serif;margin:20px}h2{border-top:1px solid #333;padding-top:16px}img{image-rendering:pixelated;display:block}
.cap{width:auto;max-width:720px;zoom:2}.x1{width:320px}.x3{width:960px}.raw{max-width:960px;image-rendering:auto}.cards{display:flex;flex-direction:column;gap:22px}
.card{background:#20232b;border:1px solid #333;padding:12px;border-radius:6px}.card.bad{opacity:.6}.row{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap}
.stagebox{position:relative;width:640px;height:480px;background-size:cover;background-position:center;image-rendering:pixelated;outline:1px solid #555}
.ground{position:absolute;left:0;right:0;top:${(BACKDROP_GROUND_TOP * 100).toFixed(0)}%;border-top:1px dashed #ff0a}.bat{position:absolute;width:44px;height:60px;border:2px solid #fff8;background:#8888;border-radius:4px}
table{border-collapse:collapse;margin:6px 0}td{padding:2px 8px;border-bottom:1px solid #333;font-size:12px}.ok{color:#8d8}.no{color:#f88}.dim{color:#889}.pick{color:#ff0}
.pal i{display:inline-block;width:14px;height:14px;margin-right:1px;border:1px solid #0006}.pal i.extra{outline:2px solid #fc0}figure{margin:0}.facts{display:flex;gap:20px;flex-wrap:wrap}.cmd code{background:#000;padding:2px 6px}
pre{white-space:pre-wrap;background:#111;padding:8px;font-size:12px}</style>
<h1>전투 배경 후보 — ${esc(name)}</h1>
<p>보는 법: 왼쪽 맵 캡처가 전투가 벌어지는 실제 장소다. 각 후보가 <b>같은 장소·같은 시간(낮/밤)·같은 그림체</b>로 읽히는지, 아래 바닥 띠가 배틀러 설 자리로 비어 있는지, 도트로 보이는지를 본다.
기계 검사·판정자 결과는 참고일 뿐 합격이 아니다. 고른 것만 <code>pick</code> → <code>build</code> 로 설치한다.</p>
${sections}`;
  fs.mkdirSync(VIZ, { recursive: true });
  const out = path.join(VIZ, `battle-backdrop-${name}.html`);
  fs.writeFileSync(out, html);
  console.log(JSON.stringify({ sheet: out, url: `http://mdc-server:18301/${path.basename(out)}` }));
  return 0;
}

/** 배틀러 자리 표시(320×240 논리 → 640×480 무대 2배). src/battle/battlerPlacements.ts 의 retro 자리. */
function battlers(): string {
  const enemy = [[92, 117]];
  const party = [0, 1, 2, 3].map((i) => [222 + i * 24, 82 + i * 18]);
  return [...enemy, ...party].map(([x, y]) => `<div class="bat" style="left:${x! * 2 - 22}px;top:${y! * 2 - 30}px"></div>`).join("");
}

// ---------- pick / build ----------

function pick(argv: string[]): number {
  const ledger = readLedger();
  const [, id, letter] = positional(argv);
  const run = getRun(ledger, id);
  const c = run.candidates.find((x) => x.letter === letter);
  if (!c?.nativePixelSha256) throw new Error(`후보 ${letter} 의 도트 그림이 없다`);
  const by = opt(argv, "by");
  if (!by) throw new Error("--by <고른 사람> 이 필요하다 — 감독·에이전트는 고르지 않는다");
  const dir = runDir(run.id);
  const native = readPng(path.join(dir, `native-${c.letter}.png`));
  const stored = readPng(path.join(dir, `stored-${c.letter}.png`));
  if (pixelSha(native) !== c.nativePixelSha256 || pixelSha(stored) !== c.storedPixelSha256) throw new Error("그림이 기록된 해시와 다르다 — pixelize·sheet 를 다시 하고 다시 고른다");
  run.pick = { letter: c.letter, nativePixelSha256: c.nativePixelSha256, storedPixelSha256: c.storedPixelSha256!, by, at: now() };
  writeJson(LEDGER, ledger);
  console.log(JSON.stringify(run.pick));
  return 0;
}

async function build(argv: string[]): Promise<number> {
  const ledger = readLedger();
  const run = getRun(ledger, positional(argv)[1]);
  if (!run.pick) throw new Error(`판 ${run.id} 에 사람 선택이 없다 — sheet 를 보고 사람이 pick 한 뒤에만 설치한다`);
  const dir = runDir(run.id);
  const storedFile = path.join(dir, `stored-${run.pick.letter}.png`);
  const stored = readPng(storedFile);
  if (pixelSha(stored) !== run.pick.storedPixelSha256) throw new Error("고른 그림이 선택 이후 바뀌었다 — 다시 고른다");
  const projectArg = opt(argv, "project");
  if (!projectArg) throw new Error("--project 가 필요하다");
  const loaded = await loadProject(projectArg);
  const project = loaded.project;
  const target = opt(argv, "target") ?? (run.troopId ? `troop:${run.troopId}` : `map:${run.mapId}`);
  const [kind, targetId] = target.split(":");
  const resourceId = `battle_backdrop_${run.id.replace(/[^a-z0-9]+/giu, "_")}_${run.pick.storedPixelSha256.slice(0, 8)}`;
  const png = encodePng(stored);
  project.assets ??= {}; project.assets.uploaded ??= {};
  project.assets.uploaded[resourceId] = {
    id: resourceId, name: `전투 배경 · ${run.facts.mapName}`, kind: "backdrop",
    dataUrl: `data:image/png;base64,${png.toString("base64")}`,
    meta: { width: stored.width, height: stored.height, source: "battle-backdrop", run: run.id, pixelSha256: run.pick.storedPixelSha256 },
  };
  if (kind === "troop") {
    const troop = (project.database?.troops ?? []).find((t: AnyProject) => t.id === targetId);
    if (!troop) throw new Error(`트룹이 없다: ${targetId}`);
    troop.previewBackgroundResourceId = resourceId;
  } else if (kind === "map") {
    const map = project.maps?.[targetId!];
    if (!map) throw new Error(`맵이 없다: ${targetId}`);
    map.battleBackground = resourceId;
  } else throw new Error("--target troop:<id> | map:<id>");
  const warn: string[] = [];
  if (project.system?.battleBackdrop === "field" || project.system?.battlePresentation === "onField") warn.push("system.battleBackdrop=field/onField 이면 필드 화면이 그려져 이 그림이 안 보인다");
  let into = "";
  let reloaded = false;
  if (loaded.sqlite) {
    const { openLocalProjectStore } = await import("../../../../electron/local-store/store");
    const store = await openLocalProjectStore({ projectDir: loaded.file });
    const saved = await store.saveProject(project as never);
    store.close();
    if ((saved as { kind?: string }).kind !== "saved") throw new Error(`정본 저장 실패: ${JSON.stringify(saved).slice(0, 200)}`);
    const again = await openLocalProjectStore({ projectDir: loaded.file });
    const snap = again.loadSnapshot();
    again.close();
    const p2 = snap?.project as AnyProject | undefined;
    reloaded = Boolean(p2?.assets?.uploaded?.[resourceId] && (kind === "troop"
      ? p2.database.troops.find((t: AnyProject) => t.id === targetId)?.previewBackgroundResourceId === resourceId
      : p2.maps[targetId!]?.battleBackground === resourceId));
    into = loaded.file;
  } else {
    const out = opt(argv, "out") ?? (argv.includes("--in-place") ? loaded.file : "");
    if (!out) throw new Error("JSON 프로젝트는 --out <새 파일> 또는 --in-place 가 필요하다");
    fs.writeFileSync(out, JSON.stringify(project));
    const back = JSON.parse(fs.readFileSync(out, "utf8")) as AnyProject;
    reloaded = Boolean(back.assets?.uploaded?.[resourceId]);
    into = out;
  }
  (run.builds ??= []).push({ at: now(), target, resourceId, storedPixelSha256: run.pick.storedPixelSha256, into, reloaded });
  writeJson(LEDGER, ledger);
  console.log(JSON.stringify({ resourceId, target, into, reloaded, warnings: warn }));
  return reloaded ? 0 : 1;
}

function status(argv: string[]): number {
  const ledger = readLedger();
  const id = positional(argv)[1];
  const runs = id ? [getRun(ledger, id)] : Object.values(ledger.runs);
  for (const run of runs) {
    const cands = run.candidates.map((c) => {
      const m = c.machine ? Object.values(c.machine).every((v) => v.ok) : false;
      const j = c.judge ? (c.judge.findings.length ? "판정지적" : "판정ok") : "판정-";
      return `${c.letter}:${c.nativePixelSha256 ? (m ? "기계ok" : "기계X") : "없음"}/${j}`;
    }).join(" ");
    console.log(`${run.id} · ${run.facts.mapName} · ${run.facts.timeOfDay}/${run.facts.light} · 후보 ${run.candidates.length} [${cands}] · 선택 ${run.pick ? `${run.pick.letter}(${run.pick.by})` : "없음"} · 설치 ${run.builds?.length ?? 0}`);
  }
  if (!runs.length) console.log("판 없음 — capture 부터");
  return 0;
}

export async function run(argv: string[]): Promise<number> {
  const stage = argv[0];
  switch (stage) {
    case "capture": return capture(argv);
    case "produce": return produce(argv);
    case "pixelize": return pixelize(argv);
    case "check": return check(argv);
    case "sheet": return sheet(argv);
    case "pick": return pick(argv);
    case "build": return build(argv);
    case "status": case "list": return status(argv);
    default:
      console.error("battle-backdrop capture|produce|pixelize|check|sheet|pick|build|status — 문서 openwiki/harnesses/battle-backdrop.md");
      return 2;
  }
}

void BACKDROP_NATIVE_WIDTH; void BACKDROP_NATIVE_HEIGHT;
