/**
 * npm run harness -- battle-backdrop <단계> [옵션]
 *
 *   capture  --project <project.json|프로젝트 폴더> (--map <id> | --troop <id>) [--cell x,y] [--window WxH] [--assets-root <체크아웃>] [--run <이름>] [--note "<지시>"] [--indoor|--outdoor]
 *   produce  <판> [--n 4] [--par 4]            생성기(god-tibo-imagen)에 캡처를 참고 그림으로 주고 후보 N장 → 바로 도트화
 *   pixelize <판> [글자…]                       원본 → 320×180 도트(맵 팔레트+덧색, 디더링·중간색 없음) + 640×360 저장본
 *   check    <판> [--judge claude:sonnet|agy:<모델>|none]   크기·색 수·아래 띠·밝기 + 그림 판정자(인물·글자·시간·시점). 통과 ≠ 합격
 *   sheet    <판> [<판>…] [--name <이름>]       ~/claude-viz/battle-backdrop-<이름>.html (캡처 옆 후보 1배·3배·전투 무대 미리보기)
 *   review   <판>                               Claude Opus 검수(숨긴 디코이, 1~5점 0.5 단위, 3.5 통과). 판정은 도트 화소 해시에 묶인다
 *   pick     <판> <글자> --by <누구>             고른 후보를 현재 도트 화소 해시에 묶는다
 *   pick     <판> --best --by <근거>             Opus 검수를 통과한 후보 중 최고점을 고른다(2026-11-04 오너 「이제 사람이 고르지 않아. AI 가 해야함」)
 *   build    <판> --project <project.json|폴더> [--target troop:<id>|map:<id>] [--out <새 json>] [--in-place] [--leave-field-mode]
 *   build    <판> --emit <폴더> [--target troop:<id>|map:<id>]   (프로젝트 없이 upsert_resource 인자 JSON + PNG 만)
 *   build    <판> --bundle <키> --ko "<이름>" --en "<name>"       공용 번들의 장소 그림 battle-scenery-<키> 로 싣는다(Opus 검수로 고른 판만)
 *   status   [<판>]
 *
 * 공용 핵심(프롬프트·팔레트·도트화·검사)은 src/editor/battleBackdropCore.ts — 편집기 조수 도구와 같은 코드다.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import zlib from "node:zlib";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import {
  BACKDROP_GROUND_TOP, BACKDROP_NATIVE_HEIGHT, BACKDROP_NATIVE_WIDTH, BACKDROP_STORE_SCALE,
  backdropJudgePrompt, backdropMachineChecks, findBattleSites, backdropPrompt, hexToRgb, inferTimeAndLight, judgeFindings, mapPalette,
  meanLuma, parseJudgeVerdict, pixelizeBackdrop, scaleNearest,
  type BackdropFacts, type JudgeVerdict, type MachineCheck, type Rgba,
} from "../../../editor/battleBackdropCore";
import { generateImage, mapLimit } from "../../monster-collect-species/node/imageSource";
import {
  BACKDROP_REVIEW_STANDARD, backdropBatchCounts, backdropReviewPrompt, isOpusModel, parseBackdropReview, passingBackdrops, reviewedShas,
  type BackdropControlKind, type ReviewBatch, type ReviewEntry,
} from "../opusReview";

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
  reviews?: ReviewBatch[];
  pick?: { letter: string; nativePixelSha256: string; storedPixelSha256: string; by: string; at: string; score?: number; batch?: string };
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
/**
 * 팔레트(색인) PNG — 번들에 싣는 그림용. 도트화한 그림은 32색 이하라 RGBA 보다 3~4배 작다(묘실 38KB → 10KB, 번들 겹 배경 미리보기와 같은 크기대).
 * 불투명 256색 이하가 아니면 null(부르는 쪽이 RGBA 로 쓴다). 화소는 그대로다 — 쓴 뒤 다시 읽어 화소 해시를 견준다.
 */
