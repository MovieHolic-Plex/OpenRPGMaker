// 에메랄드 몬스터 v4 종 그림(2026-10-04 생성, 60종 앞·뒤) — 편집기에서 고르는 번들 몬스터 그림.
//
// 캠페인 종 그림은 몬스터 수집 하네스 번들(harnessMonsterArt.ts, 사용자 합격 2026-10-20)이 정본이다.
// 이 팩은 그 그림을 바꾸지 않고, 같은 종의 다른 그림체를 몬스터 그림 목록에 더할 뿐이다.
// 종 목록과 이름은 emeraldSpeciesV4.json, 원본 후보·생성 기록은 assets/emerald-monster-v2/.
//
// 리소스 id: `emerald-v4-<종>-<front|back>`. 파일: `/assets/emerald-monster/species-v4/<종>-<면>.png`(112×112).
import manifest from "./emeraldSpeciesV4.json" with { type: "json" };

export type EmeraldSpeciesV4Asset = {
  readonly id: string;
  readonly name: string;
  readonly path: string;
};

type Manifest = { readonly species: readonly { readonly id: string; readonly name: string }[] };

const BASE_PATH = "assets/emerald-monster/species-v4";
const SIDE_LABEL = { front: "앞", back: "뒤" } as const;

export const EMERALD_SPECIES_V4_ASSETS: readonly EmeraldSpeciesV4Asset[] = (manifest as Manifest).species.flatMap(({ id, name }) =>
  (["front", "back"] as const).map((side) => ({
    id: `emerald-v4-${id}-${side}`,
    name: `${name} ${SIDE_LABEL[side]} (에메랄드 v4)`,
    path: `${BASE_PATH}/${id}-${side}.png`,
  })));

export const EMERALD_SPECIES_V4_RESOURCE_IDS: readonly string[] = EMERALD_SPECIES_V4_ASSETS.map((asset) => asset.id);

const BY_ID: ReadonlyMap<string, EmeraldSpeciesV4Asset> = new Map(EMERALD_SPECIES_V4_ASSETS.map((asset) => [asset.id, asset]));

/** 팩 그림의 URL(선행 슬래시). 팩에 없는 id 는 null — 호출자가 다른 해석기로 넘어간다. */
export function resolveEmeraldSpeciesV4Url(resourceId: string): string | null {
  const asset = BY_ID.get(resourceId);
  return asset ? `/${asset.path}` : null;
}
