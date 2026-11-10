// 요청 범위 — 게임 하나를 만드는 요청인가, 한 곳짜리 게임인가, 지은 맵에 로직만 넣는 요청인가. 요청 글(과 프로젝트)만 읽는다.
import type { Project } from "@/project/types";
import { withoutIntentNote } from "@/ai/piAgent/monsterGameRequest";
import { type GameBlueprint } from "@/project/gameBlueprint";
import { PLACE_BUILD_WORDS } from "./place";
import type { PiAgentRequest } from "@/ai/piAgent/protocol";

/** 게임 하나를 만들거나 완성하는 요청(작은 고치기 요청에는 출하 검사를 걸지 않는다). */
// 컨셉 카드 한 줄(「폐업 직전 태엽 장난감 가게, 밤마다 손님이 깨어난다 (회상 스토리)」)도 게임 하나를 만드는 요청이다 — 끝의 (장르) 괄호가 표지.
// 2026-10-26 toy-j90: 이 한 줄이 출하 검사·화면 검수 없이 1턴을 끝냈다.
// 「… 게임으로」으로 끝나는 요청도 게임 하나다(2026-11-05 gpt-only-game: 「마을 하나 만들어줘. 거기서 시작하는 모험 게임으로」가 마을만 짓고 엔딩 없이 끝났다).
export const WHOLE_GAME_WORDS = /(게임|game|RPG|알피지)[^.!?\n]{0,60}(만들|지어|짜\s*줘|완성|제작|build|make)|(만들|지어|완성)[^.!?\n]{0,20}(게임|game|RPG|알피지)|(?:^|[\s.,!?])[^\s.,!?]{0,9}[^\s.,!?을를]\s+(게임|game|RPG|알피지)\s*(으로|로)\s*(해\s*줘|부탁해)?\s*[.!]?\s*$|엔딩까지|처음부터 끝까지|whole game|\([^()\n]{0,24}(스토리|이야기|RPG|어드벤처|호러|공포|연애|로맨스|추리|미스터리|탐험|퍼즐|시뮬레이션|액션|비주얼\s*노벨|생존|육성|수집|게임)[^()\n]{0,12}\)\s*$/iu;

/** 고치기 동사로 끝나는 짧은 요청(「버튼 효과 고쳐 (액션)」)은 괄호 장르가 붙어도 전체 게임 요청이 아니다. */
const EDIT_REQUEST = /(고쳐|바꿔|옮겨|지워|없애|줄여|늘려|수정|변경)\s*(줘|주세요|라)?[^()\n]{0,4}\([^()\n]*\)\s*$/u;

/** 「게임」 뒤에 바로 만들기 동사(「추리 게임 만들어 줘」·「RPG 하나 만들어」) — 게임 자체가 만들 대상이다. */
const GAME_IS_OBJECT = /(게임|game|RPG|알피지)\s*(하나|한\s*개)?\s*(을|를)?\s*(만들|지어|짜\s*줘|완성|제작)/iu;

const WHOLE_STRONG = /엔딩까지|처음부터 끝까지/u;

/** 게임의 한 부분을 만드는 요청 — 「방탈출 게임에 쓸 서재」·「공포 게임에 나오는 병실」·「힐링 게임의 잡화점」·「배달 게임에서 소포 받는 빵집」. */
const PART_OF_GAME = /(게임|game|RPG)\s*(에\s*(쓸|쓰일|나오는|넣을|들어갈)|에서|의)\s/iu;

/**
 * 방·맵 하나만 짓는 요청(방 과제 접미 「다른 맵은 만들지 말고 이 방 하나만 지어 줘」, 「… 잡화점 실내를 만들어 줘」).
 * 게임 이름이 들어 있어도 장소 하나를 짓는 말이면 청사진 관문이 make_place·edit_place 를 막지 않게 한다(2026-10-29 room-base2x healing-store·delivery-bakery 0점).
 */
export const SINGLE_PLACE = /(방|맵|장소|실내|건물)\s*하나만|다른\s*맵은\s*만들지|(실내|방|맵|장소)(를|을)?\s*(하나\s*)?(만들어|지어)\s*(줘|주세요)/u;

