import type { ImageJobDestination } from "@/ai/jobs/imagePayload";
import type { GeneratedPictureKind } from "@/editor/generatedPictureAsset";
import { allocateImageResourceId, submitImageJob } from "@/editor/aiJobs/submitImageJob";
import { jobSubmitMessage } from "@/editor/aiJobs/jobSubmitError";
import { randomUuid } from "@/util/id";
import { el } from "@/util/dom";
import { toast } from "@/util/toast";

export type AiImageGenerateKind = GeneratedPictureKind;

export type AiImageGenerateFieldOptions = {
  readonly kind: AiImageGenerateKind;
  readonly placeholder?: string;
  readonly buttonLabel?: string;
  readonly testidPrefix?: string;
  readonly destination: ImageJobDestination | (() => ImageJobDestination | Promise<ImageJobDestination>);
  readonly queueKey?: string;
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

type FrozenImageSubmission = {
  readonly key: string;
  readonly resourceId: string;
  readonly prompt: string;
  readonly name: string;
  readonly destination: ImageJobDestination;
};

const frozenByOwner = new WeakMap<object, FrozenImageSubmission>();

export function aiImagePromptPrefix(kind: AiImageGenerateKind): string {
  return KIND_PROMPT_PREFIX[kind];
}

export function aiImagePlaceholder(kind: AiImageGenerateKind): string {
  return KIND_PLACEHOLDER[kind];
}

export function aiImageGenerateField(options: AiImageGenerateFieldOptions): HTMLElement {
  const prefix = options.testidPrefix ?? "ai-image-generate";
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
  const status = el("p", {
    class: "ai-image-queue-empty",
    text: "프롬프트를 입력하면 작업함에 맡깁니다. 칸을 닫아도 작업은 이어집니다.",
    dataset: { testid: `${prefix}-queue-status` },
  });
  const owner = { key: options.queueKey ?? `${prefix}:${options.kind}` };
  addButton.addEventListener("click", () => {
    const text = prompt.value.trim();
    if (!text) return;
    const destinationOrPromise = typeof options.destination === "function" ? options.destination() : options.destination;
    void Promise.resolve(destinationOrPromise).then(async destination => {
      const fullPrompt = `${KIND_PROMPT_PREFIX[options.kind]}${text}`;
      const name = text.slice(0, 40);
      const existing = frozenByOwner.get(owner);
      const reuse = existing !== undefined
        && existing.prompt === fullPrompt
        && existing.name === name
        && JSON.stringify(existing.destination) === JSON.stringify(destination);
      const frozen: FrozenImageSubmission = reuse && existing
        ? existing
        : {
          key: randomUuid(),
          resourceId: allocateImageResourceId(options.kind),
          prompt: fullPrompt,
          name,
          destination,
        };
      frozenByOwner.set(owner, frozen);
      try {
        const receipt = await submitImageJob({
          kind: options.kind,
          prompt: frozen.prompt,
          name: frozen.name,
          destination: frozen.destination,
          resourceId: frozen.resourceId,
        }, { idempotencyKey: frozen.key });
        frozenByOwner.delete(owner);
        prompt.value = "";
        status.textContent = `작업함에 맡겼습니다 · ${receipt.job.id}`;
        status.dataset.jobId = receipt.job.id;
        status.dataset.resourceId = frozen.resourceId;
      } catch (error) {
        toast(jobSubmitMessage(error), "error");
      }
    });
  });
  return el("div", {
    class: "page3-resource-row ai-image-queue",
    dataset: { testid: `${prefix}-queue` },
    children: [
      el("div", { class: "page3-resource-row ai-image-queue-composer", children: [prompt, addButton] }),
      status,
    ],
  });
}
