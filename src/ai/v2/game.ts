// 조수 v2 «게임 요소» — 퀘스트·아이템·상점·전투·파티·스위치처럼 맵이 아닌 요청.
//
// 왜(2026-10-23 게임 요소 비교 40): v2 동사(make_place·add_people·add_event·add_scene)는 장소·사람·연출만 다뤄서
// 「심부름 퀘스트」「새 무기를 상점에서」「보스 전투 뒤 감사」를 옮길 길이 없었다. 이 층은 이미 검증된 v1 결정론 도구를
// 그대로 내놓는다(스키마·검증·저장 계약이 v1 과 같다). 요청에 게임 낱말이 있을 때만 싣는다 — 맵 요청의 첫 턴을 무겁게 하지 않는다.
import { createPiToolset, type PiToolShape } from "@/ai/piAgent/toolAdapter";
import { getTool } from "@/editor/tools/toolRegistry";
import type { PiAssistantV2Env } from "./env";
import { asksForEncounters } from "./request/readers";
import { englishToolMessage, parseFailure } from "./loop/failureText";
import { withForestRouteBrief } from "./prompt/forestBrief";
import { v2ToolPool } from "./request/toolGroups";
import { classifyRequest } from "./request/intent";

/** 거절 본문(JSON·감싼 JSON·글)에서 첫 이유 한 줄 — 머리(«'도구' 실행 실패:»)를 걷는다. */
const firstReason = (why: string): string => { const p = parseFailure(why); return (p.issues[0]?.message ?? p.summary).replace(/^'[^']+'\s*실행 실패:\s*/u, ""); };

/** 게임 도구 묶음 — 실행 기록은 v1 경로와 같은 onCall(env.record)로 남는다. */
/** pool:true 면 이 요청의 도구에 v2ToolPool 전부를 더한다(필요할 때 싣는 도구도 같은 감싸개를 지나게). */
export function createGameTools(env: PiAssistantV2Env, task = "", options: { readonly pool?: boolean } = {}): PiToolShape[] {
  // 도구 묶음은 요청 글과 프로젝트를 같이 본 기록에서 읽는다(게임 하나를 잇는 «계속» 은 글에 게임 낱말이 없어도 게임 도구를 받는다).
  const names = [...new Set([...classifyRequest(task, env.ctx.project).tools.extra, ...(options.pool ? v2ToolPool() : [])])].filter((name) => getTool(name));
  return withActorLookRetry(withItemUtilityCleanup(withTransferRelocation(withForestRouteBrief(withEncountersOnlyWhenAsked(withPictureSearchBudget(createPiToolset(env.ctx, { ...(env.toolsetOptions ?? {}), toolNames: names, onCall: env.record })), task), () => env.ctx.project, env.record))));
}

/**
 * 회복약에 딸려 온 탈출·퇴치 칸을 뺀다 — 스키마 칸을 기본값으로 다 채워 보내는 모델이 escapeTo:"entrance"(열거 첫 값)·repelSteps:0 을 실어
 * 회복약이 «던전 탈출» 아이템으로 저장됐다. 이름·설명에 탈출·퇴치 낱말이 없으면 그 칸을 뺀다. repelSteps 0 은 늘 뺀다.
 * 다른 도구의 빈 칸·어긋난 칸(트룹의 빈 members, 필드 적의 patrol·graphic, 이동 쌍의 doorAt)은 그 도구가 스스로 읽는다(2026-11-11 B5a).
 */
const ESCAPE_ITEM_WORD = /탈출|귀환|되돌아|입구로|escape|rope|로프|밧줄/iu;
const REPEL_ITEM_WORD = /퇴치|기피|쫓|피하|성수|향|repel|ward/iu;
function withItemUtilityCleanup(tools: PiToolShape[]): PiToolShape[] {
  return tools.map((tool) => tool.name !== "upsert_item" ? tool : { ...tool, async execute(id, params, signal) {
    if (!params || typeof params !== "object") return tool.execute(id, params, signal);
    const args = structuredClone(params) as Record<string, unknown>;
    if (args.item && typeof args.item === "object") {
      const it = args.item as Record<string, unknown>;
      const words = `${String(it.name ?? "")} ${String(it.description ?? "")}`;
      if (it.escapeTo !== undefined && (it.escapeTo === "" || !ESCAPE_ITEM_WORD.test(words))) delete it.escapeTo;
      if (it.repelSteps !== undefined && (!(Number(it.repelSteps) >= 1) || !REPEL_ITEM_WORD.test(words))) { delete it.repelSteps; delete it.repelBelowLead; }
    }
    return tool.execute(id, args as typeof params, signal);
  } });
}

/**
 * upsert_actor 가 캐릭터 칩 관문(「캐릭터 그림 선택을 되돌렸습니다」)에 걸리면 칩 칸(characterResourceId·characterIndex)만 빼고 한 번 더 부른다 —
 * 이름·능력치·기술·얼굴은 저장되고, 결과 글이 «겉모습은 그대로 두었다 + 바꾸려면 list_npc_graphics 에서 고른 selectionId 를» 이라고 알린다.
 * 왜 (2026-10-30 scenes-duel en-loop 판, terra): 관문 거절이 upsert_actor 재실패 1위(판당 0.33, ce04 0.44)였다. 진짜 거절(쓰기 전체 되돌림)이다 —
 * terra 는 list_npc_graphics 를 부르지 않고 characterIndex 만 0→1→… 바꿔 같은 거절을 되풀이했고, 그사이 배우의 능력치·기술도 저장되지 않았다.
 * 같은 호출 id 로 다시 부르므로 기록(tool_end)에는 다시 부른 결과가 남는다. 칩을 «본 적 있는» 후보로 고르면 관문이 받는다(손대지 않는다).
 */
const LOOK_GATE = /캐릭터 그림 선택을 되돌렸습니다/u;
function withActorLookRetry(tools: PiToolShape[]): PiToolShape[] {
  return tools.map((tool) => tool.name !== "upsert_actor" ? tool : { ...tool, async execute(id, params, signal) {
    const args = (params && typeof params === "object" ? params : {}) as Record<string, unknown>;
    let why: string | undefined;
    try {
      const result = await tool.execute(id, params, signal);
      const body = (result.content.find((c) => c.type === "text") as { text?: string } | undefined)?.text ?? "";
      if (!LOOK_GATE.test(body)) return result;
      why = body;
    } catch (error) {
      why = error instanceof Error ? error.message : String(error);
      if (!LOOK_GATE.test(why)) throw error;
    }
    // 레지스트리 모양은 {actor:{…}} 이다(평평하게 펴기 flatWrapper 는 이 감싸개 바깥).
    const nested = args.actor && typeof args.actor === "object" && !Array.isArray(args.actor);
    const actor = (nested ? args.actor : args) as Record<string, unknown>;
    if (signal?.aborted || (actor.characterResourceId === undefined && actor.characterIndex === undefined)) throw new Error(why);
    const { characterResourceId: sheet, characterIndex: slot, ...rest } = actor;
    const chip = /\((charset:[^)]+)\)/u.exec(why)?.[1] ?? `${String(sheet ?? "")}:${String(slot ?? 0)}`;
    const retryArgs = nested ? { ...args, actor: rest } : rest;
    const second = await tool.execute(id, retryArgs as typeof params, signal); // 실패면 그대로 던진다(다른 이유) — 할 일 고리가 영어로 옮긴다.
    const note = `[Look not changed] The walking chip ${chip} was not picked from a list_npc_graphics result you have seen, so it was left out; everything else in this call was saved. `
      + `To change the look: list_npc_graphics{query:'<look>'} → upsert_actor{id:'${String(actor.id ?? "<id>")}', characterResourceId:'<sheet>', characterIndex:<slot>} using a selectionId charset:<sheet>:<slot> from that result. Do not resend the same chip.`;
    return { ...second, content: [...second.content, { type: "text", text: note }] };
  } });
}

