// 스토어 음악 팩에서 장면·장르·분위기에 맞는 곡 고르기(조수 store_find_music, src/editor/tools/storeTools.ts).
// 서버 검색은 팩(상품) 단위이고 곡별 설명은 매니페스트 안(meta.oprnMusic)에만 있다 — 그래서 음악 팩 매니페스트를 받아 곡 단위로 줄 세운다.
// 곡 하나만 넣을 때는 subsetMusicManifest 로 그 곡만 남긴 매니페스트를 applyPackToProject 에 넘긴다(출처·라이선스·AI 표시는 그대로 붙는다).
import type { StoreItemSummary, StorePackManifest } from "./format";
import { readStoreMusicMeta, STORE_MUSIC_SCENE_LABELS, STORE_MUSIC_SCENES, type StoreMusicMeta, type StoreMusicScene } from "@/assets/storeMusicMeta";

/**
 * 조수가 scene 에 넣는 다른 말 → 장면 id. 2026-10-30 실조수 e2e(/tmp/mfe2): 「village」「maps」「미술관」을 넣거나 scene 을 빼고 한 번 실패한 뒤 고쳐 불렀다.
 * 미술관·박물관·저택은 걸어 다니며 살피는 실내 — 그곳의 배경음은 마을·가게 자리(town)다(공포 미술관도 평소 곡은 잔잔하고, 쫓길 때만 chase).
 */
const SCENE_SYNONYMS: Readonly<Record<string, StoreMusicScene>> = {
  village: "town", city: "town", shop: "town", inn: "town", castle: "town", home: "town", house: "town", gallery: "town", museum: "town", mansion: "town", school: "town",
  마을: "town", 도시: "town", 가게: "town", 상점: "town", 여관: "town", 성: "town", 집: "town", 미술관: "town", 갤러리: "town", 박물관: "town", 저택: "town", 학교: "town",
  map: "field", maps: "field", world: "field", worldmap: "field", overworld: "field", 필드: "field", 월드맵: "field", 들판: "field", 평원: "field", 맵: "field",
  cave: "dungeon", ruin: "dungeon", ruins: "dungeon", tower: "dungeon", 던전: "dungeon", 동굴: "dungeon", 유적: "dungeon", 탑: "dungeon", 미궁: "dungeon",
  fight: "battle", combat: "battle", 전투: "battle", 배틀: "battle",
  "final-boss": "boss", finalboss: "boss", 보스: "boss", 보스전: "boss", 마왕: "boss",
  fanfare: "victory", jingle: "victory", win: "victory", 승리: "victory", 팡파르: "victory", 팡파레: "victory",
  sorrow: "sad", 슬픔: "sad", 슬픈: "sad", 이별: "sad",
  horror: "tense", suspense: "tense", stealth: "tense", mystery: "tense", 긴장: "tense", 공포: "tense", 호러: "tense", 잠입: "tense", 미스터리: "tense",
  chaser: "chase", pursuit: "chase", "chase-scene": "chase", 추격: "chase", 추격전: "chase", 도망: "chase",
  menu: "title", 타이틀: "title", 메인: "title",
  credits: "ending", credit: "ending", epilogue: "ending", 엔딩: "ending", 크레딧: "ending", 에필로그: "ending",
};

/** scene 인자 → 장면 id(정확한 id·한국어 이름·다른 말). 모르면 null. */
export function normalizeStoreMusicScene(value: unknown): StoreMusicScene | null {
  const text = typeof value === "string" ? value.trim().toLowerCase().replace(/[\s_]+/gu, "-") : "";
  if (!text) return null;
  if ((STORE_MUSIC_SCENES as readonly string[]).includes(text)) return text as StoreMusicScene;
  const label = (Object.entries(STORE_MUSIC_SCENE_LABELS) as [StoreMusicScene, string][]).find(([, ko]) => ko === text);
  if (label) return label[0];
  return SCENE_SYNONYMS[text] ?? SCENE_SYNONYMS[text.replace(/-/gu, "")] ?? SCENE_SYNONYMS[text.replace(/(곡|음악|bgm|브금|용|씬|장면)$/u, "")] ?? null;
}

