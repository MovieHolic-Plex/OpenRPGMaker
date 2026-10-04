/** Shared by the browser intent route and the actual worker, before model prose. */
export function requestsEmeraldMonsterGame(task: string): boolean {
  const reference = /포켓몬(?:스터)?|pok[eé]mon|에메랄드|\bemerald\b|장르 프리셋:.*몬스터/iu.test(task);
  const wholeGame = /게임|캠페인|\bgame\b|\bcampaign\b|장르 프리셋:/iu.test(task);
  const action = /만들|제작|생성|개선|보수|고쳐|손봐|바꿔|바꾸|create|build|make|repair|improve|convert|update/iu.test(task);
  const question = /어떻게|무엇|뭐야|알려|설명|가능해|할 수 있|\bhow\b|\bexplain\b|\bcan (?:i|we)\b|(?:만들|제작|생성).{0,8}(?:수 있|가능)/iu.test(task);
  const excluded = /포켓몬(?:스터)?\s*(?:말고|없이)|(?:without|not)\s+pok[eé]mon/iu.test(task);
  const otherReference=/포켓몬(?:스터)?\s*(?:레드|블루|옐로|골드|실버|크리스탈|루비|사파이어|다이아|펄|플래티넘|블랙|화이트|소드|실드|레전드)|pok[eé]mon\s+(?:red|blue|yellow|gold|silver|crystal|ruby|sapphire|diamond|pearl|platinum|black|white|sword|shield|legends)|에메랄드\s*(?:말고|제외)|(?:without|not)\s+emerald/iu.test(task);
  return reference && wholeGame && action && !question && !excluded && !otherReference;
}

export const MONSTER_GAME_INITIAL_TOOLS = ['get_project_summary','read_game_systems','read_monster_game','configure_monster_style','build_monster_game','review_monster_game','review_game_systems','get_opening','review_opening','show_opening_image','find_tools'] as const;
export const MONSTER_GAME_PRODUCTION_PROMPT = `[전체 몬스터 게임 제작]
포켓몬형 전체 게임 요청은 에메랄드 참고 프로필을 기본으로 사용한다. read_monster_game/read_game_systems로 실제 현재 내용을 읽고 configure_monster_style(reference:emerald)를 적용한다.
빈 프로젝트에는 build_monster_game(mode:create)를 사용한다. 이미 캠페인이 있으면 mode:repair로 보수한다. 저작 게임을 전부 버린다고 명시한 요청만 replace:true로 전체를 교체한다. 설정 도구만 실행하거나 작은 시작 예제만 만들어 전체 게임 완료로 보고하지 않는다.
공용 전체 캠페인 생성기는72맵·60종·8체육관·리그·스토리·엔딩·후일담을 실제 보통 Project로 만든다. 사용한 원본 캠페인/그림은 재사용했다고 밝히고, 새로운 세계를 직접 설계했다고 주장하지 않는다. 보수는 기존 타일·맵 연결·로스터·시작·플레이 세션·사용자 오프닝을 보존한다. 기존 오프닝을 에메랄드 교수 소개로 바꾸라는 명시 요청이면 replaceOpening:true를 함께 준다.
교수/몬스터 소개는 실제 Enter 확인 오프닝으로 게임의 시작과 동료 선택에 이어진다. 임의 왕국/그림책 소개로 바꾸거나 선택 전 이미 동료를 소유한 장면을 만들지 않는다. get_opening/show_opening_image로 실제 연결 그림을 확인한다.
에메랄드 도트 규격: 필드 그림은16×32 원본, 인물 잉크는 주인공14×20~21픽셀, 팔레트15불투명색+투명이다. 에디터24×32는 포장 칸이며 원본을 x4 투명여백에 그대로 넣는다.24×32 인물을 그리거나 늘리지 않는다. 전투 인물/교수 소개는64×64다. 공용 검수된 그림은 build_monster_game(mode:create|repair)의 캐스트를 우선 쓰고 새로운 걷기 그림은 pokemon-character-motion 하네스의 import→check→preview→review→gate→build를 거쳐 공유팩에 등록해야 한다. 구조 통과만으로 그림 품질 승인이나 실제 플레이 완료를 주장하지 않는다. 교수의 실제 눈·입·손 모션은 configure_opening_portrait_motion으로 연결하며 Enter 페이지와 음악의 재시작으로 움직임을 대신하지 않는다.
마지막 변경 뒤 read_monster_game 및 review_monster_game, read_game_systems 및 review_game_systems, review_opening을 실제로 실행한다. 완료 검사 문제는 도구로 해결하며 전체72맵/60종 요구를 축소하지 않는다.
구조 검토는 플레이/청취/저장 검증이 아니다. 실제 이동·스타터·조우·포획·회복·상점 거래·배지·저장/Continue와 정본 저장 재로드는 별도로 확인하며 미검증 범위를 보고한다. 전투는 현재gen1 규칙이며 에메랄드의 모든 규칙을 구현했다고 말하지 않는다.`;
