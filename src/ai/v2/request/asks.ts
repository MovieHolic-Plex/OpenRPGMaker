// 요청이 이름 댄 것 — 날씨·흔들림·번쩍임·숨긴 것·엔딩·장면·대화. 끝맺음 검사가 «바란 것이 들어갔나» 를 볼 때 읽는다.

export const WEATHER_WORDS = /비가|비\s*(가\s*)?오|빗방울|빗줄기|소나기|폭우|장마|눈이\s*(오|내|와|쌓)|눈\s*내리|함박눈|폭풍|폭설|안개|날씨|천둥 ?(이|소리|번개)|rain|snow|storm|fog|weather/iu;

export const SHAKE_WORDS = /흔들리|흔들린|흔들려|흔들어|지진|진동|쿵\s*(하|소리)|earthquake|tremor|shake/iu;

export const FLASH_WORDS = /번쩍|섬광|번개(?!\s*(의\s*서|마법|기술|스킬|주문|책|의\s*검))(?!['’」』])|빛이\s*터|flash|lightning/iu;

export const HIDDEN_WORDS = /숨겨|숨은|몰래|보이지\s*않|투명|비밀|hidden|secret|invisible/iu;

export const ENDING_WORDS = /엔딩|결말|ending/iu;

/** 요청이 장면(컷신·연출)을 시켰나. */
export const SCENE_WORDS = /장면|컷신|컷씬|연출|오프닝|프롤로그|엔딩|에필로그|등장|나타나|회상|배신|본색|합류|축하|경고|첫\s*만남|만나는|이별|고백|scene|cutscene|opening|ending|flashback/iu;

/** 요청이 주고받는 대화를 시켰나. */
export const TALK_WORDS = /대화|흥정|심문|설득|협상|말다툼|수다|만나|합류|고백|배신|대사|banter|haggle|interrogat|conversation|dialogue/iu;

export const wantsEndingScene = (task: string): boolean => /엔딩|결말|ending/iu.test(task);
