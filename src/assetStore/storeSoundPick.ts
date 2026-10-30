// 스토어 효과음 팩에서 자리(cue)·화풍·분위기에 맞는 소리 고르기(조수 store_find_sound, src/editor/tools/storeTools.ts).
// 서버 검색은 팩 단위이고 소리별 설명은 매니페스트 안(meta.oprnSound)에만 있다 — 효과음 팩 매니페스트를 받아 소리 단위로 줄 세운다.
// 소리 몇 개만 넣을 때는 subsetSoundManifest 로 그 소리만 남긴 매니페스트를 applyPackToProject 에 넘긴다(출처·라이선스·AI 표시는 그대로).
// 화풍 하나를 통째로 걸 때(set_game_audio role:'sfx-style')는 planSoundStyle 이 자리마다 한 소리(기본 A안)를 고른다.
import type { StoreItemSummary, StorePackManifest } from "./format";
import { normalizeStoreSoundSlot, readStoreSoundMeta, STORE_SOUND_STYLE_LABELS, type StoreSoundMeta, type StoreSoundStyle } from "@/assets/storeSoundMeta";
import { isKnownSeCue, seCueFallbacks, seCueSpec } from "@/project/seCues";

export interface StoreSoundTrack {
  readonly slug: string;
  readonly version: number;
  /** 팩 안 에셋 id(store_install 의 assetIds 로 넘긴다). 예: oprn-sfx-retro-damage-a. */
  readonly assetId: string;
  readonly name: string;
  readonly packTitle: string;
  readonly blob: string;
  readonly license: string;
  readonly aiGenerated: boolean;
  readonly credits: string;
  readonly sound: StoreSoundMeta;
}

/** 효과음 팩 매니페스트 → 고를 수 있는 소리(아는 자리가 적힌 소리만). */
export function storeSoundTracks(item: Pick<StoreItemSummary, "slug" | "latestVersion" | "title">, manifest: StorePackManifest): StoreSoundTrack[] {
  const out: StoreSoundTrack[] = [];
  for (const asset of Object.values(manifest.content.assets)) {
    if (asset.kind !== "sound") continue;
    const sound = readStoreSoundMeta(asset.meta);
    if (!sound) continue;
    out.push({
      slug: item.slug, version: item.latestVersion, assetId: asset.id, name: asset.name,
      packTitle: manifest.locales?.ko?.title ?? manifest.title, blob: asset.blob,
      license: manifest.license, aiGenerated: manifest.aiGenerated, credits: manifest.credits.slice(0, 200), sound,
    });
  }
  return out;
}

/** 화풍 낱말 → style. 「레트로」「8비트」「칩튠」 → retro, 「현대」「모던」「리얼」 → modern. 못 읽으면 null. */
const STYLE_WORDS: readonly (readonly [StoreSoundStyle, RegExp])[] = [
  ["retro", /레트로|칩튠|칩\s*소리|8\s*비트|16\s*비트|도트|고전|패미컴|슈패|retro|chip|8-?bit|16-?bit|nes|snes/iu],
  ["modern", /현대|모던|리얼|실사|시네마틱|요즘|modern|realistic|cinematic/iu],
];

export function inferStoreSoundStyle(...texts: readonly unknown[]): StoreSoundStyle | null {
  const value = texts.filter((t): t is string => typeof t === "string").join(" ");
  for (const [style, re] of STYLE_WORDS) if (re.test(value)) return style;
  return null;
}