/** scene 이 없을 때 요청 말에서 읽는 장면 — 앞 줄이 먼저(보스는 전투보다, 추격은 긴장보다 먼저). */
const SCENE_WORDS: readonly (readonly [StoreMusicScene, RegExp])[] = [
  ["chase", /추격|쫓아|쫓기|쫓는|도망|chase|chaser|pursuit/iu],
  ["boss", /보스|마왕|최종\s*전|boss/iu],
  ["victory", /승리|팡파[르레]|fanfare|victory/iu],
  ["ending", /엔딩|크레딧|에필로그|ending|credits?/iu],
  ["title", /타이틀|메인\s*화면|title/iu],
  ["battle", /전투|배틀|싸움|battle|combat/iu],
  ["dungeon", /던전|동굴|유적|미궁|dungeon|cave/iu],
  ["field", /필드|월드\s*맵|들판|평원|초원|field|overworld/iu],
  ["town", /마을|도시|가게|상점|여관|미술관|갤러리|박물관|저택|town|village|city|gallery/iu],
  ["sad", /슬픈|슬픔|이별|애도|sad/iu],
  ["tense", /긴장|공포|호러|잠입|tense|horror|stealth/iu],
];

/** 요청 말(query·need·mood …)에서 장면을 짐작한다. 못 읽으면 null. */
export function inferStoreMusicScene(...texts: readonly unknown[]): StoreMusicScene | null {
  const text = texts.filter((value): value is string => typeof value === "string").join(" ");
  return SCENE_WORDS.find(([, re]) => re.test(text))?.[0] ?? null;
}

/** 요청한 장면이 적힌 곡이 없을 때 그다음으로 맞는 장면(추격 곡이 없으면 긴장 곡). */
const SCENE_NEAR: Readonly<Partial<Record<StoreMusicScene, readonly StoreMusicScene[]>>> = { chase: ["tense"], tense: ["chase"] };

/** 팩의 장르 줄(genreLine) → 사용자가 쓰는 낱말. 실제로 그렇게 들리지 않는 곡도 이 팩 줄에는 약하게 맞는다. */
const LINE_WORDS: Readonly<Record<string, readonly string[]>> = {
  joseon: ["조선", "한국", "사극", "국악", "korean", "joseon"],
  wuxia: ["무협", "무림", "중국", "wuxia"],
  fantasy: ["판타지", "jrpg", "fantasy"],
  horror: ["호러", "공포", "horror"],
  modern: ["현대", "도시", "modern"],
  monster: ["몬스터", "포켓몬", "monster"],
  romance: ["연애", "일상", "romance"],
  scifi: ["sf", "우주", "공상", "scifi", "sci-fi"],
  "snes-jrpg": ["16비트", "슈퍼패미컴", "슈패", "슈퍼컴보이", "sfc", "snes", "레트로", "칩튠", "16bit", "16-bit", "retro"],
  "symphonic-jrpg": ["심포닉", "교향악", "오케스트라", "관현악", "symphonic", "orchestra", "orchestral"],
  // 분위기 낱말(애절·서사·감성·드라마틱)은 넣지 않는다 — 줄 낱말을 말하면 다른 줄 곡이 모두 −6 이 된다.
  "orchestral-melodrama": ["멜로드라마", "멜로", "melodrama"],
  "casual-race": ["캐주얼", "레이싱", "레이스", "달리기", "경주", "아케이드", "casual", "race", "racing", "arcade"],
  "piano-story": ["피아노", "인디", "piano", "indie"],
  // 2026-10-30 새 줄(팩 게시 전 — 게임 이름 줄은 아래 GAME_FEELS 의 lines 둘째 이후로 옛 줄에 물러선다). 게임 이름은 여기 넣지 않는다.
  "dark-folk-fantasy": ["다크 판타지", "다크 포크", "슬라브 민속", "허디거디", "주막", "dark folk", "slavic folk", "hurdy-gurdy", "tavern"],
  "gallery-mystery": ["미술관", "갤러리", "오르골", "클래식 피아노", "gallery", "museum", "music box", "harpsichord"],
  "chase-horror": ["추격 호러", "쫓기는", "저택 공포", "chase horror", "being chased", "mansion horror"],
  "dark-fairytale": ["잔혹 동화", "오르골 왈츠", "기괴한 귀여움", "dark fairy tale", "creepy cute", "music-box waltz"],
  "dream-ambient": ["꿈 세계", "몽환", "초현실", "로파이", "dream world", "surreal", "lo-fi ambient", "dreamlike"],
  "eerie-minimal": ["기묘한", "인더스트리얼", "차가운 전자음", "eerie", "industrial ambient", "minimal electronic"],
  "school-horror": ["학교 괴담", "학교 공포", "교실", "school horror", "haunted school", "classroom"],
  "chiptune-indie-rpg": ["칩튠", "8비트", "아기자기 인디", "chiptune", "8-bit", "quirky indie rpg"],
};

