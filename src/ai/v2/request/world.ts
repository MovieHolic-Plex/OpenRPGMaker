// 이 요청·프로젝트의 게임 세계 — 지시문(prompt/systemPrompt.ts)과 동사(verbs.ts)가 같은 답을 쓰게 한 곳에서 정한다.
// 청사진이 있으면 청사진이 정한 세계(없음 = 세계 없이 지은 게임, 중간에 새로 고르지 않는다). 청사진이 아직 없으면 게임 하나를 만드는 요청일 때만 고른다.
import type { Project } from "@/project/types";
import { withoutIntentNote } from "@/ai/piAgent/monsterGameRequest";
import { blueprintDesignerFromEnv } from "../blueprint";
import { oneProjectGame, wantsWholeGame } from "./readers";
import { pickWorld, worldOf, type WorldSetting } from "../world";
import { isComposedWorld } from "../world";

export function worldForRequest(project: Project, projectKey: string | undefined, task: string | undefined): WorldSetting | undefined {
  if (project.gameBlueprint) return worldOf(project);
  const text = String(task ?? "");
  // 청사진 설계자(OPRN_V2_BLUEPRINT_DESIGNER)가 쓰는 청사진에는 장소 목록·세계가 없다 — 세계 카드와 build_places 를 내놓으면 지을 것이 없는 반쪽이 된다.
  if (!wantsWholeGame(text) || oneProjectGame(project, text) || blueprintDesignerFromEnv()) return undefined;
  return pickWorld(project, projectKey, withoutIntentNote(text));
}

/** 구성기 세계(world.ts)의 게임이면 장소는 build_places 가 짓는다 — 모델이 칸을 설계하는 장소 카드(실내·마을·던전·거리)와 짓기 동사는 처음부터 싣지 않는다. */
export function composedWorldFor(project: Project, projectKey: string | undefined, task: string | undefined): boolean {
  return isComposedWorld(worldForRequest(project, projectKey, task));
}
