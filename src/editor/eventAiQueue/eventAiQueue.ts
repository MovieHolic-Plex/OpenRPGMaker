// editor/eventAiQueue/eventAiQueue.ts
// AI 이벤트 작업함 — 맵 칸마다 "무엇을 하는 이벤트"를 한 줄씩 남기면 여러 개가 동시에 만들어지고,
// 끝난 것부터 사람이 확인해 배치한다.
//
// 왜 채팅 조수 세션을 빌리지 않는가 (실측, 2026-09-28):
// 예전 우클릭 「AI 로 이벤트 만들기」는 편집기를 열고 채팅 패널의 세션 하나에 메시지를 보냈다.
// 그 세션은 한 번에 한 턴만 돌고(turnBusy 면 "조수의 진행 중인 작업을 먼저 마무리하세요"),
// 초안도 pendingProposal 하나만 보관한다. 그래서 이벤트 수십 개를 부탁하는 흐름이 구조적으로 불가능했다.
// 여기서는 작업마다 자기 생성 호출(runEventDraftAuthoring)을 갖고, 동시 실행 수만 전역으로 제한한다.
//
// 충돌을 피하는 규칙:
//  - 결과는 프로젝트 사본이 아니라 **이벤트 한 개** 조각이다. 20개를 따로 만들어도 배치할 때 서로를 덮지 않는다.
//  - 상태 기억은 이벤트 전용인 셀프 스위치만 쓰게 한다(생성기 프롬프트). 전역 스위치 번호가 겹치지 않는다.
//  - 배치 직전에 그 칸이 여전히 비었는지 다시 본다. 사람이 그 사이 이벤트를 놓았으면 배치하지 않는다.
//  - 배치 한 번 = 되돌리기 한 칸(맵 스냅샷). 다른 작업의 결과는 되돌리기에 딸려 가지 않는다.

import { runEventDraftAuthoring, type EventDraft, type EventDraftRequest } from "@/ai/eventDraftAuthoring";
import { conversationScopeKey } from "@/ai/conversationStore";
import { loadAiConfig, type AiConfig } from "@/ai/llmClient";
import { isAssistantEndpointReady } from "@/ai/assistantEndpoint";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { eventAtPoint } from "@/project/eventFootprintQuery";
import { store } from "@/project/store";
import type { GameEvent, MapId, Project } from "@/project/types";
import { genId } from "@/util/id";

export type EventAiJobState = "queued" | "running" | "ready" | "failed" | "placed";

export interface EventAiJob {
  readonly id: number;
  readonly mapId: MapId;
  readonly x: number;
  readonly y: number;
  prompt: string;
  state: EventAiJobState;
  /** 진행 중 단계 문구. 사람이 읽는 한 줄. */
  stage: string;
  draft: EventDraft | null;
  /** 배치된 이벤트 id. 되돌리기로 사라지면 작업함은 다시 확인 대기로 돌리지 않는다(이미 사람 결정). */
  placedEventId: string | null;
  error: string | null;
  attempts: number;
  readonly createdAt: number;
}

export interface EventAiQueueSettings {
  concurrency: number;
  /** 검사 통과(생성 성공) 즉시 배치한다. 켜면 확인을 건너뛴다. */
  autoPlace: boolean;
}

export interface EventAiQueueDeps {
  readonly getProject: () => Project;
  readonly loadConfig: () => AiConfig;
  readonly generate: typeof runEventDraftAuthoring;
  readonly place: (job: EventAiJob, draft: EventDraft) => string | null;
}

type Listener = () => void;

const DEFAULT_CONCURRENCY = 4;
export const EVENT_AI_QUEUE_MAX_CONCURRENCY = 8;

