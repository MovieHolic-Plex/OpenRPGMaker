/**
 * 도트 연출·이펙트 시트 검색용 한국어/영어 낱말 색인.
 * 시트 키는 영어(`mage_chain_bolt`)인데 저자와 조수는 「번개」로 찾는다. 이 파일이 둘 사이의 사전이다.
 * 조수 도구(list_fx_sheets·list_retro_choreographies)와 편집기 갤러리가 같은 함수를 쓴다.
 * 순수 데이터·함수만 둔다(카탈로그를 import 하지 않아 순환이 없다).
 */

/** 속성별 동의어 묶음. 어느 낱말로 물어도 같은 묶음 전체로 넓혀 찾는다. */
export const RETRO_ELEMENT_ALIASES: Readonly<Record<string, { readonly ko: readonly string[]; readonly en: readonly string[] }>> = {
  thunder: { ko: ["번개", "전기", "뇌전", "벼락", "천둥", "낙뢰", "감전"], en: ["thunder", "bolt", "lightning", "chain", "volt", "spark", "shock", "electric"] },
  fire: { ko: ["불", "불꽃", "화염", "화룡", "용암", "지옥불", "불길", "폭염"], en: ["fire", "flame", "ember", "burn", "inferno", "magma", "lava", "hellfire", "foxfire", "ninefire", "fireball"] },
  ice: { ko: ["얼음", "빙", "서리", "냉기", "눈보라", "동결", "눈"], en: ["ice", "frost", "blizzard", "freeze", "snow", "glacier", "snowball"] },
  water: { ko: ["물", "파도", "해일", "폭포", "빗물", "비", "물결"], en: ["water", "wave", "tide", "tidal", "rain", "aqua", "flood", "splash", "whirlpool", "maelstrom", "falls"] },
  wind: { ko: ["바람", "회오리", "돌풍", "태풍", "질풍", "폭풍"], en: ["wind", "gale", "gust", "tornado", "cyclone", "storm", "sylph"] },
  earth: { ko: ["땅", "대지", "지진", "바위", "모래", "돌", "낙석", "암석"], en: ["earth", "quake", "rock", "stone", "boulder", "sand", "rockfall", "avalanche", "crack", "landslide", "pebbles"] },
  holy: { ko: ["성", "성스러운", "신성", "축복", "빛", "심판", "천사", "치유", "정화"], en: ["holy", "light", "smite", "bless", "blessing", "divine", "angel", "radiant", "halo", "sanctuary", "purify", "judgment", "seraph"] },
  dark: { ko: ["암흑", "어둠", "저주", "그림자", "흡혈", "피", "악몽", "죽음", "독"], en: ["dark", "shadow", "curse", "void", "blood", "skull", "nightmare", "doom", "abyss", "eclipse", "drain", "poison", "venom", "toxic", "hex"] },
};

