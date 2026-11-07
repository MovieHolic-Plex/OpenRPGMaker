// src/editor/workshop/assistantObjectGen.ts
/**
 * 조수의 generate_missing_object 요청을 공방 실행기로 돈다(편집기 쪽 접착). 화면은 aiObjectGenCard.ts.
 * 새 기물 정의 → 공방 판(후보 그리기·검수, 사용자 자기 AI 계정) → 사용자가 고르거나 「알아서 고르기」 → 그 맵 칩셋에 굽기.
 * 공방 화면(workshopWorkspace)과 같은 세션·저장소를 쓰므로 판은 공방 「물건·가구」에서도 그대로 보인다.
 */
import { chooseAutoPickFrom } from "@/harnesses/_core/workshop/autoInstall";
import type { WorkshopRound } from "@/harnesses/_core/workshop/types";
import { store as projectStore } from "@/project/store";
import { createWorkshopChat } from "./chat";
import { mapObjectPalette } from "./mapObjectTarget";
import { autoPickRun, objectGenDefinition, type ObjectGenRequest } from "./objectRequest";
import { bakeWorkshopPick } from "./workshopBake";
import type { WorkshopBakedDetail } from "./workshopEvents";
import { getWorkshopSession, type WorkshopSession } from "./workshopSession";

/**
 * 「알아서 고르기」 — 기본은 켜짐(2026-11-05 오너 「필요한 에셋은 만들게 하고」: 조수는 사람이 고르기를 기다리지 않고 검수 통과 후보를 넣고 이어 놓는다).
 * 카드에서 끄면("0") 이 기기에서는 사람이 고른다.
 */
export const OBJECT_GEN_AUTO_PICK_KEY = "oprn:assistant-objectgen-autopick";

export function objectGenAutoPick(): boolean {
  try { return localStorage.getItem(OBJECT_GEN_AUTO_PICK_KEY) !== "0"; } catch { return true; }
}

export function setObjectGenAutoPick(on: boolean): void {
  try { localStorage.setItem(OBJECT_GEN_AUTO_PICK_KEY, on ? "1" : "0"); } catch { /* restricted storage */ }
}

export type ObjectGenRun = { readonly session: WorkshopSession; readonly itemKey: string; readonly roundId: string };

/** 요청을 새 기물로 정의하고 바로 판을 시작한다. 맵·칩셋이 사라졌거나 칩셋 그림을 못 읽으면 던진다. */
export async function startObjectGenRound(request: ObjectGenRequest, options: { readonly gate?: "receipt" } = {}): Promise<ObjectGenRun> {
  const project = projectStore.getCurrent();
  const map = project.maps[request.mapId];
  if (!map || map.tilesetId !== request.tilesetId || !project.tilesets[request.tilesetId]) {
    throw new Error("요청한 맵이나 칩셋이 바뀌었어요. 조수에게 다시 부탁해 주세요.");
  }
  const session = await getWorkshopSession(request.harnessId);
  let palette: string[] = [];
  if (request.harnessId === "map-objects") {
    palette = await mapObjectPalette(session.env, request.tilesetId, request.title, request.description);
    if (!palette.length) throw new Error("칩셋 그림을 읽지 못했어요. 맵 칩셋이 다 불러와졌는지 확인하고 다시 부탁해 주세요.");
  }
  const def = objectGenDefinition(request, new Set(session.items().map((item) => item.key)), palette);
  await session.store.putItemDef(session.projectKey, def);
  await session.reload();
  const item = session.items().find((candidate) => candidate.key === def.key);
  if (!item) throw new Error("새 기물을 공방에 넣지 못했어요.");
  // dev QA(참고 있음/없음 비교): window.__oprnWorkshopNoReference 가 참이면 참고 단계를 끈다. 출하 빌드에는 없다.
  const noReference = import.meta.env.DEV && (window as unknown as Record<string, unknown>).__oprnWorkshopNoReference === true;
  const round = await session.engine.startRound(item, { ...(noReference ? { reference: false } : {}), ...(options.gate ? { gate: options.gate } : {}) });
  await session.reload();
  return { session, itemKey: item.key, roundId: round.id };
}

export function currentRound(run: ObjectGenRun): WorkshopRound | null {
  return run.session.rounds.find((round) => round.id === run.roundId) ?? null;
}

