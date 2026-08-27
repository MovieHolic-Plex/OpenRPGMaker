// 출하된 6종 시맨틱 테이블을 샤드별 "현재 라벨 대조표"로 덤프한다.
//
// 왜: 재감사의 기준은 git 미추적 fragment 가 아니라 실제로 출하되는 .ts 테이블이다
// (.omo/evidence/tile-semantics 는 git ls-files 0건 — 커밋된 적이 없다).
// 판정 노드가 "지금 무엇이라 적혀 있는가"를 볼 유일한 정본을 여기서 만든다.
//
// 주의: 이 표는 판독(describe) 노드에게 주지 않는다. 기존 라벨을 먼저 보면 앵커링이 걸려
// 독립 판독이 아니게 된다. 판독은 그림만 보고, 대조는 판정 노드에서 한다.
//
// 출력: .omo/evidence/tile-reaudit/current/<sheet>/rows-<a>-<b>.md
//
// 사용: vite-node scripts/dump-shipped-tile-labels.mts

import fs from "node:fs";
import path from "node:path";
import { RETRO_EXTERIOR_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsRetroExterior";
import { RETRO_HOUSE_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsRetroHouse";
import { RETRO_WORLD_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsRetroWorld";
import { RETRO_DUNGEON_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsRetroDungeon";
import { SHIP_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsShip";
import { WORLD_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsWorld";

interface SemanticEntry {
  readonly index: number;
  readonly label: string;
  readonly role: string;
  readonly passage: "passable" | "solid";
  readonly tags: readonly string[];
}

const SHEETS: Record<string, readonly SemanticEntry[]> = {
  retro_exterior: RETRO_EXTERIOR_TILE_SEMANTICS,
  retro_house: RETRO_HOUSE_TILE_SEMANTICS,
  retro_world: RETRO_WORLD_TILE_SEMANTICS,
  retro_dungeon: RETRO_DUNGEON_TILE_SEMANTICS,
  ship: SHIP_TILE_SEMANTICS,
  world: WORLD_TILE_SEMANTICS,
};

const COLS = 30;
const OUT_ROOT = ".omo/evidence/tile-reaudit/current";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function main(): void {
  let shippedTotal = 0;
  const summary: string[] = [];

  for (const [sheet, table] of Object.entries(SHEETS)) {
    const by = new Map<number, SemanticEntry>();
    for (const entry of table) by.set(entry.index, entry);
    shippedTotal += table.length;
    fs.mkdirSync(path.join(OUT_ROOT, sheet), { recursive: true });

    for (let block = 0; block < 4; block += 1) {
      const rowA = block * 4;
      const rowB = rowA + 3;
      const lines: string[] = [];
      lines.push(`# ${sheet} rows ${rowA}-${rowB} — 현재 출하 중인 라벨`);
      lines.push("");
      lines.push(`연속 아틀라스: .omo/evidence/tile-reaudit/blocks/${sheet}/block-${pad2(rowA)}-${pad2(rowB)}.png`);
      lines.push(`인덱스 각인 스트립: .omo/evidence/tile-reaudit/strips/${sheet}/row-${pad2(rowA)}.png .. row-${pad2(rowB)}.png`);
      lines.push("");
      lines.push("인덱스 = 행 * 30 + 열");
      lines.push("");

      let labeled = 0;
      for (let row = rowA; row <= rowB; row += 1) {
        lines.push(`## ${row}행 (인덱스 ${row * COLS}-${row * COLS + COLS - 1})`);
        for (let col = 0; col < COLS; col += 1) {
          const index = row * COLS + col;
          const entry = by.get(index);
          if (!entry) {
            lines.push(`- ${index} (열 ${col}): (라벨 없음 — 빈 슬롯으로 제외)`);
            continue;
          }
          labeled += 1;
          lines.push(`- ${index} (열 ${col}): "${entry.label}" | role=${entry.role} | passage=${entry.passage}`);
        }
        lines.push("");
      }

      const file = path.join(OUT_ROOT, sheet, `rows-${pad2(rowA)}-${pad2(rowB)}.md`);
      fs.writeFileSync(file, lines.join("\n"), "utf8");
      summary.push(`${sheet} rows-${pad2(rowA)}-${pad2(rowB)}: ${labeled} labeled`);
    }
  }

  console.log(summary.join("\n"));
  console.log(`SHIPPED_TOTAL ${shippedTotal}`);
}

main();
