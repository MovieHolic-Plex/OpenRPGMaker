import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Project } from '../../../project/types';
import { cachedNativeProject, type JudgeInput, type Verdict } from './matrixNativeSpec';
import { allFamilies, familyProblems, type Family, type FamilyOutcome } from './families';

/**
 * Proves each family's judge separates right from wrong without a model or a browser:
 * the reference must pass, every wrong outcome must fail, and for write families the
 * unchanged document must fail. A judge that cannot tell these apart scores live runs
 * meaninglessly, so this gate runs before any 500-command pass.
 */

const isDocument = (outcome: FamilyOutcome): outcome is Project => typeof outcome !== 'string';

function inputFor(family: Family, project: Project, outcome: FamilyOutcome): JudgeInput {
  const tools = (family.readTools ?? []).map(name => ({ name, ok: true }));
  return {
    original: project,
    before: project,
    after: isDocument(outcome) ? outcome : project,
    tools,
    answer: typeof outcome === 'string' ? outcome : '',
  };
}

type VariantRow = {
  key: string;
  sound: boolean;
  reasons: string[];
  reference: Verdict;
  wrongs: Array<Verdict & { index: number }>;
  unchanged?: Verdict;
};

type FamilyRow = {
  id: string;
  area: string;
  mode: string;
  title: string;
  sound: boolean;
  variants: VariantRow[];
};

function checkVariant(family: Family, project: Project, variant: Family['variants'][number]): VariantRow {
  const reasons: string[] = [];
  let reference: Verdict;
  try {
    reference = family.judge(inputFor(family, project, family.reference(project, variant.args)), variant.args);
  } catch (error) {
    reference = { ok: false, note: `정답 생성 실패: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!reference.ok) reasons.push(`정답을 통과시키지 않았다: ${reference.note}`);

  let outcomes: FamilyOutcome[] = [];
  try {
    outcomes = family.wrongs(project, variant.args);
  } catch (error) {
    reasons.push(`오답 생성 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (outcomes.length < 2) reasons.push(`오답이 ${outcomes.length}개뿐이다(2개 이상이어야 한다)`);
  const wrongs = outcomes.map((outcome, index) => {
    let verdict: Verdict;
    try {
      verdict = family.judge(inputFor(family, project, outcome), variant.args);
    } catch (error) {
      verdict = { ok: false, note: `오답 판정 실패: ${error instanceof Error ? error.message : String(error)}` };
    }
    if (verdict.ok) reasons.push(`오답 ${index + 1}을 통과시켰다: ${verdict.note}`);
    return { index, ...verdict };
  });

  let unchanged: Verdict | undefined;
  if (family.mode === 'write') {
    unchanged = family.judge(inputFor(family, project, project), variant.args);
    if (unchanged.ok) reasons.push(`무변경 문서를 통과시켰다: ${unchanged.note}`);
  }

  return { key: variant.key, sound: reasons.length === 0, reasons, reference, wrongs, ...(unchanged ? { unchanged } : {}) };
}

export async function runMatrix500Selfcheck(root: string): Promise<number> {
  const families = allFamilies();
  const structural = familyProblems(families);
  const rows: FamilyRow[] = families.map(family => {
    const project = family.prepare ? family.prepare(cachedNativeProject()) : cachedNativeProject();
    const variants = family.variants.map(variant => checkVariant(family, project, variant));
    return {
      id: family.id,
      area: family.area,
      mode: family.mode,
      title: family.title,
      sound: variants.every(variant => variant.sound),
      variants,
    };
  });
  const variantCount = rows.reduce((total, row) => total + row.variants.length, 0);
  const soundVariants = rows.reduce((total, row) => total + row.variants.filter(variant => variant.sound).length, 0);
  const outcome = {
    schemaVersion: 1,
    kind: 'assistant-command-matrix-500-selfcheck',
    families: rows.length,
    variants: variantCount,
    soundFamilies: rows.filter(row => row.sound).length,
    soundVariants,
    structuralProblems: structural,
    rows,
  };
  mkdirSync(root, { recursive: true });
  writeFileSync(resolve(root, 'selfcheck.json'), JSON.stringify(outcome, null, 2));
  const lines = rows.flatMap(row => row.variants.map(variant => `${variant.sound ? 'ok  ' : 'FAIL'} ${row.id}__${variant.key}${variant.sound ? '' : ` :: ${variant.reasons.join(' / ')}`}`));
  writeFileSync(resolve(root, 'SUMMARY.md'), `# 명령 가족 판정기 자기검사\n\n가족 ${rows.length} · 변형 ${soundVariants}/${variantCount} sound\n\n${structural.length ? `구조 문제:\n${structural.map(problem => `- ${problem}`).join('\n')}\n\n` : ''}${lines.join('\n')}\n`);
  for (const line of lines) console.log(line);
  for (const problem of structural) console.log(`STRUCT ${problem}`);
  console.log(`selfcheck: ${soundVariants}/${variantCount} variants sound, ${rows.filter(row => row.sound).length}/${rows.length} families sound`);
  return structural.length === 0 && soundVariants === variantCount ? 0 : 1;
}
