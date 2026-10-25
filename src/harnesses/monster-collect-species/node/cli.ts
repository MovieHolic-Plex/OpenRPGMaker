/**
 * npm run harness -- monster-collect-species <단계> [옵션]
 *
 *   status                                     시드의 종마다 진행 현황
 *   front  --species <id> [--n 6]              앞모습 후보 생성 → qa-runs/harnesses/.../<종>/front/<run>/sheet.html
 *   back   --species <id> [--n 3]              고른 앞모습으로 뒷모습 후보 생성
 *   action --species <id> --side front|back --action <동작> [--n 2]
 *                                              큰 동작(공격·피격) 한 줄 후보 생성 (sprite-gen 방식, anim/row.ts)
 *   import --species <id> --side front|back [--action <동작>] --raw <png[,png…]> [--prompt <text>] [--block <2..40>]
 *                                              이미 있는 생성 원본을 후보 run 으로 등록
 *   pick   --species <id> --side front|back [--action <동작>] --run <run> --candidate <k> [--note <text>]
 *   build                                      골라 둔 격자 → public/assets/harnesses/... 스프라이트·대기·동작 스트립 + 검사
 *   check                                      번들 검사만 (색·윤곽·애니메이션·실루엣 겹침)
 *   refit [--species <id>]                     후보 폴더의 스프라이트·시트를 현재 캔버스 규격으로 다시 만든다(생성 없음)
 *   grid                                       고른 그림마다 블록 크기·원본 칸 수·축소 여부 (격자 계약)
 *   manifest                                   번들 폴더 → 런타임 목록(src/assets/harnessMonsterBundle.json). build 가 끝에 자동 실행
 *   preview [--species <id>]                   번들 스프라이트·애니메이션을 한 쪽 HTML 로 (qa-runs/.../preview/)
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { MONSTER_COLLECT_SPECIES_HARNESS } from "../harness";
import { cleanReference, magentaCanvas, pixelize, toSprite } from "../pixel/pipeline";
import type { GridOptions } from "../pixel/grid";
import { MAX_INK_SIDE, SPRITE_CANVAS, type FitResult, type SpriteSide } from "../pixel/fit";
import { checkEyes } from "../checks/eyes";
import { checkDirection, checkFrames, checkPair, checkSprite, similarSilhouettes, type CheckIssue } from "../checks/checks";
import { checkEyePlacement, checkLineStyles, validateEyeTable } from "../checks/eyeTable";
import { actionPrompt, backPrompt, evolutionPrompt, frontPrompt } from "../prompts/prompts";
import { emptyLedger, validateSeed, type ActionContract, type ActionKind, type MonsterLedger, type MonsterSeed, type SpeciesSeed } from "../seed";
import { idleFrames } from "../anim/idle";
import { fromStrip, rowBlockHint, rowFrames, rowReference, splitRow, toStrip } from "../anim/row";
import { cropToInk, isOpaque, type RgbaImage } from "../pixel/image";
import { spriteEmitPoint } from "../../../battle/pokemonMoveMotion";
import { encodePng, readPng, writePng } from "./png";
import { generateImage, mapLimit } from "./imageSource";
import { PATHS, relativeToRepo } from "./paths";

type Args = { positional: string[]; flags: Map<string, string> };

function parseArgs(argv: string[]): Args {
  const positional: string[] = [];
  const flags = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (token.startsWith("--")) {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) flags.set(token.slice(2), "true");
      else {
        flags.set(token.slice(2), next);
        i += 1;
      }
    } else positional.push(token);
  }
  return { positional, flags };
}

function need(args: Args, name: string): string {
  const value = args.flags.get(name);
  if (!value) throw new Error(`--${name} 가 필요하다`);
  return value;
}

function side(args: Args): SpriteSide {
  const value = need(args, "side");
  if (value !== "front" && value !== "back") throw new Error("--side 는 front 또는 back");
  return value;
}

function loadSeed(): MonsterSeed {
  return validateSeed(JSON.parse(readFileSync(PATHS.seed, "utf8")));
}

function loadLedger(): MonsterLedger {
  return existsSync(PATHS.ledger) ? (JSON.parse(readFileSync(PATHS.ledger, "utf8")) as MonsterLedger) : emptyLedger();
}

function saveLedger(ledger: MonsterLedger): void {
  mkdirSync(PATHS.data, { recursive: true });
  writeFileSync(PATHS.ledger, JSON.stringify(ledger, null, 2) + "\n");
}

function speciesOf(seed: MonsterSeed, id: string): SpeciesSeed {
  const species = seed.species.find((s) => s.id === id);
  if (!species) throw new Error(`시드에 종 ${id} 가 없다. ${relativeToRepo(PATHS.seed)} 에 먼저 적는다`);
  return species;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function runId(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "").replace("T", "-");
}

function gridPath(speciesId: string, which: SpriteSide): string {
  return join(PATHS.grids, `${speciesId}-${which}.png`);
}

function bundlePath(speciesId: string, which: SpriteSide): string {
  return join(PATHS.bundle, speciesId, `${which}.png`);
}

function animPath(speciesId: string, which: SpriteSide, state: string): string {
  return join(PATHS.bundle, speciesId, "anim", `${which}-${state}.png`);
}

function actionGridPath(speciesId: string, which: SpriteSide, action: string): string {
  return join(PATHS.grids, `${speciesId}-${which}-${action}.png`);
}

/** 동작 프레임 검사 + 방향 검사 (attack 은 공격 방향, hurt 는 반대, self 는 없음) */
function actionIssues(seed: MonsterSeed, which: SpriteSide, kind: ActionKind, frames: RgbaImage[], base: RgbaImage): CheckIssue[] {
  const issues = checkFrames(frames, base, seed.style.maxColors, "action");
  const x = seed.animation.direction[which].x;
  if (kind === "attack") issues.push(...checkDirection(frames, x, "공격"));
  // 피격: 공격자 쪽(앞) 끝이 뒤로 물러나야 한다 — 재는 쪽은 앞(x), 움직임은 반대(−x)
  if (kind === "hurt") issues.push(...checkDirection(frames, -x, "피격 밀림", 2, x));
  return issues;
}