/**
 * 문 칸(doorAt)을 단 create_transfer_pair 가 문앞이 막혀(상자·벽·봉쇄) 또는 doorAt·x,y 모양이 어긋나 거절되면, 그 끝의 doorAt 을 빼고 한 번 더 부른다 —
 * 편집기 도구는 doorAt 없는 끝을 시작 위치·다른 입구에서 걸어 닿는 가장 가까운 칸으로 옮겨 잇는다.
 * 2026-10-30 omo-loop-1030 terra boss-room r1~r3: 던전 안쪽 (24,7) 문앞이 막혀 세 판 모두 link 가 막힘으로 끝났다(문 그림은 없던 자리).
 * 옮긴 자리는 결과 글에 남고, 문 그림이 필요하면 그 자리에 stamp_object 로 찍는다.
 */
export function withTransferRelocation(tools: PiToolShape[]): PiToolShape[] {
  type End = { mapId?: string; x?: number; y?: number; doorAt?: { x: number; y: number } };
  const failed = (result: Awaited<ReturnType<PiToolShape["execute"]>>): string | undefined => {
    const first = result.content.find((c) => c.type === "text") as { text?: string } | undefined;
    const body = first?.text ?? "";
    let ok = true;
    try { ok = (JSON.parse(body) as { ok?: unknown }).ok !== false; } catch { ok = !/실행 실패/u.test(body); }
    return ok ? undefined : body;
  };
  return tools.map((tool) => tool.name !== "create_transfer_pair" ? tool : {
    ...tool,
    async execute(id, params, signal) {
      const args = (params && typeof params === "object" ? params : {}) as { a?: End; b?: End } & Record<string, unknown>;
      let result: Awaited<ReturnType<PiToolShape["execute"]>>;
      let why: string | undefined;
      try { result = await tool.execute(id, params, signal); why = failed(result); }
      catch (error) { why = error instanceof Error ? error.message : String(error); result = { content: [{ type: "text", text: JSON.stringify({ ok: false, summary: why }) }] } as Awaited<ReturnType<PiToolShape["execute"]>>; }
      if (!why || signal?.aborted || !/doorAt|안전한 출입구를 만들 수 없습니다|봉쇄|겹칩니다/u.test(why)) return result;
      // 어느 끝이 거절됐나: «A:»/«B:» 머리, 아니면 «문앞 (x,y)» 좌표가 맞는 끝, 아니면 doorAt 이 있는 끝 모두.
      const at = /문앞 \((\d+),(\d+)\)/u.exec(why);
      const hit = (e: End | undefined) => !!e?.doorAt && (at ? e.x === Number(at[1]) && e.y === Number(at[2]) : true);
      const sides = /(^|[^A-Za-z])A:/u.test(why) ? ["a"] : /(^|[^A-Za-z])B:/u.test(why) ? ["b"] : (["a", "b"] as const).filter((k) => hit(args[k]));
      // 먼저 거절된 끝만, 그래도 안 되면(도착 칸이 다른 이벤트와 겹침 등) 두 끝 모두 doorAt 을 뺀다.
      const withDoor = (["a", "b"] as const).filter((k) => args[k]?.doorAt);
      const tries = [sides.filter((k) => args[k as "a" | "b"]?.doorAt), withDoor].filter((t, i, all) => t.length && (i === 0 || t.join() !== all[0]!.join()));
      let second: Awaited<ReturnType<PiToolShape["execute"]>> | undefined;
      let drop: string[] = [];
      // 같은 호출 id 로 다시 부른다 — 실행기 기록(tool_end)이 처음 거절이 아니라 옮겨 이은 성공을 싣게(2026-10-30 «이어졌는데 FAIL 로 기록»).
      for (const t of tries) {
        const retry: Record<string, unknown> = { ...args };
        for (const k of t) { const { doorAt: _d, ...rest } = args[k as "a" | "b"]!; retry[k] = rest; }
        try { const r = await tool.execute(id, retry, signal); if (!failed(r)) { second = r; drop = t; break; } } catch { /* 다음 시도 */ }
      }
      if (!second) return result;
      const note = `[Relocated and linked] The first request was refused (${((t) => t.length > 220 ? `${t.slice(0, 219)}…` : t)(englishToolMessage(firstReason(why)))}) — called again without doorAt (the door cell) on end ${drop.map((k) => k.toUpperCase()).join("+")}, and linked at the nearest walkable cell (the new cell is in the result above). If you need a door picture, stamp it there with stamp_object.`;
      return { ...second, content: [...second.content, { type: "text", text: note }] } as Awaited<ReturnType<PiToolShape["execute"]>>;
    },
  });
}

