// 번들 칩셋을 바꾼 뒤(칸 굽기·시트 끝 덧붙이기) 옛 저장본이 여전히 열리고·저장되고·다시 열리는지, 맵이 같은 그림을 가리키는지 본다.
//
// 왜(2026-10-29): 버들항 시트 끝에 기둥 128칸을 굽자(33,920 → 34,048) 번들 자신의 이식 칸 2,515개가 128 뒤로 밀렸고,
// 옛 저장본(번들 차이 저장, src/project/bundledTilesetDiff.ts)이 전부 「tileset beodeul_city: passability 길이 불일치」로 열리지 않았다.
// 번들 변경을 커밋하기 전에 실제 저장본 사본으로 이 스크립트를 돌린다. 원본에는 아무것도 쓰지 않는다(임시 폴더 사본에서 저장한다).
//
//   npx tsx scripts/content/check-bundle-save-compat.mts <project 폴더 | project.sqlite | 폴더를 품은 디렉터리>... [--limit N] [--keep] [--strict]
//
// 디렉터리를 주면 그 아래(깊이 4까지)의 project.sqlite 를 모두 찾는다. 한 저장본마다:
//  1) 열기  — 앱과 같은 deserialize(번들 차이 되돌리기 + 검사). 실패하면 FAIL.
//  2) 그림 지문 — 맵 네 층·겹침 스택의 칸마다 «시트 칸 n» 또는 «이식 칸(원본 칩셋, 원본 칸)». 열린 직후(저장 때 번호)에 뜬다.
//  3) 로드 정규화(ensureBundledTilesets, 편집기 로드와 같다) → 지문이 같아야 한다(번호는 바뀌어도 그림은 같다).
//  4) 저장 → 닫기 → 다시 열기 → 정규화 → 지문이 같고, 다시 정규화해도 칸 수가 그대로여야 한다.
//  5) 모든 타일셋: 칸 표 길이 = count, 이식 칸 번호 중복 없음·count 안.
//  WARN(기존 사본 구조일 수 있다 — 바꾸기 전 판에서도 같은지 그 체크아웃에서 이 스크립트로 비교한다):
//   - 번들 타일셋 번호(0..번들 count) 위에 번들과 다른 그림의 이식 칸이 있다(옛 사본의 이식 배치가 번들과 다르다).
//   - 번들과 같은 내용의 킷이 이 사본에서 다른 그림을 가리킨다(위 배치 차이가 실제로 보이는 피해).
// 종료 코드: FAIL 이 하나라도 있으면 1. --strict 면 WARN 도 1.
import { copyFileSync, existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { openLocalProjectStore } from "../../electron/local-store/store";
import { bundledTilesetById, ensureBundledTilesets } from "../../src/project/defaults/defaultAssets";
import type { Project, TilesetDef } from "../../src/project/types";

const LAYERS = ["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles"] as const;
const STACKS = ["lowerTileStacks", "upperTileStacks"] as const;
const TABLES = ["passability", "priority", "terrain", "tileMeta"] as const;

type Prints = Map<string, string[]>;

function findProjects(input: string, depth = 4): string[] {
  const path = resolve(input);
  if (!existsSync(path)) return [];
  if (!statSync(path).isDirectory()) return basename(path) === "project.sqlite" ? [dirname(path)] : [];
  if (existsSync(join(path, "project.sqlite"))) return [path];
  if (depth === 0) return [];
  return readdirSync(path).sort().flatMap((name) => (name === "assets" || name.startsWith(".") ? [] : findProjects(join(path, name), depth - 1)));
}

function copyProject(source: string): string {
  const dir = mkdtempSync(join(tmpdir(), "bundle-save-compat-"));
  for (const name of ["project.sqlite", "project.sqlite-wal", "project.sqlite-shm"]) if (existsSync(join(source, name))) copyFileSync(join(source, name), join(dir, name));
  mkdirSync(join(dir, "assets"));
  return dir;
}

function identOf(tileset: TilesetDef | undefined): (tile: number) => string {
  const grafts = new Map<number, string>();
  for (const graft of tileset?.tileGrafts ?? []) grafts.set(graft.targetTile, `g:${graft.sourceChipset}:${graft.sourceTile}`);
  const count = tileset?.count ?? 0;
  return (tile) => (typeof tile !== "number" || tile < 0 ? `n:${String(tile)}` : grafts.get(tile) ?? (tile < count ? `s:${tile}` : `e:${tile}`));
}

function prints(project: Project): Prints {
  const out: Prints = new Map();
  for (const [mapId, map] of Object.entries(project.maps ?? {})) {
    const m = map as unknown as Record<string, unknown> & { tilesetId?: string };
    const ident = identOf(m.tilesetId ? project.tilesets[m.tilesetId] : undefined);
    const cells: string[] = [];
    for (const key of LAYERS) {
      const layer = m[key];
      if (Array.isArray(layer)) for (const tile of layer) cells.push(ident(tile as number));
    }
    for (const key of STACKS) {
      const stacks = m[key] as Record<string, number[]> | undefined;
      if (stacks) for (const cell of Object.keys(stacks).sort()) cells.push(`${cell}=${(stacks[cell] ?? []).map(ident).join(",")}`);
    }
    out.set(mapId, cells);
  }
  return out;
}

function diffPrints(before: Prints, after: Prints): string[] {
  const problems: string[] = [];
  for (const [mapId, cells] of before) {
    const next = after.get(mapId);
    if (!next) { problems.push(`맵 ${mapId} 사라짐`); continue; }
    if (next.length !== cells.length) { problems.push(`맵 ${mapId} 칸 수 ${cells.length}→${next.length}`); continue; }
    let changed = 0;
    let sample = "";
    for (let index = 0; index < cells.length; index += 1) if (cells[index] !== next[index]) { if (!sample) sample = `${index}: ${cells[index]} → ${next[index]}`; changed += 1; }
    if (changed) problems.push(`맵 ${mapId} 그림 바뀐 칸 ${changed} (${sample})`);
  }
  return problems;
}

type Found = { hard: string[]; warn: string[] };

function tileNumbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === "number") out.push(value);
  else if (Array.isArray(value)) for (const inner of value) tileNumbers(inner, out);
  else if (value && typeof value === "object") for (const inner of Object.values(value)) tileNumbers(inner, out);
  return out;
}

