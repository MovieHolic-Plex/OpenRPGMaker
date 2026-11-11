// 요청 범위 낱말과 규칙 — 게임 하나를 만들라는 말인가, 이어 하라는 말인가, 한 곳짜리 게임인가, 무엇을 바꾸라는 말인가.
// 여기 규칙은 글 한 줄을 보고 참·거짓만 낸다. 한 요청의 결정은 intent.ts 가 한 번 모으고, 다른 파일은 readers.ts 로 읽는다.
import type { Project } from "@/project/types";
import { type GameBlueprint } from "@/project/gameBlueprint";
import { PLACE_BUILD_WORDS } from "./place";

const GAME = "게임|game|RPG|알피지";
const MAKE = String.raw`만들|지어|짜\s*줘|완성|제작|개발|build|make|create`;
/** 게임 바로 뒤에서 그 게임을 배경·부분으로 돌리는 말 — 「게임 속 상점」「게임에 쓸 서재」「게임의 첫 장면」「게임에서 소포 받는 빵집」. */
const PART_AFTER = /^\s*(?:(?:속|안|내부)[가-힣]{0,2}(?![가-힣])|(?:에서|에다|에도|에는|에|의|용|이랑|랑|과|와|처럼|같은|보다)(?![가-힣]))/u;
/** 만들기 동사 앞에 와도 게임이 여전히 만들 대상인 꾸밈말(「짧게」「폐병원 배경으로」「하나」). */
const ADVERBIAL = /(?:으로|로|게|히|처럼|같이|에서|해서|도록|까지|부터|만큼)$|^(?:하나|한|개|편|판|좀|다|새로|직접|빨리|전부|마저|이어서|계속|함께|제대로|완전히|통째로|알아서)$/u;
const AFTER_GAME = new RegExp(String.raw`^(\s*(?:을|를))?(\s*(?:하나|한\s*(?:개|편|판)))?([^.!?\n]{0,40}?)\s*(?:${MAKE})`, "iu");
/** 게임이 만들 대상인가 — 「추리 게임 만들어 줘」「게임을 도트 그래픽으로 만들어 줘」. 「게임 속 상점 NPC 만들어 줘」「게임 타이틀 화면 만들어 줘」는 아니다. */
function gameIsMade(text: string): boolean {
  for (const hit of text.matchAll(new RegExp(GAME, "giu"))) {
    const rest = text.slice(hit.index + hit[0].length);
    if (PART_AFTER.test(rest)) continue;
    const m = AFTER_GAME.exec(rest);
    if (!m) continue;
    const words = (m[3] ?? "").trim().split(/\s+/u).filter(Boolean);
    if (!words.length) return true;
    // 「게임을 …」「게임 하나 …」: 사이에 다른 목적어(을/를)가 없으면 게임이 목적어다. 조사도 세는 말도 없으면 사이 말이 모두 꾸밈말일 때만.
    if (m[1] || m[2] ? !words.some((w) => /[가-힣](?:을|를)$/u.test(w)) : words.every((w) => ADVERBIAL.test(w))) return true;
  }
  return false;
}
/** 동사가 앞에 온 꼴 — 「만들어 줘, 판타지 게임」「만들고 싶은 게임이 있어」. */
const MAKE_THEN_GAME = new RegExp(String.raw`(?:만들|지어|완성|make|build|create)[^.!?\n]{0,20}?(?:${GAME})(?=\s*(?:이야|야|이에요|예요|입니다|이\s|은\s|는\s|[.!?,]|$))`, "iu");
/** 「… 게임으로」로 끝나는 요청(「마을 하나 만들어줘. 거기서 시작하는 모험 게임으로」). 「이름을 게임으로 바꿔」는 아니다. */
const AS_A_GAME = new RegExp(String.raw`(?:^|[\s.,!?])[^\s.,!?]{0,9}[^\s.,!?을를]\s+(?:${GAME})\s*(?:으로|로)\s*(?:해\s*줘|부탁해)?\s*[.!]?\s*$`, "iu");
/** 끝까지 이어지게 해 달라는 말 — 게임을 완성하라는 요청이다. 「엔딩까지 가는 길에 표지판」처럼 자리를 가리키는 말은 아니다. */
const FINISH_GAME = /(?:엔딩|결말)까지\s*(?:[^\s.!?]+\s+){0,3}?(?:이어지|이어서|플레이|진행|만들|완성|마무리|갈\s*수|할\s*수|볼\s*수|깰\s*수|끝낼\s*수|클리어)|whole game/iu;
/** 컨셉 카드 한 줄 — 끝의 (장르) 괄호가 표지다(「폐업 직전 태엽 장난감 가게, 밤마다 손님이 깨어난다 (회상 스토리)」). */
const CONCEPT_CARD = /\([^()\n]{0,24}(?:스토리|이야기|RPG|어드벤처|호러|공포|연애|로맨스|추리|미스터리|탐험|퍼즐|시뮬레이션|액션|비주얼\s*노벨|생존|육성|수집|게임)[^()\n]{0,12}\)\s*$/iu;
/** 고치기 동사로 끝나는 짧은 요청(「버튼 효과 고쳐 (액션)」)은 괄호 장르가 붙어도 컨셉 카드가 아니다. */
const EDIT_BEFORE_PAREN = /(?:고쳐|바꿔|옮겨|지워|없애|줄여|늘려|수정|변경)\s*(?:줘|주세요|라)?[^()\n]{0,4}\([^()\n]*\)\s*$/u;
/** 「게임」 바로 뒤에 만들기 동사 — 방·부분 낱말이 같이 있어도 게임이 만들 대상이다(「방 하나만 있는 방탈출 게임 만들어 줘」). */
const GAME_THEN_MAKE = new RegExp(String.raw`(?:${GAME})\s*(?:하나|한\s*개)?\s*(?:을|를)?\s*(?:만들|지어|짜\s*줘|완성|제작)`, "iu");
/** 방·맵 하나만 짓는 요청(방 과제 접미 「다른 맵은 만들지 말고 이 방 하나만 지어 줘」, 「… 잡화점 실내를 만들어 줘」). */
export const SINGLE_PLACE = /(방|맵|장소|실내|건물)\s*하나만|다른\s*맵은\s*만들지|(실내|방|맵|장소)(를|을)?\s*(하나\s*)?(만들어|지어)\s*(줘|주세요)/u;

