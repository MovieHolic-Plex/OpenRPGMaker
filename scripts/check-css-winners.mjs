#!/usr/bin/env node
// CSS 승자 래칫 게이트 — (선택자, 속성, 조건) 쌍마다 **어느 선언이 실제로 이기는가**를 고정한다.
//
// 왜 필요한가: 2026-09-17 적대적 리뷰(D)가 기존 게이트 4개를 전부 통과하면서 화면을
// 뒤엎는 변경 4가지를 실측했다. 지문 해시까지 동일했다.
//   1. index.css:3 의 `@layer` 순서 한 줄을 역순으로 → 앱 전체 캐스케이드 역전, 4/4 초록
//   2. tokens.css 의 hex 27개를 전부 흑백으로 (자릿수 보존) → 4/4 초록
//   3. `@import "x.css"` → `@import url(x.css)` → 시트 하나가 검사에서 통째로 증발
//   4. `@layer overrides { … display:none !important }` 30줄 추가 → UI 3종 소멸, 4/4 초록
// 공통 원인은 하나다 — 기존 게이트는 선언을 **세기만** 하고 누가 이기는지 보지 않았다.
// R1 은 `!d.layer`(레이어 유무)만 보고 어느 레이어인지 안 봤고, indexDeclarations 가 만드는
// seq(문서 순서)는 runSurfaceChecks 에서 한 번도 참조되지 않았다.
//
// 기준선 철학은 다른 게이트와 같다: 현재 승자 집합을 떠 두고 **바뀐 승자만** 회귀로 본다.
// 의도한 변경이면 `--save-baseline` 로 다시 뜬다 — 그때 diff 가 리뷰 대상이 된다.
//
// 사용:
//   node scripts/check-css-winners.mjs                  # 검사 (exit 1 = 승자 변경)
//   node scripts/check-css-winners.mjs --save-baseline  # 기준선 갱신
//   node scripts/check-css-winners.mjs --json           # 기계 판독용
//   node scripts/check-css-winners.mjs --limit 50       # 보고할 변경 건수 상한(기본 25)
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import { declarationsOf, flattenImports, emitOrder, specificity } from "./css-flatten.mjs";
import { discoverEntries } from "./lib/css-entries.mjs";

// 레이어 "직속". 같은 레이어의 모든 서브레이어보다 강하다(CSS Cascade 5 §6.4.4).
const DIRECT = Number.MAX_SAFE_INTEGER;

// 본문 없는 `@layer a, b, c;` 선언문. 여기가 우선순위의 **유일한 원천**이므로
// 순서를 하드코딩하면 안 된다 — D 시나리오 1(이 줄 역순)이 안 보이게 된다.
function layerStatementNames(css) {
  const names = [];
  let ast;
  try { ast = postcss.parse(css); } catch { return names; }
  ast.walkAtRules("layer", (at) => {
    if (at.nodes) return; // 본문이 있으면 블록이지 선언문이 아니다
    for (const n of at.params.split(",").map((s) => s.trim()).filter(Boolean)) names.push(n);
  });
  return names;
}

// 레이어 경로 → 비교용 벡터. 사전식으로 비교하면 캐스케이드 레이어 규칙이 그대로 나온다.
//   언레이어        → [DIRECT]                  (normal 중 최강)
//   `app`           → [idx(app), DIRECT]
//   `app.sub`       → [idx(app), idx(app.sub), DIRECT]
// `[i, DIRECT]` vs `[i, j, DIRECT]` 는 1번 자리에서 DIRECT > j 이므로 부모 직속이 이긴다.
// important 선언은 이 벡터의 부호를 뒤집는다 — 레이어 순서가 역전되고 언레이어가 최약이 된다.
function makeLayerRanker(declaredOrder) {
  const assigned = new Map();
  let overflow = 0;
  const indexOf = (fullPath) => {
    if (!assigned.has(fullPath)) {
      const top = !fullPath.includes(".");
      const declared = top ? declaredOrder.indexOf(fullPath) : -1;
      // 선언문에 없는 레이어는 첫 사용 순서대로 선언된 것들 **뒤에** 붙는다.
      assigned.set(fullPath, declared >= 0 ? declared : declaredOrder.length + overflow++);
    }
    return assigned.get(fullPath);
  };
  return (pathStr) => {
    if (!pathStr) return [DIRECT];
    const vec = [];
    let prefix = "";
    for (const part of pathStr.split(".")) {
      prefix = prefix ? `${prefix}.${part}` : part;
      vec.push(indexOf(prefix));
    }
    vec.push(DIRECT);
    return vec;
  };
}

