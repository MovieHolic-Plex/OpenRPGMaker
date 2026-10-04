import type { Project } from '../../project/types';

/** Map art is reviewed separately from executable dialogue; neither proves the other. */
export const ROMANCE_ART_AXES = ['composition', 'place', 'materials', 'grounding', 'readability'] as const;
export const ROMANCE_ART_DIRECTION = [
  '## 첫 만남의 16비트 도트 미술 기준',
  '사용자가 확정한 장소·분위기·인물 외형이 우선한다. 아래는 장면 구성 기준이며 특정 건물·주인공을 강제하는 템플릿이 아니다.',
  '16px 타일 기반의 선명한 픽셀 덩어리, 일관된 빛 방향·원근·배율·팔레트를 유지한다. 그림에서 인물 설정을 추측하거나 임의로 주인공 스프라이트를 교체하지 않는다.',
  '소품을 놓기 전에 한 화면의 구도를 정한다: 대화하는 두 인물과 실제 접근 길이 초점이고, 건물/지형이 중경, 수목/경계가 배경, 길 가장자리/화단이 전경이 된다. 빈 공간에도 마당·거리·쉼터처럼 역할이 있어야 한다.',
  '마을 첫 만남에서는 건물 문 앞 → 대화 자리 → 화면 바깥 길이 이어져야 한다. 집 한 채와 소품 몇 개를 평평한 잔디에 고립시키는 결과는 미완성이다. 빈 곳을 같은 소품의 반복이나 큰 포장 사각형으로 메우지 않는다.',
  '소품은 장소의 용도에 붙인다. 벤치는 쉼터, 화단은 경계, 등은 길 가장자리. 관련 없는 노점·전투 장식은 넣지 않는다. 발밑 받침과 접지, 문 앞 통행과 인물 주변 시야를 확인한다.',
  '현재 프로젝트 타일셋 참고문서의 해당 용도 MD 모든 페이지와 실제 이미지를 먼저 읽고, 완성된 키트·오토타일을 사용한다. 다른 타일셋 번호를 추측하거나 여러 계열을 섞지 않는다.',
  '대화창 기본은 pixel-cinematic과 픽셀 글꼴. 작은 각진 반투명 패널로 배경과 인물을 보이게 한다. 사용자 스타일 지정은 보존한다. 큰 불투명 크림창·과한 글자 그림자로 도트 장면을 덮지 않는다.',
  'review_map에서 구도(composition), 장소 표현(place), 재질 일관성(materials), 접지/통행(grounding), 인물 가독성(readability)을 각각 실제 이미지의 좌표와 관찰 근거로 보고한다. 실행 검사 성공을 미술 합격 근거로 쓰지 않는다.',
  'show_map_region은 지도 그림만 검증한다. 대화창과 선택지를 포함한 최종 화면은 별도의 실제 player.html 화면 검수가 필요하며, 지도 그림만 보고 런타임 UI까지 검수했다고 주장하지 않는다.',
].join('\n');

export function romanceArtReviewInstructions(project: Project): string {
  return `${ROMANCE_ART_DIRECTION}\n확정 장소: ${project.maps[project.startMapId]?.name ?? ''}\n` +
    'report_review의 artChecks에 다섯 축을 정확히 한 번씩 싣는다. 각 항목은 axis, passed, evidence(이미지 좌표와 실제 관찰)를 가진다. 보이지 않거나 확인하지 못한 축은 passed:false. 단순히 예쁘다/도트다/실행된다 같은 표현은 근거가 아니다.';
}

/** Fail closed on absent, duplicated, failed or empty visual evidence. */
export function romanceArtReviewFindings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return ['16비트 장면의 다섯 미술 검수 근거가 없습니다.'];
  const findings: string[] = [];
  for (const axis of ROMANCE_ART_AXES) {
    const rows = raw.filter(r => r && typeof r === 'object' && r.axis === axis);
    if (rows.length !== 1 || rows[0].passed !== true || typeof rows[0].evidence !== 'string' || rows[0].evidence.trim().length < 24) {
      findings.push(`미술 검수 ${axis}: 통과 판단과 구체적인 이미지 관찰 근거가 필요합니다.`);
    }
  }
  if (raw.length !== ROMANCE_ART_AXES.length) findings.push('미술 검수 축이 누락되거나 중복되었습니다.');
  return findings;
}

/** Known blank-town failure only; not a general aesthetic score or an outdoor density target. */
export function romanceTownLayoutFindings(project: Project): string[] {
  const map = project.maps[project.startMapId];
  if (project.gameDesignBrief?.interview?.choiceIds.experience !== 'town' || !map || map.tilesetId !== 'beodeul_city') return [];
  const tileset = project.tilesets[map.tilesetId];
  if (tileset?.image.type !== 'bundled' || tileset.image.id !== 'tex_beodeul_city'
    || tileset.tileGrafts?.some(g => g.targetTile === 737)) return [];
  // Judge the meeting viewport, not empty land outside the playable scene.
  const npc = map.events.find(e => e.id === 'ev_romance_partner');
  const width = Math.min(20, map.width), height = Math.min(15, map.height);
  const x0 = Math.max(0, Math.min(map.width - width, (npc?.x ?? project.startPos.x) - Math.floor(width / 2)));
  const y0 = Math.max(0, Math.min(map.height - height, (npc?.y ?? project.startPos.y) - Math.floor(height / 2)));
  const count = width * height;
  let bare = 0;
  for (let y = y0; y < y0 + height; y++) for (let x = x0; x < x0 + width; x++) {
    const i = y * map.width + x;
    if (map.lowerTiles[i] === 737 && (map.upperTiles[i] ?? -1) < 0
      && (map.lowerOverlayTiles?.[i] ?? -1) < 0 && (map.upperOverlayTiles?.[i] ?? -1) < 0) bare++;
  }
  return count > 0 && bare / count > 0.7
    ? [`마을 첫 만남 화면의 ${Math.round(bare / count * 100)}%가 물체 없는 기본 잔디입니다. 장소의 길·마당·경계를 구성한 뒤 다시 검수하세요. 이는 미완성 바닥 검사이며 미술 점수가 아닙니다.`] : [];
}
