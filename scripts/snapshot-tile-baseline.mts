// 재감사 이전의 출하 라벨을 JSON 으로 얼려 둔다.
//
// 왜 필요한가 (실측 함정): apply-tile-verdicts.mts 는 비교 기준을 .ts 테이블에서 import 하고,
// build-tile-semantics.mts 는 그 .ts 를 덮어쓴다. 그래서 apply -> build -> apply 순으로 돌리면
// 두 번째 apply 가 **자기 출력과 자기를 비교**해 FIX 0 / KEEP 1743 이 나온다(실제로 나왔다).
// 교정이 사라진 게 아니라 기준선이 오염된 것이다.
//
// 그래서 기준선을 파일로 고정한다. 이 스크립트는 워킹트리가 원본 상태일 때 한 번만 돌린다:
//   git checkout -- src/project/defaults/tileSemantics*.ts
//   vite-node scripts/snapshot-tile-baseline.mts
// 이후 apply-tile-verdicts 는 이 스냅샷을 기준으로 삼으므로 몇 번 돌려도 결과가 같다.
//
// 출력: .omo/evidence/tile-reaudit/baseline/<sheet>.json

import fs from "node:fs";
import path from "node:path";
import { RETRO_EXTERIOR_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsRetroExterior";
import { RETRO_HOUSE_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsRetroHouse";
import { RETRO_WORLD_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsRetroWorld";
import { RETRO_DUNGEON_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsRetroDungeon";
import { SHIP_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsShip";
import { WORLD_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsWorld";

const SHEETS: Record<string, readonly unknown[]> = {
  retro_dungeon: RETRO_DUNGEON_TILE_SEMANTICS,
  retro_exterior: RETRO_EXTERIOR_TILE_SEMANTICS,
  retro_house: RETRO_HOUSE_TILE_SEMANTICS,
  retro_world: RETRO_WORLD_TILE_SEMANTICS,
  ship: SHIP_TILE_SEMANTICS,
  world: WORLD_TILE_SEMANTICS,
};

const OUT = ".omo/evidence/tile-reaudit/baseline";

function main(): void {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [sheet, table] of Object.entries(SHEETS)) {
    const file = path.join(OUT, `${sheet}.json`);
    fs.writeFileSync(file, `${JSON.stringify(table, null, 1)}\n`);
    console.log(`${sheet}: ${table.length}칸 -> ${file}`);
  }
  console.log("기준선 고정 완료. 이 파일들은 재감사 이전 상태이므로 다시 덮어쓰지 말 것.");
}

main();
