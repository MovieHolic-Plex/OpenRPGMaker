import type { Season } from "@/project/gameTime";
import type { CharacterProfile, GameEvent, GiftPrefs, GiftResponses, Project } from "@/project/types";

export type CharacterBirthday = { readonly season: Season; readonly day: number };

/** Automatic feedback labels share the linked resident identity; page names remain the fallback. */
export function resolveCharacterSpeaker(project: Project, event: GameEvent): string | undefined {
  // 인물(characterId)이 있는 이벤트는 상태 페이지 제목(「수현 · 첫 만남」)이 아니라 이벤트의 고정된 이름을 말하는 이름으로 쓴다
  // (조수가 인물 프로필을 안 만들어도 대화창 이름표가 사람 이름이다 — 2026-10-16 연애 시험 캡처에서 「한하린 · 첫인상」으로 보였다).
  const authoredName = event.characterId?.trim() ? event.name?.trim() : undefined;
  return getCharacterProfile(project, event.characterId)?.displayName ?? (authoredName || undefined) ?? event.pages?.[0]?.name;
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
