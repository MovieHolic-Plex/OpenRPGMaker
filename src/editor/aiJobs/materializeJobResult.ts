import type { AiJobInput, AiJobResult, BlobRef } from "@/ai/jobs/contracts";
import type { Command, Project } from "@/project/types";
import type { ImageJobProposal } from "@/ai/jobs/imagePayload";
import { parseImageJobDestination } from "@/ai/jobs/imagePayload";
import { parseEventCommandsPayload } from "@/ai/jobs/eventCommandsPayload";
import type { EventCommandsJobProposal } from "@/ai/jobs/executors/eventCommandsJob";
import type { TilesetAnalysisProposal } from "@/ai/jobs/executors/tilesetJob";
import { parseTilesetPayload } from "@/ai/jobs/tilesetPayload";
import { parseProject } from "@/ai/jobs/checkpointState";
import { canonicalProject, equalJson, mergeResultProject, ResultConflict } from "@/ai/jobs/resultPatch";
import { insertGeneratedPictureAsset } from "@/editor/generatedPictureAsset";
import { resolveCommandListAtPath } from "@/editor/eventCommandPaths";
import { applyCommandDiff, diffCommandLists } from "@/editor/panels/eventEditor/commandDiff";
import { applyAiMappingAnswer } from "@/editor/panels/tilesetAiMappingParser";
import { materializeAiReviewProposals } from "@/editor/tilesetAiNativeReviewApply";
import { resolveDraftOwner } from "./draftOwners";
import type { ApplicationClient } from "./applicationClient";

