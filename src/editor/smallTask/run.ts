import { ASSISTANT_CHATGPT_MODEL, atLeastMediumEffort } from "@/ai/chatgptDefault";
import { loadAiConfig } from "@/ai/llmClient";
import { modelForRole } from "@/ai/modelRoles";
import { runPiAgentViaCompanion } from "@/ai/piAgent/client";
import { editorState } from "@/editor/editorState";
import { commitChangeset } from "@/editor/tools/changeset";
import type { Project } from "@/project/types";
import { MAP_REMOVAL_DRAFT_REFUSAL, SELECT_EVENT_PAGE, STALE_COMMAND_LIST } from "./primitives/errors";
import { SMALL_TASK_SCOPE_REFUSAL } from "./tools";
import { SmallTaskError, type SmallTaskTarget } from "./target";

// The Pi worker edits a private copy. The capsule owns publication and undo.
export async function runSmallTask(before: Project, target: SmallTaskTarget, request: string, signal: AbortSignal, live?: Project): Promise<Project> {
  const config = loadAiConfig();
  const role = modelForRole(config, "deep");
  const thinkingLevel = role.model === ASSISTANT_CHATGPT_MODEL ? atLeastMediumEffort(role.thinkingLevel) : role.thinkingLevel;
  const selection = editorState.get().selection;
  const rect = target.kind !== "dbEntry" && selection?.mapId === target.mapId
    ? { x: selection.x, y: selection.y, w: selection.width, h: selection.height }
    : undefined;
  const draftMaps = Object.fromEntries(Object.entries(live?.maps ?? {}).flatMap(([mapId, map]) => {
    const events = map.events.filter(event => event.draft);
    return events.length ? [[mapId, { events }] as const] : [];
  }));
  const result = await runPiAgentViaCompanion({
    mode: "single", provider: role.provider, model: role.model, thinkingLevel,
    task: request, project: before, mapIds: target.kind === "dbEntry" ? [] : [target.mapId],
    ...(target.kind === "dbEntry" ? {} : { currentMapId: target.mapId }),
    smallTask: {
      target, maxToolCalls: config.maxToolCalls, ...(rect ? { selection: { rect } } : {}),
      ...(Object.keys(draftMaps).length ? { draftSource: { maps: draftMaps } } : {}),
    },
  }, { signal });
  signal.throwIfAborted();
  if (!result.smallTask) throw new Error("Pi worker did not acknowledge the small-task scope");
  if (result.stoppedEarly === SMALL_TASK_SCOPE_REFUSAL || result.stoppedEarly === STALE_COMMAND_LIST || result.stoppedEarly === SELECT_EVENT_PAGE) {
    throw new SmallTaskError(result.stoppedEarly);
  }
  if (live && target.kind === "map" && result.stoppedEarly?.startsWith(MAP_REMOVAL_DRAFT_REFUSAL)) {
    const { mapRemovalDraftError } = await import("./primitives/units/23-map-structure/maps");
    signal.throwIfAborted();
    const message = mapRemovalDraftError(before, target.mapId, live);
    if (message) throw new SmallTaskError(message);
  }
  if (result.stoppedEarly) throw new Error(result.stoppedEarly);
  if ((result.changedKeys?.length ?? 0) === 0) return before;
  if (!commitChangeset(result.project, before).ok) throw new SmallTaskError("선택한 대상에 요청한 변경을 적용할 수 없어요.");
  return result.project;
}
