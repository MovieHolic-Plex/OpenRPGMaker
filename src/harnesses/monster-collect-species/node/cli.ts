/**
 * npm run harness -- monster-collect-species <단계> [옵션]
 *
 *   status                                     시드의 종마다 진행 현황
 *   front  --species <id> [--n 6]              앞모습 후보 생성 → qa-runs/harnesses/.../<종>/front/<run>/sheet.html
 *   back   --species <id> [--n 3]              고른 앞모습으로 뒷모습 후보 생성
 *   action --species <id> --side front|back --action <동작> [--n 2]
 *                                              큰 동작(공격·피격) 한 줄 후보 생성 (sprite-gen 방식, anim/row.ts)
 *   import --species <id> --side front|back [--action <동작>] --raw <png[,png…]> [--prompt <text>]
 *                                              이미 있는 생성 원본을 후보 run 으로 등록
 *   pick   --species <id> --side front|back [--action <동작>] --run <run> --candidate <k> [--note <text>]
 *   build                                      골라 둔 격자 → public/assets/harnesses/... 스프라이트·대기·동작 스트립 + 검사
 *   check                                      번들 검사만
 *   preview [--species <id>]                   번들 스프라이트·애니메이션을 한 쪽 HTML 로 (qa-runs/.../preview/)
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { MONSTER_COLLECT_SPECIES_HARNESS } from "../harness";
import { cleanReference, magentaCanvas, pixelize, toSprite } from "../pixel/pipeline";
import { SPRITE_CANVAS, type SpriteSide } from "../pixel/fit";
import { checkDirection, checkFrames, checkPair, checkSprite, type CheckIssue } from "../checks/checks";
import { actionPrompt, backPrompt, evolutionPrompt, frontPrompt } from "../prompts/prompts";
import { emptyLedger, validateSeed, type ActionContract, type ActionKind, type MonsterLedger, type MonsterSeed, type SpeciesSeed } from "../seed";
import { idleFrames } from "../anim/idle";
import { fromStrip, rowBlockHint, rowFrames, rowReference, splitRow, toStrip } from "../anim/row";
import { cropToInk, type RgbaImage } from "../pixel/image";
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
 * 줄 격자 → 112 프레임 (build 와 후보 시트가 같은 함수를 쓴다). 0번 폭을 기준 스프라이트 폭에 맞추고,
 * 공격·피격은 뒷발(공격 방향 반대쪽 끝)을 고정한다 — 덤빈 거리가 프레임 안에 남는다.
 */
function actionFramesFromGrid(seed: MonsterSeed, actionId: string, grid: RgbaImage, which: SpriteSide, stage: 1 | 2 | 3, base: RgbaImage) {
  const action = actionOf(seed, actionId);
  const rear = (action.kind === "self" ? 0 : -Math.sign(seed.animation.direction[which].x)) as -1 | 0 | 1;
  return rowFrames(splitRow(grid, action.frames), which, stage, cropToInk(base).width, rear);
}

type Candidate = { k: number; raw: string; grid: string; sprite: string; sha256: string; block: number; colors: number; issues: CheckIssue[] };
type RunRecord = { species: string; side: SpriteSide; prompt: string; reference: string; candidates: Candidate[] };

/** 원본 PNG 바이트들을 도트화해 run 폴더에 후보로 쓰고, 비교 시트를 만든다. */
function writeRun(seed: MonsterSeed, species: SpeciesSeed, which: SpriteSide, prompt: string, reference: string, raws: (Buffer | null)[]): string {
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
      const { grid, block, colors } = pixelize(readPng(raw), seed.style.maxColors);
      const sprite = toSprite(grid, which, species.stage).sprite;
      writePng(join(dir, `grid-${k}.png`), grid);
      writePng(join(dir, `sprite-${k}.png`), sprite);
      candidates.push({ k, raw: `raw-${k}.png`, grid: `grid-${k}.png`, sprite: `sprite-${k}.png`, sha256: sha256(bytes), block, colors, issues: checkSprite(sprite, seed.style.maxColors).issues });
    } catch (error) {
      console.error(`후보 ${k} 도트화 실패: ${error instanceof Error ? error.message : error}`);
    }
  });
  const record: RunRecord = { species: species.id, side: which, prompt, reference, candidates };
  writeFileSync(join(dir, "run.json"), JSON.stringify(record, null, 2) + "\n");
  writeFileSync(join(dir, "sheet.html"), sheetHtml(species, which, id, candidates));
  console.log(`후보 ${candidates.length}개 → ${relativeToRepo(join(dir, "sheet.html"))}`);
  console.log(`고르기: npm run harness -- ${MONSTER_COLLECT_SPECIES_HARNESS.id} pick --species ${species.id} --side ${which} --run ${id} --candidate <번호>`);
  return id;
}

