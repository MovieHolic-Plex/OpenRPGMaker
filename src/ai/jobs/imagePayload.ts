import { assert, requireArray, requireNumber, requireRecord, requireString } from "@/project/io/guards";
import { validateCommandArray } from "@/project/io/shapeCommandFields";
import { m2CommandById } from "@/project/eventCommands/m2Catalog";
import { enumValue } from "./assistantPayload";
import { jsonObject } from "./checkpointState";
import type { BlobRef, JsonObject } from "./contracts";
import { parseReportAssets } from "./reportAssets.mjs";
import type { GeneratedPictureKind } from "@/editor/generatedPictureAsset";

/** Prompt already includes the field's kind prefix. resourceId is allocated at admission;
 * facesets must retain the foreground '-bust' convention. No callbacks or live handles. */
export interface ImageJobPayload {
  readonly prompt: string;
  readonly model?: string;
  readonly resourceId: string;
  readonly name: string;
  readonly kind: GeneratedPictureKind;
  readonly postprocess: "none" | "flatten";
  readonly reportAssets?: Record<string, BlobRef>;
}
export type ImageJobDestination =
  | { readonly kind: "database"; readonly table: "actors"; readonly recordId: string; readonly field: "faceResourceId" }
  | { readonly kind: "database"; readonly table: "enemies"; readonly recordId: string; readonly field: "monsterResourceId" }
  | { readonly kind: "database"; readonly table: "troops"; readonly recordId: string; readonly field: "previewBackgroundResourceId" }
  | { readonly kind: "database"; readonly table: "terrains"; readonly recordId: string; readonly field: "battleBackgroundResourceId" }
  | { readonly kind: "database"; readonly table: "monsterSpecies"; readonly recordId: string; readonly field: "graphic.monsterResourceId" }
  | { readonly kind: "system"; readonly field: "titleResourceId" | "titleScreen.backgroundResourceId" | "titleScreen.titleGraphic.resourceId" }
  | { readonly kind: "title-layer"; readonly index: number }
  | { readonly kind: "event-draft"; readonly draftId: string; readonly draftRevision: string;
      readonly owner: ImageEventOwner; readonly commandPath: readonly number[];
      readonly binding: "show-picture" | "change-face" | "actor-faceset" | "parallax";
      readonly command: JsonObject };
export type ImageEventOwner =
  | { readonly kind: "map-event"; readonly mapId: string; readonly eventId: string; readonly pageId: string }
  | { readonly kind: "common-event"; readonly commonEventId: string }
  | { readonly kind: "troop"; readonly troopId: string; readonly pageId: string };

/** Create the resource AND link its destination in one later editor transaction.
 * Event drafts additionally require the captured draftRevision and exact command match.
 * A command path/index alone is never an identity or sufficient conflict check. */
