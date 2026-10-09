#!/usr/bin/env node
// scripts/measure-css-deletable.mjs
//
// 이름에 `probe-` 를 쓰지 않은 이유: 이 저장소는 `/scripts/probe-*` 를 gitignore 한다
// (일회용 프로브 60개가 glob 을 오염시킨 실측 때문). 이 스크립트는 일회용이 아니라
// 보고된 수치의 재현 경로라서 추적돼야 한다.
//
// "CSS 를 얼마나 지울 수 있나"를 **게이트로 측정한다.** 눈으로 세거나 grep 으로 추정하지 않는다.
//
// 방법: `src/styles` 를 사본으로 복제하고, 사본의 시트를 비운 뒤 CSS 실사용 클래스 게이트
// (`check-css-live-classes.mjs`)를 사본에 대고 돌린다. `CSS_LIVE_STYLES_DIR` 환경변수가
// 그 방향 전환을 담당한다. `src/` 는 한 글자도 건드리지 않는다.
//
// 두 모드가 **서로 다른 것**을 재고, 둘 다 필요하다:
//
//   --per-sheet  시트를 하나씩 비워 본다. "이 시트 하나만 지워도 게이트가 조용한가."
//                이 저장소는 8세대가 겹쳐 있어서 이 수치는 대체로 **중복성**을 잰다.
//                단독 통과를 "죽은 코드"로 읽으면 안 된다.
//
//                초록을 **네 갈래로 쪼갠다.** 예전에는 통과/잡힘 두 갈래였고, 그래서 게이트가
//                «판정할 수 없는» 시트가 «삭제 가능»으로 집계됐다. 실측(이벤트 에디터 57장):
//                통과로 보고된 8장이 전부 허위였다 — 허브 5장 + 사각지대 3장.
//                  통과      게이트가 보고 있고, 비워도 속성이 안 사라진다. 유일하게 후속 검토 대상.
//                  잡힘      비우면 속성이 사라진다. 이 시트가 그 속성의 유일한 공급자다.
//                  허브      @import 를 가진 배럴. 비우면 하위 시트가 미도달인데 게이트는
//                            디렉터리 순회로 인덱싱하므로 그 손실을 **구조적으로** 못 본다.
//                  사각지대  정본 축이 이 시트의 클래스를 하나도 증명하지 않는다. 초록의 뜻이
//                            «죽었다»가 아니라 «측정하지 못했다»다. 축을 넓혀야 판정이 생긴다.
//   --combined   개별 통과한 시트를 **동시에** 비운다. 여기서도 초록이면 그때 비로소
//                "이만큼은 게이트 기준으로 정말 죽어 있다"고 말할 수 있다.
//
// ⚠ 초록의 의미를 정확히: 게이트는 «렌더된 클래스별 속성 Set» 을 지킨다. 속성은 남고
//    **값만** 바뀌는 손실은 실패가 아니라 정보로 보고한다(8세대 중복 저장소에서 값 비교를
//    하드 실패로 만들면 게이트가 상시 빨강이 되어 아무도 안 본다). 값이 바뀌면 화면은 바뀐다.
//    그래서 --combined 는 값 변경 건수를 **반드시 함께 출력한다.** 그 건수가 0 이 아니면
//    "지워도 된다"가 아니라 "지우기 전에 이 선언들을 눈으로 확인하라"는 뜻이다.
//
// 사용:
//   node scripts/measure-css-deletable.mjs --per-sheet [--filter event-editor]
//   node scripts/measure-css-deletable.mjs --combined  [--filter event-editor]
import { spawnSync } from "node:child_process";
import { readdirSync, statSync, readFileSync, writeFileSync, cpSync, rmSync, mkdirSync } from "node:fs";
import { join, relative, dirname } from "node:path";

const ROOT = process.cwd();
const SRC = join(ROOT, "src/styles");
const COPY_REL = ".omo/tmp/css-deletable-probe";
const COPY = join(ROOT, COPY_REL);
const OUT = join(ROOT, ".omo/evidence/event-editor-guard/css-deletable-headroom.json");

