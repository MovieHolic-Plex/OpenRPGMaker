/** Shared by the browser intent route and the actual worker, before model prose. */
function requestsNamedMonsterCampaign(task: string): boolean {
  const reference = /포켓몬(?:스터)?|pok[eé]mon|에메랄드|\bemerald\b|장르 프리셋:.*몬스터/iu.test(task);
  const wholeGame = /게임|캠페인|\bgame\b|\bcampaign\b|장르 프리셋:/iu.test(task);
  const action = /만들|제작|생성|개선|보수|고쳐|손봐|바꿔|바꾸|create|build|make|repair|improve|convert|update/iu.test(task);
  const question = /어떻게|무엇|뭐야|알려|설명|가능해|할 수 있|\bhow\b|\bexplain\b|\bcan (?:i|we)\b|(?:만들|제작|생성).{0,8}(?:수 있|가능)/iu.test(task);
  const excluded = /포켓몬(?:스터)?\s*(?:말고|없이)|(?:without|not)\s+pok[eé]mon/iu.test(task);
  const otherReference=/포켓몬(?:스터)?\s*(?:레드|블루|옐로|골드|실버|크리스탈|루비|사파이어|다이아|펄|플래티넘|블랙|화이트|소드|실드|레전드)|pok[eé]mon\s+(?:red|blue|yellow|gold|silver|crystal|ruby|sapphire|diamond|pearl|platinum|black|white|sword|shield|legends)|에메랄드\s*(?:말고|제외)|(?:without|not)\s+emerald/iu.test(task);
  return reference && wholeGame && action && !question && !excluded && !otherReference;
}


// ── 포켓몬 낱말 없이 말한 몬스터 수집·대회형 요청 (2026-10-14 자유도 감사 #3·#5) ─────────────────────────────
// 감사 때 「화산 섬 몬스터 수집 게임」「대회형 · 포획 없음」은 포켓몬이라는 낱말이 없어 전용 제작 경로를 못 타고 자유 경로로 빠졌고,
// 자유 경로는 칩셋이 버들항·사막·숲 섞임이었다. 몬스터를 모으거나 몬스터끼리 싸우는 게임이라는 말이 분명하면 같은 제작 경로(몬스터 칩셋·gen1 룰)로 보낸다.
// 낱말 하나가 아니라 의도 신호로 판정한다 — 「몬스터」만으로는 일반 RPG 의 적도 되므로, 몬스터를 모으고·키우고·겨루는 제도(포획·도감·체육관·진화·조련사)가 한 가지 이상 함께 있어야 한다.
// 포켓몬 낱말은 그 자체로 충분한 신호다. 헌터·서바이벌·호러·액션 같은 다른 장르의 몬스터는 건드리지 않는다.
const MONSTER_SUBJECT = /몬스터|monster|조련사|테이머|\btamer|크리처|\bcreature/iu;
const MONSTER_SYSTEM_SIGNALS: readonly RegExp[] = [
  /포획|잡아\s*(?:서|모|보)|잡을\s*수|수집|모으|\bcapture|\bcollect/iu,
  /도감|\bpok[eé]dex|\bdex\b/iu,
  /체육관|관장|\bgym\b|배지/iu,
  /진화|\bevolv/iu,
  /트레이너|조련|\btrainer/iu,
  /종\s*(?:을|를)?\s*(?:정의|추가|만들)|몬스터\s*종|\bspecies\b/iu,
  /대전|배틀|대회|토너먼트|\bbattle\b|\btournament/iu,
];
const POKEMON_WORD = /포켓몬(?:스터)?|pok[eé]mon|에메랄드|\bemerald\b/iu;
const FREE_NOT_COLLECT = /몬스터\s*헌터|monster\s*hunter|좀비|호러|공포|디펜스|서바이벌|액션\s*rpg|로그라이크|몬스터\s*(?:를|을)?\s*(?:쓰러|사냥|퇴치)/iu;

