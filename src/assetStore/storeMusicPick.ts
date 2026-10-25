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
};

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

export interface StoreMusicQuery { readonly scene?: StoreMusicScene; readonly query?: string; readonly mood?: string }

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
  for (const word of tokens(want.query ?? "")) {
    if (word.length < 1) continue;
    if (genreText.includes(word)) score += 6;
    else if (lineWords.some((line) => line.includes(word) || word.includes(line))) score += track.cultureHeard === "partly" ? 3 : 1.5;
    if (moods.some((mood) => mood.includes(word))) score += 3;
    if (m.summaryKo.toLowerCase().includes(word)) score += 1;
  }
  for (const word of tokens(want.mood ?? "")) {
    if (moods.some((mood) => mood.includes(word) || word.includes(mood))) score += 4;
    else if (m.summaryKo.toLowerCase().includes(word)) score += 1.5;
  }
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
