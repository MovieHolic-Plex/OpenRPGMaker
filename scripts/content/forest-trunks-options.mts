/**
 * 폴른 스타 숲 「나무 줄기가 안 보여 풀 덩이 같다」(2026-10-24) 시안 — 같은 ① 숲 어귀 마스크에 숲 모양 손잡이(WoodSpec.look)만 바꿔 깐다.
 *   node --max-old-space-size=8000 node_modules/vite-node/dist/cli.mjs --script scripts/content/forest-trunks-options.mts <out.project.json>
 *   bun scripts/qa-game/render.mts --project <out.project.json> --out <dir>
 * 맵 id = fs_forest_edge__<시안>. 실제 숲 맵 정의(forestSpecs)는 바꾸지 않는다.
 */
import { writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults/blankProject";
import { ensureBundledTilesets } from "@/project/defaults/defaultAssets";
import { serialize } from "@/project/io";
import { EDGE_SPEC } from "@/project/flagship/fallen/forestSpecs";
import { paintWoodland, type WoodLook } from "@/project/flagship/fallen/woodland";
import type { Project } from "@/project/types";

const out = process.argv.slice(2).find((a) => !a.startsWith("-")) ?? "/tmp/forest-trunks.project.json";
const TRUNKED = [["T3", 0.6], ["T4", 0.4]] as const;
const OPTIONS: Record<string, WoodLook> = {
  cur: {},
  // A 줄기 띠: 숲 남쪽 앞줄은 줄기 있는 나무만 + 그 아래 이끼 치마 + 트인 땅에 나무 그림자
  A: { forest: { front: TRUNKED, rim: TRUNKED }, skirt: true, castShadows: "outside" },
  // B 수관 나누기: 속을 2×2 바둑판으로 밝은 연두(T3·T4)/짙은(D3) 번갈아, 덤불(D2) 빼기
  B: { forest: { alternate: { light: [["T3", 0.7], ["T4", 0.3]], dark: [["D3", 1]] }, rim: [["T3", 0.6], ["T4", 0.4]] } },
  // C 명암 대비: 트인 땅은 밝은 잔디, 숲 속은 짙은 D3 만, 모든 나무에 낙하 그림자
  C: { forest: { core: [["D3", 1]] }, plainGround: true, castShadows: "outside" },
  // D 낱 나무: 숲 가장자리 밖 풀밭에 밑동 보이는 온 나무 + 그림자
  D: { loose: { every: 5, reach: 3 }, castShadows: "outside" },
  // E 섞음: A + B + D
  E: { forest: { front: TRUNKED, rim: TRUNKED, alternate: { light: [["T3", 0.7], ["T4", 0.3]], dark: [["D3", 1]] } },
    skirt: true, castShadows: "outside", loose: { every: 6, reach: 3 } },
  // F 덤불 띠: 앞줄은 줄기 나무, 줄기 선을 따라 고사리·덤불 소품을 촘촘히, 이끼 치마
  F: { forest: { front: TRUNKED }, skirt: true },
  // H (추가) 줄기 엿보기 간격: 밑동 세로 간격 3칸 + 속은 윗줄이 성긴 짙은 D3·T3 — 뒷나무 줄기가 앞나무 수관 위로 보인다
  H: { forest: { gy: 3, front: TRUNKED, core: [["D3", 0.6], ["T3", 0.4]] }, castShadows: "outside" },
  // G (추가) E + 밝은 땅 — 대비까지 다 얹은 최대안
  G: { forest: { front: TRUNKED, rim: TRUNKED, alternate: { light: [["T3", 0.7], ["T4", 0.3]], dark: [["D3", 1]] } },
    skirt: true, castShadows: "outside", loose: { every: 6, reach: 3 }, plainGround: true },
};
const project: Project = createBlankProject();
ensureBundledTilesets(project as never);
const only = process.env.ONLY?.split(",");
for (const [k, look] of Object.entries(OPTIONS)) {
  if (only && !only.includes(k)) continue;
  const t0 = Date.now();
  paintWoodland(project, { ...EDGE_SPEC, id: `${EDGE_SPEC.id}__${k}`, look, undergrowth: k === "F" ? 1.6 : 1 });
  console.log(k, `${Date.now() - t0}ms`);
}
for (const id of Object.keys(project.maps)) if (!id.startsWith("fs_forest")) delete project.maps[id];
project.startMapId = Object.keys(project.maps)[0]!;
writeFileSync(out, serialize(project));
