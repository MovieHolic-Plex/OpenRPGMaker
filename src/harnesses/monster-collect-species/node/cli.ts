/**
 * npm run harness -- monster-collect-species <단계> [옵션]
 *
 *   status                                     시드의 종마다 진행 현황
 *   front  --species <id> [--n 6]              앞모습 후보 생성 → qa-runs/harnesses/.../<종>/front/<run>/sheet.html
 *   back   --species <id> [--n 3]              고른 앞모습으로 뒷모습 후보 생성
 *   import --species <id> --side front|back --raw <png> [--prompt <text>]
 *                                              이미 있는 생성 원본을 후보 run 으로 등록
 *   pick   --species <id> --side front|back --run <run> --candidate <k> [--note <text>]
 *   build                                      골라 둔 격자 → public/assets/harnesses/... 스프라이트 + 검사
 *   check                                      번들 스프라이트 검사만
 */
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { MONSTER_COLLECT_SPECIES_HARNESS } from "../harness";
import { cleanReference, magentaCanvas, pixelize, toSprite } from "../pixel/pipeline";
import type { SpriteSide } from "../pixel/fit";
import { checkPair, checkSprite, type CheckIssue } from "../checks/checks";
import { backPrompt, evolutionPrompt, frontPrompt } from "../prompts/prompts";
import { emptyLedger, validateSeed, type MonsterLedger, type MonsterSeed, type SpeciesSeed } from "../seed";
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
      const sprite = toSprite(grid, which).sprite;
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
  const raw = resolve(need(args, "raw"));
  writeRun(seed, species, side(args), args.flags.get("prompt") ?? "(가져온 원본 — 프롬프트 기록 없음)", "import", [readFileSync(raw)]);
}

function stagePick(args: Args): void {
  const seed = loadSeed();
  const species = speciesOf(seed, need(args, "species"));
  const which = side(args);
  const run = need(args, "run");
  const k = Number(need(args, "candidate"));
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
      grid: relativeToRepo(target).replace(`harness-data/${MONSTER_COLLECT_SPECIES_HARNESS.id}/`, ""),
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

function printIssues(label: string, issues: CheckIssue[]): number {
  for (const issue of issues) console.log(`  ${issue.level === "error" ? "✗" : "!"} ${label}: ${issue.message}`);
  return issues.filter((i) => i.level === "error").length;
}

function stageBuild(): number {
  const seed = loadSeed();
  const ledger = loadLedger();
  let errors = 0;
  for (const species of seed.species) {
    for (const which of ["front", "back"] as const) {
      const pick = ledger.picks[species.id]?.[which];
      if (!pick) continue;
      const fit = toSprite(readPng(resolve(PATHS.data, pick.grid)), which);
      writePng(bundlePath(species.id, which), fit.sprite);
      console.log(`${species.id} ${which}: 잉크 ${fit.ink.width}x${fit.ink.height} · 축소 ${fit.factor.toFixed(2)} · 마젠타 정리 ${fit.magentaRemoved}`);
    }
  }
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
    const runs = existsSync(join(PATHS.runs, species.id)) ? readdirSync(join(PATHS.runs, species.id)).join(",") : "";
    console.log(`- ${species.id} (${species.name}, ${species.types.join("/")}, ${species.stage}단계${species.evolvesFrom ? ` ← ${species.evolvesFrom}` : ""}): ${mark("front")} · ${mark("back")}${runs ? ` · 실행 기록 ${runs}` : ""}`);
  }
}

export async function run(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  const stage = args.positional[0] ?? "status";
  switch (stage) {
    case "status": stageStatus(); return 0;
    case "front": await stageFront(args); return 0;
    case "back": await stageBack(args); return 0;
    case "import": stageImport(args); return 0;
    case "pick": stagePick(args); return 0;
    case "build": return stageBuild() > 0 ? 1 : 0;
    case "check": return stageCheck() > 0 ? 1 : 0;
    default:
      console.error(`모르는 단계: ${stage}. 단계: ${MONSTER_COLLECT_SPECIES_HARNESS.stages.map((s) => s.id).join(", ")}`);
      return 2;
  }
}
