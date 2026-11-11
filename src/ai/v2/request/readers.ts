// 요청 의도를 읽는 함수들 — 예전 이름 그대로, 답은 모두 intent.ts 의 한 기록에서 나온다(여기서 낱말을 다시 맞추지 않는다).
// 새 코드는 classifyRequest(task, project) 의 기록을 바로 읽는 쪽이 낫다. 이 파일은 흩어진 호출 자리들이 같은 답을 받게 하는 얇은 층이다.
import type { PiAgentRequest } from "@/ai/piAgent/protocol";
import type { Project } from "@/project/types";
import { classifyRequest, readRequest } from "./intent";
import { storeCard } from "./toolGroups";
import { withoutNegatedEncounters } from "./combat";

// ── 범위 ──
/** 이번 요청 글이 게임 하나를 만들거나 완성하라는 말인가(글만 본다 — 이어 하기 턴까지 보려면 buildsWholeGame). */
export const wantsWholeGame = (task: string): boolean => readRequest(task).scope === "wholeGame";
/** 이번 턴이 게임 하나를 짓는 일인가 — 게임 하나 요청이거나, 게임 하나로 시작한 프로젝트를 이어 하라는 요청. */
export const buildsWholeGame = (project: Project, task: string): boolean => classifyRequest(task, project).wholeGame;
/** 한 곳짜리 게임(방탈출·「방 하나」)인가 — 맵·퀘스트·진행 깊이 관문과 청사진 장소 검사가 같은 판정을 쓴다. */
export const oneProjectGame = (project: Project, task: string): boolean => classifyRequest(task, project).oneRoom;
export const wantsMakeGame = (task: string): boolean => readRequest(task).makeGame;
/** 무엇을 바꾸라는 요청인가(질문·조회·설명은 아니다). 이 요청에만 첫 호출 todo 를 강제한다. */
export const isWriteRequest = (request: Pick<PiAgentRequest, "task" | "readOnly">): boolean => !request.readOnly && readRequest(request.task).write;
/** 앞 실행이 남긴 할 일을 이어 받을 요청인가. `.test(task)` 꼴은 옛 호출 자리(정규식이던 때)를 위한 것이다. */
export const CONTINUE_WORDS = { test: (task: string): boolean => readRequest(task).continuation } as const;
/** 이미 지은 게임에 로직·대사·데이터만 넣는 요청인가 — 게임 하나·첫 장소(빈 프로젝트)·장소 짓기면 아니다. */
export const editOnlyRequest = (project: Project, task: string): boolean => classifyRequest(task, project).editOnly;
/** 이 요청에 가벼운 지시문(장소 카드·짓기 동사를 필요할 때만)을 쓰나. 끄기: OPRN_V2_LEAN_PROMPT=0 (A/B 측정용). */
export function leanPromptFor(project: Project, task: string | undefined): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.OPRN_V2_LEAN_PROMPT !== "0" && editOnlyRequest(project, task ?? "");
}

// ── 소리 ──
export const wantsMusic = (task: string): boolean => readRequest(task).audio.music;
export const wantsSound = (task: string): boolean => readRequest(task).audio.sound;
/** 곡을 «꼭 걸어야» 하는 요청인가(끝맺음 검사용). */
export const musicAsked = (task: string): boolean => readRequest(task).audio.musicAsked;
export const musicOnly = (task: string): boolean => readRequest(task).audio.musicOnly;
export const soundOnly = (task: string): boolean => readRequest(task).audio.soundOnly;
/** 소리(음악·효과음)만 바라는 요청 — 맵·이벤트 쓰기 도구를 싣지 않고, 검토자·관문의 소리 밖 지적은 참고로 낮춘다. */
export const audioOnly = (task: string): boolean => readRequest(task).audio.only;

