import type { AiConfig } from "@/ai/llmClient";
import { buildEventAssistPrompt } from "@/ai/eventCommandAssist";
import { createBlankProject } from "@/project/defaults";
import {
  requireArray,
  requireBoolean,
  requireNumber,
  requireRecord,
  requireString,
} from "@/project/io/guards";
import type { AudioResourceKind, Project } from "@/project/types";

export const AUDIO_TEST_CONFIG: AiConfig = {
  authMode: "apiKey",
  baseUrl: "https://example.invalid/v1",
  model: "audio-description-test",
  liteModel: "audio-description-test",
  apiKey: "fixture",
  maxToolCalls: 8,
  maxTokens: 4_000_000,
  agentMode: "chat",
};

export function uploadId(kind: AudioResourceKind, index: number): string {
  return `qa-prompt-${kind}-${String(index).padStart(3, "0")}`;
}

/** Each invocation owns its mutable project fixture. */
export function audioPromptProject(
  kind: AudioResourceKind,
  descriptions: readonly (string | undefined)[],
): Project {
  const project = createBlankProject();
  const overrides: Record<string, string> = {};
  descriptions.forEach((description, index) => {
    const id = uploadId(kind, index);
    project.assets.uploaded[id] = {
      id,
      kind,
      name: "fixture",
      dataUrl: "data:audio/ogg;base64,T2dnUw==",
      meta: {},
    };
    if (description !== undefined) overrides[id] = description;
  });
  if (Object.keys(overrides).length > 0) {
    project.audioDescriptions = { [kind]: overrides };
  }
  return project;
}

export function audioPrompt(project: Project, requestText = ""): string {
  const context = { project, mapId: project.startMapId, requestText };
  return buildEventAssistPrompt(context);
}

/** Parse machine fields, without depending on headings or explanatory prose. */
export function parseAudioPrompt(prompt: string, kind: AudioResourceKind) {
  const blocks = prompt.split("\n")
    .filter(line => line.startsWith("{") && line.includes('"audioResourceSlot"'))
    .map(line => requireRecord("audio JSON", JSON.parse(line)));
  const block = requireRecord(
    "audio slot",
    blocks.find(value => value.audioResourceSlot === kind),
  );
  return {
    total: requireNumber("total", block.total),
    entries: requireArray("entries", block.entries).map(value => {
      const entry = requireRecord("entry", value);
      return {
        id: requireString("id", entry.id),
        name: requireString("name", entry.name),
        tags: requireArray("tags", entry.tags).map(tag => requireString("tag", tag)),
        description: requireString("description", entry.description),
        descriptionSource: requireString("descriptionSource", entry.descriptionSource),
        descriptionTruncated: requireBoolean(
          "descriptionTruncated", entry.descriptionTruncated,
        ),
      };
    }),
  };
}