/** 몬스터 수집·육성·대전 의도가 있는가(요청 문장 기준). 포켓몬 낱말이 없어도 신호가 둘 이상 겹치면 참. */
export function hasMonsterCollectIntent(task: string): boolean {
  if (FREE_NOT_COLLECT.test(task)) return false;
  const signals = MONSTER_SYSTEM_SIGNALS.filter(re => re.test(task)).length;
  if (POKEMON_WORD.test(task)) return true;
  return MONSTER_SUBJECT.test(task) ? signals >= 1 : signals >= 2;
}

const NO_CAPTURE = /포획\s*(?:은|이|도|를)?\s*(?:없|안\s*(?:해|함|하|돼|되)|금지|하지\s*(?:않|말))|잡(?:지|을\s*수)\s*(?:않|없)|no\s*capture|without\s*captur/iu;
const TOURNAMENT = /대회|토너먼트|tournament|리그전|본선|결승|트레이너\s*대전|대전\s*중심/iu;

const NO_GYM = /체육관\s*(?:은|이|도)?\s*(?:없|제외|빼|필요\s*없)|체육관\s*없이|\bno\s+gyms?\b|without\s+(?:any\s+)?gyms?/iu;

export type MonsterGameRequestKind = 'campaign' | 'tournament' | 'expedition' | null;

/**
 * 몬스터 게임 제작 요청의 종류. tournament = 포획 없는 대회형(build_monster_tournament), campaign = 수집·체육관 캠페인(build_monster_game).
 * blank = 비어 있는 새 프로젝트 — 「…게임이야」처럼 동사 없이 설명만 하는 새 게임 소개를 요청으로 받아들이는 근거(저작된 게임에는 쓰지 않는다).
 */
export function classifyMonsterGameRequest(task: string, blank = false): MonsterGameRequestKind {
  const question = /어떻게|무엇|뭐야|알려|설명|가능해|할 수 있|\bhow\b|\bexplain\b|\bcan (?:i|we)\b|(?:만들|제작|생성).{0,8}(?:수 있|가능)/iu.test(task);
  if (question) return null;
  const wholeGame = /게임|캠페인|\bgame\b|\bcampaign\b|장르 프리셋:/iu.test(task);
  const action = /만들|제작|생성|개선|보수|고쳐|손봐|바꿔|바꾸|create|build|make|repair|improve|convert|update/iu.test(task);
  const monsterish = hasMonsterCollectIntent(task);
  const pokemonish = POKEMON_WORD.test(task);
  if (!wholeGame || !(action || blank)) return pokemonish && requestsNamedMonsterCampaign(task) && !TOURNAMENT.test(task) && !NO_CAPTURE.test(task) ? 'campaign' : null;
  if (!monsterish && !pokemonish) return null;
  if (TOURNAMENT.test(task) || NO_CAPTURE.test(task)) return 'tournament';
  if (NO_GYM.test(task)) return 'expedition';
  if (pokemonish) return requestsNamedMonsterCampaign(task) ? 'campaign' : null;
  return 'campaign';
}

/** 포켓몬·에메랄드를 말한 전체 게임 제작(대회형·포획 없음 요청은 제외 — 그쪽은 build_monster_tournament). */
export function requestsEmeraldMonsterGame(task: string): boolean {
  return requestsNamedMonsterCampaign(task) && !TOURNAMENT.test(task) && !NO_CAPTURE.test(task);
}

const KOREAN_COUNTS: Readonly<Record<string, number>> = { 한: 1, 하나: 1, 두: 2, 둘: 2, 세: 3, 셋: 3, 네: 4, 넷: 4, 다섯: 5, 여섯: 6, 일곱: 7, 여덟: 8 };
const COUNT = String.raw`(\d{1,4}|한|하나|두|둘|세|셋|네|넷|다섯|여섯|일곱|여덟)`;
const countOf = (raw: string | undefined): number | undefined => raw === undefined ? undefined : /^\d+$/u.test(raw) ? Number(raw) : KOREAN_COUNTS[raw];

