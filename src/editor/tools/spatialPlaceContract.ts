import type { Project } from "@/project/types";
import type { SpatialDesignReference, SpatialKind } from "@/project/spatial/types";
import { choice, id, record } from "@/project/spatial/guardValues";

const storageKinds = ["object", "space", "place", "region", "world"] as const;
export const publicSpatialKind = (kind: SpatialKind): Exclude<SpatialKind, "space"> => kind === "space" ? "place" : kind;

/** Global design IDs make the historical storage collection unambiguous. */
export function storageSpatialSource(project: Project, args: Record<string, unknown>): SpatialDesignReference {
  const kind = choice(storageKinds)(args.kind, "kind");
  const designId = id(args.id, "id");
  return { kind: kind === "place" && Object.hasOwn(project.spatialAuthoring?.library.spaces ?? {}, designId) ? "space" : kind, id: designId };
}

/** Public tool values expose one place kind, including references and resolved snapshots. */
export function publicSpatialValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(publicSpatialValue);
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  const output = Object.fromEntries(Object.entries(input).map(([key, child]) => [key, publicSpatialValue(child)]));
  if (input.kind === "space") output.kind = "place";
  if (input.spaces && input.places && input.objects && input.regions && input.worlds) {
    output.places = { ...(output.spaces as object), ...(output.places as object) };
    delete output.spaces;
  }
  return output;
}

/** Accept the unified place body while retaining old callers' explicit space bodies. */
export function storageSpatialDesign(project: Project, requestedKind: unknown, value: unknown) {
  const requested = choice(storageKinds)(requestedKind, "kind");
  const body = record(value, requested);
  const kind = requested === "place" && (body.environment === "interior" || body.environment === "outdoor") ? "space" : requested;
  const convert = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(convert);
    if (!value || typeof value !== "object") return value;
    const input = value as Record<string, unknown>;
    const output = Object.fromEntries(Object.entries(input).map(([key, child]) => [key, convert(child)]));
    if (input.kind === "place" && typeof input.id === "string"
      && (Object.hasOwn(project.spatialAuthoring?.library.spaces ?? {}, input.id) || (input.id === body.id && kind === "space"))) output.kind = "space";
    return output;
  };
  return { kind, design: convert(body) as Record<string, unknown> };
}

const placeContractTools = new Set(["list_spatial_designs", "get_spatial_design", "upsert_spatial_design", "preview_spatial_build"]);
/** Normalize historical tool calls before validating the currently advertised schema. */
export function normalizePlaceToolArgs(name: string, args: Record<string, unknown>): Record<string, unknown> {
  if (!placeContractTools.has(name)) return args;
  const normalized = publicSpatialValue(args) as Record<string, unknown>;
  if (name === "upsert_spatial_design" && args.kind === "space" && args.space !== undefined && args.place === undefined) {
    normalized.place = normalized.space;
    delete normalized.space;
  }
  return normalized;
}
