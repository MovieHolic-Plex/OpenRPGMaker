import type { Season } from "@/project/gameTime";
import type { CharacterProfile, GameEvent, GiftPrefs, GiftResponses, Project } from "@/project/types";

export type CharacterBirthday = { readonly season: Season; readonly day: number };

/** Automatic feedback labels share the linked resident identity; page names remain the fallback. */
export function resolveCharacterSpeaker(project: Project, event: GameEvent): string | undefined {
  return getCharacterProfile(project, event.characterId)?.displayName ?? event.pages?.[0]?.name;
}

/** Opt-in project.characters[characterId] lookup. Empty/missing characterId → undefined. */
export function getCharacterProfile(
  project: Project,
  characterId: string | undefined | null
): CharacterProfile | undefined {
  const id = characterId?.trim();
  if (!id) return undefined;
  return project.characters?.[id];
}

/**
 * Gift prefs: event.giftPrefs when present, else characters[characterId].giftPrefs.
 * Event-local fully replaces profile defaults (no field merge).
 */
export function resolveGiftPrefs(project: Project, event: GameEvent): GiftPrefs | undefined {
  if (event.giftPrefs !== undefined) return event.giftPrefs;
  return getCharacterProfile(project, event.characterId)?.giftPrefs;
}

/**
 * Gift responses: event.giftResponses when present, else characters[characterId].giftResponses.
 * Event-local fully replaces profile defaults (no field merge).
 */
export function resolveGiftResponses(project: Project, event: GameEvent): GiftResponses | undefined {
  if (event.giftResponses !== undefined) return event.giftResponses;
  return getCharacterProfile(project, event.characterId)?.giftResponses;
}

/**
 * Birthday for gift multiplier: event.socialCalendar.birthday when set,
 * else characters[characterId].birthday. No merge of season/day halves.
 */
export function resolveBirthday(project: Project, event: GameEvent): CharacterBirthday | undefined {
  if (event.socialCalendar?.birthday !== undefined) return event.socialCalendar.birthday;
  return getCharacterProfile(project, event.characterId)?.birthday;
}
