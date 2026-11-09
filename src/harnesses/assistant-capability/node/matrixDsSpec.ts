import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { allFamilies, dsFamilies, familyProblems } from './families';
import type { Spec500, Spec500Row } from './matrix500Spec';
import { DS_REUSED_FAMILIES } from './families/dsReuse';

export const DS500_PATH = 'harness-data/assistant-capability/command-matrix-ds500.json';
export const DS500_ROWS = 500;

/**
 * ds500: the rows a game needs, run against oc/deepseek-v4.1-flash at max effort.
 * Reused families keep their `<family>__<variant>` ids (so old results stay comparable); new ones come from
 * `dsFamilies()`. Drawing, tile painting and interior tile work are not in it by construction.
 */
export function buildDs500(): Spec500 {
  const byId = new Map(allFamilies().map(family => [family.id, family]));
  const missing = DS_REUSED_FAMILIES.filter(id => !byId.has(id));
  if (missing.length) throw new Error(`ds500: 없는 재사용 가족 ${missing.join(',')}`);
  const picked = [...DS_REUSED_FAMILIES.map(id => byId.get(id)!), ...dsFamilies()];
  const commands: Spec500Row[] = [];
  for (const family of picked) {
    for (const variant of family.variants) {
      commands.push({
        id: `${family.id}__${variant.key}`, n: commands.length + 1, family: family.id, variant: variant.key,
        area: family.area, mode: family.mode, title: family.title, prompt: variant.prompt, args: variant.args,
        ...(variant.setup ? { setup: variant.setup } : {}),
      });
    }
  }
  return {
    schemaVersion: 1,
    suite: 'assistant-command-matrix-ds500',
    description: '게임 제작에 필요한 명령 가족 × 5 변형(그림·타일 칠하기 제외). 재사용 가족은 ac500 id 를 그대로 쓴다.',
    expected: { families: picked.length, rows: DS500_ROWS },
    counts: { families: picked.length, rows: commands.length },
    complete: commands.length === DS500_ROWS,
    commands,
  };
}

export function ds500Problems(spec: Spec500): string[] {
  const problems = familyProblems();
  const ids = new Set<string>();
  for (const row of spec.commands) {
    if (ids.has(row.id)) problems.push(`행 id 중복: ${row.id}`);
    ids.add(row.id);
  }
  if (!spec.complete) problems.push(`행 ${spec.counts.rows}/${DS500_ROWS} — 신규 가족이 모자라거나 넘친다`);
  const drawing = spec.commands.filter(row => row.area === 'tiles' || row.area === 'interior');
  if (drawing.length) problems.push(`그림·타일 가족이 섞였다: ${[...new Set(drawing.map(row => row.family))].join(',')}`);
  return problems;
}

export function writeDs500(outPath = DS500_PATH): { spec: Spec500; path: string; problems: string[] } {
  const spec = buildDs500();
  const path = resolve(outPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(spec, null, 2)}\n`);
  return { spec, path, problems: ds500Problems(spec) };
}
