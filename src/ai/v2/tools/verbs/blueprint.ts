// 청사진 동사 — write_blueprint(게임 설계 적기) · build_blueprint_path(청사진 단계를 실제 사건으로 짓기).
import type { PiToolShape } from "@/ai/piAgent/toolAdapter";
import { oneProjectGame } from "../../request/readers";
import { applyBlueprintAssembly, isPlaceholderTitle } from "@/project/blueprintAssembly";
import { applyUiLook, uiLookById, uiLookHint } from "@/project/uiLook";
import { applyBlueprintOpening } from "@/editor/tools/blueprintOpening";
import { carryBuilt } from "../../story/blueprintCarry";
import { MIN_BLUEPRINT_STEPS, WRITE_BLUEPRINT_SCHEMA, parseBlueprintArgs, stepMixProblems, thinBlueprintReason, walkBlueprint } from "../../story/blueprint";
import { isEscapeBlueprint } from "../../request/scope";
import { repairWorldPlaces, worldById, worldPlaceProblems } from "../../place/world";
import { BUILD_BLUEPRINT_PATH_SCHEMA } from "../../story/blueprintPath";
import { keepStepText, pathTextProblems } from "../../story/blueprintPathText";
import { fillPartyLooks } from "../../story/shipLookDefaults";
import { blueprintMapFor, type PathStepText } from "../../story/blueprintPathNames";
import { WORLD_BOUNCES, text } from "../support";
import { recordStageWrites } from "../../shared/stageWrites";
import type { VerbContext } from "../context";