/** 게임 하나를 만들거나 완성하라는 글인가. 까닭(why)은 기록·보고에 쓴다. */
export function wholeGameAsk(text: string): { readonly asked: boolean; readonly why: string } {
  const no = (why: string) => ({ asked: false, why });
  const yes = (why: string) => ({ asked: true, why });
  const made = gameIsMade(text) || MAKE_THEN_GAME.test(text);
  if (SINGLE_PLACE.test(text) && !GAME_THEN_MAKE.test(text)) return no("asks for one room or map only");
  if (made) return yes("asks to make a game");
  if (AS_A_GAME.test(text)) return yes("ends with «… as a game»");
  if (FINISH_GAME.test(text)) return yes("asks to make the game playable through to the ending");
  if (CONCEPT_CARD.test(text) && !EDIT_BEFORE_PAREN.test(text)) return yes("one-line concept card with a (genre) tag");
  return no("does not ask to make or finish a game");
}

/** 방 하나짜리 게임 낱말 — 한 표. sealed(갇힌 방: 출구를 잠근다)는 single(맵 한 장으로 충분하다)에 든다. */
const ROOM_GAME = {
  sealed: String.raw`방\s*탈출|밀실|잠긴\s*방|escape\s*room|locked\s*room`,
  single: String.raw`(?<![가-힣])방\s*하나|(?<![가-힣])한\s*방\s*(?:짜리|안에서|에서만|만으로|뿐)|방\s*한\s*(?:칸|개)|one[-\s]room`,
} as const;
const SEALED_ROOM = new RegExp(ROOM_GAME.sealed, "iu");
/** 방 하나짜리 게임 요청 — 방탈출·밀실·잠긴 방·방 하나. */
export const ONE_ROOM_GAME = new RegExp(`${ROOM_GAME.sealed}|${ROOM_GAME.single}`, "iu");

