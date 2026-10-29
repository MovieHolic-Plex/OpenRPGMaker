// 스토어 음악 팩에서 장면·장르·분위기에 맞는 곡 고르기(조수 store_find_music, src/editor/tools/storeTools.ts).
// 서버 검색은 팩(상품) 단위이고 곡별 설명은 매니페스트 안(meta.oprnMusic)에만 있다 — 그래서 음악 팩 매니페스트를 받아 곡 단위로 줄 세운다.
// 곡 하나만 넣을 때는 subsetMusicManifest 로 그 곡만 남긴 매니페스트를 applyPackToProject 에 넘긴다(출처·라이선스·AI 표시는 그대로 붙는다).
import type { StoreItemSummary, StorePackManifest } from "./format";
import { readStoreMusicMeta, STORE_MUSIC_SCENE_LABELS, type StoreMusicMeta, type StoreMusicScene } from "@/assets/storeMusicMeta";

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
 */
const GAME_FEELS: readonly { readonly names: readonly string[]; readonly lines: readonly string[]; readonly words: string }[] = [
  { names: ["크로노트리거", "크로노 트리거", "chrono trigger", "chronotrigger", "クロノトリガー", "크로노크로스", "chrono cross"], lines: ["snes-jrpg", "fantasy"], words: "16비트 snes 레트로 모험" },
  { names: ["파이널판타지", "파이널 판타지", "파판", "final fantasy", "ff", "ファイナルファンタジー", "ファイファン", "ff14", "ff7", "ff6"], lines: ["symphonic-jrpg", "snes-jrpg", "fantasy"], words: "심포닉 오케스트라 16비트" },
  { names: ["드래곤퀘스트", "드래곤 퀘스트", "드퀘", "dragon quest", "dq", "ドラゴンクエスト", "ドラクエ"], lines: ["symphonic-jrpg", "snes-jrpg", "fantasy"], words: "오케스트라 심포닉 16비트" },
  { names: ["성검전설", "성검 전설", "secret of mana", "seiken densetsu", "聖剣伝説", "로맨싱사가", "romancing saga"], lines: ["snes-jrpg", "fantasy"], words: "16비트 snes 레트로" },
  { names: ["마그나카르타", "마그나 카르타", "magna carta", "magnacarta", "マグナカルタ", "창세기전", "어스토니시아"], lines: ["orchestral-melodrama", "symphonic-jrpg"], words: "멜로드라마 드라마틱 서사 애절 오케스트라" },
  { names: ["테일즈런너", "테일즈 런너", "테런", "tales runner", "talesrunner", "テイルズランナー", "카트라이더", "카트 라이더", "kartrider", "kart rider"], lines: ["casual-race"], words: "캐주얼 레이싱 경쾌한 신나는" },
  { names: ["투더문", "투 더 문", "to the moon", "tothemoon", "トゥ・ザ・ムーン", "파인딩파라다이스", "finding paradise"], lines: ["piano-story"], words: "피아노 잔잔한 감성" },
  { names: ["포켓몬스터", "포켓몬", "pokemon", "pokémon", "ポケモン", "ポケットモンスター"], lines: ["monster"], words: "몬스터" },
];

const escapeRe = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
const GAME_PATTERNS = GAME_FEELS.map((game) => ({
  ...game,
  // 띄어쓰기는 있어도 없어도 맞는다(「투 더 문」 = 「투더문」). 영문은 낱말 경계 + 뒤 번호(ff6·ff 7·ff vi).
  re: new RegExp(game.names.map((name) => {
    const body = [...name.replace(/\s+/gu, "")].map(escapeRe).join("\\s*");
    return /^[a-z]/u.test(name) ? `(?<![a-z0-9])${body}(?:\\s*(?:\\d+|[ivx]+))?(?![a-z])` : body;
  }).sort((a, b) => b.length - a.length).join("|"), "giu"),
}));

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

const tokens = (text: string): string[] => text.toLowerCase().split(/[\s,·/]+/u).map((word) => word.replace(/(풍|스러운|같은|느낌|음악|곡|bgm)$/u, "")).filter((word) => word.length > 0);

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
    if (at < 0) return -1;
    score += at === 0 ? 12 : 9;
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
  if (gameAt >= 0) score += gameAt === 0 ? 4 : 2;
  const queryWords = tokens(expanded.query);
  for (const word of queryWords) {
    if (word.length < 1) continue;
    if (genreText.includes(word)) { score += 6; named = true; }
    // 팩 줄 낱말(따로 더한다 — 「판타지」가 「중국풍 판타지」에도 들어 있어 장르 이름만으로는 판타지 팩을 못 가린다).
    // 문화색을 따로 들어 본 곡(조선 팩)은 실제로 들리는 만큼만 친다.
    if (lineWords.some((line) => wordHits(line, word))) { score += track.cultureHeard === "no" ? 1.5 : track.cultureHeard === "partly" ? 3 : 6; named = true; }
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