// ── 전투·장르·바란 것 ──
/** 요청이 무작위 조우를 바랐나(조우를 이름 댔거나, 사냥·경험치처럼 조우가 있어야 되는 일) — 아니면 조수가 조우를 켜지 않는다. */
export const asksForEncounters = (task: string): boolean => readRequest(task).combat.encounters;
export const wantsBossEncounter = (task: string): boolean => readRequest(task).combat.boss;
export const wantsEndingScene = (task: string): boolean => readRequest(task).ending;
/** 퍼즐 사슬 동사를 실을 요청 — 단서·자물쇠·잠긴 방·탈출. */
export const wantsPuzzle = (task: string): boolean => readRequest(task).puzzle;

// ── 도구 묶음 ──
export const wantsGameTools = (task: string): boolean => readRequest(task).tools.game;
export const wantsMusicTools = (task: string): boolean => { const { audio } = readRequest(task); return audio.music || audio.sound; };
/** 지은 맵에 덧그리거나(물길·다리·작은 물건) 휑한 야외를 채우는 요청 — 그 도구 묶음을 만든다. */
export const wantsTerrainTools = (task: string): boolean => { const { tools } = readRequest(task); return tools.terrain || tools.dress; };
export const wantsStoreTools = (task: string): boolean => readRequest(task).tools.store;
/** 맵 동사(make_place·add_event…) 위에 덧붙일 도구 이름. */
export const v2ExtraToolNames = (task: string): string[] => [...readRequest(task).tools.extra];
export const storeTierCard = (task: string): string => storeCard(readRequest(task).tools);

// ── 끝맺음 검사가 읽는 «바란 것» ──
// 검사(judge/gameChecks · storyFlowChecks · sideEffectChecks · finishGate · requestedFeatures) 안에 박혀 있던 낱말을 그대로 옮긴 것이다(2026-11-11).
// 옛 검사처럼 요청 글 원문에 맞춘다 — 이름·메모를 가리지 않는다(가리면 같은 요청의 판정이 달라진다). 낱말을 고치려면 틀린 요청을 먼저 보인다.
const says = (words: RegExp) => (task: string): boolean => words.test(task);
const saysBoth = (a: RegExp, b: RegExp) => (task: string): boolean => a.test(task) && b.test(task);
const saysButNot = (a: RegExp, not: RegExp) => (task: string): boolean => a.test(task) && !not.test(task);