/**
 * 무작위 조우는 요청이 말할 때만 켠다(2026-10-25 판정 J55): 견습 기사·던전·마법 시험 게임에서 조수가 시키지 않은 조우표를 깔았고
 * set_encounter_table 이 발생률 0 을 기본값으로 올려 회복 수단 없는 파티가 길에서 전멸했다. 요청에 조우 낱말이 없고 encounterRate 를
 * 주지 않았으면 0(꺼짐)으로 넘긴다 — 표는 남아 나중에 켤 수 있다. 일부러 켜려면 encounterRate 를 숫자로 준다(끝맺음 검사가 보고를 요구한다).
 */
export function withEncountersOnlyWhenAsked(tools: PiToolShape[], task: string): PiToolShape[] {
  if (asksForEncounters(task)) return tools;
  return tools.map((tool) => tool.name !== "set_encounter_table" ? tool : {
    ...tool,
    async execute(id, params, signal) {
      const args = (params && typeof params === "object" ? params : {}) as Record<string, unknown>;
      if (args.encounterRate !== undefined) return tool.execute(id, params, signal);
      const result = await tool.execute(id, { ...args, encounterRate: 0 }, signal);
      const note = "[Encounters off] The request asks for no random encounters, so encounterRate was set to 0 (off) — the player never fights just by walking. Put fights in visible enemies (place_field_enemy) or event battles; if you really need random encounters, call again with encounterRate as a number (6-10 is typical).";
      return { ...result, content: [...result.content, { type: "text", text: note }] } as Awaited<ReturnType<PiToolShape["execute"]>>;
    },
  });
}

