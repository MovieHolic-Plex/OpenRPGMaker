/**
 * `test/fixtures/houseTemplates.baseline.json` 재생성 — 형태 카탈로그가 바뀌었을 때만 돈다.
 *
 * 이 파일은 원래 "함수형 카탈로그 → 선언형 데이터" 리팩터의 등가성 증거였다. 그 리팩터는
 * 끝났으므로 지금의 역할은 **카탈로그 전개의 스냅샷**이다. 형태를 의도적으로 바꾸면
 * (2026-09-11 A자 4종 → 계단식 2층) 이 스크립트로 다시 뜨고, `test/houseTemplateCatalog.test.ts`
 * 의 왕복 검사가 새 값을 고정한다.
 *
 * 실행: npx tsx scripts/update-house-template-baseline.mts
 */
import fs from "node:fs";
import path from "node:path";
import { HOUSE_TEMPLATE_DEFS } from "../src/project/defaults/houseTemplateCatalog.ts";

const ORIGINS: readonly (readonly [number, number])[] = [[0, 0], [7, 11], [3, 0]];
const OUT = path.resolve("test/fixtures/houseTemplates.baseline.json");

const rows = HOUSE_TEMPLATE_DEFS.map((def) => ({
  id: def.id,
  name: def.name,
  w: def.w,
  h: def.h,
  stories: def.stories ?? null,
  lowWall: def.lowWall ?? null,
  kitId: def.kitId ?? null,
  roofDeck: def.roofDeck ?? null,
  wingsAt: Object.fromEntries(ORIGINS.map(([x, y]) => [
    `${x},${y}`,
    def.wings.map((wing) => ({
      x: wing.x + x,
      y: wing.y + y,
      w: wing.w,
      h: wing.h,
      ...(wing.stories === undefined ? {} : { stories: wing.stories }),
    })),
  ])),
}));

fs.writeFileSync(OUT, `${JSON.stringify(rows, null, 2)}\n`);
console.log(`wrote ${rows.length} rows ->`, OUT);