function shapeProblems(project: Project): Found {
  const problems: string[] = [];
  const warn: string[] = [];
  for (const [id, tileset] of Object.entries(project.tilesets)) {
    for (const key of TABLES) {
      const table = (tileset as unknown as Record<string, unknown>)[key];
      if (Array.isArray(table) && table.length !== tileset.count) problems.push(`${id}.${key} 길이 ${table.length} ≠ count ${tileset.count}`);
    }
    const seen = new Set<number>();
    for (const graft of tileset.tileGrafts ?? []) {
      if (seen.has(graft.targetTile)) problems.push(`${id} 이식 칸 ${graft.targetTile} 중복`);
      seen.add(graft.targetTile);
      if (graft.targetTile >= tileset.count) problems.push(`${id} 이식 칸 ${graft.targetTile} ≥ count ${tileset.count}`);
    }
    const bundle = bundledTilesetById(id);
    if (!bundle || tileset.image.type !== "bundled" || JSON.stringify(tileset.image) !== JSON.stringify(bundle.image)) continue;
    const shipped = new Map((bundle.tileGrafts ?? []).map((graft) => [graft.targetTile, JSON.stringify(graft)]));
    let firstBundleGraft = bundle.count;
    for (const graft of bundle.tileGrafts ?? []) firstBundleGraft = Math.min(firstBundleGraft, graft.targetTile);
    let overlaps = 0;
    let sample = "";
    for (const graft of tileset.tileGrafts ?? []) {
      if (graft.targetTile >= bundle.count) continue;
      const own = shipped.get(graft.targetTile);
      // 번들 시트 칸(첫 번들 이식 칸 앞) 위의 이식, 또는 번들 이식 자리에 다른 그림 → 겹침
      if (graft.targetTile < firstBundleGraft ? own === undefined : own !== JSON.stringify(graft)) { overlaps += 1; if (!sample) sample = JSON.stringify(graft); }
    }
    if (overlaps) warn.push(`${id} 번들 번호와 다른 그림의 이식 칸 ${overlaps} (${sample})`);
    // 실제 피해: 번들과 같은 내용의 킷이 이 사본에서 다른 그림을 가리키는가(번들 칸 번호 = 사본 칸 번호여야 한다)
    const bundleIdent = identOf(bundle);
    const copyIdent = identOf(tileset);
    const shippedKits = new Map((bundle.structureKits ?? []).map((kit) => [kit.id, JSON.stringify(kit.rows)]));
    let wrongKits = 0;
    let kitSample = "";
    for (const kit of tileset.structureKits ?? []) {
      if (shippedKits.get(kit.id) !== JSON.stringify(kit.rows)) continue;
      const bad = tileNumbers(kit.rows).find((tile) => tile >= 0 && bundleIdent(tile) !== copyIdent(tile));
      if (bad !== undefined) { wrongKits += 1; if (!kitSample) kitSample = `${kit.id} 칸 ${bad}: 번들 ${bundleIdent(bad)} · 사본 ${copyIdent(bad)}`; }
    }
    if (wrongKits) warn.push(`${id} 번들 킷이 이 사본에서 다른 그림을 가리킴 ${wrongKits}개 (${kitSample})`);
  }
  return { hard: problems, warn };
}

