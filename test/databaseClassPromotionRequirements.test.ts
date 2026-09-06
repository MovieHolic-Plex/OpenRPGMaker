// @vitest-environment happy-dom
import { afterEach, expect, it } from 'vitest';
import { renderClassRecordForm } from '@/editor/panels/databaseClassRecordView';
import { updateDatabaseRecord } from '@/editor/databaseActions';
import { resetMapEditHistory } from '@/editor/mapEditHistory';
import { createBlankProject } from '@/project/defaults';
import { applyGrowthPreset } from '@/project/growth/presets';
import { investSkillNode, treeSpentPoints } from '@/project/growth/runtime';
import { deserialize, serialize } from '@/project/io';
import { startSession } from '@/project/session';
import { promoteActor } from '@/project/sessionClass';
import { store } from '@/project/store';
import type { ClassPromotionRequirement } from '@/project/types';

afterEach(() => { resetMapEditHistory(); document.body.replaceChildren(); });

function mount(legacy = false, empty = false) {
  const project = createBlankProject();
  const bundle = applyGrowthPreset(project, 'bundle-vanguard');
  const klass = project.database.classes.find(c => c.id === bundle.addedClassIds[0])!;
  const actor = project.database.actors[0]!;
  actor.classId = klass.id;
  if (legacy) Object.assign(klass.promotions![0]!.requires, {
    switchId: project.switches[0]!.id, itemId: project.database.items[0]!.id,
    variableId: project.variables[0]!.id, atLeast: 2,
  });
  if (empty) klass.promotions = [];
  store.replace(project); resetMapEditHistory();
  const form = document.createElement('section'); document.body.append(form);
  renderClassRecordForm(form, klass);
  const change = (id: string, value: string, event = 'change') => {
    const control = form.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-testid="${id}"]`)!;
    control.value = value;
    control.dispatchEvent(new Event(event, { bubbles: true }));
  };
  const reload = () => {
    const loaded = deserialize(serialize(store.getCurrent()));
    return { loaded, promotions: loaded.database.classes.find(c => c.id === klass.id)!.promotions! };
  };
  return { project, bundle, klass, actor, form, change, reload };
}

it.each(['input', 'change'])('preserves all connected gates through a native level %s and reload; untrained promotion stays blocked', event => {
  const { klass, actor, change, reload } = mount();
  const original = structuredClone(klass.promotions!);
  expect(original[0]!.requires).toMatchObject({
    level: 5, requiredSkillIds: [expect.any(String)],
    requiredNodes: [{ treeId: expect.any(String), nodeId: expect.any(String), rank: 2 }],
    requiredTreePoints: [{ treeId: expect.any(String), points: 3 }],
  });
  change('db-field-class-promotion-level', '6', event);
  const { loaded, promotions } = reload();
  const session = startSession(loaded);
  session.actorLevels[actor.id] = 6;
  const tree = loaded.growth!.skillTrees.find(t => t.classIds.includes(klass.id))!;
  expect(treeSpentPoints(loaded, session, actor.id, tree.id)).toBe(0);
  const untrained = structuredClone(session);
  expect.soft(promoteActor(session, loaded, actor.id, promotions[0]!.toClassId)).toEqual({
    ok: false, actorId: actor.id, reason: 'requirements-not-met',
  });
  expect.soft(session).toEqual(untrained);
  expect(promotions).toEqual([{ ...original[0], requires: { ...original[0]!.requires, level: 6 } }, original[1]]);
  for (const node of tree.nodes) for (let rank = 0; rank < node.maxRank; rank++) {
    expect(investSkillNode(loaded, session, actor.id, tree.id, node.id)).toBeUndefined();
  }
  expect(promoteActor(session, loaded, actor.id, promotions[0]!.toClassId).ok).toBe(true);
});

it.each(['threshold before variable', 'clear and reselect variable'])('preserves the visible paired draft through %s, reload, and runtime threshold checks', ordering => {
  const { klass, actor, form, change, reload } = mount();
  const original = structuredClone(klass.promotions!);
  const variable = form.querySelector<HTMLSelectElement>('[data-testid="db-picker-class-promotion-variable"]')!;
  const threshold = form.querySelector<HTMLInputElement>('[data-testid="db-field-class-promotion-at-least"]')!;
  const edit = (control: HTMLInputElement | HTMLSelectElement, value: string) => {
    control.focus();
    change(control.dataset.testid!, value, 'input');
    control.dispatchEvent(new Event('change', { bubbles: true }));
  };
  expect(variable.value).toBe('');
  if (ordering === 'clear and reselect variable') edit(variable, 'var_0001');
  edit(threshold, '7');
  if (ordering === 'clear and reselect variable') {
    expect(reload().promotions[0]!.requires.atLeast).toBe(7);
    edit(variable, '');
  }
  expect(reload().promotions[0]!.requires.atLeast).toBeUndefined();
  expect(threshold.value).toBe('7');
  // An unrelated current-store edit must survive the paired-control commit.
  const current = store.getCurrent().database.classes.find(c => c.id === klass.id)!.promotions!;
  updateDatabaseRecord('classes', klass.id, {
    promotions: [{ ...current[0]!, requires: { ...current[0]!.requires, level: 6 } }, current[1]!],
  });
  edit(variable, 'var_0001');
  expect(form.querySelector('[data-testid="db-field-class-promotion-at-least"]')).toBe(threshold);
  expect(threshold.value).toBe('7');
  const { loaded, promotions } = reload();
  expect.soft(promotions).toEqual([
    { ...original[0], requires: { ...original[0]!.requires, level: 6, variableId: 'var_0001', atLeast: 7 } }, original[1],
  ]);
  const session = startSession(loaded);
  session.actorLevels[actor.id] = 6;
  const tree = loaded.growth!.skillTrees.find(t => t.classIds.includes(klass.id))!;
  for (const node of tree.nodes) for (let rank = 0; rank < node.maxRank; rank++) {
    expect(investSkillNode(loaded, session, actor.id, tree.id, node.id)).toBeUndefined();
  }
  for (const value of [1, 6]) {
    const attempt = structuredClone(session);
    attempt.variables.var_0001 = value;
    const before = structuredClone(attempt);
    expect.soft(promoteActor(attempt, loaded, actor.id, promotions[0]!.toClassId)).toEqual({
      ok: false, actorId: actor.id, reason: 'requirements-not-met',
    });
    expect.soft(attempt).toEqual(before);
  }
  session.variables.var_0001 = 7;
  expect(promoteActor(session, loaded, actor.id, promotions[0]!.toClassId)).toEqual({
    ok: true, actorId: actor.id, classId: promotions[0]!.toClassId,
  });
});

it.each([
  ['level', 'db-field-class-promotion-level'],
  ['switchId', 'db-picker-class-promotion-switch'],
  ['itemId', 'db-picker-class-promotion-item'],
  ['variableId', 'db-picker-class-promotion-variable'],
  ['atLeast', 'db-field-class-promotion-at-least'],
] as const)('edits and clears only legacy %s while retaining complete requirements and sibling promotions', (key, id) => {
  const { project, klass, change, reload } = mount(true);
  const original = structuredClone(klass.promotions!);
  const values = { level: 6, switchId: project.switches[1]!.id, itemId: project.database.items[1]!.id,
    variableId: project.variables[1]!.id, atLeast: 7 };
  change(id, String(values[key]));
  expect(reload().promotions).toEqual([
    { ...original[0], requires: { ...original[0]!.requires, [key]: values[key] } }, original[1],
  ]);
  change(id, '', 'input');
  const cleared: ClassPromotionRequirement = { ...original[0]!.requires, [key]: undefined };
  if (key === 'variableId') cleared.atLeast = undefined;
  expect(reload().promotions).toEqual([{ ...original[0], requires: cleared }, original[1]]);
});

it('changes and clears the native destination without dropping gates or changing the sibling edge', () => {
  const { bundle, klass, change, reload } = mount(true);
  const original = structuredClone(klass.promotions!);
  change('db-picker-class-promotion-to', bundle.addedClassIds[3]!);
  expect(reload().promotions).toEqual([{ ...original[0], toClassId: bundle.addedClassIds[3] }, original[1]]);
  change('db-picker-class-promotion-to', '', 'input');
  expect(reload().promotions).toEqual([original[1]]);
});

it('retains draft legacy controls when creating the first promotion in the empty row', () => {
  const { project, bundle, change, reload } = mount(false, true);
  change('db-field-class-promotion-level', '6', 'input');
  change('db-picker-class-promotion-variable', project.variables[0]!.id);
  change('db-field-class-promotion-at-least', '7', 'input');
  change('db-picker-class-promotion-to', bundle.addedClassIds[1]!);
  expect(reload().promotions).toEqual([{
    toClassId: bundle.addedClassIds[1],
    requires: { level: 6, variableId: project.variables[0]!.id, atLeast: 7 },
  }]);
});

it('reads the current promotion on every edit, preserving changes from another authoring surface', () => {
  const { project, bundle, klass, change, reload } = mount();
  const original = structuredClone(klass.promotions!);
  const requires: ClassPromotionRequirement = {
    level: 9, switchId: project.switches[1]!.id, itemId: project.database.items[1]!.id,
    variableId: project.variables[1]!.id, atLeast: 7,
    requiredSkillIds: [bundle.addedSkillIds[1]!],
    requiredNodes: original[0]!.requires.requiredNodes!.map(r => ({ ...r, rank: 1 })),
    requiredTreePoints: original[0]!.requires.requiredTreePoints!.map(r => ({ ...r, points: 2 })),
  };
  updateDatabaseRecord('classes', klass.id, {
    promotions: [{ toClassId: bundle.addedClassIds[3]!, requires }, original[1]!],
  });
  change('db-field-class-promotion-level', '6', 'input');
  expect(reload().promotions).toEqual([
    { toClassId: bundle.addedClassIds[3], requires: { ...requires, level: 6 } }, original[1],
  ]);
  const latest = { ...requires, level: 8, requiredSkillIds: [bundle.addedSkillIds[2]!] };
  updateDatabaseRecord('classes', klass.id, {
    promotions: [{ toClassId: bundle.addedClassIds[3]!, requires: latest }, original[1]!],
  });
  change('db-picker-class-promotion-to', original[0]!.toClassId);
  expect(reload().promotions).toEqual([{ toClassId: original[0]!.toClassId, requires: latest }, original[1]]);
});
