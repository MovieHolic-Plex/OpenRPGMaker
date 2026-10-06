import type { Project } from './types';

/** Authored reference, rather than a genre-dependent runtime engine switch. */
export type EmeraldMonsterStyle = { version: 1; reference: 'emerald' };

export const EMERALD_MONSTER_TILESET_IDS = [
  'emerald_monster_overworld', 'emerald_monster_wild', 'emerald_monster_coast', 'emerald_monster_climate',
  'emerald_monster_rooms', 'emerald_monster_dungeon', 'emerald_monster_gyms',
] as const;

export function isEmeraldMonsterStyle(project: Pick<Project, 'meta'>): boolean {
  return project.meta.oprnMonsterStyle?.version === 1
    && project.meta.oprnMonsterStyle.reference === 'emerald';
}

/** Does not regenerate maps, award a starter, change session state, or replace an authored story. */
export function configureEmeraldMonsterStyle(project: Project): void {
  project.meta.oprnMonsterStyle = { version: 1, reference: 'emerald' };
  // Keep host-compatible presets; runtime resolves the authored reference separately.
  project.meta.oprnShopPreset = 'collector';
  project.system.menuUiStyle = 'field-list';
  project.system.battleUiStyle = 'pokemon';
  project.system.battleFlow = 'strict';
  // Existing viewport minimum is 320x240: author the GBA 240x160 view at exact 2x.
  project.system.playResolution = { width: 480, height: 320 };
  project.system.cameraZoom = 2;
  project.system.dialogueStyle = 'handheld';
  project.system.fieldHud = {
    ...project.system.fieldHud, theme: 'collector', font: 'pixel', menuStyle: 'project',
    vitals: false, clock: false, tools: false, objective: false, hideEmpty: true,
  };
}

export const EMERALD_MONSTER_AUTHORING_GUIDE = [
  '포켓몬 같은 게임의 기본 제작 기준은 에메랄드 참고 프로필이다. 명시적으로 다른 참고작을 지정하면 그 요청을 따른다.',
  'configure_monster_style(reference:emerald)로 실제 저작 설정을 적용하고 read_game_systems에서 다시 읽는다.',
  '시작 메뉴·대화·가방·동료·상점·전투는 한 GBA 창/입력 규칙을 공유한다. 현대식 카드·탭·둥근 액션 버튼을 섞지 않는다.',
  '오프닝은 교수와 몬스터 소개, 플레이어의 출발 동기, 실제 시작 지점으로 이어지는 Enter 확인 대화다. 반복 페이드·타이머 진행을 기본값으로 쓰지 않는다.',
  '타일은 16px 몬스터 수집 공용 칩셋(monster_*)의 현재 참고문서 MD와 실제 그림을 먼저 읽고 조립한다. 타일을 다른 일반 RPG 팩으로 바꾸지 않는다. emerald_monster_*는 이미 그 시트를 쓰는 프로젝트 전용이며 새 맵에 섞지 않는다.',
  '필드 인물 원본은16×32, 주인공 잉크14×20~21, 전체 걷기12포즈 팔레트15불투명색+투명이다.24×32 에디터 칸에는 x4 투명여백으로 원본을 그대로 넣고 늘리지 않는다. 전투 인물/교수 소개는64×64다. 새 그림은 pokemon-character-motion 하네스의 구조·재생 검수·해시 관문을 통과해 공용팩으로 등록한다.',
  '몬스터는 종별 정면·뒷면 그림, 실제 타입·기술·PP·진화·서식지·포획 데이터를 연결한다. 미연결 그림이나 배우 파티로 대체하지 않는다.',
  '초기 동료 선택→풀밭 조우→전투/포획→회복→상점→체육관/배지→저장/재개를 실제 플레이로 확인해야 제작 완료다.',
  '완성된 맵 연결·스토리·로스터가 필요한 요청은 전체 캠페인 제작 도구를 사용한다. UI 설정만으로 게임 제작을 완료했다고 보고하지 않는다.',
].join('\n');
