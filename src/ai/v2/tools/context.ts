// v2 동사들이 함께 쓰는 문맥 — 한 실행의 요청 글·빌드 실행기·지식 카드 관문·청사진 관문·짓기 결과 마무리(finishPlace·finishContent)·장소 잇기.
// createV2Tools 가 한 번 만들고 동사 공장들(tools/verbs/*)에 넘긴다. 2026-11-11 리팩토링 R2c: 1,662줄 함수의 지역 상태였다.
import type { PiAssistantV2Env } from "../env";
import type { V2Session } from "../turn/session";
import { withoutIntentNote } from "@/ai/piAgent/monsterGameRequest";
import type { PiToolExecResult } from "@/ai/piAgent/toolAdapter";
import { wantsWholeGame } from "../shipChecks";
import { applyBlueprintAssembly } from "@/project/blueprintAssembly";
import { blueprintDesignerFromEnv, designBlueprint, walkBlueprint } from "../blueprint";
import { leanPromptFor, placeSpecCards, projectBrief, type PlaceSpecKind } from "../prompt";
import { createBuildRun } from "../buildRun";
import { localizeVillagePoolSpec } from "../../villageChipsetPool";
import { type WorldSetting } from "../world";
import { worldForRequest } from "../worldRequest";
import { isFreshProject } from "../genreDefaults";
import { fixPlayerStart, type MachineCheck } from "../checks";
import type { CriticVerdict } from "@/ai/piAgent/featureReview";
import type { ContentBuildResult, PlaceBuildResult, PlaceRecord, PlaceSpec } from "../types";
import { mapBundleIds } from "@/ai/piAgent/mapBundle";
import { buildBlueprintPath, type PathStepText } from "../blueprintPath";
import { spreadCrowdedPeople } from "../eventReach";
import { dungeonGateSpot, pickTransferSpot } from "../transferSpot";
import { critiqueStaging } from "../critic";
import { edgeCell, isInside, isOutdoor, oppositeSide, pickDoor, villageDoors } from "../makeGame";
import { pickStageFrames, stageFrameProject, type EventBuildResult } from "../events";
import { LAYOUT_CRITIQUE_ROUNDS, layoutSession, type LayoutPlaceState } from "../builders/placeLayout";
import { requestedDungeonSide, settleDungeonGates } from "../dungeonGates";
import { type Seen } from "../turn/session";
import { zoneStatusLines } from "../loop/roomZones";
import { stageOpensBattle } from "../story/stageBattle";
import { V2_MAX_REPAIR_ROUNDS } from "../turn/session";
import { hasRoomKit } from "../judge/placeFix";
import { LINK_SIDES, repairCap, text, see, seenPayload, withImages, recordWrite, nextStep } from "./support";