function compareVectors(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    const x = a[i] ?? -Infinity;
    const y = b[i] ?? -Infinity;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

// a 가 b 를 이기는가. 규격 순서: important → 레이어 → 특이도 → 문서 순서.
function beats(a, b) {
  if (a.imp !== b.imp) return a.imp;
  const cmp = compareVectors(a.layerVec, b.layerVec);
  if (cmp !== 0) return cmp > 0;
  if (a.spec !== b.spec) return a.spec > b.spec;
  return a.seq > b.seq;
}

/**
 * @param {{ layerOrder?: string[], sheets: {name: string, css: string, layer?: string|null}[] }} input
 *        sheets 는 **최종 문서 순서**로 온다(허브 자신의 규칙은 그 허브가 import 한 시트 뒤).
 * @returns {Record<string, {where: string, layer: string, value: string, imp: boolean}>}
 *          키는 `선택자|속성` 이고 `@media`/`@supports`/`@container` 안이면 `|조건` 이 붙는다.
 *          조건이 다르면 애초에 경쟁이 아니므로 같은 키로 묶으면 거짓 승자가 나온다.
 */
export function computeWinners({ layerOrder = [], sheets }) {
  const declared = [];
  const push = (n) => { if (n && !declared.includes(n)) declared.push(n); };
  for (const s of sheets) for (const n of layerStatementNames(s.css)) push(n);
  for (const n of layerOrder) push(n);
  const layerVecOf = makeLayerRanker(declared);

  const winners = Object.create(null);
  let seq = 0;
  for (const s of sheets) {
    let decls;
    try { decls = declarationsOf({ name: s.name, css: s.css, layer: s.layer ?? null }); } catch { continue; }
    for (const d of decls) {
      seq += 1;
      const raw = layerVecOf(d.layer);
      const cand = {
        imp: d.imp,
        layerVec: d.imp ? raw.map((n) => -n) : raw,
        spec: specificity(d.sel),
        seq,
        where: `${d.file}:${d.line}`,
        layer: d.layer ?? "(unlayered)",
        value: d.imp ? `${d.value} !important` : d.value,
      };
      const key = d.at ? `${d.sel}|${d.prop}|${d.at}` : `${d.sel}|${d.prop}`;
      const prev = winners[key];
      cand.rivals = (prev?.rivals ?? 0) + 1;
      if (!prev || beats(cand, prev)) winners[key] = cand;
      else prev.rivals = cand.rivals;
    }
  }
  return winners;
}

// 사람이 읽는 형식. 줄 번호를 **포함**한다 — 보고를 받은 사람이 바로 열어 봐야 하기 때문이다.
// 래칫 비교에 쓰는 형식은 줄 번호가 없는 ratchetOf 다(아래). 둘을 헷갈리면 게이트가
// 줄 밀림마다 대량 오보를 낸다.
export const readableOf = (w) => `${w.where} [${w.layer}] ${w.value}`;

// 값까지 적는다 — 위치만 적으면 D 시나리오 2(토큰 색을 전부 흑백으로)가 승자 위치를
// 안 바꾸기 때문에 통째로 무음이 된다.
export function formatWinners(winners) {
  const out = {};
  for (const key of Object.keys(winners).sort()) out[key] = readableOf(winners[key]);
  return out;
}

// ── 기준선 인코딩 ──────────────────────────────────────────────────────────────
//
// 저장은 **조각** 단위다(2026-11-24). 전에는 파일 하나(scripts/css-winners.baseline.json, 4.8 MB)였고
// CSS 를 조금이라도 건드린 PR 이마다 그 파일을 다시 썼다. 먼저 머지된 PR 이 생기면 나머지는 전부
// 충돌 → 리베이스 → --save-baseline → CI 재실행이었다. 조각은 엔트리 × **승자 원본 파일** 이다 —
// 승자의 `where` 파일이 곧 조각이므로 다른 시트를 건드린 PR 은 같은 조각을 쓰지 않는다.
//   - 항목은 한 줄에 하나, 키는 정렬. 같은 조각을 두 PR 이 고쳐도 다른 줄이면 git 이 합친다.
//     같은 줄이면 `npm run css-baseline:rebase` 가 --save-baseline 로 다시 만든다.
//   - 색인 테이블(files/layers/values)은 두지 않는다. 조각마다 따로 두면 저장마다 밀려 diff 잡음이 되고,
//     한 파일에 두면 모든 PR 이 같은 파일을 쓰는 문제가 그대로 남는다.
//   - 생성 시각 필드는 두지 않는다. 같은 조각을 건드린 두 PR 이 그 한 줄을 항상 다르게 써서, 항목 줄이
//     겹치지 않아도 무조건 충돌한다(2026-11-24 시연에서 확인). 나이 경고도 뺀다 — 이 게이트는 매번
//     승자 전체를 대조하므로 오래된 조각이 빚을 숨기지 않는다(유예 목록형 기준선과 다르다).
//
// 래칫 값에서 **줄 번호를 뺀다**. 넣었더니 `database/states.css` 맨 위에 주석 한 줄을
// 넣는 것만으로 "승자 121건 변경"이 떴다 — 전부 줄이 1씩 밀린 것뿐이고 픽셀 변화는 0이다.
// 양치기 소년이 된 게이트는 꺼진 게이트와 같다. 줄 번호는 **보고할 때만** 현재 값을 쓴다.
//
// 키(선택자|속성|조건)는 sha1 앞 12자리다(131,790건 기준 충돌 확률 ~4e-5).
//     해시만으로도 검사는 완전하고, 이름은 검사 시점에 현재 소스에서 되찾는다.
//   - 단 **경쟁이 있던 키**(2건 이상이 같은 키를 다툰 것)는 원문을 같이 적는다. 캐스케이드가
//     실제로 판정을 내린 자리라 사람이 읽을 값이 있고, 전체의 1%(545건)라 크기 부담이 없다.
import { createHash } from "node:crypto";

const hashKey = (key) => createHash("sha1").update(key).digest("hex").slice(0, 12);

// 래칫 대상 문자열. 줄 번호 없음 — 파일·레이어·값이 같으면 같은 승자로 본다.
export const ratchetOf = (w) => `${w.where.replace(/:\d+$/, "")} [${w.layer}] ${w.value}`;

export const BASELINE_DIR = "scripts/css-winners";
const LEGACY_BASELINE = "scripts/css-winners.baseline.json";

// `src/a/b.css` → `a/b`. 엔트리와 승자 파일 둘 다 이 꼴이다.
const stemOf = (rel) => {
  if (!rel.startsWith("src/") || !rel.endsWith(".css")) throw new Error(`기준선 경로는 src/ 아래 .css 여야 한다: ${rel}`);
  return rel.slice(4, -4);
};

// 조각 경로. `<엔트리>/<승자 파일>.json` — 디렉터리만 봐도 어느 번들의 어느 시트인지 알게 한다.
export function shardRelPath(entry, file) {
  return `${BASELINE_DIR}/${stemOf(entry)}/${stemOf(file)}.json`;
}

// 한 엔트리의 승자 맵을 승자 원본 파일별로 묶는다 → Map<파일, {contested, winners}>.
// 값은 `[레이어] 값` — 파일은 조각이 정하므로 줄마다 되풀이하지 않는다.
// 항목 순서는 **해시 순**이다. 선택자 이름 순으로 쓰면 두 PR 이 다른 키를 같은 줄 자리에 넣게 된다.
export function groupByFile(winners) {
  const groups = new Map();
  for (const key of Object.keys(winners)) {
    const x = winners[key];
    const file = x.where.replace(/:\d+$/, "");
    let g = groups.get(file);
    if (!g) { g = { file, contested: {}, winners: {} }; groups.set(file, g); }
    const h = hashKey(key);
    g.winners[h] = `[${x.layer}] ${x.value}`;
    if (x.rivals > 1) g.contested[h] = `${key}  (경쟁 ${x.rivals})`;
  }
  for (const g of groups.values()) {
    for (const table of ["winners", "contested"]) {
      const sorted = {};
      for (const h of Object.keys(g[table]).sort()) sorted[h] = g[table][h];
      g[table] = sorted;
    }
  }
  return groups;
}

export function encodeShard(entry, group) {
  return { entry, file: group.file, contested: group.contested, winners: group.winners };
}

// 들여쓰기 1 → 중첩 객체의 항목이 **한 줄에 하나** 놓인다.
export const serializeShard = (doc) => `${JSON.stringify(doc, null, 1)}\n`;

// 조각 → diffWinners 이 받는 형태(winners[해시] = `파일 [레이어] 값`).
export function decodeShard(doc) {
  const winners = {};
  for (const [h, v] of Object.entries(doc.winners ?? {})) winners[h] = `${doc.file} ${v}`;
  return { winners, contested: doc.contested ?? {} };
}

function walkJson(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = `${dir}/${name}`;
    if (statSync(full).isDirectory()) walkJson(full, out);
    else if (name.endsWith(".json")) out.push(full);
  }
  return out;
}

