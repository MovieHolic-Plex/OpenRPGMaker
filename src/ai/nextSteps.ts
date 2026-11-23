// 첫 판(MVP) 뒤 «다음에 해 볼 것» 2~3개 — 조수 최종 보고 끝에 붙이고, 조수 패널이 같은 글을 찾아 누르면 보내지는 칩으로 그린다.
// 왜(2026-11-23 오너): 처음에는 맵 3~5개 MVP 만 보여 주고, 그다음은 사용자가 «다음 지역 만들어 줘» 처럼 이어서 키운다.
// 글의 모양(머리줄 + «- » 줄)이 조수 쪽과 화면 쪽의 유일한 약속이다 — 둘 다 이 파일을 쓴다.
import type { Project } from "@/project/types";

export const NEXT_STEPS_HEADING = "다음에 해 볼 것:";
/** 첫 판 끝 안내 — MVP 는 엔딩 없이 마지막 지점에서 멈추고 사용자에게 여기까지 만들었다고 알린다(2026-11-23 오너). */
export const MVP_DONE_LINE = "첫 판(MVP)까지 만들었습니다. 엔딩 없이 마지막 지점에서 멈춥니다. 이어서 키우고 싶은 것을 골라 주세요.";
const MAX_STEPS = 3;

/** 이 게임에 맞는 다음 요청 문장 셋(사용자가 그대로 입력할 말). */
export function mvpNextSteps(project: Project): string[] {
  const monster = !!project.system.monsterCampaign;
  const battles = project.gameBlueprint?.battles !== false;
  return [
    "다음 지역 만들어 줘",
    monster ? "1번길에 트레이너를 두 명 더 세워 줘" : battles ? "새 지역에 보스 전투를 하나 넣어 줘" : "새 인물과 대화 장면을 하나 더해 줘",
    "마을에 말 걸 사람과 곁 퀘스트를 하나 더해 줘",
  ];
}

export function nextStepsBlock(steps: readonly string[]): string {
  return [NEXT_STEPS_HEADING, ...steps.slice(0, MAX_STEPS).map((step) => `- ${step}`)].join("\n");
}

/** 답 글 끝의 «다음에 해 볼 것» 덩어리를 떼어 낸다. 없으면 steps 가 빈 배열이다. */
export function splitNextSteps(text: string): { body: string; steps: string[] } {
  const lines = text.replace(/\s+$/u, "").split("\n");
  const at = lines.lastIndexOf(NEXT_STEPS_HEADING);
  if (at < 0) return { body: text, steps: [] };
  const tail = lines.slice(at + 1);
  if (!tail.length || !tail.every((line) => /^- \S/u.test(line))) return { body: text, steps: [] };
  return { body: lines.slice(0, at).join("\n").replace(/\s+$/u, ""), steps: tail.map((line) => line.slice(2).trim()).slice(0, MAX_STEPS) };
}
