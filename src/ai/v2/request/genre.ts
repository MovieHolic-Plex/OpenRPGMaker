// 장르·주제 낱말 — 공포·퍼즐·연애·몬스터 수집·대화 장면, 그리고 어느 세계든 어울리는 요청(모험·무엇이든).
import { kw } from "./text";

export const HORROR_WORDS = /공포|호러|무서|오싹|귀신|유령|괴물|좀비|저택|폐교|폐병원|병원|추격|쫓아|쫓기|숨어|숨을 곳|옷장|손전등|어둠|비명|깜짝|horror|scary|ghost|haunted/iu;

const PUZZLE_WORDS = /퍼즐|단서|금고|비밀번호|암호|열쇠|잠긴|잠겨|탈출|수수께끼|puzzle|clue|escape|riddle/iu;
/** 퍼즐 사슬 동사를 실을 글인가 — 단서·자물쇠·잠긴 방·탈출, 그리고 공포(숨기·쫓기에 잠긴 문이 따른다). */
export const puzzleAsk = (text: string): boolean => HORROR_WORDS.test(text) || PUZZLE_WORDS.test(text);

/** 연애 게임 낱말(연애 기본값을 깐다). */
export const ROMANCE_SETUP_WORDS = new RegExp(String.raw`연애|데이트|${kw("썸")}|썸\s*타|고백|공략|호감도|러브|미연시|romance|dating`, "iu");

/** 게임 하나를 시작하는 요청(장소 하나만 짓는 요청이면 HUD·연애 루프는 건드리지 않는다). */
export const GAME_SETUP_WORDS = /게임|game/iu;

/** 모험가·용사가 주인공인 이야기 — 전투 낱말이 없어도 검사 차림이 맞다. */
export const SWORD_HERO_WORDS = /용사|모험|검사|기사|전사|영웅|퀘스트|rpg|hero|adventure|quest|knight|warrior/iu;
/** 주인공이 여자라고 말한 요청. */
export const HEROINE_WORDS = /소녀|여자|여성|아가씨|그녀|girl|woman|heroine/iu;

/** 요청·프로젝트가 맞을 때만 싣는 카드(각 한 장) — 몬스터 수집 마을, 두 선택 대화 장면. */
export const MONSTER_WORDS = /포켓몬|몬스터 ?수집|monster[- ]?collect|pok[eé]mon|트레이너|체육관|연구소|몬스터 ?센터/iu;

/** 두 선택 대화 장면(add_scene) 카드를 실을 낱말. 컷신·연출 요청 낱말은 asks.ts 의 SCENE_WORDS 다. */
export const CHOICE_SCENE_WORDS = /대화 ?장면|선택지|고백|속마음|연애|데이트|첫 ?만남|romance|confess/iu;

export const WASTELAND_WORDS = /좀비|아포칼립스|종말|황무지|폐허\s*도시|포스트\s*아포|\b(?:zombies?|apocalypse|wasteland|post[-\s]?apocalyptic)\b/iu;

export const BEODEUL_WORDS = /버들\s*항|beodeul/iu;

export const FANTASY_WORDS = /판타지|용사|마왕|기사|왕국|검과|드래곤|\b(?:fantasy|hero|knight|dragon|kingdom)\b/iu;

/** 요청에서 뜻이 없는 낱말(«재밌는 게임 하나 만들어 줘») — 이것을 걷고 남는 글이 없으면 무엇이든 좋다는 요청이다. */
const GENERIC_KO = /만들어\s*주세요|만들어\s*줘|만들어\s*줄래|만들어|해\s*주세요|해\s*줘|주세요|재미있는|재밌는|재미난|신나는|멋진|간단한|짧은|새로운|아무거나|아무|알아서|적당히|게임|하나|한\s*개|한\s*편|좀|줘/gu;

const GENERIC_EN = /\b(?:please|make|create|build|give|me|a|an|the|some|any|game|fun|simple|short|new|cool|good|nice|one)\b/giu;

/** 모험·RPG 쪽 요청 — 여러 장소를 다니는 게임이라 어느 세계든 어울린다. */
const ADVENTURE_WORDS = /모험|어드벤처|RPG|알피지|롤플레잉|판타지|용사|마왕|던전|퀘스트|전설|영웅|기사|왕국|드래곤|보물|탐험|원정|여정|\b(?:adventure|fantasy|quest|hero|dungeon|dragon|treasure|expedition|journey)\b/iu;

/**
 * 낱말로 세계를 말하지 않은 요청에 세계를 골라 줘도 되나 — 무엇이든 좋다는 요청이거나 모험·RPG 요청일 때만.
 * 왜(2026-11-10 검토): «저택에서 탈출하는 게임»·«탐정 게임»·«카페 경영 게임» 이 열쇠 해시로 선사 시대 세계를 받았다 — 그 게임들은 방을 설계해 짓는 종전 길이 맞다.
 * 막을 낱말을 늘리는 대신 되는 요청을 좁게 정한다(모르는 장르는 종전 길로 간다).
 */
export function fitsAnyWorld(request: string): boolean {
  if (ADVENTURE_WORDS.test(request)) return true;
  return !request.replace(GENERIC_KO, " ").replace(GENERIC_EN, " ").replace(/[^\p{L}\p{N}]+/gu, "");
}