/**
 * 시트의 클래스 중 정본 축이 증명한 비율의 하한. 이 아래면 게이트의 초록은 판정이 아니다.
 * 0.5 는 «절반 이상은 실제로 렌더에서 봤다»는 뜻이고, 넘기려면 축을 넓히는 수밖에 없다.
 */
const MIN_COVERAGE = 0.5;

const argv = process.argv.slice(2);
const mode = argv.includes("--combined") ? "combined" : "per-sheet";
const filterIdx = argv.indexOf("--filter");
const filter = filterIdx >= 0 ? argv[filterIdx + 1] : null;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name.endsWith(".css")) out.push(p);
  }
  return out;
}

/** 정본 축이 증명한 클래스 집합. 축 목록은 게이트가 단독 소유한다 — 복제하면 조용히 어긋난다. */
function renderedSet() {
  const r = spawnSync("node", ["scripts/check-css-live-classes.mjs", "--print-rendered-classes"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (r.status !== 0) {
    console.error("정본 축 클래스 집합을 못 읽었다 — 사각지대 판정 불가.");
    console.error(`${r.stdout ?? ""}${r.stderr ?? ""}`.split("\n").slice(0, 10).join("\n"));
    process.exit(2);
  }
  return new Set(JSON.parse(r.stdout));
}

/**
 * 시트 한 장에 대해 «판정에 필요한 사실» 두 가지.
 *
 *  - imports: 이 시트가 등록하는 하위 시트 수. 배럴(허브)을 비우면 하위 시트가 미도달이 되는데,
 *    라이브 클래스 게이트는 `src/styles` 를 **디렉터리 순회**로 인덱싱하고 @import 를 따라가지
 *    않으므로(check-css-live-classes.mjs 의 walk) 그 손실을 못 본다. 그래서 허브는 항상
 *    «삭제 가능»으로 보고됐다 — 실측: 이벤트 에디터 후보 8개 중 5개가 허브였다.
 *
 *  - classes: 이 시트가 스타일하는 클래스. 정본 축에 하나도 없으면 게이트는 이 시트를 애초에
 *    보지 않는다. 그때의 초록은 «죽었다»가 아니라 «측정하지 못했다»다 — 실측:
 *    07-actor-battle-authoring-surface.css 는 55종 중 0종이 축에 있었다.
 */
function sheetFacts(text) {
  const src = text.replace(/\/\*[\s\S]*?\*\//g, " ");
  const imports = [...src.matchAll(/@import\s/gi)].length;
  const classes = new Set();
  for (const m of src.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const c of m[1].matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) classes.add(c[1]);
  }
  return { imports, classes };
}

function gate() {
  const r = spawnSync("node", ["scripts/check-css-live-classes.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, CSS_LIVE_STYLES_DIR: COPY_REL },
  });
  return { code: r.status ?? -1, out: `${r.stdout ?? ""}${r.stderr ?? ""}` };
}

/** 게이트 출력의 «값 변경 N종» — 실패가 아닌 정보 채널. */
function valueChanges(out) {
  const count = out.match(/값 변경 (\d+)종/);
  const detail = out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^\.\S+ — 값 변경 \d+건/.test(l));
  return { count: count ? Number(count[1]) : 0, detail };
}

function freshCopy() {
  rmSync(COPY, { recursive: true, force: true });
  mkdirSync(dirname(COPY), { recursive: true });
  cpSync(SRC, COPY, { recursive: true });
}

// 사본을 손대지 않은 상태에서 초록이어야 한다. 아니면 아래 판정 전부가 무의미하다.
freshCopy();
const clean = gate();
if (clean.code !== 0) {
  console.error("사본 무변경 상태에서 이미 게이트가 빨갛다 — 측정 불가.");
  console.error(clean.out.split("\n").slice(0, 14).join("\n"));
  rmSync(COPY, { recursive: true, force: true });
  process.exit(2);
}
console.log(`사본 무변경 게이트: exit=0 (값 변경 ${valueChanges(clean.out).count}종 = 기준)`);

const all = walk(SRC).sort();
const files = filter ? all.filter((p) => relative(SRC, p).includes(filter)) : all;
const lineCount = (text) => text.split("\n").length;

let result;

if (mode === "per-sheet") {
  const rendered = renderedSet();
  const deletable = [];
  const caught = [];
  const hubs = [];
  const blind = [];
  for (const src of files) {
    const rel = relative(SRC, src);
    const target = join(COPY, rel);
    const original = readFileSync(src, "utf8");
    const facts = sheetFacts(original);
    const entry = { rel, lines: lineCount(original) };

    // 허브는 게이트에 물어볼 필요조차 없다 — 게이트가 구조적으로 못 보는 손실이다.
    if (facts.imports > 0) {
      hubs.push({ ...entry, imports: facts.imports });
      continue;
    }

    writeFileSync(target, "");
    const r = gate();
    writeFileSync(target, original);

    if (r.code !== 0) {
      caught.push(entry);
      continue;
    }
    // 초록이지만 축이 이 시트의 클래스를 거의 증명하지 않았다면 «측정 실패»다.
    //
    // 0종만 걸러서는 부족하다. 실측: event-editor-legacy.part-1.css 는 52종을 스타일하는데
    // 축에 있는 건 `active`·`db-field` 2종뿐이고, 둘 다 수십 개 시트가 공유하는 범용 클래스다.
    // 그 2종이 중복이라는 사실은 나머지 50종에 대해 아무것도 말해 주지 않는다 — 지우면
    // 아무도 측정하지 않은 50종의 스타일이 함께 사라진다. 그래서 **비율**로 판정한다.
    const covered = [...facts.classes].filter((c) => rendered.has(c)).sort();
    const ratio = facts.classes.size ? covered.length / facts.classes.size : 0;
    if (ratio < MIN_COVERAGE) {
      blind.push({
        ...entry,
        styledClasses: facts.classes.size,
        coveredClasses: covered.length,
        covered,
      });
      continue;
    }
    deletable.push({ ...entry, covered, ratio });
  }
  const sum = (list) => list.reduce((n, f) => n + f.lines, 0);
  const fmt = (list) => list.map((f) => `${f.rel} (${f.lines}줄)`);
  result = {
    mode,
    filter,
    total: files.length,
    deletable: deletable.length,
    caught: caught.length,
    hub: hubs.length,
    blind: blind.length,
    deletableLines: sum(deletable),
    caughtLines: sum(caught),
    hubLines: sum(hubs),
    blindLines: sum(blind),
    deletableFiles: deletable.map((f) => `${f.rel} (${f.lines}줄) [축이 증명한 클래스 ${f.covered.length}종]`),
    caughtFiles: fmt(caught),
    hubFiles: hubs.map((f) => `${f.rel} (${f.lines}줄) [@import ${f.imports}건]`),
    minCoverage: MIN_COVERAGE,
    blindFiles: blind.map(
      (f) => `${f.rel} (${f.lines}줄) [스타일 ${f.styledClasses}종 중 축 증명 ${f.coveredClasses}종${f.covered.length ? `: ${f.covered.join(", ")}` : ""}]`,
    ),
    note:
      "«삭제 가능»조차 죽은 코드 증명이 아니다 — 세대 간 중복일 수 있으므로 --combined 로 동시에 " +
      "비워 확인해야 한다. hub/blind 는 게이트가 판정할 수 없는 시트이며 초록으로 세지 않는다.",
  };
  console.log(
    `\n개별 비움: ${files.length}개 중 통과 ${deletable.length} / 잡힘 ${caught.length} / ` +
      `허브 ${hubs.length} / 사각지대 ${blind.length}`,
  );
  console.log(`  통과분 총 ${sum(deletable)}줄 — 중복성이지 삭제 허가가 아니다.`);
  if (hubs.length) {
    console.log(`  허브 ${hubs.length}개(${sum(hubs)}줄) — 비우면 하위 시트가 미도달. 게이트가 구조적으로 못 본다:`);
    for (const f of hubs) console.log(`    ${f.rel} [@import ${f.imports}건]`);
  }
  if (blind.length) {
    console.log(
      `  사각지대 ${blind.length}개(${sum(blind)}줄) — 축 증명 비율이 ${MIN_COVERAGE} 미만이라 초록이 판정이 아니다:`,
    );
    for (const f of blind) {
      const names = f.covered.length ? `: ${f.covered.slice(0, 6).join(", ")}` : "";
      console.log(`    ${f.rel} [스타일 ${f.styledClasses}종 중 축 증명 ${f.coveredClasses}종${names}]`);
    }
  }
} else {
  const previous = (() => {
    try {
      return JSON.parse(readFileSync(OUT, "utf8"));
    } catch {
      return null;
    }
  })();
  const ranPerSheet = Boolean(previous?.perSheet ?? previous?.deletableFiles);
  const candidates = previous?.perSheet?.deletableFiles ?? previous?.deletableFiles;
  if (!ranPerSheet) {
    console.error("--combined 는 --per-sheet 결과가 먼저 필요하다. 먼저 --per-sheet 로 돌려라.");
    rmSync(COPY, { recursive: true, force: true });
    process.exit(2);
  }
  // 후보 0개는 «아직 안 돌렸다»가 아니라 «판정 가능한 시트가 없다»는 결과다. 둘을 섞으면
  // 사람이 --per-sheet 를 다시 돌리며 같은 0 을 반복해서 본다.
  if (!candidates?.length) {
    const p = previous?.perSheet ?? {};
    console.log(
      `\n동시 비움 후보 0개 — --per-sheet 가 판정 가능한 시트를 찾지 못했다` +
        `(잡힘 ${p.caught ?? "?"} / 허브 ${p.hub ?? "?"} / 사각지대 ${p.blind ?? "?"}).`,
    );
    console.log("  허브는 @import 등록을 잃고, 사각지대는 정본 축이 안 보는 시트다 — 둘 다 축을 넓혀야 판정이 생긴다.");
    rmSync(COPY, { recursive: true, force: true });
    process.exit(0);
  }
  const rels = candidates
    .map((entry) => entry.replace(/ \(\d+줄\).*$/, ""))
    .filter((rel) => (filter ? rel.includes(filter) : true));
  let lines = 0;
  for (const rel of rels) {
    lines += lineCount(readFileSync(join(SRC, rel), "utf8"));
    writeFileSync(join(COPY, rel), "");
  }
  const r = gate();
  const vc = valueChanges(r.out);
  result = {
    mode,
    filter,
    sheets: rels.length,
    lines,
    exitCode: r.code,
    propertyLoss: r.code !== 0,
    valueChangeCount: vc.count,
    valueChangeDetail: vc.detail,
    files: rels,
    note:
      r.code === 0
        ? "속성 손실 0. 다만 값 변경이 남아 있으면 화면은 바뀔 수 있다 — 그 선언들은 사람이 확인해야 한다."
        : "동시에 비우면 속성이 사라진다. 개별 통과는 세대 간 중복이었다.",
  };
  console.log(`\n${rels.length}개(${lines}줄) 동시 비움: exit=${r.code}`);
  if (r.code === 0) {
    console.log(`  속성 손실 0 / 값 변경 ${vc.count}종`);
    for (const d of vc.detail) console.log(`    ${d}`);
  } else {
    console.log(r.out.split("\n").filter((l) => l.trim()).slice(0, 14).join("\n"));
  }
}

rmSync(COPY, { recursive: true, force: true });

// 두 모드의 결과를 한 파일에 나란히 둔다 — 개별 수치만 남으면 반드시 오독된다.
const merged = (() => {
  try {
    return JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    return {};
  }
})();
if (mode === "per-sheet") merged.perSheet = result;
else merged.combined = result;
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(merged, null, 1)}\n`);
console.log(`\n보고서: ${relative(ROOT, OUT)}`);