/**
 * 기준선을 읽어 엔트리별로 합친다. 조각이 하나도 없으면 null (호출자가 안내 문구를 찍는다).
 * @returns {{ entries: Record<string, {winners: Record<string, string>, contested: Record<string, string>}>, shards: number }|null}
 */
export function readBaseline(root) {
  const dir = resolve(root, BASELINE_DIR);
  if (!existsSync(dir)) return null;
  const paths = walkJson(dir);
  if (paths.length === 0) return null;
  const entries = {};
  for (const p of paths) {
    let doc;
    try { doc = JSON.parse(readFileSync(p, "utf8")); } catch (e) { throw new Error(`기준선 조각이 깨졌다: ${relative(root, p)} (${e.message})`); }
    if (!doc?.entry || !doc?.file || typeof doc.winners !== "object") throw new Error(`기준선 조각 모양이 틀리다: ${relative(root, p)}`);
    entries[doc.entry] ??= { winners: {}, contested: {} };
    const e = entries[doc.entry];
    const d = decodeShard(doc);
    Object.assign(e.winners, d.winners);
    Object.assign(e.contested, d.contested);
  }
  return { entries, shards: paths.length };
}

/**
 * 엔트리별 승자 맵을 조각으로 쓴다. 내용이 같은 조각은 건드리지 않고(mtime·diff 유지),
 * 더 이상 승자가 없는 조각과 옛 단일 파일은 지운다.
 * @returns {{ total: number, written: number, removed: string[] }}
 */
