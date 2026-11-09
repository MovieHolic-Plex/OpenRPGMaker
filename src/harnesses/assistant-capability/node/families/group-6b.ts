import type { Family } from './types';
import { GROUP_6B_PARTY } from './group-6b-party';
import { GROUP_6B_GATE } from './group-6b-gate';

/** ds500 game-making families (group 6b). Filled by the ds-tools lane; each family = 5 variants with a machine judge. */
export const GROUP_6B: readonly Family[] = [...GROUP_6B_PARTY, ...GROUP_6B_GATE];
