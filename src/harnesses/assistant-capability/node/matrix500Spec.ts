import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { allFamilies, familyProblems } from './families';
import type { Setup } from './matrixNativeSpec';

export const SPEC_500_PATH = 'harness-data/assistant-capability/command-matrix-500.json';
export const SPEC_500_FAMILIES = 100;
export const SPEC_500_ROWS = 500;

export type Spec500Row = {
  id: string;
  n: number;
  family: string;
  variant: string;
  area: string;
  mode: 'read' | 'write';
  title: string;
  prompt: string;
  args: Record<string, unknown>;
  setup?: Setup;
};

export type Spec500 = {
  schemaVersion: 1;
  suite: string;
  description: string;
  expected: { families: number; rows: number };
  counts: { families: number; rows: number };
  complete: boolean;
  commands: Spec500Row[];
};

export function buildSpec500(): Spec500 {
  const families = allFamilies();
  const commands: Spec500Row[] = [];
  for (const family of families) {
    for (const variant of family.variants) {
      commands.push({
        id: `${family.id}__${variant.key}`,
        n: commands.length + 1,
        family: family.id,
        variant: variant.key,
        area: family.area,
        mode: family.mode,
        title: family.title,
        prompt: variant.prompt,
        args: variant.args,
        ...(variant.setup ? { setup: variant.setup } : {}),
      });
    }
  }
  return {
    schemaVersion: 1,
    suite: 'assistant-command-matrix-500',
    description: '100개 명령 가족 × 5개 변형. 가족이 args 로 판정기·정답·오답을 함께 매개변수화한다.',
    expected: { families: SPEC_500_FAMILIES, rows: SPEC_500_ROWS },
    counts: { families: families.length, rows: commands.length },
    complete: families.length === SPEC_500_FAMILIES && commands.length === SPEC_500_ROWS,
    commands,
  };
}

export function spec500Problems(spec: Spec500): string[] {
  const problems = familyProblems();
  const ids = new Set<string>();
  for (const row of spec.commands) {
    if (ids.has(row.id)) problems.push(`행 id 중복: ${row.id}`);
    ids.add(row.id);
    if (!row.prompt.trim()) problems.push(`${row.id}: 프롬프트가 비었다`);
  }
  if (spec.commands.length !== spec.counts.families * 5) {
    problems.push(`행 ${spec.commands.length}개 ≠ 가족 ${spec.counts.families} × 5`);
  }
  if (!spec.complete) problems.push(`아직 ${spec.counts.families}/${SPEC_500_FAMILIES} 가족 · ${spec.counts.rows}/${SPEC_500_ROWS} 행 — GROUPS.md 의 남은 가족이 아직 구현되지 않았다`);
  return problems;
}

export function writeSpec500(outPath = SPEC_500_PATH): { spec: Spec500; path: string; problems: string[] } {
  const spec = buildSpec500();
  const path = resolve(outPath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(spec, null, 2)}\n`);
  return { spec, path, problems: spec500Problems(spec) };
}