/** createV2Tools 에서 뗀 것 — writeBlueprint · buildBlueprintPathVerb. (blueprintVerbs) */
export function blueprintVerbs(c: VerbContext) {
  const { env, session, task, requestWorld, finishContent, designed, noteAssembly, blueprintGate, wantsBattle, runBlueprintPath } = c;
  const writeBlueprint: PiToolShape = {
    name: "write_blueprint", label: "게임 청사진", concurrency: "exclusive",
    description: "Before building a game, write its blueprint (one line of new-player goal, the critical path from start to ending, the ending, the feeling of each scene). Replaces an existing one wholesale (also to match the names actually built). Returns how far this path connects in the current project.",
    parameters: WRITE_BLUEPRINT_SCHEMA as unknown as PiToolShape["parameters"],
    async execute(_id, params) {
      // 설계자 실행에서는 첫 청사진을 설계자가 쓴다 — 실행 모델의 초안은 설계자 청사진이 없을 때만 쓴다(이름 맞추기 다시 쓰기는 그 뒤에 허용).
      if (designed && !env.ctx.project.gameBlueprint) {
        const gate = await blueprintGate();
        if (env.ctx.project.gameBlueprint) return text({ ok: true, summary: `설계자 청사진을 걸었다(네 초안 대신). ${gate?.summary ?? ""}` });
      }
      // 제목·장르를 빠뜨린 다시 쓰기(mt2 Flash: 매 턴 «title·genre is required» 로 한 번 실패한 뒤 다시 썼다)는 앞 청사진·프로젝트 제목으로 채운다.
      const prior = env.ctx.project.gameBlueprint;
      const raw = (params ?? {}) as Record<string, unknown>;
      const filled = { ...raw, title: raw.title || prior?.title || (isPlaceholderTitle(env.ctx.project.meta?.title) ? "" : env.ctx.project.meta?.title) || "제목 없는 게임", genre: raw.genre || prior?.genre || "게임" };
      const parsed = parseBlueprintArgs(filled, String(task ?? ""));
      if ("error" in parsed) return text({ ok: false, summary: `청사진을 읽지 못했다: ${parsed.error}` });
      // 처음 쓰는 청사진이 장소 1곳·3단계처럼 얇으면 한 번만 거절한다(2026-11-10 ninja-0062: 3단계를 한 곳에 몰아 맵·퀘스트·깊이 관문을 3번 받고도 못 닫았다).
      // 맵을 짓기 전이라 다시 쓰는 비용은 호출 한 번이다. 다시 쓰는 청사진(prior)·설계자 청사진·한 곳짜리 게임은 거절하지 않는다.
      // 게임 세계(world.ts): 장소 목록이 이 세계의 종류로 고르게 퍼졌는지 본다. 두 번까지 돌려보내고, 그 뒤에는 함수가 메워서 건다.
      // 다시 쓰는 청사진이 places 를 빼면 앞 청사진의 장소를 물려받는다(이름 맞추기 다시 쓰기가 장소를 지우지 않게).
      // 앞 청사진의 단계 글(대사·고를 것)은 같은 단계(id·종류·사람이 같다)면 물려받는다 — 이름 맞추기 다시 쓰기가 대사를 지우지 않게.
      if (prior) parsed.blueprint = { ...parsed.blueprint, steps: parsed.blueprint.steps.map((st) => {
        const old = prior.steps.find((o) => o.id === st.id);
        return !st.text && old?.text && old.kind === st.kind && (old.who ?? "") === (st.who ?? "") ? { ...st, text: old.text } : st;
      }) };
      // 앞 청사진의 맺음 글도 물려받는다 — 이름 맞추기 다시 쓰기가 엔딩 화면의 글을 지우지 않게.
      if (prior?.ending.closing?.length && !parsed.blueprint.ending.closing?.length) parsed.blueprint = { ...parsed.blueprint, ending: { ...parsed.blueprint.ending, closing: prior.ending.closing } };
      // 앞 청사진의 오프닝 글도 물려받는다 — 이름 맞추기 다시 쓰기가 오프닝의 글을 지우지 않게.
      if (prior?.opening?.length && !parsed.blueprint.opening?.length) parsed.blueprint = { ...parsed.blueprint, opening: prior.opening };
      // 앞 청사진이 고른 UI 모습도 물려받는다 — 이름 맞추기 다시 쓰기가 look 을 빼도 게임의 얼굴이 바뀌지 않게. 목록에 없는 id 는 읽을 때 버려진다.
      if (prior?.look && !parsed.blueprint.look) parsed.blueprint = { ...parsed.blueprint, look: prior.look };
      // 앞 청사진에 적은 크기·싸움 없음도 물려받는다 — 이름 맞추기 다시 쓰기가 그 칸을 빼도 관문 하한이 도로 커지지 않게. 다시 적으면 적은 값이 이긴다.
      if (prior?.scale && raw.scale === undefined) parsed.blueprint = { ...parsed.blueprint, scale: prior.scale };
      // 처음 쓰는 청사진이 크기를 안 적으면 첫 판 MVP 다(2026-11-23 오너 «처음엔 맵 3~5개 MVP 만, 키우는 것은 요청 시»). 큰 게임은 모델이 scale:"full" 로 적는다.
      if (!prior && raw.scale === undefined) parsed.blueprint = { ...parsed.blueprint, scale: "mvp" };
      if (prior?.battles === false && raw.battles === undefined) parsed.blueprint = { ...parsed.blueprint, battles: false };
      // 싸움이 없어도 된다고 적은 게임에는 전투 단계를 요구하지 않는다(요청 글의 «전투» 낱말은 «전투는 없어도 돼» 에도 있다).
      const needBattle = (genre: string): boolean => parsed.blueprint.battles !== false && wantsBattle(genre);
      const small = parsed.blueprint.scale === "small";
      const mvp = parsed.blueprint.scale === "mvp";
      const unknownLook = typeof raw.look === "string" && raw.look.trim() && !uiLookById(raw.look) ? ` look «${raw.look.trim().slice(0, 24)}» is not a look id — ignored.` : "";
      // 앞 청사진의 단계가 지어 둔 이벤트·스위치도 물려받는다 — 이름만 바꾼 다시 쓰기가 사람을 한 명 더 세우지 않게(story/blueprintCarry.ts).
      parsed.blueprint = carryBuilt(prior, parsed.blueprint);
      // 갇힌 방 게임(방탈출·밀실)은 세계를 쓰지 않는다 — 방 하나를 설계해 짓는 종전 길이 맡는다(세계의 장소 종류에는 그 방이 없다).
      const oneRoomGame = oneProjectGame(env.ctx.project, String(task ?? "")) || isEscapeBlueprint(parsed.blueprint);
      const world = prior ? worldById(prior.setting) : designed || oneRoomGame ? undefined : requestWorld();
      // 세계 없는 게임의 청사진에는 장소 목록을 남기지 않는다 — 남으면 끝맺음 장소 짓기가 이름이 똑같은 맵만 «이미 지었다»로 보아 같은 장소를 한 번 더 짓는다.
      // 모델이 적은 종류·앞 장소는 이 실행의 사실로 남긴다 — 끝맺음이 그 장소를 대신 지을 때 이름으로 추측하지 않는다(place/placeGuess.placeSpecFor).
      if (!world && parsed.blueprint.places) {
        for (const pl of parsed.blueprint.places) session.notePlaceFact(pl.name, { name: pl.name, kind: pl.kind, ...(pl.from ? { from: pl.from } : {}) });
        const { places: _places, ...rest } = parsed.blueprint; parsed.blueprint = rest;
      }
      const worldNotes: string[] = [];
      // 크기·섞임 알림(2026-11-16 오너: 벽을 기본값으로) — 단계·장소 수, 싸움 단계, 종류 섞임이 모자라도 청사진은 건다. 돌려보내는 것은 지을 수 없는 것
      // (세계에 없는 장소 종류 · 장소 목록에 없는 단계 장소)뿐이다. 알림은 처음 쓰는 청사진에 한 번, 모델이 읽는다(영어).
      const advice: string[] = [];
      if (world) {
        let draft = !parsed.blueprint.places?.length && prior?.places?.length ? { ...parsed.blueprint, places: prior.places } : parsed.blueprint;
        const oneRoom = oneRoomGame;
        const broken = worldPlaceProblems(draft, world, true);
        if (broken.length && session.worldBounces < WORLD_BOUNCES) {
          session.worldBounces += 1;
          return text({ ok: false, summary: `Blueprint not saved yet (${session.worldBounces}/${WORLD_BOUNCES}) — this game's world is ${world.name}. Fix and call write_blueprint again: ${broken.join(" ")}` });
        }
        if (!prior) advice.push(...worldPlaceProblems(draft, world, oneRoom || small, mvp).filter((p) => !broken.includes(p)), ...(!oneRoom && !small && !mvp && draft.steps.length < MIN_BLUEPRINT_STEPS ? [`only ${draft.steps.length} steps — a full-size game has ${MIN_BLUEPRINT_STEPS} to 8 (each step reads what the step before it gave).`] : []), ...(oneRoom ? [] : stepMixProblems(draft, needBattle(draft.genre))));
        // 지을 수 없는 장소만 함수가 메운다 — 장소 수와 같은 종류를 거듭 쓴 것은 모델이 정한 것이다(알림만).
        const fixed = repairWorldPlaces(draft, world, broken.length > 0);
        draft = { ...draft, setting: world.id, places: fixed.places };
        worldNotes.push(...fixed.notes);
        parsed.blueprint = draft;
      } else if (!prior && !designed && !oneProjectGame(env.ctx.project, String(task ?? "")) && !isEscapeBlueprint(parsed.blueprint)) {
        const thin = thinBlueprintReason(parsed.blueprint);
        // 단계 종류(사람·싸움·퍼즐·고르기)가 섞였는지도 같이 알린다 — 전부 «살펴본다» 인 청사진은 걷기만 하는 게임이 된다.
        advice.push(...(thin ? [thin] : []), ...stepMixProblems(parsed.blueprint, needBattle(parsed.blueprint.genre)));
      }
      const adviceNote = advice.length ? ` Notice — saved as written, nothing is rejected. Change these only if the request asks for it: ${advice.join(" ")}` : "";
      // 같은 내용을 다시 쓰면 바꾸지 않는다 — 청사진을 되풀이해 쓰는 대신 경로를 짓게 한다.
      const core = (b: typeof parsed.blueprint | undefined) => b ? JSON.stringify({ t: b.title, g: b.genre, p: b.playerGoal, o: b.opening, s: b.steps, e: b.ending, w: b.setting, pl: b.places, l: b.look, sc: b.scale, ba: b.battles }) : "";
      if (prior && core(prior) === core(parsed.blueprint)) {
        session.blueprintRewrites += 1;
        const walked = walkBlueprint(env.ctx.project);
        return text({ ok: true, summary: `청사진이 이미 같은 내용이다 — 다시 쓰지 않았다(${session.blueprintRewrites}번째). write_blueprint 를 또 부르지 않는다. ${walked.blockers.length ? "다음: build_blueprint_path 를 불러 청사진 단계대로 이벤트·조건·엔딩 호출을 짓는다." : "경로가 이어져 있다 — 남은 일(장소 꾸미기·대사)을 한다."}`, path: walked.lines, open: walked.blockers.slice(0, 6).map((b) => b.message) });
      }
      env.ctx.project.gameBlueprint = parsed.blueprint;
      const assembled = applyBlueprintAssembly(env.ctx.project);
      // 모델이 고른 모습은 바로 입힌다(끝맺음을 기다리지 않는다 — 짓는 동안의 화면 검수도 그 모습으로 본다). 안 골랐으면 끝맺음이 게임의 사실로 고른다.
      const lookNotes = parsed.blueprint.look ? applyUiLook(env.ctx.project, parsed.blueprint.look, { skipHud: true }) : [];
      if (lookNotes.length) assembled.push(`UI look ${parsed.blueprint.look}`);
      // 주인공의 모습은 사람을 세우기 전에 정한다 — 뒤에 서는 사람들이 주인공과 같은 칩·같은 모습을 피한다(끝맺음에서 정하면 먼저 선 사람을 다시 입혀야 했다).
      // 그 쪽지는 진행 줄에만 적는다 — 도구 결과(모델이 읽는 글)에는 싣지 않는다. 쓴 칸은 단계의 쓰기로 기록한다(출하 관문이 «요청에 없는 배우 변경» 으로 짚지 않게).
      const heroLooks = recordStageWrites(env.ctx.project, session.stageWrites, () => fillPartyLooks(env.ctx.project, String(task ?? "")));
      // 맵을 이미 지은 뒤 청사진을 다시 쓴 경우에만 실제로 깐다(빈 맵이면 건너뛴다 — 끝맺음 조립이 다시 부른다).
      try { assembled.push(...applyBlueprintOpening(env.ctx.project)); } catch { /* 끝맺음 조립이 다시 시도한다 */ }
      noteAssembly([...assembled, ...heroLooks]);
      const walked = walkBlueprint(env.ctx.project);
      await env.checkpoint("write_blueprint");
      // 맺음 글이 없으면 엔딩 화면에 설 글이 없다 — how 는 설계 메모라 대신 내지 않는다(story/shipDefaults.ts fillEndingClosure).
      const noClosingBase = parsed.blueprint.ending.closing?.length ? "" : " ending.closing is empty — the ending screen has no text of yours. Call write_blueprint again with ending.closing (2–4 lines the player reads: what happened and what became of the people, by name); ending.how is a design note and is never shown.";
      // 모습을 안 골랐으면 이 세계에 맞는 세트 두셋을 한 줄로 — 고르고 싶은 모델은 다음 청사진 고치기에 look 을 적는다(안 적으면 첫 것을 함수가 고른다).
      const lookHint = parsed.blueprint.look ? "" : uiLookHint(env.ctx.project, env.request.projectKey ? String(env.request.projectKey) : parsed.blueprint.title, world?.tilesetId);
      // 오프닝 글이 없으면 기본 오프닝에는 장소 이름과 목표 문장의 안전한 부분만 선다 — 목표 문장을 둘로 자른 것은 오프닝이 아니고, 찾는 게임의 답이나 «보스» 같은 게임 낱말이 그대로 나갔다(2026-11-16 확인 빌드 r6 P8).
      const noOpening = parsed.blueprint.opening?.length ? "" : " opening is empty — the opening will show place names and at most the safe part of playerGoal (a goal sentence that names the answer or uses a game word is not read out). Call write_blueprint again with opening (2–4 lines the player reads before the first map: who they are and what is wrong here — narration, no answer, no game words like boss or quest).";
      const noClosing = `${noClosingBase}${noOpening}${unknownLook}${lookHint}${adviceNote}`;
      if (world) {
        const unbuilt = (parsed.blueprint.places ?? []).filter((pl) => !blueprintMapFor(env.ctx.project, pl.name));
        return text({ ok: true, summary: `Blueprint saved (${parsed.blueprint.steps.length} steps · world ${world.name} · ${parsed.blueprint.places?.length ?? 0} places).${worldNotes.length ? ` Code adjusted places: ${worldNotes.join("; ")}.` : ""} ${unbuilt.length ? `Next: build_places once — it builds and links ${unbuilt.length} place(s): ${unbuilt.map((pl) => `«${pl.name}»(${pl.kind})`).join(", ")}. Then build_blueprint_path once (do not write step events one by one with upsert_event).` : "All places are built. Next: build_blueprint_path once."}${assembled.length ? ` Title defaults set from the blueprint: ${assembled.join(" · ")}.` : ""}${noClosing}`, path: walked.lines, open: walked.blockers.slice(0, 8).map((b) => b.message) });
      }
      return text({ ok: true, summary: `청사진을 걸었다(${parsed.blueprint.steps.length}단계). 장소를 make_place 로 지은 뒤 build_blueprint_path 한 번으로 단계별 이벤트·조건·엔딩 호출을 짓는다(이벤트를 upsert_event 로 하나씩 쓰지 않는다).${assembled.length ? ` 청사진에 맞춰 타이틀 기본값을 바꿨다: ${assembled.join(" · ")}.` : ""}${noClosing}`, path: walked.lines, open: walked.blockers.slice(0, 8).map((b) => b.message) });
    },
  };
  const buildBlueprintPathVerb: PiToolShape = {
    name: "build_blueprint_path", label: "청사진 경로 짓기", concurrency: "exclusive",
    description: "Build the blueprint's (write_blueprint) critical path as a real play path — per step put an examine/talk event on that map (an event with the same name is rewritten), hang the previous step's gives (keys and notes become items, the rest switches) as the next step's condition, and make the last step call the ending (if no ending exists it is defined from the blueprint ending). Call once after building the places — do not match events one by one with upsert_event/define_ending. Only dialogue can be given, via steps[{id, lines, lockedLines}] (empty = filled from the blueprint text); a number lock gets code on that step and the answer in an earlier step's lines. Calling again rewrites the same events; the text of each step is remembered, so send only the steps whose text you want to change.",
    parameters: BUILD_BLUEPRINT_PATH_SCHEMA as unknown as PiToolShape["parameters"],
    async execute(id, params) {
      if (!env.ctx.project.gameBlueprint) return text({ ok: false, summary: "청사진이 없다 — write_blueprint 를 먼저 부른다." });
      const steps = ((params as { steps?: PathStepText[] }).steps ?? []).filter((t) => t && typeof t.id === "string");
      // 받은 글은 청사진 단계에 남긴다 — 다음에 한 단계만 고쳐 불러도(다음 턴이어도) 나머지 단계의 대사·고르기를 잃지 않는다.
      if (steps.length) env.ctx.project = { ...env.ctx.project, gameBlueprint: keepStepText(env.ctx.project.gameBlueprint, steps) };
      // 사람이 말하는 단계에 대사가 없으면 한 번만 돌려보낸다 — 그 뒤에는 있는 글로 짓는다(빈 대사는 단계의 할 일 한 줄로 채운다).
      const lacking = session.pathTextBounces < 1 ? pathTextProblems(env.ctx.project, steps) : [];
      if (lacking.length) {
        session.pathTextBounces += 1;
        return text({ ok: false, summary: `Path not built yet — the people on the path have no words. Call build_blueprint_path again with steps:[{id, lines, …}] for: ${lacking.join(" ")} (A line starting with «(» is narration. Calling again without them builds the path with one-line placeholders.)` });
      }
      // 청사진 장소 가운데 아직 맵이 없는 것은 먼저 짓는다(끝맺음 auto-places 와 같은 빌더) — 경로 빌더는 맵이 없는 단계를 앞 단계 맵에 옮겨 세우고
      // 청사진의 place 를 그 맵 이름으로 바꾼다. 그러면 그 장소는 영영 지어지지 않는다(2026-11-16 명세 은행 r5a-river: «강변 들판» 이 사라지고 열쇠 단계가 선술집에 섰다).
      let placesNote = "";
      if (session.buildPlaces && walkBlueprint(env.ctx.project).blockers.some((b) => b.id === "blueprint-place-missing")) {
        const built = await session.buildPlaces();
        if (built.length) placesNote = ` Places in the blueprint that had no map were built first: ${built.join(" / ").slice(0, 400)}.`;
      }
      const result = runBlueprintPath(steps);
      return finishContent(id, "build_blueprint_path", params, placesNote ? { ...result, summary: `${result.summary}${placesNote}` } : result);
    },
  };
  return { writeBlueprint, buildBlueprintPathVerb };
}
