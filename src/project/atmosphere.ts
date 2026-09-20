/** Map-wide decoration, independent of gameplay weather and fishing/calendar rules. */
export const ATMOSPHERE_PRESETS = [
  { id: "leaves", label: "낙엽", group: "자연", color: 0xd79635 },
  { id: "petals", label: "꽃잎", group: "자연", color: 0xffbddb },
  { id: "dust", label: "먼지", group: "자연", color: 0xf7e3b5 },
  { id: "sand", label: "모래바람", group: "자연", color: 0xcfa65b },
  { id: "fireflies", label: "반딧불", group: "자연", color: 0xc8ff6b },
  { id: "runes", label: "마법 문양", group: "판타지", color: 0x9cbeff },
  { id: "shades", label: "그림자 잔영", group: "판타지", color: 0x80649b },
  { id: "frost", label: "서리 결정", group: "자연", color: 0xc3efff },
  { id: "magic", label: "마력 입자", group: "판타지", color: 0xc694ff },
  { id: "spirits", label: "정령빛", group: "판타지", color: 0x7ffff2 },
  { id: "poison", label: "독안개", group: "판타지", color: 0x93c15a },
  { id: "ash", label: "재", group: "판타지", color: 0xb5b0ab },
  { id: "embers", label: "불씨", group: "판타지", color: 0xff893e },
  { id: "smog", label: "스모그", group: "도시", color: 0x999c9e },
  { id: "steam", label: "증기", group: "도시", color: 0xe8f4f4 },
  { id: "leaks", label: "떨어지는 물방울", group: "도시", color: 0xb1e7ff },
  { id: "sparks", label: "전기 스파크", group: "도시", color: 0x9adcff },
  { id: "sunrays", label: "빛줄기", group: "공간", color: 0xffefbc },
  { id: "underwater", label: "물속 · 기포와 물빛", group: "공간", color: 0x77d9ed },
] as const;
export type AtmosphereKind = typeof ATMOSPHERE_PRESETS[number]["id"];
export interface AtmosphereEffect {
  kind: AtmosphereKind;
  amount: number;
  speed: number;
  size: number;
  opacity: number;
  /** Omitted fields inherit the visual kind's sound pairing. */
  sound?: AtmosphereSound;
  volume?: number;
  tint?: string;
}
export function normalizeAtmosphereEffects(value: unknown): AtmosphereEffect[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const clamp = (v: unknown, fallback: number, min: number, max: number) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : fallback;
  return value.flatMap((raw: unknown) => {
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    const preset = ATMOSPHERE_PRESETS.find(p => p.id === item.kind);
    if (!preset || seen.has(preset.id)) return [];
    seen.add(preset.id);
    return [{ kind: preset.id, amount: clamp(item.amount, 0.6, 0, 1), speed: clamp(item.speed, 1, 0, 3),
      size: clamp(item.size, 1, 0.3, 3), opacity: clamp(item.opacity, 0.7, 0, 1),
      sound: isAtmosphereSound(item.sound) ? item.sound : DEFAULT_ATMOSPHERE_SOUNDS[preset.id],
      volume: clamp(item.volume, 0.35, 0, 1),
      ...(typeof item.tint === "string" && /^#[0-9a-f]{6}$/i.test(item.tint) ? { tint: item.tint } : {}),
    }];
  });
}


export const ATMOSPHERE_SOUNDS = {
  none: "소리 없음", breeze: "잔잔한 바람", rustle: "바람과 잎사귀", insects: "풀벌레",
  chimes: "은은한 마력 종소리", whisper: "정령의 공명", rumble: "낮은 울림",
  fire: "불꽃 타닥임", steam: "증기 소리", drips: "물방울", electric: "전기 잡음", bubbles: "수중 기포",
} as const;
export type AtmosphereSound = keyof typeof ATMOSPHERE_SOUNDS;
export function isAtmosphereSound(value: unknown): value is AtmosphereSound {
  return typeof value === "string" && Object.hasOwn(ATMOSPHERE_SOUNDS, value);
}
export const DEFAULT_ATMOSPHERE_SOUNDS: Record<AtmosphereKind, AtmosphereSound> = {
  leaves: "rustle", petals: "breeze", dust: "none", sand: "breeze", fireflies: "insects",
  runes: "chimes", shades: "whisper", frost: "breeze",
  magic: "chimes", spirits: "whisper", poison: "rumble", ash: "breeze", embers: "fire",
  smog: "rumble", steam: "steam", leaks: "drips", sparks: "electric", sunrays: "none", underwater: "bubbles",
};

export const ATMOSPHERE_GENRES = ["마법", "악마", "무협", "현대", "근대", "자연·수중"] as const;

export interface AtmosphereScenePreset {
  id: string;
  label: string;
  genre: typeof ATMOSPHERE_GENRES[number];
  description: string;
  effects: readonly (Partial<AtmosphereEffect> & Pick<AtmosphereEffect, "kind">)[];
}
/** Ready-to-use combinations; copied into editable map settings, never linked live. */
export const ATMOSPHERE_SCENES: readonly AtmosphereScenePreset[] = [
  { id: "enchanted-forest", label: "정령의 숲", genre: "마법", description: "반딧불·정령빛·햇살 / 풀벌레와 정령 공명", effects: [
    { kind: "fireflies", amount: 0.65, volume: 0.3 }, { kind: "spirits", amount: 0.4, speed: 0.5, volume: 0.28 }, { kind: "sunrays", amount: 0.45 }] },
  { id: "ancient-ruins", label: "고대 마법 유적", genre: "마법", description: "떠도는 문양·먼지·금빛 / 느린 마력 종소리", effects: [
    { kind: "runes", amount: 0.45, size: 1.2, speed: 0.5, volume: 0.35 }, { kind: "dust", amount: 0.6 }, { kind: "sunrays", amount: 0.35, tint: "#efcb81" }] },
  { id: "arcane-library", label: "비전 도서관", genre: "마법", description: "보라색 마력·작은 문양 / 종소리와 공명", effects: [
    { kind: "magic", amount: 0.7, speed: 0.35, tint: "#d59aff", volume: 0.35 }, { kind: "runes", amount: 0.25, size: 0.7, tint: "#dcadfa", sound: "whisper", volume: 0.22 }] },
  { id: "frost-sanctum", label: "빙결 성소", genre: "마법", description: "서리 결정·찬 운무 / 바람과 맑은 종소리", effects: [
    { kind: "frost", amount: 0.75, size: 1.4, volume: 0.3 }, { kind: "steam", amount: 0.35, speed: 0.25, tint: "#a1cce6", sound: "chimes", volume: 0.25 }] },
  { id: "astral-gate", label: "별빛 차원문", genre: "마법", description: "큰 문양·푸른 정령·별빛 / 겹쳐 울리는 공명", effects: [
    { kind: "runes", amount: 0.6, size: 1.8, speed: 0.8, tint: "#85c8ff", volume: 0.3 }, { kind: "spirits", amount: 0.6, speed: 1.4, volume: 0.32 }, { kind: "magic", amount: 0.35, tint: "#b5ddff", volume: 0.18 }] },
  { id: "cursed-land", label: "저주받은 땅", genre: "악마", description: "독안개·검은 잔영·재 / 낮은 울림과 불길한 공명", effects: [
    { kind: "poison", amount: 0.65, tint: "#9270b1", volume: 0.4 }, { kind: "shades", amount: 0.4, volume: 0.25 }, { kind: "ash", amount: 0.4, volume: 0.15 }] },
  { id: "volcanic-forge", label: "지옥의 용암 지대", genre: "악마", description: "불씨·재·붉은 연무 / 불꽃과 저음", effects: [
    { kind: "embers", amount: 0.9, speed: 1.5, size: 1.3, volume: 0.5 }, { kind: "ash", amount: 0.6, volume: 0.15 }, { kind: "smog", amount: 0.25, tint: "#a65338", volume: 0.25 }] },
  { id: "abyss-rift", label: "심연의 균열", genre: "악마", description: "큰 그림자 잔영·보라 스파크 / 공명과 불안정한 전기음", effects: [
    { kind: "shades", amount: 0.8, size: 2, speed: 0.6, tint: "#57366f", volume: 0.45 }, { kind: "sparks", amount: 0.55, tint: "#c177ff", volume: 0.25 }, { kind: "poison", amount: 0.3, tint: "#584066", volume: 0.3 }] },
  { id: "blood-moon", label: "혈월의 의식", genre: "악마", description: "핏빛 문양·붉은 꽃잎·잔영 / 낮은 의식의 울림", effects: [
    { kind: "runes", amount: 0.5, size: 1.7, speed: 0.4, tint: "#ff586c", sound: "rumble", volume: 0.4 }, { kind: "petals", amount: 0.6, tint: "#c94458", speed: 0.55, volume: 0.2 }, { kind: "shades", amount: 0.3, tint: "#763943", volume: 0.25 }] },
  { id: "blight-marsh", label: "마독의 늪", genre: "악마", description: "녹색 독무·떠오르는 기포·괴광 / 기포와 독무 저음", effects: [
    { kind: "poison", amount: 0.85, tint: "#86ac37", volume: 0.4 }, { kind: "underwater", amount: 0.3, tint: "#a8d75a", speed: 0.4, volume: 0.3 }, { kind: "fireflies", amount: 0.45, tint: "#cbef42", sound: "whisper", volume: 0.25 }] },
  { id: "bamboo-grove", label: "바람 부는 죽림", genre: "무협", description: "초록 잎·가는 햇살 / 잎사귀 바람", effects: [
    { kind: "leaves", amount: 0.65, speed: 0.8, tint: "#8bac53", volume: 0.45 }, { kind: "sunrays", amount: 0.45, opacity: 0.5 }] },
  { id: "mountain-mist", label: "산중 운무", genre: "무협", description: "흰 운무·옅은 꽃잎 / 느린 산바람", effects: [
    { kind: "steam", amount: 0.55, speed: 0.25, opacity: 0.6, sound: "breeze", volume: 0.35 }, { kind: "petals", amount: 0.3, speed: 0.4, volume: 0.15 }] },
  { id: "plum-courtyard", label: "매화 검원", genre: "무협", description: "붉고 흰 매화 꽃잎·먼지 / 꽃잎을 실은 바람", effects: [
    { kind: "petals", amount: 0.9, size: 1.5, speed: 0.6, tint: "#f79faf", volume: 0.4 }, { kind: "dust", amount: 0.25 }, { kind: "sunrays", amount: 0.35, tint: "#ffdcc3" }] },
  { id: "sword-grave", label: "고검의 무덤", genre: "무협", description: "회색 잔영·재·차가운 운무 / 황량한 바람과 쇠울림 같은 공명", effects: [
    { kind: "ash", amount: 0.65, speed: 0.5, volume: 0.4 }, { kind: "shades", amount: 0.35, tint: "#728190", sound: "chimes", volume: 0.2 }, { kind: "steam", amount: 0.3, tint: "#9aabb5", speed: 0.15, sound: "none" }] },
  { id: "immortal-peak", label: "신선의 봉우리", genre: "무협", description: "금빛 문양·느린 운무·영기 / 맑은 종소리와 산바람", effects: [
    { kind: "runes", amount: 0.3, size: 1.1, tint: "#f4d187", volume: 0.3 }, { kind: "steam", amount: 0.35, speed: 0.2, sound: "breeze", volume: 0.3 }, { kind: "spirits", amount: 0.25, tint: "#ffe7a3", volume: 0.2 }] },
  { id: "city-smog", label: "스모그 낀 도시", genre: "현대", description: "회색 스모그·부유 먼지 / 낮은 도시 배경음", effects: [
    { kind: "smog", amount: 0.6, speed: 0.5, volume: 0.4 }, { kind: "dust", amount: 0.55 }] },
  { id: "power-station", label: "손상된 전기 시설", genre: "현대", description: "스파크·증기·누수 / 전기 잡음과 물방울", effects: [
    { kind: "sparks", amount: 0.65, volume: 0.4 }, { kind: "steam", amount: 0.25, opacity: 0.4, volume: 0.15 }, { kind: "leaks", amount: 0.4, volume: 0.3 }] },
  { id: "subway-tunnel", label: "폐지하철 터널", genre: "현대", description: "누수·탁한 먼지·옅은 연무 / 물방울과 터널 저음", effects: [
    { kind: "leaks", amount: 0.75, speed: 0.7, volume: 0.4 }, { kind: "dust", amount: 0.55, tint: "#9ba2aa", sound: "rumble", volume: 0.25 }, { kind: "smog", amount: 0.2, sound: "none" }] },
  { id: "neon-alley", label: "네온 골목", genre: "현대", description: "분홍 증기·청록 물방울·간헐적 스파크 / 증기와 전기음", effects: [
    { kind: "steam", amount: 0.4, tint: "#bd75ab", volume: 0.25 }, { kind: "leaks", amount: 0.6, tint: "#77dcdf", volume: 0.3 }, { kind: "sparks", amount: 0.2, tint: "#f4a5db", volume: 0.25 }] },
  { id: "cryo-laboratory", label: "극저온 연구실", genre: "현대", description: "청백색 증기·서리·전기 불꽃 / 냉각음과 전기 잡음", effects: [
    { kind: "steam", amount: 0.6, tint: "#b7e2ec", volume: 0.35 }, { kind: "frost", amount: 0.5, speed: 0.4, size: 0.8, sound: "none" }, { kind: "sparks", amount: 0.2, volume: 0.2 }] },
  { id: "boiler-room", label: "증기 기계실", genre: "근대", description: "진한 증기·누수 / 압력 증기와 물방울", effects: [
    { kind: "steam", amount: 0.75, speed: 1.3, volume: 0.45 }, { kind: "leaks", amount: 0.5, volume: 0.3 }] },
  { id: "steam-station", label: "증기기관 정거장", genre: "근대", description: "빠른 흰 증기·검댕·불씨 / 증기 분출과 불꽃", effects: [
    { kind: "steam", amount: 0.65, speed: 1.8, volume: 0.5 }, { kind: "ash", amount: 0.65, speed: 1.5, tint: "#777477", volume: 0.2 }, { kind: "embers", amount: 0.25, volume: 0.3 }] },
  { id: "factory-chimneys", label: "매연의 공장 지대", genre: "근대", description: "황갈색 매연·검은 재·먼지 / 공장 저음과 바람", effects: [
    { kind: "smog", amount: 0.8, tint: "#a59473", volume: 0.45 }, { kind: "ash", amount: 0.8, tint: "#666364", volume: 0.2 }, { kind: "dust", amount: 0.4 }] },
  { id: "gaslamp-street", label: "가스등 안개 거리", genre: "근대", description: "호박빛 빛줄기·낮은 안개·먼지 / 가스 새는 소리와 바람", effects: [
    { kind: "sunrays", amount: 0.8, tint: "#ffd087", opacity: 0.95 }, { kind: "steam", amount: 0.4, speed: 0.2, tint: "#c7b99b", volume: 0.22 }, { kind: "dust", amount: 0.45, sound: "breeze", volume: 0.2 }] },
  { id: "iron-foundry", label: "제철소", genre: "근대", description: "많은 불씨·주황 스파크·뜨거운 연기 / 화로와 거친 잡음", effects: [
    { kind: "embers", amount: 0.95, speed: 1.8, volume: 0.5 }, { kind: "sparks", amount: 0.6, tint: "#ffc27a", sound: "fire", volume: 0.45 }, { kind: "smog", amount: 0.4, tint: "#a17c63", volume: 0.2 }] },
  { id: "sunken-temple", label: "수중 신전", genre: "자연·수중", description: "기포·물빛·청록 문양 / 기포와 희미한 종소리", effects: [
    { kind: "underwater", amount: 0.7, speed: 0.7, volume: 0.4 }, { kind: "runes", amount: 0.3, tint: "#88e8ed", speed: 0.35, volume: 0.2 }] },
  { id: "spring-grove", label: "봄꽃 숲", genre: "자연·수중", description: "꽃잎·반딧불·따스한 햇살 / 산들바람과 풀벌레", effects: [
    { kind: "petals", amount: 0.7, size: 1.3, volume: 0.3 }, { kind: "fireflies", amount: 0.35, volume: 0.25 }, { kind: "sunrays", amount: 0.5 }] },
  { id: "autumn-road", label: "늦가을 산길", genre: "자연·수중", description: "커다란 낙엽·황금 먼지 / 낙엽 스치는 바람", effects: [
    { kind: "leaves", amount: 0.9, size: 1.5, speed: 0.75, volume: 0.45 }, { kind: "dust", amount: 0.55, tint: "#deb778" }, { kind: "sunrays", amount: 0.35, tint: "#edc386" }] },
  { id: "desert-wind", label: "사막의 모래폭풍", genre: "자연·수중", description: "빠른 모래·누런 먼지·짙은 모래 안개 / 거센 바람", effects: [
    { kind: "sand", amount: 0.95, speed: 1.65, opacity: 0.9, volume: 0.6 }, { kind: "dust", amount: 0.65, speed: 2, tint: "#dcb879" }] },
  { id: "deep-sea", label: "심해의 발광 생물", genre: "자연·수중", description: "느린 기포·푸른 발광 입자·심해 부유물 / 수중 저음과 기포", effects: [
    { kind: "underwater", amount: 0.85, speed: 0.4, tint: "#528eaa", volume: 0.45 }, { kind: "spirits", amount: 0.6, speed: 0.35, tint: "#72d8f0", sound: "rumble", volume: 0.3 }, { kind: "dust", amount: 0.5, speed: 0.3, tint: "#a0ccd9" }] },
];
