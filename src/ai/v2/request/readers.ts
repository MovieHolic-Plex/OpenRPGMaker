// 요청 의도를 읽는 함수들 — 예전 이름 그대로, 답은 모두 intent.ts 의 한 기록에서 나온다(여기서 낱말을 다시 맞추지 않는다).
// 새 코드는 classifyRequest(task, project) 의 기록을 바로 읽는 쪽이 낫다. 이 파일은 흩어진 호출 자리들이 같은 답을 받게 하는 얇은 층이다.
import type { PiAgentRequest } from "@/ai/piAgent/protocol";
import type { Project } from "@/project/types";
import { classifyRequest, readRequest } from "./intent";
import { fallenCard, storeCard } from "./toolGroups";

// ── 범위 ──
/** 이번 요청 글이 게임 하나를 만들거나 완성하라는 말인가(글만 본다 — 이어 하기 턴까지 보려면 buildsWholeGame). */
export const wantsWholeGame = (task: string): boolean => readRequest(task).scope === "wholeGame";
/** 이번 턴이 게임 하나를 짓는 일인가 — 게임 하나 요청이거나, 게임 하나로 시작한 프로젝트를 이어 하라는 요청. */
export const buildsWholeGame = (project: Project, task: string): boolean => classifyRequest(task, project).wholeGame;
/** 한 곳짜리 게임(방탈출·「방 하나」)인가 — 맵·퀘스트·진행 깊이 관문과 청사진 장소 검사가 같은 판정을 쓴다. */
export const oneProjectGame = (project: Project, task: string): boolean => classifyRequest(task, project).oneRoom;
export const wantsMakeGame = (task: string): boolean => readRequest(task).makeGame;
/** 무엇을 바꾸라는 요청인가(질문·조회·설명은 아니다). 이 요청에만 첫 호출 todo 를 강제한다. */
export const isWriteRequest = (request: Pick<PiAgentRequest, "task" | "readOnly">): boolean => !request.readOnly && readRequest(request.task).write;
/** 앞 실행이 남긴 할 일을 이어 받을 요청인가. `.test(task)` 꼴은 옛 호출 자리(정규식이던 때)를 위한 것이다. */
export const CONTINUE_WORDS = { test: (task: string): boolean => readRequest(task).continuation } as const;
/** 이미 지은 게임에 로직·대사·데이터만 넣는 요청인가 — 게임 하나·첫 장소(빈 프로젝트)·장소 짓기면 아니다. */
export const editOnlyRequest = (project: Project, task: string): boolean => classifyRequest(task, project).editOnly;
/** 이 요청에 가벼운 지시문(장소 카드·짓기 동사를 필요할 때만)을 쓰나. 끄기: OPRN_V2_LEAN_PROMPT=0 (A/B 측정용). */
export function leanPromptFor(project: Project, task: string | undefined): boolean {
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
  return env?.OPRN_V2_LEAN_PROMPT !== "0" && editOnlyRequest(project, task ?? "");
}

// ── 소리 ──
export const wantsMusic = (task: string): boolean => readRequest(task).audio.music;
export const wantsSound = (task: string): boolean => readRequest(task).audio.sound;
/** 곡을 «꼭 걸어야» 하는 요청인가(끝맺음 검사용). */
export const musicAsked = (task: string): boolean => readRequest(task).audio.musicAsked;
export const musicOnly = (task: string): boolean => readRequest(task).audio.musicOnly;
export const soundOnly = (task: string): boolean => readRequest(task).audio.soundOnly;
/** 소리(음악·효과음)만 바라는 요청 — 맵·이벤트 쓰기 도구를 싣지 않고, 검토자·관문의 소리 밖 지적은 참고로 낮춘다. */
export const audioOnly = (task: string): boolean => readRequest(task).audio.only;

// ── 전투·장르·바란 것 ──
/** 요청이 무작위 조우를 바랐나(조우를 이름 댔거나, 사냥·경험치처럼 조우가 있어야 되는 일) — 아니면 조수가 조우를 켜지 않는다. */
export const asksForEncounters = (task: string): boolean => readRequest(task).combat.encounters;
export const wantsBossEncounter = (task: string): boolean => readRequest(task).combat.boss;
export const wantsEndingScene = (task: string): boolean => readRequest(task).ending;
/** 퍼즐 사슬 동사를 실을 요청 — 단서·자물쇠·잠긴 방·탈출. */
export const wantsPuzzle = (task: string): boolean => readRequest(task).puzzle;

// ── 도구 묶음 ──
export const wantsGameTools = (task: string): boolean => readRequest(task).tools.game;
export const wantsMusicTools = (task: string): boolean => { const { audio } = readRequest(task); return audio.music || audio.sound; };
export const wantsSoundTools = (task: string): boolean => readRequest(task).audio.sound;
export const wantsTerrainTools = (task: string): boolean => readRequest(task).tools.terrain;
export const wantsStoreTools = (task: string): boolean => readRequest(task).tools.store;
/** 맵 동사(make_place·add_event…) 위에 덧붙일 도구 이름. */
export const v2ExtraToolNames = (task: string): string[] => [...readRequest(task).tools.extra];
export const fallenTierCard = (task: string): string => fallenCard(readRequest(task).tools);
export const storeTierCard = (task: string): string => storeCard(readRequest(task).tools);
