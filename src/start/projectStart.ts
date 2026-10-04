import { NEW_PROJECT_CHOICES, type NewProjectChoiceId } from "@/editor/newProjectChoices";
import type { ProjectStarterId } from "@/project/contentPacks/starterIds";

/** Shared by the lightweight launcher and the editor. Missing mode preserves old AI handoffs. */
export type ProjectStartMode = "example" | "ai" | "blank";
export type ProjectStartScreenSize = "classic" | "wide";

export const START_EXAMPLE_DETAILS: Partial<Record<NewProjectChoiceId, { title: string; description: string; includes: readonly string[] }>> = {
  "monster-collect": { title: "풀숲의 친구들", description: "첫 파트너를 고르고 풀숲에서 몬스터를 만나요.", includes: ["작은 마을과 풀숲", "첫 파트너 선택", "조우 · 포획 · 구간 끝"] },
  "story-cutscene": { title: "다시, 그날의 기억", description: "기억의 조각을 조사하고 다음 장면으로 걸어가요.", includes: ["작은 마을과 기억의 길", "기억을 여는 대사", "조사 · 장면 이동 · 구간 끝"] },
  "adventure-jrpg": { title: "바람이 머무는 마을", description: "마을에서 의뢰를 받고 숲길의 첫 모험을 떠나요.", includes: ["작은 마을과 숲길", "촌장의 의뢰", "파티 · 전투 · 구간 끝"] },
};

export type ProjectStartExample = {
  readonly id: string;
  readonly choiceId: NewProjectChoiceId;
  readonly starterPresetId?: ProjectStarterId;
  readonly label: string;
  readonly thumb: string;
  readonly title: string;
  readonly description: string;
  readonly includes: readonly string[];
};

/** World presets share the adventure engine and appear only in the ready-made examples. */
export const START_EXAMPLES: readonly ProjectStartExample[] = [
  ...NEW_PROJECT_CHOICES.filter(choice => choice.featured).map(choice => ({
    id: choice.id, choiceId: choice.id, label: choice.label, thumb: choice.thumb,
    ...START_EXAMPLE_DETAILS[choice.id]!,
  })),
  {
    id: "joseon-folklore", choiceId: "adventure-jrpg", starterPresetId: "joseon-folklore",
    label: "조선 설화", title: "버들마을", thumb: "/assets/joseon-folklore/starter/village.png",
    description: "버들마을에서 직업을 고르고 귀신·도깨비가 있는 숲과 동굴로 떠나요.",
    includes: ["마을 · 사냥터 · 동굴 · 주막 · 서당 · 약방", "전사 · 도적 · 주술사 · 도사와 기술·장비", "의뢰 · 전직 · 상점 · RM2003 전투", "조선식 대화창 · 한글 도트 글꼴"],
  },
];

export function startExampleBySelection(choiceId: NewProjectChoiceId | null, starterPresetId?: ProjectStarterId): ProjectStartExample | undefined {
  return START_EXAMPLES.find(example => example.choiceId === choiceId && example.starterPresetId === starterPresetId);
}

export function projectStartMode(choiceId: NewProjectChoiceId | null, mode?: ProjectStartMode): ProjectStartMode {
  return choiceId === null ? "blank" : mode ?? "ai";
}
