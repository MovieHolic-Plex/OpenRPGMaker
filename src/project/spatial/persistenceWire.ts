import { deserialize, ProjectFormatError } from "../io";
import { requireRecord } from "../io/guards";
import type { Project } from "../types";
import { SpatialPersistenceError, type RawJson, type RawObject, type ServerSHA } from "./persistenceTypes";

/** Parse JSON without interpreting legacy owner fields or normalizing archive content. */
export function rawJson(value: unknown): RawJson {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(rawJson);
  return rawObject(value);
}
export function rawObject(value: unknown): RawObject {
  try {
    return Object.fromEntries(Object.entries(requireRecord("raw JSON object", value)).map(([key, entry]) => [key, rawJson(entry)]));
  } catch (error) {
    if (error instanceof ProjectFormatError) throw new SpatialPersistenceError("invalid-response", error.message);
    throw error;
  }
}
export function serverSHA(value: unknown): ServerSHA {
  const valid = (token: unknown): token is ServerSHA => typeof token === "string" && token.trim().length > 0;
  if (!valid(value)) throw new SpatialPersistenceError("sha-unavailable", "The root has no usable server-issued SHA; reload or explicit migration is required.");
  return value;
}
/** Deserialization only touches an independent preview. Raw version and marker are checked first. */
export function projectPreview(raw: RawObject, canonical: boolean): Project {
  try {
    if (canonical && (raw.version !== 4 || !Object.hasOwn(raw, "spatialAuthoring"))) {
      throw new SpatialPersistenceError("invalid-project", "Canonical publication requires raw project v4 with a spatial document.");
    }
    return deserialize(JSON.stringify(raw));
  } catch (error) {
    if (error instanceof ProjectFormatError) throw new SpatialPersistenceError("invalid-project", error.message);
    throw error;
  }
}
export function assertTarget(value: unknown, projectId: string): void {
  if (value !== projectId) throw new SpatialPersistenceError("invalid-response", "Response project identity differs from the requested target.");
}