/** 추격 음악을 바랐고 전투 음악은 말하지 않았다 — 추격 곡을 전투 곡 자리에 걸면 안 된다. */
export const asksChaseNotBattleMusic = saysButNot(/추격|쫓아|쫓기|chase/iu, /전투|배틀|battle/iu);
/** 사고파는 상점을 바랐다(상점 낱말 + 사고파는 낱말). */
export const asksWorkingShop = saysBoth(/상점|가게|무기점|도구점|잡화점|장사|shop|store/iu, /팔|사고|살 수|구매|장사|문을 열|열고|열어|buy|sell/iu);
/** 때에 따라 사람이 있는 곳이 달라지길 바랐다(「밤에는 집 안에 있고」). */
export const asksTimedWhereabouts = says(/(밤|저녁|아침|낮|새벽|시간)[^.!?]{0,12}(에는|엔|이 되면|마다|동안)[^.!?]{0,20}(집|가게|광장|여관|방)\s*(안|밖)?\s*(에|으로|로)\s*(있|가|들어가|돌아가|나와|서)/u);
/** 숲·들판 같은 마을 밖 장소를 바랐다(「마을 광장」처럼 마을 안은 아니다). */
export const asksOpenField = saysButNot(/숲|들판|필드|초원/u, /마을\s*(안|광장|길|숲)|광장/u);
/** 무작위 조우를 이름 댔다 — 「조우는 없어」처럼 끄라는 말은 뺀다. 조우표가 바뀌었나 보는 검사가 읽는다(intent 의 combat.randomEncounters 와 낱말이 조금 다르다). */
export const namesRandomEncounters = (task: string): boolean => /랜덤|무작위|인카운터|마주치|조우|encounter/iu.test(withoutNegatedEncounters(task));
/** 상태 이상을 고치는 것까지 바랐다. */
export const asksCure = says(/치료|고쳐|고치|해독|낫게|cure|heal/iu);
/** 단서를 읽어 맞추는 자물쇠·퍼즐을 바랐다(단서 낱말 + 맞추기 낱말). */
export const asksClueForLock = saysBoth(/단서|쪽지|힌트|일기|메모|적혀|써\s*있|clue|hint|note/iu, /맞추|맞춰|퍼즐|비밀번호|암호|자물쇠|금고|열쇠가 나|puzzle|code/iu);
/** 시야·순찰·쫓기 같은 추격자 행동을 바랐다. */
export const asksChaserBehavior = says(/시야|추격|쫓|순찰|느낌표|「!」|patrol|chase|line of sight/iu);
/** 「…하고 나면」「다녀오면」처럼 앞 일을 마친 뒤의 일을 바랐다. */
export const asksAfterStep = says(/돌아오면|다녀오면|다녀온 (?:뒤|다음|후)|(?:하|마치|끝내|조사하|보고하|만나|잡|물리치|구하)고 (?:나서|나면|오면|돌아)|한 (?:뒤|다음|후)에?|끝나면|마치면|이후에/u);
/** 회상이 화면에 보이길 바랐다(회상 낱말 + 보이는 낱말). */
export const asksShownFlashback = saysBoth(/회상|과거 장면|과거의 장면|옛날 장면|플래시백|flashback/iu, /보이|나오|나와|등장|화면|장면/u);
/** 「1막 끝」처럼 막이 끝나는 자리를 바랐다. */
export const asksActEnd = says(/제\s*\d+\s*막\s*끝|막이?\s*끝나|막 끝/u);
export const asksLetterbox = says(/레터박스|검은 띠|letterbox/iu);
/** 새 게임을 만든다고 말했다 — 타이틀 검사가 «새 게임인가» 를 볼 때만 쓴다(범위 판정은 wantsWholeGame·buildsWholeGame). */
export const saysNewGame = says(/게임을? (하나 )?만들|게임 하나|새 게임|만들고 싶어/u);
export const asksOpening = says(/오프닝|opening|시작할 때 나오|처음 (시작할 때|나오는)/iu);
export const asksComboSkill = says(/연계|합체기|협동 기술|콤보 기술|같이 쓰는 (기술|필살기)|combo/iu);
/** 날마다 달라지는 것을 바랐다. */
export const asksPerDay = says(/날마다|매일|하루하루|하루마다|일차마다|날짜마다|요일마다|날이 바뀔 때마다|\d+\s*일차|each day|every day|per day/iu);

/** 전투 데이터(기술·장비·직업)를 지우라고 했다 — 메뉴·화면에서 빼라는 말은 아니다. */
export const asksBattleDataRemoval = saysButNot(/(스킬|기술|장비|직업|전투\s*명령|skill|equip)[^.!?\n]{0,10}(지워|지우|없애|삭제|비워|빼앗|못\s*쓰게|배우지)/iu, /메뉴|탭|ESC|화면|창에서|창의|HUD|menu/iu);
/** 그림·외형을 바꾸라고 했다. */
export const asksLookChange = says(/그림|외형|모습|얼굴|옷|칩|graphic|sprite|face/iu);
/** 무엇을 지우라고 했다. */
export const asksRemoval = says(/지워|지우|삭제|없애|빼\s*줘|빼고|치워|remove|delete/iu);
/** 자료집 묶음마다 «그 종류를 고쳐도 되는» 요청 낱말 — 이름을 안 불러도 그 종류를 가리키면 고치기가 정상이다. */
const DATA_CHANGE_WORDS: Readonly<Record<string, RegExp>> = {
  actors: /주인공|동료|파티|합류|이름|직업|레벨|능력치|hero|party/iu,
  classes: /직업|레벨|스킬|기술|배우|class|skill|level/iu,
  enemies: /보스|적|몬스터|약점|약하|약해|내성|강하게|속성|난이도|어렵|쉽|밸런스|이기|체력|공격력|boss|enemy|weak/iu,
  skills: /기술|스킬|마법|위력|MP|마나|공격|회복|skill|spell/iu,
  items: /가격|값|상점|가게|아이템|장비|무기|방어구|갑옷|회복약|포션|price|item|weapon|armor/iu,
};
/** 요청이 자료집의 그 묶음(actors·classes·enemies·skills·items·weapons·armors)을 고치라고 가리켰나. */
export const asksDataChange = (section: string, task: string): boolean => !!DATA_CHANGE_WORDS[section === "weapons" || section === "armors" ? "items" : section]?.test(task);

