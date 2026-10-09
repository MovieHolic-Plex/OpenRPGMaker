import { requireArray, requireBoolean, requireNumber, requireRecord, requireString } from "./guards";

export function validateLightingState(label: string, value: unknown): void {
  const lighting = requireRecord(label, value);
  requireNumber(`${label}.ambient`, lighting.ambient);
  if (lighting.color !== undefined) requireString(`${label}.color`, lighting.color);
  for (const [index, sourceValue] of requireArray(`${label}.sources`, lighting.sources).entries()) {
    validateLightSource(`${label}.sources[${index}]`, sourceValue);
  }
}

export function validateLightSource(label: string, value: unknown): void {
  const source = requireRecord(label, value);
  requireString(`${label}.id`, source.id);
  validateLightAnchor(`${label}.at`, source.at);
  requireNumber(`${label}.radius`, source.radius);
  if (source.intensity !== undefined) requireNumber(`${label}.intensity`, source.intensity);
  if (source.color !== undefined) requireString(`${label}.color`, source.color);
  if (source.flicker !== undefined) requireBoolean(`${label}.flicker`, source.flicker);
}

function validateLightAnchor(label: string, value: unknown): void {
  if (value === "player") return;
  const anchor = requireRecord(label, value);
  if (anchor.eventId !== undefined) {
    requireString(`${label}.eventId`, anchor.eventId);
    return;
  }
  requireNumber(`${label}.x`, anchor.x);
  requireNumber(`${label}.y`, anchor.y);
}
