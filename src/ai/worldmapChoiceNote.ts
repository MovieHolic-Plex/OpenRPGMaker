import { preferredWorldmapMode } from '@/project/worldmapModes';
import type { Project } from '@/project/types';

export function formatWorldmapChoiceNote(requestText: string | undefined, project?: { system?: Pick<Project['system'], 'genre'> }): string | null {
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
