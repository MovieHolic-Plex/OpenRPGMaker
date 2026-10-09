#!/usr/bin/env node
// jp_city 건물 조립기 차이 증명(TS 쪽) — diff_builder.py 가 덤프한 입력·정답(Python 원본 Kit 결과)을 TS 조립기에 넣고 칸 배열을 비교한다.
//
//   node scripts/content/jp-city/diff_builder.mjs [--json OUT.json] [--no-render]
//
// 하는 일: (1) python3 diff_builder.py dump → 입력 + 정답  (2) 같은 입력을 src/editor/jpCity/builder.ts 에 넣는다(tsx)
//         (3) 칸 번호 배열·부착물 목록(순서까지)·walk·layer·문 칸·그림자 칸·막힘 격자를 칸 하나하나 비교
//         (4) python3 diff_builder.py render → TS 가 정한 칸 층(아래·위·덧)을 시트로 합성해 Kit.render 와 화소 비교(그림자 제외)
// 종료 코드: 칸 배열 불일치 또는 화소 불일치가 있으면 1. TS 가 오류(issues error)로 거부한 입력은 불일치가 아니라 따로 센다.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");
if (!process.env.JP_DIFF_UNDER_TSX) {
  const r = spawnSync("npx", ["--no-install", "tsx", fileURLToPath(import.meta.url), ...process.argv.slice(2)], { stdio: "inherit", cwd: ROOT, env: { ...process.env, JP_DIFF_UNDER_TSX: "1" } });
  process.exit(r.status ?? 1);
}
const { buildJpCityBuilding } = await import(pathToFileURL(join(ROOT, "src/editor/jpCity/builder.ts")).href);

const args = process.argv.slice(2);
const jsonOut = args.includes("--json") ? args[args.indexOf("--json") + 1] : null;
const dir = mkdtempSync(join(tmpdir(), "jp-diff-"));
const dumpPath = join(dir, "cases.json");
const py = (a) => spawnSync("python3", [join(HERE, "diff_builder.py"), ...a], { cwd: ROOT, encoding: "utf-8" });
const d = py(["dump", dumpPath]);
if (d.status !== 0) { console.error(d.stdout, d.stderr); process.exit(2); }
console.log("[dump]", d.stdout.trim());
const { cases, skipped } = JSON.parse(readFileSync(dumpPath, "utf-8"));

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const rows = []; const tsOut = [];
for (const c of cases) {
  const res = buildJpCityBuilding(c.input);
  const e = c.expected; const a = res.assembled;
  const diffs = [];
  if (!a) { rows.push({ name: c.name, kind: c.kind, match: false, diffs: [`TS 조립 실패: ${res.issues.map((i) => i.code).join(",")}`], errors: res.issues.filter((i) => i.severity === "error").map((i) => i.code) }); continue; }
  if (a.n !== e.n || a.rows !== e.rows) diffs.push(`크기 TS ${a.n}×${a.rows} / 원본 ${e.n}×${e.rows}`);
  const note = (what, r, col, got, want) => { if (diffs.length < 8) diffs.push(`${what} (행${r},열${col}) TS ${JSON.stringify(got)} / 원본 ${JSON.stringify(want)}`); };
  let cellMiss = 0;
  for (let r = 0; r < e.rows; r++) for (let col = 0; col < e.n; col++) { if ((a.cells[r]?.[col] ?? null) !== e.cells[r][col]) { cellMiss++; note("칸", r, col, a.cells[r]?.[col], e.cells[r][col]); } }
  let decoMiss = 0;
  if (a.deco.length !== e.deco.length) { decoMiss++; diffs.push(`부착물 칸 수 TS ${a.deco.length} / 원본 ${e.deco.length}`); }
  for (let i = 0; i < Math.min(a.deco.length, e.deco.length); i++) if (!eq(a.deco[i], e.deco[i])) { decoMiss++; note("부착물", e.deco[i][0], e.deco[i][1], a.deco[i], e.deco[i]); }
  let walkMiss = 0, layerMiss = 0;
  for (let r = 0; r < e.rows; r++) for (let col = 0; col < e.n; col++) {
    if (a.walk[r][col] !== e.walk[r][col]) { walkMiss++; note("walk", r, col, a.walk[r][col], e.walk[r][col]); }
    if (a.layer[r][col] !== e.layer[r][col]) { layerMiss++; note("layer", r, col, a.layer[r][col], e.layer[r][col]); }
  }
  const doorsOk = eq(a.doors, e.doors); if (!doorsOk) diffs.push(`문 칸 TS ${JSON.stringify(a.doors)} / 원본 ${JSON.stringify(e.doors)}`);
  const shadowOk = eq([...a.shadowCells].sort(), [...e.shadowCells].sort()); if (!shadowOk) diffs.push(`그림자 칸 TS ${JSON.stringify(a.shadowCells)} / 원본 ${JSON.stringify(e.shadowCells)}`);
  // 막힘 격자: 칸에 무언가 있는 곳만 비교(없는 곳은 둘 다 걸을 수 있음)
  const has = new Set(res.placements.map((p) => `${p.y - res.rect.y0},${p.x - res.rect.x0}`));
  let solidMiss = 0; const solidDetail = [];
  for (let r = 0; r < e.rows; r++) for (let col = 0; col < e.n; col++) {
    if (!has.has(`${r},${col}`)) continue;
    if (res.solid[r][col] !== e.rect_solid[r][col]) { solidMiss++; if (solidDetail.length < 6) solidDetail.push(`(행${r},열${col}) TS ${res.solid[r][col] ? "막힘" : "통과"} / 원본 ${e.rect_solid[r][col] ? "막힘" : "통과"}`); }
  }
  if (solidMiss) diffs.push(`막힘 ${solidMiss}칸 불일치: ${solidDetail.join(" ")}`);
  // 창 위에 얹힌 부착물: 원본 gen.lint_specs 의 [부위, 층, 부착물, 열] 과 TS DECO_CLASH(detail window:층:부착물, 열 = 건물 안 열)를 견준다
  const tsLint = res.issues.filter((i) => i.detail?.startsWith("window:")).map((i) => { const [, fl, dn] = i.detail.split(":"); return [Number(fl), dn, i.x - res.rect.x0 - (i.message.startsWith("별채") ? 0 : 0)]; });
  const wantLint = e.lint.map(([part, fl, dn, col]) => [fl, dn, col, part]);
  const lintOk = c.kind === "single" ? eq(tsLint.map((x) => [x[0], x[1], x[2]]).sort(), wantLint.map((x) => [x[0], x[1], x[2]]).sort())
    : eq(tsLint.map((x) => `${x[0]}:${x[1]}`).sort(), wantLint.map((x) => `${x[0]}:${x[1]}`).sort());
  if (!lintOk) diffs.push(`창 부착물 검사 TS ${JSON.stringify(tsLint)} / 원본 ${JSON.stringify(wantLint)}`);
  const match = lintOk && cellMiss === 0 && decoMiss === 0 && walkMiss === 0 && layerMiss === 0 && doorsOk && shadowOk && solidMiss === 0 && a.n === e.n && a.rows === e.rows;
  rows.push({ name: c.name, kind: c.kind, match, cells: e.n * e.rows, cellMiss, decoMiss, walkMiss, layerMiss, solidMiss, diffs, errors: res.issues.filter((i) => i.severity === "error").map((i) => `${i.code}@(${i.x},${i.y})`), warnings: res.issues.filter((i) => i.severity === "warning").map((i) => i.code) });
  tsOut.push({ name: c.name, placements: res.placements });
}