function placeDraftInStore(job: EventAiJob, draft: EventDraft): string | null {
  const project = store.getCurrent();
  const map = project.maps[job.mapId];
  if (!map || eventAtPoint(map, job.x, job.y)) return null;
  const event: GameEvent = {
    ...structuredClone(draft.event),
    id: genId("ev"),
    x: job.x,
    y: job.y,
    pages: (draft.event.pages ?? []).map((page) => ({ ...structuredClone(page), id: genId("page") })),
  };
  recordProjectSnapshot("AI 이벤트 배치: " + draft.title, job.mapId, { kind: "map", mapId: job.mapId });
  store.update((next) => {
    next.maps[job.mapId]?.events.push(event);
  }, { scope: "map", mapId: job.mapId, eventId: event.id, label: "AI 이벤트 배치: " + draft.title, origin: "ai" });
  const landed = store.getCurrent().maps[job.mapId]?.events.some((entry) => entry.id === event.id);
  return landed ? event.id : null;
}

const defaultDeps: EventAiQueueDeps = {
  getProject: () => store.getCurrent(),
  loadConfig: () => loadAiConfig(),
  generate: runEventDraftAuthoring,
  place: placeDraftInStore,
};

export class EventAiQueue {
  private readonly jobs: EventAiJob[] = [];
  private readonly controllers = new Map<number, AbortController>();
  private readonly listeners = new Set<Listener>();
  private seq = 0;
  readonly settings: EventAiQueueSettings = { concurrency: DEFAULT_CONCURRENCY, autoPlace: false };

  constructor(private readonly deps: EventAiQueueDeps = defaultDeps) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list(): readonly EventAiJob[] {
    return this.jobs;
  }

  get(id: number): EventAiJob | undefined {
    return this.jobs.find((job) => job.id === id);
  }

  /** 그 칸의 살아 있는 작업(배치됨 포함). 같은 칸에 두 번 부탁하지 않게 한다. */
  jobAt(mapId: MapId, x: number, y: number): EventAiJob | undefined {
    return this.jobs.find((job) => job.mapId === mapId && job.x === x && job.y === y);
  }

  counts(): Readonly<Record<EventAiJobState, number>> {
    const counts: Record<EventAiJobState, number> = { queued: 0, running: 0, ready: 0, failed: 0, placed: 0 };
    for (const job of this.jobs) counts[job.state] += 1;
    return counts;
  }

  configReady(): boolean {
    return isAssistantEndpointReady(this.deps.loadConfig());
  }

  /** 칸에 부탁을 남긴다. 이미 이벤트가 있거나 작업이 있으면 null. */
  enqueue(mapId: MapId, x: number, y: number, prompt: string): EventAiJob | null {
    const text = prompt.trim();
    if (!text) return null;
    const map = this.deps.getProject().maps[mapId];
    if (!map || x < 0 || y < 0 || x >= map.width || y >= map.height) return null;
    if (eventAtPoint(map, x, y) || this.jobAt(mapId, x, y)) return null;
    const job: EventAiJob = {
      id: ++this.seq, mapId, x, y, prompt: text, state: "queued", stage: "앞선 작업을 기다리는 중",
      draft: null, placedEventId: null, error: null, attempts: 0, createdAt: Date.now(),
    };
    this.jobs.push(job);
    this.pump();
    this.emit();
    return job;
  }

  setConcurrency(value: number): void {
    this.settings.concurrency = Math.max(1, Math.min(EVENT_AI_QUEUE_MAX_CONCURRENCY, Math.round(value)));
    this.pump();
    this.emit();
  }

  setAutoPlace(value: boolean): void {
    this.settings.autoPlace = value;
    if (value) for (const job of this.jobs) if (job.state === "ready") this.placeJob(job);
    this.emit();
  }

  /** 확인 대기 작업을 배치한다. 칸이 그새 찼으면 실패로 돌린다. */
  place(id: number): boolean {
    const job = this.get(id);
    if (!job || job.state !== "ready") return false;
    const ok = this.placeJob(job);
    this.emit();
    return ok;
  }