/**
 * 게임 하나를 만들거나 완성하는 요청인가 — 끝맺음 조립·출하 검사·화면 검수가 이 판정으로 켜진다.
 * 2026-10-29 판정표(scripts/qa/assistant-v2/wholeGameTable.mts, 스위트 12 프롬프트·방 과제 17개): 「짧은 판타지 RPG 만들어 줘」 가 false 라
 * jrpg 첫 차례에 끝맺음 조립이 돌지 않았고, 「공포 게임에 나오는 병실 실내를 만들어 줘. … 이 방 하나만 지어 줘」 같은 방 과제 6개가 true 라
 * 방 하나 짓기에 출하 검사가 걸렸다.
 */
export function wantsWholeGame(raw: string): boolean {
  // 실행기는 요청 뒤에 의도 메모(시스템 지침)를 붙여 보낸다 — 사용자 글만 본다. 「… 게임으로」 끝 맞춤이 메모 때문에 어긋났다(2026-11-05 gpt-only-game).
  const task = withoutIntentNote(raw);
  if (!WHOLE_GAME_WORDS.test(task)) return false;
  const strong = WHOLE_STRONG.test(task);
  if (EDIT_REQUEST.test(task) && !strong && !/(게임|game|RPG|알피지)[^.!?\n]{0,60}(만들|지어|완성|제작)/iu.test(task)) return false;
  if (strong) return true;
  // 「방 하나만 있는 방탈출 게임 만들어 줘」 는 게임 요청 — 게임이 만들 대상이면 방·부분 낱말로 끄지 않는다.
  if ((SINGLE_PLACE.test(task) || PART_OF_GAME.test(task)) && !GAME_IS_OBJECT.test(task)) return false;
  return true;
}

/**
 * 이 요청이 게임 하나를 만드는 일인가 — 이번 요청문, 아니면 청사진이 들고 있는 첫 요청문. 「끝까지 만들어 줘」 같은 이어 하기 턴이 낱말 판정에 안 걸려
 * 출하 검사·조립 기본값이 통째로 꺼지던 것을 막는다(2026-11-09 assistant-reward village-1).
 */
export function buildsWholeGame(project: Project, task: string): boolean {
  return wantsWholeGame(task) || wantsWholeGame(project.gameBlueprint?.request ?? "");
}

/** 방탈출 청사진은 sealEscapeExits 가 바깥으로 나가는 문을 지우므로, 맵·퀘스트 최소는 1장으로 같이 면제한다(두 규칙이 서로 반대로 작동하면 3번 시도 끝에 막힘). */
const escapeGame = (project: Project): boolean => (project.gameBlueprint ? isEscapeBlueprint(project.gameBlueprint) : false);

/** 한 곳짜리 게임(방탈출·「방 하나」)인가 — 맵·퀘스트·진행 깊이 관문과 청사진 장소 검사가 같은 판정을 쓴다. */
export function oneProjectGame(project: Project, task: string): boolean {
  const request = withoutIntentNote(task) + " " + withoutIntentNote(project.gameBlueprint?.request ?? "");
  return SINGLE_PLACE.test(request) || ONE_ROOM_GAME.test(request) || escapeGame(project);
}

/** 방 하나짜리 게임 요청 — 방탈출·밀실·한 방. */
export const ONE_ROOM_GAME = /방\s*탈출|밀실|한\s*방|방\s*하나|escape\s*room|one[-\s]room/iu;

// 왜(2026-11-10 link 측정 forest-0001): 단독 «탈출» 은 «숲에서 탈출»·«성에서 탈출» 같은 열린 맵 게임도 잡았다. 그러면 sealEscapeExits 가 모델이 막
// create_transfer_pair 로 만든 출구(시작 맵 → 새벽 숲 가장자리)를 «조건 없이 나가는 이동» 으로 지워 세는 맵이 1/4 로 돌아갔다(6판 모두 방탈출로 판정).
// 단독으로 갇힌 방인 낱말은 shipChecks 의 한 방 면제(ONE_ROOM_GAME: 방탈출·밀실)와 같은 것만 둔다 — «갇힌 공주»·«감옥에서 동료 구출» 같은 열린 맵 이야기는 «탈출» 과 함께일 때만 센다.
const ENCLOSED_WORDS = /방\s*탈출|밀실|잠긴\s*방|escape\s*room|locked\s*room/iu;

const ENCLOSURE_NOUN = /(?:^|[^가-힣])(?:방|교실|감옥|지하실|저택|별장|병실|창고|엘리베이터|갇힌|갇혀)(?![가-힣]*[법향식])(?=[을를이가은는에서의으로와과\s]|$)/u;

