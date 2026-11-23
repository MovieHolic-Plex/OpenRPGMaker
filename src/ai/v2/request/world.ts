// 이 요청·프로젝트의 게임 세계 — 지시문(prompt/systemPrompt.ts)과 동사(verbs.ts)가 같은 답을 쓰게 한 곳에서 정한다.
// 청사진이 있으면 청사진이 정한 세계(없음 = 세계 없이 지은 게임, 중간에 새로 고르지 않는다). 청사진이 아직 없으면 게임 하나를 만드는 요청일 때만 고른다.
import type { Project } from "@/project/types";
import { withoutIntentNote } from "@/ai/piAgent/monsterGameRequest";
import { blueprintDesignerFromEnv } from "../shared/env";
import { buildsWholeGame, oneProjectGame } from "./readers";
import { pickWorld, worldOf, type WorldSetting } from "../place/world";
import { isComposedWorld } from "../place/world";
import { enforcingGenreLock, genreLockAllowsTileset } from "@/project/genreLock";

export function worldForRequest(project: Project, projectKey: string | undefined, task: string | undefined): WorldSetting | undefined {
  if (project.gameBlueprint) return worldOf(project);
  const text = String(task ?? "");
  // 청사진 설계자(OPRN_V2_BLUEPRINT_DESIGNER)가 쓰는 청사진에는 장소 목록·세계가 없다 — 세계 카드와 build_places 를 내놓으면 지을 것이 없는 반쪽이 된다.
  // 프로젝트를 같이 본 판정을 쓴다 — 지은 것이 있는 프로젝트의 «…게임으로 만들어 줘» 는 고치기라 세계를 고르지 않는다.
  if (!buildsWholeGame(project, text) || oneProjectGame(project, text) || blueprintDesignerFromEnv()) return undefined;
  const world = pickWorld(project, projectKey, worldRequestWords(text));
  // 장르 잠금(몬스터 수집 등)이 막는 칩셋의 세계는 고르지 않는다 — 2026-11-23 mvp-first-start 실측: 몬스터 수집 씨앗에 «모험» 낱말로
  // 우주 정거장 세계를 골라 make_place 가 매번 거절됐고 맵 1장으로 끝났다(전·후 모두). 세계가 없으면 장르 길(몬스터 마을 빌더)이 맡는다.
  if (world && enforcingGenreLock(project) && !genreLockAllowsTileset(project, world.tilesetId)) return undefined;
  return world;
}

/**
 * 세계를 고르는 데 읽는 글 — 사용자가 쓴 말과 고른 시작 장르 이름만. 첫 화면 지시문(welcomeGenrePresets.buildWelcomeFreeTextPrompt ·
 * startScreenPrompt)은 «사용자 의도: …» 뒤에 전투 화면·대화창 안내를 붙이는데, 그 안내의 «veil=SF·미니멀»·«몬스터 대치» 같은 낱말이
 * 요청 글로 읽혀 «용사가 숲 너머 동굴의 마물을…» 판타지 모험이 우주 정거장 세계(네온 거리·달 기지)로 지어졌다(2026-11-23 mvp-map-quality 실측,
 * 후 측정 JRPG·회상 스토리 둘 다 sf_station). 첫 화면 지시문이 아니면 의도 메모만 뗀 글 그대로.
 */
export function worldRequestWords(task: string): string {
  const own = withoutIntentNote(task);
  const intent = /^사용자 의도:[ \t]*([\s\S]*?)(?:\n\s*\n|$)/mu.exec(own);
  if (!intent) return own;
  const genre = /^선택한 시작 장르:[ \t]*(.+?)[ \t]+—/mu.exec(own);
  return [intent[1]!.trim(), genre?.[1]?.trim()].filter(Boolean).join("\n");
}

/** 구성기 세계(world.ts)의 게임이면 장소는 build_places 가 짓는다 — 모델이 칸을 설계하는 장소 카드(실내·마을·던전·거리)와 짓기 동사는 처음부터 싣지 않는다. */
export function composedWorldFor(project: Project, projectKey: string | undefined, task: string | undefined): boolean {
  return isComposedWorld(worldForRequest(project, projectKey, task));
}