// 단독 «탈출» 은 «숲에서 탈출»·«성에서 탈출» 같은 열린 맵 게임도 잡는다 — 갇힌 곳 낱말과 함께일 때만 센다.
const ENCLOSURE_NOUN = /(?:^|[^가-힣])(?:방|교실|감옥|지하실|저택|별장|병실|창고|엘리베이터|갇힌|갇혀)(?![가-힣]*[법향식])(?=[을를이가은는에서의으로와과\s]|$)/u;
/** 청사진이 갇힌 방을 빠져나가는 게임인가(엔딩 = 잠긴 문 열기). */
export function isEscapeBlueprint(bp: GameBlueprint): boolean {
  const text = [bp.playerGoal, bp.ending.name, bp.ending.how, bp.request ?? ""].join(" ");
  return SEALED_ROOM.test(text) || (/탈출|escape/iu.test(text) && ENCLOSURE_NOUN.test(text));
}

/** 맵 여러 장과 이야기를 한 번에 맡기는 말(make_game 동사를 싣는 낱말). */
export const MAKE_GAME_WORDS = /게임\s*(하나|한\s*판|을|를)?\s*(만들|짓)|작은\s*게임|짧은\s*게임|맵\s*[5-8]\s*(장|개)|[5-8]\s*개의?\s*맵|마을.*(던전|동굴|숲).*(보스|이야기)|이야기가\s*있는|퀘스트\s*라인|챕터/iu;

/** 빈 프로젝트(이벤트·엔딩 없음)인가 — 첫 장소를 짓는 요청을 게임 시작으로 본다. */
export function isFreshProject(project: Project): boolean {
  return (project.endings ?? []).length === 0 && Object.values(project.maps).every((map) => (map.events ?? []).length === 0);
}

/** 맵과 맵을 오가게 해 달라는 말 — 「넘어갈 수 있게」「오갈 수 있게」「돌아오는 길」「이어 줘」. */
export const LINK_MAPS_WORDS = /넘어갈|넘어가게|넘어올|오갈|오가게|오고\s*갈|드나들|건너갈|건너가게|돌아오는\s*길|돌아가는\s*길|돌아올\s*수|돌아갈\s*수|이어\s*줘|이어줘|이어지게|연결|통하게|\b(?:link|connect)\b/iu;
/** 새 장소를 짓거나 있는 장소를 다시 짓는 말 — 이 말이 있으면 잇기만 하는 요청이 아니다. */
const NEW_PLACE_WORDS = /(?<![가-힣])새(?:로운|로)?\s|다시\s*(?:짓|지어|만들|그려)|넓혀|넓히|키워|늘려|하나\s*더|\b(?:new|rebuild|expand)\b/iu;
/** 요청 글에 이름이 나온 맵 이름(띄어쓰기 무시, 두 글자 이상) — 긴 이름부터 맞춰 「마을」이 「잿불 마을」 안에서 한 번 더 세어지지 않게 한다. */
function mapsNamedIn(own: string, project: Pick<Project, "maps">): string[] {
  let flat = own.replace(/\s+/gu, "");
  const names = [...new Set(Object.values(project.maps).map((map) => (map.name ?? "").trim()))].filter((name) => name.replace(/\s+/gu, "").length >= 2).sort((x, y) => y.length - x.length);
  return names.filter((name) => { const key = name.replace(/\s+/gu, ""); const hit = flat.includes(key); if (hit) flat = flat.split(key).join(" "); return hit; });
}
/**
 * 이미 있는 맵 둘을 잇기만 하라는 요청인가 — 글에 있는 맵 이름이 둘 이상이고, 잇는 낱말이 있고, 새 장소·다시 짓기를 말하지 않고,
 * 그 맵들을 가리키는 낱말(이름의 조각 — 「마을」「들판」)을 빼면 장소 짓기 낱말이 남지 않는다. 맞으면 그 이름들을 돌려준다.
 * 왜: 「잿불 마을 … 동쪽 들판으로 넘어갈 수 있게 해 줘. 들판에서 마을로 돌아오는 길도 만들어 줘」의 «마을 … 만들어» 가 장소 짓기 낱말에 맞아
 * 도구 48개·장소 카드가 실렸다 — 할 일은 create_transfer_pair 한 번이다(2026-11-11 Terra 작은 일 door-roundtrip-starter).
 * 「… 사이에 숲길 맵을 하나 만들어서 이어 줘」는 이름을 빼도 «맵 … 만들어» 가 남아 장소 짓기 그대로다.
 */
