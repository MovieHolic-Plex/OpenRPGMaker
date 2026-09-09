import { detachedDraftOrigin, getDetachedDraftMemory, setDetachedDraftMemory } from "@/editor/detachedDraftMemory";
import { checkedDocument } from "@/project/spatial/domain";
import { validateSpatialProject } from "@/project/spatial/overviewPairs";
import type { Project } from "@/project/types";
import type { SpatialAuthoringPreview } from "@/editor/spatial/authoringTypes";
import { sha256HexTextSync } from "@/util/sha256";
import { ToolError } from "./types";

const KEY = "spatial-tool-proposal";
const PREVIEWS = "spatial-tool-previews";
type Proof = { readonly baseline: string; readonly spatial: string; readonly proposed?: string };
type IssuedPreview = { readonly id: string; readonly baseline: string; readonly preview: SpatialAuthoringPreview };

/** Editor-only issued state follows the existing detached draft clone path; never project JSON. */
export function spatialToolFingerprint(project: Project): string {
  return sha256HexTextSync(JSON.stringify(project));
}
function spatialFingerprint(project: Project): string {
  return sha256HexTextSync(JSON.stringify(project.spatialAuthoring));
}
export function beginSpatialToolProposal(project: Project, before: Project): void {
  if (before.spatialAuthoring === undefined) return;
  const prior = getDetachedDraftMemory<Proof>(project, KEY);
  if (prior) {
    if (prior.proposed !== spatialToolFingerprint(before)) throw new ToolError("Draft changed outside the tool runner", { code: "spatial-tampered-proposal" });
    return;
  }
  setDetachedDraftMemory<Proof>(project, KEY, { baseline: spatialToolFingerprint(before), spatial: spatialFingerprint(before) });
}
export function sealSpatialToolProposal(project: Project): void {
  const proof = getDetachedDraftMemory<Proof>(project, KEY);
  if (proof) setDetachedDraftMemory<Proof>(project, KEY, { ...proof, proposed: spatialToolFingerprint(project) });
}
export function authorizeSpatialToolChange(project: Project, before: Project): void {
  const prior = getDetachedDraftMemory<Proof>(project, KEY);
  setDetachedDraftMemory<Proof>(project, KEY, {
    baseline: prior?.baseline ?? spatialToolFingerprint(before), spatial: spatialFingerprint(project),
  });
}
export function issueSpatialToolPreview(project: Project, preview: SpatialAuthoringPreview): string {
  const id = crypto.randomUUID();
  // One pending build per draft. New preview replaces the old capability, without authoring data.
  setDetachedDraftMemory<IssuedPreview>(project, PREVIEWS, { id, baseline: spatialToolFingerprint(project), preview });
  return id;
}
export function consumeSpatialToolPreview(project: Project, id: string): SpatialAuthoringPreview {
  const issued = getDetachedDraftMemory<IssuedPreview>(project, PREVIEWS);
  if (!issued || issued.id !== id) throw new ToolError("Preview was not issued for this draft", { code: "spatial-foreign-preview" });
  if (issued.baseline !== spatialToolFingerprint(project)) throw new ToolError("Project changed since preview", { code: "spatial-stale" });
  setDetachedDraftMemory(project, PREVIEWS, undefined);
  return issued.preview;
}
/** All generic writes and acceptance pass here; baseline lint cannot waive invalid canonical projections. */
export function assertSpatialToolChange(project: Project, before?: Project): void {
  if (project.spatialAuthoring !== undefined) {
    validateSpatialProject(checkedDocument(project.spatialAuthoring, project), project);
  }
  if (!before || JSON.stringify(project.spatialAuthoring) === JSON.stringify(before.spatialAuthoring)) return;
  const proof = getDetachedDraftMemory<Proof>(project, KEY);
  if (!proof || proof.spatial !== spatialFingerprint(project)) {
    throw new ToolError("Spatial hierarchy changes require the validated spatial tools", { code: "spatial-authority" });
  }
}
/** Acceptance is the existing AI path, not the singleton manual controller inside a detached tool. */
export function assertSpatialToolAcceptance(project: Project, before: Project): void {
  assertSpatialToolChange(project, before);
  const proof = getDetachedDraftMemory<Proof>(project, KEY);
  if (before.spatialAuthoring !== undefined && !proof && spatialToolFingerprint(project) !== spatialToolFingerprint(before)) {
    throw new ToolError("Canonical AI acceptance requires an issued tool proposal", { code: "spatial-foreign-proposal" });
  }
  if (proof && proof.proposed !== spatialToolFingerprint(project)) {
    throw new ToolError("Proposal differs from the validated tool result", { code: "spatial-tampered-proposal" });
  }
  if (proof && (proof.baseline !== spatialToolFingerprint(before) || detachedDraftOrigin(project) !== detachedDraftOrigin(before))) {
    throw new ToolError("Live project changed since the spatial proposal began", { code: "spatial-stale" });
  }
}
export function finishSpatialToolAcceptance(project: Project): void {
  setDetachedDraftMemory(project, KEY, undefined);
  setDetachedDraftMemory(project, PREVIEWS, undefined);
}
