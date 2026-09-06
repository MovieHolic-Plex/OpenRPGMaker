// Foreground compatibility entry. Isolated jobs import assistantSessionCore instead.
import { AssistantSession as SessionCore, type AssistantSessionOptions as CoreOptions } from "./assistantSessionCore";
import { editorSessionHost } from "./editorSessionHost";
import type { Project } from "@/project/types";
export * from "./assistantSessionCore";
export type AssistantSessionOptions = Omit<CoreOptions, "host"> & { host?: CoreOptions["host"] };
export class AssistantSession extends SessionCore {
  constructor(project: Project, options: AssistantSessionOptions = {}) {
    super(project, { ...options, host: options.host ?? editorSessionHost });
  }
}
