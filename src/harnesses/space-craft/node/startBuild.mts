// 시작 상태 짓기(fixture.ts 가 부른다): 빈 프로젝트에 결정론 도구를 차례로 돌려 「이미 있는 맵」을 만든다. 입출력은 같은 JSON 파일.
import { readFileSync, writeFileSync } from 'node:fs';
import { getTool } from '../../../editor/tools/toolRegistry';
import type { Project } from '../../../project/types';

const file = process.argv[2]!;
const input = JSON.parse(readFileSync(file, 'utf8')) as { project: Project; steps: { tool: string; args: Record<string, unknown> }[] };
for (const step of input.steps) {
  const tool = getTool(step.tool);
  if (!tool) throw Error(`시작 짓기 도구 없음: ${step.tool}`);
  const result = tool.run(input.project, step.args) as { summary?: string };
  console.log(`start-build ${step.tool}: ${String(result.summary ?? '').slice(0, 160)}`);
}
writeFileSync(file, JSON.stringify({ project: input.project }));
