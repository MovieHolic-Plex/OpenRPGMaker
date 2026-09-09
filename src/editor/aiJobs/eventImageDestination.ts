import { jsonObject, jsonValue } from "@/ai/jobs/checkpointState";
import type { ImageJobDestination } from "@/ai/jobs/imagePayload";
import type { Command } from "@/project/types";
import type { CommandEditContext } from "@/editor/panels/eventEditor/types";
import { captureDraftBinding } from "./draftOwners";
import { JobSubmitError } from "./jobSubmitError";

export async function eventDraftImageDestination(
  context: CommandEditContext,
  binding: Extract<ImageJobDestination, { kind: "event-draft" }>["binding"],
  command: Command,
): Promise<ImageJobDestination> {
  const draft = context.jobDraft;
  if (!draft) throw new JobSubmitError("not-ready", "이벤트 초안이 열려 있지 않습니다.");
  const captured = await captureDraftBinding(draft);
  return {
    kind: "event-draft",
    ...captured,
    commandPath: context.path,
    binding,
    command: jsonObject(jsonValue(command)),
  };
}
