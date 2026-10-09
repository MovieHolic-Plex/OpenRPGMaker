import { additionalAuthoringPresets } from './authoringPresets/catalog';

/** Shared playable-pattern manuals. Reading a preset never authors project content. */
export const AUTHORING_PRESET_CATEGORIES = [
  { id: 'exploration', label: '탐험·장치' },
  { id: 'npc-life', label: 'NPC 생활' },
  { id: 'life-economy', label: '생활·경제' },
  { id: 'combat', label: '전투 구성' },
  { id: 'party', label: '동료·파티' },
  { id: 'growth', label: '성장·기술' },
  { id: 'dungeon', label: '던전 진행' },
  { id: 'world-story', label: '세계·사건' },
  { id: 'time-causality', label: '시대·인과' },
  { id: 'loot-equipment', label: '전리품·장비' },
  { id: 'repeat-challenge', label: '반복·도전' },
  { id: 'endings', label: '엔딩·회차' },
] as const;
export type AuthoringPresetCategory = typeof AUTHORING_PRESET_CATEGORIES[number]['id'];
export interface AuthoringPresetStep {
  readonly title: string;
  readonly action: string;
  readonly output: string;
  readonly tools: readonly string[];
}
export interface AuthoringPreset {
  readonly id: string;
  readonly version: number;
  readonly category: AuthoringPresetCategory;
  readonly title: string;
  readonly description: string;
  readonly example: string;
  readonly tags: readonly string[];
  readonly prerequisites: readonly string[];
  readonly states: readonly string[];
  readonly steps: readonly AuthoringPresetStep[];
  readonly checks: readonly string[];
  readonly cautions: readonly string[];
  readonly tools: { readonly read: readonly string[]; readonly write: readonly string[]; readonly verify: readonly string[] };
}
const sharedReads = ['get_project_summary', 'get_map_region', 'get_event', 'get_database_records'];
const groups: Record<AuthoringPresetCategory, { prerequisites: string[]; read?: string[]; verify: string[]; cautions: string[] }> = {
  exploration: {
    prerequisites: ['현재 맵·입구·출구·통행 가능한 조작 위치와 관련 아이템·이벤트를 실제 데이터에서 확인한다.'],
    verify: ['get_event', 'check_reachability', 'run_lint', 'play_walkthrough'],
    cautions: ['배치 전에 해당 타일셋의 참고문서와 실제 그림을 읽는다. 실내는 손 도트 v5 작성 경로를 따른다.', '도구 성공이나 통행 검사만으로 장치 완주를 확인했다고 보고하지 않는다.'],
  },
  'npc-life': {
    prerequisites: ['기존 NPC의 eventId·전체 페이지·시간표·집과 활동 장소를 읽는다.', '시간표를 쓰면 시간 시스템 활성화와 기다리기 또는 시간 변경 경로가 필요하다.'],
    verify: ['get_event', 'check_reachability', 'run_lint', 'play_walkthrough'],
    cautions: ['동일 인물을 시간대마다 복제하지 않는다. 생략한 시간표·대사·외형과 퀘스트 분기를 보존한다.', '시간표의 at은 시간 조건에 따른 위치 갱신이다. 연속 보행·맵 간 보행 경로가 구현됐다고 주장하지 않는다.', '요일을 발명하지 않는다. 실제 시간 조건의 hourRange/dayRange/season을 사용한다.'],
  },
  'life-economy': {
    prerequisites: ['아이템·제작법·생활 설정과 저작 시작 소지품·골드를 읽는다. 현재 플레이 값과는 구분한다.', '배열 설정을 교체하는 도구는 원래 전체 목록을 읽고 관련 항목을 합쳐 전달한다.'],
    verify: ['get_database_records', 'get_event', 'run_lint', 'play_walkthrough'],
    cautions: ['설정 레코드와 플레이어가 이용할 실제 상호작용을 함께 연결한다.', '성공 전 소비·보상, 실패·취소 뒤 지급, 완료 후 중복 지급을 각각 확인한다.'],
  },
  combat: {
    prerequisites: ['현재 전투 방식·파티·장비·기술·적·부대·상태의 실제 ID와 전체 필드를 읽는다.', '기존 전투 방식을 유지하며 요청한 전투 범위와 승리·패배·도주 결과를 먼저 정한다.'],
    verify: ['get_database_records', 'simulate_battle', 'run_lint', 'play_walkthrough'],
    cautions: ['프리셋은 현재 지원 전투 방식의 데이터·이벤트 조합이다. 새로운 전투 엔진으로 바꾸지 않는다.', 'simulate_battle 결과는 실제 전투 화면·이벤트 복귀·저장 확인을 대신하지 않는다.'],
  },
  party: {
    prerequisites: ['기존 배우·현재 파티·인물 프로필·합류/이탈 이벤트와 전체 페이지를 읽는다.'],
    read: ['get_story_state'], verify: ['get_event', 'run_lint', 'play_walkthrough'],
    cautions: ['add_companion은 필드 추종이다. 전투 파티 합류는 changeParty로 별도 연결한다.', '필수 이동 능력을 가진 인물이 이탈할 때 귀환·대체 경로를 마련한다.'],
  },
  growth: {
    prerequisites: ['실제 배우·직업·기술·전직 조건·성장 원본과 현재 전투 방식을 읽는다.'],
    verify: ['get_database_records', 'run_lint', 'simulate_battle', 'play_walkthrough'],
    cautions: ['저작 초기 배우 수정과 플레이 중 습득·전직 명령을 구분한다.', '연계기는 실제 comboActorIds와 참가자별 MP·행동 조건을 쓴다. 없는 성장 트리 저작 도구를 발명하지 않는다.'],
  },
  dungeon: {
    prerequisites: ['현재 맵 묶음·층·출입구·필수 능력·기존 장치와 안전 복귀 위치를 읽는다.'],
    verify: ['get_event', 'check_reachability', 'run_lint', 'play_walkthrough'],
    cautions: ['변형 전후 통행을 실제로 검사한다. 실내와 던전은 각 정본 칩셋·하네스 작성 규칙을 따른다.', '타일 상태를 런타임에 바꾸는 명령이 없으면 미리 저작한 변형 맵과 조건 출입구로 구성한다.'],
  },
  'world-story': {
    prerequisites: ['기존 세계·맵 연결·사건 플래그·주민·상점과 영향을 받을 전체 이벤트를 읽는다.'],
    read: ['get_story_state'], verify: ['get_story_state', 'get_event', 'check_reachability', 'run_lint', 'play_walkthrough'],
    cautions: ['원인 행동이 실제로 완료된 뒤만 세계 플래그를 바꾼다.', '세계 변화는 실제 통행·상품·대사·시설을 바꾸며 설명 대사만으로 완료하지 않는다.'],
  },
  'time-causality': {
    prerequisites: ['시대별 실제 mapId·왕복 출입구·공유 인과 플래그와 각 시대의 기존 상태를 읽는다.'],
    read: ['get_story_state'], verify: ['get_story_state', 'get_event', 'check_reachability', 'run_lint', 'play_walkthrough'],
    cautions: ['create_time_gate는 왕복 이동과 연출이다. 과거 행동의 미래 결과는 별도 조건 페이지·상태로 연결한다.', '시간 역설의 자동 해결이나 실시간 지형 전파를 주장하지 않는다. 시대 사이에 공유할 상태와 분리할 상태를 명시한다.'],
  },
  'loot-equipment': {
    prerequisites: ['아이템과 장비의 실제 ID·적 드롭·제작법·강화표·상점 재고와 경제 원본을 읽는다.'],
    verify: ['get_database_records', 'get_event', 'run_lint', 'play_walkthrough'],
    cautions: ['DB 아이템과 장비는 서로 다른 레코드다. 제작·드롭의 현재 스키마가 허용하는 참조만 쓴다.', '프리셋은 미리 정의한 물품·장비 조합을 쓴다. 무작위 옵션·세트 효과·장비 인스턴스 엔진을 발명하지 않는다.'],
  },
  'repeat-challenge': {
    prerequisites: ['반복 범위·입장 비용·정산 지점·실패 복귀·최고 기록과 실제 적·부대를 읽는다.'],
    read: ['get_story_state'], verify: ['get_event', 'run_lint', 'simulate_battle', 'play_walkthrough'],
    cautions: ['입장·성공·실패·재도전의 상태를 분리하고 재진입으로 비용이나 보상을 복제하지 않는다.', '미리 저작한 층·변형·적 구성을 사용한다. 절차 생성·서버 주간 리셋·시간표만으로 자동 웨이브를 구현했다고 주장하지 않는다.'],
  },
  endings: {
    prerequisites: ['기존 엔딩 전체·조건·우선순위·클리어 기록·뉴 게임 플러스 이월 설정을 읽는다.'],
    read: ['list_endings', 'get_story_state'], verify: ['list_endings', 'get_event', 'run_lint', 'play_walkthrough'],
    cautions: ['끝났다는 대사 대신 실제 triggerEnding 경로를 작성한다. 조건 중첩과 기본 엔딩을 확인한다.', '뉴 게임 플러스가 이월하는 필드는 levels/skills/equipment/inventory/gold다. 스위치·변수·상자·맵 상태가 이월된다고 주장하지 않는다.'],
  },
};
export const AUTHORING_PRESET_RULES = [
  '최신 사용자 원문과 편집 범위가 우선한다. 필요한 패턴만 적용하고 요청하지 않은 퀘스트·보스·장르 시스템을 추가하지 않는다.',
  '제작·수정 요청에 맞는 프리셋은 조수가 선택한다. 사용자가 프리셋 이름을 모르거나 메뉴에서 선택하지 않아도 요청의 행동에 맞게 조회한다. 여러 패턴이 필요하면 각 지침을 읽고 공통 인물·아이템·상태를 재사용해 조합한다.',
  '조회한 ID와 현재 도구 스키마만 쓴다. 없는 도구 인자는 find_tools로 확인하며 상태 이름을 임의의 엔진 필드로 쓰지 않는다.',
  '기존 전체 페이지와 참조 데이터를 먼저 읽고 관련 부분만 병합한다. 같은 대상의 후속 작업은 최신 결과에서 시작한다.',
  '정상·실패·취소·재방문에서 실제 입력과 상태 변화의 근거를 기록한다. 아직 실행하지 않은 checks는 미검증이다.',
  '게임 콘텐츠 완료는 연결된 SQLite 저장 서비스에 저장하고 같은 대상을 재로드한 뒤 보고한다. 메모리 프리뷰는 정본 저장이 아니다.',
] as const;
type StepInput = readonly [title: string, action: string, output: string, tools: readonly string[]];
function preset(category: AuthoringPresetCategory, id: string, title: string, description: string, example: string,
  tags: readonly string[], states: readonly string[], steps: readonly StepInput[], checks: readonly string[], cautions: readonly string[] = []): AuthoringPreset {
  const group = groups[category];
  const read = [...new Set([...sharedReads, ...(group.read ?? [])])];
  return { id, version: 1, category, title, description, example, tags,
    prerequisites: group.prerequisites, states,
    steps: steps.map(([stepTitle, action, output, tools]) => ({ title: stepTitle, action, output, tools })),
    checks, cautions: [...group.cautions, ...cautions],
    tools: { read, write: [...new Set(steps.flatMap(step => [...step[3]]))].filter(name => !read.includes(name)), verify: group.verify },
  };
}
export type PresetFactory = typeof preset;