function actionOf(seed: MonsterSeed, id: string): ActionContract {
  const action = seed.animation.actions[id];
  if (!action) throw new Error(`시드에 동작 ${id} 가 없다 (있는 동작: ${Object.keys(seed.animation.actions).join(", ")})`);
  return action;
}

/** 골라 둔 격자에서 그 면의 스프라이트 — 큰 동작의 기준·참고 그림 */
function pickedSprite(ledger: MonsterLedger, species: SpeciesSeed, which: SpriteSide): RgbaImage {
  const pick = ledger.picks[species.id]?.[which];
  if (!pick) throw new Error(`${species.id} ${which} 를 먼저 고른다 (pick --side ${which})`);
  return toSprite(readPng(resolve(PATHS.data, pick.grid)), which, species.stage).sprite;
}

/**
 * 줄 격자 → 캔버스 프레임 (build 와 후보 시트가 같은 함수를 쓴다). 0번 폭을 기준 스프라이트 폭에 맞추고,
 * 공격·피격은 뒷발(공격 방향 반대쪽 끝)을 고정한다 — 덤빈 거리가 프레임 안에 남는다.
 */
function actionFramesFromGrid(seed: MonsterSeed, actionId: string, grid: RgbaImage, which: SpriteSide, stage: 1 | 2 | 3, base: RgbaImage) {
  const action = actionOf(seed, actionId);
  const rear = (action.kind === "self" ? 0 : -Math.sign(seed.animation.direction[which].x)) as -1 | 0 | 1;
  return rowFrames(splitRow(grid, action.frames), which, stage, cropToInk(base).width, rear);
}

/** eye: 눈 규칙(checks/eyes.ts) 결과 — 앞모습 pass=false 는 판정 대상 탈락, pair 는 두 눈 확인(참고) */
type Candidate = { k: number; raw: string; grid: string; sprite: string; sha256: string; block: number; colors: number; issues: CheckIssue[]; eye?: { pass: boolean; pair: boolean } };
type RunRecord = { species: string; side: SpriteSide; prompt: string; reference: string; fixedBlock?: number; candidates: Candidate[] };

/** 원본 PNG 바이트들을 도트화해 run 폴더에 후보로 쓰고, 비교 시트를 만든다. */
function writeRun(seed: MonsterSeed, species: SpeciesSeed, which: SpriteSide, prompt: string, reference: string, raws: (Buffer | null)[], gridOptions: GridOptions = {}): string {
  const id = runId();
  const dir = join(PATHS.runs, species.id, which, id);
  mkdirSync(dir, { recursive: true });
  const candidates: Candidate[] = [];
  raws.forEach((bytes, index) => {
    if (!bytes) return;
    const k = index + 1;
    const raw = join(dir, `raw-${k}.png`);
    writeFileSync(raw, bytes);
    try {
      const { grid, block, colors } = pixelize(readPng(raw), seed.style.maxColors, gridOptions);
      const fit = toSprite(grid, which, species.stage);
      const sprite = fit.sprite;
      writePng(join(dir, `grid-${k}.png`), grid);
      writePng(join(dir, `sprite-${k}.png`), sprite);
      const issues = checkSprite(sprite, seed.style.maxColors, which, species.stage as 1 | 2 | 3).issues;
      const eye = checkEyes(sprite, which, species.stage as 1 | 2 | 3);
      candidates.push({ k, raw: `raw-${k}.png`, grid: `grid-${k}.png`, sprite: `sprite-${k}.png`, sha256: sha256(bytes), block, colors, issues, eye: { pass: eye.pass, pair: eye.pair } });
    } catch (error) {
      console.error(`후보 ${k} 도트화 실패: ${error instanceof Error ? error.message : error}`);
    }
  });
  const record: RunRecord = { species: species.id, side: which, prompt, reference, fixedBlock: gridOptions.block, candidates };
  writeFileSync(join(dir, "run.json"), JSON.stringify(record, null, 2) + "\n");
  writeFileSync(join(dir, "sheet.html"), sheetHtml(species, which, id, candidates));
  console.log(`후보 ${candidates.length}개 → ${relativeToRepo(join(dir, "sheet.html"))}`);
  console.log(`고르기: npm run harness -- ${MONSTER_COLLECT_SPECIES_HARNESS.id} pick --species ${species.id} --side ${which} --run ${id} --candidate <번호>`);
  return id;
}

function sheetHtml(species: SpeciesSeed, which: SpriteSide, id: string, candidates: Candidate[]): string {
  // 실루엣 테스트: 같은 그림을 검정 단색 마스크 64px 로도 보여 준다 (시그니처만으로 종이 구별되는지 — 디자인 규칙 ④)
  const cells = candidates.map((c) => {
    const issues = c.issues.map((i) => `<li class="${i.level}">${i.message}</li>`).join("");
    return `<figure><img src="${c.sprite}" width="${SPRITE_CANVAS * 5}" height="${SPRITE_CANVAS * 5}"><div class="sil"><img class="mask" src="${c.sprite}" width="${SPRITE_CANVAS}" height="${SPRITE_CANVAS}"> <img class="mask" src="${c.sprite}" width="${SPRITE_CANVAS * 2}" height="${SPRITE_CANVAS * 2}"></div><figcaption><b>${c.k}</b> · 블록 ${c.block}px · 색 ${c.colors}${c.eye ? ` · 눈 규칙 ${c.eye.pass ? "통과" : "<b class=\"error\">탈락</b>"}${which === "front" && c.eye.pass ? (c.eye.pair ? " · 두 눈" : " · 한 눈") : ""}` : ""}<ul>${issues}</ul><a href="${c.raw}">원본</a></figcaption></figure>`;
  }).join("");
  return `<!doctype html><meta charset="utf-8"><title>${species.name} ${which} ${id}</title>
<style>body{margin:0;background:#15171d;color:#dfe3ea;font:14px system-ui,sans-serif;padding:12px}main{display:flex;flex-wrap:wrap;gap:10px}
figure{margin:0;background:#d6e4cd;color:#1d2a1d;padding:6px}img{image-rendering:pixelated;display:block}ul{margin:4px 0;padding-left:16px}.error{color:#b00}.warn{color:#8a5a00}
.sil{display:flex;gap:8px;align-items:flex-end;margin-top:4px}.mask{filter:brightness(0)}</style>
<h1>${species.name} (${species.id}) · ${which === "front" ? "앞모습(상대)" : "뒷모습(내 몬스터)"} · run ${id}</h1>
<p>시그니처: ${species.signature}</p><main>${cells}</main>`;
}

