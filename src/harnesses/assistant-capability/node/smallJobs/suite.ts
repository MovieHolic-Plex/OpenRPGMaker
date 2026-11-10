// 작은 일 묶음(harness-data/assistant-capability/small-jobs.json) 읽기·구조 검사·정답 적용.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTool } from '../../../../editor/tools/toolRunner';
import type { Project } from '../../../../project/types';
import { CHECK_KINDS, type Allow, type CheckSpec } from './checks';
import { FIXTURE_IDS, type FixtureId } from './fixtures';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../..');
export const SUITE_FILE = resolve(REPO_ROOT, 'harness-data/assistant-capability/small-jobs.json');

export type ToolCall = { tool: string; args: Record<string, unknown> };
export type SmallJob = {
  id: string;
  family: string;
  fixture: FixtureId;
  /** 비개발자가 입력창에 치는 한국어 요청. */
  request: string;
  check: CheckSpec;
  /** 판정이 눈감아 주는 변경(요청 자체가 요구하는 이동·이름 변경·새 맵). */
  allow?: Allow;
  /** 손으로 적용하는 정답: 실제 편집기 도구 호출 순서. 자기검사가 runTool 로 돌린다. */
  reference: ToolCall[];
  /** 정답의 다른 모양(실모델이 실제로 낸 올바른 구현 등). 자기검사에서 모두 합격해야 한다. */
  accept?: Array<{ note: string; calls: ToolCall[] }>;
  /** 그럴듯한 오답들. 자기검사에서 모두 불합격해야 한다. */
  wrong: Array<{ note: string; calls: ToolCall[] }>;
  note?: string;
};
export type SmallJobSuite = { schemaVersion: 1; kind: 'assistant-small-jobs'; description: string; autoAnswer: string; fixtures: Record<string, string>; families: Record<string, string>; jobs: SmallJob[] };

export function loadSuite(file = SUITE_FILE): SmallJobSuite {
  const suite = JSON.parse(readFileSync(file, 'utf8')) as SmallJobSuite;
  const problems = suiteProblems(suite);
  if (problems.length) throw Error(`small-jobs.json 구조 문제:\n${problems.join('\n')}`);
  return suite;
}

export function suiteProblems(suite: SmallJobSuite): string[] {
  const problems: string[] = [], seen = new Set<string>();
  if (suite.kind !== 'assistant-small-jobs' || suite.schemaVersion !== 1) problems.push('kind/schemaVersion 이 다르다');
  if (!suite.autoAnswer?.trim()) problems.push('autoAnswer 가 비었다');
  for (const job of suite.jobs ?? []) {
    const at = `job ${job.id}`;
    if (!/^[a-z0-9-]+$/u.test(job.id ?? '')) problems.push(`${at}: id 는 소문자·숫자·하이픈`);
    if (seen.has(job.id)) problems.push(`${at}: 중복 id`);
    seen.add(job.id);
    if (!suite.families?.[job.family]) problems.push(`${at}: 없는 family ${job.family}`);
    if (!FIXTURE_IDS.includes(job.fixture)) problems.push(`${at}: 없는 fixture ${String(job.fixture)}`);
    if (!job.request?.trim() || !/[가-힣]/u.test(job.request)) problems.push(`${at}: request 는 한국어 문장`);
    if (!CHECK_KINDS.includes(job.check?.kind)) problems.push(`${at}: 없는 판정 종류 ${job.check?.kind}`);
    if (!job.reference?.length) problems.push(`${at}: reference(손 정답)가 없다`);
    if (!Array.isArray(job.wrong)) problems.push(`${at}: wrong 은 배열`);
  }
  return problems;
}

/** `--only a,b` — 없는 id 는 조용히 줄이지 않고 실패한다. */
export function selectJobs(suite: SmallJobSuite, only: string | undefined): SmallJob[] {
  const ids = (only ?? '').split(',').map(id => id.trim()).filter(Boolean);
  if (!ids.length) return suite.jobs;
  const unknown = ids.filter(id => !suite.jobs.some(job => job.id === id) && !suite.families[id]);
  if (unknown.length) throw Error(`--only: 없는 일·가족 ${unknown.join(', ')}`);
  return suite.jobs.filter(job => ids.includes(job.id) || ids.includes(job.family));
}

/** 도구 호출 순서를 실제 편집기 도구로 적용한 문서. 한 호출이라도 거절되면 던진다(정답은 도구가 받아야 한다). */
export function applyCalls(project: Project, calls: readonly ToolCall[]): Project {
  const context: any = { project: structuredClone(project), currentMapId: (project as any).startMapId, assistantRun: false };
  for (const call of calls) {
    const result: any = runTool(context, call.tool, structuredClone(call.args));
    if (!result.ok) throw Error(`${call.tool} 거절: ${String(result.summary).slice(0, 300)}`);
  }
  return context.project as Project;
}