export const AUTHORING_PRESETS: readonly AuthoringPreset[] = [
  preset('exploration', 'keyed-route', '열쇠와 잠긴 통로', '열쇠를 발견해 잠긴 문을 열고 다음 공간으로 이동한다.',
    '창고에서 녹슨 열쇠를 찾아 지하 수로의 문을 열고, 돌아올 때는 열린 문으로 통과한다.', ['열쇠', '문', '잠금', '통로', 'key', 'gate'],
    ['열쇠: 미소지 → 소지 → 소비 여부에 따른 유지', '문: 잠김 → 영구 개방'], [
      ['잠금의 단서', '문 앞에서 필요한 열쇠와 찾을 장소를 알려 주고 상호작용할 접근칸을 확보한다.', '잠긴 이유를 알 수 있는 문', ['place_examine_hotspots']],
      ['열쇠 발견', '기존 아이템을 재사용하거나 upsert_item으로 등록한 뒤 일회성 상자에 넣는다.', '한 번만 얻는 실제 열쇠', ['upsert_item', 'place_chest']],
      ['문 개방과 이동', 'compile_puzzle kind:item-gate에 실제 requiredItemId와 consumeItem을 정한다. 해결 스위치로 문 통행을 바꾸고 다른 맵이면 왕복 이동을 연결한다.', '열쇠 검사·개방 플래그·왕복 출입', ['compile_puzzle', 'create_transfer_pair', 'upsert_event']],
    ], ['열쇠 없이 문이 열리지 않는다.', '열쇠 획득 후 통과하고 재방문해도 열린 상태를 유지한다.', '열쇠 소비와 상자 중복 획득 여부가 정한 정책과 같다.']),
  preset('exploration', 'switch-order', '단서 순서 장치', '환경의 단서를 읽고 정해진 순서로 장치를 작동한다.',
    '벽화의 새벽·낮·밤 문양을 보고 세 석상을 같은 순서로 누르면 봉인문이 열린다.', ['순서', '스위치', '벽화', 'sequence'],
    ['진행: 초기 → 부분 입력 → 성공', '오입력: 초기화 또는 재시도', '통로: 봉인 → 개방'], [
      ['순서의 근거', '해답이 유추되는 문양과 조사 대사를 배치하고 각 입력 위치를 접근 가능하게 한다.', '플레이어가 읽을 수 있는 규칙', ['place_examine_hotspots']],
      ['순서 판정', 'compile_puzzle kind:switch-sequence의 nodes/order와 reset 정책을 작성한다. onSolve.setSwitch로 실제 해결 플래그를 연결한다.', '순서 입력과 오입력 복구', ['compile_puzzle']],
      ['개방의 피드백', '해결 플래그로 문 페이지·통행을 바꾸고 소리와 확인 대사를 붙인다.', '해결 직후 보이는 개방 결과', ['upsert_event']],
    ], ['단서만으로 순서를 알아낼 수 있다.', '틀린 순서 뒤 처음부터 다시 풀 수 있다.', '정답 이후 재입력해도 통로가 다시 잠기거나 보상이 중복되지 않는다.']),
  preset('exploration', 'pressure-plates', '발판과 봉인 해제', '발판 조건을 충족해 봉인을 풀고 지나간다.',
    '유적의 두 발판을 작동하면 가운데 문이 열린다. 실패하면 장치를 초기화해 다시 시도한다.', ['발판', '밀기', '압력', 'plate', 'push'],
    ['발판: 미충족 → 조건 충족', '봉인: 유지 → 해제', '재시도: 초기 상태 복원'], [
      ['발판 공간', '발판·문·초기화 위치를 정하고 진입·회전·복귀 공간과 단서를 마련한다.', '접근 가능한 퍼즐 무대', ['place_examine_hotspots']],
      ['발판 컴파일', 'compile_puzzle kind:push-switches의 현재 스키마로 plates와 해결 조건을 작성하고 reset 동작을 연결한다.', '실제 판정되는 발판 이벤트', ['compile_puzzle']],
      ['해제와 복구', '해결 플래그로 문을 열고 재시작 시 필요한 상태만 초기화한다.', '봉인 해제와 복구 경로', ['upsert_event']],
    ], ['조건 미충족 상태에서 출구가 열리지 않는다.', '모든 조건을 충족하면 실제로 통과한다.', '초기화 뒤 다시 해결할 수 있다.'],
    ['push-switches가 자유 상자 물리나 임의 무게 시뮬레이션을 보장하는 것은 아니다. 현재 컴파일러의 발판 규칙만 사용한다.']),
  preset('exploration', 'return-shortcut', '귀환 지름길', '멀리 돌아 도착한 곳에서 출발지로 돌아오는 지름길을 연다.',
    '산길을 돌아 탑에 도착하면 안쪽 빗장을 풀어 마을 쪽 문으로 바로 돌아갈 수 있다.', ['지름길', '귀환', '빗장', 'shortcut'],
    ['빗장: 잠김 → 안쪽에서 해제', '출발지 경로: 차단 → 왕복 가능'], [
      ['두 경로 연결', '원래 탐험 경로와 아직 잠긴 귀환 경로의 양쪽 진입 위치를 정한다.', '장거리 경로와 지름길 입출구', ['create_transfer_pair']],
      ['안쪽에서 해금', 'declare_story_flag로 기존 또는 새 개방 플래그를 등록하고 안쪽 레버만 그 플래그를 바꾸게 한다.', '안쪽에서만 가능한 해금', ['declare_story_flag', 'upsert_event']],
      ['양방향 개방', '같은 플래그로 두 출입구의 조건 페이지와 통행을 연결하고 재진입 시 보존한다.', '계속 사용할 수 있는 귀환로', ['upsert_event']],
    ], ['해금 전 출발지에서 지름길을 쓸 수 없다.', '안쪽 레버 작동 뒤 양방향으로 통과한다.', '재방문해도 빗장이 다시 잠기지 않는다.']),
  preset('exploration', 'optional-cache', '샛길과 숨은 보상', '주 경로 밖의 단서를 따라 선택 보상을 발견한다.',
    '낡은 표지의 화살표를 따라 숲 샛길로 들어가면 여행자의 보급 상자를 찾는다.', ['샛길', '숨은', '보물', '선택 탐험', 'cache'],
    ['보상: 미발견 → 일회 획득', '주 경로: 탐색 여부와 무관하게 진행 가능'], [
      ['발견의 단서', '표지와 소품 조사로 샛길 존재를 드러낸다. 주 경로를 막지 않는다.', '선택할 수 있는 탐험 단서', ['place_examine_hotspots']],
      ['샛길 진입과 귀환', '다른 맵이면 왕복 이동 이벤트를 연결하고 되돌아오는 위치를 확보한다.', '막히지 않는 선택 경로', ['create_transfer_pair']],
      ['일회 보상', '실제 아이템·수량을 상자에 넣고 이미 열린 상태의 재조사 대사를 작성한다.', '일회성 보상과 열린 상자', ['place_chest']],
    ], ['샛길을 지나쳐도 주 경로를 진행할 수 있다.', '발견·획득·원래 경로 복귀를 실제로 실행한다.', '반복 조사해도 아이템이 추가되지 않는다.']),
  preset('exploration', 'checkpoint-hazard', '위험 구간과 체크포인트', '실패하면 가까운 체크포인트에서 다시 시도한다.',
    '무너지는 수로를 건너며 함정에 닿으면 입구의 안전 지점으로 돌아와 재도전한다.', ['함정', '체크포인트', '재도전', 'hazard'],
    ['체크포인트: 미등록 → 안전 위치 등록', '시도: 진입 → 실패 복귀 또는 출구 도착'], [
      ['안전 지점', 'place_trap의 checkpoint 관례와 현재 스키마로 실제 안전 좌표를 설정한다. 세이브가 필요할 때만 별도 지점을 둔다.', '도달 가능한 복귀 지점', ['place_trap']],
      ['위험과 경고', '위험 위치·피해·실패 복귀를 place_trap으로 연결하고 조사 대사로 규칙을 알린다.', '예고된 위험과 재도전 경로', ['place_trap', 'place_examine_hotspots']],
      ['출구와 조작 복귀', '출구 이동과 실패 분기 모두 입력·카메라·이동을 되돌린다.', '성공과 실패 뒤 정상 조작', ['upsert_event', 'create_transfer_pair']],
    ], ['체크포인트까지 안전하게 도착한다.', '함정 실패 뒤 안전 지점에서 다시 조작할 수 있다.', '출구에 도착하고 실패 재시도가 진행 플래그를 망가뜨리지 않는다.']),

  preset('npc-life', 'workday', '출근과 귀가', '한 주민이 시간에 따라 집과 일터에서 생활한다.',
    '제빵사는 아침부터 저녁까지 가게에 있고 밤에는 집에서 다음 날을 준비한다.', ['출근', '귀가', '일과', '시간표', 'work'],
    ['활동: 집 → 일터 → 집', '대사: 활동과 시간대에 맞춰 전환'], [
      ['시간과 장소', 'configure_time_system으로 필요한 시간 흐름을 켜고 집·일터의 접근 가능 위치를 정한다.', '확인할 수 있는 하루 시간', ['configure_time_system']],
      ['한 인물의 일과', '기존 NPC는 set_npc_schedule로, 신규 주민은 make_villager dailyRoutine으로 집·workAt·workHours를 연결한다.', '복제 없는 하루 시간표', ['set_npc_schedule', 'make_villager']],
      ['활동별 대사', 'make_villager의 dialogue.when.npcActivity 또는 조건 페이지로 근무·퇴근 대사를 연결한다.', '현재 활동에 맞는 대화', ['make_villager']],
    ], ['출근 직전·근무 시작·퇴근 뒤 실제 위치와 대사를 확인한다.', '시간 경계에서 NPC가 두 명으로 보이지 않는다.', '다음 날 다시 같은 일과를 수행하며 원래 대사 분기를 보존한다.']),
  preset('npc-life', 'guard-patrol', '경비의 순찰과 교대', '시간별 초소를 순찰하고 근무 상태에 맞게 응답한다.',
    '경비는 낮에 성문을 지키고 저녁에는 시장 초소로 옮기며 밤에는 숙소에서 쉰다.', ['경비', '순찰', '교대', 'patrol'],
    ['근무지: 성문 → 시장 → 숙소', '활동: 경계 → 순찰 → 휴식'], [
      ['초소와 시간', '시간 시스템을 켜고 각 시간 구간과 초소 위치를 정한다. 구간 중첩과 빈 시간 정책을 명시한다.', '명확한 근무 구간', ['configure_time_system']],
      ['시간표 작성', '동일 eventId에 set_npc_schedule로 hourRange·at·activity를 연결한다.', '시간에 따라 바뀌는 근무 위치', ['set_npc_schedule']],
      ['경계와 대사', '고정 근무는 movement:fixed로 두고 활동 조건 대사를 작성한다. 연속 순찰을 요청한 경우만 현재 이동 명령 스키마로 경로를 추가한다.', '활동별 대사와 명시한 이동 방식', ['make_villager', 'upsert_event']],
    ], ['모든 근무 구간에서 접근해 대화할 수 있다.', '시간 경계에서 원래 초소가 중복 인물로 남지 않는다.', '시간표 위치 갱신과 연속 순찰을 구분해 보고한다.']),
  preset('npc-life', 'night-shop', '밤에 여는 상점', '주인이 밤에 영업하고 낮에는 다른 반응을 보인다.',
    '항구의 야간 약상은 밤에만 약을 팔고 낮에는 가게 앞에서 영업 시간을 알려 준다.', ['야간', '영업', '상점', 'night', 'shop'],
    ['영업: 닫힘 ↔ 열림', '재고와 골드: 실제 거래 때만 변경'], [
      ['영업 시간', '시간 시스템과 기다리기 경로를 마련하고 NPC의 시간표·활동 이름을 정한다.', '낮과 밤을 바꿀 수 있는 플레이', ['configure_time_system', 'set_npc_schedule']],
      ['실제 재고', '조회한 아이템과 가격을 set_shop_stock에 넣고 기존 재고 중 요청과 무관한 항목을 보존한다.', '실제 구매 가능한 상품', ['set_shop_stock']],
      ['열림과 닫힘', 'make_villager pages 또는 upsert_event 전체 페이지 병합으로 실제 timePhase 조건이 영업 분기를 선택하게 한다. 낮에는 상점 명령을 실행하지 않는다.', '시간 조건이 있는 영업 이벤트', ['make_villager', 'upsert_event']],
    ], ['낮에 구매 명령이 열리지 않는다.', '밤에 정상 구매 후 아이템·골드가 바뀐다.', '취소·잔액 부족·낮 재방문에서 거래가 발생하지 않는다.']),
  preset('npc-life', 'seasonal-visitor', '계절에 따라 찾아오는 손님', '한 인물이 계절에 맞는 위치와 대사를 갖는다.',
    '씨앗 상인은 봄에는 밭 근처에서 종자를 소개하고 겨울에는 여관에서 내년 계획을 이야기한다.', ['계절', '손님', '방문', 'season'],
    ['계절: 실제 시간 시스템의 현재 계절', '방문 활동: 해당 계절의 장소·반응'], [
      ['계절 흐름', 'configure_time_system의 daysPerSeason을 현재 프로젝트와 맞추고 계절을 확인할 플레이 경로를 둔다.', '실제 계절을 가진 시간', ['configure_time_system']],
      ['계절 위치', '한 eventId의 시간표에 season 조건과 at·activity를 지정한다. 방문하지 않는 계절의 위치·대사도 정한다.', '계절마다 한 명인 손님', ['set_npc_schedule']],
      ['계절 반응', 'make_villager dialogue.when.season 또는 활동 조건으로 현재 계절의 대사를 연결한다.', '계절을 설명하는 실제 대사', ['make_villager']],
    ], ['서로 다른 두 계절에서 위치·대사가 달라진다.', '원래 계절로 돌아가도 중복 NPC가 생기지 않는다.', '연결되지 않은 계절에 인물이 통행 불가 칸으로 사라지지 않는다.']),
  preset('npc-life', 'progress-reactions', '사건 뒤 달라지는 주민 반응', '세계의 실제 진행 상태에 따라 주민 대사가 바뀐다.',
    '다리를 복구하기 전에는 주민들이 불편을 말하고 복구 뒤에는 시장에 갈 수 있게 된 일을 이야기한다.', ['반응', '진행', '세계 변화', 'reaction'],
    ['사건 상태: 이전 → 해결', '주민 대사: 기본 → 해결 후', '원래 퀘스트 분기: 유지'], [
      ['사건 플래그', '기존 완료 스위치를 조회해 재사용하고 없을 때만 declare_story_flag로 의미를 등록한다.', '사건과 연결된 실제 플래그', ['declare_story_flag']],
      ['전후 페이지', 'get_event로 읽은 전체 페이지에 기본·해결 후 조건 대사를 병합한다. 기존 페이지 ID와 다른 조건을 유지한다.', '진행에 반응하는 한 NPC', ['upsert_event']],
      ['사건에 연결', '실제 해결 행동에서만 플래그를 바꾸고 필요하면 author_npc_cast로 여러 주민의 반응을 일관되게 구성한다.', '사건 결과와 주민 반응의 연결', ['upsert_event', 'author_npc_cast']],
    ], ['사건 전에는 해결 후 대사가 나오지 않는다.', '실제 해결 뒤 각 주민의 후속 대사를 확인한다.', '재대화로 사건 보상을 다시 지급하거나 기존 퀘스트 분기가 없어지지 않는다.']),
  preset('npc-life', 'activity-dialogue', '활동에 맞는 대화', '같은 주민이 지금 하는 일에 맞춰 다른 말을 한다.',
    '어부는 강가에서 고기를 잡을 때와 시장에서 생선을 팔 때 서로 다른 이야기를 한다.', ['활동', '대사', '생활감', 'activity'],
    ['활동: 낚시 ↔ 판매 ↔ 휴식', '대화: 현재 활동 조건에 따라 선택'], [
      ['활동 시간표', '실제 시간 흐름과 장소에 맞춰 activity 이름이 있는 시간표를 작성한다.', '실행되는 활동 상태', ['configure_time_system', 'set_npc_schedule']],
      ['활동 조건 대사', 'make_villager dialogue.when.npcActivity를 시간표의 실제 activity와 정확히 맞추고 기본 대사도 둔다.', '활동별 다른 대화', ['make_villager']],
      ['기존 반응 병합', '인사·진행·완료 페이지의 우선순위를 확인해 활동 대사가 기존 필수 반응을 가리지 않게 한다.', '누락 없는 페이지 순서', ['upsert_event']],
    ], ['각 활동 위치에서 맞는 대사가 나온다.', '시간표에 없는 활동에서 기본 대사로 복구된다.', '활동 대화가 원래 이벤트 상태나 보상을 바꾸지 않는다.']),

  preset('life-economy', 'craft-and-sell', '재료를 만들어 판매하기', '실제 재료를 소비해 만든 물건을 팔아 골드를 얻는다.',
    '모은 약초 두 개로 회복약을 만들고 시장에서 판매해 다음 재료를 산다.', ['제작', '판매', '재료', 'craft', 'sell'],
    ['재료: 소지 → 제작 시 소비', '결과물: 제작 성공 때 증가 → 판매 시 감소', '골드: 판매 때 증가'], [
      ['물품과 제작법', '재료·결과 아이템을 조회 또는 등록하고 upsert_craft_recipe에 실제 수량과 outputItemId를 연결한다.', '실제 재료와 결과물의 제작법', ['upsert_item', 'upsert_craft_recipe']],
      ['제작 상호작용', '현재 제작 명령 스키마로 작업대 이벤트를 연결하고 재료 부족·취소 결과를 분리한다.', '플레이어가 이용할 제작대', ['upsert_event']],
      ['판매와 가격', 'set_sell_prices로 매각 가격을 정하고 실제 상점 상호작용으로 판매를 연결한다.', '물품과 골드가 변하는 거래', ['set_sell_prices', 'make_villager']],
    ], ['정확한 재료 수량을 소비하고 지정한 결과 수량을 얻는다.', '부족·취소 때 재료와 결과물이 그대로다.', '판매 시 결과물과 골드 변화가 가격·수량과 일치한다.']),
  preset('life-economy', 'crop-shipping', '작물을 키워 출하하기', '심기·성장·수확·출하가 실제 날짜와 물품 변화로 이어진다.',
    '봄 씨앗을 심고 돌봐 수확한 작물을 출하 상자에 넣어 다음 날 수입을 받는다.', ['농장', '작물', '재배', '출하', 'crop'],
    ['밭: 빈 칸 → 심음 → 성장 → 수확', '출하품: 소지 → 출하', '정산: 미정산 → 하루 종료 후 지급'], [
      ['시간과 작물', 'define_crop으로 씨앗·수확 아이템·성장일·계절을 현재 스키마에 맞춰 등록하고 시간 흐름을 연결한다.', '실제 성장 규칙을 가진 작물', ['upsert_item', 'define_crop', 'configure_time_system']],
      ['밭과 상호작용', 'upsert_tool_action과 실제 밭·도구 상호작용을 연결하고 초기 밭 상태가 필요할 때만 set_session_farm_state를 쓴다.', '심고 돌볼 수 있는 밭', ['upsert_tool_action', 'set_session_farm_state', 'upsert_event']],
      ['출하와 정산', 'configure_life_economy shipping과 판매 가격을 설정하고 출하·잠자기 명령을 실제 이벤트에 연결한다.', '수확부터 다음 날 수입까지의 흐름', ['configure_life_economy', 'set_sell_prices', 'upsert_event']],
    ], ['씨앗 소비와 날짜에 따른 성장·수확을 확인한다.', '출하 후 소지품 감소와 다음 날 실제 골드를 확인한다.', '재조사·재진입·정산 반복으로 수확이나 수입이 중복되지 않는다.']),
  preset('life-economy', 'fish-museum', '낚시와 박물관 기증', '잡은 물고기를 실제 소지품과 전시 기록에 연결한다.',
    '강에서 잡은 첫 물고기를 박물관에 기증하고 다시 찾아가 전시 내용을 확인한다.', ['낚시', '박물관', '기증', 'fish', 'museum'],
    ['물고기: 미소지 → 포획 → 기증 소비', '기증 기록: 없음 → 등록', '전시: 미등록 → 표시'], [
      ['물고기와 낚시', 'read_authoring_preset의 현재 어종 원본과 실제 아이템을 읽는다. upsert_fish_species로 연결하고 configure_fishing의 수역·시간·도구 요구를 정한다.', '가능한 낚시와 실제 획득품', ['upsert_item', 'upsert_fish_species', 'configure_fishing']],
      ['낚시 지점', '현재 낚시 명령으로 접근 가능한 물가 이벤트를 작성하고 실패·취소를 소비 정책과 맞춘다.', '플레이어가 낚시할 위치', ['upsert_event']],
      ['박물관과 전시', 'configure_museum에 실제 기증 아이템을 등록하고 기증·전시 조회 상호작용을 연결한다.', '기증 기록과 재방문 전시', ['configure_museum', 'upsert_event']],
    ], ['실제 포획 결과가 소지품에 반영된다.', '기증 성공 시 정한 수량이 소비되고 전시가 바뀐다.', '미소지·취소·이미 기증한 물품은 기록과 보상을 중복하지 않는다.']),
  preset('life-economy', 'season-forage', '계절 채집과 수집 기록', '계절별 채집물을 발견하고 실제 수집 기록을 남긴다.',
    '봄에는 강가의 새싹, 가을에는 숲의 버섯을 모아 수집 목록을 채운다.', ['채집', '계절', '수집', 'forage'],
    ['채집 지점: 가능 → 획득 → 재생 정책 대기', '수집 기록: 미발견 → 발견', '계절: 실제 시간에 따라 변화'], [
      ['계절과 재료', '아이템과 시간 규칙을 읽고 configure_seasonal_forage에 실제 계절별 아이템을 등록한다.', '계절별 채집 정의', ['upsert_item', 'configure_time_system', 'configure_seasonal_forage']],
      ['채집 상호작용', '현재 채집 명령으로 실제 조사 지점과 초기화 주기를 연결한다. 설정만 하고 끝내지 않는다.', '획득 가능한 계절 채집물', ['upsert_event']],
      ['수집 결과', 'configure_collections로 수집 그룹과 기록 열람을 연결하고 현재 아이템의 발견이 기록에 반영되게 한다.', '플레이어가 읽는 수집 기록', ['configure_collections', 'upsert_event']],
    ], ['해당 계절의 채집 성공과 소지품 증가를 확인한다.', '다른 계절·이미 채집한 지점에서 정한 정책대로 제한된다.', '기록 열람과 재생 주기 뒤 재채집이 실제 상태와 일치한다.']),
  preset('life-economy', 'maker-processing', '가공 설비 운영', '재료를 설비에 넣고 시간이 지난 뒤 가공품을 받는다.',
    '수확한 과일을 가공 설비에 넣어 기다린 뒤 잼을 꺼내 판매한다.', ['가공', '설비', '대기', 'maker'],
    ['설비: 비어 있음 → 가공 중 → 완료 → 비어 있음', '재료: 투입 시 소비', '가공품: 수령 성공 때만 지급'], [
      ['가공법과 시간', '실제 재료·결과 아이템과 recipeId를 등록하고 현재 가공 시간 단위를 스키마에서 확인한다.', '존재하는 가공 제작법', ['upsert_item', 'upsert_craft_recipe', 'configure_time_system']],
      ['설비 정의', 'configure_life_economy makers를 기존 전체 목록과 병합해 등록한다.', '기존 설비를 보존한 새 가공기', ['configure_life_economy']],
      ['투입·대기·수령', '실제 maker 상호작용 명령을 이벤트에 연결해 가공 중 안내와 완료 수령을 구분한다.', '플레이 가능한 설비 한 사이클', ['upsert_event', 'set_sell_prices']],
    ], ['투입 때만 재료가 소비되고 가공 중 중복 투입되지 않는다.', '시간 경과 뒤 정확한 가공품을 받는다.', '완료 수령 반복·취소·재진입으로 재료나 가공품이 복제되지 않는다.']),
  preset('life-economy', 'bundle-unlock', '꾸러미로 지역 해금', '실제 물품을 기부해 목표를 채우고 새 지역을 연다.',
    '수리소에 목재와 철을 기부하면 다리를 복구해 강 건너 시장으로 갈 수 있다.', ['꾸러미', '기부', '해금', '경제', 'bundle'],
    ['기부량: 미충족 → 누적 → 목표 충족', '지역: 잠김 → 해금', '보상: 미지급 → 일회 지급'], [
      ['요구품과 해금 대상', '필요한 아이템·수량·기존 지역·스위치를 조회하고 실제 통로를 정한다.', '참조 가능한 재료와 지역', ['upsert_item', 'declare_story_flag']],
      ['꾸러미 정의', 'configure_life_economy에 worldUnlocks를 먼저 등록하고 bundles를 전체 목록과 병합해 연결한다.', '누적 기부와 해금 규칙', ['configure_life_economy']],
      ['기부와 이동', '실제 기부 명령과 완료 후 통로 페이지를 작성하고 이동·귀환을 연결한다.', '기부해서 열리는 실제 지역', ['upsert_event', 'create_transfer_pair']],
    ], ['부분 기부에서는 지역이 잠겨 있다.', '목표 수량 기부 후 소지품이 줄고 통로가 열린다.', '초과 기부·취소·완료 후 재방문에서 중복 소비와 보상이 없다.']),

  preset('combat', 'intro-duel', '첫 전투로 규칙 익히기', '작은 전투로 기본 행동과 승패·복귀를 익힌다.',
    '수련장에서 약한 허수아비와 싸워 공격과 회복을 익히고 원래 위치로 돌아온다.', ['첫 전투', '튜토리얼', '수련', 'intro'],
    ['전투: 준비 → 진행 → 승리·패배·도주', '보상: 승리 정책에 따라 지급', '조작: 종료 뒤 필드 복구'], [
      ['파티와 기술', '현재 파티의 실제 기술·장비와 사용할 회복 수단을 읽고 필요한 항목만 보강한다.', '첫 전투에서 실제로 쓸 행동', ['upsert_skill', 'upsert_item']],
      ['작은 적과 부대', '실제 적·부대를 구성하고 현재 파티가 규칙을 확인할 수 있는 난도로 맞춘다.', '학습 가능한 전투 구성', ['upsert_enemy', 'upsert_troop']],
      ['도전과 복귀', '현재 battleProcessing 스키마로 승리·패배·도주 분기를 작성하고 종료 뒤 위치·입력을 복구한다.', '모든 결과가 연결된 도전 이벤트', ['upsert_event']],
    ], ['예정한 파티·기술·적이 실제 전투에 나온다.', '공격·회복·승리 뒤 정한 보상과 필드 복귀를 확인한다.', '패배·도주·재도전에서 조작과 보상이 정한 정책을 따른다.']),
  preset('combat', 'enemy-roles', '역할이 다른 적 조합', '공격·방어·회복 역할을 구분해 대응 순서를 고민하게 한다.',
    '방패병 뒤의 치료사를 먼저 상대할지, 공격수를 빨리 쓰러뜨릴지 고르는 전투를 만든다.', ['역할', '조합', '회복', '지원', 'roles'],
    ['적 역할: 공격·방어·지원', '전투 진행: 대상 선택과 행동 결과로 변화'], [
      ['역할 기술', '현재 스킬 효과로 공격·방어·회복 행동을 구성하고 사용할 실제 skillId를 정한다.', '구별되는 역할 기술', ['upsert_skill', 'upsert_state']],
      ['적의 행동', 'upsert_enemy의 실제 행동 조건과 우선순위로 각 적에게 역할을 부여한다.', '다른 행동을 하는 적들', ['upsert_enemy']],
      ['부대와 도전', 'upsert_troop으로 조합하고 필드 도전 이벤트를 연결한다. 표시 위치를 실제 전투 화면에서 확인한다.', '선택할 이유가 있는 전투', ['upsert_troop', 'upsert_event']],
    ], ['각 적의 실제 행동이 정한 역할과 일치한다.', '다른 대상 순서를 선택했을 때 의미 있는 전투 결과 차이가 있다.', '특정 파티만으로 불가능한 전투를 만들지 않으며 패배·도주 분기를 확인한다.'],
    ['특정 적이 다른 적을 반드시 대신 맞는 보호 규칙은 현재 엔진·스키마가 지원할 때만 쓴다. 역할 이름만으로 그런 규칙을 주장하지 않는다.']),
  preset('combat', 'status-counter', '상태 이상에 대응하는 전투', '상태를 알아보고 해제·예방 수단을 써서 싸운다.',
    '독을 쓰는 괴물을 상대하며 해독제와 회복 기술의 사용 시점을 고르게 한다.', ['상태 이상', '독', '해제', '대응', 'status'],
    ['상태: 정상 → 적용 → 해제 또는 종료', '해제 자원: 사용 성공 때 소비'], [
      ['상태와 대응', '실제 상태 효과·지속·해제 규칙을 읽고 필요한 상태·해제 기술·아이템을 맞춘다.', '실제로 적용·해제 가능한 상태', ['upsert_state', 'upsert_skill', 'upsert_item']],
      ['적의 적용 행동', '상태 적용 행동을 가진 적과 부대를 작성하고 명중·저항·빈도를 현재 스키마로 정한다.', '상태를 사용하는 적', ['upsert_enemy', 'upsert_troop']],
      ['예고와 도전', '전투 전 단서와 대응 수단을 연결하고 승패·도주 후 잔류 상태의 정책을 정한다.', '준비할 수 있는 도전', ['upsert_event']],
    ], ['적 행동으로 실제 상태가 적용된다.', '지정한 대응 수단이 상태를 해제하고 자원을 정확히 소비한다.', '상태 중복·기술 실패·전투 종료 뒤 상태와 필드 복귀가 정책과 같다.']),
  preset('combat', 'resource-gauntlet', '자원을 관리하는 연전', '여러 전투 사이에 회복과 자원을 관리한다.',
    '세 번의 수련을 통과하며 회복약을 아껴 쓰고 중간 휴식 여부를 선택한다.', ['연전', '자원', '회복', 'gauntlet'],
    ['진행: 첫 전투 → 다음 전투 → 종료', '자원: 전투·회복으로 변화하며 자동 초기화 금지', '재도전: 정한 시작 단계와 회복 정책'], [
      ['단계별 부대', '실제 적·부대와 초기 파티 자원을 확인하고 단계마다 다른 부담을 구성한다.', '연속해서 싸울 실제 부대', ['upsert_enemy', 'upsert_troop']],
      ['단계 진행', '진행 상태를 등록하고 전투 승리만 다음 단계로 연결한다. 패배·도주 때 재시작 지점을 명시한다.', '결과에 따라 진행하는 연전', ['declare_story_flag', 'upsert_event']],
      ['휴식과 보상', '요청한 휴식 선택·실제 회복 소비와 마지막 보상을 연결한다. 첫 전투 성공을 전체 완주로 간주하지 않는다.', '자원 선택과 최종 보상', ['upsert_item', 'upsert_event']],
    ], ['이전 전투의 HP·MP·소비품이 다음 전투에 이어진다.', '모든 단계를 통과해야 최종 결과가 나온다.', '중간 패배·도주·취소 뒤 재도전과 최종 보상 중복 여부를 확인한다.']),
  preset('combat', 'boss-phases', '단계가 바뀌는 보스', 'HP나 라운드 조건으로 보스 행동과 연출이 바뀐다.',
    '갑옷 보스의 HP가 줄면 방어 자세를 풀고 더 강한 기술을 사용한다.', ['보스', '단계', '페이즈', 'boss', 'phase'],
    ['페이즈: 초기 → 조건 충족 → 다음 행동', '단계 연출: 전투당 또는 단계당 일회', '전투 종료: 승리·패배·도주'], [
      ['보스와 기술', '실제 enemyId·skillId·troopId와 현재 전투 방식을 읽고 단계별 사용할 기술을 구성한다.', '단계별 기술과 실제 보스 부대', ['upsert_skill', 'upsert_enemy', 'upsert_troop']],
      ['전환 조건', 'author_boss_phases의 현재 스키마로 HP·라운드 조건과 단계 명령을 연결한다. 추가 전투 페이지는 기존 전체 목록을 보존한다.', '조건으로 전환하는 보스 단계', ['author_boss_phases']],
      ['예고와 결과', '전환 예고·승리·패배·도주를 연결하고 전환 때 실제 행동 규칙이 달라지는지 확인한다.', '읽을 수 있는 전환과 종료', ['upsert_event']],
    ], ['조건 전에는 다음 단계가 시작되지 않는다.', '경계값과 큰 피해로 경계를 넘긴 경우 실제 단계 행동이 바뀐다.', '같은 단계 연출이 매 라운드 중복되거나 종료 뒤 필드 입력이 잠기지 않는다.']),
  preset('combat', 'optional-elite', '선택해서 도전하는 강적', '필수 진행을 막지 않는 강적과 승리 보상을 둔다.',
    '폐허의 기사에게 도전할지 선택하고 승리하면 장비를 얻는다. 거절하면 여행을 계속한다.', ['선택', '강적', '보상', 'elite'],
    ['도전: 미선택 → 전투 또는 거절', '격파: 미완료 → 완료', '보상: 승리 때 일회 지급'], [
      ['선택 강적', '현재 파티에 맞는 실제 적·부대를 작성하고 강적을 지나칠 주 경로를 확보한다.', '선택 가능한 전투 대상', ['upsert_enemy', 'upsert_troop']],
      ['도전과 거절', '도전 선택 뒤만 battleProcessing을 실행하고 거절·취소는 원래 상태로 돌아오게 한다.', '거절해도 진행 가능한 선택', ['upsert_event']],
      ['승리와 재방문', '실제 보상 아이템·완료 플래그·승리 이후 페이지를 연결한다. 패배·도주 복귀와 재도전을 별도로 작성한다.', '일회 보상과 전투 이후 반응', ['upsert_equipment', 'declare_story_flag', 'upsert_event']],
    ], ['거절·취소해도 주 경로를 진행한다.', '승리할 때 실제 보상을 한 번만 얻는다.', '패배·도주 뒤 복귀·재도전이 가능하고 승리 후 재대화로 보상이 늘지 않는다.']),
  ...additionalAuthoringPresets(preset),
];