function counts(project: Project): string {
  const tileset = project.tilesets.beodeul_city;
  return tileset ? `beodeul_city ${tileset.count}칸·이식 ${(tileset.tileGrafts ?? []).length}` : "beodeul_city 없음";
}

async function checkOne(source: string, keep: boolean): Promise<{ ok: boolean; warned: boolean; line: string }> {
  const dir = copyProject(source);
  const problems: string[] = [];
  const warnings: string[] = [];
  let line = "";
  const shape = (label: string, project: Project): void => {
    const found = shapeProblems(project);
    problems.push(...found.hard.map((p) => `${label}: ${p}`));
    warnings.push(...found.warn.map((p) => `${label}: ${p}`));
  };
  try {
    let store = await openLocalProjectStore({ projectDir: dir });
    let snapshot = store.loadSnapshot();
    if (!snapshot) throw new Error("저장된 프로젝트가 없다");
    const opened = structuredClone(snapshot.project) as Project;
    const savedShape = counts(opened);
    const before = prints(opened);
    ensureBundledTilesets(opened);
    problems.push(...diffPrints(before, prints(opened)).map((p) => `정규화: ${p}`));
    shape("정규화", opened);
    const saved = await store.saveProject(opened);
    if (saved.kind !== "saved") problems.push(`저장 실패 ${saved.kind}`);
    store.close();
    store = await openLocalProjectStore({ projectDir: dir });
    snapshot = store.loadSnapshot();
    store.close();
    if (!snapshot) throw new Error("다시 열기: 프로젝트가 없다");
    const reopened = structuredClone(snapshot.project) as Project;
    const countAfterSave = counts(reopened);
    ensureBundledTilesets(reopened);
    if (counts(reopened) !== countAfterSave) problems.push(`다시 연 뒤 정규화가 또 칸을 옮김: ${countAfterSave} → ${counts(reopened)}`);
    problems.push(...diffPrints(before, prints(reopened)).map((p) => `다시 열기: ${p}`));
    shape("다시 열기", reopened);
    let graftCells = 0;
    for (const cells of before.values()) for (const cell of cells) if (cell.includes("g:")) graftCells += 1;
    line = `저장 때 ${savedShape} → 지금 ${counts(reopened)}, 맵 ${before.size} · 이식 칸을 쓰는 맵 칸 ${graftCells}`;
  } catch (error) {
    problems.push(`열기 실패: ${error instanceof Error ? error.message : String(error)}`.slice(0, 400));
  } finally {
    if (!keep) rmSync(dir, { recursive: true, force: true });
  }
  const ok = problems.length === 0;
  const warned = warnings.length > 0;
  const notes = [...new Set(problems)].slice(0, 6).concat([...new Set(warnings)].slice(0, 4).map((w) => `WARN ${w}`));
  return { ok, warned, line: `${ok ? (warned ? "WARN" : "OK  ") : "FAIL"} ${source}\n     ${line}${notes.length ? "\n     " + notes.join("\n     ") : ""}` };
}

const args = process.argv.slice(2);
const limitAt = args.indexOf("--limit");
const limit = limitAt >= 0 ? Number(args[limitAt + 1]) : Infinity;
const keep = args.includes("--keep");
const inputs = args.filter((arg, index) => !arg.startsWith("--") && !(limitAt >= 0 && index === limitAt + 1));
if (inputs.length === 0) {
  console.error("Usage: npx tsx scripts/content/check-bundle-save-compat.mts <project 폴더 | project.sqlite | 디렉터리>... [--limit N] [--keep]");
  process.exit(2);
}
const projects = [...new Set(inputs.flatMap((input) => findProjects(input)))].slice(0, limit);
const strict = args.includes("--strict");
let failed = 0;
let warned = 0;
for (const project of projects) {
  const result = await checkOne(project, keep);
  if (!result.ok) failed += 1;
  else if (result.warned) warned += 1;
  console.log(result.line);
}
console.log(`\n저장본 ${projects.length}개 · 통과 ${projects.length - failed - warned} · 경고 ${warned} · 실패 ${failed}`);
process.exit(failed || (strict && warned) ? 1 : 0);