export function writeBaseline(root, perEntry) {
  const dir = resolve(root, BASELINE_DIR);
  const seen = new Set();
  const out = { total: 0, written: 0, removed: [] };
  for (const entry of Object.keys(perEntry).sort()) {
    for (const group of groupByFile(perEntry[entry]).values()) {
      const rel = shardRelPath(entry, group.file);
      if (seen.has(rel)) throw new Error(`조각 경로가 겹친다: ${rel}`);
      seen.add(rel);
      out.total += 1;
      const abs = resolve(root, rel);
      const doc = encodeShard(entry, group);
      let current = null;
      try { current = readFileSync(abs, "utf8"); } catch { current = null; }
      if (current === serializeShard(doc)) continue;
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, serializeShard(doc));
      out.written += 1;
    }
  }
  if (existsSync(dir)) {
    for (const p of walkJson(dir)) {
      if (!seen.has(relative(root, p).split("\\").join("/"))) { unlinkSync(p); out.removed.push(relative(root, p).split("\\").join("/")); }
    }
    for (const sub of [...new Set([...seen].map((r) => dirname(r)))]) {
      let d = resolve(root, sub);
      while (d.startsWith(dir + "/") && d !== dir) {
        if (readdirSync(d).length > 0) break;
        rmSync(d);
        d = dirname(d);
      }
    }
  }
  const legacy = resolve(root, LEGACY_BASELINE);
  if (existsSync(legacy)) { unlinkSync(legacy); out.removed.push(LEGACY_BASELINE); }
  return out;
}

