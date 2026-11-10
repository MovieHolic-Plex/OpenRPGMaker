// 조수 v2 동사 묶기 — 문맥(tools/context.ts)을 만들고 동사 공장(tools/verbs/*)을 불러 이 요청에 실을 도구 목록을 낸다.
// 동사마다: 명세 → 결정론 빌더 → 1배 그림 + 기계 검사 → 독립 비평가.
import { flattenWrapperTool } from "./flatWrapper";
import type { PiToolShape, PiToolExecResult } from "@/ai/piAgent/toolAdapter";
import { buildsWholeGame } from "./request/readers";
import { blueprintProgressNote } from "./blueprint";
import type { PiAssistantV2Env } from "./env";
import { createGameTools } from "./game";
import { wantsGameTools, wantsMusicTools, wantsStoreTools } from "./request/readers";
import { wantsPuzzle } from "./request/readers";
import { wantsTerrainTools } from "./request/readers";
import { audioOnly } from "./request/readers";
import { helpersOn } from "./helpers";
import { isStoreCardRequest } from "@/editor/tools/storeTools";
import { makeGameOn } from "./makeGame";
import { wantsMakeGame } from "./request/readers";
import { createDungeonPartsVerb } from "./dungeonParts";
import { V2Session } from "./turn/session";
import { wantsEndingScene } from "./request/readers";
import { wantsBossEncounter } from "./request/readers";
import { text, recorded, PATH_LOW_LEVEL, BLUEPRINT_PROGRESS_VERBS } from "./tools/support";
import { makeVerbContext } from "./tools/context";
import { blueprintVerbs } from "./tools/verbs/blueprint";
import { installSessionHooks } from "./tools/sessionHooks";
import { placeVerbs } from "./tools/verbs/place";
import { peopleVerbs } from "./tools/verbs/people";
import { puzzleVerbs } from "./tools/verbs/puzzle";
import { artVerbs } from "./tools/verbs/art";
import { objectVerbs } from "./tools/verbs/objects";
import { makeGameVerbs } from "./tools/verbs/makeGame";
import { readVerbs } from "./tools/verbs/read";

