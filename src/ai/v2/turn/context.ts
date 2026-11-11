// 한 턴의 문맥 — 세션·할 일 목록·바뀌는 상태·판정자 장부를 한 객체로 만든다(앞 턴의 할 일과 화면 검수 장부를 이어 받는 것까지). 2026-11-11 리팩토링 R3: scripts/lib/assistantV2Runtime.ts 의 runAssistantV2 머리에서 옮겼다.
import type { Project } from "../../../project/types";
import type { PiAgentEvent, PiAgentRequest } from "../../piAgent/protocol";
import { V2Session } from "./session";
import { type VqaReviewerPick, type VqaRound, type VqaShot } from "../judge/vqa";
import { loadVqaBook } from "./vqaItems";
import { carryOver } from "./carryOver";
import type { PiAssistantV2Env } from "../shared/env";
import { type AdvisorToolCall, type AdvisorVerdict } from "../judge/advisor";
import { CONTINUE_WORDS, isWriteRequest } from "../request/readers";
import { type V2ToolExposure } from "../toolExposure";
import { changedSince, indexProject } from "../loop/refs";
import { vqaEnabled } from "./support";
import { loadPlaces } from "../tools/placeMemory";

/** 실행기가 넘기는 것 가운데 턴 정책이 쓰는 것 — 사용자 화면으로 가는 이벤트와 중단 신호. */
export interface TurnOptions {
  readonly onEvent?: (event: PiAgentEvent) => void;
  readonly signal?: AbortSignal;
}
/** Node 쪽 일(PNG 해독·조명 입히기)은 실행기에 남는다 — 턴 정책에는 이 구멍으로만 넘어온다. */
export interface TurnIo {
  readonly captureVqaShots: (env: PiAssistantV2Env) => Promise<{ shots: VqaShot[]; failed: string[] }>;
}