/** 요청에 적힌 캠페인 규모. 없으면 해당 키가 없다 — 없는 값을 지어내지 않는다(기본 캠페인은 그대로). */
export interface MonsterCampaignRequestScale {
  /** 체육관(=배지) 수. 「체육관 없이」는 0. */
  readonly gymCount?: number;
  readonly speciesCount?: number;
  readonly mapCount?: number;
}

/** 사용자가 쓴 글만 본다 — 의도 메모·시스템 프롬프트(이 파일의 지침 문장)가 task 에 덧붙어 와도 거기 적힌 예시(「체육관 없이」「8개→5개」)를 요청으로 읽지 않는다. */
function userText(task: string): string {
  // 지침 문단(`[전체 몬스터 게임 제작]` … 다음 빈 줄까지)과 규모 한 줄을 통째로 뺀다 — 앞에 붙든 뒤에 붙든 사용자 글은 남는다.
  return task.replace(/\[전체 몬스터 게임 제작\][\s\S]*?(?:\n\n|$)/u, "").replace(/\[요청에서 읽은 규모\][^\n]*/u, "");
}

export function parseMonsterCampaignScale(taskInput: string): MonsterCampaignRequestScale {
  const task = userText(taskInput);
  const out: { gymCount?: number; speciesCount?: number; mapCount?: number } = {};
  const gym = String.raw`(?:체육관|도장|배지|관장)`;
  const unit = String.raw`(?:개|곳|관|군데|명)`;
  const particle = String.raw`[은는이가을를도만의]?`;
  if (new RegExp(String.raw`${gym}${particle}\s*(?:전혀\s*)?(?:없이|없고|없는|없어|없다|없음|없으|빼고|제외|필요\s*없)`, "u").test(task)
    || /체육관\s*(?:은|도)?\s*(?:안\s*(?:넣|만들|둬|두|나와)|생략)/u.test(task) || /(?:without|no)\s+gyms?\b/iu.test(task)) out.gymCount = 0;
  // 「배지 8개를 5개로」「배지를 8개에서 5개로」「체육관을 5개로」 — 바꿀 값은 뒤쪽 수.
  const change = new RegExp(String.raw`${gym}${particle}[^\d가-힣]{0,3}${COUNT}\s*${unit}?\s*(?:를|을|은|는)?\s*(?:에서|→|->|=>)?\s*${COUNT}\s*${unit}?\s*(?:로|으로|까지)`, "u").exec(task);
  const single = new RegExp(String.raw`${gym}${particle}\s*(?:딱\s*)?${COUNT}\s*${unit}`, "u").exec(task)
    ?? new RegExp(String.raw`${COUNT}\s*${unit}(?:의|짜리)?\s*${gym}`, "u").exec(task)
    ?? /(\d{1,2})\s*gyms?\b/iu.exec(task) ?? /\bgyms?\s*[:=]?\s*(\d{1,2})\b/iu.exec(task) ?? /(\d{1,2})\s*badges?\b/iu.exec(task);
  const gyms = change ? countOf(change[2]) : single ? countOf(single[1]) : undefined;
  if (gyms !== undefined) out.gymCount = gyms;
  const species = /(?:도감|몬스터|종)[^\d가-힣]{0,6}(\d{1,4})\s*(?:종|마리)/u.exec(task) ?? /(\d{1,4})\s*종(?:류)?(?:의|을|를|\s*(?:도감|몬스터))/u.exec(task) ?? /(\d{1,4})\s*species\b/iu.exec(task);
  if (species) out.speciesCount = Number(species[1]);
  const maps = /맵\s*(?:을|은|이)?\s*(\d{1,3})\s*(?:개|장)/u.exec(task) ?? /(\d{1,3})\s*(?:개|장)의\s*맵/u.exec(task);
  if (maps) out.mapCount = Number(maps[1]);
  if (out.gymCount !== undefined) out.gymCount = Math.max(0, Math.min(8, out.gymCount));
  return out;
}

