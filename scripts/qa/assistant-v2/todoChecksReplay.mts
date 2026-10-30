// omo 할 일 검사기(src/ai/v2/todo/checks.ts) 재생 — 실제 씬 벤치 판 저장본에 손으로 적은 TodoCheck 를 돌려 기대(성공 판 pass·실패 판 fail)와 맞는지 표로 본다.
//   bun scripts/qa/assistant-v2/todoChecksReplay.mts [--runs <scenes/runs>] [--bases <scenes/bases>] [--replayed <디렉터리>] [--only <라벨 부분>]
// 저장본 출처(판마다 하나):
//   sqlite   = 판 폴더의 project/(정본 SQLite, read-project-sqlite 경로)
//   replayed = sceneToolReplay.mts 가 시작 저장본 위에 그 판의 도구 호출을 다시 불러 만든 JSON(판 저장본이 지워진 sc-1031 판들).
//              만들기: bun scripts/qa/assistant-v2/sceneToolReplay.mts <판> --base <bases/<장르>/project> --out <replayed>/<라벨>.json
//   base     = 시작 저장본 그대로(조수가 거의 아무것도 못 바꾼 실패 판의 대리) — mutate 로 명령을 지운 변형도 만든다(원본은 읽기만).
// vitest 가 아니다 — 표와 어긋난 줄 수를 찍고, 어긋나면 종료 코드 1.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readProjectSqlite } from "../../content/read-project-sqlite.mts";
import { runTodoCheck } from "../../../src/ai/v2/todo/checks.ts";
import type { TodoCheck } from "../../../src/ai/v2/todo/types.ts";
import type { Project } from "../../../src/project/types.ts";

const argv = process.argv.slice(2);
const opt = (k: string, d: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1]! : d; };
const SUITE = path.join(os.homedir(), "z-project/assistant-whole-game/suite/scenes");
const RUNS = opt("--runs", path.join(SUITE, "runs"));
const BASES = opt("--bases", path.join(SUITE, "bases"));
const REPLAYED = opt("--replayed", path.resolve(".omo-replay"));
const ONLY = argv.includes("--only") ? opt("--only", "") : "";

type Source = { sqlite: string } | { replayed: string } | { base: string };
interface Case { label: string; why: string; source: Source; mutate?: (p: Project) => void; checks: { check: TodoCheck; expect: boolean; note?: string }[] }

type Obj = Record<string, unknown>;
/** 명령 목록에서 kind 가 맞는 명령을 지운다(갈래 속까지). 변형 저장본 만들기용. */
function stripKinds(project: Project, kinds: readonly string[]): number {
  let n = 0;
  const visit = (node: unknown): unknown => {
    if (Array.isArray(node)) {
      const out = node.filter((c) => !(c && typeof c === "object" && kinds.includes(String((c as Obj).kind)))).map(visit);
      n += node.length - out.length;
      return out;
    }
    if (node && typeof node === "object") { for (const [k, v] of Object.entries(node as Obj)) (node as Obj)[k] = visit(v); }
    return node;
  };
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) visit(ev);
  visit((project as { commonEvents?: unknown }).commonEvents ?? []);
  return n;
}

