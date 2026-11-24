// 이 요청·프로젝트의 게임 세계 — 지시문(prompt/systemPrompt.ts)과 동사(verbs.ts)가 같은 답을 쓰게 한 곳에서 정한다.
// 청사진이 있으면 청사진이 정한 세계(없음 = 세계 없이 지은 게임, 중간에 새로 고르지 않는다). 청사진이 아직 없으면 게임 하나를 만드는 요청일 때만 고른다.
import type { Project } from "@/project/types";
import { withoutIntentNote } from "@/ai/piAgent/monsterGameRequest";
import { blueprintDesignerFromEnv } from "../shared/env";
import { buildsWholeGame, oneProjectGame } from "./readers";
import { WORLDS, pickWorld, worldOf, type WorldSetting } from "../place/world";
import { isComposedWorld } from "../place/world";
import { enforcingGenreLock, genreLockAllowsTileset } from "@/project/genreLock";
import { isLivedMap } from "@/editor/tools/livedMap";
import { hasThemeWord } from "@/ai/villageChipsetPool";
import { isGenrePresetBriefRequest } from "@/ai/genrePresetBrief";
import { pickVariation, type Variation } from "@/ai/variation/pick";
import { fitsAnyWorld, MONSTER_WORDS } from "./genre";
import { isFreshProject } from "./scope";

/**
 * 이 게임의 변주(장르 데크에서 씨앗으로 뽑은 장소·사건·분위기·구조) — 첫 게임 하나를 짓는 요청에만. 세계(칩셋)는 사용자 글이 정한 것이 이기고(«세계는 사용자 글로만», #4955),
 * 아무것도 정해지지 않았을 때 변주의 첫 장소가 세계에 묶여 있으면 그 세계를 고른다(세계 고르기가 모험 낱말에만 열려 있어 회상·추리·감동이 100/100 세계 없음이던 것).
 * v1(v1: true) 은 세계 카드가 없으니 사용자가 «말한» 세계만 장소 축을 거둔다(열쇠 풀로 고른 세계는 v1 지시문에 없다). preset: 장르 프리셋 첫 생성 요청도 게임 하나로 본다(팀장 지시문).
 */
export function gameVariation(project: Project, projectKey: string | undefined, task: string | undefined, options: { readonly v1?: boolean; readonly preset?: boolean } = {}): { readonly variation?: Variation; readonly world?: WorldSetting } {
  const text = String(task ?? "");
  if (project.gameBlueprint || !projectKey?.trim() || !isFreshProject(project)) return {};
  const preset = isGenrePresetBriefRequest(text);
  if (preset && !options.preset) return {};
  if (!(buildsWholeGame(project, text) || (options.preset && preset)) || oneProjectGame(project, text) || blueprintDesignerFromEnv()) return {};
  // 몬스터 수집·장르 잠금 게임은 정해진 길(몬스터 마을 빌더)이 있다 — 변주를 얹지 않는다.
  if (MONSTER_WORDS.test(withoutIntentNote(text)) || enforcingGenreLock(project)) return {};
  const words = worldRequestWords(text);
  const have = WORLDS.filter((w) => project.tilesets[w.tilesetId]);
  const lived = Object.values(project.maps).some((m) => isLivedMap(m));
  const settled = options.v1 ? have.find((w) => w.named(words)) : pickWorld(project, projectKey, words);
  const variation = pickVariation({
    text: words, key: projectKey, allowedWorlds: settled || lived ? [] : have.map((w) => w.id),
    worldFixed: !!settled, placeStated: (residual) => hasThemeWord(residual) || have.some((w) => w.named(words)), adventureOk: fitsAnyWorld(words),
  });
  const world = !settled && variation?.world ? have.find((w) => w.id === variation.world) : undefined;
  return { ...(variation ? { variation } : {}), ...(world ? { world } : {}) };
}

export function worldForRequest(project: Project, projectKey: string | undefined, task: string | undefined): WorldSetting | undefined {
  if (project.gameBlueprint) return worldOf(project);
  const text = String(task ?? "");
  // 청사진 설계자(OPRN_V2_BLUEPRINT_DESIGNER)가 쓰는 청사진에는 장소 목록·세계가 없다 — 세계 카드와 build_places 를 내놓으면 지을 것이 없는 반쪽이 된다.
  // 프로젝트를 같이 본 판정을 쓴다 — 지은 것이 있는 프로젝트의 «…게임으로 만들어 줘» 는 고치기라 세계를 고르지 않는다.
  if (!buildsWholeGame(project, text) || oneProjectGame(project, text) || blueprintDesignerFromEnv()) return undefined;
  const world = pickWorld(project, projectKey, worldRequestWords(text)) ?? gameVariation(project, projectKey, text).world;
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
  // 장르 줄은 이제 경계선 앞에 이름만 있다(예전 저장본은 «이름 — 계약» 꼴).
  const genre = /^선택한 시작 장르:[ \t]*(.+?)(?:[ \t]+—.*)?$/mu.exec(own);
  return [intent[1]!.trim(), genre?.[1]?.trim()].filter(Boolean).join("\n");
}

/** 구성기 세계(world.ts)의 게임이면 장소는 build_places 가 짓는다 — 모델이 칸을 설계하는 장소 카드(실내·마을·던전·거리)와 짓기 동사는 처음부터 싣지 않는다. */
export function composedWorldFor(project: Project, projectKey: string | undefined, task: string | undefined): boolean {
  return isComposedWorld(worldForRequest(project, projectKey, task));
}
