// 조수 v2 독립 검토자(src/ai/v2/advisor.ts) 재생 — 기록된 턴(요청·도구 기록·보고 초안)과 그 턴의 전/후 프로젝트로 검토자를 다시 부른다.
//   bun scripts/qa/v2-advisor-replay.mts <cases.json> <out.jsonl>
// cases.json: [{ id, task, report, before: <project json path>, after: <project json path>, tools: [{name, ok, args, summary}] }]
// 모델 호출은 실행기의 보조 호출과 같은 모양(completeProvider, max_tokens 8192, 사고 강도 지정 없음)이다.
import { readFileSync, appendFileSync } from 'node:fs';
import { completeProvider } from '../lib/ohMyPiPiAiRuntime.ts';
import { resolveRequestApiKey } from '../lib/aiAuthRuntime.ts';
import { decodeCinematicWire } from '../../src/project/cinematicWire.ts';
import { adviseTurn, compactToolLog, summarizeProjectDiff } from '../../src/ai/v2/advisor.ts';
import type { Project } from '../../src/project/types.ts';

const [casesPath, outPath] = process.argv.slice(2);
if (!casesPath || !outPath) throw Error('v2-advisor-replay <cases.json> <out.jsonl>');
const provider = process.env.ADVISOR_PROVIDER ?? 'google-antigravity';
const model = process.env.ADVISOR_MODEL ?? 'gemini-4-argon';
const apiKey = await resolveRequestApiKey(provider) as string | undefined;
const sideChat = async (messages: readonly unknown[]) => {
  const { completion } = await completeProvider(provider, { model, max_tokens: 8192, messages }, { ...(apiKey ? { apiKey } : {}) }) as { completion: { choices: Array<{ message: { content?: string } }> } };
  return completion.choices[0]?.message.content ?? '';
};
const load = (p: string): Project => decodeCinematicWire(JSON.parse(readFileSync(p, 'utf8')) as Project);
const cases = JSON.parse(readFileSync(casesPath, 'utf8')) as Array<{ id: string; task: string; report: string; before: string; after: string; tools: Array<{ name: string; ok?: boolean; args?: unknown; summary?: string }> }>;
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : undefined;
for (const c of cases) {
  if (only && !only.has(c.id)) continue;
  const diff = summarizeProjectDiff(load(c.before), load(c.after));
  const toolLog = compactToolLog(c.tools);
  let verdict;
  for (let attempt = 0; attempt < 3; attempt++) {
    verdict = await adviseTurn({ task: c.task, toolLog, diff, report: c.report }, sideChat);
    if (!verdict.problem?.startsWith('검토자 호출 실패')) break;
    await new Promise(r => setTimeout(r, 5000 * (attempt + 1)));
  }
  appendFileSync(outPath, JSON.stringify({ id: c.id, ...verdict, diffChars: diff.length, toolLogChars: toolLog.length }) + '\n');
  console.log(c.id, verdict!.notes.map(n => n.level[0]).join('') || '-', `${(verdict!.ms / 1000).toFixed(1)}s`, verdict!.inputChars, verdict!.problem ?? '');
}