/** 영어 낱말(시트 키 조각) → 한국어 낱말. 키를 한국어로 읽을 수 있게 한다. */
const KEY_WORDS_KO: Readonly<Record<string, readonly string[]>> = {
  hit: ["명중", "타격"], sky: ["하늘", "전체", "낙하"], wave: ["파동", "물결"], slash: ["베기", "참격"], blast: ["폭발", "폭풍"],
  burst: ["폭발", "터짐"], orb: ["구슬", "구체"], meteor: ["운석", "유성"], storm: ["폭풍"], roar: ["포효", "울부짖음"], whirl: ["회전", "소용돌이"],
  spin: ["회전"], flame: ["불꽃"], fire: ["불", "화염"], fireball: ["화염구", "불덩이"], frost: ["서리", "냉기"], ice: ["얼음"], blizzard: ["눈보라"],
  thunder: ["번개", "천둥"], lightning: ["번개"], bolt: ["번개", "화살"], chain: ["사슬", "번개", "연쇄"], chains: ["사슬"], spark: ["불꽃", "전기"],
  shock: ["충격", "감전"], water: ["물"], tide: ["조수", "파도"], rain: ["비"], wind: ["바람"], gale: ["돌풍"], cyclone: ["회오리"], gust: ["돌풍"],
  earth: ["땅", "대지"], quake: ["지진"], rock: ["바위"], rockfall: ["낙석"], boulder: ["바위"], stone: ["돌"], sand: ["모래"], holy: ["성스러운", "신성"],
  light: ["빛"], smite: ["응징", "강타"], judgment: ["심판"], cross: ["십자가", "십자"], halo: ["후광"], heal: ["치유", "회복"], mend: ["치유"], revive: ["부활"],
  blessing: ["축복"], purify: ["정화"], sanctuary: ["성역"], dark: ["암흑", "어둠"], shadow: ["그림자"], curse: ["저주"], blood: ["피", "흡혈"],
  skull: ["해골"], doom: ["파멸", "종말"], abyss: ["심연"], eclipse: ["일식"], drain: ["흡수", "흡혈"], poison: ["독"], venom: ["독"], toxic: ["독"], acid: ["산", "독"],
  sword: ["검"], blade: ["칼날", "검"], blades: ["칼날"], edge: ["칼날"], axe: ["도끼"], spear: ["창"], lance: ["창"], javelin: ["투창"], arrow: ["화살"],
  bow: ["활"], bullet: ["총알", "탄환"], gun: ["총"], bomb: ["폭탄"], grenade: ["수류탄"], missile: ["미사일"], rocket: ["로켓"], shell: ["포탄", "껍질"],
  claw: ["발톱", "할퀴기"], fang: ["송곳니"], bite: ["물기"], tail: ["꼬리"], wing: ["날개"], wings: ["날개"], feather: ["깃털"], talon: ["갈퀴", "발톱"],
  kick: ["발차기"], fist: ["주먹"], palm: ["장풍", "손바닥"], punch: ["주먹"], uppercut: ["어퍼컷"], slam: ["내려찍기"], smash: ["강타", "박살"], crash: ["충돌"],
  crush: ["분쇄"], charge: ["돌격", "충전"], dash: ["돌진"], dive: ["급강하"], leap: ["도약"], thrust: ["찌르기"], pierce: ["관통"], stab: ["찌르기"],
  cleave: ["쪼개기"], rend: ["찢기"], flurry: ["연타"], frenzy: ["광란"], rampage: ["난동"], barrage: ["연속포화"], volley: ["일제사격"], ricochet: ["도탄"],
  shield: ["방패"], barrier: ["방벽", "결계"], wall: ["벽"], ward: ["수호"], aura: ["기운", "오라"], buff: ["강화"], banner: ["깃발"], warcry: ["함성"],
  smoke: ["연기"], cloud: ["구름"], mist: ["안개"], fog: ["안개"], dust: ["먼지"], ring: ["고리"], rings: ["고리"], beam: ["광선"], ray: ["광선"], eye: ["눈"],
  gaze: ["시선"], breath: ["숨결", "브레스"], howl: ["울부짖음"], scream: ["비명"], wail: ["통곡"], shriek: ["비명"], screech: ["비명"], bark: ["짖기"],
  web: ["거미줄"], net: ["그물"], vine: ["덩굴"], vines: ["덩굴"], roots: ["뿌리"], thorn: ["가시"], leaf: ["잎"], petal: ["꽃잎"], petals: ["꽃잎"], bloom: ["개화", "꽃"],
  flower: ["꽃"], tree: ["나무"], seed: ["씨앗"], seeds: ["씨앗"], moon: ["달"], moonbeam: ["달빛"], star: ["별"], starfall: ["별똥별"], sun: ["태양"], sunfire: ["태양불"],
  dragon: ["용"], demon: ["악마"], devil: ["악마"], angel: ["천사"], ghost: ["유령"], ghostfire: ["도깨비불"], spirit: ["정령", "영혼"], soul: ["영혼"], wisp: ["도깨비불"],
  skeleton: ["해골"], zombie: ["좀비"], vampire: ["흡혈귀"], bat: ["박쥐"], bats: ["박쥐"], wolf: ["늑대"], dog: ["개"], cat: ["고양이"], horse: ["말"], bear: ["곰"],
  fox: ["여우"], snake: ["뱀"], serpent: ["뱀"], lion: ["사자"], tiger: ["호랑이"], crow: ["까마귀"], hawk: ["매"], slime: ["슬라임"], mushroom: ["버섯"],
  coin: ["동전"], dice: ["주사위"], card: ["카드"], cards: ["카드"], gem: ["보석"], crystal: ["수정"], crown: ["왕관"], scepter: ["홀"], contract: ["계약"],
  gear: ["톱니"], clockwork: ["태엽"], robot: ["로봇"], mecha: ["메카"], drill: ["드릴"], saw: ["톱"], trap: ["덫"], bind: ["속박"], rune: ["룬"], runes: ["룬"],
  book: ["책"], paper: ["종이"], scroll: ["두루마리"], pages: ["책장"], cauldron: ["솥"], flask: ["플라스크"], vial: ["약병"], vials: ["약병"], elixir: ["영약"],
  tea: ["차"], broom: ["빗자루"], plate: ["접시"], knife: ["칼"], fork: ["포크"], hammer: ["망치"], pick: ["곡괭이"], wheat: ["밀"], hay: ["건초"],
  ship: ["배"], galleon: ["갤리온"], gunboat: ["포함"], airship: ["비행선"], balloon: ["풍선"], ufo: ["비행접시"], tank: ["전차"], cannonball: ["포탄"], broadside: ["현측포격"],
  laser: ["레이저"], nova: ["초신성"], prism: ["프리즘"], gravity: ["중력"], warp: ["왜곡", "순간이동"], clone: ["분신"], afterimage: ["잔상"], vanish: ["사라짐"],
  slow: ["감속", "둔화"], haste: ["가속"], stop: ["정지"], rewind: ["되감기"], sleep: ["수면"], paralyze: ["마비"], petrify: ["석화"], freeze: ["동결"], weaken: ["약화"],
  steal: ["훔치기"], heist: ["도둑질"], backstab: ["기습"], ambush: ["매복"], counter: ["반격"], parry: ["막기"], riposte: ["반격"], taunt: ["도발"],
  explosion: ["폭발"], impact: ["충격"], final: ["마지막", "최후"], grand: ["웅장한", "거대한"], mega: ["거대한"], titan: ["거인"], giant: ["거인"],
  festival: ["축제"], carnival: ["축제"], confetti: ["색종이"], music: ["음악"], notes: ["음표"], hymn: ["찬송"], requiem: ["진혼곡"], lullaby: ["자장가"], dance: ["춤"], waltz: ["왈츠"],
};

