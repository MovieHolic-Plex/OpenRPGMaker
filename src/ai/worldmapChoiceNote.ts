import { preferredWorldmapMode } from '@/project/worldmapModes';
import type { Project } from '@/project/types';

export function formatWorldmapChoiceNote(requestText: string | undefined, project?: { system?: Pick<Project['system'], 'genre'> } & Partial<Pick<Project, 'maps' | 'tilesets' | 'startMapId'>>, mapId?: string): string | null {
  const map = project?.maps?.[mapId ?? project?.startMapId ?? ''];
  const tileset = map && project?.tilesets?.[map.tilesetId];
  if (requestText && tileset?.autotileGroups?.some(g=>g.id==='worldmap-brush-grass-sea') && !map?.worldmapSource
    && /지도|지형|바탕|길|도로|강|숲|산맥|다리|마을|world.?map|road|river|forest/i.test(requestText)) {
    return [
      `[월드맵 연결 붓] 현재 대상 ${map!.id}는 직접 편집하는 연결 붓 지도다. read_world_terrain은 이 지도와 별도 생성 지형이므로 현재 지도 읽기에 사용하지 않는다.`,
      'list_tileset_references로 현재 자료를 조회하고 자동 붓 용도 wmi-authoring-auto를 read_tileset_reference로 그림과 함께 읽는다. 재료 이름은 강/길/호수/숲/산맥/사막/설원. fill_region은 바탕을 칸마다 맞추고 숲·산을 위층에 놓는다(layer 생략).',
      '횡단 길은 fill_region({mapId,material:"길",path:[{x,y},{x,y}],width:1}) 한 번으로 세 바탕과 강의 가로/세로 다리를 맞춘다. 굽은 강도 material:"강",path,width로 놓는다. 바탕별 타일 번호를 검색해 여러 번 찍지 않는다.',
      '거점은 list_worldmap_icons → 판타지 참고문서와 이미지 → stamp_worldmap_icon으로 전체를 놓고 inspect_worldmap_icon으로 검사한다. 마지막에 show_map_region과 check_reachability로 실제 결과를 확인한다.',
    ].join('\n');
  }
  if (!requestText || !/(월드맵|세계\s*지도|지역\s*지도|world\s*map|overworld)/i.test(requestText)) return null;
  const monster = preferredWorldmapMode(project) === 'region-routes' || /포켓몬|pokemon|pokémon|몬스터\s*수집/i.test(requestText);
  return [
    '[월드맵 선택] 일반 새 월드맵의 기본은 기존 대륙 월드맵이다. list_worldmap_themes → read_world_terrain → edit_world_terrain({ops:[],theme}) 경로를 사용한다.',
    '몬스터 수집·포켓몬풍의 새 지역 지도는 read_worldmap_structure_reference({structure:"region-routes"}) → author_worldmap_structure({id,structure:"region-routes"})로 마을·도로와 지역 전도를 만든다. theme:"monster"는 기존 대륙 그림의 세계관이며 포켓몬식 이동 구조를 대신하지 않는다.',
    'author_worldmap_structure가 만드는 새 지도 묶음은 전용 atlas_cartography를 사용한다. 현재 보고 있는 마을의 칩셋과 별도로 저작하며, 기존 맵을 덮거나 칩셋을 바꾸지 않는다.',
    monster ? '현재 프로젝트 또는 요청은 몬스터 수집·포켓몬풍이다. 별도 방식 지정이 없으면 region-routes를 선택한다.' : '별도 방식 지정이 없으면 기본 대륙 월드맵을 선택한다.',
    '사용자가 다른 이동 방식을 명시하면 그 선택이 우선이다. 기존 지도 수정은 그 지도 원본과 도구를 유지하며, 기본 선택 때문에 교체하지 않는다.',
  ].join('\n');
}
