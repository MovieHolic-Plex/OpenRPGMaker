import { aiImageGenerateField } from "@/editor/panels/aiImageGenerateField";

export type ShowPictureAiFieldOptions = {
  readonly onInserted: (resourceId: string) => void;
  readonly queueKey?: string;
};

export function showPictureAiField(options: ShowPictureAiFieldOptions): HTMLElement {
  return aiImageGenerateField({
    kind: "picture",
    testidPrefix: "show-picture-ai",
    ...(options.queueKey ? { queueKey: options.queueKey } : {}),
    onInserted: options.onInserted,
  });
}