  placeAllReady(): number {
    let placed = 0;
    for (const job of this.jobs) if (job.state === "ready" && this.placeJob(job)) placed += 1;
    this.emit();
    return placed;
  }

  /** 같은 문장으로(또는 고친 문장으로) 다시 만든다. */
  retry(id: number, prompt?: string): void {
    const job = this.get(id);
    if (!job || job.state === "placed") return;
    this.controllers.get(id)?.abort();
    this.controllers.delete(id);
    if (prompt?.trim()) job.prompt = prompt.trim();
    job.state = "queued";
    job.stage = "앞선 작업을 기다리는 중";
    job.draft = null;
    job.error = null;
    this.pump();
    this.emit();
  }

  /** 작업을 버린다. 진행 중이면 호출을 끊는다. 배치된 이벤트는 건드리지 않는다(되돌리기는 Ctrl+Z). */
  discard(id: number): void {
    const index = this.jobs.findIndex((job) => job.id === id);
    if (index < 0) return;
    this.controllers.get(id)?.abort();
    this.controllers.delete(id);
    this.jobs.splice(index, 1);
    this.pump();
    this.emit();
  }

  /** 배치된 작업을 목록에서 치운다. */
  clearPlaced(): void {
    for (let index = this.jobs.length - 1; index >= 0; index -= 1) {
      if (this.jobs[index]!.state === "placed") this.jobs.splice(index, 1);
    }
    this.emit();
  }

  /** 프로젝트가 바뀌면 전부 버린다 — 다른 프로젝트의 칸에 배치되면 안 된다. */
  reset(): void {
    for (const controller of this.controllers.values()) controller.abort();
    this.controllers.clear();
    this.jobs.length = 0;
    this.emit();
  }

  private placeJob(job: EventAiJob): boolean {
    if (!job.draft) return false;
    const eventId = this.deps.place(job, job.draft);
    if (!eventId) {
      job.state = "failed";
      job.error = "그 칸에 이미 이벤트가 있어 배치하지 않았어요.";
      return false;
    }
    job.state = "placed";
    job.placedEventId = eventId;
    job.stage = "";
    return true;
  }

  private pump(): void {
    let running = this.jobs.filter((job) => job.state === "running").length;
    for (const job of this.jobs) {
      if (running >= this.settings.concurrency) break;
      if (job.state !== "queued") continue;
      running += 1;
      void this.run(job);
    }
  }

  private async run(job: EventAiJob): Promise<void> {
    const controller = new AbortController();
    this.controllers.set(job.id, controller);
    job.state = "running";
    job.stage = "맵과 데이터베이스를 확인하는 중";
    this.emit();
    const project = this.deps.getProject();
    const request: EventDraftRequest = { project, mapId: job.mapId, x: job.x, y: job.y, prompt: job.prompt };
    try {
      const identity = store.getProjectIdentity();
      const result = await this.deps.generate({
        config: this.deps.loadConfig(),
        request,
        signal: controller.signal,
        projectScopeKey: conversationScopeKey(identity, project),
      });
      if (controller.signal.aborted || this.controllers.get(job.id) !== controller) return;
      job.draft = result;
      job.attempts = result.attempts;
      job.stage = "";
      job.state = "ready";
      if (this.settings.autoPlace) this.placeJob(job);
    } catch (cause) {
      if (controller.signal.aborted || this.controllers.get(job.id) !== controller) return;
      job.state = "failed";
      job.stage = "";
      job.error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      if (this.controllers.get(job.id) === controller) this.controllers.delete(job.id);
      this.pump();
      this.emit();
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

export const eventAiQueue = new EventAiQueue();

let projectWatch: (() => void) | null = null;
/** 프로젝트 교체를 지켜보다 작업함을 비운다. 편집기 부팅에서 한 번 부른다. */
export function watchEventAiQueueProject(): void {
  if (projectWatch) return;
  projectWatch = store.subscribe((_project, change) => {
    if (change.projectSwitch === true) eventAiQueue.reset();
  });
}
