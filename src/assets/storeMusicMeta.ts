// 스토어 음악 팩이 곡마다 싣는 고르기용 설명(UploadedAsset.meta.oprnMusic).
// 팩을 넣으면 meta 가 그대로 프로젝트에 들어온다(src/assetStore/pack.ts applyPackToProject).
// 조수는 이 값으로 장면·분위기·장르에 맞는 곡을 고른다(recommend_bgm, src/editor/tools/audioDescriptionTools.ts).
// 값은 팩 제작자가 실제로 들어 보고 적은 것이다 — 없거나 모양이 틀리면 null 로 보고 이름만 쓴다.

/**
 * 곡이 맡는 장면. 조수가 recommend_bgm scene 으로 거른다.
 * chase = 추격자가 쫓아올 때(아오오니식 추격 호러). 호러 팩(chase-horror …)이 곡에 sceneRoles:["chase"] 로 싣는다 — id 를 바꾸지 말 것.
 * 연결은 set_game_audio role:'chase'(추격자가 나타날 때 바꾸고 끝나면 되돌림), 전투 곡이 아니다.
 */
export const STORE_MUSIC_SCENES = ["town", "field", "dungeon", "battle", "boss", "victory", "sad", "tense", "chase", "title", "ending"] as const;
export type StoreMusicScene = (typeof STORE_MUSIC_SCENES)[number];

/** 장면 이름의 한국어 낱말. 검색 태그와 설명에 같이 싣는다. */
export const STORE_MUSIC_SCENE_LABELS: Readonly<Record<StoreMusicScene, string>> = {
  town: "마을", field: "필드", dungeon: "던전", battle: "전투", boss: "보스", victory: "승리",
  sad: "슬픔", tense: "긴장", chase: "추격", title: "타이틀", ending: "엔딩",
};

export interface StoreMusicMeta {
  readonly genre: string;
  readonly genreLabel: string;
  /** 한국어 장르 이름(조선 전통, 무협 …). 사용자가 「조선풍」처럼 말하므로 검색 태그에 싣는다. */
  readonly genreKo: string;
  readonly scenes: readonly StoreMusicScene[];
  readonly mood: readonly string[];
  readonly energy: number | null;
  readonly bpm: number | null;
  readonly tempo: "slow" | "medium" | "fast" | null;
  readonly loopable: boolean;
  readonly lengthSec: number | null;
  readonly summaryKo: string;
  /** 실제로 들리는 결(한·영, 예: 「16비트 SNES 음색」 「잔잔한 솔로 피아노」). 옛 팩에는 없다 — 빈 배열. 게임 이름은 싣지 않는다. */
  readonly feelTags: readonly string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "");
const words = (value: unknown, max: number, len = 24): string[] =>
  Array.isArray(value) ? [...new Set(value.map((item) => text(item, len)).filter(Boolean))].slice(0, max) : [];
const number = (value: unknown, min: number, max: number): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null;

/** meta.oprnMusic 를 읽는다. 장면이 하나도 없으면 고르기에 쓸 수 없으므로 null. */
export function readStoreMusicMeta(meta: unknown): StoreMusicMeta | null {
  const raw = isRecord(meta) ? meta.oprnMusic : undefined;
  if (!isRecord(raw)) return null;
  const scenes = words(raw.sceneRoles, STORE_MUSIC_SCENES.length)
    .filter((scene): scene is StoreMusicScene => (STORE_MUSIC_SCENES as readonly string[]).includes(scene));
  if (!scenes.length) return null;
  const tempo = raw.tempo === "slow" || raw.tempo === "medium" || raw.tempo === "fast" ? raw.tempo : null;
  return {
    // 옛 팩은 genreLine, 새 팩(snes-jrpg·piano-story …)은 genre 로 싣는다.
    genre: text(raw.genreLine, 40) || text(raw.genre, 40),
    genreLabel: text(raw.genreLabel, 60),
    genreKo: text(raw.genreKo, 40),
    scenes,
    mood: words(raw.mood, 8),
    energy: number(raw.energy, 1, 5),
    bpm: number(raw.bpm, 20, 300),
    tempo,
    loopable: raw.loopable === true,
    lengthSec: number(raw.lengthSec, 0, 3600),
    summaryKo: text(raw.summaryKo, 200),
    feelTags: words(raw.feelTags, 12, 40),
  };
}

/** 검색 태그: 장르·장면(영·한)·분위기·빠르기·루프 여부. */
export function storeMusicTags(music: StoreMusicMeta): string[] {
  return [...new Set([
    music.genreKo, music.genreLabel, music.genre,
    ...music.scenes.flatMap((scene) => [scene, STORE_MUSIC_SCENE_LABELS[scene]]),
    ...music.mood,
    ...music.feelTags,
    ...(music.tempo ? [music.tempo] : []),
    music.loopable ? "루프" : "징글",
  ].filter(Boolean))];
}

/** 조수가 읽는 한 줄 설명 + 고르기 사실. */
export function storeMusicDescription(music: StoreMusicMeta): string {
  const facts = [
    (music.genreKo || music.genreLabel) && `장르 ${music.genreKo || music.genreLabel}`,
    `장면 ${music.scenes.map((scene) => STORE_MUSIC_SCENE_LABELS[scene]).join("·")}`,
    music.mood.length ? `분위기 ${music.mood.join("·")}` : "",
    music.feelTags.length ? `느낌 ${music.feelTags.join("·")}` : "",
    music.bpm !== null ? `${Math.round(music.bpm)} BPM` : "",
    music.energy !== null ? `에너지 ${music.energy}/5` : "",
    music.loopable ? `루프${music.lengthSec !== null ? ` ${Math.round(music.lengthSec)}초` : ""}` : `한 번 재생${music.lengthSec !== null ? ` ${Math.round(music.lengthSec)}초` : ""}`,
  ].filter(Boolean);
  return [music.summaryKo, facts.join(" · ")].filter(Boolean).join(" — ");
}