type ActionCandidate = { k: number; raw: string; grid: string; strip: string; sha256: string; block: number; colors: number; issues: CheckIssue[] };
type ActionRunRecord = { species: string; side: SpriteSide; action: string; frames: number; prompt: string; fixedBlock?: number; candidates: ActionCandidate[] };

function writeActionRun(seed: MonsterSeed, species: SpeciesSeed, which: SpriteSide, actionId: string, prompt: string, raws: (Buffer | null)[], gridOptions: GridOptions = {}): string {
  const action = actionOf(seed, actionId);
  const base = pickedSprite(loadLedger(), species, which);
  const id = runId();
  const dir = join(PATHS.runs, species.id, `${which}-${actionId}`, id);
  mkdirSync(dir, { recursive: true });
  writePng(join(dir, "base.png"), base);
  const candidates: ActionCandidate[] = [];
  raws.forEach((bytes, index) => {
    if (!bytes) return;
    const k = index + 1;
    const raw = join(dir, `raw-${k}.png`);
    writeFileSync(raw, bytes);
    try {
      const source = readPng(raw);
      const around = rowBlockHint(source, cropToInk(base).width);
      const { grid, block, colors } = pixelize(source, seed.style.maxColors, { around, ...gridOptions });
      writePng(join(dir, `grid-${k}.png`), grid);
      const { frames, clipped } = actionFramesFromGrid(seed, actionId, grid, which, species.stage, base);
      writePng(join(dir, `strip-${k}.png`), toStrip(frames));
      const issues = actionIssues(seed, which, action.kind, frames, base);
      if (clipped > 0) issues.push({ level: "warn", message: `캔버스 밖으로 ${clipped}칸 잘렸다` });
      candidates.push({ k, raw: `raw-${k}.png`, grid: `grid-${k}.png`, strip: `strip-${k}.png`, sha256: sha256(bytes), block, colors, issues });
    } catch (error) {
      console.error(`후보 ${k} 처리 실패: ${error instanceof Error ? error.message : error}`);
    }
  });
  const record: ActionRunRecord = { species: species.id, side: which, action: actionId, frames: action.frames, prompt, fixedBlock: gridOptions.block, candidates };
  writeFileSync(join(dir, "run.json"), JSON.stringify(record, null, 2) + "\n");
  const cells = candidates.map((c) => {
    const issues = c.issues.map((i) => `<li class="${i.level}">${i.message}</li>`).join("");
    return `<figure><div class="play" style="background-image:url(${c.strip})"></div><img src="${c.strip}" height="${SPRITE_CANVAS * 2}"><figcaption><b>${c.k}</b> · 블록 ${c.block}px · 색 ${c.colors}<ul>${issues}</ul><a href="${c.raw}">원본</a></figcaption></figure>`;
  }).join("");
  writeFileSync(join(dir, "sheet.html"), `<!doctype html><meta charset="utf-8"><title>${species.name} ${which} ${actionId} ${id}</title>
<style>body{margin:0;background:#15171d;color:#dfe3ea;font:14px system-ui,sans-serif;padding:12px}main{display:flex;flex-wrap:wrap;gap:10px}
figure{margin:0;background:#d6e4cd;color:#1d2a1d;padding:6px}img{image-rendering:pixelated;display:block}ul{margin:4px 0;padding-left:16px}.error{color:#b00}.warn{color:#8a5a00}
${playCss(action.frames, action.frameMs)}</style>
<h1>${species.name} (${species.id}) · ${which === "front" ? "앞모습" : "뒷모습"} · ${actionId} · run ${id}</h1>
<p>기준: <img src="base.png" width="${SPRITE_CANVAS * 2}" style="display:inline;background:#d6e4cd"></p><main>${cells}</main>`);
  console.log(`후보 ${candidates.length}개 → ${relativeToRepo(join(dir, "sheet.html"))}`);
  console.log(`고르기: npm run harness -- ${MONSTER_COLLECT_SPECIES_HARNESS.id} pick --species ${species.id} --side ${which} --action ${actionId} --run ${id} --candidate <번호>`);
  return id;
}

/** 스트립을 CSS 로 재생 (GIF 인코더 없이). 3배 = 내 몬스터 전투 배율 */
function playCss(frames: number, frameMs: number, scale = 2, cls = "play"): string {
  const w = SPRITE_CANVAS * scale;
  return `.${cls}{width:${w}px;height:${w}px;background-size:${w * frames}px ${w}px;image-rendering:pixelated;animation:${cls}-${frames} ${frames * frameMs}ms steps(${frames}) infinite}
@keyframes ${cls}-${frames}{from{background-position-x:0}to{background-position-x:-${w * frames}px}}`;
}

