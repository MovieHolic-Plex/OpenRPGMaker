// 조수 v2 «음악 요청» 낱말 — 음악 도구 묶음을 실을지(game.ts)와 끝맺음 음악 검사(gameChecks.ts)가 같은 판정을 쓴다.
//
// 왜(2026-10-30 실조수 스토어 음악 e2e 5/8): 「테일즈런너처럼 신나는 거 마을에 깔아 줘」「투더문처럼 잔잔하게 엔딩곡」에는
// 음악·배경음·bgm 낱말이 없어 음악 도구가 실리지 않았고, 조수는 도구 없이 마을을 다시 짓고 엔딩 이벤트를 새로 만들었다.
// 게임 이름은 스토어 음악 표(storeMusicPick GAME_FEELS) 하나에서 가져온다 — 표에 줄을 더하면 여기서도 맞는다.
import { STORE_MUSIC_GAME_NAME_SOURCE } from "@/assetStore/storeMusicPick";

/** 곡을 가리키는 낱말(음악·브금·사운드…). 「노래」는 부르는 장면(노래를 부르다·노래하다)이 아닐 때만. */
const PLAIN = String.raw`음악|배경\s*음|배경곡|브금|비지엠|bgm|\bost\b|오에스티|사운드트랙|사운드|선율|멜로디|팡파르|팡파레|soundtrack|music|fanfare|노래(?!\s*(?:를|을)?\s*(?:부르|불러|불렀|하[는다며고면여]|해|했))`;
/**
 * 「~곡」: 장면 이름에 붙은 곡(엔딩곡·전투곡·보스곡…)과 곡을 넣고 바꾸는 말. 아무 「곡」이나 맞추면 계곡·굴곡·곡괭이·곡선이 걸린다.
 */
const GOK = String.raw`(?:엔딩|테마|전투|보스|타이틀|마을|필드|던전|승리|오프닝|주제|메인|배경|슬픈|신나는|잔잔한|신나|잔잔|크레딧|결말|마지막)\s*곡|곡\s*(?:을|를|이|으로|로|도|만|좀)?\s*(?:넣|바꿔|바꾸|바꿀|깔|틀|걸|골라|고르|추천|찾아|필요)`;
/** 「X처럼/X 느낌/X풍/X 같은」 — 스토어 음악 표의 게임 이름 + 결을 빌리는 말. 이름만 있는 요청(「포켓몬 마을」)은 음악 요청으로 보지 않는다. */
const GAME_FEEL = String.raw`(?:${STORE_MUSIC_GAME_NAME_SOURCE})\s*(?:의\s*)?(?:느낌|처럼|풍|같은|같이|같게|스타일|분위기|st\b|style)`;

/** 음악 요청 판정(플래그 iu, g 없음 — .test 를 되풀이해도 안전). */
export const MUSIC_REQUEST_WORDS = new RegExp(`${PLAIN}|${GOK}|${GAME_FEEL}`, "iu");

export function wantsMusic(task: string): boolean {
  return MUSIC_REQUEST_WORDS.test(task);
}

const EXPLICIT = new RegExp(`${PLAIN}|${GOK}`, "iu");
const FEEL = new RegExp(GAME_FEEL, "iu");
const BUILD = /만들|지어|짓|그려|세워|build|make/iu;
/**
 * 끝맺음 검사용: 곡을 «꼭 걸어야» 하는 요청인가. 게임 이름의 결(「파판처럼 마을 만들어」)은 도구는 싣지만(wantsMusic)
 * 무언가를 짓는 요청이면 화풍을 말한 것일 수 있어 곡을 요구하지 않는다. 「테일즈런너처럼 신나는 거 깔아 줘」는 요구한다.
 */
export function musicAsked(task: string): boolean {
  return EXPLICIT.test(task) || (FEEL.test(task) && !BUILD.test(task));
}