/** 요청 말 → 자리. 정확한 자리 id 가 오면 그대로, 한국어 낱말이면 짐작. 못 읽으면 null. */
const CUE_WORDS: readonly (readonly [string, RegExp])[] = [
  ["footstep-grass", /풀\s*(?:밭)?\s*발소리|발소리.*풀/iu], ["footstep-stone", /돌\s*(?:길)?\s*발소리|발소리.*돌/iu],
  ["footstep-wood", /나무\s*(?:바닥)?\s*발소리|마루\s*발소리/iu], ["footstep-sand", /모래\s*발소리/iu],
  ["footstep-snow", /눈\s*(?:길)?\s*발소리/iu], ["footstep-water", /물\s*발소리|첨벙/iu],
  ["bossCollapse", /보스.*(?:쓰러|사망|격파)/iu], ["actorDamage", /아군.*(?:피해|맞)|(?:내가|파티).*맞/iu],
  ["levelUp", /레벨\s*업|레벨업|level\s*up/iu], ["itemGet", /아이템.*(?:획득|얻)|획득음/iu],
  ["useItem", /아이템.*사용/iu], ["equip", /장비|장착|equip/iu], ["save", /저장|세이브|save/iu], ["load", /불러오|로드|load/iu],
  ["menuOpen", /메뉴.*열/iu], ["shop", /상점|구매|판매|가게|shop/iu], ["battleStart", /전투\s*시작|조우|인카운트|encounter/iu],
  ["critical", /급소|크리티컬|critical/iu], ["miss", /빗나|회피|미스|miss|evasion/iu], ["heal", /회복|치유|heal/iu],
  ["defend", /방어|가드|defend|guard/iu], ["faint", /쓰러|격파|기절|faint/iu], ["escape", /도주|도망|escape/iu],
  ["defeat", /패배|게임\s*오버|defeat/iu], ["cast", /시전|주문|캐스트|cast/iu],
  ["magic-fire", /불\s*마법|화염|파이어|fire/iu], ["magic-ice", /얼음|빙결|아이스|ice/iu], ["magic-thunder", /번개|뇌전|썬더|thunder/iu],
  ["magic-wind", /바람|질풍|wind/iu], ["magic-earth", /땅\s*마법|대지|암석|earth/iu], ["magic-water", /물\s*마법|water/iu],
  ["magic-holy", /빛\s*마법|신성|홀리|holy/iu], ["magic-dark", /어둠|암흑|다크|dark/iu],
  ["damage", /타격음|피격|맞는\s*소리|피해|damage|hit/iu], ["attack", /공격|베기|휘두르|칼|attack|slash/iu],
  ["door", /문\s*(?:여는|열)|door/iu], ["chest", /상자|보물|chest/iu], ["stairs", /계단|stairs/iu], ["key", /열쇠|key/iu],
  ["switch", /스위치|레버|switch/iu], ["cursor", /커서|cursor/iu], ["confirm", /결정|확인|confirm/iu], ["cancel", /취소|cancel/iu],
  ["buzzer", /불가|버저|buzzer/iu],
];

export function normalizeStoreSoundCue(value: unknown): string | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  if (isKnownSeCue(raw)) return raw;
  const aliased = normalizeStoreSoundSlot(raw);
  if (aliased && isKnownSeCue(aliased)) return aliased;
  return CUE_WORDS.find(([, re]) => re.test(raw))?.[0] ?? null;
}

export interface StoreSoundQuery {
  readonly cue?: string | null;
  readonly style?: StoreSoundStyle | null;
  readonly query?: string;
  readonly mood?: string;
}

const tokens = (value: string | undefined): string[] =>
  (value ?? "").toLowerCase().split(/[\s,·/|]+/u).map((t) => t.trim()).filter((t) => t.length >= 2);

/**
 * 점수: 주 자리가 맞으면 +20, 다른 자리(별칭 포함)로 맞으면 +14, 가족 기본 자리(magic-fire 를 원하는데 cast)면 +6.
 * 화풍 +8(다르면 −8), 분위기·느낌 낱말 하나당 +2, A안 +1, 제작자 점수는 0~0.5 동점 깨기.
 */
export function scoreStoreSound(track: StoreSoundTrack, want: StoreSoundQuery): number {
  const s = track.sound;
  let score = 0;
  if (want.cue) {
    if (s.slots[0] === want.cue) score += 20;
    else if (s.slots.includes(want.cue)) score += 14;
    else if (seCueFallbacks(want.cue).slice(1).some((base) => s.slots.includes(base))) score += 6;
    else score -= 30;
  }
  if (want.style) score += s.style === want.style ? 8 : s.style ? -8 : 0;
  const hay = [...s.mood, ...s.feelTags, s.summaryKo, ...s.extraSlots].join(" ").toLowerCase();
  for (const word of new Set([...tokens(want.mood), ...tokens(want.query)])) if (hay.includes(word)) score += 2;
  if (s.variant === "a") score += 1;
  if (s.qaScore !== null) score += s.qaScore / 20;
  return score;
}

