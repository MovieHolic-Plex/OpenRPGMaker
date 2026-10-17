// find_tools 재생 코퍼스 적중률 측정.
//   bun scripts/qa/find-tools-replay.mts [--json out.json] [--verbose]
// 코퍼스: scripts/qa/fixtures/find-tools-corpus.json — 2026-10-15 FF6 감사 역할극 3판(calls.jsonl)의
// find_tools 질의와 「그 뒤 실제로 호출된 도구」(조회 공통 도구 제외)를 뽑은 것이다.
// 적중(hit@5) = 이후 실제로 호출된 도구가 결과 상위 5개 안에 하나라도 있다. 질의가 정확한 도구 이름인 건
// 별도 줄로 센다(이름 검색은 원래 맞는다). 정밀도(p@5) = 상위 5개 중 이후 호출된 도구의 비율.
import fs from "node:fs";
import { getTool } from "@/editor/tools";

interface Row { run: string; i: number; query: string; exact: boolean; called: string[] }
const corpus = JSON.parse(fs.readFileSync(new URL("./fixtures/find-tools-corpus.json", import.meta.url), "utf8")) as Row[];
const findTools = getTool("find_tools")!;
const verbose = process.argv.includes("--verbose");
const jsonOut = process.argv.includes("--json") ? process.argv[process.argv.indexOf("--json") + 1] : undefined;

function top5(query: string): string[] {
  const result = findTools.run({} as never, { query } as never, {} as never) as { data?: { matches?: { name: string }[] } };
  return (result.data?.matches ?? []).slice(0, 5).map((match) => match.name);
}

const natural = corpus.filter((row) => !row.exact && row.called.length > 0);
let hits = 0;
let precision = 0;
let empty = 0;
const detail: unknown[] = [];
for (const row of natural) {
  const top = top5(row.query);
  const hit = top.filter((name) => row.called.includes(name));
  if (hit.length > 0) hits += 1;
  if (top.length === 0) empty += 1;
  precision += top.length > 0 ? hit.length / top.length : 0;
  detail.push({ run: row.run, query: row.query, top, called: row.called, hit });
  if (verbose) console.log(`${hit.length > 0 ? "HIT " : "MISS"} [${row.run}] ${row.query}\n   top5: ${top.join(", ")}\n   called: ${row.called.join(", ")}`);
}
const exactRows = corpus.filter((row) => row.exact);
const exactHits = exactRows.filter((row) => { const top = top5(row.query); return row.query.split(/\s+/).some((name) => top.includes(name)); }).length;
const summary = {
  naturalQueries: natural.length,
  hitAt5: hits,
  hitRate: +(hits / natural.length).toFixed(3),
  precisionAt5: +(precision / natural.length).toFixed(3),
  emptyResults: empty,
  exactNameQueries: exactRows.length,
  exactNameHits: exactHits,
};
console.log(JSON.stringify(summary));
if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify({ summary, detail }, null, 1));
