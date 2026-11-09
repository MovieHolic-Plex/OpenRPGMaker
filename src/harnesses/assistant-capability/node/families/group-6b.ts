import type { Family } from './types';
import { GROUP_6B_PARTY } from './group-6b-party';
import { GROUP_6B_GATE } from './group-6b-gate';
import { GROUP_6B_CONTAINER } from './group-6b-container';
import { GROUP_6B_NPC } from './group-6b-npc';
import { GROUP_6B_STORY } from './group-6b-story';

/** ds500 game-making families (group 6b). Filled by the ds-tools lane; each family = 5 variants with a machine judge. */
export const GROUP_6B: readonly Family[] = [...GROUP_6B_PARTY, ...GROUP_6B_GATE, ...GROUP_6B_CONTAINER, ...GROUP_6B_NPC, ...GROUP_6B_STORY];
