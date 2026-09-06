import { assert } from "@/project/io/guards";
import type { AiJobHost } from "../../../scripts/lib/aiJobs/scheduler.mjs";
import type { AiJobInput } from "./contracts";
import { jsonValue } from "./checkpointState";
import { parseTilesetReview, type TilesetJobPayload } from "./tilesetPayload";

/** A queued follow-up names its predecessor explicitly; standalone captures need no dependency. */
export function validateTilesetDependency(input: AiJobInput & { family: "tileset" }, payload: TilesetJobPayload, host: AiJobHost): void {
  if (input.dependsOn.length === 0 && payload.sourceJobId === undefined) return;
  assert(payload.sourceJobId !== undefined && input.dependsOn.includes(payload.sourceJobId), "Tileset follow-up must name an admitted dependency");
  const source = host.dependencies.find(result => result.jobId === payload.sourceJobId);
  assert(source !== undefined && source.family === "tileset" && source.project.backend === input.project.backend && source.project.projectId === input.project.projectId, "Tileset predecessor project mismatch");
  assert(source.payload.completion === "complete", "Tileset predecessor is incomplete");
  const sameRef = (a: typeof input.projectSnapshot, b: typeof input.projectSnapshot) => a.sha256 === b.sha256 && a.mediaType === b.mediaType && a.byteLength === b.byteLength;
  if (payload.operation === "cluster-edit" || payload.operation === "range-classify" || payload.operation === "unclassified-analysis") {
    assert(source.generatedSnapshot !== null && sameRef(source.generatedSnapshot, input.projectSnapshot), "Cluster continuation must capture the predecessor's generated snapshot");
  } else {
    assert(sameRef(source.baseSnapshot, input.projectSnapshot), "Tileset follow-up baseline mismatch");
    assert(source.payload.tilesetId === payload.tilesetId, "Tileset predecessor target mismatch");
    if (payload.operation === "question-followup" || (payload.operation === "knowledge-analysis" && payload.review)) {
      const review = payload.review!;
      const prior = parseTilesetReview(source.payload.review);
      const content = (value: typeof prior) => jsonValue({ ...value, proposals: value.proposals.map(p => ({ ...p, status: "pending", feedback: "" })) });
      assert(JSON.stringify(content(prior)) === JSON.stringify(content(review)), "Captured review does not match predecessor output");
    }
  }
}
