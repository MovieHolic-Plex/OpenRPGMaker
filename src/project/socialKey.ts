// Opt-in relationship identity for friendship/gifts.
// Product law: docs/specs/2026-07-14-character-id-relationship-gate.md
// NEVER fall back to event.id for social maps.

export type SocialHost = {
  readonly id: string;
  readonly characterId?: string;
};

/**
 * Resolve the session key for friendship / dailyGifts / dailyTalks.
 * - explicit npcKey wins (author override string)
 * - else trimmed characterId
 * - else null (hard gate — no event.id fallback)
 */
export function resolveSocialKey(
  event: SocialHost,
  explicitNpcKey?: string
): string | null {
  const explicit = explicitNpcKey?.trim();
  if (explicit) return explicit;
  const id = event.characterId?.trim();
  return id || null;
}

/** True when the host has a non-empty characterId (self social features allowed). */
export function hasCharacterId(event: { readonly characterId?: string } | null | undefined): boolean {
  return Boolean(event?.characterId?.trim());
}