/** 판의 모든 장이 끝났는가(다 그림·못 그림·취소) */
export function roundSettled(round: WorkshopRound): boolean {
  return round.runs.every((r) => r.status === "done" || r.status === "failed" || r.status === "cancelled");
}

/** 고른 장(사람) 또는 알아서 고른 장을 칩셋에 굽는다. 고른 기록·피드백도 공방 저장소에 남긴다(다음 판의 기준 그림). */
export async function bakeObjectGenRun(run: ObjectGenRun, letter: string, autoPicked: boolean, autoReason = ""): Promise<WorkshopBakedDetail> {
  const { session } = run;
  const round = currentRound(run);
  const item = session.items().find((candidate) => candidate.key === run.itemKey);
  const picked = round?.runs.find((r) => r.letter === letter);
  if (!round || !item || !picked?.grid) throw new Error("고른 후보를 찾지 못했어요.");
  const now = Date.now();
  await session.store.putPick({ projectKey: session.projectKey, itemKey: item.key, roundId: round.id, letter, at: now });
  await session.store.addFeedback({
    id: `f${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, projectKey: session.projectKey, itemKey: item.key, roundId: round.id,
    letter, verdict: "pick", reasons: [], note: autoPicked ? `알아서 고르기${autoReason ? ` — ${autoReason}` : ""}` : "", at: now,
  });
  const detail = bakeWorkshopPick(item, picked.grid, session.runner.palette(item), session.env, { autoPicked, gate: picked.gate ?? null, base: picked.base ?? null });
  await session.reload();
  return detail;
}

/** 「알아서 고르기」가 고를 장 — 검수 통과 첫 장, 없으면 null(사람에게 넘긴다). */
export function autoPickLetter(run: ObjectGenRun): string | null {
  const round = currentRound(run);
  return round ? autoPickRun(round.runs)?.letter ?? null : null;
}

/**
 * 「알아서 고르기」(2026-10-21 시험 2): 검수 통과가 하나면 그것, 둘 이상이면 object-gen picker 를 옮긴 고르기 호출 한 번(picker.ts, 숫자 꼬리표 섞음).
 * 고르기 호출이 실패하거나 답을 못 읽으면 통과 첫 장으로 물러선다. 통과가 없으면 null(사람에게 넘긴다).
 */
/**
 * 에이전트 모드(코딩 에이전트가 MCP 로 부른 generate_missing_object): 카드를 기다리는 사람이 없으므로 그 자리에서 그리고 고르고 굽는다.
 * 검수 통과 후보는 3/4 관문 영수증도 받아야 한다(gate receipt) — 통과 후보가 없으면 굽지 않고 이유를 던진다.
 */
export async function drawAndBakeNow(request: ObjectGenRequest): Promise<WorkshopBakedDetail & { readonly reason: string; readonly seconds: number }> {
  const started = Date.now();
  const run = await startObjectGenRound(request, { gate: "receipt" });
  await run.session.engine.idle();
  await run.session.reload();
  const round = currentRound(run);
  const choice = await chooseAutoPick(run);
  if (!round || !choice) {
    const why = round?.runs.map((r) => `${r.letter}: ${r.status === "failed" ? r.error ?? "못 그림" : r.verdict ? `${r.verdict.verdict} ${r.verdict.reasons}`.trim() : r.status}`).join(" / ") ?? "판을 찾지 못했다";
    throw new Error(`「${request.title}」 검수를 통과한 후보가 없어 칩셋에 넣지 않았다 — ${why}`.slice(0, 600));
  }
  const baked = await bakeObjectGenRun(run, choice.letter, true, choice.reason);
  return { ...baked, reason: choice.reason, seconds: Math.round((Date.now() - started) / 1000) };
}

export async function chooseAutoPick(run: ObjectGenRun): Promise<{ letter: string; reason: string } | null> {
  const round = currentRound(run);
  if (!round) return null;
  const { session } = run;
  const item = session.items().find((candidate) => candidate.key === run.itemKey);
  if (!item) {
    const first = autoPickRun(round.runs);
    return first ? { letter: first.letter, reason: "검수 통과 첫 후보" } : null;
  }
  return chooseAutoPickFrom({
    runs: round.runs, item, palette: session.runner.palette(item), env: session.env, chat: createWorkshopChat(), objectGenFlow: Boolean(session.runner.review),
  });
}