function sheetHtml(species: SpeciesSeed, which: SpriteSide, id: string, candidates: Candidate[]): string {
  const cells = candidates.map((c) => {
    const issues = c.issues.map((i) => `<li class="${i.level}">${i.message}</li>`).join("");
    return `<figure><img src="${c.sprite}" width="336" height="336"><figcaption><b>${c.k}</b> · 블록 ${c.block}px · 색 ${c.colors}<ul>${issues}</ul><a href="${c.raw}">원본</a></figcaption></figure>`;
  }).join("");
  return `<!doctype html><meta charset="utf-8"><title>${species.name} ${which} ${id}</title>
<style>body{margin:0;background:#15171d;color:#dfe3ea;font:14px system-ui,sans-serif;padding:12px}main{display:flex;flex-wrap:wrap;gap:10px}
figure{margin:0;background:#d6e4cd;color:#1d2a1d;padding:6px}img{image-rendering:pixelated;display:block}ul{margin:4px 0;padding-left:16px}.error{color:#b00}.warn{color:#8a5a00}</style>
<h1>${species.name} (${species.id}) · ${which === "front" ? "앞모습(상대)" : "뒷모습(내 몬스터)"} · run ${id}</h1><main>${cells}</main>`;
}

type ActionCandidate = { k: number; raw: string; grid: string; strip: string; sha256: string; block: number; colors: number; issues: CheckIssue[] };
type ActionRunRecord = { species: string; side: SpriteSide; action: string; frames: number; prompt: string; candidates: ActionCandidate[] };

function writeActionRun(seed: MonsterSeed, species: SpeciesSeed, which: SpriteSide, actionId: string, prompt: string, raws: (Buffer | null)[]): string {
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
      const { grid, block, colors } = pixelize(source, seed.style.maxColors, { around });
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
  const record: ActionRunRecord = { species: species.id, side: which, action: actionId, frames: action.frames, prompt, candidates };
  writeFileSync(join(dir, "run.json"), JSON.stringify(record, null, 2) + "\n");
  const cells = candidates.map((c) => {
    const issues = c.issues.map((i) => `<li class="${i.level}">${i.message}</li>`).join("");
    return `<figure><div class="play" style="background-image:url(${c.strip})"></div><img src="${c.strip}" height="112"><figcaption><b>${c.k}</b> · 블록 ${c.block}px · 색 ${c.colors}<ul>${issues}</ul><a href="${c.raw}">원본</a></figcaption></figure>`;
  }).join("");
  writeFileSync(join(dir, "sheet.html"), `<!doctype html><meta charset="utf-8"><title>${species.name} ${which} ${actionId} ${id}</title>
<style>body{margin:0;background:#15171d;color:#dfe3ea;font:14px system-ui,sans-serif;padding:12px}main{display:flex;flex-wrap:wrap;gap:10px}
figure{margin:0;background:#d6e4cd;color:#1d2a1d;padding:6px}img{image-rendering:pixelated;display:block}ul{margin:4px 0;padding-left:16px}.error{color:#b00}.warn{color:#8a5a00}
${playCss(action.frames, action.frameMs)}</style>
<h1>${species.name} (${species.id}) · ${which === "front" ? "앞모습" : "뒷모습"} · ${actionId} · run ${id}</h1>
<p>기준: <img src="base.png" width="112" style="display:inline;background:#d6e4cd"></p><main>${cells}</main>`);
  console.log(`후보 ${candidates.length}개 → ${relativeToRepo(join(dir, "sheet.html"))}`);
  console.log(`고르기: npm run harness -- ${MONSTER_COLLECT_SPECIES_HARNESS.id} pick --species ${species.id} --side ${which} --action ${actionId} --run ${id} --candidate <번호>`);
  return id;
}

/** 스트립을 CSS 로 재생 (GIF 인코더 없이). 3배 = 내 몬스터 전투 배율 */
function playCss(frames: number, frameMs: number, scale = 3, cls = "play"): string {
  const w = 112 * scale;
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
  const prompt = backPrompt();
  const raws = await mapLimit(Array.from({ length: n }, (_, i) => i), 4, (i) =>
    generateImage({ prompt, reference, slug: `mcs-${species.id}-back-${i + 1}` }));
  writeRun(seed, species, "back", prompt, `clean:${species.id}-front`, raws);
}