/** 동작 이름(레코드 motion 값) → 한국어. 편집기 라벨과 같은 뜻이다. */
export const RETRO_MOTION_WORDS_KO: Readonly<Record<string, readonly string[]>> = {
  "dash-strike": ["파고들어 베기", "돌진", "베기"], "leap-strike": ["뛰어올라 내려찍기", "도약", "내려찍기"], "blink-strike": ["순간이동 베기", "순간이동", "베기"],
  flurry: ["연속 베기", "연속", "연타"], spin: ["회전 베기", "회전"], cast: ["제자리 시전", "시전", "마법"], shoot: ["제자리 사격", "사격", "발사"],
  buff: ["제자리 강화", "강화", "버프"], finisher: ["필살기", "마무리"], lunge: ["돌진 물기", "돌진", "물기"], breath: ["숨결", "브레스"], stomp: ["짓밟기", "밟기"],
};

/** 기본 배치(어느 계열/위치) 이름도 한국어로 찾게 한다. */
export const RETRO_ANCHOR_WORDS_KO: Readonly<Record<string, readonly string[]>> = {
  user: ["시전자", "자신"], target: ["대상", "적"], allTargets: ["대상 전원", "전체 적"], allAllies: ["아군 전원", "전체 아군"], screen: ["화면", "전체 화면"], projectile: ["투사체", "날아가는"],
};