async function stageAction(args: Args): Promise<void> {
  const seed = loadSeed();
  const species = speciesOf(seed, need(args, "species"));
  const which = side(args);
  const actionId = need(args, "action");
  const action = actionOf(seed, actionId);
  const n = Number(args.flags.get("n") ?? 2);
  const reference = encodePng(rowReference(pickedSprite(loadLedger(), species, which), action.frames));
  const prompt = actionPrompt(seed.style, species, which, action, seed.animation.direction[which]);
  const raws = await mapLimit(Array.from({ length: n }, (_, i) => i), 4, (i) =>
    generateImage({ prompt, reference, slug: `mcs-${species.id}-${which}-${actionId}-${i + 1}` }));
  writeActionRun(seed, species, which, actionId, prompt, raws);
}

async function stageFront(args: Args): Promise<void> {
  const seed = loadSeed();
  const species = speciesOf(seed, need(args, "species"));
  const n = Number(args.flags.get("n") ?? 6);
  const ledger = loadLedger();
  let prompt = frontPrompt(seed.style, species);
  let reference = encodePng(magentaCanvas());
  let referenceLabel = "magenta-canvas";
  if (species.evolvesFrom) {
    const previous = speciesOf(seed, species.evolvesFrom);
    const previousGrid = ledger.picks[previous.id]?.front?.grid;
    if (!previousGrid) throw new Error(`진화 전 단계 ${previous.id} 의 앞모습을 먼저 고른다 (진화형은 앞 단계 그림을 참고로 그린다)`);
    prompt = evolutionPrompt(seed.style, species, previous.name);
    reference = encodePng(cleanReference(readPng(resolve(PATHS.data, previousGrid))));
    referenceLabel = `clean:${previous.id}-front`;
  }
  const raws = await mapLimit(Array.from({ length: n }, (_, i) => i), 4, (i) =>
    generateImage({ prompt, reference, slug: `mcs-${species.id}-front-${i + 1}` }));
  writeRun(seed, species, "front", prompt, referenceLabel, raws);
}

async function stageBack(args: Args): Promise<void> {
  const seed = loadSeed();
  const species = speciesOf(seed, need(args, "species"));
  const n = Number(args.flags.get("n") ?? 3);
  const front = loadLedger().picks[species.id]?.front;
  if (!front) throw new Error(`${species.id} 앞모습을 먼저 고른다 (pick --side front)`);
  const reference = encodePng(cleanReference(readPng(resolve(PATHS.data, front.grid))));
  const prompt = backPrompt(species);
  const raws = await mapLimit(Array.from({ length: n }, (_, i) => i), 4, (i) =>
    generateImage({ prompt, reference, slug: `mcs-${species.id}-back-${i + 1}` }));
  writeRun(seed, species, "back", prompt, `clean:${species.id}-front`, raws);
}

function stageImport(args: Args): void {
  const blockArg = args.flags.get("block");
  const block = blockArg === undefined ? undefined : Number(blockArg);
  if (block !== undefined && (!Number.isInteger(block) || block < 2 || block > 40)) {
    throw new Error("--block 은 2~40 사이의 정수여야 한다");
  }
  const gridOptions: GridOptions = block === undefined ? {} : { block };
  const seed = loadSeed();
  const species = speciesOf(seed, need(args, "species"));
  const actionId = args.flags.get("action");
  if (actionId) {
    // 동작 줄은 쉼표로 여러 장을 한 run 으로 (같은 동작 후보 비교)
    const raws = need(args, "raw").split(",").map((path) => readFileSync(resolve(path)));
    writeActionRun(seed, species, side(args), actionId, args.flags.get("prompt") ?? "(가져온 원본 — 프롬프트 기록 없음)", raws, gridOptions);
    return;
  }
  const raw = resolve(need(args, "raw"));
  writeRun(seed, species, side(args), args.flags.get("prompt") ?? "(가져온 원본 — 프롬프트 기록 없음)", "import", [readFileSync(raw)], gridOptions);
}

function stagePick(args: Args): void {
  const seed = loadSeed();
  const species = speciesOf(seed, need(args, "species"));
  const which = side(args);
  const run = need(args, "run");
  const k = Number(need(args, "candidate"));
  const actionId = args.flags.get("action");
  if (actionId) {
    pickAction(args, species, which, actionId, run, k);
    return;
  }
  const dir = join(PATHS.runs, species.id, which, run);
  const record = JSON.parse(readFileSync(join(dir, "run.json"), "utf8")) as RunRecord;
  const candidate = record.candidates.find((c) => c.k === k);
  if (!candidate) throw new Error(`run ${run} 에 후보 ${k} 가 없다 (있는 후보: ${record.candidates.map((c) => c.k).join(", ")})`);
  const target = gridPath(species.id, which);
  mkdirSync(PATHS.grids, { recursive: true });
  copyFileSync(join(dir, candidate.grid), target);
  const ledger = loadLedger();
  ledger.picks[species.id] = {
    ...ledger.picks[species.id],
    [which]: {
      grid: relative(PATHS.data, target),
      sourceSha256: candidate.sha256,
      sourcePath: relativeToRepo(join(dir, candidate.raw)),
      prompt: record.prompt,
      block: candidate.block,
      pickedAt: new Date().toISOString(),
      ...(args.flags.get("note") ? { note: args.flags.get("note")! } : {}),
    },
  };
  saveLedger(ledger);
  console.log(`${species.id} ${which} ← run ${run} 후보 ${k} (격자 ${relativeToRepo(target)})`);
}