const matched = rows.filter((r) => r.match).length;
const totalCells = rows.reduce((s, r) => s + (r.cells ?? 0), 0);
console.log(`\n[칸 배열 비교] 입력 ${rows.length}건 (단일 ${rows.filter((r) => r.kind === "single").length} · L자 ${rows.filter((r) => r.kind === "L").length}), 비교 칸 ${totalCells}개`);
console.log(`  일치 ${matched} / 불일치 ${rows.length - matched}`);
for (const r of rows.filter((x) => !x.match)) { console.log(`  불일치 ${r.name}`); for (const d of r.diffs) console.log(`      ${d}`); }
const rejected = rows.filter((r) => r.errors.length);
console.log(`\n[TS 조립기가 오류로 거부한 입력] ${rejected.length}건 (정답과 칸 배열은 위에서 이미 비교함)`);
for (const r of rejected) console.log(`  ${r.name}: ${r.errors.join(" ")}`);
if (skipped.length) { console.log(`\n[원본이 스스로 거부해 비교에서 뺀 입력] ${skipped.length}건`); for (const s of skipped) console.log(`  ${s.name}: ${s.error}`); }

let renderStatus = 0;
if (!args.includes("--no-render")) {
  const tsPath = join(dir, "ts-out.json");
  writeFileSync(tsPath, JSON.stringify({ cases: tsOut }));
  const r = py(["render", tsPath]);
  console.log("\n[렌더 화소 비교: TS 칸 층 합성 vs Python Kit.render(그림자 제외)]");
  console.log(" ", (r.stdout || r.stderr).trim());
  renderStatus = r.status ?? 1;
}
if (jsonOut) writeFileSync(jsonOut, JSON.stringify({ matched, total: rows.length, rows, skipped }, null, 1));
process.exit(matched === rows.length && renderStatus === 0 ? 0 : 1);