/** 모델이 요청 문장 그대로 인자를 넘기도록 의도 메모 끝에 붙이는 한 줄. 읽은 값이 없으면 빈 문자열. */
export function monsterScaleNote(task: string): string {
  const s = parseMonsterCampaignScale(task);
  const parts = [s.gymCount !== undefined ? (s.gymCount === 0 ? 'gymCount:0(체육관 없음 — 관장·배지 없는 캠페인)' : `gymCount:${s.gymCount}(체육관·배지 정확히 ${s.gymCount}개)`) : '', s.speciesCount ? `speciesCount:${s.speciesCount}` : '', s.mapCount ? `mapCount:${s.mapCount}` : ''].filter(Boolean);
  return parts.length ? `\n[요청에서 읽은 규모] build_monster_game 에 ${parts.join(', ')} 를 그대로 넘긴다 — 빠뜨리면 기본 8관 90맵 캠페인으로 지어져 요청과 어긋나고 완료 검사가 막는다.` : '';
}

export const MONSTER_GAME_INITIAL_TOOLS = ['get_project_summary','read_game_systems','read_monster_game','configure_monster_style','build_monster_game','configure_monster_campaign','review_monster_game','review_game_systems','get_opening','review_opening','show_opening_image','find_tools','define_monster_families','rename_monster_species','place_trainer','set_type_chart','set_encounter_table'] as const;
export const MONSTER_GAME_PRODUCTION_PROMPT = `[전체 몬스터 게임 제작]
포켓몬형 전체 게임 요청은 에메랄드 참고 프로필을 기본으로 사용한다. read_monster_game/read_game_systems로 실제 현재 내용을 읽고 configure_monster_style(reference:emerald)를 적용한다.
빈 프로젝트에는 build_monster_game(mode:create)를 사용한다. 기획서·요청에 고유명(지방·시작 마을·박사·첫 도로·첫 체육관·첫 관장·첫 배지, 게임 제목)이 있으면 title 과 names 로 그대로 넘긴다 — 넘기지 않으면 기본 이름(별싹 마을·천문박사·유림)이 남는다. 시작 마을이 사막·눈·바닷가·화산(용암·재·화산 섬)으로 적혀 있으면 startTheme(desert|snow|coast|volcano)도 넘긴다 — 빠뜨리면 사막 기획인데 풀밭 마을에서 시작한다. 체육관 이름·관장·배지·타입이 기획서에 있으면 names.gyms 에 1관부터 순서대로(타입은 바위→rock, 물→water…) 넘긴다 — 이름만 「바위 체육관」이고 관장이 풀 몬스터를 내보내지 않게. 첫 도로 트레이너 직업명은 names.firstRouteTrainers. 이미 캠페인이 있으면 mode:repair로 보수한다. 저작 게임을 전부 버린다고 명시한 요청만 replace:true로 전체를 교체한다. 설정 도구만 실행하거나 작은 시작 예제만 만들어 전체 게임 완료로 보고하지 않는다.
요청이 규모를 말하면 인자로 넘긴다 — 체육관 수는 gymCount(0~8), 도감 종 수는 speciesCount. 빠뜨리면 기본 8관 캠페인이 나와 요청과 어긋나고 완료 검사가 막는다. 이미 지은 캠페인의 체육관 수를 줄이라는 요청은 configure_monster_campaign 의 badgeCount 로(정의·관장 이벤트·잠금·서사가 함께 줄고, definition 배열만 줄이면 거부된다). 시작 마을 풍경 중 지원 밖 테마는 가까운 테마로 대체했다고 밝힌다.
공용 전체 캠페인 생성기는 기본(규모 인자 없음)이면 72맵·60종·8체육관·리그·스토리·엔딩·후일담을, 규모 인자가 있으면 그에 맞춘 작은 캠페인을 실제 보통 Project로 만든다. 사용한 원본 캠페인/그림은 재사용했다고 밝히고, 새로운 세계를 직접 설계했다고 주장하지 않는다. 보수는 기존 타일·맵 연결·로스터·시작·플레이 세션·사용자 오프닝을 보존한다. 기존 오프닝을 에메랄드 교수 소개로 바꾸라는 명시 요청이면 replaceOpening:true를 함께 준다.
교수/몬스터 소개는 실제 Enter 확인 오프닝으로 게임의 시작과 동료 선택에 이어진다. 임의 왕국/그림책 소개로 바꾸거나 선택 전 이미 동료를 소유한 장면을 만들지 않는다. get_opening/show_opening_image로 실제 연결 그림을 확인한다.
에메랄드 도트 규격: 필드 그림은16×32 원본, 인물 잉크는 주인공14×20~21픽셀, 팔레트15불투명색+투명이다. 에디터24×32는 포장 칸이며 원본을 x4 투명여백에 그대로 넣는다.24×32 인물을 그리거나 늘리지 않는다. 전투 인물/교수 소개는64×64다. 공용 검수된 그림은 build_monster_game(mode:create|repair)의 캐스트를 우선 쓰고 새로운 걷기 그림은 pokemon-character-motion 하네스의 import→check→preview→review→gate→build를 거쳐 공유팩에 등록해야 한다. 구조 통과만으로 그림 품질 승인이나 실제 플레이 완료를 주장하지 않는다. 교수의 실제 눈·입·손 모션은 configure_opening_portrait_motion으로 연결하며 Enter 페이지와 음악의 재시작으로 움직임을 대신하지 않는다.
startTheme 는 시작 마을·1번길·전투 배경뿐 아니라 타이틀 키아트(그 풍경 그림이 설치돼 있으면)와 테마 주민 칩(사용자가 Allow 해 설치한 칩이 있을 때만, 없으면 기본 칩)도 고른다 — 조수가 타이틀이나 주민 그림을 따로 만들어 끼우지 않는다. 마을 빈터는 생성기가 쓰임(숲 덩이·꽃밭·눈놀이 터·선인장 밭·파라솔 쉼터…)으로 이미 채운다. 만든 뒤 「○○ 마을 왼쪽 아래 빈 곳 채워」 같은 이어 고치기는 build_monster_game 을 다시 부르지 말고 furnish_outdoor_area(mapId, region:bottom-left) 한 번 → show_map_region 으로 본다.
마지막 변경 뒤 read_monster_game 및 review_monster_game, read_game_systems 및 review_game_systems, review_opening을 실제로 실행한다. 완료 검사 문제는 도구로 해결하며 요청한 규모(기본은 72맵/60종/8관)를 축소하지 않는다.
구조 검토는 플레이/청취/저장 검증이 아니다. 실제 이동·스타터·조우·포획·회복·상점 거래·배지·저장/Continue와 정본 저장 재로드는 별도로 확인하며 미검증 범위를 보고한다. 전투는 현재gen1 규칙이며 에메랄드의 모든 규칙을 구현했다고 말하지 않는다.
도로·체육관에 트레이너를 더하라는 요청은 place_trainer(시야선에 들면 「!」 후 배틀, 한 호출), 악·강철·페어리가 있는 18타입은 set_type_chart {preset:'gen3'|'gen6'}, 야생 레벨 범위·풀숲 칸에서만 나오는 조우는 set_encounter_table 의 levelMin/levelMax·conditions.terrainId('terrain_grass')로 한다.
울음·칼춤·연막 같은 능력 변화 기술은 upsert_skill 의 statStageEffects([{stat:'attack'|'defense'|'spAttack'|'spDefense'|'speed'|'accuracy'|'evasion', stages:-6~+6, chance?, target?:'self'}])로 한다 — 포켓몬식 단계(전투 한 번, 교체하면 초기화)이고 상태(state_attack_up)로 흉내 내지 않는다.`;