export function authoringPresetById(id: string): AuthoringPreset | undefined {
  return AUTHORING_PRESETS.find(entry => entry.id === id);
}
export function searchAuthoringPresets(category?: AuthoringPresetCategory, query = ''): readonly AuthoringPreset[] {
  const terms = query.normalize('NFKC').trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean);
  return AUTHORING_PRESETS.filter(entry => {
    if (category && entry.category !== category) return false;
    const label = AUTHORING_PRESET_CATEGORIES.find(item => item.id === entry.category)!.label;
    const haystack = `${entry.id} ${label} ${entry.title} ${entry.description} ${entry.tags.join(' ')}`.normalize('NFKC').toLocaleLowerCase();
    return terms.every(term => haystack.includes(term));
  });
}
export function authoringPresetDiscoveryText(): string {
  return [
    `AI 조수용 플레이 작성 프리셋 ${AUTHORING_PRESETS.length}종: ${AUTHORING_PRESET_CATEGORIES.map(category => `${category.label}(${category.id})`).join(', ')}.`,
    '제작·수정 요청의 행동에 해당하는 패턴을 조수가 스스로 선택한다. 사용자가 프리셋 이름을 말하거나 메뉴에서 고를 필요는 없다. 일반 요청도 먼저 list_authoring_presets({category})로 후보를 읽고 read_authoring_preset({presetId})로 적용할 지침을 읽는다. 이미 ID를 알면 상세를 바로 읽는다.',
    '여러 행동이 필요하면 관련 프리셋을 각각 읽고 기존 인물·아이템·스위치·맵을 공유해 조합한다. 예: 야간 거래는 night-shop, 시대 인과는 past-world-change, 동료 연계는 dual-tech, 장비 강화는 equipment-upgrade, 새 회차는 new-game-plus. 사용자 범위와 현재 프로젝트에 맞는 단계만 적용한다.',
    '실제 작성 도구는 find_tools로 스키마를 확인한 뒤 호출하고 지침의 정상·실패·취소·재방문 항목을 확인한다. 설명·조회 요청은 읽기와 설명까지 수행한다. 프리셋 조회 자체는 게임 작성·검증·저장 완료가 아니다.',
  ].join('\n');
}
export function authoringPresetPrompt(id: string, idea: string, map: { id: string; name: string }): string {
  const entry = authoringPresetById(id);
  if (!entry) throw new Error('알 수 없는 플레이 프리셋입니다.');
  const category = AUTHORING_PRESET_CATEGORIES.find(item => item.id === entry.category)!;
  return [
    `「${category.label} · ${entry.title}」 프리셋으로 플레이 가능한 작은 구간을 만들어줘.`,
    `현재 맵: ${map.name} (mapId=${map.id}).`,
    `내 요청: ${idea.trim() || entry.example}`,
    `먼저 read_authoring_preset({presetId:"${entry.id}"})로 전체 작성 지침을 읽고 내 요청과 현재 프로젝트에 맞게 적용해줘.`,
    '기존 인물·맵·아이템·부대·이벤트를 먼저 읽어 재사용하고 필요한 실제 작성 도구의 스키마를 find_tools로 확인해줘.',
    '작성 순서: ' + entry.steps.map(step => step.title).join(' → ') + '.',
    '정상 진행, 실패·취소, 완료 뒤 재접근에서 실제 상태·보상·조작 복귀를 확인해줘. 요청하지 않은 퀘스트나 추가 시스템은 만들지 마.',
    '수정한 대상과 실제 확인 근거, 미검증 항목을 구분해 보고해줘. 콘텐츠 완료는 연결된 프로젝트 저장소에 저장하고 재로드한 뒤 보고해줘.',
  ].join('\n');
}
