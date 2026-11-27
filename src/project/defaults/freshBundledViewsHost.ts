import baked from "../../assets/bundledTilesetFreshViews.json" with { type: "json" };

// 호스트(Electron main·로컬 저장소) 전용: 저장 글의 번들 타일셋 중 구운 «정규화한 새 타일셋» 보기와 글자까지 같은 것.
// 그런 항목은 이 빌드가 번들 정의로 만들고 ci-fast·시험이 되돌리기를 확인한 값이라, 저장 검사에서 다시 되돌려 검사하지 않는다
// (src/project/defaults/freshStarter.ts). 빈 새 프로젝트의 첫 저장에서 번들 정의 49개 짓기·검사 약 1.4s 를 뺀다.
let bakedTexts: ReadonlyMap<string, string> | null = null;

export function untouchedFreshBundledTilesetIds(tree: unknown): Set<string> {
  const ids = new Set<string>();
  const tilesets = typeof tree === "object" && tree !== null ? (tree as { tilesets?: unknown }).tilesets : undefined;
  if (typeof tilesets !== "object" || tilesets === null) return ids;
  bakedTexts ??= new Map(Object.entries(baked as Record<string, unknown>).map(([id, view]) => [id, JSON.stringify(view)]));
  for (const [id, view] of Object.entries(tilesets as Record<string, unknown>)) {
    const text = bakedTexts.get(id);
    if (text !== undefined && JSON.stringify(view) === text) ids.add(id);
  }
  return ids;
}