/** 포켓몬 낱말 없이 몬스터 수집·체육관 게임을 말했을 때 캠페인 프롬프트 뒤에 붙는다. */
export const MONSTER_FREE_CAMPAIGN_NOTE = `
[포켓몬 낱말 없는 몬스터 수집 요청]
요청에 포켓몬이라는 말이 없어도 몬스터를 모으고 체육관에 도전하는 게임이면 위 제작 경로가 맞다 — 자유 경로로 맵·칩셋을 따로 모으면 버들항·사막·숲이 섞인다. 몬스터 칩셋·gen1 룰은 build_monster_game 이 한 번에 깐다. 요청이 정한 풍경(화산 섬→volcano)·체육관 수·고유명은 도구 인자로 넘긴다.
도감 종 수를 요청이 정하면(예: 100종) 캠페인 기본 60종 뒤 부족분을 define_monster_families 로 계통 단위 한 번에 채운다(종마다 define_monster_species 를 부르지 않는다). 채운 종이 실제로 만나지도록 야생 조우·지급에 연결하고, 이름을 바꾸라는 요청은 rename_monster_species(적·무리·대사·도감 설명까지 함께 바뀐다)로 한다.
포획 없는 대회·대전 요청이면 이 경로가 아니라 build_monster_tournament 이다.`;

