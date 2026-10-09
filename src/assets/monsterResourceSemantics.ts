// 몬스터 리소스의 한국어 색인. 리소스 id 는 영어 어간(`generated-enemy-skeleton-archer`)인데
// 저작 이름은 한국어("해골 궁수")로 들어와 `searchResources("monster", "해골")` 이 0건이었다 —
// 그래서 모델이 monsterResourceId 를 아예 빼버리고 이미지 없는 적 레코드가 저장됐다.
// 어간은 `src/project/defaults/generatedEnemyRecords.ts` 의 한국어 이름 ↔ 리소스 id 쌍에서 뽑았다.
// 키는 한국어 낱말, 값은 리소스 id 에 실제로 나타나는 영어 어간.

const KOREAN_MONSTER_STEMS: Readonly<Record<string, readonly string[]>> = {
  // 종족·형태
  슬라임: ["slime"],
  젤리: ["slime"],
  점액: ["ooze"],
  우즈: ["ooze"],
  박쥐: ["bat"],
  골렘: ["golem"],
  용: ["dragon"],
  드래곤: ["dragon"],
  청룡: ["dragon", "blue"],
  비룡: ["wyvern"],
  와이번: ["wyvern"],
  실프: ["sylph"],
  정령: ["spirit"],
  좀비: ["zombie"],
  해골: ["skeleton"],
  스켈레톤: ["skeleton"],
  뼈: ["bonepile", "skeleton", "bone"],
  오크: ["orc"],
  유령: ["ghost"],
  고스트: ["ghost"],
  망령: ["wraith"],
  스펙터: ["specter"],
  구울: ["ghoul"],
  리치: ["lich"],
  미라: ["mummy"],
  밴시: ["banshee"],
  사령: ["revenant"],
  게: ["crab"],
  거미: ["spider"],
  뱀: ["snake"],
  독사: ["snake", "viper"],
  전갈: ["scorpion"],
  늑대: ["wolf"],
  울프: ["wolf"],
  하피: ["harpy"],
  지네: ["centipede"],
  식물: ["plant"],
  식충: ["plant", "carnivore"],
  말: ["horse"],
  유니콘: ["unicorn"],
  샐러맨더: ["salamander"],
  도마뱀: ["salamander", "lizardman"],
  리자드맨: ["lizardman"],
  카벙클: ["carbuncle"],
  고양이: ["cat"],
  캇파: ["kappa"],
  갓파: ["kappa"],
  코카트리스: ["cockatrice"],
  기생충: ["parasite"],
  사마귀: ["mantis"],
  잭오랜턴: ["jackolantern"],
  호박: ["jackolantern"],
  물고기: ["fish"],
  피라냐: ["fish", "piranha"],
  벌: ["bee"],
  말벌: ["hornet"],
  꿀벌: ["bee"],
  딱정벌레: ["beetle"],
  나방: ["moth"],
  지렁이: ["worm"],
  벌레: ["worm", "beetle"],
  개미: ["ant"],
  멧돼지: ["boar"],
  곰: ["bear"],
  호랑이: ["tiger"],
  검치호: ["tiger", "saber"],
  쥐: ["rat"],
  새: ["bird"],
  매: ["bird", "hawk"],
  독수리: ["bird", "hawk"],
  염소: ["goat"],
  산양: ["goat", "mountain"],
  사냥개: ["hound"],
  유인원: ["ape"],
  원숭이: ["ape"],
  사슴: ["deer"],
  도깨비불: ["wisp"],
  위스프: ["wisp"],
  운디네: ["undine"],
  갑옷: ["armor"],
  검: ["sword"],
  미믹: ["mimic"],
  허수아비: ["scarecrow"],
  인형: ["puppet"],
  토템: ["totem"],
  고블린: ["goblin"],
  코볼트: ["kobold"],
  산적: ["bandit"],
  도적: ["bandit"],
  마법사: ["mage"],
  기사: ["knight"],
  미노타우로스: ["minotaur"],
  미노타우르스: ["minotaur"],
  켄타우로스: ["centaur"],
  트롤: ["troll"],
  오거: ["ogre"],
  임프: ["imp"],
  오징어: ["squid"],
  상어: ["shark"],
  뱀장어: ["eel"],
  장어: ["eel"],
  그리핀: ["griffin"],
  로크: ["roc"],
  가고일: ["gargoyle"],
  불사조: ["phoenix"],
  피닉스: ["phoenix"],
  히드라: ["hydra"],
  베히모스: ["behemoth"],
  마왕: ["demon", "lord"],
  악마: ["demon"],
  데몬: ["demon"],
  천사: ["angel"],
  눈알: ["eye"],

  // 속성·재질·색
  불: ["fire", "flame"],
  화염: ["fire", "flame"],
  물: ["water"],
  땅: ["earth"],
  대지: ["earth"],
  바람: ["wind", "air"],
  빛: ["light"],
  어둠: ["dark"],
  얼음: ["frost"],
  서릿: ["frost"],
  전기: ["electric"],
  산성: ["acid"],
  금속: ["metal"],
  철: ["iron"],
  돌: ["stone"],
  바위: ["rock"],
  석상: ["stone"],
  수정: ["crystal"],
  점토: ["clay"],
  모래: ["sand"],
  붉은: ["red"],
  푸른: ["blue"],
  파란: ["blue"],
  초록: ["green"],
  회색: ["grey"],
  검은: ["black"],
  갈색: ["brown"],
  창백한: ["pale"],

  // 장소·역할·수식
  동굴: ["cave"],
  숲: ["forest"],
  무덤: ["grave"],
  지옥: ["hell"],
  심해: ["deep"],
  하늘: ["sky"],
  절벽: ["cliff"],
  미로: ["maze"],
  평원: ["plains"],
  궁수: ["archer"],
  전사: ["warrior"],
  주술사: ["shaman"],
  정찰: ["scout"],
  정찰병: ["scout"],
  광부: ["digger"],
  병정: ["soldier"],
  거대: ["giant"],
  새끼: ["whelp"],
  타락: ["fallen"],
  저주: ["cursed"],
  왕: ["king"],
  큐브: ["cube"],
  흡혈: ["vampire"],
  과부: ["widow"],
  다이어: ["dire"],
  송곳니: ["tusk"],
  칼날: ["blade"],
  가루: ["dust"],
  복면: ["mask"],
  살아있는: ["living"],
  부유하는: ["flying", "floating"],
};

