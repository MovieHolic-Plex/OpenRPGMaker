// 곁 퀘스트를 끝낼 수 있는가 — 단계 의뢰(project.quests)마다 «완료 스위치를 켜는 명령» 까지 자동 플레이로 처음부터 걸어 본다(모델 없음).
// 왜(2026-11-14 r4d-fun «누르의 물동이»): 엔딩까지의 자동 플레이는 곁 퀘스트를 밟지 않는다 — 들를 곳 페이지가 다른 의뢰 페이지에 가려 영영 0/2 인 의뢰가 «엔딩 도달» 판에 그대로 실렸다.
// 끝맺음 관문은 이 결과를 읽지 않는다(오프라인 검사 — 명세 은행 measureGame · 탐침). 지금의 고침은 의뢰 컴파일러 쪽이다(project/quest/questHost.settleQuestStepPages).
import type { Project } from "@/project/types";
import { isStepQuestDef, questFlagIds } from "@/project/quest/questDef";
import { runSwitchPlay } from "./autoPlay";
import { allPages, visitPageCommands, type CommandVisit } from "./walk";

interface QuestPlay { readonly key: string; readonly title: string; readonly ok: boolean; readonly detail: string }

/** 의뢰 하나에 쓰는 시간(ms). */
const QUEST_BUDGET_MS = 15_000;

/** 단계 의뢰마다 완료까지 걸어 본 결과. 완료 스위치를 켜는 명령이 없는 의뢰도 «못 끝냄» 이다. */
export function questPlays(project: Project, budgetMs = QUEST_BUDGET_MS): QuestPlay[] {
  const quests = (project.quests ?? []).filter(isStepQuestDef);
  if (!quests.length) return [];
  const setters = new Map<string, CommandVisit>();
  for (const page of allPages(project)) {
    if (!page.map || !page.event) continue;
    visitPageCommands(page, (visit) => {
      if (visit.command.kind === "setSwitch" && visit.command.value === true && typeof visit.command.switchId === "string" && !setters.has(visit.command.switchId)) setters.set(visit.command.switchId, visit);
    });
  }
  return quests.map((quest) => {
    const done = questFlagIds(quest.key, quest.steps.length).done;
    const visit = setters.get(done);
    if (!visit) return { key: quest.key, title: quest.title, ok: false, detail: `완료 스위치 ${done} 을 켜는 명령이 없다` };
    try {
      const run = runSwitchPlay(project, `곁 퀘스트 ${quest.title}`, visit, done, budgetMs);
      return { key: quest.key, title: quest.title, ok: run.ok, detail: run.ok ? `단계 ${run.steps.length}개로 완료` : `「${run.failure?.goal ?? ""}」 ${run.failure?.detail.slice(0, 200) ?? ""}` };
    } catch (error) { return { key: quest.key, title: quest.title, ok: false, detail: `자동 플레이 중 예외: ${error instanceof Error ? error.message : String(error)}` }; }
  });
}
