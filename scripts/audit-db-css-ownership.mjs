// Machine-readable source inventory, not a pixel/cascade-equivalence verdict.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import postcss from 'postcss';
import { designatedDeclarations, selectorIdentity } from './lib/db-css-owner-proof.mjs';

const base = process.argv[2] ?? execFileSync('git', ['merge-base', 'HEAD', 'origin/main'], { encoding: 'utf8' }).trim();
// Validate and inventory the tree before treating an absent baseline path as empty.
// Git failures for invalid revisions, unreadable trees or existing blobs still fail.
const baseTree = execFileSync('git', ['rev-parse', '--verify', '--end-of-options', `${base}^{tree}`], { encoding: 'utf8' }).trim();
const baseFiles = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', '-z', baseTree, '--', 'src'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).split('\0'));
const output = resolve(process.argv[3] ?? '.omo/evidence/db-css-ownership/ownership-inventory.json');
const files = execFileSync('git', ['ls-files', 'src/**/*.css'], { encoding: 'utf8' }).trim().split('\n');
const sourceFiles = execFileSync('git', ['ls-files', 'src/**/*.ts'], { encoding: 'utf8' }).trim().split('\n');
const readBase = path => baseFiles.has(path)
  ? execFileSync('git', ['show', `${baseTree}:${path}`], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  : '';
const shared = 'src/styles/database/studio-v2.css';
const navigation = 'src/styles/database/workspace-modern.css';
const declarations = (css, file) => {
  const result = [];
  postcss.parse(css, { from: file }).walkDecls(node => {
    const ancestors = [];
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (parent.type === 'atrule') ancestors.unshift(`@${parent.name} ${parent.params}`);
    }
    result.push({ file, line: node.source.start.line, context: ancestors.join(' / '), selector: node.parent.selector ?? '@' + node.parent.name,
      property: node.prop, value: node.value, important: Boolean(node.important) });
  });
  return result;
};
const classify = file => {
  if (/assistant|tabs-b-(?:shell-layout|status-menu|title-screen|resource-manager)/.test(file)) return 'non-DB or mixed external consumer: retained';
  if (/studio-v2|studio-theme|sidebar|workspace-modern|modern-controls|record-thumbs|virtual-list/.test(file)) return 'shared chrome';
  if (/desktop|light-theme|core|tabs-a|tabs-b\.css|event-editor-legacy|event\/command-forms\/forms\.css/.test(file)) return 'compatibility / legacy composition';
  return 'domain composition';
};
// 2026-09-11 Task 13: 이벤트 시트의 DB 계열 규칙(.db-field / .db-field-hint)을 갖던 event-editor-legacy.part-1.css 는
// 구성 요소 버킷 command-forms/forms.css 로 접혔다. 기준 트리(재편성 전)에서는 옛 경로로 읽되 새 경로 이름으로 기록해,
// 파일 이동이 "삭제된 선언" 으로 잡히지 않게 한다.
const EVENT_LEGACY_MOVED = { from: 'src/styles/event/event-editor-legacy.part-1.css', to: 'src/styles/event/command-forms/forms.css' };
const relevant = file => file.startsWith('src/styles/database/') || [EVENT_LEGACY_MOVED.to, 'src/styles/editor/world-panel.css'].includes(file);
const baseSource = file => (file === EVENT_LEGACY_MOVED.to && !baseFiles.has(file) ? readBase(EVENT_LEGACY_MOVED.from) : readBase(file));
const before = files.filter(relevant).flatMap(file => declarations(baseSource(file), file));
const after = files.filter(relevant).flatMap(file => declarations(readFileSync(file, 'utf8'), file));
const key = d => JSON.stringify([d.file, d.context, d.selector, d.property, d.value, d.important]);
const remaining = new Map();
for (const d of after) remaining.set(key(d), (remaining.get(key(d)) ?? 0) + 1);
const removed = before.filter(d => { const n = remaining.get(key(d)) ?? 0; if (n) { remaining.set(key(d), n - 1); return false; } return true; });
const db = '.database-modal-backdrop .database-modal-window .database-modal-body';
const exact = (file, selector, contract, context = '') => ({ file, selector, context, contract });
const sharedRule = (selector, contract) => exact(shared, `${db} ${selector}`, contract);
const actionSelector = ['.db-toolbar .btn', '.db-toolbar .db-toolbar-button', '.db-ws-btn'].map(s => `${db} ${s}`).join(', ');
const inputSelector = `${db} input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):where(:not(.db-number-stepper input)), ${db} textarea`;
const owners = {
  shell: exact(shared, '.database-modal-backdrop .database-modal-window:has(.db-shared-workspace) .database-modal-header', 'shared modal header spacing'),
  stepper: sharedRule('.db-number-stepper', 'one 32px numeric border box'),
  stepperInput: sharedRule('.db-number-stepper > input[type="number"]', 'borderless numeric interior'),
  stepperIcon: sharedRule('.db-number-stepper-icon', 'stepper icon geometry and inert pointer behavior'),
  stepperButton: sharedRule('.db-number-stepper-button', 'native increment/decrement button chrome'),
  captions: sharedRule('.db-field > span:first-child', 'ordinary 12.5px captions'),
  navigation: exact(navigation, `${db} .db-ws-section-tab`, 'shared 34px underline section role'),
  actions: exact(shared, actionSelector, 'shared intrinsic-width 32px CRUD chrome'),
  rows: sharedRule('.db-list-row', 'listRow emits db-list-row and db-ws-row together; shared row radius'),
  thumbnails: exact('src/styles/database/record-list-modern.css', `${db} .db-list-row .db-list-thumb`, 'ordinary DB row 24px'),
  actorPortrait: exact('src/styles/database/desktop-record-shell/13-actor-studio.css', `${db} .db-actor-identity-cell .db-list-thumb, .db-actor-identity-cell .db-list-thumb-crop, .db-actor-avatar-fallback`, 'actor identity 36px portrait', '@media (min-width: 901px)'),
  composition: exact(navigation, `${db} .db-ws-card-body > .db-ws-btn`, 'grid direct-child action alignment'),
  modalBody: exact('src/styles/database/sidebar.css', '.database-modal-backdrop .database-modal-window:has(.db-shared-workspace) .database-modal-body', 'bounded modal body containing independent detail scrollers'),
  legends: sharedRule(':is(.db-ws-card-title, fieldset > legend, .db-panel > h4, .db-ws-card-head h4)', 'native legend typography and placement'),
  numbers: sharedRule('.db-list-row .db-list-number', '11.5px mono list ordinal'),
  cards: sharedRule(':is( .db-ws-card, fieldset, .oprn-db-fieldset, .db-panel, .db-class-panel, .db-advanced-panel, .db-state-panel )', 'shared card chrome, not card-header descendants'),
  scroll: exact('src/styles/database/modern/troops.css', `${db} .oprn-record-troops .oprn-detail-form`, 'Troops detail owns main scroll'),
  controls: exact(shared, inputSelector, 'ordinary text chrome, excluding native variants and stepper interiors'),
};
const intrinsic = {
  'width': { value: 'auto', reason: 'The field grid allocates control width; no domain 100% width override remains.' },
  'padding': { value: '0', reason: 'Legacy wrapper padding is removed; active domain forms and shared cards own their own insets.' },
  'grid-template-columns': { value: 'none', reason: 'Shared section strip uses wrapping flex layout; legacy grid tracks no longer apply.' },
  'overflow': { value: 'visible', reason: 'Intrinsic-width action no longer clips its caption.' },
  'text-overflow': { value: 'clip', reason: 'Intrinsic-width action fits its caption rather than truncating it.' },
  'height': { value: 'auto', reason: 'Shared action min-height:32px plus padding and line-height owns the target size.' },
  'outline-offset': { value: '0', reason: 'Shared input uses its border and focus shadow instead of a separate outline.' },
  'letter-spacing': { value: 'normal', reason: 'Ordinary Korean/mixed captions inherit normal tracking instead of domain-specific spacing.' },
  'text-transform': { value: 'none', reason: 'Ordinary captions preserve authored case rather than uppercase Latin text.' },
  '-moz-appearance': { value: 'auto', reason: 'Bare native numbers keep browser spinners; shared composite alone suppresses native chrome.' },
  '-webkit-appearance': { value: 'auto', reason: 'Bare native numbers keep browser spinners; shared composite alone suppresses native chrome.' },
  'min-width': { value: 'auto', reason: 'Content-based minimum replaces arbitrary domain action minimum width.' },
  'min-height': { value: 'auto', reason: 'Explicit shared control height replaces domain minimum height.' },
  'margin-top': { value: '0', reason: 'Removed legacy detail-form offset; the containing workspace gap owns separation.' },
  'margin': { value: '0', reason: 'Removed legacy form margin; workspace gap owns separation.' },
  'padding-top': { value: '0', reason: 'Removed legacy inset; shared card padding owns spacing.' },
  'text-shadow': { value: 'none', reason: 'Modern text has no decorative shadow.' },
};
function ownerFor(d) {
  // These four shared rules only lower exclusion specificity; they still exclude steppers.
  const controlState = `${db} :is(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):where(:not(.db-number-stepper input)), select, textarea)`;
  const controlSelectors = [inputSelector, ...[':hover:not(:disabled):not(:focus-visible)', ':focus-visible', ':disabled'].map(state => controlState + state)];
  const loweredSelector = selectorIdentity(d.selector).replace(':not(.db-number-stepper input)', ':where(:not(.db-number-stepper input))');
  if (d.file === shared && d.context === '' && controlSelectors.includes(loweredSelector)) {
    return { kind: 'specificity-adjusted', declarations: designatedDeclarations(after, exact(shared, loweredSelector, 'same ordinary-control consumers with zero-specificity stepper exclusion'), d.property) };
  }
  if (d.file.endsWith('/growth-tree.css') && d.selector === `${db} .growth-studio :is(button, input, textarea, select):focus-visible`) {
    const retained = exact(d.file, `${db} .growth-studio :is(button, input:not([type="radio"]), textarea, select):focus-visible`, 'retained non-radio focus', d.context);
    const radio = exact('src/styles/database/modern-controls.css', '.database-modal-backdrop .database-modal-window input[type="radio"]:focus-visible', 'native radio focus');
    return { kind: 'scope-split', retained: { declarations: designatedDeclarations(after, retained, d.property) },
      removedConsumers: { selector: `${db} .growth-studio input[type="radio"]:focus-visible`, declarations: designatedDeclarations(after, radio, d.property) } };
  }
  if (d.file.endsWith('/studio-theme.css') && d.property === 'font-size' && d.selector.includes('.tileset-selected-layer-badge')) {
    const narrowedSelector = d.selector.replace(/\n  \.btn,/u, '\n  .btn:where(:not(.db-toolbar .btn):not(.db-ws-btn)),');
    const narrowed = exact(d.file, narrowedSelector, 'retained enumerated readability floor', d.context);
    return { kind: 'scope-split', retained: { declarations: designatedDeclarations(after, narrowed, d.property) },
      removedConsumers: { selector: `${db} :is(.db-toolbar .btn, .db-ws-btn)`, reason: 'Only shared actions leave the readability floor; every retained enumerated consumer keeps the exact narrowed rule.', declarations: designatedDeclarations(after, owners.actions, 'font-size') } };
  }
  if (d.property === 'justify-self' && d.selector.includes('.db-ws-range')) {
    const rangeSelector = '.database-modal-backdrop .database-modal-window .database-modal-body .db-ws-range';
    const flexOwner = after.filter(a => a.file === navigation && a.selector === rangeSelector && a.context === '' && a.property === 'display' && a.value === 'flex');
    if (!flexOwner.length) throw new Error('Missing range flex composition owner');
    return { kind: 'split-composition', declarations: designatedDeclarations(after, owners.composition, d.property),
      intrinsic: { selector: d.selector.split(',')[1].trim(), property: d.property,
        reason: 'justify-self does not apply to flex items; the range flex composition is unchanged.', declarations: flexOwner } };
  }
  if (d.file.endsWith('/record-thumbs.css') && d.selector === '.db-list-thumb' && /^(width|height)$/.test(d.property)) {
    return { kind: 'split-consumers', declarations: after.filter(a => a.property === d.property && ((a.file === d.file && a.context === '' && a.selector === '.db-list-thumb:not(.database-modal-window .db-list-thumb)') || (a.file === owners.thumbnails.file && selectorIdentity(a.selector) === selectorIdentity(owners.thumbnails.selector) && a.context === owners.thumbnails.context))) };
  }
  if (d.file.endsWith('/modern-controls.css') && d.property === 'cursor' && selectorIdentity(d.selector) === '.database-modal-backdrop .database-modal-window input:disabled, .database-modal-backdrop .database-modal-window select:disabled') {
    return { kind: 'scope-split', retained: { declarations: designatedDeclarations(after, exact(d.file, '.database-modal-backdrop .database-modal-window select:disabled', 'native disabled select cursor'), 'cursor') },
      removedConsumers: { selector: '.database-modal-backdrop .database-modal-window input:disabled', value: 'auto', reason: 'The redundant broad not-allowed cursor is removed; bare native inputs keep their initial cursor and disabled semantics. Composite disabled input cursor remains explicitly owned in Studio.', declarations: designatedDeclarations(after, sharedRule('.db-number-stepper.is-disabled > input[type="number"]', 'disabled composite input cursor'), 'cursor') } };
  }
  const oldBranches = postcss.list.comma(d.selector).map(selectorIdentity);
  const narrowed = after.filter(a => a.file === d.file && a.context === d.context && a.property === d.property && a.value === d.value
    && postcss.list.comma(a.selector).length < oldBranches.length
    && postcss.list.comma(a.selector).every(s => oldBranches.includes(selectorIdentity(s))));
  if (narrowed.length) return { kind: 'scope-narrowed', declarations: narrowed,
    removedConsumers: { selectors: oldBranches.filter(s => !narrowed.some(a => postcss.list.comma(a.selector).map(selectorIdentity).includes(s))),
      reason: 'Removed broad numeric compatibility branch; native controls retain browser defaults, while composite interiors are owned by the explicit Studio stepper rules.' } };
  const same = after.filter(a => a.file === d.file && a.context === d.context && a.selector === d.selector && a.property === d.property);
  if (same.length) return { kind: 'replacement-in-owner', declarations: same };
  let role;
  if (/db-actor-identity-cell.*db-list-thumb/.test(d.selector)) role = 'actorPortrait';
  else if (/db-list-thumb/.test(d.selector)) role = 'thumbnails';
  else if (/db-list-number/.test(d.selector)) role = 'numbers';
  else if (/fieldset > legend|db-ws-card-title/.test(d.selector)) role = 'legends';
  else if (d.property === 'justify-self') role = 'composition';
  else if (d.selector.endsWith('.database-modal-body')) role = 'modalBody';
  else if (/db-number-stepper-icon/.test(d.selector)) role = 'stepperIcon';
  else if (/db-number-stepper/.test(d.selector)) role = /(?:input|spin-button)/.test(d.selector) ? 'stepperInput' : /-button|-dec|-inc/.test(d.selector) ? 'stepperButton' : 'stepper';
  else if (/section-tab|db-enemy-inspector-tabs/.test(d.selector)) role = 'navigation';
  else if (/db-toolbar|db-ws-btn/.test(d.selector)) role = 'actions';
  else if (/db-ws-row/.test(d.selector)) role = 'rows';
  else if (/db-field\s*>\s*span|span:not\(\[class\]\)|span\[class=|:is\(\.field, label\)/.test(d.selector)) role = 'captions';
  else if (/database-modal-header/.test(d.selector)) role = 'shell';
  else if (/db-detail|oprn-record-detail-pane|oprn-record-troops|db-battle-studio-surface/.test(d.selector) && /margin|overflow|height|padding|grid/.test(d.property)) role = 'scroll';
  else if (/fieldset|db-ws-card|db-panel/.test(d.selector) && !/input/.test(d.selector)) role = 'cards';
  else if (/(?:^|[\s,(>+~])(?:input|select|textarea)(?=[\s.#[:),>+~]|$)/.test(d.selector)) role = 'controls';
  else if (/\.btn,/.test(d.selector)) role = 'actions';
  if (!role) {
    throw new Error(`Unmapped removal: ${d.file}:${d.line} ${d.selector} ${d.property}`);
  }
  let owner = role === 'numbers' && d.property === 'color' ? { ...owners.numbers, file: owners.thumbnails.file } : owners[role];
  if (role === 'scroll' && d.selector.includes('.db-battle-studio-surface')) owner = exact('src/styles/database/animation-editor.css', '.database-modal-backdrop .database-modal-window .animation-detail-form', 'animation authoring scroller replaces battle-surface visible overflow');
  if (role === 'scroll' && d.selector.includes('oprn-record-classes')) return { kind: 'scroll-delegation', removedAncestorOverflow: d.property, declarations: designatedDeclarations(after, exact('src/styles/database/desktop-record-shell/03-class-panels.css', '.database-modal-body .oprn-record-classes .oprn-detail-form', 'Classes main detail scroll', '@media (min-width: 901px)'), 'overflow-y') };
  if (role === 'navigation' && /^outline/.test(d.property)) owner = exact(navigation, `${db} .db-ws-section-tab:focus-visible`, 'section focus ring');
  if (role === 'actions' && /^outline/.test(d.property)) owner = sharedRule(':is(.db-toolbar .btn, .db-toolbar-button, .db-ws-btn):focus-visible', 'shared action focus ring');
  if (role === 'actions' && d.property === 'opacity') owner = sharedRule(':is(.db-toolbar .btn, .db-toolbar-button, .db-ws-btn):disabled', 'shared action disabled opacity');
  if (role === 'stepper' && d.selector.includes(':focus-within')) owner = sharedRule('.db-number-stepper:focus-within', 'single composite focus ring');
  if (role === 'stepperInput' && d.selector.includes('.is-disabled') && ['cursor', 'color'].includes(d.property)) owner = sharedRule('.db-number-stepper.is-disabled > input[type="number"]', 'disabled numeric interior');
  if (role === 'stepperButton' && /^outline/.test(d.property)) owner = sharedRule('.db-number-stepper-button:focus-visible', 'step button keyboard focus');
  if (role === 'stepperButton' && d.property === 'opacity') owner = sharedRule('.db-number-stepper-button:disabled', 'disabled step button');
  if (role === 'controls' && d.property === 'outline') owner = sharedRule(':is(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):where(:not(.db-number-stepper input)), select, textarea):focus-visible', 'ordinary control focus');
  if (role === 'stepperInput' && d.property === 'background') return { kind: 'longhand-and-initial-values', declarations: designatedDeclarations(after, owner, 'background-color'),
    initialValues: { 'background-image': 'none', 'background-position': '0% 0%', 'background-size': 'auto', 'background-repeat': 'repeat', 'background-origin': 'padding-box', 'background-clip': 'border-box', 'background-attachment': 'scroll' },
    reason: 'The interior now owns only its transparent background color; the other formerly reset background longhands keep their initial values.' };
  if (role === 'controls' && /^(appearance|-moz-appearance|-webkit-appearance|margin)$/.test(d.property) && /input\[type="number"\]/.test(d.selector)) {
    return { kind: 'split-native-composite', native: { selector: d.selector, value: 'revert', reason: 'Bare numbers keep browser spinner styling; no author reset remains.' },
      composite: { declarations: designatedDeclarations(after, d.selector.includes('spin-button')
        ? exact(shared, `${db} .db-number-stepper input::-webkit-inner-spin-button, ${db} .db-number-stepper input::-webkit-outer-spin-button`, 'composite native spinner suppression')
        : owners.stepperInput, d.property.startsWith('-') ? 'appearance' : d.property) } };
  }
  const defaultRoles = { actions: ['min-width', 'height', 'overflow', 'text-overflow'], captions: ['letter-spacing', 'text-transform'], navigation: ['grid-template-columns'], controls: ['outline-offset', 'min-width', 'width'] };
  const replacement = defaultRoles[role]?.includes(d.property) ? intrinsic[d.property] : undefined;
  const candidates = designatedDeclarations(after, owner, d.property, Boolean(replacement));
  if (candidates.length) return { kind: 'designated-property-owner', role, contract: owner.contract, declarations: candidates };
  if (replacement) {
    const support = role === 'actions' && d.property === 'height' ? designatedDeclarations(after, owners.actions, 'min-height')
      : role === 'navigation' ? designatedDeclarations(after, exact(navigation, `${db} .db-ws-section-tabs`, 'wrapping section-strip composition'), 'display')
      : role === 'controls' && ['min-width', 'width'].includes(d.property) ? designatedDeclarations(after, sharedRule('.db-field', 'field grid allocation'), 'display') : [];
    return { kind: 'intrinsic-default', role, property: d.property, ...replacement, supportingDeclarations: support };
  }
  throw new Error(`Missing surviving owner/property ${role}: ${d.file}:${d.line} ${d.property}`);
}
const mappingErrors = [];
const mappings = removed.flatMap(declaration => {
  try { return [{ removed: declaration, replacement: ownerFor(declaration) }]; }
  catch (error) { mappingErrors.push(`${declaration.file}:${declaration.line} ${declaration.selector} ${declaration.property} -> ${error.message}`); return []; }
});
if (mappingErrors.length) throw new Error(mappingErrors.join('\n'));
const imports = [];
for (const file of [...files, ...sourceFiles]) {
  const css = file.endsWith('.css');
  const expression = css ? /@import\s+(?:url\()?['"]([^'"]+\.css)['"]/g : /import\s*(?:\(\s*)?['"]([^'"]+\.css)['"]/g;
  for (const match of readFileSync(file, 'utf8').matchAll(expression)) {
    const target = match[1].startsWith('@/') ? 'src/' + match[1].slice(2) : relative(process.cwd(), resolve(dirname(file), match[1]));
    if (relevant(target) || relevant(file)) imports.push({ from: file, to: target, kind: css ? 'CSS import' : 'component-loaded stylesheet' });
  }
}
const roleMetrics = list => Object.fromEntries(Object.entries({ stepper: /db-number-stepper/, captionTypography: /db-field\s*>\s*span/, sectionChrome: /actor-section-tab|db-enemy-inspector-tabs button|db-ws-section-tab/, crudChrome: /db-toolbar \.btn|db-ws-btn/ }).map(([role, pattern]) => {
  const rows = list.filter(d => pattern.test(d.selector.replace(/:not\([^)]*\)/g, '')) && /^(font|font-size|font-weight|height|min-height|border|border-radius|background|color|box-shadow)/.test(d.property));
  return [role, { declarations: rows.length, contributorFiles: [...new Set(rows.map(d => d.file))].sort() }];
}));
const retainedImportant = after.filter(d => d.important).map(d => {
  const role = /\[hidden\]/.test(d.selector) ? 'semantic hidden: author display must not expose inactive panels' :
    /assistant|tabs-b-/.test(d.file) ? 'external assistant/runtime shell: not shared DB chrome' :
    /system/.test(d.file) ? 'System worksheet: bounded section and preview variant' :
    /tileset|tile-|chipset/.test(d.selector) ? 'tileset authoring: source-grid and art geometry' :
    /portrait|face|actor-sheet-crop/.test(d.selector) ? 'actor art: source crop geometry' :
    /db-tab-group/.test(d.selector) ? 'sidebar group: readable heading and disclosure geometry' :
    /db-tab/.test(d.selector) ? 'sidebar navigation: rail geometry and selected state' :
    /database-footer|database-modal-footer/.test(d.selector) ? 'modal footer: fixed actions, save emphasis and autosave status' :
    /database-modal-header/.test(d.selector) ? 'modal header: fixed title and drag chrome' :
    /oprn-detail-skills/.test(d.selector) ? 'skill composer: flexible composer and reference placement' :
    /db-enemy-bm101/.test(d.selector) ? 'enemy workbench: three-column authoring composition' :
    /oprn-record-troops|db-troop-member/.test(d.selector) ? 'troop composition: list tracks and member placement' :
    /db-state-rate/.test(d.selector) ? 'state rates: label and value column composition' :
    /oprn-record-identity/.test(d.selector) ? 'record identity: obsolete duplicate ID presentation hidden' :
    /db-empty|db-studio-empty/.test(d.selector) ? 'empty state: recovery surface and primary action' :
    /db-detail-form/.test(d.selector) ? 'detail composition: transparent form over shared card surfaces' :
    /db-item-spec/.test(d.selector) ? 'item specification: compact row spacing' :
    /db-character-id/.test(d.selector) ? 'character identity: mono metadata variant' :
    /oprn-record-list-pane|oprn-record-detail-pane/.test(d.selector) ? 'workspace panes: borderless structural surface, not shared cards' :
    /:is\(/.test(d.selector) ? 'readability bridge: enumerated compact text consumers retain line-height floor' :
    /database-modal-body/.test(d.selector) ? 'modal body: bounded flex allocation and canvas surface' :
    /database-modal-window/.test(d.selector) ? 'modal frame: fixed desktop geometry and tokenized surface' :
    /is-docked/.test(d.selector) ? 'docked workspace: transparent pointer-through backdrop and zero inset' :
    /db-title-workbench/.test(d.selector) ? 'runtime title preview: editor still frame disables entrance animation' :
    (() => { throw new Error(`Unclassified important role: ${d.file}:${d.line}`); })();
  return { ...d, justification: `${role}; retained ${d.property}=${d.value} at the recorded exact selector/context.` };
});
const report = { base, revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  definitions: { functionalDeclarations: 'PostCSS declaration nodes including custom properties; excludes comments. Selector narrowing is recorded as replacement, not automatically counted as net deletion.', ownershipMetric: 'Explicit shared-role chrome declarations/contributor files, not a claim of full computed cascade equivalence.' },
  files: files.filter(relevant).map(file => ({ file, classification: classify(file), before: before.filter(d => d.file === file).length, after: after.filter(d => d.file === file).length })),
  imports, owners, metrics: { before: before.length, after: after.length, netRemoved: before.length - after.length, removedOrReplaced: mappings.length, explicitRolesBefore: roleMetrics(before), explicitRolesAfter: roleMetrics(after) },
  removedDeclarationsToOwner: mappings, retainedImportant };
mkdirSync(dirname(output), { recursive: true });writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.metrics, null, 2));
