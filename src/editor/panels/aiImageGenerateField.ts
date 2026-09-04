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
  readonly queue?: ImageGenerationQueue;
};

const KIND_PROMPT_PREFIX: Record<AiImageGenerateKind, string> = {
  picture: "",
  faceset: "2D JRPG portrait bust, front view, clean thick outline, flat saturated colors, no text. ",
  title: "2D JRPG title screen background art, wide landscape composition, no text, no logo. ",
  backdrop: "2D JRPG battle background art, wide landscape composition, no characters, no text. ",
  monster: "2D JRPG battle monster sprite, full body, centered, front view, clean thick outline, flat saturated colors, no text, no ground shadow. ",
};

const KIND_PLACEHOLDER: Record<AiImageGenerateKind, string> = {
  picture: "달빛 창가",
  faceset: "빨간 머리 소녀 검사",
  title: "달빛 호숫가 마을",
  backdrop: "불타는 화산 동굴",
  monster: "이빨 달린 푸른 슬라임",
};

export function aiImagePromptPrefix(kind: AiImageGenerateKind): string {
  return KIND_PROMPT_PREFIX[kind];
}

export function aiImagePlaceholder(kind: AiImageGenerateKind): string {
  return KIND_PLACEHOLDER[kind];
}

const handledDoneByQueue = new WeakMap<ImageGenerationQueue, Set<string>>();
const toastedErrorByQueue = new WeakMap<ImageGenerationQueue, Set<string>>();

function handledDone(queue: ImageGenerationQueue): Set<string> {
  let seen = handledDoneByQueue.get(queue);
  if (!seen) {
    seen = new Set();
    handledDoneByQueue.set(queue, seen);
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
  const queue = options.queue ?? createImageGenerationQueue();
  const done = handledDone(queue);
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

  queue.subscribe((snapshot) => {
    for (const job of snapshot.jobs) {
      if (job.status === "done" && job.result?.startsWith("data:image/") && !done.has(job.id)) {
        done.add(job.id);
        try {
          let resourceId = "";
          store.update(
            (draft) => {
              resourceId = insertGeneratedPictureAsset(draft, {
                name: job.label.slice(0, 40),
                dataUrl: job.result as string,
                kind: options.kind,
              });
            },
            { scope: "assets", label: "AI 그림 생성" },
          );
          options.onInserted(resourceId);
        } catch (error) {
          if (error instanceof ImageGenerationError || error instanceof GeneratedPictureError) {
            toast(error.message, "error");
          } else if (error instanceof Error) {
            toast(error.message, "error");
          } else {
            toast("그림을 만들지 못했습니다.", "error");
          }
        }
      }
      if (job.status === "error" && !errored.has(job.id)) {
        errored.add(job.id);
        toast(job.error ?? "그림을 만들지 못했습니다.", "error");
      }
    }
    renderList(snapshot);
  });
  renderList(queue.getSnapshot());

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

  return el("div", {
    class: "page3-resource-row ai-image-queue",
    dataset: { testid: `${prefix}-queue` },
    children: [
      el("div", { class: "page3-resource-row ai-image-queue-composer", children: [prompt, addButton] }),
      list,
    ],
  });
}
