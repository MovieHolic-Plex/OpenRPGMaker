/** Read compatibility for authored anim_px_* records in existing published games. */
export const LEGACY_PIXEL_EFFECT_URLS: Readonly<Record<string, string>> = Object.fromEntries(
  ['slash', 'focus', 'arcane', 'heal', 'sleep', 'weaken', 'poison', 'fire', 'ice',
    'thunder', 'earth', 'wind', 'dark', 'holy', 'water', 'leaf', 'knife']
    .map(key => [`pixel-fx-${key}`, `/assets/generated/pixel-fx/${key}.png`]),
);