const CASES: Case[] = [
  {
    label: "sc-1031-b2 terra boss-room r1 (실패)",
    why: "「지하 던전 가장 안쪽에 보스 방…해골 기사가 말을 걸고 싸우는 장면」 — edit_place 거절·stamp_object 실패, 바뀐 건 자동 마감의 길 포석·이동 칸 앞 비움뿐. sceneToolReplay 재구성.",
    source: { replayed: "b2-terra-boss-r1.json" },
    checks: [
      { check: { kind: "place", name: "보스 방", placeKind: "dungeon" }, expect: false },
      { check: { kind: "person", name: "해골 기사" }, expect: false },
      { check: { kind: "talk", who: "해골 기사" }, expect: false },
      { check: { kind: "battle", who: "해골 기사", boss: true }, expect: false },
      { check: { kind: "link", from: "지하 던전", to: "해골 기사의 방" }, expect: false },
    ],
  },
  ...(["r1", "r2", "r3"] as const).map((r): Case => ({
    label: `sc-1031-b2 opus boss-room ${r} (성공)`,
    why: "판정자: 해골 기사가 먼저 말을 걸고 대사 뒤 전투가 열린다(r1~r3 모두 ok). sceneToolReplay 재구성.",
    source: { replayed: `b2-opus-boss-${r}.json` },
    checks: [
      { check: { kind: "place", name: "해골 기사의 방", placeKind: "dungeon" }, expect: true },
      { check: { kind: "person", name: "해골 기사", map: "해골 기사의 방" }, expect: true },
      { check: { kind: "talk", who: "해골 기사" }, expect: true },
      { check: { kind: "battle", who: "해골 기사", boss: true }, expect: true },
      { check: { kind: "link", from: "지하 던전", to: "해골 기사의 방" }, expect: true },
      { check: { kind: "reachable", target: "해골 기사" }, expect: true },
    ],
  })),
  {
    label: "sc-1031-b5 terra ending r1 (실패)",
    why: "「마왕을 쓰러뜨린 뒤 버들마을로 돌아와 마을 사람들에게 축하받는 엔딩」 — 판정자: 마왕전 뒤 컷신·대사·엔딩 화면 없음.",
    source: { replayed: "b5-terra-ending-r1.json" },
    checks: [
      { check: { kind: "ending" }, expect: false },
      { check: { kind: "talk", who: "촌장", says: "축하" }, expect: false },
      { check: { kind: "battle", who: "마왕", boss: true }, expect: true, note: "마왕전 자체는 시작 저장본에 있다" },
      { check: { kind: "reachable", target: "버들마을", from: "마왕의 동굴" }, expect: true },
    ],
  },
  {
    label: "sc-1031-b3 terra interrogation r3 (실패)",
    why: "「용의자 상인 도윤 심문…증거를 내밀면 말이 바뀌게」 — 판정자: 도윤에게 말을 걸어도 선택지 없이 첫 진술만 반복.",
    source: { replayed: "b3-terra-interrogation-r3.json" },
    checks: [
      { check: { kind: "person", name: "도윤" }, expect: true },
      { check: { kind: "talk", who: "도윤" }, expect: true },
      { check: { kind: "item", name: "장화 자국" }, expect: true },
      { check: { kind: "present_evidence", item: "장화 자국", to: "도윤" }, expect: false },
    ],
  },
  {
    label: "bases/fantasy 엔딩 명령 지운 변형",
    why: "엔딩 fail 확인용 — 시작 저장본 사본에서 triggerEnding·ending·returnToTitle 을 지운다(원본 그대로).",
    source: { base: "fantasy" },
    mutate: (p) => { stripKinds(p, ["triggerEnding", "ending", "returnToTitle"]); },
    checks: [{ check: { kind: "ending" }, expect: false }, { check: { kind: "place", name: "버들마을", placeKind: "village" }, expect: true }],
  },
  {
    label: "bases/mystery 증거 내밀기 지운 변형",
    why: "present_evidence fail 확인용 — 시작 저장본 사본에서 presentItem 을 지운다.",
    source: { base: "mystery" },
    mutate: (p) => { stripKinds(p, ["presentItem"]); },
    checks: [{ check: { kind: "present_evidence", item: "장화 자국" }, expect: false }],
  },
];

function load(c: Case): Project | string {
  const s = c.source;
  if ("sqlite" in s) { const dir = path.join(RUNS, s.sqlite, "project"); return fs.existsSync(path.join(dir, "project.sqlite")) ? readProjectSqlite(dir) : `없음 ${dir}`; }
  if ("replayed" in s) { const f = path.join(REPLAYED, s.replayed); return fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, "utf8")) as Project) : `없음 ${f} (sceneToolReplay 로 먼저 만든다)`; }
  const dir = path.join(BASES, s.base, "project");
  return fs.existsSync(path.join(dir, "project.sqlite")) ? readProjectSqlite(dir) : `없음 ${dir}`;
}

const rows: string[] = ["| 판 | 항목 | 기대 | 결과 | ms | 근거 |", "|---|---|---|---|---|---|"];
let bad = 0, total = 0;
for (const c of CASES) {
  if (ONLY && !c.label.includes(ONLY)) continue;
  const project = load(c);
  if (typeof project === "string") { rows.push(`| ${c.label} | — | — | 건너뜀 | | ${project} |`); continue; }
  if (c.mutate) c.mutate(project);
  for (const { check, expect, note } of c.checks) {
    const t0 = performance.now();
    const r = runTodoCheck(project, check);
    const ms = Math.round(performance.now() - t0);
    total++;
    const ok = r.pass === expect;
    if (!ok) bad++;
    const { kind, ...rest } = check as TodoCheck & Obj;
    rows.push(`| ${c.label} | ${kind} ${JSON.stringify(rest).replace(/\|/gu, "/")} | ${expect ? "pass" : "fail"} | ${r.pass ? "pass" : "fail"}${ok ? "" : " ✗"} | ${ms} | ${(r.detail + (note ? ` (${note})` : "")).replace(/\|/gu, "/").replace(/\n/gu, " ").slice(0, 220)} |`);
  }
}
console.log(rows.join("\n"));
console.log(`\n${total - bad}/${total} 기대와 같음${bad ? ` — 어긋남 ${bad}` : ""}`);
process.exit(bad ? 1 : 0);