/** 턴마다 한 번 만든다. 돌려주는 객체가 이 턴의 유일한 상태 주인이다 — turn/*.ts 의 조각들은 이것을 받아 같은 state·store 를 읽고 쓴다. */
export function createTurnContext(request: PiAgentRequest, options: TurnOptions, io: TurnIo) {
  const session = new V2Session();
  const store = session.todo;
  const started = Date.now();
  /** 이 턴 동안 바뀌는 상태 — 판정자들이 같이 읽고 쓴다. 칸마다 주인은 이 객체 하나다(지역 let 을 여기로 모았다). */
  const state = {
    baselineKeys: undefined as Set<string> | undefined,
    draft: "",
    liveEnv: undefined as PiAssistantV2Env | undefined,
    advice: undefined as AdvisorVerdict | undefined,
    vqaCandidates: undefined as VqaReviewerPick[] | undefined,
    vqaCandidateIndex: 0,
    vqaMs: 0,
    vqaReviewedFingerprint: undefined as string | undefined,
    autoBuilt: false,
    noTodoKicks: 0,
    forcedSig: "",
    forcedCalls: 0,
    textStops: 0,
    loopStop: undefined as string | undefined,
    advisorRuns: 0,
    vqaDone: !vqaEnabled(request),
    pendingBrief: undefined as string | undefined,
    freshNext: false,
    reinjections: 0,
    skeletonShown: false,
    changedNow: undefined as ReturnType<typeof changedSince> | undefined,
    exposure: undefined as V2ToolExposure | undefined,
    leadPlan: undefined as string | undefined,
    leadReviews: 0,
  };
  // 판정 기준선 — 「만들어 달라」 항목(fresh)은 이 시점에 원래 있던 것으로는 ✓ 가 나지 않는다.
  try { store.baseline = indexProject(request.project as Project); } catch { store.baseline = undefined; }
  // 앞 실행의 할 일(project.assistantTodo)을 «계속» 요청에서 되살린다. 막힌 항목은 막힌 채로 온다 — 대상이 바뀌었거나 요청이 짚은 것만 다시 연다(turn/carryOver.ts).
  // 판정자 기억(화면 검수 장부)은 목록을 이어 받지 않는 턴에도 읽는다.
  const priorTodo = (request.project as { assistantTodo?: unknown }).assistantTodo;
  store.loadMemory(priorTodo);
  // 앞 턴이 지은 장소의 설계 — 맵이 그대로일 때만 이어 받는다(다음 턴의 edit_place 가 그 설계에서 고친다, tools/placeMemory.ts).
  const carriedPlaces = loadPlaces(store.memory.places, session, request.project as Project, store.baseline);
  if (carriedPlaces.restored || carriedPlaces.stale) options.onEvent?.({ type: "execution_status", name: "v2.places.restore", ok: true, at: Date.now(), summary: `앞 턴의 장소 설계 ${carriedPlaces.restored}곳을 이어 받음${carriedPlaces.stale ? ` · ${carriedPlaces.stale}곳은 맵이 조수 밖에서 바뀌어 버림` : ""}`, data: carriedPlaces });
  if (CONTINUE_WORDS.test(request.task) && store.restore(priorTodo, carryOver(request.task, request.project as Project, store.baseline ?? { maps: new Map(), events: new Map(), items: new Map(), troops: new Map() }))) {
    const c = store.counts();
    options.onEvent?.({ type: "execution_status", name: "v2.todo.restore", ok: true, at: Date.now(), summary: `앞 실행의 할 일을 이어 받음 — ${c.open}개 열림 · ${c.blocked}개는 막힌 채(다시 다투지 않음)`, data: { list: store.view() } });
  }
  // 시작 저장본에 이미 있던 게임 검사 문제(기존 결함) — 관문 항목으로 만들지 않고 보고에만 싣는다. 처음 관문을 볼 때 한 번 잰다.
  const preexisting = new Map<string, string>();
  // 검토자의 재료: 이 실행의 도구 기록과 마지막 보고 초안. 사용자 화면으로 가는 이벤트를 그대로 흘려보내며 옆에서 모은다.
  const calls: AdvisorToolCall[] = [];
  const argsById = new Map<string, unknown>();
  // 화면 검수 상태 — 판 기록·검수자 후보·결함 ↔ 할 일 항목.
  const vqaRounds: VqaRound[] = [];
  /** 화면 검수 장부 — 앞 턴부터 본 결함과 그 할 일 항목(src/ai/v2/turn/vqaItems.ts). 마지막으로 검수한 프로젝트 지문도 이어 받는다. */
  const { book: vqaBook, reviewedFp: carriedVqaFp } = loadVqaBook(store.memory.vqa, store);
  state.vqaReviewedFingerprint = carriedVqaFp;
  // ── 할 일 고리 ───────────────────────────────────────────────────────────────────────────
  // 모델이 멈출 때마다(afterMain) 순서대로: ① 기계 확인 다시(끝난 항목이 ✗ 면 다시 연다) → ② 열린 항목이 있으면 재주입(상한·진척 규칙)
  // → ③ 끝맺음 자동 짓기(한 번, 결정적) → ④ 끝맺음 관문 문제를 gate·critic 항목으로 → ⑤ 독립 검토자 막음을 critic 항목으로
  // → ⑥ 화면 검수 결함을 vqa 항목으로(게임 전체 요청만). ④~⑥ 이 항목을 덧붙이면 같은 고리로 ② 부터 다시. 아무것도 없으면 끝 — 최종 보고는 기계 표.
  const autoNotes: string[] = [];
  const advisorItems = new Set<string>();
  const writeRequest = isWriteRequest(request);
  /** 이 실행에 노출한 동사·도구 이름 — 관문 항목이 이르는 도구가 없으면 그 항목은 돌리지 않는다. */
  const toolNames = new Set<string>();
  // 청사진 자동 짓기(장소 → 경로 → 출구·이동 칸 마감 → 조립 기본값). 한 실행에 한 번씩(세션 깃발) + 늦게 생긴 청사진.
  /** 함수 마감(autoBuild)만 건드린 기존 이벤트 — 「mapId:eventId」 → 마감 직후 지문. 관문 문제가 이런 이벤트만 짚으면 요청 밖 기존 결함이다. */
  const autoTouched = new Map<string, string>();
  // 리드·워커 나누기(OPRN_V2_SPLIT, src/ai/v2/turn/split.ts) — 리드 계획 글과 검토 상태.
  const leadItems = new Set<string>();
  return { request, options, io, session, store, started, state, preexisting, calls, argsById, vqaRounds, vqaBook, carriedVqaFp, autoNotes, advisorItems, writeRequest, toolNames, autoTouched, leadItems };
}

export type TurnContext = ReturnType<typeof createTurnContext>;