function stageImport(args: Args): void {
  const seed = loadSeed();
  const species = speciesOf(seed, need(args, "species"));
  const actionId = args.flags.get("action");
  if (actionId) {
    // 동작 줄은 쉼표로 여러 장을 한 run 으로 (같은 동작 후보 비교)
    const raws = need(args, "raw").split(",").map((path) => readFileSync(resolve(path)));
    writeActionRun(seed, species, side(args), actionId, args.flags.get("prompt") ?? "(가져온 원본 — 프롬프트 기록 없음)", raws);
    return;
  }
  const raw = resolve(need(args, "raw"));
  writeRun(seed, species, side(args), args.flags.get("prompt") ?? "(가져온 원본 — 프롬프트 기록 없음)", "import", [readFileSync(raw)]);
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

type AnimEntry = { path: string; frames: number; frameMs: number; loop: boolean; source: "idle-shift" | "row-generation"; kind?: ActionKind };
type AnimManifest = { canvas: number; direction: MonsterSeed["animation"]["direction"]; sides: Partial<Record<SpriteSide, Record<string, AnimEntry>>> };

function printIssues(label: string, issues: CheckIssue[]): number {
  for (const issue of issues) console.log(`  ${issue.level === "error" ? "✗" : "!"} ${label}: ${issue.message}`);
  return issues.filter((i) => i.level === "error").length;
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
      const fit = toSprite(readPng(resolve(PATHS.data, pick.grid)), which, species.stage);
      writePng(bundlePath(species.id, which), fit.sprite);
      console.log(`${species.id} ${which}: 잉크 ${fit.ink.width}x${fit.ink.height} · 축소 ${fit.factor.toFixed(2)} · 마젠타 정리 ${fit.magentaRemoved}`);
      const manifest = (anim[species.id] ??= { canvas: SPRITE_CANVAS, direction: seed.animation.direction, sides: {} });
      const states = (manifest.sides[which] ??= {});
      const { idle } = seed.animation;
      mkdirSync(join(PATHS.bundle, species.id, "anim"), { recursive: true });
      writePng(animPath(species.id, which, "idle"), toStrip(idleFrames(fit.sprite, which, species.motion)));
      states.idle = { path: `anim/${which}-idle.png`, frames: idle.frames, frameMs: idle.frameMs, loop: idle.loop, source: "idle-shift" };
      for (const [actionId, actionPick] of Object.entries(ledger.actions?.[species.id]?.[which] ?? {})) {
        const action = actionOf(seed, actionId);
        if (actionPick.frames !== action.frames) throw new Error(`${species.id} ${which} ${actionId}: 고른 줄은 ${actionPick.frames}장인데 시드는 ${action.frames}장 — 다시 생성해 고른다`);
        const { frames, clipped } = actionFramesFromGrid(seed, actionId, readPng(resolve(PATHS.data, actionPick.grid)), which, species.stage, fit.sprite);
        writePng(animPath(species.id, which, actionId), toStrip(frames));
        states[actionId] = { path: `anim/${which}-${actionId}.png`, frames: action.frames, frameMs: action.frameMs, loop: action.loop, source: "row-generation", kind: action.kind };
        console.log(`${species.id} ${which} ${actionId}: ${action.frames}장${clipped ? ` · 잘린 칸 ${clipped}` : ""}`);
      }
    }
  }
  for (const [speciesId, manifest] of Object.entries(anim)) writeFileSync(join(PATHS.bundle, speciesId, "anim.json"), JSON.stringify(manifest, null, 2) + "\n");
  errors += stageCheck();
  return errors;
}

function stageCheck(): number {
  const seed = loadSeed();
  let errors = 0;
  for (const species of seed.species) {
    const front = existsSync(bundlePath(species.id, "front")) ? readPng(bundlePath(species.id, "front")) : null;
    const back = existsSync(bundlePath(species.id, "back")) ? readPng(bundlePath(species.id, "back")) : null;
    if (front) errors += printIssues(`${species.id} front`, checkSprite(front, seed.style.maxColors).issues);
    if (back) errors += printIssues(`${species.id} back`, checkSprite(back, seed.style.maxColors).issues);
    if (front && back) errors += printIssues(`${species.id} 앞·뒤`, checkPair(front, back));
    const manifestPath = join(PATHS.bundle, species.id, "anim.json");
    if (!existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as AnimManifest;
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
  console.log(errors === 0 ? "검사: 오류 없음" : `검사: 오류 ${errors}개`);
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
        css.push(playCss(entry.frames, entry.frameMs, which === "back" ? 3 : 2, cls));
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
    default:
      console.error(`모르는 단계: ${stage}. 단계: ${MONSTER_COLLECT_SPECIES_HARNESS.stages.map((s) => s.id).join(", ")}`);
      return 2;
  }
}
