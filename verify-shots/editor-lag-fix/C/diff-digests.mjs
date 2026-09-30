// C: before.json / after.json 카드별 지문 동일성 비교. 사용: node diff-digests.mjs [before] [after]
import { readFileSync } from "node:fs";
const dir = new URL("./", import.meta.url);
const a = JSON.parse(readFileSync(new URL(`${process.argv[2] ?? "before"}.json`, dir), "utf8"));
const b = JSON.parse(readFileSync(new URL(`${process.argv[3] ?? "after"}.json`, dir), "utf8"));
let diff = 0;
for (const ra of a.rows) {
  const rb = b.rows.find(r => r.id === ra.id);
  const { ms: _m1, ...x } = ra; const { ms: _m2, ...y } = rb ?? {};
  if (JSON.stringify(x) !== JSON.stringify(y)) { diff++; console.log("DIFF", ra.id); }
}
console.log(`cards ${a.rows.length}/${b.rows.length} differing ${diff}`);
console.log("before", JSON.stringify(a.summary));
console.log("after ", JSON.stringify(b.summary));
process.exit(diff ? 1 : 0);
