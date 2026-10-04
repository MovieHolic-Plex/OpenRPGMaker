import data from "./projectInterviewScenes.json";
import type { GameBriefSlot, GameDesignAnswers } from "@/project/gameDesignBrief";
import type { GameInterview, InterviewGenre } from "@/project/gameInterview";

export const INTERVIEW_SCENES = data.genres;
export const SCENE_SLOTS: Record<string, GameBriefSlot> = {
  premise: "experience", play: "activity", tone: "detail", structure: "progression", scope: "scope",
};
export function interviewSceneUrl(key: string): string {
  return `/assets/project-interview/${key.replace(":", "-")}.webp`;
}
export function sceneGenre(id: InterviewGenre) {
  return INTERVIEW_SCENES.find(g => g.id === id)!;
}
export function blendChoices(primary: InterviewGenre, secondary: InterviewGenre) {
  const key = [primary, secondary].sort().join("+") as keyof typeof data.blends;
  const [label, detail, image] = data.blends[key];
  return [
    { id: "woven", label, detail, image },
    { id: "side", label: "서로 다른 에피소드로", detail: "중심 이야기 사이에 다른 장르의 사건을 만나요.", image: sceneGenre(secondary).image },
    { id: "choice", label: "한 선택이 양쪽에 영향을", detail: "플레이의 결과가 관계와 다음 사건을 함께 바꿔요.", image: sceneGenre(primary).image },
  ];
}
export function cinematicInterviewSummary(interview: GameInterview, answers: GameDesignAnswers): string {
  const main = sceneGenre(interview.genre).label;
  const secondary = interview.secondary ? sceneGenre(interview.secondary).label : "";
  const answer = (slot: GameBriefSlot) => answers[slot] ? `${answers[slot]!.text}${answers[slot]!.source === "recommended" ? " (추천안)" : ""}` : "";
  return [
    `${main}${secondary ? `와 ${secondary}를 결합한` : " 중심의"} 게임을 만든다.`,
    interview.concept && `처음 떠올린 아이디어: ${interview.concept}`,
    `이야기의 출발점은 ${answer("experience")}`,
    `플레이어의 핵심 행동: ${answer("activity")}`,
    interview.blend && `두 장르를 잇는 방법: ${interview.blend.text}${interview.blend.source === "recommended" ? " (추천안)" : ""}`,
    `분위기: ${answer("detail")}`,
    `진행 흐름: ${answer("progression")}`,
    `먼저 완주 가능하게 만들 구간: ${answer("scope")}`,
    interview.protagonist ? `사용자가 정한 주인공: ${interview.protagonist}` : "주인공의 이름·성별·외형은 아직 정하지 않았다. 참고 그림으로 확정하지 않는다.",
    interview.notes && `추가 요청: ${interview.notes}`,
  ].filter(Boolean).join("\n\n");
}
