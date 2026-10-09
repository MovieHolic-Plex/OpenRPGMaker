import { ImageGenerationError } from "@/ai/imageGenerationClient";
import {
  createImageGenerationQueue,
  type ImageGenerationQueue,
  type ImageQueueJob,
  type ImageQueueSnapshot,
} from "@/ai/imageGenerationQueue";
import {
  GeneratedPictureError,
  type GeneratedPictureKind,
  insertGeneratedPictureAsset,
} from "@/editor/generatedPictureAsset";
import { store } from "@/project/store";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

export type AiImageGenerateKind = GeneratedPictureKind;

export type AiImageGenerateFieldOptions = {
  readonly kind: AiImageGenerateKind;
  readonly placeholder?: string;
  readonly buttonLabel?: string;
  readonly testidPrefix?: string;
  readonly onInserted: (resourceId: string) => void;
  /** 위젯 수명 동안 공유할 큐. 호출부가 record.id/context.path 등 안정 키로
   *  들고 있는다. 없으면 컴포저(testidPrefix+kind)별 모듈 공유 큐를 쓴다. */
  readonly queue?: ImageGenerationQueue;
  readonly queueKey?: string;
};

const KIND_PROMPT_PREFIX: Record<AiImageGenerateKind, string> = {
  picture: "",
  faceset: "2D JRPG portrait bust, front view, clean thick outline, flat saturated colors, no text. ",
  title: "2D JRPG title screen background art, wide landscape composition, no text, no logo. ",
  backdrop: "2D JRPG battle background art, wide landscape composition, no characters, no text. ",
};

const KIND_PLACEHOLDER: Record<AiImageGenerateKind, string> = {
  picture: "달빛 창가",
  faceset: "빨간 머리 소녀 검사",
  title: "달빛 호숫가 마을",
  backdrop: "불타는 화산 동굴",
};

export function aiImagePromptPrefix(kind: AiImageGenerateKind): string {
  return KIND_PROMPT_PREFIX[kind];
}

export function aiImagePlaceholder(kind: AiImageGenerateKind): string {
  return KIND_PLACEHOLDER[kind];
}

const insertedResourceByQueue = new WeakMap<ImageGenerationQueue, Map<string, string>>();
const toastedErrorByQueue = new WeakMap<ImageGenerationQueue, Set<string>>();
const queuesByHost = new WeakMap<object, Map<string, ImageGenerationQueue>>();

function insertedResources(queue: ImageGenerationQueue): Map<string, string> {
  let seen = insertedResourceByQueue.get(queue);
  if (!seen) {
    seen = new Map();
    insertedResourceByQueue.set(queue, seen);
  }
  return seen;
}

function toastedError(queue: ImageGenerationQueue): Set<string> {
  let seen = toastedErrorByQueue.get(queue);
  if (!seen) {
    seen = new Set();
    toastedErrorByQueue.set(queue, seen);
  }
  return seen;
}

function sharedQueueMap(): Map<string, ImageGenerationQueue> | null {
  const host = typeof document !== "undefined" ? document.body : null;
  if (!host) return null;
  let map = queuesByHost.get(host);
  if (!map) {
    map = new Map();
    queuesByHost.set(host, map);
  }
  return map;
}

function resolveQueue(options: AiImageGenerateFieldOptions): ImageGenerationQueue {
  if (options.queue) return options.queue;
  const key = options.queueKey ?? `${options.testidPrefix ?? "ai-image-generate"}:${options.kind}`;
  const map = sharedQueueMap();
  if (!map) return createImageGenerationQueue();
  let queue = map.get(key);
  if (!queue) {
    queue = createImageGenerationQueue();
    map.set(key, queue);
  }
  return queue;
}

function statusText(job: ImageQueueJob): string {
  switch (job.status) {
    case "queued":
      return "대기 중";
    case "running":
      return "만드는 중…";
    case "done":
      return "완료";
    case "cancelled":
      return "취소됨";
    case "error":
      return job.error ? `실패 — ${job.error}` : "실패";
  }
}

