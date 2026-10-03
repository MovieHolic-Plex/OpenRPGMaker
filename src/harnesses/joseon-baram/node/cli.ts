/**
 * npm run harness -- joseon-baram <단계> [옵션]
 *
 *   palette                                    팔레트 잠금 검사(파일을 쓰지 않는다)
 *   validate [--deep]                          시드·메타·지도 관문 임계·스크린샷 추적 점검(--deep 은 카탈로그 대조, 약 20초)
 *   list [pieces|maps] [--class C] [--status S] [--adv keep|block|none]
 *   gate [--candidate] [--sheets] [--piece a,b] [--all] [--out DIR]
 *                                              조각 관문 P·E·T·L·S·A·K·TR·V (--candidate 는 A 만 건너뜀, 약 20초)
 *   verdict <조각> <pass|note|user|redo> "<한 줄>" [--dry]
 *                                              검수 시트를 눈으로 본 뒤 판정 기록(현재 해시에 묶임)
 *   build [--dry] [--regen-village] [--report-only] [--gungnae-dir D] [--gungnae-full-dir D] [--save-dir D]
 *                                              rebuild-joseon.sh (약 70초). --dry 는 계획·입력 점검만
 *   map <지도id> [--dry] [--write] [--candidate] [--seed N] [--out DIR] [--stage N]
 *                                              지도 빌더 + 지도 관문 M1~M7
 *   review zones <지도id> [--out DIR] [--scale N]     16구역 크롭 + 렌즈 프롬프트
 *   review pieces (--piece a,b | --blocked [--limit N]) [--out DIR]
 *   review record <리뷰어 출력.json>            적대 리뷰 기록(조각 현재 해시에 묶임)
 *   review status                              조각별 렌즈 결과(adversarial.py status)
 *   status [--fresh]                           현황
 *
 * 실제 일은 scripts/content/lib/joseon/ 의 기존 도구가 한다. 이 파일은 입구만 맡는다.
 * 종료코드: 0 성공 · 1 검사/실행 실패 · 2 사용법 오류.
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { JOSEON_BARAM_HARNESS } from "../harness";
import type { JoseonMap, JoseonSeed } from "../seed";
import { appendLedger } from "./ledger";
import { loadSeed, REPO_ROOT, repoPath, runsBase } from "./paths";

export type CliIo = {
  out(text: string): void;
  err(text: string): void;
  /** true 면 자식 출력을 모아 io 로 넘긴다(시험). false 면 터미널에 바로 흘린다. */
  capture: boolean;
};

const consoleIo: CliIo = {
  out: (text) => void process.stdout.write(text),
  err: (text) => void process.stderr.write(text),
  capture: false,
};

type Flags = Map<string, string | true>;
type Args = { pos: string[]; flags: Flags };

const BOOLEAN_FLAGS = new Set([
  "deep", "candidate", "sheets", "all", "dry", "write", "fresh", "blocked", "regen-village", "report-only",
]);

function parseArgs(argv: string[]): Args {
  const pos: string[] = [];
  const flags: Flags = new Map();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (!token.startsWith("--")) {
      pos.push(token);
      continue;
    }
    const name = token.slice(2);
    const next = argv[i + 1];
    if (BOOLEAN_FLAGS.has(name) || next === undefined || next.startsWith("--")) flags.set(name, true);
    else {
      flags.set(name, next);
      i += 1;
    }
  }
  return { pos, flags };
}

function flagValue(args: Args, name: string): string | undefined {
  const value = args.flags.get(name);
  return typeof value === "string" ? value : undefined;
}

type Spawned = { status: number; stdout: string; stderr: string };

/** 자식 프로세스를 돌린다. capture 면 출력을 io 로 넘기고, 아니면 터미널에 바로 흘린다. */
function spawnStep(io: CliIo, command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; forceCapture?: boolean } = {}): Spawned {
  const capture = io.capture || options.forceCapture === true;
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? REPO_ROOT,
    env: options.env ?? process.env,
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  const stdout = capture ? (result.stdout ?? "") : "";
  const stderr = capture ? (result.stderr ?? "") : "";
  if (capture && io.capture) {
    if (stdout) io.out(stdout);
    if (stderr) io.err(stderr);
  }
  if (result.error) {
    io.err(`${command} 실행 실패: ${result.error.message}\n`);
    return { status: 1, stdout, stderr: stderr + String(result.error.message) };
  }
  return { status: result.status ?? 1, stdout, stderr };
}