export interface JobReview { readonly approved: true; readonly excludedRowIds?: readonly string[]; readonly proposalIds?: readonly string[] }
export interface MaterializedResult {
  readonly project: Project;
  readonly draft?: Awaited<ReturnType<typeof resolveDraftOwner>> & { readonly after: Command[] };
  readonly draftOnly: boolean;
}
/** Every family consumes immutable result facts. No generation, tools, time-based IDs or providers. */
export async function materializeJobResult(input: AiJobInput, result: AiJobResult, base: Project, live: Project, client: ApplicationClient, review?: JobReview): Promise<MaterializedResult> {
  if (result.generatedSnapshot) {
    const generated = parseProject(await client.json(result.jobId, result.generatedSnapshot));
    const broad = result.family === "assistant" || result.family === "region" || result.family === "tileset";
    // The database/image builders read global reference/house/world context. Root changes are not unrelated record edits.
    for (const root of ["worldCanon", "world", "worldGraph", "tilesets", "switches", "variables"] as const) {
      if (!equalJson(base[root], live[root])) throw new ResultConflict([`read-dependency:${root}`]);
    }
    return { project: mergeResultProject(base, generated, live, broad), draftOnly: false };
  }
  if (result.family === "event-commands") {
    if (!review) throw new ResultConflict(["review-required"]);
    const payload = parseEventCommandsPayload(input.payload);
    if (!payload.draftBinding) throw new ResultConflict(["draft-binding-missing"]);
    if (!equalJson(canonicalProject(base), canonicalProject(live))) throw new ResultConflict(["event-read-dependencies"]);
    const proposal = await client.json<EventCommandsJobProposal>(result.jobId, result.payload.proposalRef as unknown as BlobRef);
    if (!equalJson(proposal.project, result.project) || !equalJson(proposal.target, input.target) || !equalJson(proposal.baseCommands, payload.baseCommands)) throw new ResultConflict(["event-proposal-binding"]);
    const expectedOwner = proposal.target.kind === "common-event"
      ? { kind: "common-event", commonEventId: proposal.target.commonEventId }
      : { kind: "map-event", mapId: proposal.target.mapId, eventId: proposal.target.eventId, pageId: proposal.target.pageId };
    if (!equalJson(payload.draftBinding.owner, expectedOwner)) throw new ResultConflict(["event-owner-binding"]);
    const draft = await resolveDraftOwner(result.project, payload.draftBinding);
    if (!equalJson(draft.before, proposal.baseCommands)) throw new ResultConflict(["event-draft-changed"]);
    const rows = diffCommandLists(proposal.baseCommands, proposal.finalCommands);
    return { project: structuredClone(live), draftOnly: true, draft: { ...draft, after: applyCommandDiff(rows, new Set(review.excludedRowIds ?? [])) } };
  }
  if (result.family === "image") {
    if (!review) throw new ResultConflict(["review-required"]);
    const proposal = result.payload.proposal as unknown as ImageJobProposal;
    const destination = parseImageJobDestination(proposal.destination, proposal.resource.kind);
    if (destination.kind !== "event-draft" || !proposal.command) throw new ResultConflict(["image-proposal-missing"]);
    if (!equalJson(destination, input.target)) throw new ResultConflict(["image-destination-binding"]);
    if (!equalJson(canonicalProject(base), canonicalProject(live))) throw new ResultConflict(["image-draft-read-dependencies"]);
    const draft = await resolveDraftOwner(result.project, destination, destination.commandPath, destination.command);
    const project = structuredClone(live), resource = proposal.resource;
    if (project.assets.uploaded[resource.id] || project.resourceProfiles.some(p => p.assetId === resource.id)) throw new ResultConflict(["image-resource-collision"]);
    const bytes = await client.bytes(result.jobId, resource.artifact);
    let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
    insertGeneratedPictureAsset(project, { id: resource.id, name: resource.name, kind: resource.kind, width: resource.width, height: resource.height, dataUrl: `data:${resource.artifact.mediaType};base64,${btoa(binary)}` });
    const after = structuredClone([...draft.before]);
    const list = resolveCommandListAtPath(after, destination.commandPath.slice(0, -1));
    if (!list) throw new ResultConflict(["image-command-path"]);
    list[destination.commandPath[destination.commandPath.length - 1]] = structuredClone(proposal.command) as unknown as Command;
    return { project, draft: { ...draft, after }, draftOnly: true };
  }
  if (result.family === "tileset") {
    if (!review) throw new ResultConflict(["review-required"]);
    const payload = parseTilesetPayload(input.payload);
    const proposal = await client.json<TilesetAnalysisProposal & { tilesetId: string }>(result.jobId, result.payload.proposalRef as unknown as BlobRef);
    if (proposal.tilesetId !== payload.tilesetId || proposal.kind !== payload.operation) throw new ResultConflict(["tileset-proposal-binding"]);
    const generated = structuredClone(base), tileset = generated.tilesets[payload.tilesetId];
    if (!tileset) throw new ResultConflict(["tileset-missing"]);
    switch (proposal.kind) {
      case "knowledge-analysis": case "question-followup": {
        const ids = review.proposalIds ?? proposal.review.proposals.filter(p => p.status === "accepted").map(p => p.id);
        if (!ids.length) throw new ResultConflict(["tileset-selection-required"]);
        const applied = materializeAiReviewProposals(tileset, { tilesetId: tileset.id, state: proposal.review, mode: "selected", proposalIds: ids });
        if (applied.kind !== "applied" || applied.skippedIds.length || applied.appliedIds.length !== ids.length) throw new ResultConflict(["tileset-protected-or-invalid"]);
        break;
      }
      case "proposal-draft": {
        if (payload.operation !== "proposal-draft") throw new ResultConflict(["mapping-operation"]);
        const artifactId = (result.payload.proposalRef as unknown as BlobRef).sha256;
        const protectedGroups = (tileset.tileGroups ?? []).filter(group => group.origin === "user" || group.source === "user");
        applyAiMappingAnswer(tileset, payload.selectedTiles, proposal.answer, index => {
          const id = `ai-job-${artifactId}-${index}`;
          if (base.tilesets[tileset.id].tileGroups?.some(group => group.id === id)) throw new ResultConflict(["mapping-group-id-collision"]);
          return id;
        });
        if (protectedGroups.some(group => !tileset.tileGroups?.some(next => equalJson(group, next)))) throw new ResultConflict(["mapping-human-group-conflict"]);
        break;
      }
      case "structure-kit-metadata": {
        const kit = tileset.structureKits?.find(k => k.id === proposal.kitId);
        if (!kit || kit.kind !== "section") throw new ResultConflict(["structure-kit-missing"]);
        kit.ai = { ...structuredClone(proposal.metadata), origin: "user" };
        break;
      }
      default: throw new ResultConflict(["tileset-proposal-unsupported"]);
    }
    return { project: mergeResultProject(base, generated, live, true), draftOnly: false };
  }
  // A successful read-only assistant can have no mutation; other missing variants are explicit conflicts.
  if (result.family === "assistant" && result.payload.completion === "complete") return { project: structuredClone(live), draftOnly: false };
  throw new ResultConflict([`${result.family}:missing-project-proposal`]);
}
