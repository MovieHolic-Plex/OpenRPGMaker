import { readFileSync, readdirSync, existsSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { writeRuntimeProject } from './editorDriver.mjs';
import { judge } from './matrixNativeSpec';
import { allFamilies } from './families';
import type { Project } from '../../../project/types';

/**
 * Re-judge saved native runs without calling a model or a browser. The judges are pure functions of the
 * saved documents and trace, so a judge fix is verified against exactly the evidence the live run produced.
 * Only commands whose saved turn finished are re-judged; a command that never produced documents keeps its result.
 */
export function rescoreNativeRun(root: string): Array<{ id: string; n: number; was: boolean; now: boolean; note: string }> {
  const projectDir = resolve(root, 'project');
  const scratch = resolve(root, 'rescore-expanded.json');
  // Tilesets are the same blobs in every saved document of a root; expanding them once keeps this fast.
  let heavy: { tilesets: unknown; assets: unknown } | null = null;
  const expand = (file: string): Project => {
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    if (!heavy) {
      writeRuntimeProject(projectDir, scratch, saved);
      const full = JSON.parse(readFileSync(scratch, 'utf8'));
      heavy = { tilesets: full.tilesets, assets: full.assets };
    }
    return { ...saved, ...heavy } as Project;
  };
  const rows: Array<{ id: string; n: number; was: boolean; now: boolean; note: string }> = [];
  const families = allFamilies();
  const judgeOf = (id: string) => {
    const family = families.find(entry => id.startsWith(`${entry.id}__`));
    if (!family) return (input: any) => judge(id, input);
    const variant = family.variants.find(entry => entry.key === id.slice(family.id.length + 2));
    if (!variant) throw new Error(`${id}: 가족 ${family.id} 에 변형이 없다`);
    return (input: any) => family.judge(input, variant.args ?? {});
  };
  try {
    for (const id of readdirSync(root)) {
      const dir = resolve(root, id), resultFile = resolve(dir, 'native-result.json');
      if (!existsSync(resultFile) || !existsSync(resolve(dir, 'after.json'))) continue;
      const result = JSON.parse(readFileSync(resultFile, 'utf8'));
      const verdict = judgeOf(id)({
        original: expand(resolve(dir, existsSync(resolve(dir, 'original.json')) ? 'original.json' : 'before.json')),
        before: expand(resolve(dir, 'before.json')),
        after: expand(resolve(dir, 'after.json')),
        tools: result.toolRecords ?? [], answer: result.assistantText ?? '',
      });
      const now = result.turnOk !== false && verdict.ok && result.persistence === true;
      rows.push({ id, n: result.n, was: Boolean(result.ok), now, note: verdict.note });
    }
  } finally { rmSync(scratch, { force: true }); }
  return rows.sort((a, b) => a.n - b.n);
}

if (import.meta.main ?? process.argv[1]?.endsWith('matrixNativeRescore.ts')) {
  const roots = process.argv.slice(2).filter(arg => arg !== '--');
  const all = roots.flatMap(root => rescoreNativeRun(resolve(root)));
  for (const row of all.sort((a, b) => a.n - b.n)) console.log(`${row.now ? 'ok  ' : 'FAIL'} #${row.n} ${row.id}${row.was !== row.now ? ` (was ${row.was ? 'ok' : 'fail'})` : ''} :: ${row.note}`);
  console.log(`rescored ${all.length}: ${all.filter(row => row.now).length} pass`);
  writeFileSync('/tmp/rescore.json', JSON.stringify(all, null, 2));
}