/** 짧은 영문 낱말(sf·ost·ff …)은 같아야만 맞는다 — 「sfc」가 SF 줄에, 「ost」가 다른 낱말 속에 걸리지 않게. */
const wordHits = (line: string, word: string): boolean => {
  if (/^[a-z0-9-]{1,3}$/u.test(line) || /^[a-z0-9-]{1,3}$/u.test(word)) return line === word;
  return line.includes(word) || word.includes(line);
};

/**
 * 게임·시리즈 이름 → 장르 줄 + 들리는 결 낱말(조수 쪽에서만 쓴다). 스토어 곡 메타에는 게임 이름이 없다(원작과 거리 두기) —
 * 「크로노트리거 느낌」「투더문 같은 피아노」를 받으면 이름을 지우고 이 낱말로 바꿔 점수를 매긴다. 스토어·게시 자료에 이 이름을 쓰지 않는다.
 * lines 의 첫 줄이 가장 가깝다(+4, 나머지 +2 — 새 팩이 없을 때 옛 판타지 팩으로 물러선다).
 * guarded: 흔한 낱말·이름과 겹치는 이름(「이브닝」의 이브, 「off」, 「위처럼」의 위처) — 바로 뒤에 느낌·처럼·풍·같은이 올 때만 그 게임으로 본다.
 * 줄을 더할 때는 이 표에 한 줄만 쓰면 된다 — 조수 v2 음악 요청 판정(src/ai/v2/musicWords.ts)도 이 이름을 함께 쓴다.
 */