/** 청사진이 갇힌 방을 빠져나가는 게임인가(엔딩 = 잠긴 문 열기). */
export function isEscapeBlueprint(bp: GameBlueprint): boolean {
  const text = [bp.playerGoal, bp.ending.name, bp.ending.how, bp.request ?? ""].join(" ");
  return ENCLOSED_WORDS.test(text) || (/탈출|escape/iu.test(text) && ENCLOSURE_NOUN.test(text));
}

const MAKE_GAME_WORDS = /게임\s*(하나|한\s*판|을|를)?\s*(만들|짓)|작은\s*게임|짧은\s*게임|맵\s*[5-8]\s*(장|개)|[5-8]\s*개의?\s*맵|마을.*(던전|동굴|숲).*(보스|이야기)|이야기가\s*있는|퀘스트\s*라인|챕터/iu;

export function wantsMakeGame(task: string): boolean {
  return MAKE_GAME_WORDS.test(task);
}

/** 빈 프로젝트(이벤트·엔딩 없음)인가 — 첫 장소를 짓는 요청을 게임 시작으로 본다. */
export function isFreshProject(project: Project): boolean {
  return (project.endings ?? []).length === 0 && Object.values(project.maps).every((map) => (map.events ?? []).length === 0);
}

/**
 * 지은 맵에 로직만 넣는 요청(editOnlyRequest)은 장소 짓기 지식 카드와 짓기 동사를 지시문·도구 목록에 싣지 않는다(2026-11-01 비용 분석 —
 * openwiki/assistant-v2.md 「토큰 비용 재기」). 실내·마을·던전·거리·사람·그리기 카드와 실내 칩셋 목록이 약 1.9만 토큰, make_place·edit_place 등
 * 짓기 동사가 약 1.6만 토큰인데, 로직 요청 18판에서 한 번도 쓰지 않으면서 호출마다 다시 읽었다.
 * 그런 요청이면 지시문에는 색인 한 줄(PLACE_SPEC_INDEX)만 두고, 짓기 동사는 load_tools 로, 카드는 read_specs 나 그 종류의 첫 짓기 호출이 기록(캐시 뒤쪽)으로 준다.
 * 게임 하나·장소 짓기·빈 프로젝트 요청은 예전 그대로 다 싣는다. 끄기: OPRN_V2_LEAN_PROMPT=0 (A/B 측정용).
 */
function leanPromptOn(): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.OPRN_V2_LEAN_PROMPT !== "0";
}

/** 이미 지은 게임에 로직·대사·데이터만 넣는 요청인가 — 게임 하나·첫 장소(빈 프로젝트)·장소 짓기 낱말이면 아니다. */
export function editOnlyRequest(project: Project, task: string): boolean {
  return !!task.trim() && !wantsWholeGame(task) && !wantsMakeGame(task) && !isFreshProject(project) && !PLACE_BUILD_WORDS.test(task);
}

/** 이 요청에 가벼운 지시문(장소 카드·짓기 동사를 필요할 때만)을 쓰나. */
export function leanPromptFor(project: Project, task: string | undefined): boolean {
  return leanPromptOn() && editOnlyRequest(project, task ?? "");
}

/** 무엇을 바꾸라는 요청인가(질문·조회·설명은 아니다). 이 요청에만 첫 호출 todo 를 강제한다. */
export function isWriteRequest(request: Pick<PiAgentRequest, "task" | "readOnly">): boolean {
  if (request.readOnly) return false;
  const t = request.task.trim();
  // 만들라는 낱말이 있으면 쓰기다 — 「…「아직 아무 단서도 없다」고 알려 줘」처럼 게임 속 대사를 시키는 «알려 줘»를 질문으로 읽어
  // 할 일 뼈대·첫 쓰기 관문이 통째로 꺼졌다(2026-11-01 자물쇠 요청, 모든 모델).
  if (/넣어\s*줘|만들어|추가해|바꿔\s*줘|고쳐\s*줘|놓아\s*줘|지어\s*줘|깔아\s*줘|붙여\s*줘|구현해|짜\s*줘|세워\s*줘|그려\s*줘/u.test(t)) return true;
  return !/\?\s*$|？\s*$|알려\s*줘|뭐야|뭐가 있|어디\s*있|있어\?|보여\s*줘|설명해|정리해서|요약해/u.test(t);
}

/** 앞 실행이 남긴 할 일을 이어 받을 요청인가(«계속»·«이어서»·«마저»·«남은 것»). */
export const CONTINUE_WORDS = /계속|이어서|이어 ?(해|가|만들|짓)|마저|남은 ?(것|일|항목)|끝까지|다시 ?해/u;
