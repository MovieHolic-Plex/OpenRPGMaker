// 데이터베이스 「마을」탭 모델 — 순수 함수만. DOM 도 store 도 모른다.
//
// 뷰가 아니라 여기에 규칙을 둔 이유: 사용자가 만든 레코드는 그대로 하네스로 흘러가고
// (`village/authoringData.ts`), 규약을 어기면 시공이 그 집을 조용히 건너뛴다. 그래서
// "화면에서 만들 수 있는 값" 은 처음부터 규약을 만족해야 한다 — 새 레코드의 기본값과
// 내장 복제 결과를 만드는 책임을 뷰에서 떼어내 테스트 가능한 자리에 둔다.

import type { HouseTemplateDef } from "@/project/defaults/houseTemplateCatalog";
import type { VillageHouseTemplateRecord, VillageLayoutPresetRecord, VillageTemplateWing } from "@/project/types/village";
import { VILLAGE_RANGE, type VillageArchetype } from "@/editor/tools/village/authoringData";

/**
 * 「모양 고르기」팔레트 — 숫자를 채우기 전에 **바닥 꼴부터** 고르게 한다.
 *
 * 값을 새로 쓰지 않고 내장 정의 id 를 가리킨다. 내장 34종은 하네스가 실제로 잘 짓는
 * 형태이므로, 팔레트가 내장을 베끼는 한 「고르자마자 규약 위반」이 생길 수 없다
 * (그 불변식은 test/villageAuthoringData.test.ts 의 34종 왕복 테스트가 지킨다).
 */
export const HOUSE_SHAPE_PRESETS: readonly { readonly defId: string; readonly label: string }[] = [
  { defId: "rect-small", label: "네모" },
  { defId: "rect-2f", label: "2층" },
  { defId: "l", label: "ㄱ자" },
  { defId: "l-mirror", label: "ㄴ자" },
  { defId: "u", label: "ㄷ자" },
  { defId: "courtyard", label: "ㅁ자 중정" },
  { defId: "t-porch", label: "T자 현관" },
  { defId: "estate-shed-r", label: "필지+헛간" },
  { defId: "aframe-mid", label: "A자 지붕" },
  { defId: "barn-low", label: "낮은 헛간" },
];

/**
 * 내장 형태 갤러리의 묶음 이름. 카탈로그 파일에 분류 필드를 새로 넣지 않고 id 접두사에서
 * 유도한다 — `houseTemplates.baseline.json` 이 정의 모양을 고정하고 있어서다.
 */
export function houseTemplateGroupLabel(id: string): string {
  if (id.startsWith("estate-")) return "필지(헛간 딸린 큰 집)";
  if (id.startsWith("aframe")) return "A자 지붕";
  if (id.startsWith("rooftop")) return "옥상 데크";
  if (id.endsWith("-low")) return "헛간·오두막";
  if (id.startsWith("rect")) return "네모";
  if (id === "l" || id.startsWith("l-")) return "ㄱ자·ㄴ자";
  if (id === "u" || id.startsWith("u-") || id === "courtyard") return "ㄷ자·ㅁ자";
  if (id.startsWith("z-")) return "엇갈린 날개";
  return "T자·곁채";
}

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

/**
 * 마을 원형을 프리셋 레코드로 굽는다. 원형이 비워 둔 항목(집 수·바닥 테마·길 폭 등)은
 * 그대로 비운 채 둬서 하네스가 씨앗값으로 파생하게 한다 — 원형은 "분위기"만 정한다.
 * 값을 베끼므로 나중에 원형 카탈로그가 바뀌어도 이 레코드는 따라 변하지 않는다.
 */
export function presetRecordFromArchetype(archetype: VillageArchetype, id: string): VillageLayoutPresetRecord {
  return {
    id,
    name: archetype.name,
    ...archetype.values,
    note: archetype.note,
  };
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

/**
 * 격자 위에서 날개를 끌어 옮긴다. **클램프까지 여기서 끝낸다** — 규약을 어기는 값이
 * 레코드에 들어가는 순간 시공이 그 집을 조용히 건너뛰므로, 드래그로는 애초에 어길 수
 * 없게 만드는 편이 안내문을 띄우는 것보다 낫다. 뷰는 픽셀→칸 변환만 하고 이 함수를 부른다.
 */
export function moveWing(
  record: VillageHouseTemplateRecord,
  index: number,
  dx: number,
  dy: number,
): VillageTemplateWing[] {
  const wings = (record.wings ?? []).map((wing) => ({ ...wing }));
  const wing = wings[index];
  if (!wing) return wings;
  const maxX = Math.max(0, boundedW(record) - wing.w);
  const maxY = Math.max(0, boundedH(record) - wing.h);
  wing.x = clamp(wing.x + Math.trunc(dx), 0, maxX);
  wing.y = clamp(wing.y + Math.trunc(dy), 0, maxY);
  return wings;
}

/** 날개 변을 끌어 크기를 바꾼다. n/w 변은 반대편을 고정하려고 좌표까지 함께 움직인다. */
export function resizeWing(
  record: VillageHouseTemplateRecord,
  index: number,
  edge: "n" | "s" | "e" | "w",
  delta: number,
): VillageTemplateWing[] {
  const wings = (record.wings ?? []).map((wing) => ({ ...wing }));
  const wing = wings[index];
  if (!wing) return wings;
  const step = Math.trunc(delta);
  const { wingW, wingH } = VILLAGE_RANGE;
  const boxW = boundedW(record);
  const boxH = boundedH(record);
  if (edge === "e") {
    wing.w = clamp(wing.w + step, wingW.min, Math.min(wingW.max, boxW - wing.x));
    return wings;
  }
  if (edge === "s") {
    wing.h = clamp(wing.h + step, wingH.min, Math.min(wingH.max, boxH - wing.y));
    return wings;
  }
  if (edge === "w") {
    // 오른쪽 변(x+w)을 붙잡아 둔다 — 왼쪽을 끌면 폭만 바뀌어야 한다.
    const right = wing.x + wing.w;
    const nextX = clamp(wing.x + step, Math.max(0, right - wingW.max), right - wingW.min);
    wing.x = nextX;
    wing.w = right - nextX;
    return wings;
  }
  const bottom = wing.y + wing.h;
  const nextY = clamp(wing.y + step, Math.max(0, bottom - wingH.max), bottom - wingH.min);
  wing.y = nextY;
  wing.h = bottom - nextY;
  return wings;
}

/**
 * 바운딩 박스가 날개 합집합보다 작으면(사용자가 폭을 줄인 직후) 날개가 박스를 넘는다.
 * 드래그 클램프는 **레코드에 적힌 박스**를 기준으로 삼되 규약 상한 안으로 좁힌다.
 */
function boundedW(record: VillageHouseTemplateRecord): number {
  return clamp(Math.trunc(record.w) || 0, 0, VILLAGE_RANGE.templateW.max);
}

function boundedH(record: VillageHouseTemplateRecord): number {
  return clamp(Math.trunc(record.h) || 0, 0, VILLAGE_RANGE.templateH.max);
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
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