export function linkedExistingMaps(own: string, project: Pick<Project, "maps">): readonly string[] {
  if (!LINK_MAPS_WORDS.test(own) || NEW_PLACE_WORDS.test(own)) return [];
  const named = mapsNamedIn(own, project);
  if (named.length < 2) return [];
  const pieces = [...new Set(named.flatMap((name) => name.split(/\s+/u)))].filter((piece) => piece.length >= 2).sort((x, y) => y.length - x.length);
  const rest = pieces.reduce((text, piece) => text.split(piece).join(" "), own);
  return PLACE_BUILD_WORDS.test(rest) ? [] : named;
}

const WRITE_VERB = /넣어\s*줘|만들어|추가해|바꿔\s*줘|고쳐\s*줘|놓아\s*줘|지어\s*줘|깔아\s*줘|붙여\s*줘|구현해|짜\s*줘|세워\s*줘|그려\s*줘/u;
const QUESTION = /\?\s*$|？\s*$|알려\s*줘|뭐야|뭐가 있|어디\s*있|있어\?|보여\s*줘|설명해|정리해서|요약해/u;
/** 무엇을 바꾸라는 글인가(질문·조회·설명은 아니다). 만들라는 낱말이 있으면 「…고 알려 줘」가 있어도 쓰기다(게임 속 대사를 시키는 말). */
export function asksToChange(text: string): boolean {
  const t = text.trim();
  return WRITE_VERB.test(t) || !QUESTION.test(t);
}

const ASKS_FOR_WORK = /줘|주세요|줄래|해\s*라|하자|해\s*봐|되게|하게|부탁|세워|옮겨|놓아|넣어|바꿔|지워|만들어|고쳐|추가|삭제|\b(?:please|make|add|move|put|create|change|remove|fix|build)\b/iu;
/** 시킨 일 없이 무엇을 묘사만 한 글인가(「장난감 가게」「중세 판타지 느낌」) — 빈 프로젝트에서는 첫 장소를 짓는 시작으로 본다. */
export const bareDescription = (text: string): boolean => !!text.trim() && !ASKS_FOR_WORK.test(text);

const CONTINUE_REFERENCE = /처음에\s*(?:부탁|말|요청|얘기)한\s*(?:대로|것|거|게임)|아까\s*(?:부탁|말|요청|얘기)한|(?:앞|위|이전|지난번)에(?:서)?\s*(?:부탁|말|요청|얘기)한|하던\s*(?:거|것|일|작업)\s*(?:계속|마저|이어)/u;
const CONTINUE_CORE = /계속|이어서|이어\s*(?:해|가|만들|짓|지어)|마저|남은\s*(?:거|것|일|항목|부분|작업)|끝까지|다시\s*(?:해|시도)|\bcontinue\b|\bgo on\b|keep going|carry on|finish (?:it|the rest)/iu;
const CONTINUE_FILLER = /계속|이어서|이어|마저|남은|항목|부분|작업|끝까지|다시|시도|해\s*주세요|해\s*줘|진행|만들어|지어|완성|마무리|끝내|그럼|전부|주세요|continue|go on|keep going|carry on|finish|rest|please|[거것일해줘좀응네다도을를이가은는]|\b(?:it|the)\b/giu;
/**
 * 앞 실행을 이어 하라는 글인가 — 「계속」「남은 거 마저 해 줘」「끝까지 만들어 줘」처럼 이어 하라는 말뿐인 문장이 있거나, 「처음에 부탁한 대로」로 앞 요청을 가리킨다.
 * 「이 대사 계속 나오게 해 줘」「처음부터 끝까지 맞춤법 검토해 줘」는 다른 일을 시키는 말이라 아니다.
 */
export function asksToContinue(text: string): boolean {
  if (CONTINUE_REFERENCE.test(text)) return true;
  return text.split(/[.!?\n]+/u).some((sentence) => CONTINUE_CORE.test(sentence) && !sentence.replace(CONTINUE_FILLER, " ").replace(/[^\p{L}\p{N}]+/gu, ""));
}
