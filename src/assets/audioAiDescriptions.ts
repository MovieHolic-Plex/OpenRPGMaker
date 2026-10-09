import { AUDIO_DESCRIPTION_MAX_LENGTH } from "@/project/audioDescriptions";
import type { AudioResourceKind } from "@/project/types";
import data from "./audioAiDescriptions.json";

type AudioAiDraftInput = {
  readonly status?: unknown;
  readonly result?: {
    readonly audio_available?: unknown;
    readonly description?: unknown;
  } | null;
};

/** Failed/incomplete analyses are not defaults, even if the runner called them ok. */
export function audioAiDraftDescription(record: AudioAiDraftInput): string | undefined {
  const description = record.result?.description;
  return record.status === "ok"
    && record.result?.audio_available === true
    && typeof description === "string"
    && description.trim().length > 0
    && description.length <= AUDIO_DESCRIPTION_MAX_LENGTH
    ? description
    : undefined;
}

// Editor-only static defaults. Provenance stays in the shipped JSON; these indexes
// neither enumerate new resources nor enter project persistence/player imports.
const drafts = {
  music: new Map(data.entries.filter(entry => entry.kind === "music")
    .map(entry => [entry.id, audioAiDraftDescription(entry)])),
  sound: new Map(data.entries.filter(entry => entry.kind === "sound")
    .map(entry => [entry.id, audioAiDraftDescription(entry)])),
};

export function getAudioAiDescription(kind: AudioResourceKind, id: string): string | undefined {
  return drafts[kind].get(id);
}
