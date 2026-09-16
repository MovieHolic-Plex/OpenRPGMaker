import type { Project } from "../types";
import type { MirrorStatus, ServerSHA } from "./persistenceTypes";
import { sameProjectTarget, type ProjectTarget } from "../persistence/target";

export { sameProjectTarget };

/** Authority belongs to a loaded target, never to a Project object's identity or local hash. */
export type ProjectWriteAuthority = {
  readonly target: ProjectTarget;
} & (
  | { readonly mode: "create" | "legacy" }
  | { readonly mode: "canonical"; readonly serverSHA: ServerSHA; readonly revision?: number }
);

export type ProjectRoutingFault = "authority-required" | "target-changed" | "canonical-replacement" | "activation-required" | "activation-stale";

export class ProjectRoutingError extends Error {
  /** 복구 UI 가 범용 `code` 로 읽는 별칭 — fault 와 같은 값이다. */
  readonly code: ProjectRoutingFault;

  constructor(
    fault: ProjectRoutingFault,
    message: string,
    readonly details?: { readonly projectId?: string; readonly sha256?: string; readonly mirror?: MirrorStatus; readonly serverRevision?: number },
  ) {
    super(message);
    this.fault = fault;
    this.code = fault;
    this.name = "ProjectRoutingError";
  }

  readonly fault: ProjectRoutingFault;
}

export type CanonicalSave = {
  readonly kind: "saved";
  readonly project: Project;
  readonly sha256: string;
  readonly authority: ProjectWriteAuthority;
  readonly mirror?: MirrorStatus;
};

export function assertCanonicalReplacement(project: Project, authority: ProjectWriteAuthority | null): void {
  if (authority?.mode === "canonical" && !Object.hasOwn(project, "spatialAuthoring")) {
    throw new ProjectRoutingError("canonical-replacement", "A canonical target cannot lose its spatial document. Use an explicit new-project copy instead.");
  }
}
