// 기물 묶음(vignette) 라이브러리 굽기 — 제작자 예제 방 견본(interiorRoomTemplates.json · interior-plus · 전국 견본 …)에서
// 서로 붙은 기물 무리를 뽑아 규칙(붙는 벽·앞 비울 줄·크기·나온 횟수·한 방 되풀이 수)과 함께 번들 JSON 으로 쓴다.
// 배치기·형식: src/editor/handInterior/vignettes.ts. 위키: openwiki/atlas-biome-interior.md 「기물 묶음 배치」.
//   bun scripts/content/interior-vignettes/extract.mts            → src/assets/interiorVignettes.json
//   bun scripts/content/interior-vignettes/extract.mts --dry      → 칩셋별 개수·상위 묶음만 출력
import fs from "node:fs";
import { HAND_INTERIOR_SPECS } from "../../../src/editor/handInterior/builder.ts";
import { roomTemplates } from "../../../src/editor/handInterior/templates.ts";
import { extractVignettes, type Vignette } from "../../../src/editor/handInterior/vignettes.ts";

const OUT = "src/assets/interiorVignettes.json";
const dry = process.argv.includes("--dry");
const tilesets: Record<string, Vignette[]> = {};
for (const [tilesetId, S] of Object.entries(HAND_INTERIOR_SPECS)) {
  const templates = roomTemplates(tilesetId);
  if (!templates.length) continue;
  const list = extractVignettes(tilesetId, S, templates);
  tilesets[tilesetId] = list;
  const walls = list.reduce<Record<string, number>>((m, v) => ({ ...m, [v.wall]: (m[v.wall] ?? 0) + 1 }), {});
  console.log(`${tilesetId}: 견본 ${templates.length} → 묶음 ${list.length} (${Object.entries(walls).map(([k, n]) => `${k}${n}`).join(" ")})`);
  if (dry) for (const v of list.slice(0, 8)) console.log(`   ${v.id} ${v.wall} ${v.w}x${v.h} ×${v.count} [${v.kinds.join(",")}] ${v.main}`);
}
if (!dry) {
  // 한 줄에 묶음 하나 — PR diff 를 읽을 수 있게.
  const body = Object.entries(tilesets).map(([id, list]) => `    ${JSON.stringify(id)}: [\n${list.map((v) => `      ${JSON.stringify(v)}`).join(",\n")}\n    ]`).join(",\n");
  fs.writeFileSync(OUT, `{\n  "version": 1,\n  "tilesets": {\n${body}\n  }\n}\n`);
  console.log(`→ ${OUT} ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`);
}