const GAME_FEELS: readonly { readonly names: readonly string[]; readonly guarded?: readonly string[]; readonly lines: readonly string[]; readonly words: string }[] = [
  { names: ["크로노트리거", "크로노 트리거", "chrono trigger", "chronotrigger", "クロノトリガー", "크로노크로스", "chrono cross"], lines: ["snes-jrpg", "fantasy"], words: "16비트 snes 레트로 모험" },
  { names: ["파이널판타지", "파이널 판타지", "파판", "final fantasy", "ff", "ファイナルファンタジー", "ファイファン", "ff14", "ff7", "ff6"], lines: ["symphonic-jrpg", "snes-jrpg", "fantasy"], words: "심포닉 오케스트라 16비트" },
  { names: ["드래곤퀘스트", "드래곤 퀘스트", "드퀘", "dragon quest", "dq", "ドラゴンクエスト", "ドラクエ"], lines: ["symphonic-jrpg", "snes-jrpg", "fantasy"], words: "오케스트라 심포닉 16비트" },
  { names: ["성검전설", "성검 전설", "secret of mana", "seiken densetsu", "聖剣伝説", "로맨싱사가", "romancing saga"], lines: ["snes-jrpg", "fantasy"], words: "16비트 snes 레트로" },
  { names: ["마그나카르타", "마그나 카르타", "magna carta", "magnacarta", "マグナカルタ", "창세기전", "어스토니시아"], lines: ["orchestral-melodrama", "symphonic-jrpg"], words: "멜로드라마 드라마틱 서사 애절 오케스트라" },
  { names: ["테일즈런너", "테일즈 런너", "테런", "tales runner", "talesrunner", "テイルズランナー", "카트라이더", "카트 라이더", "kartrider", "kart rider"], lines: ["casual-race"], words: "캐주얼 레이싱 경쾌한 신나는" },
  { names: ["투더문", "투 더 문", "to the moon", "tothemoon", "トゥ・ザ・ムーン", "파인딩파라다이스", "finding paradise"], lines: ["piano-story"], words: "피아노 잔잔한 감성" },
  { names: ["포켓몬스터", "포켓몬", "pokemon", "pokémon", "ポケモン", "ポケットモンスター"], lines: ["monster"], words: "몬스터" },
  // 2026-10-30 새 줄 — lines 둘째 이후는 새 팩이 아직 없을 때 물러설 옛 줄.
  { names: ["위쳐", "witcher", "ウィッチャー"], guarded: ["위처"], lines: ["dark-folk-fantasy", "fantasy"], words: "다크 포크 판타지 슬라브 민속 허디거디" },
  { names: ["ib"], guarded: ["이브", "イヴ"], lines: ["gallery-mystery", "piano-story", "horror"], words: "미술관 갤러리 오르골 클래식 피아노" },
  { names: ["아오오니", "청귀", "ao oni", "aooni", "青鬼"], lines: ["chase-horror", "horror"], words: "추격 호러 쫓기는 저택 공포" },
  { names: ["마녀의 집", "매드 파더", "witch's house", "witchs house", "mad father", "魔女の家"], lines: ["dark-fairytale", "horror"], words: "잔혹 동화 오르골 왈츠 기괴한 귀여움" },
  { names: ["유메닛키", "유메 닛키", "yume nikki", "yumenikki", "ゆめにっき"], lines: ["dream-ambient", "horror"], words: "꿈 세계 몽환 초현실 로파이" },
  { names: ["off rpg"], guarded: ["off", "오프"], lines: ["eerie-minimal", "scifi", "horror"], words: "기묘한 인더스트리얼 차가운 전자음 미니멀" },
  { names: ["콥스 파티", "콥스파티", "미사오", "corpse party", "misao", "コープスパーティー"], lines: ["school-horror", "horror"], words: "학교 괴담 학교 공포 교실" },
  { names: ["언더테일", "델타룬", "undertale", "deltarune", "アンダーテール"], lines: ["chiptune-indie-rpg", "monster", "fantasy"], words: "칩튠 8비트 아기자기 인디" },
];

/** 이름 뒤에 결을 빌리는 말이 올 때만(guarded). musicWords.ts 의 GAME_FEEL 꼬리와 같은 말. */
const FEEL_TAIL = String.raw`(?=\s*(?:의\s*)?(?:느낌|처럼|풍|같은|같이|같게|스타일|분위기|st\b|style))`;

const escapeRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const namePattern = (name: string): string => {
  const body = [...name.replace(/\s+/gu, "")].map(escapeRe).join("\\s*");
  return /^[a-z]/u.test(name) ? `(?<![a-z0-9])${body}(?:\\s*(?:\\d+|[ivx]+))?(?![a-z])` : body;
};
const GAME_PATTERNS = GAME_FEELS.map((game) => ({
  ...game,
  // 띄어쓰기는 있어도 없어도 맞는다(「투 더 문」 = 「투더문」). 영문은 낱말 경계 + 뒤 번호(ff6·ff 7·ff vi).
  re: new RegExp([...game.names.map((name) => namePattern(name)), ...(game.guarded ?? []).map((name) => namePattern(name) + FEEL_TAIL)]
    .sort((a, b) => b.length - a.length).join("|"), "giu"),
}));

/**
 * 위 표의 모든 게임·시리즈 이름을 하나로 맞추는 정규식 본문(플래그 없음 — 쓰는 쪽이 iu 로 감싼다).
 * 조수 v2 가 「테일즈런너처럼」「투더문 느낌」을 음악 요청으로 알아보는 데 쓴다(src/ai/v2/musicWords.ts) — 표에 줄을 더하면 함께 맞는다.
 */
export const STORE_MUSIC_GAME_NAME_SOURCE: string = GAME_PATTERNS.map((game) => game.re.source).join("|");

export interface ExpandedStoreMusicQuery {
  /** 게임 이름을 지우고 결 낱말을 붙인 검색어. */
  readonly query: string;
  /** 게임 이름이 가리키는 장르 줄(가까운 순). */
  readonly lines: readonly string[];
  /** 알아본 게임 이름(조수 결과 설명용). */
  readonly games: readonly string[];
}