export const MONSTER_EXPEDITION_INITIAL_TOOLS = ['get_project_summary', 'read_game_systems', 'review_game_systems', 'build_monster_expedition', 'configure_monster_system', 'define_monster_families', 'rename_monster_species', 'get_database_records', 'get_opening', 'review_opening', 'show_opening_image', 'find_tools'] as const;

export const MONSTER_EXPEDITION_PROMPT = `[체육관 없는 도감 탐험형 몬스터 게임 제작]
타이틀 화면·오프닝은 생성기가 이미 만들어 두었다 — 사용자가 따로 요청하지 않았으면 generate_title_art·plan_opening·script_cutscene·시작 맵 컷신 이벤트를 새로 만들지 않는다(review_opening 으로 확인만).
요청이 체육관·배지 없이 야생 탐험과 도감 채우기가 중심인 몬스터 수집 게임이다. 8체육관 캠페인(build_monster_game)이 아니다 — 체육관을 만들었다가 지우거나 캠페인을 줄여서 쓰지 않는다.
빈 프로젝트에는 build_monster_expedition 을 쓴다. rounds=사냥터 수(마지막 사냥터가 보스, 기본 4), startTheme=요청 풍경(화산→volcano 등), names=지역·시작 마을·박사·라이벌 이름, title=제목. 사냥터마다 야생+조련사 둘, 라이벌은 연구소와 마지막 사냥터 앞에서 두 번, 마지막 사냥터에 보스, 엔딩까지 한 번에 만들어진다. 포획·도감은 켜져 있다.
도감 종 수를 요청이 정하면(예: 100종) 기본 60종 뒤 부족분을 define_monster_families 로 계통 단위 한 번에 채운다 — 종마다 define_monster_species 를 부르지 않는다. 계통 3~15개를 한 호출에 넣고 autoGraphics:true, spawn.mapIds 에 사냥터 맵 id(build 결과 data.groundMapIds)를 넘기면 새 종이 사냥터 야생에 실제로 나온다. 실패한 계통은 data.failed 의 이유대로 고쳐 다시 호출한다. 이름을 바꾸라는 요청은 rename_monster_species.
review_monster_game 은 72맵·8체육관 캠페인 기준이라 이 게임에 맞지 않는다 — 쓰지 않는다. 마지막에 read_game_systems 와 review_game_systems, review_opening 을 실행한다. 구조 검토는 플레이/저장 검증이 아니다 — 실제 이동·첫 동료·포획·회복·사냥터 연결·보스·엔딩·저장/Continue 와 정본 저장 재로드는 별도로 확인하고 미검증 범위를 보고한다.`;