// 파일 경로를 뺀 래칫. 시트를 **옮기기만** 했을 때 캐스케이드가 그대로인지 증명할 때 쓴다
// (Phase 3·4 의 대규모 이동). 레이어와 값은 그대로 비교하므로 이동에 섞인 실제 변경은 잡는다.
const stripFile = (s) => s.replace(/^.*?( \[)/, "$1");



/**
 * 기준선(디코드된 것)과 현재 승자 맵을 비교한다.
 * @param {Record<string, {winners: Record<string,string>, contested: Record<string,string>}>} before
 * @param {Record<string, Record<string, object>>} current 엔트리 → 승자 레코드 맵
 * @param {{ ignoreFile?: boolean }} opts ignoreFile 이면 파일 경로를 빼고 비교한다(순수 이동 증명용).
 */
export function diffWinners(before, current, { ignoreFile = false } = {}) {
  const norm = (s) => (ignoreFile ? stripFile(s) : s);
  const changes = [];
  for (const entry of [...new Set([...Object.keys(before), ...Object.keys(current)])].sort()) {
    const b = before[entry];
    const cur = current[entry];
    if (!b) { changes.push({ entry, name: "(번들 전체)", before: "(없음)", after: "새 엔트리" }); continue; }
    if (!cur) { changes.push({ entry, name: "(번들 전체)", before: "있음", after: "(사라짐)" }); continue; }
    // 해시 → 현재 키 이름. 사라진 키는 기준선의 경쟁 키 원문으로, 그것도 없으면 해시로 부른다.
    const nameOf = new Map();
    const curByHash = new Map();
    for (const key of Object.keys(cur)) {
      const h = hashKey(key);
      nameOf.set(h, key);
      curByHash.set(h, cur[key]);
    }
    for (const h of new Set([...Object.keys(b.winners), ...curByHash.keys()])) {
      const was = b.winners[h] === undefined ? undefined : norm(b.winners[h]);
      const now = curByHash.has(h) ? norm(ratchetOf(curByHash.get(h))) : undefined;
      if (was === now) continue;
      changes.push({
        entry,
        name: nameOf.get(h) ?? b.contested[h] ?? `(사라진 키 ${h})`,
        before: b.winners[h] ?? "(없음 — 새 선언)",
        after: curByHash.has(h) ? readableOf(curByHash.get(h)) : "(사라짐)",
      });
    }
  }
  return changes.sort((a, b2) => a.entry.localeCompare(b2.entry) || a.name.localeCompare(b2.name));
}

// ── CLI ───────────────────────────────────────────────────────────────────────

export function collectSheets(entryAbs, root) {
  const sheets = [];
  for (const item of emitOrder(flattenImports(entryAbs))) {
    let css;
    try { css = readFileSync(item.file, "utf8"); } catch { continue; }
    sheets.push({ name: relative(root, item.file).split("\\").join("/"), css, layer: item.layer });
  }
  return sheets;
}

// 엔트리별 승자 맵(원시 레코드). 검사와 기준선 저장이 같은 함수를 쓴다.
export function buildAll(root) {
  const { entries, discovery } = discoverEntries(root);
  const perEntry = {};
  for (const entryAbs of [...entries.keys()].sort()) {
    const rel = relative(root, entryAbs).split("\\").join("/");
    perEntry[rel] = computeWinners({ sheets: collectSheets(entryAbs, root) });
  }
  return { discovery, perEntry };
}

function main() {
  const root = process.cwd();
  const args = process.argv.slice(2);
  const limitArg = args.indexOf("--limit");
  const limit = limitArg >= 0 ? Number(args[limitArg + 1]) || 25 : 25;
  const { discovery, perEntry } = buildAll(root);
  const totals = Object.entries(perEntry)
    .map(([e, m]) => `${e.replace(/^src\//, "")}=${Object.keys(m).length}`)
    .join(" ");
  const note = discovery === "scan" ? "엔트리 스캔" : "엔트리 폴백";

  if (args.includes("--save-baseline")) {
    const w = writeBaseline(root, perEntry);
    const removed = w.removed.length ? ` · 지움 ${w.removed.length}` : "";
    console.log(`css-winners: 기준선 저장 (${note}) 조각 ${w.total}개 중 바뀐 것 ${w.written}개${removed}. ${totals}`);
    return 0;
  }

  const stored = readBaseline(root);
  if (!stored) {
    console.error("css-winners: 기준선이 없다. `node scripts/check-css-winners.mjs --save-baseline` 로 먼저 뜬다.");
    return 1;
  }

  const before = stored.entries;
  const ignoreFile = args.includes("--ignore-file");
  const changes = diffWinners(before, perEntry, { ignoreFile });
  if (ignoreFile) console.error("  (--ignore-file: 파일 경로를 뺀 비교 — 순수 이동 증명용)");

  if (args.includes("--json")) {
    console.log(JSON.stringify({ changed: changes.length, changes }, null, 1));
    return changes.length ? 1 : 0;
  }
  if (changes.length === 0) {
    console.log(`css-winners: 승자 변경 없음 (${note}) ${totals}`);
    return 0;
  }
  console.error(`css-winners: 승자 ${changes.length}건이 바뀌었다 (${totals})`);
  for (const c of changes.slice(0, limit)) {
    console.error(`  [${c.entry}] ${c.name}\n      전: ${c.before}\n      후: ${c.after}`);
  }
  if (changes.length > limit) console.error(`  … 외 ${changes.length - limit}건 (--limit N 으로 더 보기)`);
  console.error("의도한 변경이면 `node scripts/check-css-winners.mjs --save-baseline` 후 diff 를 리뷰에 올린다. 리베이스에서 조각이 충돌하면 `npm run css-baseline:rebase`.");
  return 1;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  process.exit(main());
}