/** 「크로노트리거 느낌으로」 → 「16비트 snes 레트로 모험 느낌으로」 + 줄 snes-jrpg. 게임 이름이 없으면 그대로. */
export function expandStoreMusicQuery(query: string): ExpandedStoreMusicQuery {
  let text = query.toLowerCase();
  const lines: string[] = [];
  const games: string[] = [];
  const add: string[] = [];
  for (const game of GAME_PATTERNS) {
    game.re.lastIndex = 0;
    const found = text.match(game.re);
    if (!found) continue;
    games.push(found[0].trim());
    text = text.replace(game.re, " ");
    for (const line of game.lines) if (!lines.includes(line)) lines.push(line);
    add.push(game.words);
  }
  return { query: [text.trim(), ...add].filter(Boolean).join(" "), lines, games };
}

export interface StoreMusicTrack {
  readonly slug: string;
  readonly version: number;
  /** 팩 안 에셋 id(store_install 의 assetIds 로 넘긴다). */
  readonly assetId: string;
  readonly name: string;
  readonly titleKo: string;
  readonly packTitle: string;
  readonly blob: string;
  readonly license: string;
  readonly aiGenerated: boolean;
  readonly credits: string;
  readonly music: StoreMusicMeta;
  readonly cultureHeard: string | null;
}

/** 음악 팩 매니페스트 → 고를 수 있는 곡(장면이 적힌 음악만). */
export function storeMusicTracks(item: Pick<StoreItemSummary, "slug" | "latestVersion" | "title">, manifest: StorePackManifest): StoreMusicTrack[] {
  const out: StoreMusicTrack[] = [];
  for (const asset of Object.values(manifest.content.assets)) {
    if (asset.kind !== "music") continue;
    const music = readStoreMusicMeta(asset.meta);
    if (!music) continue;
    const raw = (asset.meta as { oprnMusic?: { title?: { ko?: unknown }; cultureHeard?: unknown } } | undefined)?.oprnMusic;
    out.push({
      slug: item.slug, version: item.latestVersion, assetId: asset.id, name: asset.name,
      titleKo: typeof raw?.title?.ko === "string" ? raw.title.ko.slice(0, 60) : "",
      packTitle: manifest.locales?.ko?.title ?? manifest.title, blob: asset.blob,
      license: manifest.license, aiGenerated: manifest.aiGenerated, credits: manifest.credits.slice(0, 200), music,
      cultureHeard: typeof raw?.cultureHeard === "string" ? raw.cultureHeard : null,
    });
  }
  return out;
}

/**
 * 아무 곡에나 붙는 말 — 점수 낱말로 쓰지 않는다. 2026-10-30: 「공포 게임」의 「게임」이 캐주얼 레이스 로비 곡의 결(「레트로 게임 감성」)·설명(「게임의 로비」)에 맞아
 * 장르가 맞은 것으로 쳐져(named) 호러 곡과 같은 점수로 1위에 섰다.
 */
const GENERIC_WORDS = new Set(["게임", "game", "games", "배경음악", "배경음", "브금", "노래", "music", "song", "track"]);
const tokens = (text: string): string[] => text.toLowerCase().split(/[\s,·/]+/u).map((word) => word.replace(/(풍|스러운|같은|느낌|음악|곡|bgm)$/u, "")).filter((word) => word.length > 0 && !GENERIC_WORDS.has(word));

/**
 * 공포 낱말(공포·호러·무서운·괴담 …) → 공포 계열 줄. 장면(마을·던전 …)이 무엇이든 이 줄 곡이 다른 줄 곡보다 앞에 선다.
 * 2026-10-30: 「공포 게임」+town 에 캐주얼 레이스 로비 곡이 1위였고, 「무서운」「괴담」은 어느 공포 줄도 끌어오지 못했다.
 */
const HORROR_ASK = /공포|호러|무서|무섭|괴담|오싹|으스스|소름|귀신|유령|horror|scary|creepy|spooky|haunted/iu;
export const HORROR_FAMILY_LINES: readonly string[] = ["horror", "chase-horror", "school-horror", "dark-fairytale", "eerie-minimal"];

