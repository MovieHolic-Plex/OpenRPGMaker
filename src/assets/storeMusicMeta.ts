// 스토어 음악 팩이 곡마다 싣는 고르기용 설명(UploadedAsset.meta.oprnMusic).
// 팩을 넣으면 meta 가 그대로 프로젝트에 들어온다(src/assetStore/pack.ts applyPackToProject).
// 조수는 이 값으로 장면·분위기·장르에 맞는 곡을 고른다(recommend_bgm, src/editor/tools/audioDescriptionTools.ts).
// 값은 팩 제작자가 실제로 들어 보고 적은 것이다 — 없거나 모양이 틀리면 null 로 보고 이름만 쓴다.

/** 곡이 맡는 장면. 조수가 recommend_bgm scene 으로 거른다. */
export const STORE_MUSIC_SCENES = ["town", "field", "dungeon", "battle", "boss", "victory", "sad", "tense", "title", "ending"] as const;
export type StoreMusicScene = (typeof STORE_MUSIC_SCENES)[number];

/** 장면 이름의 한국어 낱말. 검색 태그와 설명에 같이 싣는다. */
export const STORE_MUSIC_SCENE_LABELS: Readonly<Record<StoreMusicScene, string>> = {
  town: "마을", field: "필드", dungeon: "던전", battle: "전투", boss: "보스", victory: "승리",
  sad: "슬픔", tense: "긴장", title: "타이틀", ending: "엔딩",
};

export interface StoreMusicMeta {
  readonly genre: string;
  readonly genreLabel: string;
  readonly scenes: readonly StoreMusicScene[];
  readonly mood: readonly string[];
  readonly energy: number | null;
  readonly bpm: number | null;
  readonly tempo: "slow" | "medium" | "fast" | null;
  readonly loopable: boolean;
  readonly lengthSec: number | null;
  readonly summaryKo: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown, max: number): string => (typeof value === "string" ? value.trim().slice(0, max) : "");
const words = (value: unknown, max: number): string[] =>
  Array.isArray(value) ? [...new Set(value.map((item) => text(item, 24)).filter(Boolean))].slice(0, max) : [];
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
    genre: text(raw.genreLine, 40),
    genreLabel: text(raw.genreLabel, 60),
    scenes,
    mood: words(raw.mood, 8),
    energy: number(raw.energy, 1, 5),
    bpm: number(raw.bpm, 20, 300),
    tempo,
    loopable: raw.loopable === true,
    lengthSec: number(raw.lengthSec, 0, 3600),
    summaryKo: text(raw.summaryKo, 200),
  };
}

/** 검색 태그: 장르·장면(영·한)·분위기·빠르기·루프 여부. */
export function storeMusicTags(music: StoreMusicMeta): string[] {
  return [...new Set([
    music.genreLabel, music.genre,
    ...music.scenes.flatMap((scene) => [scene, STORE_MUSIC_SCENE_LABELS[scene]]),
    ...music.mood,
    ...(music.tempo ? [music.tempo] : []),
    music.loopable ? "루프" : "징글",
  ].filter(Boolean))];
}

/** 조수가 읽는 한 줄 설명 + 고르기 사실. */
export function storeMusicDescription(music: StoreMusicMeta): string {
  const facts = [
    music.genreLabel && `장르 ${music.genreLabel}`,
    `장면 ${music.scenes.map((scene) => STORE_MUSIC_SCENE_LABELS[scene]).join("·")}`,
    music.mood.length ? `분위기 ${music.mood.join("·")}` : "",
    music.bpm !== null ? `${Math.round(music.bpm)} BPM` : "",
    music.energy !== null ? `에너지 ${music.energy}/5` : "",
    music.loopable ? `루프${music.lengthSec !== null ? ` ${Math.round(music.lengthSec)}초` : ""}` : `한 번 재생${music.lengthSec !== null ? ` ${Math.round(music.lengthSec)}초` : ""}`,
  ].filter(Boolean);
  return [music.summaryKo, facts.join(" · ")].filter(Boolean).join(" — ");
}
