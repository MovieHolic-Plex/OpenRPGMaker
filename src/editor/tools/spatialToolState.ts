import { detachedDraftOrigin, getDetachedDraftMemory, setDetachedDraftMemory, transferDetachedDraftMemory } from "@/editor/detachedDraftMemory";
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
  if (issued.baseline !== spatialToolFingerprint(project)) throw new ToolError("Project changed since preview — re-issue preview_spatial_build and apply it before any other write", { code: "spatial-stale" });
  setDetachedDraftMemory(project, PREVIEWS, undefined);
  return issued.preview;
}
/**
 * 프로세스 경계를 넘는 제안 증거. 프루프는 객체 정체성(WeakMap)에 살아 동반 서비스(워커)에서
 * 브라우저로 건너오지 못한다 — 그래서 같은 내용을 다이제스트로만 실어 보낸다.
 */
export interface SpatialToolProof {
  readonly baseline: string;
  readonly spatial: string;
  readonly proposed?: string;
}

/** 워커가 결과와 함께 실어 보낼 증거. 쓰기 도구가 한 번도 안 돌았으면 null. */
export function exportSpatialToolProof(project: Project): SpatialToolProof | null {
  const proof = getDetachedDraftMemory<Proof>(project, KEY);
  return proof ? { ...proof } : null;
}

/**
 * 워커가 돌려준 제안에 그 워커의 증거를 되붙인다. 계보는 «지금 살아있는 프로젝트»로 다시
 * 이어 붙인다 — 낡은 사본이나 남의 프로젝트에 남의 증거만 옮겨 붙이는 길을 막는다.
 * 기준이 지금과 다르면 아무것도 쓰지 않는다: 그 제안은 아래 게이트가 어차피 거절한다.
 */
export function adoptSpatialToolProof(project: Project, proof: SpatialToolProof | null | undefined, live: Project): void {
  if (!proof || proof.baseline !== spatialToolFingerprint(live)) return;
  transferDetachedDraftMemory(live, project);
  setDetachedDraftMemory<Proof>(project, KEY, {
    baseline: proof.baseline, spatial: proof.spatial,
    ...(proof.proposed === undefined ? {} : { proposed: proof.proposed }),
  });
}

/**
 * 병합을 거친 제안의 증거를 다시 찍는다. 병합은 저장소 코드가 살아있는 프로젝트 위에 묶음만
 * 얹는 일이고, 그 결과의 계층 문서는 살아있는 문서 그대로다. 계층 문서가 달라졌다면 승인으로
 * 세우지 않는다 — 병합이 버린 계층 편집이 승인으로 세탁되지 않고 계층 변경으로 거절된다.
 */
export function authorMergedSpatialProposal(project: Project, live: Project): void {
  if (live.spatialAuthoring === undefined) return;
  transferDetachedDraftMemory(live, project);
  setDetachedDraftMemory<Proof>(project, KEY, {
    baseline: spatialToolFingerprint(live),
    spatial: spatialFingerprint(live),
    proposed: spatialToolFingerprint(project),
  });
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