export interface StoreMusicQuery {
  readonly scene?: StoreMusicScene; readonly query?: string; readonly mood?: string;
  /** 프로젝트에 이미 든 스토어 곡의 장르 줄 비율(projectMusicLines). 장르 말이 없을 때 같은 줄 곡을 앞에 둔다. */
  readonly projectLines?: Readonly<Record<string, number>>;
}

/** 프로젝트에 이미 넣은 스토어 곡(meta.oprnMusic)의 장르 줄 비율 — 「승리 팡파르 넣어줘」처럼 장르를 안 말해도 게임의 곡 결을 따른다. */
export function projectMusicLines(uploaded: Readonly<Record<string, { readonly kind?: string; readonly meta?: unknown }>>): Record<string, number> {
  const counts: Record<string, number> = {};
  let total = 0;
  for (const asset of Object.values(uploaded)) {
    if (asset.kind !== "music") continue;
    const line = readStoreMusicMeta(asset.meta)?.genre;
    if (!line) continue;
    counts[line] = (counts[line] ?? 0) + 1;
    total += 1;
  }
  return Object.fromEntries(Object.entries(counts).map(([line, n]) => [line, n / total]));
}

/** 게임 이름·맵 이름에서 읽는 장르 낱말(스토어 곡이 아직 없는 새 게임). 팩 줄 낱말에 세계 낱말을 더한다. */
const HINT_WORDS: Readonly<Record<string, readonly string[]>> = {
  ...LINE_WORDS,
  joseon: [...LINE_WORDS.joseon!, "한양", "한옥", "저잣거리", "도깨비", "구미호", "선비", "양반", "궁궐"],
  wuxia: [...LINE_WORDS.wuxia!, "강호", "문파", "객잔", "협객"],
  fantasy: [...LINE_WORDS.fantasy!, "용사", "드래곤", "마왕", "기사", "마법사", "엘프"],
  monster: [...LINE_WORDS.monster!, "체육관", "관장", "트레이너", "도감"],
};

/**
 * 스토어 곡이 없는 프로젝트의 장르 줄 추정: 게임 이름·맵 이름에 든 세계 낱말(새 프로젝트 기본 부대에는 드래곤이 있어 부대 이름은 보지 않는다). 합이 0.5 라 한 줄만 걸리면
 * 「장르를 안 말한 요청」에서 다른 줄 곡이 깎인다(몬스터 게임의 「웅장한 타이틀」에 판타지 타이틀이 붙던 것, 2026-10-25 실조수).
 */
export function projectHintLines(texts: readonly string[]): Record<string, number> {
  const raw = texts.join(" ");
  const expanded = expandStoreMusicQuery(raw);
  const text = raw.toLowerCase();
  // 영문 낱말은 낱말 경계로(「grace」에 race, 「Forest」에 sf 가 걸리지 않게). 게임 이름(「파판풍 RPG」)은 그 게임의 첫 줄.
  const has = (word: string): boolean => /^[a-z0-9-]+$/u.test(word) ? new RegExp(`(?<![a-z0-9])${word}(?![a-z0-9])`, "u").test(text) : text.includes(word);
  const hits = [...new Set([...Object.entries(HINT_WORDS).filter(([, words]) => words.some(has)).map(([line]) => line), ...expanded.lines.slice(0, 1)])];
  return Object.fromEntries(hits.map((line) => [line, 0.5 / hits.length]));
}

