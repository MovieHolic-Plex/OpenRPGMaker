import { isDeepStrictEqual } from 'node:util';
import type { Project } from '../../../../project/types';
import { MAP, clone, fail, mapOf, pass, runOn, sameExcept, type JudgeInput, type Verdict } from '../matrixNativeSpec';
import { attempt, distinct } from './group-4-shared';
import type { Family, FamilyOutcome, FamilyVariant } from './types';

/** Shared machinery for the quest families: judge the saved QuestDef contract, not the ids the model picked. */

export const VILLAGE = MAP;
export const PLAZA_MAP = 'map_plaza';
export const FIELD_MAP = 'map_field';
export const NPC_RESIDENT = 'ev_utility_npc';
export const NPC_SHOP = 'ev_test_shop';

type Ref = { eventId?: string; name?: string };

const stepQuests = (project: Project): any[] => ((project as any).quests ?? []).filter((quest: any) => Array.isArray(quest?.steps));
const keyOf = (quest: any): string => String(quest.key ?? quest.id ?? '');

/** The quests the turn added; every pre-existing quest must be untouched. */
export function addedQuests(before: Project, after: Project): { added: any[]; problem?: string } {
  const was = (((before as any).quests ?? []) as any[]);
  const now = (((after as any).quests ?? []) as any[]);
  for (const old of was) {
    const kept = now.find(quest => keyOf(quest) === keyOf(old));
    if (!kept || !isDeepStrictEqual(kept, old)) return { added: [], problem: `기존 퀘스트 ${keyOf(old)} 가 바뀌었거나 사라졌다` };
  }
  return { added: stepQuests(after).filter(quest => !was.some(old => keyOf(old) === keyOf(quest))) };
}

/** `spec` names either an existing event (matched by id) or a new NPC (matched by name). */
export function refMatches(ref: any, spec: Ref): boolean {
  if (!ref) return false;
  if (spec.eventId) return ref.eventId === spec.eventId;
  const created = ref.create;
  return Boolean(created && spec.name && String(created.name ?? '').includes(spec.name));
}

export const refText = (spec: Ref): string => (spec.eventId ? spec.eventId : `새 NPC 「${spec.name}」`);

export const rewardItemsOf = (quest: any): Array<{ itemId: string; count: number }> =>
  [...(quest.rewards?.items ?? [])].map((entry: any) => ({ itemId: entry.itemId, count: entry.count })).sort((a, b) => a.itemId.localeCompare(b.itemId));

/** Reward contract when the prompt states one: gold exactly, items exactly (order free). Absent keys are not checked. */
export function rewardVerdict(quest: any, args: Record<string, unknown>): Verdict | undefined {
  if (typeof args.gold === 'number' && (quest.rewards?.gold ?? 0) !== args.gold) return fail(`보상 골드 ${quest.rewards?.gold ?? 0} — ${args.gold} 여야 한다`);
  if (Array.isArray(args.rewardItems)) {
    const want = [...(args.rewardItems as Array<{ itemId: string; count: number }>)].sort((a, b) => a.itemId.localeCompare(b.itemId));
    if (!isDeepStrictEqual(rewardItemsOf(quest), want)) return fail(`보상 아이템 ${JSON.stringify(rewardItemsOf(quest))} — ${JSON.stringify(want)} 여야 한다`);
  }
  return undefined;
}

export function giverVerdict(quest: any, args: Record<string, unknown>): Verdict | undefined {
  const spec = args.giver as Ref | undefined;
  if (spec && !refMatches(quest.giver, spec)) return fail(`의뢰인이 ${JSON.stringify(quest.giver?.create?.name ?? quest.giver?.eventId)} — ${refText(spec)} 여야 한다`);
  return undefined;
}

