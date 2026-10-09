// scripts/qa/db-ux-report-check.mjs
// verify-shots/db-ux/REPORT.html 의 숫자를 같은 폴더의 기록 파일(probe/proof json)에서
// 다시 계산해 한 줄씩 대조한다. 하나라도 어긋나면 비정상 종료한다.
//
// 사용: node scripts/qa/db-ux-report-check.mjs
//
// 이 검사가 있는 이유: 이전 라운드에서 "측정값을 옮겨 적은 글"이 세 번 틀렸다.
// 표를 손으로 적는 대신 기록 파일이 정답이 되도록 못을 박는다.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../..");
const dir = path.join(root, "verify-shots/db-ux");

const load = (p) => JSON.parse(readFileSync(path.join(dir, p), "utf8"));
const before = load("before/probe.json");
const after = load("after/probe.json");
const pseudo = load("pseudo-baseline/probe.json");
const proof = load("placeholder/proof.json");
const narrowBefore = load("narrow-number/audit-before.json");
const narrowAfter = load("narrow-number/audit-after.json");
const html = readFileSync(path.join(dir, "REPORT.html"), "utf8");

// ---- 기록 파일에서 파생값 계산 -------------------------------------------
const headerTotals = (probe) =>
  Object.values(probe.tabs)
    .filter((t) => t && typeof t === "object" && t.space && typeof t.space.headerTotal === "number")
    .map((t) => t.space.headerTotal);

const sum1 = (xs) => Math.round(xs.reduce((a, b) => a + b, 0) * 10) / 10;
const swing1 = (xs) => Math.round((Math.max(...xs) - Math.min(...xs)) * 10) / 10;
const px = (n) => `${n.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}px`;

const T = (probe, key) => probe.totals[key];

// ---- 표에서 읽어야 하는 항목 --------------------------------------------
// label: REPORT.html 의 첫 칸 텍스트(부분 일치) / want: [이전, 이후]
const rows = [
  { label: "숫자 칸 화살표", want: [T(before, "numberUnskinned"), T(after, "numberUnskinned")] },
  { label: "슬라이더", want: [T(before, "rangeUnskinned"), T(after, "rangeUnskinned")] },
  { label: "접기 삼각형", want: [T(before, "detailsMarker"), T(after, "detailsMarker")] },
  { label: "선택 상자(select)", want: [T(before, "selectUnskinned"), T(after, "selectUnskinned")] },
  // 아래 두 항목은 "고친 것"이 아니다. 도구가 숨은 칸을 따로 세게 되면서
  // imgZero/bgZero -> imgHidden/bgHidden 으로 분류만 옮겨갔다. 이전=이후 여야 맞다.
  { label: "크기 0인 그림", want: [T(before, "imgZero"), T(after, "imgZero") + T(after, "imgHidden")] },
  { label: "배경 그림 없음", want: [T(before, "bgZero"), T(after, "bgZero") + T(after, "bgHidden")] },
  { label: "값이 안 보이는 숫자 칸", want: [narrowBefore.total, narrowAfter.total] },
  { label: "작아서 읽기 힘든 글자", want: [T(before, "tinyFont"), T(after, "tinyFont")] },
  { label: "CSS로 그린 작은 글자", want: [T(pseudo, "tinyPseudo"), T(after, "tinyPseudo")] },
  { label: "글자 잘림", want: [T(before, "selfClipped"), T(after, "selfClipped")] },
  {
    label: "헤더가 쓰는 높이 합계",
    want: [px(sum1(headerTotals(before))), px(sum1(headerTotals(after)))],
  },
  {
    label: "탭 사이 높이 들쭉날쭉",
    want: [px(swing1(headerTotals(before))), px(swing1(headerTotals(after)))],
  },
];

// 표 밖(본문/목록)에서 확인하는 항목
const inline = [
  { what: "줄 높이 좁은 규칙 이전", need: String(T(before, "lowLineHeight")), near: "줄 높이가 너무 좁던 규칙" },
  { what: "줄 높이 좁은 규칙 이후", need: String(T(after, "lowLineHeight")), near: "줄 높이가 너무 좁던 규칙" },
  { what: "실패 표시 개수", need: String(proof.after.failedMarked), near: "일부러" },
];

// ---- 대조 ----------------------------------------------------------------
const cell = (raw) => raw.replace(/<[^>]+>/g, "").trim();
const trs = html.match(/<tr>[\s\S]*?<\/tr>/g) ?? [];
const results = [];

for (const row of rows) {
  const tr = trs.find((t) => {
    const tds = t.match(/<td[^>]*>[\s\S]*?<\/td>/g);
    return tds && cell(tds[0]).startsWith(row.label);
  });
  if (!tr) {
    results.push({ ok: false, label: row.label, msg: "표에서 해당 행을 찾지 못했다" });
    continue;
  }
  const tds = tr.match(/<td[^>]*>[\s\S]*?<\/td>/g).map(cell);
  const got = [tds[1], tds[2]];
  const want = row.want.map(String);
  const ok = got[0] === want[0] && got[1] === want[1];
  results.push({
    ok,
    label: row.label,
    msg: ok ? `${got[0]} → ${got[1]}` : `표 ${got[0]} → ${got[1]} / 기록 ${want[0]} → ${want[1]}`,
  });
}

for (const item of inline) {
  const i = html.indexOf(item.near);
  const window = i < 0 ? "" : html.slice(i, i + 400);
  const ok = i >= 0 && window.includes(item.need);
  results.push({ ok, label: item.what, msg: ok ? `본문에 ${item.need} 확인` : `본문에서 ${item.need} 를 찾지 못했다` });
}

// 탭 수: 푸터 문구와 대조
const tabsBefore = T(before, "tabsMeasured") + T(before, "tabsErrored");
const tabsAfter = T(after, "tabsMeasured");
const footOk = html.includes(`탭 ${tabsBefore}개(이전) / ${tabsAfter}개(이후)`);
results.push({
  ok: footOk,
  label: "푸터 탭 수",
  msg: footOk ? `${tabsBefore} / ${tabsAfter}` : `기록은 ${tabsBefore} / ${tabsAfter}`,
});

for (const r of results) console.log(`${r.ok ? "OK  " : "FAIL"} ${r.label}: ${r.msg}`);

const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} 일치`);
if (bad.length) {
  console.error(`\n어긋난 항목 ${bad.length}개. REPORT.html 을 기록 파일에 맞춰 고쳐라.`);
  process.exit(1);
}
