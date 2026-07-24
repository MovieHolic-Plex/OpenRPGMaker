import { recordAiActivity } from "@/ai/activityLog";
import {
  formatPlayBootDiagnosticInstruction,
  type PlayBootDiagnosticSink,
} from "@/player/playBootDiagnostics";

/** Editor-only persistence adapter. Public player hosts never import this module. */
export const editorPlayBootDiagnosticSink: PlayBootDiagnosticSink = async (payload) => {
  await recordAiActivity({
    channel: "other",
    instruction: formatPlayBootDiagnosticInstruction(payload),
    ...(payload.mapId ? { mapId: payload.mapId } : {}),
    result: {
      ok: payload.ok,
      ...(payload.errorMessage ? { error: payload.errorMessage } : {}),
      stoppedReason: payload.stage,
      assistantText: JSON.stringify(payload).slice(0, 2000),
    },
    uiEvents: [payload],
  });
};
