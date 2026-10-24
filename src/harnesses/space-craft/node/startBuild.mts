// 시작 상태 짓기(fixture.ts 가 부른다): 빈 프로젝트에 결정론 도구를 차례로 돌려 「이미 있는 맵」을 만든다. 입출력은 같은 JSON 파일.
import { readFileSync, writeFileSync } from 'node:fs';
import { getTool } from '../../../editor/tools/toolRegistry';
import type { Project } from '../../../project/types';
import { normalizeGameDesignBrief } from '../../../project/gameDesignBrief';
import { eligibleAuthoringHarnessFor } from '../../_core/authoringRegistry';

const file = process.argv[2]!;
const input = JSON.parse(readFileSync(file, 'utf8')) as { project: Project; steps: { tool: string; args: Record<string, unknown> }[]; brief?: unknown };
for (const step of input.steps) {
  const tool = getTool(step.tool);
  if (!tool) throw Error(`시작 짓기 도구 없음: ${step.tool}`);
  const result = tool.run(input.project, step.args) as { summary?: string };
  console.log(`start-build ${step.tool}: ${String(result.summary ?? '').slice(0, 160)}`);
}
// 확정 기획 → 새 게임 시작과 같은 하네스 씨앗(연애: 계약 + 임시 초안 상대). 시작 짓기 뒤에 심어 무대(시작 맵)가 지어진 맵이 된다.
if (input.brief) {
  input.project.gameDesignBrief = normalizeGameDesignBrief(input.brief);
  const harness = eligibleAuthoringHarnessFor(input.project);
  const seeded = harness?.seed(input.project);
  if (harness && !seeded) throw Error(`시작 기획 씨앗 실패: ${harness.id}`);
  if (seeded) input.project = seeded;
  console.log(`start-brief: ${input.project.gameDesignBrief?.presetId}${harness ? ` · 하네스 ${harness.id} 씨앗` : ' · 하네스 없음'}`);
}
writeFileSync(file, JSON.stringify({ project: input.project }));
