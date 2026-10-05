import type { PresetFactory } from '../authoringPresets';
import { basicExtensions } from './moreBasics';
import { partyPresets } from './party';
import { growthPresets } from './growth';
import { dungeonPresets } from './dungeon';
import { worldStoryPresets } from './worldStory';
import { timeCausalityPresets } from './timeCausality';
import { lootEquipmentPresets } from './lootEquipment';
import { repeatChallengePresets } from './repeatChallenge';
import { endingPresets } from './endings';

// Pass the constructor after the common rules are initialized; imports above are data authors only.
export function additionalAuthoringPresets(make: PresetFactory) {
  return [basicExtensions, partyPresets, growthPresets, dungeonPresets, worldStoryPresets,
    timeCausalityPresets, lootEquipmentPresets, repeatChallengePresets, endingPresets]
    .flatMap(build => build(make));
}
