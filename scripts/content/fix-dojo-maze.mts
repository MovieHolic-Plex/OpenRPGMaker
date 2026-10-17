// 도장(gyms/gym_dojo) 미로를 어둠 덮개 없이 보이게 만든다(2026-10-14 몬스터 감사 「체육관 가운데 큰 검은 공백」).
//
// 원래 템플릿은 미로 전체를 위층 어둠 덮개(「어둠(벽 위층, 막힘)」·「어둠(바닥 위층, 걷는다)」)로 덮었다. 「빛 이벤트로 지운다」는
// 설계였지만 그 이벤트는 만든 적이 없어 덮개가 영영 안 걷혔고, 걸어 다니는 칸 32개가 보이지 않는 검은 구멍이었다.
// 칸막이 일부는 덮개의 「막힘」만으로 서 있어(아래는 마루) 덮개만 걷으면 막힌 칸이 뚫린다.
// 해법: 덮개를 걷고, 막힘 덮개 아래가 마루였던 칸은 칸막이 오토타일(gy_pb_dojo)로 눈에 보이게 세운 뒤 모양을 다시 맞춘다.
// 통행(어느 칸이 막히는가)은 그대로다 — 막힘이던 칸은 칸막이로, 걷던 칸은 마루로 남는다.
//
// 사용: bun scripts/content/fix-dojo-maze.mts   (멱등 — 이미 덮개가 없으면 바꾸지 않는다)
// 회귀 방지: `npm run qa:game -- check <프로젝트>` 의 visual-void 경고(src/qa/gameCheck/visualVoid.ts).
import fs from "node:fs";
import { shapeAllAutotileGroupsAround } from "../../src/project/defaults/autotileEngine.ts";
import type { AutotileGroup } from "../../src/project/types.ts";

const TEMPLATES = "src/project/examples/monsterExpedition/mapTemplates.json";
const sheet = JSON.parse(fs.readFileSync("src/assets/monsterKit/monster-gyms.json", "utf8")) as {
  tileMeta: { label?: string }[]; autotileGroups: AutotileGroup[];
};
const group = sheet.autotileGroups.find((g) => g.id === "gy_pb_dojo")!;
const labelled = (prefix: string) => new Set(sheet.tileMeta.flatMap((m, i) => (String(m.label ?? "").startsWith(prefix) ? [i] : [])));
const dark = labelled("어둠("), wallDark = labelled("어둠(벽 위층");
const full = group.variantMap["255"]!;
const members = new Set(group.memberTileIds);

const templates = JSON.parse(fs.readFileSync(TEMPLATES, "utf8")) as Record<string, { width: number; height: number; lower: number[]; upper: number[] }>;
for (const key of ["gyms/gym_dojo", "gyms/gym_dojo_after"]) {
  const t = templates[key]!;
  let raised = 0, removed = 0;
  t.upper.forEach((tile, i) => {
    if (!dark.has(tile)) return;
    if (wallDark.has(tile) && !members.has(t.lower[i]!)) { t.lower[i] = full; raised += 1; }
    t.upper[i] = -1; removed += 1;
  });
  const all = t.lower.flatMap((tile, i) => (members.has(tile) ? [{ x: i % t.width, y: Math.floor(i / t.width) }] : []));
  const reshaped = shapeAllAutotileGroupsAround({ width: t.width, height: t.height, lowerTiles: t.lower, upperTiles: t.upper }, [group], all);
  console.log(key, "덮개 제거", removed, "칸막이로 세움", raised, "모양 다시 맞춤", reshaped);
}
fs.writeFileSync(TEMPLATES, JSON.stringify(templates) + "\n");