// Compound creature identities belong to these exact resources, not every asset
// containing "leaf" or "fire" (a leafling/mantis is not a leaf fox).
const RESOURCE_IDENTITY_TAGS: Readonly<Record<string, readonly string[]>> = {
  "generated-enemy-leaf-fox": ["풀잎여우", "풀잎 여우", "풀잎", "여우"],
  "generated-enemy-fire-pup": ["불꽃강아지", "불꽃 강아지", "불씨강아지", "불씨 강아지", "불꽃", "불씨", "강아지"],
  "generated-enemy-sparkit-fire": ["스파킷"],
};

/** 어간 → 그 어간을 가리키는 한국어 낱말들. 리소스 태그를 붙일 때 쓰는 역색인. */
const KOREAN_WORDS_BY_STEM: ReadonlyMap<string, readonly string[]> = (() => {
  const index = new Map<string, string[]>();
  for (const [korean, stems] of Object.entries(KOREAN_MONSTER_STEMS)) {
    for (const stem of stems) {
      const bucket = index.get(stem);
      if (bucket) bucket.push(korean);
      else index.set(stem, [korean]);
    }
  }
  return index;
})();

function idWords(value: string): string[] {
  return value
    .split(/[^a-zA-Z0-9]+/u)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 0);
}

/**
 * 몬스터 리소스 id/라벨에 붙일 한국어 검색 태그.
 *
 * `generated-enemy-skeleton-archer` → ["해골", "스켈레톤", "궁수"]. 태그로 넣어야
 * `searchResources("monster", "해골 궁수")` 가 점수를 받는다.
 */
export function koreanMonsterTags(...values: readonly string[]): string[] {
  const tags = new Set<string>();
  for (const value of values) {
    for (const tag of RESOURCE_IDENTITY_TAGS[value] ?? []) tags.add(tag);
    for (const word of idWords(value)) {
      for (const korean of KOREAN_WORDS_BY_STEM.get(word) ?? []) tags.add(korean);
    }
  }
  return [...tags];
}
