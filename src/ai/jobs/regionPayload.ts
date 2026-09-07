import { assert, requireNumber, requireRecord, requireString } from "@/project/io/guards";
import { parseReportAssets } from "./reportAssets.mjs";
import type { Project } from "@/project/types";
import { enumValue, parseAssistantPayload, type AssistantJobPayload } from "./assistantPayload";
import type { RegionGenerationOptions, RegionGenerationProposal } from "@/editor/regionTask/regionGenerationCore";

/** Selection is exactly region; viewport and preferences must be captured at submission. */
export interface RegionJobPayload extends RegionGenerationOptions {
  config: AssistantJobPayload["config"];
  context: AssistantJobPayload["context"];
  reportAssets?: AssistantJobPayload["reportAssets"];
}

export function parseRegionPayload(value: unknown, project: Project): RegionJobPayload {
  const p = requireRecord("region payload", value);
  assert(Object.keys(p).every(key => ["instruction", "mapId", "region", "mode", "config", "context", "reportAssets"].includes(key)), "Unexpected region input field");
  const mapId = requireString("mapId", p.mapId);
  const map = project.maps[mapId];
  assert(!!map, "Region map does not exist");
  const r = requireRecord("region", p.region);
  assert(Object.keys(r).every(key => ["x", "y", "width", "height"].includes(key)), "Unexpected region rectangle field");
  const region = { x: requireNumber("x", r.x), y: requireNumber("y", r.y), width: requireNumber("width", r.width), height: requireNumber("height", r.height) };
  assert(Object.values(region).every(Number.isSafeInteger) && region.x >= 0 && region.y >= 0 && region.width > 0 && region.height > 0
    && region.x + region.width <= map.width && region.y + region.height <= map.height, "Region must be an integer rectangle inside the submitted map");
  const assistant = parseAssistantPayload({ instruction: p.instruction, config: p.config, context: p.context, domain: "map" });
  assert(assistant.context.currentMapId === undefined || assistant.context.currentMapId === mapId, "Captured current map differs from region map");
  assert(!assistant.context.viewport || assistant.context.viewport.mapId === mapId, "Captured viewport differs from region map");
  return { instruction: assistant.instruction, config: assistant.config, context: { ...assistant.context, currentMapId: mapId },
    mapId, region, mode: enumValue(p.mode, ["task", "polish"]),
    ...(p.reportAssets === undefined ? {} : { reportAssets: parseReportAssets(p.reportAssets) }) };
}

/** Typed region portion of result.payload; assistant turn/usage/audit fields accompany it. */
export type RegionJobResultMetadata = Readonly<RegionGenerationOptions & Omit<RegionGenerationProposal, "project" | "report"> & {
  review?: RegionGenerationProposal["report"];
  completion: "complete";
  applied: false;
  persistence: "not-applicable";
  checkpoint: "private-draft";
}>;
