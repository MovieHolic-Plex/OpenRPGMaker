import type { SpatialGalleryCard } from './spatialCatalog';
import { visibleAuthoringProject } from './spatialAuthoringAccess';

/** 지역 분류 — 장소 라이브러리 필터와 같은 어휘를 쓴다(그림체·유형·출처·검색). */
export const REGION_CATEGORIES = ['마을·정주지', '자연·지형', '던전·유적', '특수'] as const;
export type RegionClassification = { style: string; category: string; origin: '참고 사례' | '내 설계' | '마을 설계서'; size: string };
export const regionLibraryFilters = { style: '', category: '', origin: '', search: '' };
/** 0건 화면의 탈출구 — 필터를 손으로 되돌리게 두지 않는다. */
export function resetRegionLibraryFilters(): void {
  regionLibraryFilters.style = '';
  regionLibraryFilters.category = '';
  regionLibraryFilters.origin = '';
  regionLibraryFilters.search = '';
}

export function tilesetStyleOf(id: string | undefined): string {
  if (!id) return '미분류';
  const name = visibleAuthoringProject().tilesets[id]?.name;
  return /easyrpg|tibo|bluewave|forest_harmony/i.test(id) ? 'EasyRPG' : name || id;
}

export function classifyRegionCard(card: SpatialGalleryCard): RegionClassification {
  const p = visibleAuthoringProject();
  const source = card.canonicalSource?.kind === 'region' ? p.spatialAuthoring?.library.regions[card.canonicalSource.id] : undefined;
  const style = tilesetStyleOf(source?.terrain.tilesetId ?? card.tilesetId);
  const identity = `${card.localId ?? ''} ${card.name}`;
  const category = source?.tags.find(tag => tag.startsWith('지역유형:'))?.slice(5)
    ?? (card.regionKind === 'settlement' || /마을|도시|정주지|성벽|village|town|settlement/i.test(identity) ? '마을·정주지'
      : /숲|호수|강|바다|설원|산|계곡|forest|lake|river|snow|mountain/i.test(identity) ? '자연·지형'
        : /유적|동굴|광산|던전|ruins|cave|mine/i.test(identity) ? '던전·유적' : '특수');
  const origin = card.canonicalSource ? '내 설계' : card.regionMapId || card.regionReferenceId ? '참고 사례' : '마을 설계서';
  const terrain = source?.terrain;
  const size = terrain ? `${terrain.width}×${terrain.height}` : card.regionReferenceId ? '완성 맵' : '—';
  return { style, category, origin, size };
}

export function matchesRegionClassification(card: SpatialGalleryCard): boolean {
  const value = classifyRegionCard(card), f = regionLibraryFilters;
  return (!f.style || value.style === f.style) && (!f.category || value.category === f.category)
    && (!f.origin || value.origin === f.origin)
    && (!f.search || card.name.toLocaleLowerCase().includes(f.search.toLocaleLowerCase()));
}
