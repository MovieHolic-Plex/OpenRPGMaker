// 참고 건물 킷의 낱말 탐침(모델 없음):  bun scripts/content/beodeul-ref-buildings/words.mts [<결과 json>]
// (가) 킷마다 그 킷의 낱말(types.json words · 한국어·영어 이름)을 조수의 «이미 있는 물건 찾기»(existingMatches)에 물어 그 킷이 몇째로 오는지.
// (나) 옛 킷의 첫째 자리: 옛 킷의 이름 조각·태그마다 «내 킷을 뺀 타일셋의 첫째» 와 «지금의 첫째» 가 같은지 — 달라진 것이 0 이어야 한다(옛 킷이 제 낱말의 첫째 자리를 잃지 않는다).
import fs from "node:fs";
import { createBlankProject } from "../../../src/project/defaults/blankProject";
import { existingMatches } from "../../../src/editor/tools/objectGenTool";
import type { Project } from "../../../src/project/types";
import types from "../../../tiledata/beodeul-ref-buildings/types.json";

const PREFIX = "bd-bld-ref-";
const project = createBlankProject() as Project;
const ts = project.tilesets[project.maps[project.startMapId]!.tilesetId]!;
if (ts.id !== "beodeul_city" && !(ts.structureKits ?? []).some((k) => k.id.startsWith(PREFIX))) throw new Error(`빈 프로젝트의 칩셋이 버들항이 아니다: ${ts.id}`);
const without = structuredClone(project) as Project;
const ts0 = without.tilesets[ts.id]!; ts0.structureKits = (ts0.structureKits ?? []).filter((k) => !k.id.startsWith(PREFIX));
const mine = (types.types as { id: string; ko: string; en: string; words: string[] }[]);
const own: { kit: string; word: string; rank: number; first?: string }[] = [];
for (const t of mine) for (const word of [t.ko, t.en, ...t.words]) {
  const found = existingMatches(project, ts, word).map((r) => r.id);
  own.push({ kit: t.id, word, rank: found.indexOf(t.id), first: found[0] });
}
const words = new Set<string>();      // 옛 킷의 낱말만: 이름 조각과 태그
for (const k of ts0.structureKits ?? []) {
  for (const p of k.name.split(/[\s·()×:,]+/)) if (p.length > 1 && !/^\d/.test(p)) words.add(p);
  for (const tag of k.ai?.tags ?? []) if (!tag.includes(":")) words.add(tag);
}
const lost: { word: string; before: string; now: string }[] = [];
for (const word of words) {
  const before = existingMatches(without, ts0, word)[0]?.id; const now = existingMatches(project, ts, word)[0]?.id;
  if (before && now !== before) lost.push({ word, before, now: now ?? "" });
}
const first = own.filter((r) => r.rank === 0).length, any = own.filter((r) => r.rank >= 0).length;
console.log(`내 낱말 ${own.length}개: 첫째 ${first} · 목록에 듦 ${any} · 못 찾음 ${own.length - any}`);
console.log(`옛 킷 첫째 자리: 물은 낱말 ${words.size}개 · 첫째가 바뀐 낱말 ${lost.length}개`);
for (const l of lost.slice(0, 40)) console.log(`  바뀜 «${l.word}»: ${l.before} → ${l.now}`);
for (const r of own.filter((r) => r.rank !== 0).slice(0, 60)) console.log(`  ${r.kit} «${r.word}» ${r.rank < 0 ? "못 찾음" : r.rank + 1 + "째"} (첫째 ${r.first ?? "없음"})`);
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify({ own, lost }, null, 1));
