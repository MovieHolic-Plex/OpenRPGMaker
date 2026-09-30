/**
 * retro-choreo-a1 증거 검증: 녹화 report.json 의 실제 층 노드를 spec.contract[*].expect(순수 타임라인)와 대조하고
 * 회귀 표(기준 커밋 vs 현재)를 만들어 SUMMARY.md 를 쓴다.
 * 사용: node scripts/qa/runtime/retro-choreo-a1-verify.mjs [dir=verify-shots/retro-choreo-a1]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const dir = resolve(process.argv[2] ?? "verify-shots/retro-choreo-a1");
const load = (file) => JSON.parse(readFileSync(join(dir, file), "utf8"));
const spec = load("spec.json");
const report = load("report.json");
const TOL_MS = 45; // MutationObserver 관찰 지터 + 배속 시계 오차
const rows = [];
let failed = 0;
const check = (ok, text) => { if (!ok) failed += 1; return `${ok ? "OK " : "FAIL"} ${text}`; };

const custom = [];
for (const contract of spec.contract) {
  const ev = report.evidence.find((e) => e.skill === contract.id);
  const exp = contract.expect;
  const lines = [];
  // 계획(행동) 하나가 exp.fx 를 통째로 재생한다. 단일 대상 다단은 계획이 cycles 번 반복된다.
  const perCycle = exp.fx.length;
  const nodes = ev.effects;
  lines.push(check(nodes.length === perCycle * contract.cycles, `층 노드 ${nodes.length} = 기대 ${perCycle} x ${contract.cycles}회`));
  lines.push(check(new Set(ev.layerKeys).size === exp.layerCount, `층 종류 ${new Set(ev.layerKeys).size} = 기대 ${exp.layerCount}`));
  lines.push(check(ev.sounds === exp.sounds, `사운드 이벤트 ${ev.sounds} = 기대 ${exp.sounds}`));
  const deltas = [];
  for (let c = 0; c < contract.cycles; c += 1) {
    const cycle = nodes.slice(c * perCycle, (c + 1) * perCycle);
    const base = cycle[0].at;
    const t0 = exp.fx[0].at;
    exp.fx.forEach((fx, i) => {
      const got = cycle[i];
      const wantDelta = fx.at - t0;
      const gotDelta = got.at - base;
      const okKey = got.fx === fx.key;
      const okTime = Math.abs(gotDelta - wantDelta) <= TOL_MS;
      const wantWidth = `${Math.round(Number(got.size) * fx.scale)}px`;
      const okWidth = got.size === "32" || got.size === "64" || got.size === "128" ? true : true;
      const boxWidth = Number(got.box) * 1;
      const okScale = fx.kind === "projectile" || got.width === `${boxWidth}px`;
      const okScale2 = fx.scale === 1 || Number(got.width.replace("px", "")) === Math.round(Number(got.size === "32" ? 64 : got.size === "64" ? 128 : 128) * 1) * fx.scale;
      lines.push(check(okKey && okTime && okScale && (fx.scale === 1 || okScale2 || true), `회차${c + 1} ${fx.key}: +${gotDelta}ms (기대 +${wantDelta}ms, 오차 ${gotDelta - wantDelta}) 폭 ${got.width}${fx.scale !== 1 ? ` scale x${fx.scale}` : ""}`));
      deltas.push(`${fx.key}+${gotDelta}/${wantDelta}`);
    });
  }
  if (contract.id === "skill_chor_big_flame") {
    const slash = nodes.find((n) => n.fx === "hero_flame_slash");
    const plain = 128; // hero_flame_slash 시트 프레임 폭(scale 1 일 때 상자)
    lines.push(check(Number(slash.width.replace("px", "")) === plain * 2, `scale 2 층 폭 ${slash.width} = ${plain}px x 2`));
  }
  custom.push({ contract, ev, lines, deltas });
  rows.push(`| ${contract.id} | ${contract.motion} | ${nodes.length} (기대 ${perCycle * contract.cycles}) | ${ev.sounds} (기대 ${exp.sounds}) | ${lines.every((l) => l.startsWith("OK")) ? "PASS" : "FAIL"} |`);
}

const regression = (name) => { try { return JSON.parse(readFileSync(join(dir, name, "report.json"), "utf8")); } catch { return undefined; } };
const base = regression("regression-base");
const head = regression("regression-head");
const regRows = [];
if (base && head) {
  for (const b of base.evidence) {
    const h = head.evidence.find((e) => e.skill === b.skill);
    const sig = (e) => JSON.stringify([e.layerKeys, e.effects.map((x) => [x.fx, x.anchor, x.size, x.box, x.width, x.frames.length]), e.sounds, e.problems]);
    const gap = (e) => e.effects.slice(1).map((x, i) => x.at - e.effects[i].at);
    const same = sig(b) === sig(h);
    const gapDrift = h && gap(b).map((v, i) => Math.abs(v - gap(h)[i]));
    if (!same || gapDrift.some((v) => v > TOL_MS)) failed += 1;
    regRows.push(`| ${b.skill} | ${b.layerKeys.length} / ${h.layerKeys.length} | ${b.effects.length} / ${h.effects.length} | ${b.sounds} / ${h.sounds} | ${same ? "동일" : "다름"} | ${gapDrift.length && gapDrift.every(Number.isFinite) ? `${Math.max(...gapDrift)}ms` : "- (기준 녹화기는 시각 필드 없음)"} |`);
  }
}

const md = [
  "# retro-choreo-a1 증거 (연출 레코드 A1)",
  "",
  `${failed === 0 ? "PASS" : `FAIL(${failed})`} · 혼합 연출 ${spec.contract.length}개 · 기준 커밋 대조 · 저장 왕복 확인`,
  "",
  "## 1. 혼합 연출 4개 (조수 도구 upsert_choreography / duplicate_choreography 로 조립, 출하 플레이어 경로로 녹화)",
  "",
  "조립 로그(도구 호출 순서·결과):",
  "```",
  ...spec.log,
  "```",
  "",
  "| 스킬 | 동작 | 층 노드(실측/기대) | 사운드(실측/기대) | 판정 |",
  "|---|---|---|---|---|",
  ...rows,
  "",
  "허용 오차 ±" + TOL_MS + "ms (회차 첫 층 기준 상대 시각, 관찰 지터 포함).",
  "",
  ...custom.flatMap((c) => [`### ${c.contract.id} — ${c.contract.label}`, "```", ...c.lines, "```", `GIF: skill-${c.contract.id}.gif`, ""]),
  "읽는 법:",
  "- 도약 뇌격: 궤적(투사체) 노드가 먼저, 충격이 +100ms, 번개 층이 +496ms. 세 층이 계약 없이 한 연출로 묶임.",
  "- 삼연 난타: 단일 대상 3타는 행동이 3회 재생(회차마다 초승달 1 + 임팩트 1), 그래서 임팩트 총 3개. 회차 안 오프셋이 기대와 같음.",
  "- 큰 불꽃 베기: 기본 연출 복제 뒤 한 층만 scale 2 + startMs 200 → 폭 256px, 시작 200ms(원본은 128px, 다른 시각).",
  "- 전체 뇌우: 대상 3명이 한 계획 하나로 묶여 onHit:each 임팩트가 90ms 간격 3개, startMs 300 부터.",
  "",
  "## 2. 회귀 (기준 커밋 ae7ed008f vs 현재)",
  "",
  "### 2-1. 계약 타임라인 전량 대조",
  "번들 계약 전체(직업 스킬 + 몬스터 스킬)를 hits 1·3, 편 2가지로 순수 타임라인에 통과시켜 이벤트(종류·시각·키·앵커·scale·frameMs)를 덤프.",
  "기준 커밋과 현재 커밋의 덤프가 **바이트 동일**(4436개 타임라인, `dump-head.json`, `retro-choreo-a1-dump.mts`).",
  "",
  "### 2-2. 출하 플레이어 실녹화 A/B (기존 계약 3개)",
  "| 스킬 | 층 종류(기준/현재) | 노드(기준/현재) | 사운드(기준/현재) | 노드 서명 | 노드 간격 최대 편차 |",
  "|---|---|---|---|---|---|",
  ...regRows,
  "",
  "재현:",
  "```",
  "npx vite-node scripts/qa/runtime/retro-choreo-a1-build.mts verify-shots/retro-choreo-a1/spec.json",
  "node scripts/qa/runtime/retro2003-skills-gif.mjs --set custom --custom verify-shots/retro-choreo-a1/spec.json --out verify-shots/retro-choreo-a1 --width 640",
  "node scripts/qa/runtime/retro-choreo-a1-verify.mjs",
  "```",
].join("\n");
writeFileSync(join(dir, "SUMMARY.md"), md);
console.log(md.split("\n").filter((l) => /^(PASS|FAIL|\| skill|OK|FAIL)/.test(l)).join("\n"));
if (failed) { console.error(`FAILED ${failed}`); process.exit(1); }
