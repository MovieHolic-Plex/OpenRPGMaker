import { generateAiImage, ImageGenerationError } from "@/ai/imageGenerationClient";
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

export function aiImageGenerateField(options: AiImageGenerateFieldOptions): HTMLElement {
  const prefix = options.testidPrefix ?? "ai-image-generate";
  const prompt = el("input", {
    attrs: { type: "text", placeholder: options.placeholder ?? KIND_PLACEHOLDER[options.kind] },
    dataset: { testid: `${prefix}-prompt` },
  });
  const button = el("button", {
    class: "btn",
    text: options.buttonLabel ?? "AI로 만들기",
    attrs: { type: "button" },
    dataset: { testid: `${prefix}-generate` },
  });

  const run = async (): Promise<void> => {
    const text = prompt.value.trim();
    if (!text) return;
    button.setAttribute("disabled", "true");
    try {
      const image = await generateAiImage({ prompt: `${KIND_PROMPT_PREFIX[options.kind]}${text}` });
      let resourceId = "";
      store.update(
        (draft) => {
          resourceId = insertGeneratedPictureAsset(draft, {
            name: text.slice(0, 40),
            dataUrl: image.dataUrl,
            kind: options.kind,
          });
        },
        { scope: "assets", label: "AI 그림 생성" },
      );
      options.onInserted(resourceId);
    } catch (error) {
      if (error instanceof ImageGenerationError || error instanceof GeneratedPictureError) {
        toast(error.message, "error");
        return;
      }
      if (error instanceof Error) {
        toast(error.message, "error");
        return;
      }
      toast("그림을 만들지 못했습니다.", "error");
    } finally {
      button.removeAttribute("disabled");
    }
  };

  button.addEventListener("click", () => {
    void run();
  });

  return el("div", {
    class: "page3-resource-row",
    children: [prompt, button],
  });
}