export interface ImageJobProposal {
  readonly version: 1;
  readonly kind: "create-image-and-link";
  readonly resource: { readonly id: string; readonly name: string; readonly kind: GeneratedPictureKind;
    readonly artifact: BlobRef; readonly width: number; readonly height: number };
  readonly destination: ImageJobDestination;
  readonly command: JsonObject | null;
}
export function imageString(label: string, value: unknown): string {
  const text = requireString(label, value);
  assert(text.trim().length > 0, `Empty ${label}`);
  return text;
}
export function imageRef(value: unknown, mediaType?: string): BlobRef {
  const r = requireRecord("image blob reference", value);
  const sha256 = imageString("sha256", r.sha256);
  const byteLength = requireNumber("byteLength", r.byteLength);
  const type = imageString("mediaType", r.mediaType);
  assert(/^[a-f0-9]{64}$/.test(sha256) && Number.isSafeInteger(byteLength) && byteLength > 0, "Invalid image blob reference");
  assert(!mediaType || type === mediaType, "Unexpected image blob media type");
  return { sha256, byteLength, mediaType: type };
}
export function parseImageJobPayload(value: unknown): ImageJobPayload {
  const r = requireRecord("image payload", value);
  const kind = enumValue(r.kind, ["picture", "faceset", "title", "backdrop", "monster"]);
  const resourceId = imageString("resourceId", r.resourceId);
  assert(resourceId === resourceId.trim() && !["__proto__", "constructor", "prototype"].includes(resourceId), "Invalid resource ID");
  assert(kind !== "faceset" || resourceId.includes("-bust"), "Faceset resource ID must retain -bust");
  return { prompt: imageString("prompt", r.prompt).trim(), resourceId, name: imageString("name", r.name).trim(), kind,
    model: r.model === undefined ? undefined : imageString("model", r.model),
    postprocess: enumValue(r.postprocess, ["none", "flatten"]),
    ...(r.reportAssets === undefined ? {} : { reportAssets: parseReportAssets(r.reportAssets) }) };
}
export function parseImageJobDestination(value: unknown, imageKind: GeneratedPictureKind): ImageJobDestination {
  const r = requireRecord("image destination", value);
  if (r.kind === "database") {
    const recordId = imageString("recordId", r.recordId);
    if (r.table === "actors" && r.field === "faceResourceId" && imageKind === "faceset") return { kind: r.kind, table: r.table, recordId, field: r.field };
    if (r.table === "enemies" && r.field === "monsterResourceId" && imageKind === "monster") return { kind: r.kind, table: r.table, recordId, field: r.field };
    if (r.table === "troops" && r.field === "previewBackgroundResourceId" && imageKind === "backdrop") return { kind: r.kind, table: r.table, recordId, field: r.field };
    if (r.table === "terrains" && r.field === "battleBackgroundResourceId" && imageKind === "backdrop") return { kind: r.kind, table: r.table, recordId, field: r.field };
    if (r.table === "monsterSpecies" && r.field === "graphic.monsterResourceId" && imageKind === "monster") return { kind: r.kind, table: r.table, recordId, field: r.field };
    throw new Error("Unsupported database image destination");
  }
  if (r.kind === "system") {
    assert(imageKind === "title", "System image must be title artwork");
    return { kind: r.kind, field: enumValue(r.field, ["titleResourceId", "titleScreen.backgroundResourceId", "titleScreen.titleGraphic.resourceId"]) };
  }
  if (r.kind === "title-layer") {
    assert(imageKind === "title", "Layer image must be title artwork");
    const index = requireNumber("layer index", r.index);
    assert(Number.isSafeInteger(index) && index >= 0 && index < 4, "Invalid title layer index");
    return { kind: r.kind, index };
  }
  assert(r.kind === "event-draft", "Unsupported image destination");
  const binding = enumValue(r.binding, ["show-picture", "change-face", "actor-faceset", "parallax"]);
  const expectedKind = binding === "show-picture" ? "picture" : binding === "parallax" ? "backdrop" : "faceset";
  assert(imageKind === expectedKind, "Image kind does not match event field");
  const command = jsonObject(r.command);
  validateCommandArray("image command", [command]);
  if (binding === "show-picture" || binding === "change-face") {
    assert(command.kind === (binding === "show-picture" ? "showPicture" : "changeFace"), "Wrong event command for image binding");
  } else {
    assert(command.kind === "m2Command", "Expected M2 image command");
    const entry = m2CommandById(requireString("commandId", command.commandId));
    assert(entry?.title === (binding === "parallax" ? "Change Parallax Back" : "Change Actor Faceset"), "Wrong M2 image command");
  }
  const commandPath = requireArray("commandPath", r.commandPath).map((part, index) => {
    const n = requireNumber("path segment", part);
    assert(Number.isSafeInteger(n) && (index % 2 === 0 ? n >= 0 : n >= -12), "Invalid command path segment");
    return n;
  });
  assert(commandPath.length > 0 && commandPath.length % 2 === 1, "Invalid command path");
  const o = requireRecord("event owner", r.owner);
  let owner: ImageEventOwner;
  if (o.kind === "map-event") owner = { kind: o.kind, mapId: imageString("mapId", o.mapId), eventId: imageString("eventId", o.eventId), pageId: imageString("pageId", o.pageId) };
  else if (o.kind === "common-event") owner = { kind: o.kind, commonEventId: imageString("commonEventId", o.commonEventId) };
  else { assert(o.kind === "troop", "Invalid event owner"); owner = { kind: o.kind, troopId: imageString("troopId", o.troopId), pageId: imageString("pageId", o.pageId) }; }
  const draftRevision = imageString("draftRevision", r.draftRevision);
  assert(/^[a-f0-9]{64}$/.test(draftRevision), "Invalid draft revision hash");
  return { kind: r.kind, draftId: imageString("draftId", r.draftId), draftRevision, owner, commandPath, binding, command };
}
