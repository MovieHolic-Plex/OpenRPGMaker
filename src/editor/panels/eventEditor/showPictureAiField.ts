import { aiImageGenerateField } from "@/editor/panels/aiImageGenerateField";
import type { ImageJobDestination } from "@/ai/jobs/imagePayload";

export type ShowPictureAiFieldOptions = {
  readonly destination: ImageJobDestination | (() => ImageJobDestination | Promise<ImageJobDestination>);
  readonly queueKey?: string;
};

export function showPictureAiField(options: ShowPictureAiFieldOptions): HTMLElement {
  return aiImageGenerateField({
    kind: "picture",
    testidPrefix: "show-picture-ai",
    ...(options.queueKey ? { queueKey: options.queueKey } : {}),
    destination: options.destination,
  });
}
