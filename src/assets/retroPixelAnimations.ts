// 도트 측면(retro2003) 전투가 DB 애니메이션 대신 그리는 도트 효과(2026-10-03).
//
// 일반 공격·아이템·연출 계약 없는 기술은 기록에 박힌 애니메이션을 그대로 재생했다 — 그래서 RM2003 전투에
// EasyRPG Blow 와 384px AI 효과 시트가 섞여 나왔다. 번들 효과는 여기서 같은 계열의 도트 시트(pixel-fx 17종,
// 64px 칸 8장)로 바꿔 끼운다. 업로드한 그림처럼 저자가 고른 시트는 건드리지 않는다.
// 포켓몬 전투는 이 표를 쓰지 않는다(그쪽 효과는 그대로다).

export const RETRO_PIXEL_FX_KEYS = [
  "slash", "focus", "arcane", "heal", "sleep", "weaken", "poison", "fire", "ice",
  "thunder", "earth", "wind", "dark", "holy", "water", "leaf", "knife",
] as const;
export type RetroPixelFxKey = typeof RETRO_PIXEL_FX_KEYS[number];

/** 시트 한 칸(px)과 칸 수 — public/assets/generated/pixel-fx/<key>.png 는 전부 512×64 다. */
export const RETRO_PIXEL_FX_FRAME = 64;
export const RETRO_PIXEL_FX_FRAMES = 8;

/** 효과음은 retroSkillChoreography 의 같은 효과 레시피와 맞춘다. */
export const RETRO_PIXEL_FX_SOUNDS: Readonly<Record<RetroPixelFxKey, string>> = {
  slash: "easyrpg-sound-attack2", focus: "easyrpg-sound-buff", arcane: "easyrpg-sound-magic2", heal: "easyrpg-sound-holy2",
  sleep: "easyrpg-sound-sleep", weaken: "easyrpg-sound-darkness3", poison: "easyrpg-sound-poison", fire: "easyrpg-sound-fire1",
  ice: "easyrpg-sound-ice1", thunder: "easyrpg-sound-flash3", earth: "easyrpg-sound-earth2", wind: "easyrpg-sound-wind8",
  dark: "easyrpg-sound-darkness3", holy: "easyrpg-sound-holy3", water: "easyrpg-sound-wave1", leaf: "easyrpg-sound-wind8",
  knife: "easyrpg-sound-shot1",
};

/** 자료집 「옛 전투 애니메이션」 목록에 보이는 이름. */
export const RETRO_PIXEL_FX_NAMES: Readonly<Record<RetroPixelFxKey, string>> = {
  slash: "베기", focus: "집중", arcane: "비전", heal: "치유", sleep: "수면", weaken: "약화", poison: "독",
  fire: "화염", ice: "얼음", thunder: "번개", earth: "대지", wind: "바람", dark: "어둠", holy: "성광",
  water: "물", leaf: "잎", knife: "단검",
};

export function retroPixelFxResourceId(key: RetroPixelFxKey): string {
  return `pixel-fx-${key}`;
}

export function retroPixelAnimationId(key: RetroPixelFxKey): string {
  return `anim_px_${key}`;
}

export const RETRO_PIXEL_FX_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  RETRO_PIXEL_FX_KEYS.map((key) => [retroPixelFxResourceId(key), `/assets/generated/pixel-fx/${key}.png`]),
);

// 384px 절차 생성 효과(slug) → 도트 효과.
const BY_GENERATED_SLUG: Readonly<Record<string, RetroPixelFxKey>> = {
  "arcane-nova": "arcane", "bite-crunch": "slash", "blind-veil": "dark", "capture-seal": "arcane",
  "claw-rake": "slash", "cleanse-sparkle": "heal", "confusion-spiral": "weaken", "critical-burst": "slash",
  "drain-orbs": "dark", "earth-spike": "earth", "fire-burst": "fire", "guard-barrier": "focus",
  "heal-bloom": "heal", "holy-beam": "holy", "ice-shatter": "ice", "leaf-volley": "leaf",
  "meteor-fall": "fire", "paralysis-bind": "thunder", "poison-mist": "poison", "power-aura": "focus",
  "projectile-shot": "knife", "psychic-wave": "arcane", "revive-rise": "holy", "shadow-pulse": "dark",
  "silence-lock": "weaken", "slash-steel": "slash", "sleep-dust": "sleep", "smoke-vanish": "wind",
  "sonic-wave": "wind", "summon-portal": "arcane", "tackle-impact": "slash", "thunder-strike": "thunder",
  "water-column": "water", "wind-slice": "wind",
};

// Scarloxy(포켓몬 팩) 효과 → 도트 효과. 포켓몬 데모 기술을 RM2003 전투로 옮겨 써도 도트로 보이게.
const BY_SCARLOXY_KEY: Readonly<Record<string, RetroPixelFxKey>> = {
  explosion: "fire", fire: "fire", green: "leaf", ice: "ice", scratch: "slash", splash: "water",
};

/**
 * 이 리소스로 그린 애니메이션을 도트 측면 전투에서 어떤 도트 효과로 바꿔 그릴지.
 * undefined 는 바꾸지 않는다는 뜻이다(이미 도트이거나, 저자가 올린 그림).
 */
export function retroPixelFxForResource(resourceId: string | undefined): RetroPixelFxKey | undefined {
  if (!resourceId) return undefined;
  if (resourceId.startsWith("generated-battle-anim-")) return BY_GENERATED_SLUG[resourceId.slice("generated-battle-anim-".length)] ?? "slash";
  if (resourceId.startsWith("scarloxy-battle-anim-")) return BY_SCARLOXY_KEY[resourceId.slice("scarloxy-battle-anim-".length)] ?? "slash";
  // 2026-10-03 deprecated/ 로 옮긴 EasyRPG 전투 시트. 불러오기 수리가 기록을 고치기 전의 사본도 도트로 그린다.
  if (resourceId === "easyrpg-battle-arrow") return "knife";
  if (resourceId.startsWith("easyrpg-battle-") && !resourceId.startsWith("easyrpg-battle-weapon-")) return "slash";
  return undefined;
}

/** 2026-10-03 deprecated/ 로 옮긴 EasyRPG 전투 시트 → 같은 역할의 번들 효과(slug). 불러오기 수리가 쓴다. */
export const DEPRECATED_EASYRPG_BATTLE_SHEETS: Readonly<Record<string, string>> = {
  "easyrpg-battle-blow": "tackle-impact",
  "easyrpg-battle-sword1": "slash-steel",
  "easyrpg-battle-arrow": "projectile-shot",
};
