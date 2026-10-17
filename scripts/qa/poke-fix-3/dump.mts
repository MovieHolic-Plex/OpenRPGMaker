// 장르 잠금 잔여 점검 — 프로젝트 JSON 의 캐릭터·얼굴·전투 그림 참조를 모아 BAD(RTP 등 허용 밖)만 보여 준다.
//   bun scripts/qa/poke-fix-3/dump.mts <project.json> [...]
import { readFileSync } from "node:fs";
import { dumpRefs, judge, lockInfo } from "./lib.mts";
import { deserialize } from "../../../src/project/io.ts";
for (const file of process.argv.slice(2)) {
  const project = deserialize(readFileSync(file, "utf8"));
  const refs = dumpRefs(project);
  const bad = refs.filter((r) => judge(r) === "BAD");
  const by: Record<string, number> = {};
  for (const r of bad) by[`${r.kind}|${r.family}`] = (by[`${r.kind}|${r.family}`] ?? 0) + 1;
  console.log(file, "lock", JSON.stringify(lockInfo(project)), "total", refs.length, "BAD", bad.length, JSON.stringify(by));
  for (const r of bad) console.log("  BAD", r.kind, r.id, r.index ?? "", r.where, r.path);
}