/** Everything the compiler may add (quest def, flags, its own events, edits of the existing NPCs it wires) is blanked; the rest must be identical. */
function restUnchanged(input: JudgeInput, quest: any): boolean {
  const known = new Map<string, Set<string>>();
  for (const [mapId, map] of Object.entries<any>((input.before as any).maps)) known.set(mapId, new Set((map.events ?? []).map((event: any) => event.id)));
  const wired = new Set<string>();
  const note = (ref: any) => { if (ref?.eventId) wired.add(ref.eventId); };
  note(quest.giver);
  for (const step of quest.steps ?? []) note(step.target);
  for (const change of quest.worldChanges ?? []) note(change.target);
  const blank = (doc: any) => {
    delete doc.quests; delete doc.switches; delete doc.variables; delete doc.session;
    for (const [mapId, map] of Object.entries<any>(doc.maps)) {
      map.events = (map.events ?? []).filter((event: any) => known.get(mapId)?.has(event.id) && !wired.has(event.id));
    }
  };
  return sameExcept(input.before, input.after, blank);
}

export type QuestSpec = {
  id: string;
  title: string;
  variants: readonly FamilyVariant[];
  /** The def the real tool receives for the correct answer. */
  build(args: Record<string, unknown>): any;
  /** Contract on the saved def (beyond giver/reward, which `giverVerdict`/`rewardVerdict` do when args carry them). */
  check(quest: any, args: Record<string, unknown>): Verdict;
  /** Plausible wrong answers, each a function that breaks the correct def one way. */
  mutations(args: Record<string, unknown>): Array<(def: any) => void>;
  /** Extra checks on the whole saved project (e.g. the events the quest needs). */
  extra?(input: JudgeInput, quest: any, args: Record<string, unknown>): Verdict | undefined;
  prepare?(project: Project): Project;
};

export function questFamily(spec: QuestSpec): Family {
  const family: Family = {
    id: spec.id,
    area: 'quest',
    mode: 'write',
    title: spec.title,
    variants: spec.variants,
    ...(spec.prepare ? { prepare: spec.prepare } : {}),
    judge(input, args) {
      const { added, problem } = addedQuests(input.before, input.after);
      if (problem) return fail(problem);
      if (added.length !== 1) return fail(`새 퀘스트가 ${added.length}개다(하나여야 한다)`);
      const quest = added[0];
      const verdicts = [giverVerdict(quest, args), spec.check(quest, args), rewardVerdict(quest, args)];
      const bad = verdicts.find(verdict => verdict && !verdict.ok);
      if (bad) return bad;
      const lead = verdicts.find(verdict => verdict?.ok);
      const extra = spec.extra?.(input, quest, args);
      if (extra && !extra.ok) return extra;
      if (!restUnchanged(input, quest)) return fail('퀘스트·그 이벤트/플래그 밖의 내용이 바뀌었다');
      return pass(`${keyOf(quest)}: ${lead?.note ?? '퀘스트 정의 일치'}`);
    },
    reference(project, args) {
      return runOn(clone(project), 'create_quest', { def: spec.build(args) });
    },
    wrongs(project, args): FamilyOutcome[] {
      const reference = family.reference(clone(project), args) as Project;
      const outcomes: Array<Project | undefined> = spec.mutations(args).map(mutate => attempt(() => {
        const def = clone(spec.build(args));
        mutate(def);
        return runOn(clone(project), 'create_quest', { def });
      }));
      // 의뢰는 만들었지만 요청 밖의 데이터(아이템 가격)까지 건드린 답.
      const sideEffect = clone(reference) as any;
      sideEffect.database.items[0].price = (sideEffect.database.items[0].price ?? 0) + 1;
      outcomes.push(sideEffect);
      return distinct(reference, outcomes);
    },
  };
  return family;
}

export const mapName = (project: Project, id: string): string => String(mapOf(project, id)?.name ?? id);

export const giverDef = (spec: Ref, mapId = VILLAGE, x = 9, y = 9): any =>
  spec.eventId ? { mapId: VILLAGE, eventId: spec.eventId } : { create: { mapId, x, y, name: spec.name } };

export const pickups = (count: number, mapId = VILLAGE, x0 = 3, y = 4): any[] =>
  Array.from({ length: count }, (_, index) => ({ kind: 'pickup', mapId, x: x0 + index, y }));