function pickAction(args: Args, species: SpeciesSeed, which: SpriteSide, actionId: string, run: string, k: number): void {
  const dir = join(PATHS.runs, species.id, `${which}-${actionId}`, run);
  const record = JSON.parse(readFileSync(join(dir, "run.json"), "utf8")) as ActionRunRecord;
  const candidate = record.candidates.find((c) => c.k === k);
  if (!candidate) throw new Error(`run ${run} 에 후보 ${k} 가 없다 (있는 후보: ${record.candidates.map((c) => c.k).join(", ")})`);
  const target = actionGridPath(species.id, which, actionId);
  mkdirSync(PATHS.grids, { recursive: true });
  copyFileSync(join(dir, candidate.grid), target);
  const ledger = loadLedger();
  const actions = (ledger.actions ??= {});
  const bySide = (actions[species.id] ??= {});
  (bySide[which] ??= {})[actionId] = {
    grid: relative(PATHS.data, target),
    frames: record.frames,
    sourceSha256: candidate.sha256,
    sourcePath: relativeToRepo(join(dir, candidate.raw)),
    prompt: record.prompt,
    block: candidate.block,
    pickedAt: new Date().toISOString(),
    ...(args.flags.get("note") ? { note: args.flags.get("note")! } : {}),
  };
  saveLedger(ledger);
  console.log(`${species.id} ${which} ${actionId} ← run ${run} 후보 ${k} (격자 ${relativeToRepo(target)})`);
}

type AnimEntry = { path: string; frames: number; frameMs: number; loop: boolean; source: "idle-shift" | "row-generation"; kind?: ActionKind; keys?: ActionContract["keys"] };
type EmitPoint = { x: number; y: number; source: "auto" | "seed" };
type AnimManifest = {
  canvas: number;
  direction: MonsterSeed["animation"]["direction"];
  sides: Partial<Record<SpriteSide, Record<string, AnimEntry>>>;
  /** 입·손 자리(캔버스 좌표) — 발사체 기술이 나가는 곳. 시드 emit 이 있으면 그것, 없으면 그림에서 찾은 값 */
  emit?: Partial<Record<SpriteSide, EmitPoint>>;
};

/** 대기 그림의 입·손 자리. 엔진은 같은 함수(spriteEmitPoint)로 화면의 그림을 읽는다 — 시드에 손 고친 값이 있으면 그것을 쓴다. */
function emitFor(species: SpeciesSeed, which: SpriteSide, sprite: RgbaImage, direction: MonsterSeed["animation"]["direction"]): EmitPoint | undefined {
  const manual = species.emit?.[which];
  if (manual) return { ...manual, source: "seed" };
  const found = spriteEmitPoint(sprite.width, sprite.height, (x, y) => isOpaque(sprite, x, y), direction[which]);
  return found ? { ...found, source: "auto" } : undefined;
}

function printIssues(label: string, issues: CheckIssue[]): number {
  for (const issue of issues) console.log(`  ${issue.level === "error" ? "✗" : "!"} ${label}: ${issue.message}`);
  return issues.filter((i) => i.level === "error").length;
}

/** 손 도트 원본(pick.authored): 이미 64 캔버스에 그린 그림이라 줄이지 않고 그대로 쓴다. */
function authoredSprite(path: string): FitResult {
  const sprite = readPng(resolve(PATHS.data, path));
  if (sprite.width !== SPRITE_CANVAS || sprite.height !== SPRITE_CANVAS) throw new Error(`${path}: 손 도트는 ${SPRITE_CANVAS}×${SPRITE_CANVAS} 여야 한다 (${sprite.width}×${sprite.height})`);
  const ink = cropToInk(sprite);
  return { sprite, factor: 1, ink: { width: ink.width, height: ink.height }, magentaRemoved: 0 };
}

function stageBuild(): number {
  const seed = loadSeed();
  const ledger = loadLedger();
  const anim: Record<string, AnimManifest> = {};
  let errors = 0;
  for (const species of seed.species) {
    for (const which of ["front", "back"] as const) {
      const pick = ledger.picks[species.id]?.[which];
      if (!pick) continue;
      const fit = pick.authored ? authoredSprite(pick.authored) : toSprite(readPng(resolve(PATHS.data, pick.grid)), which, species.stage);
      writePng(bundlePath(species.id, which), fit.sprite);
      console.log(`${species.id} ${which}: 잉크 ${fit.ink.width}x${fit.ink.height} · 축소 ${fit.factor.toFixed(2)} · 마젠타 정리 ${fit.magentaRemoved}`);
      const manifest = (anim[species.id] ??= { canvas: SPRITE_CANVAS, direction: seed.animation.direction, sides: {} });
      const states = (manifest.sides[which] ??= {});
      const emit = emitFor(species, which, fit.sprite, seed.animation.direction);
      if (emit) {
        (manifest.emit ??= {})[which] = emit;
        console.log(`${species.id} ${which} 입·손 자리 (${emit.x}, ${emit.y}) ${emit.source === "seed" ? "시드" : "자동"}`);
      }
      const { idle } = seed.animation;
      mkdirSync(join(PATHS.bundle, species.id, "anim"), { recursive: true });
      writePng(animPath(species.id, which, "idle"), toStrip(idleFrames(fit.sprite, which, species.motion)));
      states.idle = { path: `anim/${which}-idle.png`, frames: idle.frames, frameMs: idle.frameMs, loop: idle.loop, source: "idle-shift" };
      for (const [actionId, actionPick] of Object.entries(ledger.actions?.[species.id]?.[which] ?? {})) {
        const action = actionOf(seed, actionId);
        if (actionPick.frames !== action.frames) throw new Error(`${species.id} ${which} ${actionId}: 고른 줄은 ${actionPick.frames}장인데 시드는 ${action.frames}장 — 다시 생성해 고른다`);
        const { frames, clipped } = actionFramesFromGrid(seed, actionId, readPng(resolve(PATHS.data, actionPick.grid)), which, species.stage, fit.sprite);
        writePng(animPath(species.id, which, actionId), toStrip(frames));
        states[actionId] = { path: `anim/${which}-${actionId}.png`, frames: action.frames, frameMs: action.frameMs, loop: action.loop, source: "row-generation", kind: action.kind, keys: action.keys };
        console.log(`${species.id} ${which} ${actionId}: ${action.frames}장${clipped ? ` · 잘린 칸 ${clipped}` : ""}`);
      }
    }
  }
  for (const [speciesId, manifest] of Object.entries(anim)) writeFileSync(join(PATHS.bundle, speciesId, "anim.json"), JSON.stringify(manifest, null, 2) + "\n");
  errors += stageCheck();
  stageManifest();
  return errors;
}