export function aiImageGenerateField(options: AiImageGenerateFieldOptions): HTMLElement {
  const prefix = options.testidPrefix ?? "ai-image-generate";
  const queue = resolveQueue(options);
  const inserted = insertedResources(queue);
  const errored = toastedError(queue);

  const prompt = el("input", {
    attrs: { type: "text", placeholder: options.placeholder ?? KIND_PLACEHOLDER[options.kind] },
    dataset: { testid: `${prefix}-prompt` },
  });
  const addButton = el("button", {
    class: "btn",
    text: options.buttonLabel ?? "AI로 만들기",
    attrs: { type: "button" },
    dataset: { testid: `${prefix}-generate` },
  });

  const list = el("div", {
    class: "ai-image-queue-list",
    dataset: { testid: `${prefix}-queue-list` },
  });

  function jobRow(job: ImageQueueJob): HTMLElement {
    const row = el("li", {
      class: `ai-image-queue-item is-${job.status}`,
      dataset: { testid: `${prefix}-queue-item`, jobId: job.id, jobStatus: job.status },
      children: [
        el("span", { class: "ai-image-queue-label", text: job.label }),
        el("span", { class: "ai-image-queue-status", text: statusText(job) }),
      ],
    });
    if (job.status === "queued" || job.status === "running") {
      row.append(
        el("button", {
          class: "ai-image-queue-cancel",
          text: "취소",
          attrs: { type: "button" },
          dataset: { testid: `${prefix}-queue-cancel`, jobId: job.id },
          on: {
            click: () => {
              queue.cancel(job.id);
            },
          },
        }),
      );
    }
    if (job.status === "error" || job.status === "cancelled") {
      row.append(
        el("button", {
          class: "ai-image-queue-retry",
          text: "다시 시도",
          attrs: { type: "button" },
          dataset: { testid: `${prefix}-queue-retry`, jobId: job.id },
          on: {
            click: () => {
              queue.retry(job.id);
            },
          },
        }),
      );
    }
    return row;
  }

  function renderList(snapshot: ImageQueueSnapshot): void {
    while (list.firstChild) list.firstChild.remove();
    if (snapshot.jobs.length === 0) {
      list.append(el("p", { class: "ai-image-queue-empty", text: "프롬프트를 입력하면 여기에 쌓입니다. 만드는 동안에도 계속 추가할 수 있습니다." }));
      return;
    }
    const head = el("div", {
      class: "ai-image-queue-head",
      children: [
        el("span", {
          class: "ai-image-queue-count",
          text: snapshot.running > 0 ? `만드는 중 ${snapshot.running} · 대기 ${snapshot.queued}` : `대기 ${snapshot.queued}`,
          dataset: { testid: `${prefix}-queue-count` },
        }),
      ],
    });
    if (snapshot.jobs.some((job) => job.status === "done" || job.status === "cancelled")) {
      head.append(
        el("button", {
          class: "ai-image-queue-clear",
          text: "끝난 항목 지우기",
          attrs: { type: "button" },
          dataset: { testid: `${prefix}-queue-clear` },
          on: {
            click: () => {
              queue.clearFinished();
            },
          },
        }),
      );
    }
    list.append(head);
    list.append(el("ul", { class: "ai-image-queue-items", children: snapshot.jobs.map(jobRow) }));
  }

  // handleSnapshot 보다 먼저 선언한다 — 초기 스캔 호출이 이 const 보다 뒤에
  // 있어야 TDZ(Cannot access before initialization)에 걸리지 않는다.
  const nodeRef: { host: HTMLElement | null } = { host: null };
  const notifiedLocal = new Set<string>();
  function handleSnapshot(snapshot: ImageQueueSnapshot): void {
    // 이미 떨어진 노드에는 그리지 않는다 — 오래된 구독이 늦게 깨어나도 DOM 을
    // 건드리지 않고 구독을 끊는다. root 는 아래에서 선언되므로 함수 호출 시점에 읽는다.
    const host = nodeRef.host as (HTMLElement & { readonly isConnected?: boolean }) | null;
    if (host && typeof document !== "undefined" && document.body && host.isConnected === false) {
      release();
      return;
    }
    for (const job of snapshot.jobs) {
      if (job.status === "done" && job.result?.startsWith("data:image/") && !notifiedLocal.has(job.id)) {
        notifiedLocal.add(job.id);
        // 에셋 등록·onInserted 는 이 큐에서 이 작업을 처음 본 구독자만 한다.
        // 리마운트된 필드는 이미 등록된 id 를 보고 건너뛰어 폼 재생성 루프를 막는다.
        // 구독자가 없을 때 끝난 작업은 새 필드의 초기 스캔이 여기서 집어 올린다.
        if (!inserted.has(job.id)) {
          // 예약을 store.update 보다 먼저 둔다. update 는 동기 emit 이라 이벤트
          // 에디터가 리마운트한 새 필드의 초기 스캔이 같은 작업을 다시 등록하는
          // 재진입을 이 한 줄이 막는다. 실패하면 예약을 걷어 다음 notify 가 재시도한다.
          inserted.set(job.id, "");
          try {
            let created = "";
            store.update(
              (draft) => {
                created = insertGeneratedPictureAsset(draft, {
                  name: job.label.slice(0, 40),
                  dataUrl: job.result as string,
                  kind: options.kind,
                });
              },
              { scope: "assets", label: "AI 그림 생성" },
            );
            inserted.set(job.id, created);
            options.onInserted(created);
          } catch (error) {
            inserted.delete(job.id);
            if (error instanceof ImageGenerationError || error instanceof GeneratedPictureError) {
              toast(error.message, "error");
            } else if (error instanceof Error) {
              toast(error.message, "error");
            } else {
              toast("그림을 만들지 못했습니다.", "error");
            }
          }
        }
      }
      if (job.status === "error" && !errored.has(job.id)) {
        errored.add(job.id);
        toast(job.error ?? "그림을 만들지 못했습니다.", "error");
      }
    }
    renderList(snapshot);
  }
  const unsubscribe = queue.subscribe(handleSnapshot);
  let released = false;
  function release(): void {
    if (released) return;
    released = true;
    unsubscribe();
  }
  handleSnapshot(queue.getSnapshot());

  addButton.addEventListener("click", () => {
    const text = prompt.value.trim();
    if (!text) return;
    try {
      queue.enqueue({
        prompt: `${KIND_PROMPT_PREFIX[options.kind]}${text}`,
        label: text.slice(0, 40),
        kind: options.kind,
      });
    } catch (error) {
      toast(error instanceof Error ? error.message : "그림을 만들지 못했습니다.", "error");
      return;
    }
    prompt.value = "";
  });

  const root = el("div", {
    class: "page3-resource-row ai-image-queue",
    dataset: { testid: `${prefix}-queue` },
    children: [
      el("div", { class: "page3-resource-row ai-image-queue-composer", children: [prompt, addButton] }),
      list,
    ],
  });
  // 떨어진 노드의 구독을 끊는다. 폼 리렌더가 replaceChildren 으로 이 노드를
  // 걷어내면 다음 notify 때 해제된다 — 별도 unmount 훅이 없는 구조에서의 안전망.
  const connectedOf = root as HTMLElement & { readonly isConnected?: boolean };
  const observer = typeof MutationObserver === "undefined"
    ? null
    : new MutationObserver(() => {
        if (connectedOf.isConnected === false) {
          release();
          observer?.disconnect();
        }
      });
  nodeRef.host = root;
  if (observer && typeof document !== "undefined" && document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
  return root;
}