function bridge(io: CliIo, seed: JoseonSeed, argv: string[], forceCapture = false): Spawned {
  return spawnStep(io, "python3", [repoPath(seed.toolchain.bridge!), ...argv], { forceCapture });
}

/** 저장소 안이면 상대 경로, 밖이면 절대 경로로 보여 준다. */
function shown(path: string): string {
  const rel = relative(REPO_ROOT, path);
  return rel.startsWith("..") ? path : rel;
}

function sha256Of(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function line(io: CliIo, text = ""): void {
  io.out(text + "\n");
}

function usage(io: CliIo): void {
  line(io, `${JOSEON_BARAM_HARNESS.id} — ${JOSEON_BARAM_HARNESS.title}`);
  line(io, "사용법: npm run harness -- joseon-baram <단계> [옵션]");
  for (const stage of JOSEON_BARAM_HARNESS.stages) line(io, `  ${stage.id.padEnd(9)} ${stage.title} — ${stage.summary}`);
  line(io, `시드 ${JOSEON_BARAM_HARNESS.seed} · 문서 ${JOSEON_BARAM_HARNESS.doc}`);
}

// ───────────────────────── 단계 ─────────────────────────

function stageVerdict(io: CliIo, seed: JoseonSeed, args: Args): number {
  const [piece, status, ...lineParts] = args.pos;
  const text = lineParts.join(" ").trim();
  if (!piece || !status || !text) {
    io.err('사용법: verdict <조각> <pass|note|user|redo> "<한 줄: 윗면이 얼마나 보이나, 기준 조각과 무엇이 다른가>"\n');
    return 2;
  }
  if (!seed.verdictStatuses.includes(status)) {
    io.err(`상태는 ${seed.verdictStatuses.join("|")} 중 하나: ${status}\n`);
    return 2;
  }
  if (text.length < 8) {
    io.err("한 줄 판정이 너무 짧다(8자 미만). 윗면이 얼마나 보이는지·기준 조각과 무엇이 다른지를 적는다.\n");
    return 2;
  }
  const sheetName = seed.terrainWithVerdict.includes(piece) ? "water47.png" : `${piece}.png`;
  const sheet = repoPath(`tiledata/joseon-demo/review/${sheetName}`);
  if (!existsSync(sheet)) {
    io.err(`WARN 검수 시트가 없다(${relative(REPO_ROOT, sheet)}). gate --sheets 로 만들어 기준 조각 옆에서 눈으로 본 뒤에만 판정한다.\n`);
  }
  if (args.flags.has("dry")) {
    line(io, `[dry] ${piece} → ${status}: ${text}`);
    line(io, "      verdicts.json 의 이 조각 줄을 현재 그림 해시(sha1 앞 12자)에 묶어 쓴다. 그림이 바뀌면 gate 의 V 가 다시 막는다.");
    return 0;
  }
  const verdictScript = repoPath(seed.toolchain.verdict!);
  const result = spawnStep(io, "python3", [verdictScript, piece, status, text], { cwd: repoPath(seed.toolchain.harnessDir!), forceCapture: true });
  if (result.status !== 0) {
    if (/KeyError/.test(result.stderr)) io.err(`카탈로그에 없는 조각이다: ${piece} (verdicts.json 은 바뀌지 않았다)\n`);
    else io.err(result.stderr);
    return 1;
  }
  io.out(result.stdout);
  const record = (JSON.parse(readFileSync(repoPath(seed.toolchain.verdicts!), "utf8")) as Record<string, { hash: string }>)[piece];
  appendLedger("verdict", { piece, status, hash: record?.hash ?? null, line: text });
  return 0;
}

type BuildInput = { map: JoseonMap; dir: string };

function buildInputs(seed: JoseonSeed, args: Args): BuildInput[] {
  const overrides: Record<string, string | undefined> = {
    gungnae: flagValue(args, "gungnae-dir"),
    gungnae_full: flagValue(args, "gungnae-full-dir"),
  };
  return seed.maps.map((map) => ({ map, dir: resolve(REPO_ROOT, overrides[map.id] ?? map.out) }));
}

function stageBuild(io: CliIo, seed: JoseonSeed, args: Args): number {
  const inputs = buildInputs(seed, args);
  const missing: string[] = [];
  for (const { map, dir } of inputs) {
    for (const template of seed.mapFiles) {
      // 재굽기 입력은 칩셋 시트·pieces·map·extra 다(미리보기 지도 그림은 입력이 아니다)
      if (template.endsWith("-map.png")) continue;
      const file = join(dir, template.replace("{stem}", map.stem));
      if (!existsSync(file)) missing.push(relative(REPO_ROOT, file));
    }
  }
  const palette = bridge(io, seed, ["palette"], true);
  const regen = args.flags.has("regen-village");
  const saveDir = flagValue(args, "save-dir");
  const env: NodeJS.ProcessEnv = { ...process.env };
  const envNotes: string[] = [];
  const g = inputs.find((i) => i.map.id === "gungnae");
  const f = inputs.find((i) => i.map.id === "gungnae_full");
  if (flagValue(args, "gungnae-dir") && g) { env.GUNGNAE_DIR = g.dir; envNotes.push(`GUNGNAE_DIR=${g.dir}`); }
  if (flagValue(args, "gungnae-full-dir") && f) { env.GUNGNAE_FULL_DIR = f.dir; envNotes.push(`GUNGNAE_FULL_DIR=${f.dir}`); }
  if (regen) { env.REGEN_VILLAGE = "1"; envNotes.push("REGEN_VILLAGE=1"); }
  if (args.flags.has("report-only")) { env.JOSEON_REPORT_ONLY = "1"; envNotes.push("JOSEON_REPORT_ONLY=1"); }
  if (saveDir) { env.JOSEON_SAVE_DIR = resolve(saveDir); envNotes.push(`JOSEON_SAVE_DIR=${env.JOSEON_SAVE_DIR}`); }

  line(io, "재굽기 계획 (bash scripts/content/rebuild-joseon.sh, 약 70초):");
  if (regen) line(io, "  0) 마을 20호 기준 시트를 지금 카탈로그로 다시 굽는다(demo20.py, 약 40초) — 경고: 기준 시트 칸 번호가 바뀌어 이미 배포된 맵이 어긋난다.");
  line(io, "  1) build-joseon-tileset.py  시트 3장 합치기·통행·오토타일·키트·맵 JSON");
  line(io, "  2) prepare-joseon-baram-references.py  참고문서 6용도·그림·오류 변조 검출");
  line(io, "  3) save-joseon-baram.mjs  임시 폴더 저장 → 재로드 deepEqual → 엔진 통행·마스크 대조");
  line(io, "  4) prepare-joseon-regions.mjs  장소 카드·스냅숏");
  line(io, "  5) 목록 축소본(catalog-thumbs)");
  line(io, `환경: ${envNotes.length ? envNotes.join(" ") : "(기본 입력 위치)"}`);
  for (const { map, dir } of inputs) line(io, `입력 ${map.id.padEnd(13)} ${relative(REPO_ROOT, dir)}`);
  line(io, `팔레트 잠금: ${palette.status === 0 ? "OK" : "FAIL"}`);
  if (palette.status !== 0) io.err(palette.stdout);
  if (missing.length) {
    io.err(`FAIL 재굽기 입력이 없다:\n  ${missing.join("\n  ")}\n`);
    return 1;
  }
  if (palette.status !== 0) return 1;
  line(io, "입력 점검 OK");
  if (args.flags.has("dry")) {
    line(io, "[dry] 실행하지 않았다.");
    return 0;
  }
  const started = Date.now();
  const result = spawnStep(io, "bash", [repoPath(seed.toolchain.rebuild!)], { env });
  const stats = existsSync(repoPath("tiledata/joseon-village/build-stats.json"))
    ? (JSON.parse(readFileSync(repoPath("tiledata/joseon-village/build-stats.json"), "utf8")) as { count?: number })
    : {};
  const sheet = repoPath(seed.tileset.sheet);
  appendLedger("build", {
    ok: result.status === 0,
    exit: result.status,
    seconds: Math.round((Date.now() - started) / 1000),
    env: envNotes,
    tileCount: stats.count ?? null,
    sheetSha256: existsSync(sheet) ? sha256Of(sheet) : null,
  });
  return result.status === 0 ? 0 : 1;
}

function stageMap(io: CliIo, seed: JoseonSeed, args: Args): number {
  const id = args.pos[0];
  const map = seed.maps.find((m) => m.id === id);
  if (!map) {
    io.err(`지도 id 가 필요하다: ${seed.maps.map((m) => m.id).join(", ")}\n`);
    return 2;
  }
  for (const name of ["JS_SKIPGATE", "JS_FORCE"]) {
    if (process.env[name]) {
      io.err(`${name} 가 환경에 있다. 이 하네스는 게이트·지도 관문을 우회하는 실행을 하지 않는다. 환경에서 지우고 다시 실행한다.\n`);
      return 2;
    }
  }
  const write = args.flags.has("write");
  const outFlag = flagValue(args, "out");
  const isV20 = map.id === "joseon_v20";
  if (outFlag && !isV20) {
    io.err(`${map.id} 빌더는 산출 폴더를 바꾸지 못한다(--out 은 joseon_v20 만). tiledata 를 덮어쓰려면 --write.\n`);
    return 2;
  }
  if (!isV20 && !write && !args.flags.has("dry")) {
    io.err(`${map.id} 빌더는 ${map.out}/ 의 추적 파일을 덮어쓴다. 확인했다면 --write 를 준다(계획만 보려면 --dry).\n`);
    return 2;
  }
  const seedNumber = flagValue(args, "seed") ?? String(map.builderSeed);
  const env: NodeJS.ProcessEnv = { ...process.env, JS_PROFILE: map.profile, JS_SEED: seedNumber };
  const builderArgs = [repoPath(map.builder)];
  let outDir = resolve(REPO_ROOT, map.out);
  if (isV20) {
    if (args.flags.has("candidate")) builderArgs.push("--candidate");
    if (!write) {
      outDir = outFlag ? resolve(outFlag) : join(runsBase(), `map-${map.id}`);
      env.JS_OUT = outDir;
    }
  } else {
    const stage = flagValue(args, "stage");
    if (stage && map.id === "gungnae_full") env.JS_STAGE = stage;
  }
  const profile = seed.mapGate.profiles[map.profile]!;
  line(io, `지도 ${map.id} (${map.name}, ${map.size[0]}x${map.size[1]}칸) 빌드 계획:`);
  line(io, `  python3 ${map.builder}${builderArgs.length > 1 ? " " + builderArgs.slice(1).join(" ") : ""}   (cwd ${seed.toolchain.dir}, JS_PROFILE=${map.profile} JS_SEED=${seedNumber}${env.JS_OUT ? ` JS_OUT=${env.JS_OUT}` : ""})`);
  line(io, `  1) 조각 게이트(${isV20 ? (args.flags.has("candidate") ? "A 만 건너뜀" : "A 포함 — 지금은 A 가 전부 막아 --candidate 가 필요") : "A 만 건너뜀"})  2) 지도 관문 M1~M7 임계: 맨 잔디 창 ≤${profile.lawnMax} · 수관 ≥${profile.treeMin} · 물체 ≥${profile.objMin} · 건물 밀도 ≥${profile.bldMin} · 겹침 ≥${profile.depthMin}`);
  line(io, `  산출: ${shown(outDir)}/ ${isV20 && !write ? "(추적 파일이 아니다)" : "(추적 파일을 덮어쓴다)"}`);
  if (map.overwritesTracked && write) line(io, `  경고: ${map.role}`);
  if (args.flags.has("dry")) {
    line(io, "[dry] 실행하지 않았다.");
    return 0;
  }
  const started = Date.now();
  const result = spawnStep(io, "python3", builderArgs, { cwd: repoPath(seed.toolchain.dir!), env });
  const mapImage = join(outDir, `${map.stem}-map.png`);
  appendLedger("map", {
    id: map.id,
    ok: result.status === 0,
    exit: result.status,
    seconds: Math.round((Date.now() - started) / 1000),
    profile: map.profile,
    seed: Number(seedNumber),
    out: shown(outDir).startsWith("/") ? "(저장소 밖)" : shown(outDir),
    mapSha256: result.status === 0 && existsSync(mapImage) ? sha256Of(mapImage) : null,
  });
  if (result.status !== 0) io.err("지도 빌드 실패 — 출력의 `게이트 FAIL`·`지도 게이트 FAIL` 줄을 본다. 게이트를 우회하지 않는다.\n");
  return result.status === 0 ? 0 : 1;
}

function stageReview(io: CliIo, seed: JoseonSeed, args: Args, argv: string[]): number {
  const [kind, ...rest] = args.pos;
  if (kind === "zones" || kind === "pieces") {
    const result = bridge(io, seed, ["review", ...argv]);
    if (result.status === 0 && kind === "zones") {
      const id = rest[0]!;
      const outFlag = flagValue(args, "out");
      const out = outFlag ? resolve(outFlag) : join(runsBase(), "review", `zones-${id}`);
      const manifest = join(out, "manifest.json");
      if (existsSync(manifest)) {
        const m = JSON.parse(readFileSync(manifest, "utf8")) as { sourceSha256: string; zones: unknown[]; scale: number };
        appendLedger("review", { kind: "zones", map: id, sourceSha256: m.sourceSha256, zones: m.zones.length, scale: m.scale });
      }
    }
    return result.status;
  }
  if (kind === "record") {
    const file = rest[0];
    if (!file) {
      io.err("사용법: review record <리뷰어 출력.json>\n");
      return 2;
    }
    const path = resolve(file);
    if (!existsSync(path)) {
      io.err(`파일이 없다: ${file}\n`);
      return 2;
    }
    const adversarial = repoPath(seed.toolchain.adversarial!);
    const result = spawnStep(io, "python3", [adversarial, "record", path], { cwd: repoPath(seed.toolchain.harnessDir!), forceCapture: true });
    if (result.status !== 0) {
      io.err(result.stderr);
      return 1;
    }
    io.out(result.stdout);
    appendLedger("review", { kind: "record", file: relative(REPO_ROOT, path).startsWith("..") ? "(저장소 밖)" : relative(REPO_ROOT, path), sha256: sha256Of(path), output: result.stdout.trim() });
    return 0;
  }
  if (kind === "status") {
    const adversarial = repoPath(seed.toolchain.adversarial!);
    return spawnStep(io, "python3", [adversarial, "status"], { cwd: repoPath(seed.toolchain.harnessDir!) }).status;
  }
  io.err("review 는 zones <지도id> | pieces | record <json> | status 를 받는다\n");
  return 2;
}

/** 하네스 CLI 본체. io 를 주면 출력을 모은다(시험). */
export async function main(argv: string[], io: CliIo = consoleIo): Promise<number> {
  const [step, ...rest] = argv;
  if (!step || step === "help" || step === "--help") {
    usage(io);
    return 0;
  }
  const known = JOSEON_BARAM_HARNESS.stages.map((stage) => stage.id);
  if (!known.includes(step)) {
    io.err(`모르는 단계: ${step}. 단계: ${known.join(", ")}\n`);
    return 2;
  }
  let seed: JoseonSeed;
  try {
    seed = loadSeed();
  } catch (error) {
    io.err(`${error instanceof Error ? error.message : String(error)}\n`);
    return 1;
  }
  const args = parseArgs(rest);
  switch (step) {
    case "palette":
    case "list":
    case "gate":
    case "status":
      return bridge(io, seed, [step, ...rest]).status;
    case "validate": {
      line(io, "시드 구조 OK");
      return bridge(io, seed, ["validate", ...rest]).status;
    }
    case "verdict":
      return stageVerdict(io, seed, args);
    case "build":
      return stageBuild(io, seed, args);
    case "map":
      return stageMap(io, seed, args);
    case "review":
      return stageReview(io, seed, args, rest);
    default:
      io.err(`단계 ${step} 의 구현이 없다\n`);
      return 2;
  }
}

export async function run(argv: string[]): Promise<number> {
  return main(argv, consoleIo);
}
