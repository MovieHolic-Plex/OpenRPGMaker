import retired from "@/assets/retiredObjects.json" with { type: "json" };

/**
 * 품질 판정에서 물러난 기물(src/assets/retiredObjects.json). 권하는 목록에서만 빠진다:
 * 기물 검색·DB 앨범·조수 물건 사전·kit 목록·공간 갤러리. 정의와 아틀라스 칸은 남으므로
 * 옛 저장본, 견본 맵 칸표, id 로 부른 찍기는 그대로 된다.
 */
const RETIRED: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  Object.entries(retired.objects as Record<string, Record<string, unknown>>).map(([tilesetId, ids]) => [tilesetId, new Set(Object.keys(ids))]),
);

export function isRetiredObject(tilesetId: string | undefined, objectId: string): boolean {
  return tilesetId !== undefined && (RETIRED.get(tilesetId)?.has(objectId) ?? false);
}

export function retiredObjectIds(): ReadonlyMap<string, ReadonlySet<string>> {
  return RETIRED;
}
