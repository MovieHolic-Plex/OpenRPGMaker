import { aiImageGenerateField } from "@/editor/panels/aiImageGenerateField";

export type ShowPictureAiFieldOptions = {
  readonly onInserted: (resourceId: string) => void;
};

export function showPictureAiField(options: ShowPictureAiFieldOptions): HTMLElement {
  return aiImageGenerateField({
    kind: "picture",
    testidPrefix: "show-picture-ai",
    onInserted: options.onInserted,
  });
}
