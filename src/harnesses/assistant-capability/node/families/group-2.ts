import type { Family } from './types';
import { GROUP_2_EVENTS } from './group-2-events';
import { GROUP_2_BRANCHES } from './group-2-branches';
import { GROUP_2_READ } from './group-2-read';

export const GROUP_2: readonly Family[] = [...GROUP_2_EVENTS, ...GROUP_2_BRANCHES, ...GROUP_2_READ];
