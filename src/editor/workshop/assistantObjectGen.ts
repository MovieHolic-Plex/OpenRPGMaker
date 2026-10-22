// src/editor/workshop/assistantObjectGen.ts
/**
 * 조수의 generate_missing_object 요청을 공방 실행기로 돈다(편집기 쪽 접착). 화면은 aiObjectGenCard.ts.
 * 새 기물 정의 → 공방 판(후보 그리기·검수, 사용자 자기 AI 계정) → 사용자가 고르거나 「알아서 고르기」 → 그 맵 칩셋에 굽기.
 * 공방 화면(workshopWorkspace)과 같은 세션·저장소를 쓰므로 판은 공방 「물건·가구」에서도 그대로 보인다.
 */
import { exemplarSheet, loadAnchors, ogPickerPrompt, ogStyleSetFor } from "@/harnesses/_core/workshop/objectGenFlow";
import { parsePicker, pickerMajority, pickerMessages, PICK_RUNS } from "@/harnesses/_core/workshop/picker";
import type { Rgba, RgbaImage, WorkshopItem, WorkshopRound } from "@/harnesses/_core/workshop/types";
import { store as projectStore } from "@/project/store";
import { createWorkshopChat } from "./chat";
import { mapObjectPalette } from "./mapObjectTarget";
import { autoPickRun, objectGenDefinition, type ObjectGenRequest } from "./objectRequest";
import { bakeWorkshopPick } from "./workshopBake";
import type { WorkshopBakedDetail } from "./workshopEvents";
import { getWorkshopSession, type WorkshopSession } from "./workshopSession";

/** 사용자가 카드에서 켜는 「알아서 고르기」 — 이 기기에 남는다. 기본은 꺼짐(사람이 고른다). */
export const OBJECT_GEN_AUTO_PICK_KEY = "oprn:assistant-objectgen-autopick";

export function objectGenAutoPick(): boolean {
  try { return localStorage.getItem(OBJECT_GEN_AUTO_PICK_KEY) === "1"; } catch { return false; }
}

export function setObjectGenAutoPick(on: boolean): void {
  try { localStorage.setItem(OBJECT_GEN_AUTO_PICK_KEY, on ? "1" : "0"); } catch { /* restricted storage */ }
}

export type ObjectGenRun = { readonly session: WorkshopSession; readonly itemKey: string; readonly roundId: string };

/** 요청을 새 기물로 정의하고 바로 판을 시작한다. 맵·칩셋이 사라졌거나 칩셋 그림을 못 읽으면 던진다. */
export async function startObjectGenRound(request: ObjectGenRequest): Promise<ObjectGenRun> {
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
  const round = await session.engine.startRound(item, noReference ? { reference: false } : {});
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
  const detail = bakeWorkshopPick(item, picked.grid, session.runner.palette(item), session.env, { autoPicked, gate: picked.gate ?? null });
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
/** object-gen 고르기 지시문·견본(실행기가 object-gen 흐름일 때). 견본을 못 읽으면 견본 없이. */
async function ogPickerExtras(item: WorkshopItem, session: ObjectGenRun["session"]): Promise<{ prompt: string; exemplars: RgbaImage | null; floor: Rgba }> {
  const floor: Rgba = [149, 107, 68, 255];
  try {
    const anchors = await loadAnchors(session.env, ogStyleSetFor(item));
    return { prompt: ogPickerPrompt(item), exemplars: exemplarSheet(anchors, floor, 8), floor };
  } catch {
    return { prompt: ogPickerPrompt(item), exemplars: null, floor };
  }
}

export async function chooseAutoPick(run: ObjectGenRun): Promise<{ letter: string; reason: string } | null> {
  const round = currentRound(run);
  if (!round) return null;
  const passed = round.runs.filter((r): r is typeof r & { grid: NonNullable<typeof r.grid> } => r.status === "done" && r.grid !== null && r.verdict?.verdict === "PASS");
  if (!passed.length) return null;
  const first = autoPickRun(round.runs);
  if (passed.length === 1 || !first) return { letter: passed[0]!.letter, reason: "검수 통과가 하나뿐" };
  const { session } = run;
  const item = session.items().find((candidate) => candidate.key === run.itemKey);
  if (!item) return { letter: first.letter, reason: "검수 통과 첫 후보" };
  // object-gen 흐름(원본 picker): 원본 지시문 + 견본 그림, 꼬리표를 매번 섞어 3번 묻고 다수결.
  const og = session.runner.review ? await ogPickerExtras(item, session) : undefined;
  const chat = createWorkshopChat();
  const votes: { letter: string; reason: string }[] = [];
  for (let i = 0; i < (og ? PICK_RUNS : 1); i++) {
    try {
      const board = pickerMessages(item, passed.map((r) => ({ letter: r.letter, grid: r.grid })), session.runner.palette(item), session.env, Math.random, og);
      const text = await chat("workshop-review", { messages: board.messages, response_format: { type: "json_object" }, temperature: 0.1 });
      const vote = parsePicker(text, board.labels);
      if (vote) votes.push(vote);
    } catch { /* 이 판은 빠진다 */ }
  }
  const win = og ? pickerMajority(votes) : votes[0] ? { ...votes[0], tally: "" } : null;
  if (win) return { letter: win.letter, reason: win.tally ? `${win.reason} (고르기 ${win.tally})` : win.reason };
  if (votes[0]) return { letter: votes[0].letter, reason: `${votes[0].reason} (고르기 의견이 갈려 첫 답)` };
  return { letter: first.letter, reason: "고르기 답을 못 받아 검수 통과 첫 후보" };
}