function encodeIndexedPng(img: Rgba): Buffer | null {
  const index = new Map<number, number>();
  const rows = Buffer.alloc((img.width + 1) * img.height);
  for (let y = 0; y < img.height; y += 1) for (let x = 0; x < img.width; x += 1) {
    const i = (y * img.width + x) * 4;
    if (img.data[i + 3] !== 255) return null;
    const key = (img.data[i]! << 16) | (img.data[i + 1]! << 8) | img.data[i + 2]!;
    let at = index.get(key);
    if (at === undefined) { if (index.size >= 256) return null; at = index.size; index.set(key, at); }
    rows[y * (img.width + 1) + 1 + x] = at;
  }
  const chunk = (type: string, body: Buffer): Buffer => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(body.length, 0); head.write(type, 4, "latin1");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), body])) >>> 0, 0);
    return Buffer.concat([head, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.width, 0); ihdr.writeUInt32BE(img.height, 4);
  ihdr[8] = 8; ihdr[9] = 3;
  const plte = Buffer.alloc(index.size * 3);
  for (const [key, at] of index) { plte[at * 3] = key >> 16; plte[at * 3 + 1] = (key >> 8) & 255; plte[at * 3 + 2] = key & 255; }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("PLTE", plte), chunk("IDAT", zlib.deflateSync(rows, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
/** 화소 해시 — 같은 그림이면 PNG 인코딩이 달라도 같다(object-gate 와 같은 생각). */
const pixelSha = (img: Rgba) => sha(Buffer.concat([Buffer.from(`${img.width}x${img.height}:`), Buffer.from(img.data)]));

function opt(argv: string[], name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : undefined;
}
const positional = (argv: string[]) => argv.filter((v, i) => !v.startsWith("--") && !(i > 0 && argv[i - 1]!.startsWith("--") && !["--in-place", "--leave-field-mode", "--best", "--indoor", "--outdoor"].includes(argv[i - 1]!)));
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
  // 무거운 모듈(번들 타일셋 정의·렌더러)은 capture/build 에서만 읽는다 — 다른 단계는 몇 초에 뜬다.
  const { restoreBundledTilesetDiffs } = await import("../../../project/bundledTilesetDiff");
  const project = (raw.project && raw.maps === undefined ? raw.project : raw) as AnyProject;
  // 번들 타일셋은 차이만 저장된다 — 그리기 전에 되돌린다. 로더 전체(검증)는 다른 브랜치 데모의 자원 id 를 거부하므로 쓰지 않는다.
  restoreBundledTilesetDiffs(project);
  return { project, file: abs, bytes, sqlite: false };
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
  const { renderMapPng, addRenderAssetRoot } = await import("../../../../scripts/qa-game/render.mts");
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
  const k = Math.max(1, Math.round(1280 / ref169.width));
  const reference = scaleNearest(ref169, k);

  // 구성기 세계의 방(묘실·보일러실 …)은 야외 칩셋 한 장에 깔리고 기후 표시도 없다 — 부르는 쪽이 --indoor/--outdoor 로 알려 준다.
  const indoorFlag = argv.includes("--indoor") ? true : argv.includes("--outdoor") ? false : undefined;
  const indoor = indoorFlag ?? (map.climate?.mode === "indoor" || /실내|indoor|interior/iu.test(`${tileset?.name ?? ""}`));
  const locNames = (map.locations ?? []).map((l: AnyProject) => l?.name).filter((n: unknown): n is string => typeof n === "string");
  const troop = troopId ? (project.database?.troops ?? []).find((t: AnyProject) => t.id === troopId) : undefined;
  const tl = inferTimeAndLight({ lighting: map.defaultLighting, texts: [...texts, map.name ?? ""], indoor });
  const facts: BackdropFacts = {
    mapId, mapName: String(map.name ?? mapId), tilesetName: String(tileset?.name ?? map.tilesetId), indoor,
    timeOfDay: tl.time, timeCertain: tl.certain, light: tl.light, evidence: [...tl.evidence, ...(indoorFlag === undefined ? [] : [`--${indoorFlag ? "indoor" : "outdoor"} 로 지정`])],
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

// ---------- review (Opus) ----------

const REVIEWS = path.join(DATA, "reviews");
const machineOk = (c: Candidate) => !!c.machine && Object.values(c.machine).every((v) => v.ok);

function flipVertical(img: Rgba): Rgba {
  const row = img.width * 4;
  const data = new Uint8Array(img.data.length);
  for (let y = 0; y < img.height; y += 1) data.set(img.data.subarray(y * row, (y + 1) * row), (img.height - 1 - y) * row);
  return { width: img.width, height: img.height, data };
}

function fitNearest(img: Rgba, w: number, h: number): Rgba {
  const data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const s = (Math.floor((y * img.height) / h) * img.width + Math.floor((x * img.width) / w)) * 4;
    data.set(img.data.subarray(s, s + 4), (y * w + x) * 4);
  }
  return { width: w, height: h, data };
}

type OpusReply = { raw: string; text: string; model: string; runId: string; costUsd?: number };

/**
 * 검수 호출 두 길. 기본은 OpenAI 꼴 중계기(BATTLE_BACKDROP_OPUS_URL · klb/claude-opus-5.5).
 * `BATTLE_BACKDROP_OPUS_VIA=claude-cli` 면 object-gate 최종 판정과 같은 로컬 Claude 경로(`claude -p --model claude-opus-5-5 --effort medium`, 도구 없음)로 묻는다 —
 * 중계기가 503 으로 서 있던 날(2026-11-11~12)에도 검수가 돌게. 두 길 모두 요청·응답 모델이 Opus 가 아니면 멈춘다.
 */
async function callOpus(content: unknown[]): Promise<OpusReply> {
  if (process.env.BATTLE_BACKDROP_OPUS_VIA === "claude-cli") return callOpusCli(content);
  const base = (process.env.BATTLE_BACKDROP_OPUS_URL ?? "http://127.0.0.1:10200/v1").replace(/\/$/u, "");
  const model = process.env.BATTLE_BACKDROP_OPUS_MODEL ?? "klb/claude-opus-5.5";
  if (!isOpusModel(model)) throw new Error(`검수 모델 ${model} 은 Opus 가 아니다 — Opus 만 검수한다`);
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(20 * 60 * 1000),
    body: JSON.stringify({ model, temperature: 0, messages: [{ role: "user", content }] }),
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`Opus 호출 실패 ${res.status}: ${raw.slice(0, 300)}`);
  const d = JSON.parse(raw) as { id?: string; model?: string; choices?: { message?: { content?: string } }[] };
  if (!isOpusModel(d.model)) throw new Error(`응답 모델 ${d.model} 은 Opus 가 아니다`);
  if (!d.id) throw new Error("응답에 run id 가 없다");
  return { raw, text: d.choices?.[0]?.message?.content ?? "", model: d.model!, runId: d.id };
}

function callOpusCli(content: unknown[]): Promise<OpusReply> {
  const model = process.env.BATTLE_BACKDROP_OPUS_MODEL ?? "claude-opus-5-5";
  if (!isOpusModel(model)) throw new Error(`검수 모델 ${model} 은 Opus 가 아니다 — Opus 만 검수한다`);
  // OpenAI 꼴 그림 칸(image_url data URI) → Anthropic 꼴(image base64).
  const blocks = (content as { type: string; text?: string; image_url?: { url: string } }[]).map((c) => {
    if (c.type !== "image_url") return c;
    const m = /^data:(image\/[a-z]+);base64,(.+)$/u.exec(c.image_url?.url ?? "");
    if (!m) throw new Error("검수 그림이 data URI 가 아니다");
    return { type: "image", source: { type: "base64", media_type: m[1], data: m[2] } };
  });
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "oprn-backdrop-review-"));
  return new Promise((done, fail) => {
    const child = spawn(process.env.CLAUDE_BIN ?? "claude", ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--model", model, "--effort", "medium",
      "--tools", "", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}', "--setting-sources", "", "--disable-slash-commands", "--no-session-persistence"], { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill("SIGKILL"); fail(new Error("claude -p 시간 초과(20분)")); }, 20 * 60 * 1000);
    child.stdout.on("data", (c) => { out += c; });
    child.stderr.on("data", (c) => { err += c; });
    child.on("error", (e) => { clearTimeout(timer); fail(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      const events = out.split("\n").filter((l) => l.startsWith("{")).flatMap((l) => { try { return [JSON.parse(l) as Record<string, unknown>]; } catch { return []; } });
      const result = events.find((e) => e.type === "result") as { is_error?: boolean; result?: string; session_id?: string; total_cost_usd?: number; modelUsage?: Record<string, unknown> } | undefined;
      if (!result || result.is_error) return fail(new Error(`claude -p 실패(code ${code}): ${String(result?.result ?? err ?? out).slice(0, 300)}`));
      const used = Object.keys(result.modelUsage ?? {});
      if (!used.length || used.some((m) => !isOpusModel(m))) return fail(new Error(`응답 모델 ${used.join(",") || "없음"} 은 Opus 가 아니다`));
      if (!result.session_id) return fail(new Error("응답에 run id 가 없다"));
      done({ raw: JSON.stringify(result), text: String(result.result ?? ""), model: used[0]!, runId: result.session_id, ...(typeof result.total_cost_usd === "number" ? { costUsd: result.total_cost_usd } : {}) });
    });
    child.stdin.end(`${JSON.stringify({ type: "user", message: { role: "user", content: blocks } })}\n`);
  });
}

async function review(argv: string[]): Promise<number> {
  const ledger = readLedger();
  const run = getRun(ledger, positional(argv)[1]);
  const dir = runDir(run.id);
  const done = reviewedShas(run.reviews ?? []);
  const todo = run.candidates.filter((c) => c.nativePixelSha256 && machineOk(c) && !done.has(c.nativePixelSha256));
  if (!todo.length) { console.log(`[battle-backdrop] ${run.id}: 검수할 후보 없음(기계 검사 통과·미검수 후보가 없다)`); return 0; }
  for (const c of todo) if (pixelSha(readPng(path.join(dir, `native-${c.letter}.png`))) !== c.nativePixelSha256) throw new Error(`${c.letter}: 도트 그림이 기록과 다르다`);
  const wrongBiome = /사막|desert|모래/iu.test(run.facts.placeWords.join(" ")) ? "snow" : "desert";
  const controls: { kind: BackdropControlKind; img: Rgba }[] = [
    { kind: "flipped", img: flipVertical(readPng(path.join(dir, `stored-${todo[0]!.letter}.png`))) },
    { kind: "top-down", img: fitNearest(readPng(path.join(dir, "reference.png")), 640, 360) },
    { kind: "wrong-place", img: readPng(path.join(ROOT, `public/assets/generated/battle-scenery/${wrongBiome}/preview.png`)) },
  ];
  const pool = new Set<string>();
  while (pool.size < todo.length + controls.length) pool.add(String(10 + Math.floor(Math.random() * 90)));
  const labels = [...pool];
  const items: { entry: ReviewEntry; img: Rgba }[] = [
    ...todo.map((c, i) => ({ entry: { label: labels[i]!, pixelSha256: c.nativePixelSha256!, letter: c.letter }, img: readPng(path.join(dir, `stored-${c.letter}.png`)) })),
    ...controls.map((k, i) => ({ entry: { label: labels[todo.length + i]!, pixelSha256: pixelSha(k.img), control: k.kind }, img: k.img })),
  ].sort(() => Math.random() - 0.5);
  const id = `${now().replace(/[-:]/gu, "").replace("T", "-").slice(0, 15)}-${run.id}`;
  const shown = items.map((x) => x.entry.label);
  const png = (img: Rgba) => ({ type: "image_url", image_url: { url: `data:image/png;base64,${encodePng(img).toString("base64")}` } });
  const content: unknown[] = [{ type: "text", text: backdropReviewPrompt(run.facts, shown) }, { type: "text", text: "MAP:" }, png(readPng(path.join(dir, "reference.png")))];
  for (const x of items) content.push({ type: "text", text: `Label ${x.entry.label}:` }, png(x.img));
  let reply = await callOpus(content);
  let costUsd = reply.costUsd ?? 0;
  let answers = parseBackdropReview(reply.text, shown);
  if (!answers) { reply = await callOpus(content); costUsd += reply.costUsd ?? 0; answers = parseBackdropReview(reply.text, shown); }
  fs.mkdirSync(REVIEWS, { recursive: true });
  const rawFile = path.join(REVIEWS, `${id}.json`);
  fs.writeFileSync(rawFile, reply.raw);
  const entries = items.map((x) => x.entry);
  const { counted, reason } = backdropBatchCounts(entries, answers);
  const batch: ReviewBatch = {
    id, at: now(), standard: BACKDROP_REVIEW_STANDARD, model: reply.model, runId: reply.runId,
    rawFile: path.relative(ROOT, rawFile), rawSha256: sha(reply.raw), entries, answers: answers ?? {}, counted, reason,
    ...(costUsd > 0 ? { costUsd: Math.round(costUsd * 10000) / 10000 } : {}),
  };
  (run.reviews ??= []).push(batch);
  writeJson(LEDGER, ledger);
  for (const e of entries) {
    const a = answers?.[e.label];
    console.log(`${e.control ? `디코이(${e.control})` : `후보 ${e.letter}`} #${e.label}: ${a ? `${a.v} ${a.score} — ${a.why}` : "답 없음"}`);
  }
  console.log(`[battle-backdrop] ${run.id} 검수 ${id} (${reply.model}${costUsd > 0 ? ` · $${costUsd.toFixed(2)}` : ""}) — ${counted ? "효력 있음" : "효력 없음"}: ${reason}`);
  return counted ? 0 : 1;
}

const currentPasses = (run: Run) => passingBackdrops(run.reviews ?? [], run.candidates.map((c) => ({ letter: c.letter, nativePixelSha256: c.nativePixelSha256, machineOk: machineOk(c) })));

// ---------- sheet ----------

const dataUri = (file: string) => `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
/** 생성 원본은 크다(약 2MB) — 시트에는 반 크기 JPEG 로 넣는다(도트화 전 참고용이라 화소 정확도가 필요 없다). */
function rawPreviewUri(file: string): string {
  const img = readPng(file);
  const w = Math.floor(img.width / 2), h = Math.floor(img.height / 2);
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) for (let c = 0; c < 4; c += 1) {
    let sum = 0;
    for (let dy = 0; dy < 2; dy += 1) for (let dx = 0; dx < 2; dx += 1) sum += img.data[((y * 2 + dy) * img.width + x * 2 + dx) * 4 + c]!;
    data[(y * w + x) * 4 + c] = sum >> 2;
  }
  return `data:image/jpeg;base64,${jpeg.encode({ width: w, height: h, data }, 82).data.toString("base64")}`;
}
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
      const picked = run.pick?.letter === c.letter ? `<b class="pick">선택됨(${esc(run.pick.by)})</b>` : "";
      const opus = (run.reviews ?? []).flatMap((b) => b.entries.filter((e) => e.letter === c.letter && e.pixelSha256 === c.nativePixelSha256 && b.answers[e.label]).map((e) => ({ b, a: b.answers[e.label]! })));
      const opusHtml = opus.map(({ b, a }) => `<p class="${a.v === "pass" && b.counted ? "ok" : "no"}">Opus ${a.score}점 ${a.v}${b.counted ? "" : " (효력 없는 묶음)"} — ${esc(a.why)}</p>`).join("");
      return `<div class="card" id="${run.id}-${c.letter}"><h3>${c.letter} ${picked} <span class="dim">색 ${c.colors} · 화소 해시 ${c.nativePixelSha256.slice(0, 12)}</span></h3>
<div class="row"><figure><img class="x1" src="${native}"><figcaption>1배 320×180</figcaption></figure>
<figure class="stage"><div class="stagebox" style="background-image:url(${native})"><div class="ground"></div>${battlers()}</div><figcaption>전투 무대 640×480 cover 미리보기(회색 상자 = retro2003 배틀러 자리, 아래 끝이 발 · 점선 = 바닥 띠 시작)</figcaption></figure></div>
<figure><img class="x3" src="${native}"><figcaption>3배</figcaption></figure>
${opusHtml}${judgeHtml}<table>${machine}</table>
<div class="pal">${(c.palette ?? []).map((h) => `<i style="background:${h}" title="${h}${c.extras?.includes(h) ? " (덧색)" : ""}" class="${c.extras?.includes(h) ? "extra" : ""}"></i>`).join("")}</div>
<details><summary>프롬프트</summary><pre>${esc(fs.existsSync(path.join(dir, `prompt-${c.letter}.txt`)) ? fs.readFileSync(path.join(dir, `prompt-${c.letter}.txt`), "utf8") : "")}</pre></details>
<details><summary>생성 원본(도트화 전)</summary><img class="raw" src="${rawPreviewUri(path.join(dir, `raw-${c.letter}.png`))}"></details>
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
.ground{position:absolute;left:0;right:0;top:${(BACKDROP_GROUND_TOP * 100).toFixed(0)}%;border-top:1px dashed #ff0a}.bat{position:absolute;width:60px;height:144px;border:2px solid #fff8;background:#8888;border-radius:4px}
table{border-collapse:collapse;margin:6px 0}td{padding:2px 8px;border-bottom:1px solid #333;font-size:12px}.ok{color:#8d8}.no{color:#f88}.dim{color:#889}.pick{color:#ff0}
.pal i{display:inline-block;width:14px;height:14px;margin-right:1px;border:1px solid #0006}.pal i.extra{outline:2px solid #fc0}figure{margin:0}.facts{display:flex;gap:20px;flex-wrap:wrap}.cmd code{background:#000;padding:2px 6px}
pre{white-space:pre-wrap;background:#111;padding:8px;font-size:12px}</style>
<h1>전투 배경 후보 — ${esc(name)}</h1>
<p>보는 법: 왼쪽 맵 캡처가 전투가 벌어지는 실제 장소다. 각 후보가 <b>같은 장소·같은 시간(낮/밤)·같은 그림체</b>로 읽히는지, 아래 바닥 띠가 배틀러 설 자리로 비어 있는지, 도트로 보이는지를 본다.
기계 검사·판정자 결과는 참고일 뿐이다. Opus 검수(숨긴 디코이, 3.5 통과)를 통과한 후보 중 최고점을 <code>pick --best</code> → <code>build</code> 로 설치한다.</p>
${sections}`;
  fs.mkdirSync(VIZ, { recursive: true });
  const out = path.join(VIZ, `battle-backdrop-${name}.html`);
  fs.writeFileSync(out, html);
  console.log(JSON.stringify({ sheet: out, url: `http://mdc-server:18301/${path.basename(out)}` }));
  return 0;
}

/**
 * 배틀러 자리 표시 — retro2003 무대 640×480. 배틀러 무리는 위에서 56px(스킨 inset) 아래 424px 영역에 깔리고,
 * 저작 좌표 320×160 의 y 는 **발**이다(src/battle/battlerPlacements.ts · battleFieldDom.positionBattleNode · _retro2003.css).
 * 적 1마리 자리(구역 중심 92,117 + 오프셋 -4,4), 아군 4명 222+24i, 82+18i. 상자 = 발 기준 높이 144px(아군 프레임).
 */
function battlers(): string {
  const enemy = [[88, 121]];
  const party = [0, 1, 2, 3].map((i) => [222 + i * 24, 82 + i * 18]);
  const foot = (y: number) => 56 + (y / 160) * 424;
  return [...enemy, ...party].map(([x, y]) => `<div class="bat" style="left:${(x! / 320) * 640 - 30}px;top:${foot(y!) - 144}px"></div>`).join("");
}

// ---------- pick / build ----------

function pick(argv: string[]): number {
  const ledger = readLedger();
  const [, id, letterArg] = positional(argv);
  const run = getRun(ledger, id);
  const by = opt(argv, "by");
  if (!by) throw new Error("--by <고른 사람 또는 근거> 가 필요하다 (Opus 최고점이면 --best --by 'opus-review (owner: …, 날짜)')");
  const best = argv.includes("--best") ? currentPasses(run)[0] : undefined;
  if (argv.includes("--best") && !best) throw new Error(`판 ${run.id}: Opus 검수를 통과한 후보가 없다 — review 를 보고 다시 만든다`);
  const letter = best?.letter ?? letterArg;
  const c = run.candidates.find((x) => x.letter === letter);
  if (!c?.nativePixelSha256) throw new Error(`후보 ${letter} 의 도트 그림이 없다`);
  const dir = runDir(run.id);
  const native = readPng(path.join(dir, `native-${c.letter}.png`));
  const stored = readPng(path.join(dir, `stored-${c.letter}.png`));
  if (pixelSha(native) !== c.nativePixelSha256 || pixelSha(stored) !== c.storedPixelSha256) throw new Error("그림이 기록된 해시와 다르다 — pixelize·sheet 를 다시 하고 다시 고른다");
  run.pick = { letter: c.letter, nativePixelSha256: c.nativePixelSha256, storedPixelSha256: c.storedPixelSha256!, by, at: now(), ...(best ? { score: best.score, batch: best.batch } : {}) };
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
  const target = opt(argv, "target") ?? (run.troopId ? `troop:${run.troopId}` : `map:${run.mapId}`);
  const [kind, targetId] = target.split(":");
  const resourceId = `battle_backdrop_${run.id.replace(/[^a-z0-9]+/giu, "_")}_${run.pick.storedPixelSha256.slice(0, 8)}`;
  const png = encodePng(stored);
  const resource = {
    id: resourceId, name: `전투 배경 · ${run.facts.mapName}`, kind: "backdrop" as const,
    dataUrl: `data:image/png;base64,${png.toString("base64")}`,
  };
  const bundleKey = opt(argv, "bundle");
  if (bundleKey) return bundleStill(ledger, run, stored, bundleKey, argv);
  const emitDir = opt(argv, "emit");
  if (emitDir) {
    // 프로젝트 없이 자원 파일만 낸다 — 코드로 프로젝트를 짓는 빌더(플래그십 데모 등)가 커밋해 두고
    // execTool("upsert_resource", { resource }) 로 넣은 뒤 트룹·맵에 resource.id 를 건다.
    // 그림 화소 해시를 함께 적어 두어 다시 고르면 파일 이름(해시8)부터 바뀐다.
    fs.mkdirSync(emitDir, { recursive: true });
    const pngFile = path.join(emitDir, `${resourceId}.png`);
    const jsonFile = path.join(emitDir, `${resourceId}.json`);
    fs.writeFileSync(pngFile, png);
    const body = { resource, target, run: run.id, pixelSha256: run.pick.storedPixelSha256, width: stored.width, height: stored.height };
    fs.writeFileSync(jsonFile, `${JSON.stringify(body, null, 2)}\n`);
    const back = JSON.parse(fs.readFileSync(jsonFile, "utf8")) as typeof body;
    const reloaded = back.resource.dataUrl === resource.dataUrl && pixelSha(readPng(pngFile)) === run.pick.storedPixelSha256;
    (run.builds ??= []).push({ at: now(), target, resourceId, storedPixelSha256: run.pick.storedPixelSha256, into: jsonFile, reloaded });
    writeJson(LEDGER, ledger);
    console.log(JSON.stringify({ resourceId, target, into: jsonFile, png: pngFile, reloaded }));
    return reloaded ? 0 : 1;
  }
  const projectArg = opt(argv, "project");
  if (!projectArg) throw new Error("--project 또는 --emit <폴더> 가 필요하다");
  const loaded = await loadProject(projectArg);
  const project = loaded.project;
  project.assets ??= {}; project.assets.uploaded ??= {};
  project.assets.uploaded[resourceId] = {
    ...resource,
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
  const fieldMode = project.system?.battleBackdrop === "field" || project.system?.battlePresentation === "onField";
  if (fieldMode && argv.includes("--leave-field-mode")) {
    // 프로젝트 전체의 전투 표시가 바뀐다(모든 전투가 필드 화면 대신 트룹·맵 배경을 그린다) — 명시 스위치로만.
    delete project.system.battleBackdrop;
    if (project.system.battlePresentation === "onField") delete project.system.battlePresentation;
    warn.push("system.battleBackdrop field/onField 를 껐다 — 이제 모든 전투가 트룹·맵 배경을 그린다");
  } else if (fieldMode) {
    warn.push("system.battleBackdrop=field/onField — 전투가 필드 화면을 그리므로 이 그림은 필드 화면이 없을 때만 보인다. 보이게 하려면 --leave-field-mode(프로젝트 전체 전투 표시가 바뀐다)");
  }
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

// ---------- build --bundle (공용 번들의 장소 그림) ----------

const STILLS_JSON = path.join(ROOT, "src/assets/battleSceneryStills.json");
const SCENERY_DIR = path.join(ROOT, "public/assets/generated/battle-scenery");
type StillRecord = { key: string; ko: string; en: string; run: string; pixelSha256: string; nativePixelSha256: string; score: number; batch: string; by: string; place: string };

/**
 * 고른 그림을 공용 번들의 장소 그림 `battle-scenery-<키>` 로 싣는다 — 겹 배경 다섯과 같은 자리(public/assets/generated/battle-scenery/<키>/preview.png)와
 * 같은 id 틀이라 프로젝트마다 자원을 넣지 않아도 새·기존 프로젝트가 모두 푼다(src/assets/battleSceneryCatalog.ts BATTLE_SCENERY_STILLS).
 * 번들에는 Opus 검수로 고른(pick --best) 그림만, 그 판정이 지금 화소에도 효력이 있을 때만 싣는다. 사람이 글자로 고른 판은 프로젝트 설치(--project)만 된다.
 */
function bundleStill(ledger: Ledger, run: Run, stored: Rgba, key: string, argv: string[]): number {
  const ko = opt(argv, "ko"), en = opt(argv, "en");
  if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/u.test(key)) throw new Error(`--bundle 키는 소문자·숫자·하이픈이다: ${key}`);
  if (!ko || !en) throw new Error("--bundle 에는 --ko <이름> --en <name> 이 필요하다(고르기 목록·도구 설명에 보인다)");
  if (fs.existsSync(path.join(SCENERY_DIR, key, "sky.png"))) throw new Error(`${key} 는 겹 배경 종류다 — 다른 키를 쓴다`);
  const pick = run.pick!;
  const pass = currentPasses(run).find((p) => p.letter === pick.letter && p.pixelSha256 === pick.nativePixelSha256);
  if (!pick.batch || pick.score === undefined || !pass) throw new Error(`판 ${run.id}: 번들에는 Opus 검수로 고른 그림만 싣는다 — review 뒤 pick --best 로 고른다`);
  if (stored.width !== BACKDROP_NATIVE_WIDTH * BACKDROP_STORE_SCALE || stored.height !== BACKDROP_NATIVE_HEIGHT * BACKDROP_STORE_SCALE) throw new Error(`저장본 크기 ${stored.width}×${stored.height} 가 번들 규격(640×360)이 아니다`);
  const file = path.join(SCENERY_DIR, key, "preview.png");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, encodeIndexedPng(stored) ?? encodePng(stored));
  const reloaded = pixelSha(readPng(file)) === pick.storedPixelSha256;
  if (!reloaded) throw new Error(`${file}: 쓴 그림의 화소가 고른 그림과 다르다`);
  const doc = JSON.parse(fs.readFileSync(STILLS_JSON, "utf8")) as { version: 1; about: string; stills: StillRecord[] };
  const record: StillRecord = { key, ko, en, run: run.id, pixelSha256: pick.storedPixelSha256, nativePixelSha256: pick.nativePixelSha256, score: pick.score, batch: pick.batch, by: pick.by, place: run.facts.mapName };
  doc.stills = [...doc.stills.filter((s) => s.key !== key), record].sort((a, b) => a.key.localeCompare(b.key));
  writeJson(STILLS_JSON, doc);
  const resourceId = `battle-scenery-${key}`;
  (run.builds ??= []).push({ at: now(), target: `bundle:${key}`, resourceId, storedPixelSha256: pick.storedPixelSha256, into: path.relative(ROOT, file), reloaded });
  writeJson(LEDGER, ledger);
  console.log(JSON.stringify({ resourceId, target: `bundle:${key}`, into: path.relative(ROOT, file), bytes: fs.statSync(file).size, score: pick.score, reloaded }));
  return 0;
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
    const passes = currentPasses(run).map((p) => `${p.letter}:${p.score}`).join(",") || "없음";
    console.log(`${run.id} · ${run.facts.mapName} · ${run.facts.timeOfDay}/${run.facts.light} · 후보 ${run.candidates.length} [${cands}] · Opus 통과 ${passes} · 선택 ${run.pick ? `${run.pick.letter}(${run.pick.by})` : "없음"} · 설치 ${run.builds?.length ?? 0}`);
  }
  if (!runs.length) console.log("판 없음 — capture 부터");
  return 0;
}

export async function run(argv: string[]): Promise<number> {
  const stage = argv[0];
  if (stage && LEDGER_WRITERS.has(stage)) {
    const release = lockLedger(stage);
    try { return await runStage(stage, argv); } finally { release(); }
  }
  return runStage(stage, argv);
}

/** 단계마다 원장을 읽고 몇 분 일한 뒤 통째로 쓴다 — 둘이 동시에 돌면 서로의 판·후보·검수 기록을 지운다(2026-11-04 실측). 기다리지 않고 거절한다. */
const LEDGER_WRITERS = new Set(["capture", "produce", "pixelize", "check", "review", "pick", "build"]);
const LOCK = path.join(DATA, ".ledger.lock");
function lockLedger(stage: string): () => void {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      fs.writeFileSync(LOCK, `${process.pid} ${stage} ${now()}`, { flag: "wx" });
      return () => { if (fs.readFileSync(LOCK, "utf8").startsWith(`${process.pid} `)) fs.rmSync(LOCK); };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      const held = fs.readFileSync(LOCK, "utf8");
      const pid = Number(held.split(" ")[0]);
      let alive = Number.isInteger(pid) && pid > 0;
      if (alive) { try { process.kill(pid, 0); } catch { alive = false; } }
      if (alive) throw new Error(`다른 battle-backdrop 단계가 원장을 잡고 있다(${held}) — 단계는 하나씩 돌린다`);
      fs.rmSync(LOCK, { force: true });
    }
  }
  throw new Error(`원장 잠금을 잡지 못했다: ${LOCK}`);
}

async function runStage(stage: string | undefined, argv: string[]): Promise<number> {
  switch (stage) {
    case "capture": return capture(argv);
    case "produce": return produce(argv);
    case "pixelize": return pixelize(argv);
    case "check": return check(argv);
    case "review": return review(argv);
    case "sheet": return sheet(argv);
    case "pick": return pick(argv);
    case "build": return build(argv);
    case "status": case "list": return status(argv);
    default:
      console.error("battle-backdrop capture|produce|pixelize|check|review|sheet|pick|build|status — 문서 openwiki/harnesses/battle-backdrop.md");
      return 2;
  }
}

void BACKDROP_NATIVE_WIDTH; void BACKDROP_NATIVE_HEIGHT;