export const MONSTER_TOURNAMENT_INITIAL_TOOLS = ['get_project_summary', 'read_game_systems', 'review_game_systems', 'build_monster_tournament', 'configure_monster_system', 'define_monster_families', 'rename_monster_species', 'get_database_records', 'get_opening', 'review_opening', 'show_opening_image', 'find_tools'] as const;

export const MONSTER_TOURNAMENT_PROMPT = `[포획 없는 대회형 몬스터 게임 제작]
타이틀 화면·오프닝은 생성기가 이미 만들어 두었다 — 사용자가 따로 요청하지 않았으면 generate_title_art·plan_opening·script_cutscene·시작 맵 컷신 이벤트를 새로 만들지 않는다(review_opening 으로 확인만).
요청이 몬스터를 데리고 싸우되 포획이 없는 트레이너 대전·대회형(토너먼트) 게임이다. 체육관·배지 캠페인(build_monster_game)이 아니다 — 8체육관·60종 캠페인을 만들거나 축소해서 쓰지 않는다.
빈 프로젝트에는 build_monster_tournament 를 쓴다. rounds=본선 회전 수(결승 포함, 요청에 숫자가 있으면 그대로), startTheme=요청 풍경(화산·용암→volcano, 사막→desert, 눈→snow, 바다→coast), names=요청에 있는 대회·마을·접수 담당·라이벌·결승 상대 이름, title=게임 제목. 이 도구가 monsterCollection=false(포획 안 함) + 몬스터 파티 전투를 선언하고, 몬스터 칩셋·gen1 룰·접수 → 연습장 → 본선 → 결승 → 우승 엔딩을 실제 맵·이벤트로 만든다.
포획 구슬·포획 안내·야생 포획 이벤트를 따로 넣지 않는다. 이미 있는 프로젝트에 대전 모드만 얹을 때는 configure_monster_system(enabled:true, capture:false) 를 쓴다 — capture:false 없이 enabled:true 만 부르면 포획 게임이 된다.
review_monster_game 은 72맵·8체육관 캠페인 기준이라 이 게임에 맞지 않는다 — 쓰지 않는다. 마지막에 read_game_systems 와 review_game_systems, review_opening 을 실제로 실행하고 결과의 문제는 도구로 해결한다. 도감을 더 채우려면 define_monster_families, 이름을 바꾸려면 rename_monster_species.
구조 검토는 플레이/저장 검증이 아니다. 실제 이동·첫 동료·연습·회전별 전투·회복·우승 엔딩·저장/Continue 와 정본 저장 재로드는 별도로 확인하고 미검증 범위를 보고한다.`;

/** 포켓몬 낱말 없이 몬스터 수집 의도가 있는 작은 요청(마을·맵·종 하나)에 붙는다 — 전체 게임 제작 경로가 아닌 자유 경로. */
export const MONSTER_FREE_KIT_NOTE = `[몬스터 수집 의도 — 몬스터 키트]
이 프로젝트의 몬스터 수집 작업은 몬스터 칩셋 계열(oprn-monster·monster_overworld 등 몬스터 키트)로 이어 간다. 새 맵·마을·길은 지금 시작 맵의 칩셋 계열을 따른다 — 버들항·사막·숲 칩셋을 섞지 않는다(빈 시작 맵은 이미 몬스터 키트로 옮겨 두었다). 종을 정의하면 define_monster_species(한 종) 대신 계통이 여럿이면 define_monster_families 를 쓴다. 포획 없는 대전 중심이면 configure_monster_system(enabled:true, capture:false).`;
