import { el } from "@/util/dom";

export function renderTerrainTemplateAgentNotice(): HTMLElement {
  return el("aside", {
    class: "terrain-template-agent-notice",
    dataset: { testid: "terrain-template-agent-notice" },
    children: [
      el("strong", { text: "AI 에이전트용 참고 자료" }),
      el("span", { text: "이 표와 규칙은 AI가 타일 구조를 해석하고 집/길/울타리 배치를 생성할 때 쓰는 컨텍스트입니다." }),
    ],
  });
}
