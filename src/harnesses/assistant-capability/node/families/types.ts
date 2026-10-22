import type { Project } from '../../../../project/types';
import type { JudgeInput, Rect, Setup, Verdict } from '../matrixNativeSpec';

/**
 * One command contract with five parameterized variants: judge, reference and wrongs
 * all read the same `args`, so variants differ in what is asked, not only in wording.
 * `reference()` builds the correct outcome with real editor tools (`runOn`), never
 * hand-edited JSON; `wrongs()` returns plausible live failures (wrong target, side
 * effect elsewhere, partial). `matrix500-selfcheck` proves the judge separates them.
 */

export type FamilyArea =
  | 'tiles' | 'maps' | 'events' | 'npc' | 'database' | 'media'
  | 'transfer' | 'battle' | 'interior' | 'read' | 'plan';

export type FamilyVariant = {
  /** Stable key inside the family; a spec row id is `<family>__<key>`. */
  key: string;
  prompt: string;
  /** What the prompt states. Judges, reference and wrongs all read these, so a variant differs in contract, not just in wording. */
  args: Record<string, unknown>;
  /** The editor state a person would have set before typing (selection, selected event, prior turn). */
  setup?: Setup;
};

/** A correct or incorrect outcome: the saved document, or — for read-only families — the answer text. */
export type FamilyOutcome = Project | string;

export type Family = {
  id: string;
  area: FamilyArea;
  mode: 'read' | 'write';
  title: string;
  variants: readonly FamilyVariant[];
  /**
   * Read families only: the tool calls the reference answer presupposes. The self-check
   * and the live runner treat them as receipts — the judge still checks the answer text.
   */
  readTools?: readonly string[];
  /**
   * Additive fixture extension for a family that needs something nativeProject() lacks
   * (a room, a troop, a second map). It must not change existing ids or coordinates.
   */
  prepare?(project: Project): Project;
  judge(input: JudgeInput, args: Record<string, unknown>): Verdict;
  reference(project: Project, args: Record<string, unknown>): FamilyOutcome;
  wrongs(project: Project, args: Record<string, unknown>): FamilyOutcome[];
};

/** `args.rect` (or another key) as a rectangle. Throws on a malformed family, not on a model answer. */
export function rectArg(args: Record<string, unknown>, key = 'rect'): Rect {
  const value = args[key] as Partial<Rect> | undefined;
  if (!value || ![value.x, value.y, value.w, value.h].every(n => typeof n === 'number')) {
    throw new Error(`family args.${key} must be {x,y,w,h}`);
  }
  return { x: value.x as number, y: value.y as number, w: value.w as number, h: value.h as number };
}

export function strArg(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`family args.${key} must be a non-empty string`);
  return value;
}

export function numArg(args: Record<string, unknown>, key: string): number {
  const value = args[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`family args.${key} must be a number`);
  return value;
}
