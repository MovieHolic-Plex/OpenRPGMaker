// 이 요청·프로젝트의 게임 세계 — 지시문(prompt.ts)과 동사(verbs.ts)가 같은 답을 쓰게 한 곳에서 정한다.
// 청사진이 있으면 청사진이 정한 세계(없음 = 세계 없이 지은 게임, 중간에 새로 고르지 않는다). 청사진이 아직 없으면 게임 하나를 만드는 요청일 때만 고른다.
import type { Project } from "@/project/types";
import { withoutIntentNote } from "@/ai/piAgent/monsterGameRequest";
import { oneProjectGame, wantsWholeGame } from "./shipChecks";
import { pickWorld, worldOf, type WorldSetting } from "./world";

export function worldForRequest(project: Project, projectKey: string | undefined, task: string | undefined): WorldSetting | undefined {
  if (project.gameBlueprint) return worldOf(project);
  const text = String(task ?? "");
  if (!wantsWholeGame(text) || oneProjectGame(project, text)) return undefined;
  return pickWorld(project, projectKey, withoutIntentNote(text));
}
