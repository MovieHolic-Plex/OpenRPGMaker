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
  const deletable = [];
  const caught = [];
  for (const src of files) {
    const rel = relative(SRC, src);
    const target = join(COPY, rel);
    const original = readFileSync(src, "utf8");
    writeFileSync(target, "");
    const r = gate();
    writeFileSync(target, original);
    (r.code === 0 ? deletable : caught).push({ rel, lines: lineCount(original) });
  }
  const sum = (list) => list.reduce((n, f) => n + f.lines, 0);
  result = {
    mode,
    filter,
    total: files.length,
    deletable: deletable.length,
    caught: caught.length,
    deletableLines: sum(deletable),
    caughtLines: sum(caught),
    deletableFiles: deletable.map((f) => `${f.rel} (${f.lines}줄)`),
    note:
      "개별 통과는 «죽은 코드»가 아니라 «세대 간 중복»일 수 있다. --combined 로 동시에 비워 " +
      "확인해야 삭제 가능 여부가 정해진다.",
  };
  console.log(`\n개별 비움: ${files.length}개 중 ${deletable.length}개 통과 / ${caught.length}개 잡힘`);
  console.log(`  통과분 총 ${sum(deletable)}줄 — 이 수치는 중복성이지 삭제 허가가 아니다.`);
} else {
  const previous = (() => {
    try {
      return JSON.parse(readFileSync(OUT, "utf8"));
    } catch {
      return null;
    }
  })();
  const candidates = previous?.perSheet?.deletableFiles ?? previous?.deletableFiles;
  if (!candidates?.length) {
    console.error("--combined 는 --per-sheet 결과가 먼저 필요하다. 먼저 --per-sheet 로 돌려라.");
    rmSync(COPY, { recursive: true, force: true });
    process.exit(2);
  }
  const rels = candidates
    .map((entry) => entry.replace(/ \(\d+줄\)$/, ""))
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