/** 설정만 바꾸는 요청(휴대폰 조작·팡파레…) — 프로젝트의 맵·데이터가 안 바뀌어도 정상이다. */
export const asksSettingOnly = saysButNot(/휴대폰|모바일|터치|탭하면|진동|조이스틱|달리기 단추|레벨 ?업|팡파레|달려들|도움말/u, /만들|두고|세워|놓아|놔|추가/u);
/** 스토어 일만 바라는 요청(평가 읽기·답글·소식) — 만들기·고치기 동사가 없다. */
export const asksStoreOnly = (task: string): boolean => wantsStoreTools(task) && !/만들|추가|넣어|놓아|세워|지어|고쳐|바꿔|옮겨|줄여|늘려/u.test(task);
/** 묻거나 보여 달라는 말로 끝난다 — «아무것도 안 바꿨다» 검사를 걸지 않는다(범위 판정 scope:"question" 과 낱말이 다르다). */
export const asksToBeTold = (task: string): boolean => /\?\s*$|알려\s*줘|뭐야|어디|있어\?|보여\s*줘|설명|정리해서|요약/u.test(task.trim());

/** 요청이 이름 댄 핵심 장치 — 「없이·빼고·말고」가 바로 뒤에 붙으면 요청이 아니다. 게임에 있나는 judge/requestedFeatures.ts 가 본다. */
const NOT_WANTED = String.raw`(?![^.!?\n]{0,10}(?:없이|없는|없게|않|빼고|빼 ?줘|빼 ?주|말고|아니라|아닌|아니고|제외|싫))`;
const FEATURE_WORDS = {
  chaser: new RegExp(String.raw`(?:쫓아\s*오|쫓기(?:는|며|다|면서)|(?:나|주인공|플레이어|우리|아이들?)를\s*쫓는|쫓는\s*(?:괴물|귀신|살인마|놈|그림자|추격자|존재)|추격자|추격\s*(?:당|해\s*오)|따라\s*오는\s*(?:괴물|귀신|그것|놈|무언가|그림자|존재)|chaser|stalker|chased by|chases you)` + NOT_WANTED, "iu"),
  darkness: new RegExp(String.raw`(?:어둡|어두운\s*(?:분위기|톤|복도|방|저택|집|학교|숲|동굴|곳|밤|공간|건물|지하|병원|골목)|어둠\s*속|캄캄|깜깜|암전|손전등|불\s*꺼진|정전|darkness|dark\s+(?:room|hallway|corridor|mansion|house|school)|flashlight|lights?\s+out)` + NOT_WANTED, "iu"),
  hiding: new RegExp(String.raw`(?:(?:옷장|침대|장롱|사물함|캐비닛|책상|커튼)[^.!?\n]{0,6}숨|숨을\s*(?:곳|데|수)|숨는\s*(?:곳|장소|공간)|숨어서\s*(?:피|도망|버티|기다)|숨바꼭질|은신|hiding\s+(?:spot|place)|hide\s+(?:in|from|under))` + NOT_WANTED, "iu"),
} as const;
export type RequestedFeatureId = keyof typeof FEATURE_WORDS;
/** 요청이 그 장치를 이름 댔으면 맞은 낱말(증거 글에 싣는다), 아니면 undefined. */
export const requestedFeatureWord = (id: RequestedFeatureId, task: string): string | undefined => task.match(FEATURE_WORDS[id])?.[0];
