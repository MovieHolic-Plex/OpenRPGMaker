import { expect, it } from "vitest";
import { PI_TEAM_ROLES } from "@/ai/piAgent/team";
import { createBlankProject } from "@/project/defaults";

it("실제 팀장 프롬프트는 7가지 요청의 분업·협의·검수와 실행 가능한 배정 경로를 제공한다", () => {
  const prompt = PI_TEAM_ROLES.orchestrator.systemPrompt(createBlankProject(), [], "콘텐츠 제작").join("\n");
  for (const example of ["던전 만들어줘", "퀘스트 하나 만들어줘", "게임 도입부 만들어줘", "전투 시스템에 맞춰 콘텐츠 채워줘", "이 마을을 더 살아 있게 해줘", "기존 게임 문제 찾아서 고쳐줘", "게임 전체 번역해줘"]) {
    expect(prompt).toContain(`요청 예시: ${example}`);
  }
  expect(prompt.match(/A2A 협의:/g)).toHaveLength(7);
  expect(prompt.match(/통합 검수:/g)).toHaveLength(7);
  expect(prompt).toContain("assign_task_agent(mode=read)");
  expect(prompt).toContain("assign_task_agent(mode=project)");
  expect(prompt).toContain("설계가 완료되어도 제작 완료라고 보고하지 않는다");
  expect(prompt).toContain("제어문자·치환 변수·ID 보존");
  expect(prompt).toContain("같은 맵에는 한 번에 한 명만");
});
