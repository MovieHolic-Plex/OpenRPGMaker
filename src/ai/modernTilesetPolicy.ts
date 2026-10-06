import type { Project, TilesetDef } from '@/project/types';
import { packTownTargetFor } from './piAgent/packTownRoute';
import { describesJapaneseStreet, namesJpCityTileset } from './jpCityPolicy';

/** Authoring policy, not a download/license verifier. Freeze installed PAW pixels before the run. */
export const MODERN_TILESET_POLICY_LINE = '현대·현대 일본 맵(도시/학교/교실/주택/상점/시설 실내)은 Pixel Art World(yms.main.jp/dotartworld)의 사용자 설치 칩셋과 그 공용 파생 타일셋만 사용한다. 이 규칙은 일반 야외 기본 칩셋/판타지 집/실내 자동 생성 지침보다 우선한다. 다른 현대 소재(Modern Exteriors 등)나 판타지 기본 칩셋으로 대체·혼합하지 않는다. 설치 목록과 해당 용도 참고문서의 모든 MD/그림을 읽고 요청에 맞는 평면을 직접 배치한다. 필요한 PAW 칩셋이 없으면 자료집 → 맵 → 타일 → 외부 타일셋 다운로드에서 제작자 페이지를 열어 원본 PNG를 받고 가져오도록 안내한다. 다운로드/설치 완료를 지어내거나 완성 맵 복사를 새 설계라고 보고하지 않는다.';
export const MODERN_MAP_INITIAL_TOOLS = ['get_project_summary', 'list_resources', 'find_tools', 'list_tileset_references', 'read_tileset_reference', 'get_tile_info', 'create_map', 'paint_tiles', 'get_map_region', 'show_map_region', 'inspect_interior_layout'] as const;

/**
 * 번들 일본 도시 칩셋(jp_city, 계열 oprn-jp). PAW 전용 정책의 의도는 «사용자가 설치한 PAW 원본 칩셋만 쓰고 다른 외부 현대 소재로 대체·혼합하지 않는다»이다.
 * jp_city 는 외부 소재가 아니라 이 저장소가 손 도트로 구워 번들한 칩셋이고(tiledata/jp-city/ATTRIBUTION.md), 건물 조립 도구 build_jp_city_building 이 이 칩셋 맵에서만 동작한다.
 * 그래서 현대 맵 게이트(requestsModernMap)와 칸 변경 거부(modernTilesetViolation)에서 jp_city 맵만 뺀다. defaults/jpCity.ts 는 2MB JSON 을 끌어오므로 텍스처 키 문자열만 같이 쓴다(JP_CITY_TEXTURE).
 */
export function isBundledJpCityTileset(tile: TilesetDef | undefined): boolean {
  return !!tile && tile.image.type === 'bundled' && tile.image.id === 'tex_jp_city';
}

/** 몬스터 수집 손 도트 킷과 그 에메랄드 재채색. defaults/monsterKit.ts 는 큰 생성 표를 끌어오므로 계열 문자열만 본다. */
export function isMonsterKitTileset(tile: TilesetDef | undefined): boolean {
  return !!tile && (tile.family === 'oprn-monster' || tile.family === 'oprn-monster-emerald');
}

export function isPawTileset(tile: TilesetDef | undefined): boolean {
  return !!tile && (/^paw-/.test(tile.id) || /^shared_paw_/.test(tile.id) || /(?:^|__)shared_paw_/.test(tile.id));
}

export function requestsModernMap(project: Project, task: string, mapIds: readonly string[] = []): boolean {
  // 팩 도시 타일셋(Rasak Modern 등) 마을은 PAW 정책 밖이다 — 팩 이름의 «Modern/모던» 이 PAW 전용 게이트를 켜서
  // 그 타일셋 쓰기를 모두 거부했다(2026-09-26 헤드리스 시험 run-1~3).
  if (packTownTargetFor(project, task, null) || mapIds.some(id => packTownTargetFor(project, undefined, id))) return false;
  // 지금 다루는 맵이 번들 일본 도시(jp_city)면 PAW 전용 게이트 밖이다 — 그 맵은 build_jp_city_building 과 jp_city 참고문서로 짓는다.
  if (mapIds.length > 0 && mapIds.every(id => isBundledJpCityTileset(project.tilesets[project.maps[id]?.tilesetId ?? '']))) return false;
  // 몬스터 수집 칩셋(oprn-monster·oprn-monster-emerald) 맵도 PAW 전용 게이트 밖이다 — 그 게임은 처음 고른 칩셋 계열을 끝까지 쓴다(2026-10-06 연속성 결정).
  // 실측: 포켓몬풍 지침 문장 「현대식 카드…섞지 않는다」와 「상점」이 이 게이트를 켜 build_monster_game 을 PAW 위반으로 거부했다.
  if (mapIds.length > 0 && mapIds.every(id => isMonsterKitTileset(project.tilesets[project.maps[id]?.tilesetId ?? '']))) return false;
  // 사용자가 번들 칩셋 jp_city 를 직접 부른 요청도 PAW 전용 게이트 밖이다 — 맵이 아직 없어 위 검사에 안 걸리는 «새 맵» 단계(설치 PAW 가 없으면 타일 배치를 멈추고 다운로드를 안내하던 곳).
  if (namesJpCityTileset(task)) return false;
  // 설치된 PAW 가 하나도 없는데 일본 거리 풍경을 «현대 …» 로 말한 요청 — 이 게이트는 타일 배치를 멈추고 다운로드를 안내할 뿐이다. 번들 jp_city 가 그 일을 한다.
  // PAW 가 설치돼 있으면 사용자가 그쪽을 기대할 수 있으니 게이트가 그대로 이긴다.
  if (describesJapaneseStreet(task) && project.tilesets.jp_city && createModernTilesetPolicy(project).tilesets.length === 0) return false;
  const mapWork = /맵|지도|마을|도시|학교|교실|실내|주택|아파트|상점|가게|거리|복도|이자카야|편의점|사무실|의원|병원|방(?:을|이|에|도|\s)|\b(?:map|town|city|school|classroom|interior|house|shop|street|room|office|clinic)\b/i.test(task);
  const positive = task.replace(/(?:현대|모던)(?:식|풍|가|는)?\s*(?:말고|아닌|아니라|제외)|\bnot\s+(?:modern|contemporary)\b/gi, '');
  const modern = /현대(?!\s*자동차)|모던|\b(?:modern|contemporary)\b/i.test(positive);
  if (modern && (mapWork || (mapIds.length > 0 && /만들|꾸며|바꿔|바꾸|짓|생성|배치|\b(?:build|create|change|design|make)\b/i.test(task)))) return true;
  if (/중세|판타지|\b(?:medieval|fantasy)\b/i.test(task)) return false;
  return mapWork && mapIds.some(id => {
    const map = project.maps[id];
    return !!map && isPawTileset(project.tilesets[map.tilesetId]);
  });
}

