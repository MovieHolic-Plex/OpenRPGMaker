import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { expect, it } from 'vitest';
import { designatedDeclarations, selectorIdentity } from '../scripts/lib/db-css-owner-proof.mjs';
import { readCssFamily } from './cssFamily';

const db = '.database-modal-backdrop .database-modal-window .database-modal-body';
type Declaration = { file: string; selector: string; context: string; property: string; value: string };
function declarations(file: string): Declaration[] {
  const result: Declaration[] = [];
  const css = file === 'src/styles/database/studio-v2.css'
    ? readCssFamily('src/styles/database/index.css', file)
    : readFileSync(file, 'utf8');
  postcss.parse(css).walkDecls(decl => {
    if (decl.parent?.type !== 'rule') return;
    const context: string[] = [];
    for (let parent = decl.parent.parent; parent; parent = parent.parent) {
      if (parent.type === 'atrule') context.unshift(`@${parent.name} ${parent.params}`);
    }
    result.push({ file, selector: decl.parent.selector, context: context.join(' / '), property: decl.prop, value: decl.value });
  });
  return result;
}

it.each([
  ['src/styles/database/studio-v2.css', `${db} .db-list-row`, 'border-radius'],
  ['src/styles/database/workspace-modern.css', `${db} .db-ws-card-body > .db-ws-btn`, 'justify-self'],
  ['src/styles/database/sidebar.css', '.database-modal-backdrop .database-modal-window:has(.db-shared-workspace) .database-modal-body', 'overflow'],
  ['src/styles/database/studio-v2.css', `${db} :is( .db-ws-card, fieldset, .oprn-db-fieldset, .db-panel, .db-class-panel, .db-advanced-panel, .db-state-panel )`, 'border-radius'],
])('rejects deletion of only the designated %s rule', (file, selector, property) => {
  const all = declarations(file);
  const owner = { file, selector, context: '' };
  const proof = designatedDeclarations(all, owner, property);
  expect(proof).toHaveLength(1);
  // Remove exactly one real declaration. Descendants, similarly prefixed rules
  // and all unrelated radius/overflow declarations remain in the input corpus.
  const removed = all.filter(declaration => declaration !== proof[0]);
  expect(removed).toHaveLength(all.length - 1);
  expect(removed.some(d => d.property === property && selectorIdentity(d.selector) !== selectorIdentity(selector))).toBe(true);
  expect(() => designatedDeclarations(removed, owner, property)).toThrow(/Missing designated property/);
  expect(designatedDeclarations([...removed, proof[0]], owner, property)).toHaveLength(1);
});

it('does not substitute a descendant, prefixed class, another file or another at-rule context', () => {
  const owner = { file: 'owner.css', selector: '.card', context: '' };
  const decoys = [
    { ...owner, selector: '.card .body', property: 'border-radius' },
    { ...owner, selector: '.card-head', property: 'border-radius' },
    { ...owner, file: 'domain.css', property: 'border-radius' },
    { ...owner, context: '@media (max-width: 600px)', property: 'border-radius' },
  ];
  expect(() => designatedDeclarations(decoys, owner, 'border-radius')).toThrow(/Missing designated property/);
});

it('accepts valid shorthand coverage, not similarly named unrelated properties', () => {
  const owner = { file: 'owner.css', selector: '.field', context: '' };
  const all = [{ ...owner, property: 'font' }, { ...owner, property: 'border' }];
  expect(designatedDeclarations(all, owner, 'font-size')).toHaveLength(1);
  expect(designatedDeclarations(all, owner, 'line-height')).toHaveLength(1);
  expect(designatedDeclarations(all, owner, 'border-top')).toHaveLength(1);
  for (const property of ['border-radius', 'border-spacing', 'border-image-width']) {
    expect(() => designatedDeclarations(all, owner, property)).toThrow(/Missing designated property/);
  }
});
