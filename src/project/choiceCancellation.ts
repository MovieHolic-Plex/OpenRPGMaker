import type { ChoiceCancelBehavior } from './types';

/** Esc/X maps to an option, a separate branch (-1), or stays open (null). */
export function cancelChoiceIndex(behavior: ChoiceCancelBehavior | undefined, optionCount: number): number | null {
  if (!behavior || behavior === 'disallow') return null;
  if (behavior === 'branch') return -1;
  const index = Number(behavior.replace('choice', '')) - 1;
  return Number.isInteger(index) && index >= 0 && index < optionCount ? index : null;
}
