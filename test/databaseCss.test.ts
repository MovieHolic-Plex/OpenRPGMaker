import { expect, it, describe } from "vitest";
import { readFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import postcss from "postcss";
import { designatedDeclarations, selectorIdentity } from "../scripts/lib/db-css-owner-proof.mjs";
import { readCssFamily } from "./cssFamily";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { isolateTimers } from "./mergedTeardown";

describe("databaseCssOwnerProof", () => {
  isolateTimers();
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
});

describe("databaseCssOwnershipAudit", () => {
  isolateTimers();
  const script = resolve('scripts/audit-db-css-ownership.mjs');
  const cssFile = 'src/styles/database/fixture.css';
  const addedFile = 'src/styles/database/assistant-sticky-checklist.css';
  function fixture() {
    const cwd = mkdtempSync(join(tmpdir(), 'db-css-audit-'));
    const env = { ...process.env, GIT_AUTHOR_NAME: 'Audit fixture', GIT_AUTHOR_EMAIL: 'audit@example.invalid',
      GIT_COMMITTER_NAME: 'Audit fixture', GIT_COMMITTER_EMAIL: 'audit@example.invalid',
      GIT_AUTHOR_DATE: '2026-09-06T00:00:00Z', GIT_COMMITTER_DATE: '2026-09-06T00:00:00Z' };
    const git = (args: string[], input?: string) => execFileSync('git', args, { cwd, env, input, encoding: 'utf8' }).trim();
    git(['init', '--quiet']);
    function track(file: string, content: string) {
      mkdirSync(dirname(join(cwd, file)), { recursive: true });
      writeFileSync(join(cwd, file), content);
      const blob = git(['hash-object', '-w', '--stdin'], content);
      git(['update-index', '--add', '--cacheinfo', `100644,${blob},${file}`]);
      return blob;
    }
    // Plumbing creates only disposable fixture history, never touches the worktree index.
    function revision(parent?: string) {
      const tree = git(['write-tree']);
      const sha = git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', 'fixture']);
      git(['update-ref', 'HEAD', sha]);
      return sha;
    }
    function audit(base?: string) {
      const output = join(cwd, '.omo/evidence/db-css-ownership/ownership-inventory.json');
      const result = spawnSync(process.execPath, [script, ...(base ? [base, output] : [])], {
        cwd, env, encoding: 'utf8', timeout: 10_000,
      });
      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      return { ...result, output };
    }
    track('src/app/main.ts', 'export {};\n');
    return { cwd, git, track, revision, audit, cleanup: () => rmSync(cwd, { recursive: true, force: true }) };
  }
  it('counts added CSS as zero before while preserving exact existing declaration evidence', () => {
    const f = fixture();
    try {
      f.track(cssFile, '@media (min-width: 901px) { .fixture { color: red; } }');
      const base = f.revision();
      f.track(cssFile, '@media (min-width: 901px) { .fixture { color: blue; } }');
      f.track(addedFile, '.assistant-sticky-checklist { display: grid; }');
      const result = f.audit(base);
      expect(result.status, result.stderr).toBe(0);
      const report = JSON.parse(readFileSync(result.output, 'utf8'));
      expect(report.base).toBe(base);
      expect(report.files).toEqual(expect.arrayContaining([
        expect.objectContaining({ file: addedFile, before: 0, after: 1 }),
        expect.objectContaining({ file: cssFile, before: 1, after: 1 }),
      ]));
      expect(report.metrics).toMatchObject({ before: 1, after: 2, netRemoved: -1, removedOrReplaced: 1 });
      expect(report.removedDeclarationsToOwner).toEqual([{
        removed: { file: cssFile, line: 1, context: '@media (min-width: 901px)', selector: '.fixture',
          property: 'color', value: 'red', important: false },
        replacement: { kind: 'replacement-in-owner', declarations: [
          { file: cssFile, line: 1, context: '@media (min-width: 901px)', selector: '.fixture',
            property: 'color', value: 'blue', important: false },
        ] },
      }]);
    } finally { f.cleanup(); }
  });
  it('uses the current merge-base, excluding upstream-only removals but rejecting them for an explicit historical base', () => {
    const f = fixture();
    try {
      f.track(cssFile, '.upstream-retired { transform: scale(1); }');
      const historical = f.revision();
      f.track(cssFile, '.upstream-current { display: grid; }');
      const integratedMain = f.revision(historical);
      f.revision(integratedMain);
      // origin/main advances beyond the integrated revision; the default is not its tip.
      f.track(cssFile, '.upstream-next { display: flex; }');
      const upstreamTree = f.git(['write-tree']);
      const upstreamTip = f.git(['commit-tree', upstreamTree, '-p', integratedMain, '-m', 'upstream']);
      f.git(['update-ref', 'refs/remotes/origin/main', upstreamTip]);
      f.track(cssFile, '.upstream-current { display: grid; }');
      const result = f.audit();
      expect(result.status, result.stderr).toBe(0);
      const report = JSON.parse(readFileSync(result.output, 'utf8'));
      expect(report.base).toBe(integratedMain);
      expect(report.metrics).toMatchObject({ before: 1, after: 1, netRemoved: 0, removedOrReplaced: 0 });
      expect(report.removedDeclarationsToOwner).toEqual([]);
      rmSync(result.output);
      const archived = f.audit(historical);
      expect(archived.status).toBe(1);
      expect(archived.stderr).toMatch(/Unmapped removal:/);
      expect(existsSync(archived.output)).toBe(false);
    } finally { f.cleanup(); }
  });
  it.each(['base', 'hover', 'focus', 'disabled'] as const)('keeps exact property proof for the shared control %s specificity adjustment', state => {
    const f = fixture();
    try {
      const shared = 'src/styles/database/studio-v2.css';
      const db = '.database-modal-backdrop .database-modal-window .database-modal-body';
      const input = 'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]):not(.db-number-stepper input)';
      const suffix = { base: '', hover: ':hover:not(:disabled):not(:focus-visible)', focus: ':focus-visible', disabled: ':disabled' }[state];
      const selector = state === 'base' ? `${db} ${input}, ${db} textarea` : `${db} :is(${input}, select, textarea)${suffix}`;
      const lowered = selector.replace(':not(.db-number-stepper input)', ':where(:not(.db-number-stepper input))');
      f.track(shared, `${selector} { transition: border-color 120ms ease; }`);
      const base = f.revision();
      f.track(shared, `${lowered} { transition: border-color 120ms ease; }`);
      const result = f.audit(base);
      expect(result.status, result.stderr).toBe(0);
      const report = JSON.parse(readFileSync(result.output, 'utf8'));
      expect(report.removedDeclarationsToOwner).toHaveLength(1);
      expect(report.removedDeclarationsToOwner[0].replacement).toEqual({ kind: 'specificity-adjusted', declarations: [
        { file: shared, selector: lowered, context: '', line: 1, property: 'transition', value: 'border-color 120ms ease', important: false },
      ] });
      rmSync(result.output);
      // Exact selector without the property, descendant, wrong context and wrong file remain.
      f.track(shared, `${lowered} { color: red; }\n${lowered} .child { transition: none; }\n@media (min-width: 901px) { ${lowered} { transition: none; } }`);
      f.track(cssFile, `${lowered} { transition: none; }`);
      const missingOwner = f.audit(base);
      expect(missingOwner.status).toBe(1);
      expect(missingOwner.stderr).toMatch(/Missing designated property/);
      expect(existsSync(missingOwner.output)).toBe(false);
    } finally { f.cleanup(); }
  });
  it.each(['missing-revision', 'blob'])('rejects an invalid %s base rather than counting everything as added', kind => {
    const f = fixture();
    try {
      const blob = f.track(cssFile, '.fixture { color: red; }');
      f.revision();
      const result = f.audit(kind === 'blob' ? blob : 'missing-revision');
      expect(result.status).toBe(1);
      expect(existsSync(result.output)).toBe(false);
    } finally { f.cleanup(); }
  });
  it('propagates Git read errors for a path that exists in the validated base tree', () => {
    const f = fixture();
    try {
      const blob = f.track(cssFile, '.fixture { color: red; }');
      const base = f.revision();
      rmSync(join(f.cwd, '.git/objects', blob.slice(0, 2), blob.slice(2)));
      const result = f.audit(base);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('git show');
      expect(existsSync(result.output)).toBe(false);
    } finally { f.cleanup(); }
  });
});