/** 점수: 장면이 맞아야 높다. 장르는 실제로 들리는 장르(genreKo)가 팩 줄보다 무겁다. 승리는 짧은 곡, 그 밖은 루프. */
export function scoreStoreMusic(track: StoreMusicTrack, want: StoreMusicQuery): number {
  const m = track.music;
  let score = 0;
  if (want.scene) {
    const at = m.scenes.indexOf(want.scene);
    if (at >= 0) score += at === 0 ? 12 : 9;
    // 가까운 장면(추격 ↔ 긴장)은 낮게 받는다 — 정확히 그 장면으로 적힌 곡이 늘 앞에 선다.
    else if ((SCENE_NEAR[want.scene] ?? []).some((near) => m.scenes.includes(near))) score += 5;
    else return -1;
  }
  const genreText = `${m.genreKo} ${m.genreLabel}`.toLowerCase();
  const lineWords = LINE_WORDS[m.genre] ?? [m.genre];
  const moods = m.mood.map((word) => word.toLowerCase());
  const feels = m.feelTags.map((word) => word.toLowerCase());
  const feelHit = (word: string): boolean => feels.some((feel) => feel.split(/[\s,·/]+/u).some((part) => wordHits(part, word)));
  // 게임 이름은 결 낱말로 바꾸고, 그 게임이 가리키는 줄은 덤(+4, 다음 줄 +2)을 받는다.
  const expanded = expandStoreMusicQuery(want.query ?? "");
  const gameAt = expanded.lines.indexOf(m.genre);
  let named = gameAt >= 0;
  // 사용자가 이 곡의 줄 자체를 말했는가(줄 낱말·게임 이름) — 공포 요청이어도 「공포 피아노」의 피아노 줄은 깎지 않는다.
  let lineNamed = gameAt >= 0;
  if (gameAt >= 0) score += gameAt === 0 ? 4 : 2;
  const queryWords = tokens(expanded.query);
  for (const word of queryWords) {
    if (word.length < 1) continue;
    if (genreText.includes(word)) { score += 6; named = true; }
    // 팩 줄 낱말(따로 더한다 — 「판타지」가 「중국풍 판타지」에도 들어 있어 장르 이름만으로는 판타지 팩을 못 가린다).
    // 문화색을 따로 들어 본 곡(조선 팩)은 실제로 들리는 만큼만 친다.
    if (lineWords.some((line) => wordHits(line, word))) { score += track.cultureHeard === "no" ? 1.5 : track.cultureHeard === "partly" ? 3 : 6; named = true; lineNamed = true; }
    // 실제로 들리는 결(feelTags) — 장르 이름만큼은 아니어도 「16비트」「솔로 피아노」를 들은 곡이 앞에 선다.
    if (feelHit(word)) { score += 5; named = true; }
    if (moods.some((mood) => mood.includes(word))) score += 3;
    if (m.summaryKo.toLowerCase().includes(word)) score += 1;
  }
  for (const word of tokens(want.mood ?? "")) {
    if (moods.some((mood) => mood.includes(word) || word.includes(mood))) score += 4;
    else if (feelHit(word)) score += 2;
    else if (m.summaryKo.toLowerCase().includes(word)) score += 1.5;
  }
  // 게임의 곡 결: 이미 든 스토어 곡과 같은 줄이면 앞으로, 한 줄이 절반 넘게 차지하는데 다른 줄이면(그 장르를 말하지 않았으면) 뒤로.
  // 2026-10-25 실조수: 판타지 게임의 「으스스한 던전 음악」에 호러 팩의 트립합 곡이 붙었다(Argon 1점).
  const lines = want.projectLines ?? {};
  const share = lines[m.genre] ?? 0;
  // 사용자가 장르를 말했는데(어느 팩 줄 낱말과 맞음) 이 곡은 그 장르가 아니면 분위기가 맞아도 뒤로.
  const asked = expanded.lines.length > 0 || queryWords.some((word) => Object.values(LINE_WORDS).some((words) => words.some((line) => wordHits(line, word))));
  // 공포 낱말: 공포 계열 줄은 앞으로(+4, 장르 맞음), 그 밖의 줄은 사용자가 그 줄을 말하지 않았으면 결·설명 낱말이 맞아도 뒤로(−8).
  const horrorAsked = HORROR_ASK.test(`${want.query ?? ""} ${want.mood ?? ""}`);
  if (horrorAsked && HORROR_FAMILY_LINES.includes(m.genre)) { score += 4; named = true; }
  else if (horrorAsked && !lineNamed) score -= 8;
  if (asked && !named) score -= 6;
  score += 4 * share;
  // 분위기 낱말 몇 개(최대 약 9점)보다 장르가 어긋나는 것이 더 크게 틀린다 — 그래서 감점이 분위기 점수만큼 크다.
  if (!named && share === 0 && Object.values(lines).some((value) => value >= 0.5)) score -= 8;
  if (want.scene === "victory") score += m.loopable ? 0 : 3;
  else if (want.scene) score += m.loopable ? 2 : -6;
  return score;
}

