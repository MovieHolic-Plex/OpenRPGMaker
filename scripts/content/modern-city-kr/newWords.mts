// 한국 건물·옥상·시골 기물(mc-bld-kr-* · mc-roof-kr-* · mc-prop-krr-*)이 낱말로 찾아지는가, 옛 킷이 제 낱말의 첫째 자리를 지키는가(모델 없음).
// scripts/content/beodeul-objects/newWords.mts 와 같은 물음을 modern_city 에 한다. 낱말은 킷 이름·태그(buildings.txt·roof.txt·rural.txt·words.json)다.
//   bun scripts/content/modern-city-kr/newWords.mts [<결과 json>]
import fs from "node:fs";
import { createBlankProject } from "../../../src/project/defaults/blankProject";
import { existingMatches } from "../../../src/editor/tools/objectGenTool";
import type { Project } from "../../../src/project/types";

const NEW = /^mc-(bld-kr|roof-kr|prop-krr)-/u;
const project = createBlankProject() as Project;
const ts = project.tilesets["modern_city"]!;
// 찾기(existingMatches)는 8칸을 넘는 킷을 기물로 치지 않는다 — 큰 건물은 구성기가 키트 id 로 놓는다. 여기서는 8×8 안의 킷만 묻는다.
const kits = (ts.structureKits ?? []).filter((k) => NEW.test(k.id) && k.width <= 8 && k.height <= 8);
const rows: { kit: string; word: string; first: string | undefined; rank: number }[] = [];
for (const kit of kits) {
  const tags = (kit.ai?.tags ?? []) as string[];
  const i = tags.indexOf("한국");
  const words = [String(kit.name), ...tags.slice(i + 1).filter((t) => !/^(한국 건물|시골|옥상|옥상 기물|소형|중형|대형|초대형|랜드마크|program:|roof:)/u.test(t) && !/(마당|논|장독대|앞|농기계|정류장|과수원|축사|어촌|산길)$/u.test(t) || t === kit.name)];
  for (const word of new Set(words)) { const found = existingMatches(project, ts, word).map((r) => r.id); rows.push({ kit: kit.id, word, first: found[0], rank: found.indexOf(kit.id) }); }
}
const first = rows.filter((r) => r.rank === 0), reached = new Set(first.map((r) => r.kit));
console.log(`새 킷 ${kits.length}종 · 낱말 ${rows.length}개 — 그 킷이 첫째 ${first.length} · 목록 안 ${rows.filter((r) => r.rank >= 0).length} · 못 찾음 ${rows.filter((r) => r.rank < 0).length}`);
console.log(`낱말 하나로라도 첫째에 닿는 킷 ${reached.size}/${kits.length}${reached.size < kits.length ? ` — 못 닿는 킷: ${kits.filter((k) => !reached.has(k.id)).map((k) => k.id).join(", ")}` : ""}`);
for (const r of rows.filter((x) => x.rank !== 0)) console.log(`  ${r.kit} «${r.word}» → ${r.rank < 0 ? "없음" : `${r.rank + 1}번째`}(첫째 ${r.first ?? "없음"})`);
const before = createBlankProject() as Project;
const tsBefore = before.tilesets["modern_city"]!;
tsBefore.structureKits = (tsBefore.structureKits ?? []).filter((k) => !NEW.test(k.id));
const queries = new Set<string>();
for (const kit of tsBefore.structureKits) {
  for (const part of String(kit.name ?? "").split("·")) { const q = part.replace(/\d+×\d+/gu, "").trim(); if (q.length >= 2) queries.add(q); }
  for (const tag of kit.ai?.tags ?? []) if (/[가-힣]/u.test(tag) && tag.length >= 2) queries.add(tag);
}
const moved: string[] = [];
for (const q of queries) { const b = existingMatches(before, tsBefore, q)[0]?.id, a = existingMatches(project, ts, q)[0]?.id; if (a !== b) moved.push(`«${q}» ${b ?? "없음"} → ${a ?? "없음"}`); }
console.log(`옛 킷 이름·태그 ${queries.size}개 — 첫째가 바뀐 것 ${moved.length}`);
for (const line of moved) console.log(`  ${line}`);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ kits: kits.length, words: rows.length, first: first.length, reached: reached.size, moved, rows }, null, 1));
