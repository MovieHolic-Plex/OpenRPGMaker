// 데이터베이스 「마을」탭 모델 — 순수 함수만. DOM 도 store 도 모른다.
//
// 뷰가 아니라 여기에 규칙을 둔 이유: 사용자가 만든 레코드는 그대로 하네스로 흘러가고
// (`village/authoringData.ts`), 규약을 어기면 시공이 그 집을 조용히 건너뛴다. 그래서
// "화면에서 만들 수 있는 값" 은 처음부터 규약을 만족해야 한다 — 새 레코드의 기본값과
// 내장 복제 결과를 만드는 책임을 뷰에서 떼어내 테스트 가능한 자리에 둔다.

import type { HouseTemplateDef } from "@/project/defaults/houseTemplateCatalog";
import type { VillageHouseTemplateRecord, VillageLayoutPresetRecord, VillageTemplateWing } from "@/project/types/village";
import { VILLAGE_RANGE } from "@/editor/tools/village/authoringData";

/** 이미 쓰인 id 를 피해 `base`, `base_2`, `base_3` … 을 고른다. */
export function nextVillageId(used: readonly string[], base: string): string {
  const taken = new Set(used);
  const root = base.replace(/_\d+$/, "") || "item";
  if (!taken.has(root)) return root;
  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${root}_${index}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${root}_${taken.size + 1}`;
}

/** 내장 형태를 사용자 레코드로 굽는다 — 값을 베끼므로 이후 내장이 바뀌어도 따라 변하지 않는다. */
export function templateRecordFromDef(def: HouseTemplateDef, id: string, name?: string): VillageHouseTemplateRecord {
  return {
    id,
    name: name ?? `${def.name} 사본`,
    w: def.w,
    h: def.h,
    stories: def.stories ?? 1,
    ...(def.lowWall ? { lowWall: true } : {}),
    ...(def.kitId ? { kitId: def.kitId } : {}),
    ...(def.roofDeck ? { roofDeck: true } : {}),
    wings: def.wings.map((wing) => ({ x: wing.x, y: wing.y, w: wing.w, h: wing.h })),
    clonedFrom: def.id,
  };
}

/** 규약을 만족하는 최소 형태. 추가 버튼이 곧바로 "건너뜀" 경고를 만들지 않게 한다. */
export function blankTemplateRecord(id: string): VillageHouseTemplateRecord {
  return {
    id,
    name: "새 집 형태",
    w: 6,
    h: 6,
    stories: 1,
    wings: [{ x: 0, y: 0, w: 6, h: 6 }],
  };
}

/** 빈 프리셋 — 값을 하나도 안 채우면 하네스는 전부 코드 기본값으로 돈다(=아무 것도 안 한 것과 같다). */
export function blankPresetRecord(id: string): VillageLayoutPresetRecord {
  return { id, name: "새 배치 프리셋" };
}

export function duplicateTemplateRecord(record: VillageHouseTemplateRecord, id: string): VillageHouseTemplateRecord {
  return {
    ...structuredClone(record),
    id,
    name: `${record.name || record.id} 사본`,
    ...(record.clonedFrom ? { clonedFrom: record.clonedFrom } : {}),
  };
}

export function duplicatePresetRecord(record: VillageLayoutPresetRecord, id: string): VillageLayoutPresetRecord {
  return { ...structuredClone(record), id, name: `${record.name || record.id} 사본` };
}

/**
 * 바운딩 박스 안에서 날개가 덮는 칸. 미리보기 격자와 "실제로 몇 칸인지" 표시에 쓴다.
 * 날개는 겹칠 수 있으므로 합집합이다(개별 면적 합이 아니다).
 */
export function templateFootprint(record: VillageHouseTemplateRecord): boolean[][] {
  const w = Math.max(0, Math.min(VILLAGE_RANGE.templateW.max, Math.trunc(record.w) || 0));
  const h = Math.max(0, Math.min(VILLAGE_RANGE.templateH.max, Math.trunc(record.h) || 0));
  const grid = Array.from({ length: h }, () => new Array<boolean>(w).fill(false));
  for (const wing of record.wings ?? []) {
    for (let y = wing.y; y < wing.y + wing.h; y += 1) {
      for (let x = wing.x; x < wing.x + wing.w; x += 1) {
        if (y >= 0 && y < h && x >= 0 && x < w) grid[y]![x] = true;
      }
    }
  }
  return grid;
}

export function footprintTileCount(record: VillageHouseTemplateRecord): number {
  return templateFootprint(record).reduce((sum, row) => sum + row.filter(Boolean).length, 0);
}

/** 바운딩 박스를 실제 날개 합집합에 맞춘다 — 남은 빈 줄/열은 시공에서 쓰이지 않는 낭비다. */
export function tightenTemplateBounds(record: VillageHouseTemplateRecord): VillageHouseTemplateRecord {
  const wings = record.wings ?? [];
  if (wings.length === 0) return record;
  const minX = Math.min(...wings.map((wing) => wing.x));
  const minY = Math.min(...wings.map((wing) => wing.y));
  const shifted: VillageTemplateWing[] = wings.map((wing) => ({
    x: wing.x - minX,
    y: wing.y - minY,
    w: wing.w,
    h: wing.h,
  }));
  return {
    ...record,
    w: Math.max(...shifted.map((wing) => wing.x + wing.w)),
    h: Math.max(...shifted.map((wing) => wing.y + wing.h)),
    wings: shifted,
  };
}