/** createV2Tools 에서 뗀 것 — task · run · poolVillage · requestWorld · freshStart · lean · epoch · specShown …. (makeVerbContext) */
export function makeVerbContext(env: PiAssistantV2Env, session: V2Session) {
  const task = env.request.task;
  const run = createBuildRun(env.ctx);
  const poolVillage = <T extends PlaceSpec>(spec: T): T => localizeVillagePoolSpec(spec, run.ctx.project, String(env.request.projectKey ?? env.ctx.project.meta.title ?? ""), String(task ?? ""));
  // 이 게임의 세계(world.ts) — 청사진이 있으면 청사진이 정한 것, 없으면 요청·프로젝트 열쇠로 고른 것. 지시문(prompt.ts)의 세계 카드와 같은 답이다.
  const requestWorld = (): WorldSetting | undefined => worldForRequest(env.ctx.project, env.request.projectKey ? String(env.request.projectKey) : undefined, String(task ?? ""));
  // 이 차례를 시작할 때 빈 프로젝트였나 — 첫 장소를 짓는 요청은 「게임」 낱말이 없어도 게임 시작으로 보고 장르 기본값을 깐다(G51).
  const freshStart = isFreshProject(env.ctx.project);
  // 가벼운 지시문(prompt.ts leanPromptFor — 지은 맵에 로직만 넣는 요청): 장소 카드는 read_specs 나 그 종류의 첫 짓기 호출이 기록으로 준다.
  // 이 대화에서 이미 줬으면 다시 주지 않는다. 판정은 이 차례를 시작할 때의 프로젝트로 한다(지시문과 같게).
  const lean = leanPromptFor(env.ctx.project, String(task ?? ""));
  const epoch = () => env.contextEpoch?.() ?? 0;
  // 실행기(대화 번호를 주는 env)에서만 막는다 — 모델 없는 시험·덤프 도구는 예전처럼 바로 짓는다.
  const specShown = (kind: PlaceSpecKind) => !lean || !env.contextEpoch || session.specsShown.get(kind) === epoch();
  const showSpecs = (kinds: readonly PlaceSpecKind[]): string => {
    for (const kind of kinds) session.specsShown.set(kind, epoch());
    return kinds.flatMap((kind) => placeSpecCards(kind, env.ctx.project, env.ctx.currentMapId, String(task ?? ""))).join("\n\n");
  };
  /** 판정 JSON 한 덩이 + 카드 원문(JSON 따옴표 없이 — 지시문에 있던 모양 그대로). */
  const withSpecText = (head: Record<string, unknown>, cards: string): PiToolExecResult => ({ content: [{ type: "text", text: JSON.stringify(head) }, { type: "text", text: cards }] } as PiToolExecResult);
  /** 이 종류의 카드를 아직 안 줬으면 짓지 않고 카드를 돌려준다(실패 아님) — 모델이 카드대로 다시 부른다. */
  const specGate = (verb: string, kind: PlaceSpecKind | undefined) => {
    if (!kind || specShown(kind)) return undefined;
    return withSpecText({ ok: false, notFailure: true, summary: `Not done yet (not a failure): this is your first ${verb} for «${kind}» in this conversation, so its spec follows. Read it, then call ${verb} again following it. Next time read specs up front with read_specs.` }, showSpecs([kind]));
  };
  const problemCount = (seen: Seen | undefined, mapIds: readonly string[]) => !seen ? Infinity
    : seen.checks.filter((c) => !c.ok && mapIds.includes(c.mapId)).length + seen.critics.filter((v) => mapIds.includes(v.mapId)).reduce((n, v) => n + v.majors.length, 0);
  const outsideBuilt = (mapId: string): boolean => { const r = session.places.get(mapId); return !!r && isOutdoor(r.spec); };
  /** 칸 배치로 지은 장소를 자기 비평·할 일 확인 목록에 올린다(placeLayout.ts). */
  const noteLayoutPlace = (spec: PlaceSpec, result: PlaceBuildResult): void => {
    const st = result.state as { bbox?: "dungeon" | "village"; graph?: LayoutPlaceState["graph"] } | undefined;
    const mapId = result.mapIds[0];
    if (!result.ok || !st?.bbox || !mapId || !env.ctx.project.maps[mapId]) return;
    const ls = layoutSession(session); const prev = ls.byMap.get(mapId);
    ls.byMap.set(mapId, { kind: st.bbox, name: spec.name, critiqueRounds: prev?.critiqueRounds ?? 0, rejects: ls.rejects.get(spec.name) ?? 0, ...(st.graph ? { graph: st.graph } : {}) });
    env.emit({ type: "execution_status", name: "v2.bbox", ok: true, summary: `${spec.name}: ${st.bbox} laid from the model layout (critique ${prev?.critiqueRounds ?? 0}/${LAYOUT_CRITIQUE_ROUNDS}, rejects ${ls.rejects.get(spec.name) ?? 0})`, data: { mapId, kind: st.bbox, graph: st.graph ?? null, critiqueRounds: prev?.critiqueRounds ?? 0, rejects: ls.rejects.get(spec.name) ?? 0 } });
  };
  const finishPlace = async (toolCallId: string, verb: string, args: unknown, spec: PlaceSpec, builderId: string, built: PlaceBuildResult, rounds: number,
    before?: { project: typeof env.ctx.project; record: PlaceRecord; seen: Map<string, Seen> }): Promise<PiToolExecResult> => {
    let result = built;
    recordWrite(env, run, toolCallId, verb, args, result.ok, result.summary, { mapIds: result.mapIds });
    for (const m of result.missingArt) session.missingArt.add(m);
    if (!result.ok) return text({ ok: false, summary: result.summary, warnings: result.warnings, missingArt: result.missingArt, next: "명세를 바꿔 다시 하거나(다른 type·style), 할 수 없으면 사용자에게 그대로 알린다." });
    // 맵 범위가 있는 실행은 체크포인트가 범위 맵의 «트리 묶음»만 싣는다 — 트리 맨 위에 따로 생긴 새 맵(마을 옆 들판)은
    // 다음 체크포인트에서 통째로 사라졌다(2026-10-24 g3-random-field: make_place 성공 → 맵 목록에 없음 → 잇기·조우 모두 실패).
    // 새 맵을 범위 맵 아래로 옮겨 묶음에 넣는다.
    {
      const roots = [...(env.toolsetOptions?.scopeMapIds ?? (env.request as { mapIds?: readonly string[] }).mapIds ?? [])].filter((id) => env.ctx.project.maps[id]);
      const parent = roots[0];
      if (parent) {
        const inBundle = new Set(roots.flatMap((r) => mapBundleIds(env.ctx.project, r)));
        for (const mapId of result.mapIds) {
          if (inBundle.has(mapId) || !env.ctx.project.maps[mapId]) continue;
          const moved = run.call("manage_map_tree", { operation: "move", mapId, parentId: parent });
          if (!moved.ok) result = { ...result, warnings: [...result.warnings, `새 맵 ${mapId} 를 ${parent} 아래로 옮기지 못했다 — 저장에서 빠질 수 있다: ${String(moved.summary).slice(0, 120)}`] };
        }
      }
    }
    // 실내·집도 시작 칸을 본다(2026-10-28 interior 장부 5): 방을 줄여 다시 짓거나 dress_room·stamp 뒤에 시작 칸이 가구·벽면 밑에 남을 수 있다.
    // 시작 맵이 이번에 지은 맵이고 시작 칸이 큰 땅(걸어 닿는 가장 큰 덩이) 밖일 때만 옮긴다 — 문 안쪽 시작 칸은 그대로다.
    {
      const fixed = fixPlayerStart(env.ctx.project, result.mapIds);
      if (fixed.note) { env.ctx.project = fixed.project; result = { ...result, warnings: [...result.warnings, fixed.note], ...(result.entrance && result.entrance.mapId === fixed.project.startMapId ? { entrance: { mapId: fixed.project.startMapId, x: fixed.project.startPos.x, y: fixed.project.startPos.y } } : {}) }; }
    }
    // 바깥 마을·거리 → 던전 문은 하나, 던전이 놓인 세계 방향 가장자리의 길 칸에(dungeonGates.ts — 짓기 기본 출구·다시 짓기 재연결이 문을 둘 남겼다).
    if (builderId === "dungeon") {
      const gates = settleDungeonGates(run, result.mapIds, outsideBuilt, requestedDungeonSide(String(task ?? "")));
      if (gates.length) result = { ...result, warnings: [...result.warnings, ...gates] };
    }
    // 다시 짓기(edit_place) 뒤 바닥이 바뀌어 앞서 둔 사람이 문 곁·가구 접근 칸·큰 양탄자 위에 남을 수 있다 — 방 하나만 짓는 판은 끝맺음(clearLanes)이
    // 돌지 않으므로 여기서도 spreadCrowdedPeople 을 부른다.
    for (const mapId of result.mapIds) {
      const settled = spreadCrowdedPeople(run, mapId);
      if (settled.length) result = { ...result, warnings: [...result.warnings, `사람 자리: ${settled.join(" · ")}`] };
    }
    const record: PlaceRecord = { builder: builderId, spec, result, rounds };
    for (const mapId of result.mapIds) session.places.set(mapId, record);
    // 다시 짓기로 사라진 층(새 id 로 바뀐 위층)은 기록·검사에서 뺀다 — 남겨 두면 없는 맵의 옛 major 를 「남은 문제」로 들고 다닌다.
    for (const mapId of [...session.places.keys()]) if (!env.ctx.project.maps[mapId]) { session.places.delete(mapId); session.seen.delete(mapId); }
    // 첫 짓기를 비평 전에 편집기에 싣는다 — 사용자는 비평을 기다리지 않고 지어지는 것을 본다.
    await env.checkpoint(verb);
    const seen0 = await see(env, session, task, spec.type, result.mapIds, result.entrance, true);
    // 요청한 주인공 물건이 못 놓였거나 밀려났으면 기계 실패로 센다 — 되돌리기·끝맺음 관문이 이것을 본다(「큰 망원경」이 빠진 채 끝났다).
    const anchorFails: MachineCheck[] = result.missingArt.filter((m) => /놓을 빈 자리가 없다|최종 맵에 없다/u.test(m)).map((m) => ({ id: "anchor-missing", mapId: result.mapIds[0]!, ok: false, detail: m }));
    const seen: Seen = anchorFails.length ? { ...seen0, checks: [...seen0.checks, ...anchorFails] } : seen0;
    for (const mapId of result.mapIds) session.seen.set(mapId, seen);
    // 고친 결과가 앞보다 나쁘면(기계 실패 + 비평 major 가 늘면) 앞 상태로 되돌린다 — 천문대 고치기가 방을 하나 더 붙여 맨바닥 52% 가 됐다(2026-10-23 v2 실조수).
    if (before) {
      const oldIds = before.record.result.mapIds;
      const was = problemCount(before.seen.get(oldIds[0]!), oldIds), now = problemCount(seen, result.mapIds);
      if (now > was) {
        env.ctx.project = before.project;
        for (const mapId of result.mapIds) { session.places.delete(mapId); session.seen.delete(mapId); }
        // 첫 되돌림은 한 번 더 기회를 준다 — 큰 패치가 바닥 무늬를 더 어지럽혀 되돌렸고, 비평 메모(바닥 무늬·복도 나무 타일·벽 밖 러그)는
        // 그대로 남아 보고만 됐다(2026-10-25 G28 장난감 가게). 다음 시도는 비평 하나씩, 좌표가 있는 것만 작게.
        const reverts = (before.record.reverts ?? 0) + 1;
        const keptRounds = reverts === 1 ? before.record.rounds : rounds;
        const kept: PlaceRecord = { ...before.record, rounds: keptRounds, reverts };
        for (const mapId of oldIds) { session.places.set(mapId, kept); const old = before.seen.get(mapId); if (old) session.seen.set(mapId, old); }
        env.record({ toolCallId, name: verb, args, result: { ok: false, summary: `고친 결과가 더 나빠(문제 ${was}→${now}) 되돌렸다` } });
        await env.checkpoint(`${verb}-revert`);
        return withImages({ ok: false, reverted: true, summary: `고친 결과의 문제(${now})가 앞(${was})보다 많아 앞 상태로 되돌렸다 — 이 패치는 버렸다.`, triedResult: { ...seenPayload(seen), summary: result.summary.slice(0, 300) }, round: rounds,
          next: keptRounds >= repairCap(before.record.spec) ? "고치기 상한 — 남은 문제를 보고한다." : "더 작은 패치로 한 번 더 고친다 — 비평 major 중 좌표가 있는 것 하나·둘만 그 칸 범위로 고치고(바닥 전체·방 구조는 건드리지 않는다), 나머지는 보고한다." }, before.seen.get(oldIds[0]!));
      }
    }
    // 설계 실내면 할 일 확인 room_zones 와 같은 판정을 결과에 싣는다(구역 수·초점·갈 이유·반복 — loop/roomZones.ts).
    const zones = zoneStatusLines(env.ctx.project, result.mapIds, String(task ?? ""));
    return withImages({ ok: true, mapIds: result.mapIds, summary: result.summary, warnings: result.warnings, missingArt: result.missingArt, ...seenPayload(seen), ...(zones.length ? { zones } : {}), round: rounds, next: nextStep(seen, rounds, spec.dungeonDesign ? "dungeon" : (spec.zones ?? []).some((z) => !!z.design), repairCap(spec), result.mapIds.some((id) => hasRoomKit(env.ctx.project, id))) }, seen);
  };
  const finishContent = async (toolCallId: string, verb: string, args: unknown, result: ContentBuildResult): Promise<PiToolExecResult> => {
    recordWrite(env, run, toolCallId, verb, args, result.ok, result.summary, result.card !== undefined ? result.card : { eventIds: result.eventIds });
    session.content.push({ verb, result });
    for (const m of result.missingArt) session.missingArt.add(m);
    if (result.ok) await env.checkpoint(verb);
    const mapIds = result.mapIds.length ? result.mapIds : [];
    const stage = (result as EventBuildResult).stage;
    // 컷신: 끝 그림 한 장이 아니라 장면을 따라 그린 틀 여러 장 + 무대 검사(걸음 길이·도착·대사 거리) + 연출 비평가.
    if (result.ok && stage) {
      const map = env.ctx.project.maps[stage.mapId];
      const frames: { label: string; image: string; crop: { x: number; y: number; w: number; h: number } }[] = [];
      if (map && env.render) {
        for (const frame of pickStageFrames(stage, 5)) {
          const { project: framed, crop } = stageFrameProject(env.ctx.project, stage, frame);
          const saved = env.ctx.project;
          try {
            env.ctx.project = framed; // render 는 그 순간의 ctx.project 를 그린다
            frames.push({ label: frame.label, image: await env.render(stage.mapId, crop.x, crop.y, crop.w, crop.h), crop });
          } catch { /* 그림 경로 없음 */ } finally { env.ctx.project = saved; }
        }
      }
      const critics: CriticVerdict[] = [];
      if (map && frames.length) {
        env.emit({ type: "execution_status", name: "v2.critic", ok: true, summary: `다른 눈(연출 비평가)이 컷신 장면 ${frames.length}장을 보는 중` });
        const notes = [
          ...(stage.letterbox ? ["the scene starts by sliding in cinematic letterbox bars and removes them at the end"] : []),
          ...stage.walks.map((w) => `${w.who} walks ${w.steps} cells from (${w.from.x},${w.from.y}) to (${w.goal.x},${w.goal.y})${w.onRoad ? `, ${w.onRoad} of them on road tiles` : ""}`),
          "after walking up, the two characters turn to face each other; each spoken line is shown in a dialogue box with the speaker's portrait",
          ...(stage.effects?.length ? ["these frames are plain map renders: screen tint, sprite silhouettes and camera moves are NOT drawn in them but do happen in the game", ...stage.effects] : []),
          ...(stageOpensBattle(env.ctx.project, stage.mapId, result.eventIds?.map((e) => e.eventId)) ? ["after the dialogue the scene starts a battle (the battle screen is a separate scene and is NOT drawn in these frames — do not report the fight as missing)"] : []),
        ];
        try {
          const ran = await critiqueStaging({ task, map: { id: map.id, name: map.name }, frames, notes, sideChat: env.sideChat, ...(env.signal ? { signal: env.signal } : {}) });
          session.criticCalls++; session.criticMs += ran.ms;
          critics.push(ran.verdict);
        } catch (error) {
          critics.push({ mapId: map.id, majors: [], problem: `연출 비평 호출 실패: ${error instanceof Error ? error.message : String(error)}` });
        }
      }
      const seen = mapIds.length ? await see(env, session, task, "content", mapIds, undefined, false) : undefined;
      const npcProblems = seen?.checks.filter((c) => !c.ok && (c.id === "npc-reachable" || c.id.startsWith("exit"))) ?? [];
      const stageBad = stage.checks.filter((c) => !c.ok);
      const majors = critics.reduce((n, v) => n + v.majors.length, 0);
      // 고친 횟수 = 같은 맵 컷신을 다시 부른 횟수(첫 짓기는 빼고). 첫 짓기를 세면 상한 1 에서 고치기가 한 번도 없었다(2026-10-25 G39).
      const rounds = session.content.filter((c) => c.verb === verb && (c.result as EventBuildResult).stage?.mapId === stage.mapId).length - 1;
      const clean = !stageBad.length && !npcProblems.length && !majors && !critics.some((v) => v.problem);
      session.stages.set(stage.mapId, { name: map?.name ?? stage.mapId, rounds, eventIds: result.eventIds?.map((e) => e.eventId), problems: clean ? [] : [
        ...stageBad.map((c) => `[무대 ${c.id}] ${c.detail}`),
        ...critics.flatMap((v) => v.majors.map((m) => `[연출 비평] ${m.what}${m.fix ? ` → ${m.fix}` : ""}`)),
      ] });
      const payload = {
        ok: true, summary: result.summary, warnings: result.warnings, missingArt: result.missingArt, eventIds: result.eventIds,
        machineChecks: [...stage.checks.map((c) => `[${c.id}] ${c.ok ? "통과" : "문제"} — ${c.detail}`), ...(npcProblems.length ? npcProblems.map((c) => c.detail) : ["사람·출입 검사 통과"])],
        critic: critics.map((v) => ({ mapId: v.mapId, score: v.score, majors: v.majors, ...(v.problem ? { problem: v.problem } : {}) })),
        round: rounds,
        next: clean ? "통과 — 무대 검사·연출 비평 major 0. 다른 요청 부분이 남았으면 이어서, 아니면 보고한다."
          : rounds >= V2_MAX_REPAIR_ROUNDS ? `고치기 상한(${V2_MAX_REPAIR_ROUNDS}번)에 닿았다 — 남은 문제를 보고한다.`
          : `Problems found — fix them in ONE more add_event call with redo:'${result.eventIds?.[0]?.eventId ?? "<scene event id>"}' (rewrites this scene in place; the people it stood up are reused). Change the spot words, appear where and beat order the problems point at. Cell numbers only where the critic gave a cell.`,
      };
      const shots: Seen = { checks: [...stage.checks], critics, images: frames.map((f) => ({ mapId: stage.mapId, dataUrl: f.image })) };
      return withImages(payload, shots.images.length ? shots : seen, 3);
    }
    const seen = mapIds.length ? await see(env, session, task, "content", mapIds, undefined, false) : undefined;
    const npcProblems = seen?.checks.filter((c) => !c.ok && (c.id === "npc-reachable" || c.id.startsWith("exit"))) ?? [];
    const zones = result.ok ? zoneStatusLines(env.ctx.project, mapIds, String(task ?? "")) : [];
    return withImages({ ok: result.ok, summary: result.summary, warnings: result.warnings, missingArt: result.missingArt, eventIds: result.eventIds, ...(zones.length ? { zones } : {}),
      ...(seen ? { machineChecks: npcProblems.length ? npcProblems.map((c) => c.detail) : "사람·출입 검사 통과" } : {}),
      next: result.ok ? (npcProblems.length ? "where 낱말이나 at 칸을 바꿔 다시 부른다." : "통과.")
        : /이미 (칩셋에 )?있다/u.test(result.summary) ? "칩셋에 이름이 비슷한 물건이 있다 — inspect 그림이나 이름으로 보아 요청과 같은 물건이면 그 id 를 place_object 로 놓고, 요청과 다른 물건(재질·장치가 다름)이면 draw_object 에 notThese:[그 id 들] 을 넣어 다시 부른다(새로 그린다). 이름만 바꿔 다시 부르지 않는다."
        : "명세를 고쳐 다시 부르거나 못 하는 것을 보고한다." }, seen, 1);
  };
  // 청사진 먼저(2026-10-28): 게임 하나를 만드는 요청이면 짓기 전에 write_blueprint 로 목표·핵심 경로·엔딩을 쓴다.
  // 설계자가 따로 정해진 실행(비교 C: Argon 설계 + Flash 실행)은 설계자가 처음에 한 번 쓰고, 실행 모델은 그 청사진대로 짓는다.
  const needsBlueprint = wantsWholeGame(String(task ?? "")) && !env.ctx.project.gameBlueprint;
  const designer = needsBlueprint ? blueprintDesignerFromEnv() : undefined;
  const designed = designer && env.roleChat ? (() => {
    env.emit({ type: "execution_status", name: "v2.blueprint", ok: true, summary: `설계자(${designer.model})가 청사진을 쓰는 중` });
    return designBlueprint((messages, signal) => env.roleChat!(designer, messages, signal), String(task ?? ""), projectBrief(env.ctx.project, env.ctx.currentMapId), env.signal);
  })() : undefined;
  let designerNoted = false;
  const noteAssembly = (applied: string[]): void => {
    if (applied.length) env.emit({ type: "execution_status", name: "v2.assembly", ok: true, summary: `청사진 조립 기본값: ${applied.join(" · ")}` });
  };
  const blueprintGate = async (): Promise<{ ok: false; summary: string } | undefined> => {
    if (env.ctx.project.gameBlueprint || !wantsWholeGame(String(task ?? ""))) return undefined;
    if (designed) {
      const result = await designed;
      if ("blueprint" in result) {
        env.ctx.project.gameBlueprint = result.blueprint;
        noteAssembly(applyBlueprintAssembly(env.ctx.project));
        await env.checkpoint("write_blueprint");
        env.emit({ type: "execution_status", name: "v2.blueprint", ok: true, summary: `설계자 청사진 ${result.blueprint.steps.length}단계` });
        return { ok: false, summary: `설계자가 이 게임의 청사진을 썼다 — 이 명세는 짓지 않았다. 청사진의 장소·이벤트 이름 그대로 다시 부른다.\n${walkBlueprint(env.ctx.project).lines.join("\n")}\n${result.blueprint.steps.map((st) => `${st.id} 「${st.place}」 「${st.event}」: ${st.action} → ${st.gives}`).join("\n")}` };
      }
      if (!designerNoted) { designerNoted = true; env.emit({ type: "execution_status", name: "v2.blueprint", ok: false, summary: result.error }); }
    }
    return { ok: false, summary: "게임 하나를 만드는 요청이다 — 짓기 전에 write_blueprint 로 이 게임의 청사진(playerGoal·핵심 경로 steps·ending)을 먼저 쓴다. 그다음 청사진의 장소 이름 그대로 짓는다." };
  };
  // 청사진 경로 짓기(2026-10-28 mt2): 단계(place·event·needs·gives)와 엔딩에서 이벤트·조건·스위치·아이템·엔딩 호출을 함수가 짓는다.
  /** 싸움이 있어야 하는 게임인가 — 장르나 요청이 모험·RPG·액션 쪽일 때만(경영·일상·추리·연애·퍼즐 게임에 싸움을 밀어 넣지 않는다). */
  const wantsBattle = (genre: string): boolean => /RPG|알피지|롤플레잉|모험|어드벤처|판타지|액션|용사|마왕|전투|던전|adventure|action|fantasy|dungeon|quest/iu.test(`${genre} ${withoutIntentNote(String(task ?? ""))}`);
  const runBlueprintPath = (steps: readonly PathStepText[]) => {
    const result = buildBlueprintPath(run, steps);
    return result;
  };
  const hasTransferTo = (fromId: string, toId: string): boolean => {
    const walk = (node: unknown): boolean => Array.isArray(node) ? node.some(walk) : !!node && typeof node === "object" && (((node as { kind?: string; mapId?: string }).kind === "transfer" && (node as { mapId?: string }).mapId === toId) || Object.values(node).some(walk));
    return (env.ctx.project.maps[fromId]?.events ?? []).some((e) => walk(e.commands ?? []) || walk(e.pages ?? []));
  };
  // 부모 맵 ↔ 새로 지은 자식 장소 잇기(make_game 과 끝맺음 자동 짓기가 같이 쓴다): 실내는 마을 집 문, 던전은 입구, 바깥끼리는 가장자리, 못 하면 이동 칸.
  const linkChild = (parentMap: string, parentSpec: PlaceSpec | undefined, parentResult: PlaceBuildResult | undefined, spec: PlaceSpec, result: PlaceBuildResult, side?: "north" | "south" | "east" | "west", givenDoor?: { x: number; y: number; kit?: string }): string => {
    const notes: string[] = [];
    const childMap = result.mapIds[0]!;
        const pName = env.ctx.project.maps[parentMap]?.name ?? parentMap, cName = env.ctx.project.maps[childMap]?.name ?? childMap;
        if (hasTransferTo(parentMap, childMap)) return `${pName} ↔ ${cName}: 짓기에서 이어짐`;
        const usedDoors = new Set<string>((env.ctx.project.maps[parentMap]?.events ?? []).map((e) => `${e.x},${e.y + 1}`));
        let linked = false;
        if (isInside(spec) && result.entrance) {
          const door = givenDoor ?? pickDoor(villageDoors(parentResult ?? ({ state: undefined } as unknown as PlaceBuildResult)), spec.name, usedDoors, env.ctx.project.maps[parentMap]!);
          if (door) {
            const r = run.call("create_transfer_pair", { a: { mapId: parentMap, x: door.x, y: door.y, doorAt: { x: door.x, y: door.y - 1 } }, b: { mapId: childMap, x: result.entrance.x, y: result.entrance.y } });
            linked = r.ok; notes.push(r.ok ? `${pName} 집 문(${door.x},${door.y - 1}${door.kit ? ` ${door.kit}` : ""}) ↔ ${cName}` : `${pName} 집 문 잇기 실패: ${r.summary.slice(0, 160)}`);
          } else {
            // 지은 결과의 집 문 목록이 없으면(모델이 지은 부모 맵) 그 맵의 문 그림·계단·길 끝, 없으면 칩셋 문을 벽에 깔아 그 앞으로.
            const spot = pickTransferSpot(run, parentMap, { side: side ?? "north", outdoor: !!parentSpec && isOutdoor(parentSpec), otherName: cName });
            if (spot) {
              const { note, ...a } = spot;
              const r = run.call("create_transfer_pair", { a: { mapId: parentMap, ...a }, b: { mapId: childMap, x: result.entrance.x, y: result.entrance.y } });
              linked = r.ok; notes.push(r.ok ? `${pName} ${note} ↔ ${cName}` : `${pName} ${note} 잇기 실패: ${r.summary.slice(0, 160)}`);
            }
          }
        } else if (spec.type === "dungeon" || spec.type === "cave") {
          // 던전: 부모 맵의 걸어 닿는 칸 ↔ 던전 입구 계단(자리표시 출구가 있으면 그것을 바꾼다).
          // 문 자리는 정본 하나(transferSpot.dungeonGateSpot = dungeonLinkTools.pickDungeonGateSpot): 갱구가 맞는 길 곁 칸 → 갱구 자리 → 가장자리 길 끝 → 가장자리.
          // 못 찾으면 예전처럼 걸어 닿는 가장자리 칸.
          const pm = env.ctx.project.maps[parentMap]!;
          const gate = dungeonGateSpot(env.ctx.project, pm, side ?? "north");
          const at = gate ? { x: gate.x, y: gate.y } : edgeCell(env.ctx.project, pm, side ?? "north");
          const r = at ? run.call("link_world_entrance", { worldMapId: parentMap, links: [{ x: at.x, y: at.y, toMapId: childMap }] }) : undefined;
          linked = !!r?.ok && hasTransferTo(parentMap, childMap);
          if (linked) notes.push(`${pName}(${at!.x},${at!.y}) ↔ ${cName} 입구`);
        } else if (isOutdoor(spec) && !!parentSpec && isOutdoor(parentSpec)) {
          // 바깥끼리는 가장자리로 잇는다 — 그 변이 막혔으면(물·절벽) 다른 변을 차례로 해 본다. 다 안 되면 아래 이동 칸(집 문 그림이 바깥 맵 사이 문이 되지 않게 먼저 변을 다 쓴다).
          const first = side ?? "north";
          for (const dir of [first, ...LINK_SIDES.filter((d) => d !== first)]) {
            const r = run.call("link_maps", { from: { mapId: parentMap, exit: { side: dir } }, to: { mapId: childMap, entry: { side: oppositeSide(dir) } } });
            if (!r.ok) continue;
            linked = true; notes.push(`${pName} ${dir} 가장자리 ↔ ${cName}`);
            break;
          }
        }
        if (!linked) {
          // 대신 걸어 닿는 칸끼리 문을 둔다(그림 없는 이동 칸) — 못 이은 채 두지 않는다.
          // 문 그림·계단·길 끝을 먼저 고르고(없으면 칩셋 문을 벽에 깐다), 그래도 없을 때만 그림 없는 가장자리 칸.
          const dir = side ?? "north";
          const spotA = pickTransferSpot(run, parentMap, { side: dir, outdoor: !parentSpec || isOutdoor(parentSpec), otherName: cName });
          const a = spotA ? { x: spotA.x, y: spotA.y, ...(spotA.doorAt ? { doorAt: spotA.doorAt } : {}) } : edgeCell(env.ctx.project, env.ctx.project.maps[parentMap]!, dir);
          const spotB = result.entrance && result.entrance.mapId === childMap ? undefined : pickTransferSpot(run, childMap, { side: oppositeSide(dir), outdoor: isOutdoor(spec), otherName: pName });
          const b = result.entrance && result.entrance.mapId === childMap ? { x: result.entrance.x, y: result.entrance.y } : spotB ? { x: spotB.x, y: spotB.y, ...(spotB.doorAt ? { doorAt: spotB.doorAt } : {}) } : edgeCell(env.ctx.project, env.ctx.project.maps[childMap]!, oppositeSide(dir));
          const r = a && b ? run.call("create_transfer_pair", { a: { mapId: parentMap, ...a }, b: { mapId: childMap, ...b } }) : undefined;
          const how = [spotA?.note, spotB?.note].filter(Boolean).join(" · ");
          if (r?.ok) notes.push(`${pName}(${a!.x},${a!.y}) ↔ ${cName}(${b!.x},${b!.y}) — ${how || "문 그림 없이 이동 칸으로 이었다"}`);
          else notes.push(`${pName} ↔ ${cName}: 잇지 못했다(${r?.summary.slice(0, 120) ?? "걸어 닿는 칸이 없다"})`);
        }
    return notes.join(" / ");
  };
  return { env, session, task, run, poolVillage, requestWorld, freshStart, lean, specShown, showSpecs, withSpecText, specGate, outsideBuilt, noteLayoutPlace, finishPlace, finishContent, designed, noteAssembly, blueprintGate, wantsBattle, runBlueprintPath, linkChild };
}

export type VerbContext = ReturnType<typeof makeVerbContext>;
