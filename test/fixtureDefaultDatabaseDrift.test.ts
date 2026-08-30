import { isDeepStrictEqual } from "node:util";
import { describe, expect, it } from "vitest";
import { defaultEquipmentRecords } from "@/project/defaults/defaultDatabaseEquipmentRecords";
import { defaultItemRecords } from "@/project/defaults/defaultDatabaseItemRecords";
import {
  defaultBattleAnimationRecords,
  defaultSkillRecords,
  defaultStateRecords,
} from "@/project/defaults/defaultDatabaseStarterRecords";
import dewVillageDemoFixture from "@/project/defaults/fixtures/dew-village-demo.json";
import { DERIVED_DATABASE_TABLES, type DerivedTable } from "../scripts/lib/fixtureDefaultDatabase.mts";

// 실측 배경(2026-08-30): 콘텐츠 스크립트가 픽스처를 읽어 맵·이벤트만 더한 뒤 되쓰므로 database
// 부분이 export 당시 값에 얼어붙는다. 그래서 장비 11종 전부 accuracy/criticalRate 가 없고 아이콘
// 18건이 남의 아이콘을 가리켰다(아이템 16 + 장비 2 — 검술 교본이 청동 검 그림, 철 검·강철 검이
// 둘 다 청동 검 그림). 보충은 *빈* 필드만 채워 틀린 값을 못 고치므로 이 게이트가 필요하다.
const RECOVERY_COMMAND = "npm run fixture:sync";

type Row = { id: string };

const codeRecordsByTable: Record<DerivedTable, () => Row[]> = {
  items: () => defaultItemRecords() as unknown as Row[],
  equipment: () => defaultEquipmentRecords() as unknown as Row[],
  skills: () => defaultSkillRecords() as unknown as Row[],
  states: () => defaultStateRecords() as unknown as Row[],
  battleAnimations: () => defaultBattleAnimationRecords() as unknown as Row[],
};

const fixture = dewVillageDemoFixture as unknown as { database: Record<DerivedTable, Row[]> };

// 코드에 없는 픽스처 행은 저작 전용 행 보존 규칙에 따라 의도적으로 검사하지 않는다.
function drift(table: DerivedTable): string[] {
  const shippedById = new Map(fixture.database[table].map((record) => [record.id, record]));
  const problems: string[] = [];
  for (const codeRecord of codeRecordsByTable[table]()) {
    const shipped = shippedById.get(codeRecord.id);
    if (shipped === undefined) {
      problems.push(`${table} ${codeRecord.id}: 픽스처에 없음`);
      continue;
    }
    // 픽스처는 JSON 이라 undefined 필드를 들 수 없다. 코드 레코드를 한 번 통과시컰 맞춰야
    // 거짓 불일치가 없어진다. 통과 후 심충 분리는 중착 필드(statBonuses, effectFlags) 드리프트와
    // 픽스처에만 남은 여분 키를 둘 다 잡는다.
    const serializable = JSON.parse(JSON.stringify(codeRecord)) as unknown;
    if (!isDeepStrictEqual(shipped, serializable)) {
      problems.push(`${table} ${codeRecord.id}: 내용이 코드 기본값과 다름`);
    }
  }
  return problems;
}

describe("출하 데모 픽스처의 기본 DB 는 코드 기본값의 파생물이다", () => {
  for (const table of DERIVED_DATABASE_TABLES) {
    it(`${table} 이 코드 기본값과 한 글자도 다르지 않다`, () => {
      const problems = drift(table);
      expect(
        problems,
        `${table} ${problems.length}건이 픽스처와 코드 사이에서 어긋났다.\n` +
          `복구: ${RECOVERY_COMMAND}\n` +
          problems.slice(0, 12).join("\n"),
      ).toEqual([]);
    });
  }
});
