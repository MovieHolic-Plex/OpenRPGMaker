import snapshot from './regionReferences/river-fortress.json';
export const CASTLE_PLACE_REFERENCES = [{
  id: 'river-fortress-160x144', name: '강변 성채', kind: 'completed-place' as const,
  placeKind: 'settlement' as const, revision: 1, x: 0, y: 0, width: 160, height: 144,
  tilesetId: snapshot.tileset.id,
  preview: '/assets/region-references/river-fortress.png',
  tilesetPreview: '/assets/region-references/river-fortress-atlas.png',
  projectDownload: '/assets/region-references/river-fortress.oprn.json',
  sourceProjectId: 'castle-fortress-city-20260921', sourceMapId: snapshot.map.id,
  snapshotProjectId: 'oprn-place-river-fortress-v1',
  rules: [
    '중하부 본성, 고목 뒤뜰, 넓은 동쪽 강과 두 척의 배를 연결한 160×144 성채.',
    '남쪽 성 밖은 사용자가 선호한 개선1의 석조 건물과 정돈된 길 배치를 보존한다.',
    '칩셋과 NPC 대화를 포함한 맵 파일을 내려받을 수 있다. 다른 프로젝트에서도 공용 장소로 조회한다.',
  ],
  limitations: '배치 참고 장소. 본성 실내·승선·강 건너 쉼터로 가는 길은 포함하지 않는다. 참고 이미지의 돌다리는 제외했다.',
}];
export function castlePlaceSnapshot(id: string) {
  return id === 'river-fortress-160x144' ? snapshot : undefined;
}
