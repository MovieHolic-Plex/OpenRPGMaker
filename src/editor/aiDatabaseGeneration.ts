import { chatCompletion } from "@/ai/llmClient";
import { generateAiImage } from "@/ai/imageGenerationClient";
import { applyToolSequenceToStore } from "@/editor/tools/applyChangesetToStore";
import { store } from "@/project/store";
import { generateDatabaseRecord, type AiDatabaseGenerationInput, type AiDatabaseGenerationDeps, type AiDatabaseGenerationOutcome } from "@/ai/databaseGenerationCore";

export * from "@/ai/databaseGenerationCore";

/** Foreground compatibility adapter. Job execution imports only the store-free core. */
export function generateDatabaseRecordWithAi(
  input: AiDatabaseGenerationInput,
  deps: AiDatabaseGenerationDeps = {},
): Promise<AiDatabaseGenerationOutcome> {
  return generateDatabaseRecord(input, {
    ...deps,
    complete: deps.complete ?? chatCompletion,
    generateImage: deps.generateImage ?? generateAiImage,
    currentProject: deps.currentProject ?? (() => store.getCurrent()),
    applyCalls: deps.applyCalls ?? applyToolSequenceToStore,
  });
}