/**
 * 번들 폴더(public/assets/harnesses/monster-collect-species/<종>/)를 읽어 런타임 목록을 쓴다 — 이미지 바이트 없이 id·면·대기 칸 수만.
 * 런타임(`src/assets/harnessMonsterArt.ts`)은 이 목록에 종이 있으면 `campaignSpeciesId` 로 이어진 캠페인 종의 그림을 번들 그림으로 바꾼다.
 * 그림 파일이 실제로 있는 면만 싣는다(없는 면은 기존 그림으로 폴백).
 */
function stageManifest(): void {
  const seed = loadSeed();
  type Entry = { campaignSpeciesId?: string; front?: { idle?: { frames: number; frameMs: number } }; back?: { idle?: { frames: number; frameMs: number } }; field?: { sheet: number; index: number } };
  const species: Record<string, Entry> = {};
  // 따라다니기 걷기 칩: field_chip.py bake 가 쓴 field/index.json (시트 수 + 종별 시트·번호). 시트 파일이 실제로 있는 종만 싣는다.
  const fieldIndexPath = join(PATHS.bundle, "field", "index.json");
  const fieldIndex = existsSync(fieldIndexPath) ? (JSON.parse(readFileSync(fieldIndexPath, "utf8")) as { sheets: number; chips: Record<string, { sheet: number; index: number }> }) : undefined;
  for (const sp of seed.species) {
    const entry: Entry = {};
    if (sp.campaignSpeciesId) entry.campaignSpeciesId = sp.campaignSpeciesId;
    const manifestPath = join(PATHS.bundle, sp.id, "anim.json");
    const anim = existsSync(manifestPath) ? (JSON.parse(readFileSync(manifestPath, "utf8")) as AnimManifest) : undefined;
    for (const which of ["front", "back"] as const) {
      if (!existsSync(bundlePath(sp.id, which))) continue;
      const idle = anim?.sides[which]?.idle;
      entry[which] = idle && existsSync(join(PATHS.bundle, sp.id, idle.path)) ? { idle: { frames: idle.frames, frameMs: idle.frameMs } } : {};
    }
    const chip = fieldIndex?.chips[sp.id];
    if (chip && existsSync(join(PATHS.bundle, "field", `chips-${chip.sheet}.png`))) entry.field = { sheet: chip.sheet, index: chip.index };
    if (entry.front || entry.back) species[sp.id] = entry;
  }
  mkdirSync(resolve(PATHS.manifest, ".."), { recursive: true });
  writeFileSync(PATHS.manifest, JSON.stringify({ version: 1, canvas: SPRITE_CANVAS, ...(fieldIndex && fieldIndex.sheets > 0 ? { fieldSheets: fieldIndex.sheets } : {}), species }, null, 2) + "\n");
  console.log(`런타임 목록 → ${relativeToRepo(PATHS.manifest)} (종 ${Object.keys(species).length})`);
}

/**
 * 후보 폴더의 스프라이트·검사·시트를 현재 규격(캔버스·몸집)으로 다시 만든다. 격자(grid-k.png)는 그대로이고 생성은 하지 않는다.
 * 규격이 바뀌었을 때(112 → 64, 2026-10-16) 이미 만든 후보를 새 캔버스에서 비교하려는 것.
 */
function stageRefit(args: Args): void {
  const seed = loadSeed();
  const only = args.flags.get("species");
  let runs = 0;
  for (const species of seed.species) {
    if (only && species.id !== only) continue;
    for (const which of ["front", "back"] as const) {
      const base = join(PATHS.runs, species.id, which);
      if (!existsSync(base)) continue;
      for (const id of readdirSync(base)) {
        const file = join(base, id, "run.json");
        if (!existsSync(file)) continue;
        const record = JSON.parse(readFileSync(file, "utf8")) as RunRecord;
        for (const c of record.candidates) {
          const grid = readPng(join(base, id, c.grid));
          const sprite = toSprite(grid, which, species.stage).sprite;
          writePng(join(base, id, c.sprite), sprite);
          c.issues = checkSprite(sprite, seed.style.maxColors, which, species.stage as 1 | 2 | 3).issues;
          const eye = checkEyes(sprite, which, species.stage as 1 | 2 | 3);
          c.eye = { pass: eye.pass, pair: eye.pair };
        }
        writeFileSync(file, JSON.stringify(record, null, 2) + "\n");
        writeFileSync(join(base, id, "sheet.html"), sheetHtml(species, which, id, record.candidates));
        runs += 1;
      }
    }
  }
  console.log(`다시 만든 후보 폴더 ${runs}개 (캔버스 ${SPRITE_CANVAS})`);
}

/** 격자 보고: 고른 그림마다 생성 블록 크기·원본 도트 칸 수·64 캔버스로 줄인 배율. 종마다 원본 블록이 달라도 최종은 1칸 = 1도트 = 논리 화소 하나다. */
function stageGrid(): void {
  const seed = loadSeed();
  const ledger = loadLedger();
  console.log(`격자 계약: 캔버스 ${SPRITE_CANVAS} (몸 ${MAX_INK_SIDE} 이내), 1 도트 = 논리 화소 1 = 화면 2px, 전투 표시 ${SPRITE_CANVAS * 2}px`);
  for (const species of seed.species) {
    for (const which of ["front", "back"] as const) {
      const pick = ledger.picks[species.id]?.[which];
      if (!pick) continue;
      const grid = readPng(resolve(PATHS.data, pick.grid));
      const ink = cropToInk(grid);
      const fit = toSprite(grid, which, species.stage);
      console.log(`${species.id.padEnd(10)} ${which.padEnd(5)} 블록 ${String(pick.block).padStart(2)} · 원본 ${ink.width}x${ink.height}칸 → ${fit.ink.width}x${fit.ink.height} (${fit.factor.toFixed(2)}배 줄임)`);
    }
  }
}