/** 시트 키에서 영어 낱말 조각을 뽑는다(`mage_chain_bolt` → mage, chain, bolt). */
export function keyTokens(key: string): string[] {
  return key.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

/** 키 조각을 한국어 낱말로 옮긴 문자열(색인 건초더미에 붙인다). */
export function koreanWordsOfKey(key: string): string {
  const out: string[] = [];
  for (const token of keyTokens(key)) {
    const words = KEY_WORDS_KO[token];
    if (words) out.push(...words);
  }
  return out.join(" ");
}

/** 한국어 문장에서 두 글자 이상 낱말만 뽑는다(조사는 그대로 두고 부분 문자열로 맞춘다). */
export function hangulWords(text: string): string[] {
  return (text.match(/[가-힣]{2,}/g) ?? []);
}

/** 질의 낱말 하나를 동의어 묶음으로 넓힌다. 일치하는 묶음이 없으면 [낱말] 그대로. */
export function expandQueryWord(word: string): readonly string[] {
  const w = word.toLowerCase();
  const out = new Set<string>([w]);
  for (const group of Object.values(RETRO_ELEMENT_ALIASES)) {
    if (group.ko.includes(w) || group.en.includes(w)) for (const alias of [...group.ko, ...group.en]) out.add(alias);
  }
  for (const [english, koreans] of Object.entries(KEY_WORDS_KO)) {
    if (koreans.includes(w)) out.add(english);
  }
  for (const [motion, koreans] of Object.entries(RETRO_MOTION_WORDS_KO)) {
    if (motion === w || koreans.some((ko) => ko === w)) out.add(motion);
  }
  return [...out];
}

/**
 * 공백 = AND. 낱말마다 (그 낱말 또는 동의어)가 건초더미에 있으면 통과.
 * 한 글자 낱말(「성」「불」)은 부분 문자열로 넓게 걸리면 잡음이라 동의어로만 찾는다.
 */
export function retroQueryMatches(query: string | undefined, hay: string): boolean {
  const words = (query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = hay.toLowerCase();
  return words.every((word) => {
    // 한 글자 한글은 부분 문자열로 넓게 걸려 잡음이 되므로, 동의어(두 글자 이상·영어)로만 찾는다. 동의어가 없으면 그대로.
    const expanded = expandQueryWord(word);
    const wide = expanded.filter((item) => !(item.length === 1 && /[가-힣]/.test(item)));
    const candidates = wide.length > 0 ? wide : [word];
    return candidates.some((candidate) => text.includes(candidate));
  });
}

/** 연출 하나의 검색 건초더미: 원문 + 레이어 키의 한국어 + 동작·위치·속성 한국어. */
export function retroChoreographyHay(fields: { readonly id: string; readonly name: string; readonly description: string; readonly className?: string; readonly layerKeys: readonly string[]; readonly motion: string; readonly element?: string; readonly anchors?: readonly string[] }): string {
  const motion = RETRO_MOTION_WORDS_KO[fields.motion]?.join(" ") ?? "";
  const anchors = (fields.anchors ?? []).map((anchor) => RETRO_ANCHOR_WORDS_KO[anchor]?.join(" ") ?? "").join(" ");
  const element = fields.element ? [...(RETRO_ELEMENT_ALIASES[fields.element]?.ko ?? []), ...(RETRO_ELEMENT_ALIASES[fields.element]?.en.slice(0, 3) ?? [])].join(" ") : "";
  const keys = fields.layerKeys.join(" ");
  const keyKo = [...new Set(fields.layerKeys)].map(koreanWordsOfKey).join(" ");
  return `${fields.id} ${fields.name} ${fields.description} ${fields.className ?? ""} ${keys} ${keyKo} ${fields.motion} ${motion} ${anchors} ${element}`;
}