/**
 * 그림 찾기 상한(G44, 2026-10-25 장난감 가게): 묶음에 장난감 가게 그림이 없는데 list_resources 를 14번 돌렸다.
 * 그림·배경(picture·backdrop·faceset) 검색이 0개로 끝난 것이 3번이면 더 찾지 않고 «없다»를 분명히 돌려준다 —
 * 사용자에게 그리기/일반 그림 중 고르게 하거나, 가장 가까운 일반 그림을 쓰고 보고에 적으라고 한다.
 */
const PICTURE_SEARCH_MISSES = 3;
function withPictureSearchBudget(tools: PiToolShape[]): PiToolShape[] {
  let misses = 0;
  const tried: string[] = [];
  return tools.map((tool) => tool.name !== "list_resources" ? tool : {
    ...tool,
    async execute(id, params, signal) {
      const args = (params ?? {}) as { kind?: string; query?: string };
      const pictureLike = ["picture", "backdrop", "faceset"].includes(String(args.kind));
      if (pictureLike && misses >= PICTURE_SEARCH_MISSES) {
        const summary = `[Picture search stopped] The picture bundle has no matching picture (already ${misses} searches with 0 results: ${tried.join(", ")}). Not searching again — ` +
          "either (1) ask the user with ask_user, in Korean: «꼭 맞는 그림이 없어요. 새로 그릴까요, 비슷한 일반 그림을 쓸까요?», " +
          "or (2) use the closest general picture you already found (night sky, field, interior…) and write in the report «맞는 그림이 없어 일반 그림을 썼다».";
        return { content: [{ type: "text", text: JSON.stringify({ ok: false, summary }) }] } as Awaited<ReturnType<PiToolShape["execute"]>>;
      }
      const result = await tool.execute(id, params, signal);
      if (pictureLike) {
        const first = result.content.find((c) => c.type === "text") as { text: string } | undefined;
        let count = -1;
        try { const parsed = JSON.parse(first?.text ?? "{}") as { summary?: string }; count = Number(/리소스 (\d+)개/u.exec(String(parsed.summary ?? ""))?.[1] ?? -1); } catch { /* 글 */ }
        if (count === 0) { misses += 1; tried.push(`${args.kind}:${String(args.query ?? "").slice(0, 30)}`); }
      }
      return result;
    },
  });
}
