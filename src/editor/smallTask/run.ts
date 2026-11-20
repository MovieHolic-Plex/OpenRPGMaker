import { ASSISTANT_CHATGPT_MODEL, atLeastMediumEffort } from "@/ai/chatgptDefault";
import { loadAiConfig } from "@/ai/llmClient";
import { modelForRole } from "@/ai/modelRoles";
import { runPiAgentViaCompanion } from "@/ai/piAgent/client";
import type { SmallTaskDraftSource } from "@/ai/smallTaskReferences";
import { editorState } from "@/editor/editorState";
import { commitChangeset } from "@/editor/tools/changeset";
import type { Project } from "@/project/types";
import { SELECT_EVENT_PAGE, STALE_COMMAND_LIST } from "./primitives/errors";
import { SMALL_TASK_SCOPE_REFUSAL } from "./tools";
import { SmallTaskError, type SmallTaskTarget } from "./target";

// The Pi worker edits a private copy. The capsule owns publication and undo.
export async function runSmallTask(
  before: Project, target: SmallTaskTarget, request: string, signal: AbortSignal, live?: SmallTaskDraftSource,
): Promise<Project> {
  const config = loadAiConfig();
  const role = modelForRole(config, "deep");
  const thinkingLevel = role.model === ASSISTANT_CHATGPT_MODEL ? atLeastMediumEffort(role.thinkingLevel) : role.thinkingLevel;
  const selection = editorState.get().selection;
  const rect = target.kind !== "dbEntry" && selection?.mapId === target.mapId
    ? { x: selection.x, y: selection.y, w: selection.width, h: selection.height }
    : undefined;
  const draftMaps: Record<string, SmallTaskDraftSource["maps"][string]> = {};
  if (target.kind === "map" && live) {
    for (const [mapId, map] of Object.entries(live.maps)) {
      const events = map.events.filter(event => event.draft);
      if (events.length) draftMaps[mapId] = { events };
    }
  }
  const result = await runPiAgentViaCompanion({
    mode: "single", provider: role.provider, model: role.model, thinkingLevel,
    task: request, project: before, mapIds: target.kind === "dbEntry" ? [] : [target.mapId],
    ...(target.kind === "dbEntry" ? {} : { currentMapId: target.mapId }),
    smallTask: { target, maxToolCalls: config.maxToolCalls, ...(rect ? { selection: { rect } } : {}),
      ...(Object.keys(draftMaps).length ? { live: { maps: draftMaps } } : {}) },
  }, { signal });
  signal.throwIfAborted();
  if (!result.smallTask) throw new Error("Pi worker did not acknowledge the small-task scope");
  if (result.stoppedEarly === SMALL_TASK_SCOPE_REFUSAL || result.stoppedEarly === STALE_COMMAND_LIST || result.stoppedEarly === SELECT_EVENT_PAGE) {
    throw new SmallTaskError(result.stoppedEarly);
  }
  if (result.stoppedEarly) throw new Error(result.stoppedEarly);
  if (!result.changedKeys.length) return before;
  if (!commitChangeset(result.project, before).ok) throw new SmallTaskError("선택한 대상에 요청한 변경을 적용할 수 없어요.");
  return result.project;
}