export function rankStoreMusic(tracks: readonly StoreMusicTrack[], want: StoreMusicQuery, limit = 4): StoreMusicTrack[] {
  return tracks
    .map((track, index) => ({ track, index, score: scoreStoreMusic(track, want) }))
    .filter((row) => row.score >= 0 && (want.scene || row.score > 0))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((row) => row.track);
}

/**
 * 후보가 왜 그 자리인가(조수에게 보이는 짧은 이유) + 물러선 곡인가.
 * 2026-10-30 실조수: 「파판 전투곡 느낌으로 일반 전투」에서 1위(심포닉 전투곡) 대신 3위를 넣었다 — 후보에 순위 이유가 없었다.
 * fallback: 게임 이름에서 줄을 읽었는데(「파판」 → symphonic-jrpg) 이 곡은 그 첫 줄이 아니다 — 그 줄 곡이 없을 때만 쓰는 대신 곡.
 */
export function explainStoreMusicPick(track: StoreMusicTrack, want: StoreMusicQuery): { readonly why: string; readonly fallback: boolean } {
  const m = track.music;
  const parts: string[] = [];
  if (want.scene) {
    const at = m.scenes.indexOf(want.scene);
    parts.push(at === 0 ? `장면 ${want.scene} 맞음(주 장면)` : at > 0 ? `장면 ${want.scene} 맞음` : `장면 ${want.scene} 가까움(${m.scenes.join("·")})`);
  }
  const expanded = expandStoreMusicQuery(want.query ?? "");
  const mapped = expanded.lines[0];
  const fallback = Boolean(mapped) && m.genre !== mapped;
  if (expanded.games.length) parts.push(fallback ? `「${expanded.games[0]}」 결(${mapped}) 아님 — 대신 곡(${m.genre})` : `「${expanded.games[0]}」 결 줄(${m.genre}) 맞음`);
  const words = tokens(expanded.query).filter((word) => `${m.genreKo} ${m.genreLabel}`.toLowerCase().includes(word) || m.feelTags.some((feel) => feel.toLowerCase().includes(word)));
  if (words.length) parts.push(`낱말 ${[...new Set(words)].slice(0, 3).join("·")} 맞음`);
  if (want.scene && want.scene !== "victory" && !m.loopable) parts.push("루프 아님");
  return { why: parts.join(", ") || "장르·분위기", fallback };
}

/** 조수에게 보이는 곡 한 줄(바이트·sha 없음). */
export function briefStoreMusic(track: StoreMusicTrack) {
  const m = track.music;
  return {
    slug: track.slug, assetId: track.assetId, title: track.titleKo || track.name, pack: track.packTitle,
    genre: m.genreKo || m.genreLabel, scenes: m.scenes.map((scene) => STORE_MUSIC_SCENE_LABELS[scene]), mood: m.mood,
    tempo: m.tempo, bpm: m.bpm, loopable: m.loopable, lengthSec: m.lengthSec, summary: m.summaryKo,
    ...(m.feelTags.length ? { feel: m.feelTags } : {}),
    license: track.license, aiGenerated: track.aiGenerated,
  };
}

/** 고른 곡만 남긴 매니페스트(타일셋·캐릭터·다른 곡 없음). applyPackToProject 가 출처를 그대로 붙인다. */
export function subsetMusicManifest(manifest: StorePackManifest, assetIds: readonly string[]): StorePackManifest {
  const wanted = new Set(assetIds);
  const assets = Object.fromEntries(Object.entries(manifest.content.assets).filter(([id, asset]) => wanted.has(id) && asset.kind === "music"));
  const missing = assetIds.filter((id) => !Object.hasOwn(assets, id));
  if (missing.length) throw new Error(`이 음악 팩에 없는 곡입니다: ${missing.join(", ")}`);
  const shas = new Set(Object.values(assets).map((asset) => asset.blob));
  return { ...manifest, previews: [], content: { assets, tilesets: {}, characters: [], objects: [] }, blobs: manifest.blobs.filter((blob) => shas.has(blob.sha256)) };
}