type ApprovedSheet = { image: string; tileSize: number; columns: number; count: number };
export type ModernTilesetPolicy = { readonly tilesets: readonly { id: string; name: string }[]; readonly sheets: readonly ApprovedSheet[] };

function sheet(project: Project, tile: TilesetDef): ApprovedSheet | undefined {
  // PAW is user-installed; a coincidentally named built-in texture is not an installed source.
  if (tile.image.type !== 'uploaded') return;
  const asset = project.assets.uploaded[tile.image.id];
  const image = asset?.dataUrl || (asset?.ref?.sha256 ? `sha256:${asset.ref.sha256}` : undefined);
  if (!image) return;
  return { image, tileSize: tile.tileSize, columns: tile.tilesPerRow, count: tile.count };
}

export function createModernTilesetPolicy(project: Project): ModernTilesetPolicy {
  const tiles = Object.values(project.tilesets).filter(isPawTileset).filter(t => sheet(project, t));
  return { tilesets: tiles.map(t => ({ id: t.id, name: t.name })), sheets: tiles.map(t => sheet(project, t)!) };
}

export function modernTilesetPolicyPrompt(policy: ModernTilesetPolicy): string {
  return `${MODERN_TILESET_POLICY_LINE}\n이번 실행은 PAW 전용이다. 다른 칩셋의 타일 변경은 적용되지 않는다. ${policy.tilesets.length ? '설치된 PAW 타일셋(일부): '+JSON.stringify(policy.tilesets.slice(0, 40))+'; 나머지는 list_resources/get_project_summary로 조회한다. 각 맵의 용도에 맞는 것을 선택한다.' : '설치된 PAW 칩셋이 없다. 타일 배치를 시작하지 말고 다운로드/가져오기 경로를 안내한다.'} 기존 다른 칩셋 맵을 이름/번호만 바꿔 PAW로 간주하지 않는다.`;
}

/** Only tile geometry/painting is gated; unrelated existing maps and event-only edits stay intact. */
export function modernTilesetViolation(before: Project, after: Project, policy: ModernTilesetPolicy): string | undefined {
  const same = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
  const sameSheet = (a: ApprovedSheet | undefined, b: ApprovedSheet | undefined) => a?.image === b?.image && a?.tileSize === b?.tileSize && a?.columns === b?.columns && a?.count === b?.count;
  for (const [id, map] of Object.entries(after.maps)) {
    const old = before.maps[id], tile = after.tilesets[map.tilesetId];
    if (isBundledJpCityTileset(tile)) continue;                       // 번들 jp_city 맵은 PAW 전용 정책의 대상이 아니다(위 isBundledJpCityTileset 주석)
    const oldTile = old && before.tilesets[old.tilesetId];
    const a = tile && sheet(after, tile), b = oldTile && sheet(before, oldTile);
    const changed = !old || map.tilesetId !== old.tilesetId || map.width !== old.width || map.height !== old.height || map.tileSize !== old.tileSize
      || !same(map.lowerTiles, old.lowerTiles) || !same(map.upperTiles, old.upperTiles)
      || !same(map.lowerTileStacks, old.lowerTileStacks) || !same(map.upperTileStacks, old.upperTileStacks)
      || !same(tile?.image, oldTile?.image) || tile?.tileSize !== oldTile?.tileSize || tile?.tilesPerRow !== oldTile?.tilesPerRow || tile?.count !== oldTile?.count
      || !sameSheet(a, b);
    if (!changed) continue;
    if (!a || !policy.sheets.some(s => s.image === a.image && s.tileSize === a.tileSize && s.columns === a.columns && s.count === a.count)) {
      return `현대 맵 '${map.name}'에는 설치된 Pixel Art World 칩셋만 사용할 수 있습니다. '${map.tilesetId}' 사용/혼합 변경은 적용하지 않았습니다. PAW 타일셋을 조회해 선택하세요. 없으면 자료집 → 맵 → 타일 → 외부 타일셋 다운로드에서 원본 PNG 다운로드/가져오기를 안내하세요. 현대 거리·실내 «장면» 하나만 필요한 컷신이면 새 맵을 만들지 말고 generate_cutscene_art(role:'backdrop') 배경 그림 + script_cutscene_staged(backdropResourceId) 로 만든 뒤 기존 맵에서 이어 가세요.`;
    }
  }
  // 위반이 없으면 undefined — noImplicitReturns 아래에서는 암묵 종료가 오류다.
  return undefined;
}