export function rankStoreSounds(tracks: readonly StoreSoundTrack[], want: StoreSoundQuery, limit = 4): StoreSoundTrack[] {
  return tracks
    .map((track) => ({ track, score: scoreStoreSound(track, want) }))
    .filter((row) => !want.cue || row.score > -10)
    .sort((a, b) => b.score - a.score || a.track.assetId.localeCompare(b.track.assetId))
    .slice(0, limit)
    .map((row) => row.track);
}

export function explainStoreSoundPick(track: StoreSoundTrack, want: StoreSoundQuery): { readonly why: string; readonly fallback: boolean } {
  const s = track.sound;
  const direct = !want.cue || s.slots.includes(want.cue);
  const parts = [
    want.cue ? (direct ? `자리 ${want.cue}` : `자리 ${want.cue} 대신 ${s.slots[0]}`) : `자리 ${s.slots[0]}`,
    s.style ? `${STORE_SOUND_STYLE_LABELS[s.style]}${want.style && want.style !== s.style ? "(다른 화풍)" : ""}` : "",
    s.variant ? `${s.variant.toUpperCase()}안` : "",
  ].filter(Boolean);
  return { why: parts.join(" · "), fallback: !direct };
}

export function briefStoreSound(track: StoreSoundTrack) {
  const s = track.sound;
  return {
    slug: track.slug, assetId: track.assetId, title: track.name, pack: track.packTitle,
    cue: s.slots[0], cueLabel: seCueSpec(s.slots[0]!)?.label ?? s.slots[0], slots: s.slots,
    style: s.style, variant: s.variant, mood: s.mood, intensity: s.intensity, durationSec: s.durationSec,
    summary: s.summaryKo, license: track.license, aiGenerated: track.aiGenerated,
  };
}

export interface SoundStylePlanRow {
  readonly cue: string;
  readonly slug: string;
  readonly assetId: string;
}

/**
 * 화풍 하나(style)로 모든 자리를 채우는 계획: 자리마다 그 화풍 소리 중 variant(기본 a)를 먼저, 없으면 같은 자리의 다른 안.
 * cues 를 주면 그 자리만. 소리가 없는 자리는 missing 으로 돌려준다(가족 기본 자리 cast 등은 따로 걸리므로 비워 둔다).
 */
export function planSoundStyle(
  tracks: readonly StoreSoundTrack[],
  style: StoreSoundStyle,
  options: { readonly variant?: "a" | "b" | "c"; readonly cues?: readonly string[] } = {},
): { readonly rows: readonly SoundStylePlanRow[]; readonly missing: readonly string[] } {
  const variant = options.variant ?? "a";
  const own = tracks.filter((track) => track.sound.style === style);
  const cues = options.cues?.length ? [...new Set(options.cues)] : [...new Set(own.flatMap((track) => track.sound.slots))];
  const rows: SoundStylePlanRow[] = [];
  const missing: string[] = [];
  for (const cue of cues) {
    const candidates = own.filter((track) => track.sound.slots.includes(cue))
      .sort((a, b) => Number(b.sound.slots[0] === cue) - Number(a.sound.slots[0] === cue)
        || Number(b.sound.variant === variant) - Number(a.sound.variant === variant)
        || a.assetId.localeCompare(b.assetId));
    const pick = candidates[0];
    if (pick) rows.push({ cue, slug: pick.slug, assetId: pick.assetId });
    else missing.push(cue);
  }
  return { rows, missing };
}

/**
 * 곡·효과음 몇 개만 남긴 매니페스트(store_install assetIds). 음악 팩이면 곡, 효과음 팩이면 소리 — 매니페스트 종류를 보고 고른다.
 * 둘이 섞인 팩(kind pack)은 두 종류 모두 받는다.
 */
export function subsetAudioManifest(manifest: StorePackManifest, assetIds: readonly string[]): StorePackManifest {
  const wanted = new Set(assetIds);
  const assets = Object.fromEntries(Object.entries(manifest.content.assets).filter(([id, asset]) => wanted.has(id) && (asset.kind === "music" || asset.kind === "sound")));
  const missing = assetIds.filter((id) => !Object.hasOwn(assets, id));
  if (missing.length) throw new Error(`이 팩에 없는 곡·효과음입니다: ${missing.join(", ")}`);
  const shas = new Set(Object.values(assets).map((asset) => asset.blob));
  return { ...manifest, previews: [], content: { assets, tilesets: {}, characters: [], objects: [] }, blobs: manifest.blobs.filter((blob) => shas.has(blob.sha256)) };
}
