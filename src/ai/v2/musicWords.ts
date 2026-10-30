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
  return MUSIC_REQUEST_WORDS.test(withoutSoundWords(task));
}

const EXPLICIT = new RegExp(`${PLAIN}|${GOK}`, "iu");
const FEEL = new RegExp(GAME_FEEL, "iu");
const BUILD = /만들|지어|짓|그려|세워|build|make/iu;
/**
 * 끝맺음 검사용: 곡을 «꼭 걸어야» 하는 요청인가. 게임 이름의 결(「파판처럼 마을 만들어」)은 도구는 싣지만(wantsMusic)
 * 무언가를 짓는 요청이면 화풍을 말한 것일 수 있어 곡을 요구하지 않는다. 「테일즈런너처럼 신나는 거 깔아 줘」는 요구한다.
 */
export function musicAsked(task: string): boolean {
  const t = withoutSoundWords(task);
  return EXPLICIT.test(t) || (FEEL.test(t) && !BUILD.test(t));
}

/** 곡 낱말과 바로 뒤 한 낱말(「곡 만들어」「음악 추가」) — 음악 일 자체의 동사라 «다른 일» 판정에서 뺀다. */
const MUSIC_PHRASE = new RegExp(String.raw`(?:${PLAIN}|곡)\S*\s*(?:을|를|이|가|도|만|좀|으로|로)?\s*(?:하나\s*|새로\s*)?\S*`, "giu");
/** 음악 밖의 일을 시키는 말 — 짓기·고치기·이벤트·사람. */
const OTHER_WORK = /만들|지어|짓|그려|세워|고쳐|추가|배치|놓아|놔\s*줘|옮겨|지워|없애|삭제|이벤트|퀘스트|대사|npc|\bbuild\b|\bmake\b|\bcreate\b|\badd\b/iu;
/**
 * 음악만 바라는 요청인가(「아오오니 느낌으로 추격 음악」「투더문처럼 잔잔하게 엔딩곡」「테일즈런너처럼 신나는 거 마을에 깔아 줘」).
 * 이런 요청은 곡을 찾고·넣고·거는 일만 한다 — 맵·이벤트 쓰기 도구를 싣지 않고, 검토자·끝맺음 관문의 음악 밖 지적은 일감이 아니라 참고다.
 * 왜(2026-10-30 실조수 e2e r12): 「추격 음악」 한 줄에 검토자의 «체크포인트가 추격자 시야 안» 우려가 관문 글로 넘어가 조수가 상자를 찍고
 * make_chase_scene 을 부르려 했다. 「보스 만들고 보스곡 넣어 줘」처럼 다른 일이 섞이면 음악만이 아니다.
 */
export function musicOnly(task: string): boolean {
  return musicAsked(task) && !OTHER_WORK.test(task.replace(MUSIC_PHRASE, " "));
}

/**
 * 효과음 요청 낱말 — 효과음 도구(store_find_sound·set_game_audio role:'se'|'sfx-style')를 실을지. 음악 낱말의 짝이다.
 * 「사운드」 혼자는 음악 낱말(PLAIN)에도 있어 음악 묶음이 같이 실린다 — 둘 다 실어도 된다.
 * 「발소리」는 걷는 소리만(「발소리가 들리는 장면 만들어」처럼 장면을 짓는 말은 OTHER_WORK 가 음악·효과음만이 아닌 일로 가른다).
 */
const SOUND_PLAIN = String.raw`효과음|사운드\s*이펙트|사운드\s*효과|\bsfx\b|\bse\b|sound\s*effects?|타격음|피격음|발소리|발자국\s*소리|발걸음\s*소리|커서\s*소리|결정음|취소음|메뉴\s*소리|버튼\s*소리|레벨\s*업\s*소리|레벨업\s*소리|획득음|문\s*(?:여는|닫는)\s*소리|마법\s*소리|공격\s*소리|칼\s*소리|베는\s*소리|맞는\s*소리|때리는\s*소리|쓰러지는\s*소리`;
export const SOUND_REQUEST_WORDS = new RegExp(SOUND_PLAIN, "iu");
const SOUND_WORDS_G = new RegExp(SOUND_PLAIN, "giu");
/** 효과음 낱말을 지운 요청 — 「사운드 이펙트」의 「사운드」가 음악 낱말로 잡히지 않게 음악 판정은 이걸 본다. */
function withoutSoundWords(task: string): string {
  return task.replace(SOUND_WORDS_G, " ");
}

export function wantsSound(task: string): boolean {
  return SOUND_REQUEST_WORDS.test(task);
}

const SOUND_PHRASE = new RegExp(String.raw`(?:${SOUND_PLAIN})\S*\s*(?:을|를|이|가|도|만|좀|으로|로)?\s*(?:하나\s*|새로\s*|전부\s*|다\s*)?\S*`, "giu");

/** 효과음만 바라는 요청(「타격음 더 묵직하게」「효과음 전부 레트로로」) — 음악만 바라는 요청과 같은 범위 규칙을 따른다. */
export function soundOnly(task: string): boolean {
  return wantsSound(task) && !OTHER_WORK.test(task.replace(SOUND_PHRASE, " ").replace(MUSIC_PHRASE, " "));
}

/** 소리(음악·효과음)만 바라는 요청 — 맵·이벤트 쓰기 도구를 싣지 않고, 검토자·관문의 소리 밖 지적은 참고로 낮춘다. */
export function audioOnly(task: string): boolean {
  return musicOnly(task) || soundOnly(task);
}