/** eyes.json 의 눈자루(stalk) 종 눈알 상자 — checkSprite 가 그 종만 눈자루 규칙으로 보게 넘긴다 */
function stalkEyeBoxes(): Map<string, [number, number, number, number][]> {
  const out = new Map<string, [number, number, number, number][]>();
  const file = join(PATHS.data, "eyes.json");
  if (!existsSync(file)) return out;
  const table = JSON.parse(readFileSync(file, "utf8")) as { species: Record<string, { anatomy: string; near: [number, number, number, number]; second?: [number, number, number, number] }> };
  for (const [id, e] of Object.entries(table.species)) if (e.anatomy === "stalk") out.set(id, [e.near, ...(e.second ? [e.second] : [])]);
  return out;
}

/** eyes.json 의 동결 종 id — 앞·뒤 화소 해시로 사람이 승인한 기준종 */
export function frozenSpecies(): Set<string> {
  const file = join(PATHS.data, "eyes.json");
  if (!existsSync(file)) return new Set();
  const table = JSON.parse(readFileSync(file, "utf8")) as { species: Record<string, { frozen?: unknown }> };
  return new Set(Object.entries(table.species).filter(([, e]) => e.frozen).map(([id]) => id));
}

function stageCheck(): number {
  const seed = loadSeed();
  const stalks = stalkEyeBoxes();
  const frozen = frozenSpecies();
  let errors = 0;
  for (const species of seed.species) {
    const front = existsSync(bundlePath(species.id, "front")) ? readPng(bundlePath(species.id, "front")) : null;
    const back = existsSync(bundlePath(species.id, "back")) ? readPng(bundlePath(species.id, "back")) : null;
    // 동결 종(사람이 그림 해시로 승인한 기준종)은 그림이 곧 기준이다 — 눈 자동 검출 실패는 경고로만 남기고, 화소 해시(V8)가 막는다.
    const frontIssues = front ? checkSprite(front, seed.style.maxColors, "front", species.stage as 1 | 2 | 3, stalks.get(species.id)).issues : [];
    if (front) errors += printIssues(`${species.id} front`, frozen.has(species.id) ? frontIssues.map((i) => (i.message.startsWith("눈 규칙") ? { ...i, level: "warn" as const, message: `${i.message} (동결 종)` } : i)) : frontIssues);
    if (back) errors += printIssues(`${species.id} back`, checkSprite(back, seed.style.maxColors, "back", species.stage as 1 | 2 | 3).issues);
    if (front && back) errors += printIssues(`${species.id} 앞·뒤`, checkPair(front, back));
    const manifestPath = join(PATHS.bundle, species.id, "anim.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as AnimManifest;
    for (const [which, point] of Object.entries(manifest.emit ?? {}) as [SpriteSide, EmitPoint][]) {
      const base = which === "front" ? front : back;
      if (!base) continue;
      // 입 자리가 몸에서 3칸 넘게 떨어져 있으면 발사체가 허공에서 나간다 — 시드 emit 을 잘못 적었거나 그림이 바뀌었다
      let near = false;
      for (let dy = -3; dy <= 3 && !near; dy += 1) for (let dx = -3; dx <= 3 && !near; dx += 1) {
        const x = point.x + dx;
        const y = point.y + dy;
        near = x >= 0 && y >= 0 && x < base.width && y < base.height && isOpaque(base, x, y);
      }
      if (!near) errors += printIssues(`${species.id} ${which} 입·손 자리`, [{ level: point.source === "seed" ? "error" : "warning", message: `(${point.x}, ${point.y}) 근처에 몸이 없다` }]);
    }
    for (const [which, states] of Object.entries(manifest.sides) as [SpriteSide, NonNullable<AnimManifest["sides"][SpriteSide]>][]) {
      const base = which === "front" ? front : back;
      if (!base) { errors += printIssues(`${species.id} ${which} 애니메이션`, [{ level: "error", message: "스프라이트 없이 애니메이션만 있다" }]); continue; }
      for (const [state, entry] of Object.entries(states)) {
        const file = join(PATHS.bundle, species.id, entry.path);
        if (!existsSync(file)) { errors += printIssues(`${species.id} ${which} ${state}`, [{ level: "error", message: `${entry.path} 가 없다` }]); continue; }
        const frames = fromStrip(readPng(file), entry.frames);
        errors += printIssues(`${species.id} ${which} ${state}`, entry.source === "idle-shift"
          ? checkFrames(frames, base, seed.style.maxColors, "idle")
          : actionIssues(seed, which, entry.kind ?? actionOf(seed, state).kind, frames, base));
      }
    }
  }
  // 실루엣 테스트(디자인 규칙 ④): 윤곽이 거의 같은 종 짝은 경고 — 진화형이 1단계 복제인 경우도 여기서 걸린다
  const fronts = seed.species.filter((sp) => existsSync(bundlePath(sp.id, "front"))).map((sp) => ({ id: sp.id, image: readPng(bundlePath(sp.id, "front")) }));
  for (const pair of similarSilhouettes(fronts)) console.log(`  ! 실루엣 ${pair.a} ↔ ${pair.b}: 겹침 ${pair.iou.toFixed(2)} (64px 검정 마스크에서 구별되지 않는다)`);
  errors += eyeTableCheck(seed);
  console.log(errors === 0 ? "검사: 오류 없음" : `검사: 오류 ${errors}개`);
  return errors;
}

/**
 * 눈 표 검사(눈 규칙 판본 5, `checks/eyeTable.ts`): 번들 앞모습이 `eyes.json` 의 눈 자리와 맞는지, 동결 종 해시가 그대로인지.
 * 실제 실패 목록이 표의 `accept` 와 다르면 오류다 — 새로 깨진 종도, 고쳤는데 accept 를 안 지운 종도 잡는다.
 */
function eyeTableCheck(seed: MonsterSeed): number {
  const file = join(PATHS.data, "eyes.json");
  if (!existsSync(file)) return 0;
  const table = validateEyeTable(JSON.parse(readFileSync(file, "utf8")), seed.species.map((s) => s.id));
  const lineFindings = checkLineStyles(table, seed.species);
  let errors = 0;
  let accepted = 0;
  for (const species of seed.species) {
    if (!existsSync(bundlePath(species.id, "front")) || !existsSync(bundlePath(species.id, "back"))) continue;
    const entry = table.species[species.id]!;
    const front = readPng(bundlePath(species.id, "front"));
    const back = readPng(bundlePath(species.id, "back"));
    const findings = checkEyePlacement(front, entry);
    const line = lineFindings.get(species.id);
    if (line && !findings.some((f) => f.check === "V7")) findings.push(line);
    const accept = entry.accept ?? {};
    const issues: CheckIssue[] = findings.map((f) => ({ level: f.check in accept ? "warn" : "error", message: `눈 ${f.check} ${f.message}${f.check in accept ? " (accept)" : ""}` }));
    for (const k of Object.keys(accept)) if (!findings.some((f) => f.check === k)) issues.push({ level: "error", message: `눈 ${k} 는 이제 통과한다 — eyes.json accept 에서 지워라` });
    if (entry.frozen) {
      for (const [side, image] of [["front", front], ["back", back]] as const) {
        if (createHash("sha256").update(image.data).digest("hex") !== entry.frozen[side]) issues.push({ level: "error", message: `동결 종 ${side} 그림이 바뀌었다 (V8) — 사용자 승인 기준종은 바꾸지 않는다` });
      }
    }
    if (Object.keys(accept).length > 0) accepted += 1;
    errors += printIssues(`${species.id} 눈 표`, issues);
  }
  console.log(`눈 표: accept 로 남은 종 ${accepted}개`);
  return errors;
}

function stageStatus(): void {
  const seed = loadSeed();
  const ledger = loadLedger();
  console.log(`시드 ${relativeToRepo(PATHS.seed)} · 종 ${seed.species.length}`);
  for (const species of seed.species) {
    const picks = ledger.picks[species.id] ?? {};
    const mark = (which: SpriteSide) => `${which} ${picks[which] ? "고름" : "—"}${existsSync(bundlePath(species.id, which)) ? "·번들" : ""}`;
    const states = (which: SpriteSide) => Object.keys(ledger.actions?.[species.id]?.[which] ?? {}).join("+");
    const runs = existsSync(join(PATHS.runs, species.id)) ? readdirSync(join(PATHS.runs, species.id)).join(",") : "";
    console.log(`- ${species.id} (${species.name}, ${species.types.join("/")}, ${species.stage}단계${species.evolvesFrom ? ` ← ${species.evolvesFrom}` : ""}): ${mark("front")} · ${mark("back")}${states("front") || states("back") ? ` · 동작 앞 ${states("front") || "—"} / 뒤 ${states("back") || "—"}` : ""}${runs ? ` · 실행 기록 ${runs}` : ""}`);
  }
}

function stagePreview(args: Args): void {
  const seed = loadSeed();
  const only = args.flags.get("species");
  const dir = join(PATHS.runs, "preview");
  mkdirSync(dir, { recursive: true });
  const css: string[] = [];
  const rows: string[] = [];
  for (const species of seed.species) {
    if (only && species.id !== only) continue;
    const manifestPath = join(PATHS.bundle, species.id, "anim.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as AnimManifest;
    const cells: string[] = [];
    for (const which of ["front", "back"] as const) {
      for (const [state, entry] of Object.entries(manifest.sides[which] ?? {})) {
        const name = `${species.id}-${which}-${state}.png`;
        copyFileSync(join(PATHS.bundle, species.id, entry.path), join(dir, name));
        const cls = `p-${species.id}-${which}-${state}`;
        css.push(playCss(entry.frames, entry.frameMs, 2, cls));
        cells.push(`<figure><div class="${cls}" style="background-image:url(${name})"></div><figcaption>${which === "front" ? "앞" : "뒤"} · ${state} · ${entry.frames}장 ${entry.frameMs}ms${entry.loop ? " 반복" : ""}</figcaption></figure>`);
      }
    }
    rows.push(`<h2>${species.name} (${species.id})</h2><main>${cells.join("")}</main>`);
  }
  writeFileSync(join(dir, "index.html"), `<!doctype html><meta charset="utf-8"><title>몬스터 애니메이션 미리보기</title>
<style>body{margin:0;background:#15171d;color:#dfe3ea;font:14px system-ui,sans-serif;padding:12px}main{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}
figure{margin:0;background:#d6e4cd;color:#1d2a1d;padding:6px}${css.join("\n")}</style>
<h1>몬스터 애니메이션 미리보기 (앞 2배·뒤 3배, 전투 배율)</h1>${rows.join("")}`);
  console.log(`미리보기 → ${relativeToRepo(join(dir, "index.html"))}`);
}

export async function run(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const stage = args.positional[0] ?? "status";
  switch (stage) {
    case "status": stageStatus(); return 0;
    case "front": await stageFront(args); return 0;
    case "back": await stageBack(args); return 0;
    case "action": await stageAction(args); return 0;
    case "preview": stagePreview(args); return 0;
    case "import": stageImport(args); return 0;
    case "pick": stagePick(args); return 0;
    case "build": return stageBuild() > 0 ? 1 : 0;
    case "check": return stageCheck() > 0 ? 1 : 0;
    case "grid": stageGrid(); return 0;
    case "refit": stageRefit(args); return 0;
    case "manifest": stageManifest(); return 0;
    default:
      console.error(`모르는 단계: ${stage}. 단계: ${MONSTER_COLLECT_SPECIES_HARNESS.stages.map((s) => s.id).join(", ")}`);
      return 2;
  }
}
