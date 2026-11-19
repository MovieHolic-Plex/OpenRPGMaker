// 버들항 문 달린 건물 킷 전부에 크기 단 태그(tier:small|medium|large|xlarge)를 적는다 — 규칙은 src/project/kitTier.ts(문 하나에 딸린 넓이).
//   bun scripts/content/beodeul-interiors/kit-tiers.mts           # src/assets/beodeulCityTileset.json 에 적는다
//   bun scripts/content/beodeul-interiors/kit-tiers.mts --check   # 표만 찍는다(빠진 킷이 있으면 exit 1)
// 이미 태그가 있는 킷(참고 건물 — 그린 사람이 적었다)은 그대로 둔다. 다른 굽기가 킷을 다시 만들어 태그가 빠지면 이 스크립트를 다시 돌린다(시험이 잡는다).
import fs from "node:fs";
import path from "node:path";
import { kitEntranceCount, kitTierByFootprint } from "../../../src/project/kitTier.ts";

const FILE = path.resolve(import.meta.dirname, "../../../src/assets/beodeulCityTileset.json");
const ts = JSON.parse(fs.readFileSync(FILE, "utf8")) as { structureKits: { id: string; width: number; height: number; parts?: { kind?: string }[]; ai?: { tags?: string[] } }[] };
const check = process.argv.includes("--check");
const count: Record<string, number> = {}; let added = 0, missing = 0;
for (const kit of ts.structureKits) {
  if (!kitEntranceCount(kit as never)) continue;
  const tags = (kit.ai ??= {}).tags ??= [];
  let tier = tags.find((t) => t.startsWith("tier:"))?.slice(5);
  if (!tier) { tier = kitTierByFootprint(kit as never)!; if (check) missing++; else { tags.push(`tier:${tier}`); added++; } }
  count[tier] = (count[tier] ?? 0) + 1;
}
console.log(`문 달린 킷 ${Object.values(count).reduce((a, b) => a + b, 0)} — small ${count.small ?? 0} · medium ${count.medium ?? 0} · large ${count.large ?? 0} · xlarge ${count.xlarge ?? 0} · ${check ? `태그 없는 킷 ${missing}` : `새로 적은 태그 ${added}`}`);
if (check) process.exit(missing ? 1 : 0);
fs.writeFileSync(FILE, JSON.stringify(ts) + "\n");
