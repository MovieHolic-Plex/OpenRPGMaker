import type { SpatialGalleryCard } from './spatialCatalog';
import { visibleAuthoringProject } from './spatialAuthoringAccess';
import { reviewedPlaceClassificationSource } from '@/project/defaults/spatial/reviewedPlaceCatalog';

export const PLACE_CATEGORIES = ['마을·도시', '자연', '건물·시설', '던전·유적', '이동수단'] as const;
export const PLACE_ENVIRONMENTS = ['실외', '건물 내부', '지하', '수중'] as const;
export type PlaceClassification = { style: string; category: string; environment: string; purposes: string[] };
export const placeLibraryFilters = { style: '', category: '', environment: '', purpose: '', search: '' };
/** 0건 화면의 탈출구 — 분류 필터를 손으로 되돌리게 두지 않는다. */
export function resetPlaceLibraryFilters(): void {
  placeLibraryFilters.style = '';
  placeLibraryFilters.category = '';
  placeLibraryFilters.environment = '';
  placeLibraryFilters.purpose = '';
  placeLibraryFilters.search = '';
}
export function classificationTags(value: PlaceClassification): string[] {
  return [`그림체:${value.style}`, `장소유형:${value.category}`, `공간형태:${value.environment}`, ...value.purposes.map(p => `용도:${p.trim()}`).filter(p => p !== '용도:')];
}
export function tilesetStyle(id: string | undefined, name = ''): string {
  if (!id) return '미분류';
  return /easyrpg|tibo|bluewave|forest_harmony/i.test(id) ? 'EasyRPG' : name || id;
}
export function classifyPlaceCard(card: SpatialGalleryCard): PlaceClassification {
  const p = visibleAuthoringProject();
  const ref = card.canonicalSource;
  const source = ref?.kind === 'place' ? p.spatialAuthoring?.library.places[ref.id]
    : ref?.kind === 'space' ? p.spatialAuthoring?.library.spaces[ref.id] : undefined;
  const reviewed = card.reviewedPlaceId ? reviewedPlaceClassificationSource(card.reviewedPlaceId) : undefined;
  const tags = source?.tags ?? reviewed?.tags ?? [];
  const tag = (prefix: string) => tags.find(t => t.startsWith(prefix))?.slice(prefix.length);
  let tid = card.tilesetId ?? reviewed?.tilesetId;
  if (source && 'tilesetId' in source) tid = source.tilesetId;
  if (source && 'exterior' in source) tid = source.exterior?.tilesetId ?? tid;
  if (!tid && source && 'children' in source) {
    const child = source.children.find(c => c.source.kind === 'space');
    if (child) tid = p.spatialAuthoring?.library.spaces[child.source.id]?.tilesetId;
  }
  const identity = `${card.localId ?? ''} ${card.name}`;
  const category = tag('장소유형:') ?? (/ship|갑판|선내|대형선/.test(identity) ? '이동수단'
    : /cave|mine|vault|ossuary|sanctuary|shrine|waterworks|동굴|광산|미궁|유적|지하|납골/.test(identity) ? '던전·유적'
    : card.placeKind === 'settlement' ? '마을·도시'
    : card.placeKind === 'natural' || /snow|lake|숲|호수|설산/.test(identity) ? '자연'
    : card.placeKind === 'facility' || card.kind === 'spaces' ? '건물·시설' : '미분류');
  const environment = tag('공간형태:') ?? (source && 'environment' in source && source.environment === 'interior' ? '건물 내부'
    : /interior|cabin/.test(tid ?? '') ? '건물 내부'
    : /cave|mine|vault|ossuary|waterworks|동굴|광산|지하|납골/.test(identity) ? '지하'
    : tid ? '실외' : '미분류');
  const purposes = tags.filter(t => t.startsWith('용도:')).map(t => t.slice(3));
  if (!purposes.length) {
    if (/학교|은행|도서관|우체국|진료|목욕/.test(identity)) purposes.push('공공시설');
    else if (/여관|제과|상점|재단|목공|잡화/.test(identity)) purposes.push('상업시설');
    else if (category === '던전·유적') purposes.push('탐험');
    else if (category === '이동수단') purposes.push('항해');
  }
  return { style: tag('그림체:') ?? tilesetStyle(tid, tid ? p.tilesets[tid]?.name : ''), category, environment, purposes };
}
export function matchesPlaceClassification(card: SpatialGalleryCard): boolean {
  const value = classifyPlaceCard(card), f = placeLibraryFilters;
  return (!f.style || value.style === f.style) && (!f.category || value.category === f.category)
    && (!f.environment || value.environment === f.environment) && (!f.purpose || value.purposes.includes(f.purpose))
    && (!f.search || `${card.name} ${value.purposes.join(' ')}`.toLocaleLowerCase().includes(f.search.toLocaleLowerCase()));
}
