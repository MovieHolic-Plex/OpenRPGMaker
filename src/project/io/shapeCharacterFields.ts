import { assert, requireNumber, requireRecord, requireString } from "./guards";
import { validateGiftPrefs, validateGiftResponses } from "./shapeEventFields";
import { isSeason } from "@/project/gameTime";

/** Optional project.characters identity package. Omitted is fine (no migration). */
export function validateCharacters(value: unknown): void {
  if (value === undefined) return;
  const characters = requireRecord("characters", value);
  for (const [characterId, profileValue] of Object.entries(characters)) {
    assert(characterId.trim().length > 0, `characters key가 비어 있습니다.`);
    validateCharacterProfile(`characters.${characterId}`, profileValue);
  }
}

function validateCharacterProfile(label: string, value: unknown): void {
  const profile = requireRecord(label, value);
  if (profile.displayName !== undefined) requireString(`${label}.displayName`, profile.displayName);
  if (profile.birthday !== undefined) validateBirthday(`${label}.birthday`, profile.birthday);
  if (profile.giftPrefs !== undefined) validateGiftPrefs(`${label}.giftPrefs`, profile.giftPrefs);
  if (profile.giftResponses !== undefined) validateGiftResponses(`${label}.giftResponses`, profile.giftResponses);
  // 대화 설정은 모르는 값을 런타임이 기본으로 되돌리므로(normalizeSpeakerDialogueProfile) 모양만 본다.
  if (profile.dialogue !== undefined) requireRecord(`${label}.dialogue`, profile.dialogue);
}

function validateBirthday(label: string, value: unknown): void {
  const birthday = requireRecord(label, value);
  const season = requireString(`${label}.season`, birthday.season);
  assert(isSeason(season), `${label}.season이 잘못되었습니다.`);
  const day = requireNumber(`${label}.day`, birthday.day);
  assert(Number.isInteger(day) && day >= 1 && day <= 99, `${label}.day는 1~99 정수여야 합니다.`);
}