export function createV2Tools(env: PiAssistantV2Env, session: V2Session): PiToolShape[] {
  const c = makeVerbContext(env, session);
  const { task, lean, requestWorld } = c;
  const { readSpecs, roomPartsVerb, inspect, restoreEvent, askUser, askHelpers } = readVerbs(c);
  const { writeBlueprint, buildBlueprintPathVerb } = blueprintVerbs(c);
  installSessionHooks(c);
  const { buildWorld, makePlace, editPlace, reviewLayout, findPiecesVerb } = placeVerbs(c);
  const { addPeople, addBossEncounter, addEndingScene, addEvent, addScene, personItem, eventItem } = peopleVerbs(c);
  const { authorPuzzleChain, setObjectiveVerb, sealLockedRoomVerb } = puzzleVerbs(c);
  const { generateArtVerb, drawObjectVerb } = artVerbs(c);
  const { placeObject, dressRoomVerb, moveObject } = objectVerbs(c);
  const { makeGame } = makeGameVerbs({ ...c, personItem, eventItem });

  // 기록 없이 끝난 실패(빌더 없음·맵 없음·상한)와 예외도 tool_end 에 ok:false·이유가 실리게 한다 — 안 그러면 편집기에 빈 「성공」 줄이 남는다.
  const guard = (tool: PiToolShape): PiToolShape => ({ ...tool, async execute(id, params, signal) {
    let result: PiToolExecResult;
    try { result = await tool.execute(id, params, signal); }
    catch (error) { result = text({ ok: false, summary: `${tool.name} 실패: ${error instanceof Error ? error.message : String(error)}` }); }
    // 짓는 단계마다 청사진과 대조한 진행을 덧붙인다(2026-10-28) — 모델이 어느 항목을 구현했고 무엇이 남았는지 매번 본다.
    if (BLUEPRINT_PROGRESS_VERBS.has(tool.name)) { const note = blueprintProgressNote(env.ctx.project); if (note) result = { ...result, content: [...result.content, { type: "text", text: note }] }; }
    if (!recorded.get(env)?.has(id)) {
      const first = result.content.find((c) => c.type === "text") as { text: string } | undefined;
      let parsed: { ok?: boolean; summary?: string; notFailure?: boolean } = {};
      try { parsed = first ? JSON.parse(first.text) as { ok?: boolean; summary?: string; notFailure?: boolean } : {}; } catch { /* 글 */ }
      // «아직 짓지 않았다(실패 아님)»(설계 받기·땅 미리보기·굴 입구 되돌림)는 정상 흐름이다 — tool_end 를 실패(FAIL)로 남기지 않는다.
      const notFailure = parsed.notFailure === true || /\(실패 아님\)/u.test(String(parsed.summary ?? "").slice(0, 300));
      env.record({ toolCallId: id, name: tool.name, args: params, result: { ok: parsed.ok !== false || notFailure, summary: String(parsed.summary ?? (parsed.ok === false ? "실패" : `${tool.label} 완료`)), ...(notFailure && parsed.ok === false ? { notFailure: true } : {}) } as never });
    }
    return result;
  } });
  const verbs = [writeBlueprint, ...(lean ? [readSpecs] : []), ...(requestWorld() ? [buildWorld] : []), buildBlueprintPathVerb, makePlace, ...(makeGameOn() && wantsMakeGame(String(task ?? "")) ? [makeGame] : []), editPlace, reviewLayout, findPiecesVerb, moveObject, dressRoomVerb, addPeople, addEvent, addScene, ...(wantsBossEncounter(String(task ?? "")) ? [addBossEncounter] : []), ...(wantsEndingScene(String(task ?? "")) ? [addEndingScene] : []), ...(wantsPuzzle(String(task ?? "")) ? [authorPuzzleChain] : []), sealLockedRoomVerb, setObjectiveVerb, drawObjectVerb, ...(buildsWholeGame(env.ctx.project, String(task ?? "")) ? [generateArtVerb] : []), placeObject, inspect, roomPartsVerb, createDungeonPartsVerb(env, () => session.places.values(), session.nonce), restoreEvent, ...(helpersOn() ? [askHelpers] : []), askUser]
    // 음악만 바라는 요청은 맵·이벤트를 쓰는 동사를 싣지 않는다 — 보기·묻기만(2026-10-30 r12: 추격 음악 요청에 상자를 찍었다).
    .filter((tool) => !audioOnly(String(task ?? "")) || MUSIC_ONLY_VERBS.has(tool.name))
    .map((tool) => guard(flattenWrapperTool(tool)));
  // 게임 요소(퀘스트·아이템·전투·파티) 요청이면 v1 게임 도구를 덧붙인다 — 기록은 도구 묶음이 env.record 로 직접 남긴다.
  const t = String(task ?? "");
  // 스토어 음악 카드(사용자가 듣고 고른다)를 띄웠으면 사용자 질문과 같다 — 끝맺음 관문이 «음악을 안 걸었다»며 넣기를 재촉하지 않게 한다.
  const gameEnv: PiAssistantV2Env = { ...env, record: (r) => {
    if (r.name === "store_find_music" && r.result.ok && isStoreCardRequest(r.result.data)) session.questions.push("스토어 음악 카드: 사용자가 듣고 고른다");
    if (r.name === "store_find_sound" && r.result.ok && isStoreCardRequest(r.result.data)) session.questions.push("스토어 효과음 카드: 사용자가 듣고 고른다");
    env.record(r);
  } };
  // 같은 Command·페이지 스키마의 설명은 처음 한 번만 보낸다(매 턴 다시 가는 도구 목록이 21만 자였다).
  // 청사진이 있는 게임에서 이벤트·엔딩 하위 도구가 되풀이해 실패하면 build_blueprint_path 로 보낸다(mt2 Flash: upsert_event 6번 인자 실패).
  const escalate = (tool: PiToolShape): PiToolShape => !PATH_LOW_LEVEL.has(tool.name) ? tool : { ...tool, escalateHint: () => env.ctx.project.gameBlueprint
    ? `[상위 동사로] ${tool.name} 로 청사진 경로(단계 이벤트·조건·엔딩 호출)를 하나씩 맞추지 않는다 — build_blueprint_path 를 한 번 부르면 청사진 단계대로 함수가 짓는다(대사만 steps[{id,lines}]). 이 도구는 경로 밖의 작은 수정에만 쓴다.`
    : undefined };
  // 설명 걷기·영어 사본·필요할 때 싣기는 노출 단계(toolExposure.ts exposeV2Tools)가 한다 — 처음부터 싣는 도구만 기준으로 걷어야
  // 나중에 싣는 도구를 가리키는 «같은 모양» 표시가 생기지 않는다. 게임 요청은 v2 도구 묶음 전부(v2ToolPool)를 같은 감싸개로 만들어 둔다.
  const pool = wantsGameTools(t) && !audioOnly(t);
  return wantsGameTools(t) || wantsMusicTools(t) || wantsTerrainTools(t) || wantsStoreTools(t) ? [...verbs, ...createGameTools(gameEnv, t, { pool }).map((tool) => escalate(flattenWrapperTool(tool, gameEnv.record)))] : verbs;
}

/** 음악만 바라는 요청에 남기는 v2 동사 — 맵 보기·사용자에게 묻기. 곡 걸기는 음악 묶음(set_game_audio)이 한다. */
const MUSIC_ONLY_VERBS: ReadonlySet<string> = new Set(["inspect", "ask_user"]);
