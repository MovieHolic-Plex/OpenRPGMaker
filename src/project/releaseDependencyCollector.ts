import { BUNDLED_IMAGE_ASSETS } from "../assets/bundled";
import { resolveAssetResourceUrl } from "../assets/generatedAssetResourceResolver";
import { collectResourceIds, validateOptionalResource } from "./io/resourceReferenceValidation";
import { contractPath, assertUniquePaths } from "./playerDeploymentPaths";
import { collectWebExportAssets, dataUrlBytes, isAudioCatalogRow } from "./webExportAssets";
import type { Project } from "./types";
import type { ReleaseDependency } from "./releaseDependencies";
import { m2CommandById } from "./eventCommands/m2Catalog";
import { validateOptionalCommandResource } from "./io/commandReferenceValidation";

/** Bundled with its resource catalogs at build time. No deserialize, repair, I/O or project writes. */
export function collectReleaseDependencies(projectJson: string): readonly ReleaseDependency[] {
  const project: Project = JSON.parse(projectJson);
  const known = collectResourceIds(project);
  for (const asset of BUNDLED_IMAGE_ASSETS) known.add(asset.textureKey);
  const assets = collectWebExportAssets(project);
  const dependencies = new Map<string, ReleaseDependency>(assets.map(asset => [asset.zipPath,
    asset.kind === "public" ? { path: asset.zipPath } : { path: asset.zipPath, dataUrl: asset.asset.dataUrl }]));
  const resolving = new Set<string>();
  // Only these exact map slots support no selection. Never relax mandatory image
  // definitions or similarly named fields elsewhere in the authored project.
  const optionalMapResources = new Map<object, "imageId" | "resourceId">();
  for (const map of Object.values(project.maps)) {
    if (map.background) optionalMapResources.set(map.background, "imageId");
    if (map.bgm) optionalMapResources.set(map.bgm, "resourceId");
  }
  const resolve = (id: unknown, commandResource = false): void => {
    if (typeof id !== "string") throw new Error("Invalid authored resource reference");
    if (commandResource) {
      validateOptionalCommandResource("release command", id, known);
      if (id.trim().length === 0) return;
    } else validateOptionalResource("release resource", id, known);
    // Logical IDs are opaque; locality and path safety belong to the resolved payload below.
    if (resolving.has(id)) throw new Error("Cyclic sprite reference");
    const sprite = Object.hasOwn(project.assets.sprites, id) ? project.assets.sprites[id] : undefined;
    if (sprite) {
      resolving.add(id); resolve(sprite.image.id); resolving.delete(id); return;
    }
    const bundled = BUNDLED_IMAGE_ASSETS.find(asset => asset.textureKey === id);
    const uploaded = Object.hasOwn(project.assets.uploaded, id) ? project.assets.uploaded[id] : undefined;
    if (uploaded && uploaded.id !== id) throw new Error("Uploaded resource identity mismatch");
    const url = bundled ? `/${bundled.path}` : resolveAssetResourceUrl(id, { project });
    if (!url) throw new Error("Unresolved authored resource");
    if (url.startsWith("data:")) { validateEmbeddedMedia(url); return; }
    if (!url.startsWith("/") || url.startsWith("//")) throw new Error("External authored resource");
    const path = contractPath(url.slice(1));
    if (/[?#%]/u.test(path)) throw new Error("Invalid authored resource path");
    dependencies.set(path, { path });
  };
  const walk = (value: unknown, parentKey = "", commandResource = false): void => {
    if (Array.isArray(value)) { for (const child of value) walk(child, parentKey, commandResource); return; }
    if (!value || typeof value !== "object") return;
    commandResource ||= "kind" in value && typeof value.kind === "string";
    if ("kind" in value && value.kind === "m2Command" && "commandId" in value && typeof value.commandId === "string"
      && "fields" in value && value.fields && typeof value.fields === "object") {
      const entry = m2CommandById(value.commandId);
      const fields = value.fields;
      // These retained commands use the legacy generic value slot, not ResourceId-named fields.
      if (entry && (entry.fields.some(field => field.key === "resourceId")
        || ["playAudio", "showPicture", "changeFace"].includes(entry.existingKind ?? "")
        || ["Change Actor Graphic", "Change Actor Faceset", "Change Vehicle Graphic", "Change System Graphic", "Change Battleback"].includes(entry.title))
        && "value" in fields) resolve(fields.value, true);
    }
    for (const [key, child] of Object.entries(value)) {
      if (key === "uploaded" || key === "audioDescriptions") continue;
      if (value === project && key === "monsterMetadata") continue;
      // Map BGM treats whitespace-only selection as inheritance; background's
      // editor clear value is exactly empty. Nonempty IDs still resolve strictly.
      if (optionalMapResources.get(value) === key && typeof child === "string"
        && (key === "resourceId" ? child.trim() === "" : child === "")) continue;
      if (key === "resourceProfiles" && Array.isArray(child)) { walk(child.filter(row => !isAudioCatalogRow(row))); continue; }
      if (key === "orientationGraphicResourceIds" && child && typeof child === "object") {
        for (const id of Object.values(child)) resolve(id);
      } else if (/^(?:resourceId|.*ResourceId|assetId|spriteId|textureKey|sourceChipset|imageId|portraitId|battleBackground|faceUrl|imageUrl|audioUrl|movieUrl)$/.test(key)
        || (key === "id" && ["image", "sprite"].includes(parentKey))) {
        if (key === "id" && "type" in value && value.type === "uploaded"
          && (typeof child !== "string" || !Object.hasOwn(project.assets.uploaded, child))) throw new Error("Missing uploaded resource");
        // Image/sprite definitions are mandatory, even under a tileset's `kind`.
        resolve(child, key !== "id" && commandResource);
      } else walk(child, key, commandResource);
    }
  };
  walk(project);
  for (const dependency of dependencies.values()) {
    contractPath(dependency.path);
    if (dependency.dataUrl !== undefined) validateEmbeddedMedia(dependency.dataUrl);
  }
  const result = [...dependencies.values()].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  assertUniquePaths(result.map(item => item.path));
  return result;
}

function validateEmbeddedMedia(value: string): void {
  const match = /^data:(image\/(?:png|jpeg|gif|webp)|audio\/(?:mpeg|wav|ogg)|video\/(?:mp4|webm|ogg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) throw new Error("Invalid embedded media");
  const bytes = dataUrlBytes(value);
  const starts = (...signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  const text = (offset: number, length: number) => String.fromCharCode(...bytes.subarray(offset, offset + length));
  const valid = match[1] === "image/png" ? bytes.length >= 45 && starts(137, 80, 78, 71, 13, 10, 26, 10) && text(12, 4) === "IHDR" && text(bytes.length - 8, 4) === "IEND"
    : match[1] === "image/jpeg" ? bytes.length > 4 && starts(255, 216, 255) && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217
    : match[1] === "image/gif" ? bytes.length > 13 && /^(GIF87a|GIF89a)$/.test(text(0, 6)) && bytes[bytes.length - 1] === 59
    : match[1] === "image/webp" ? bytes.length > 20 && text(0, 4) === "RIFF" && text(8, 4) === "WEBP"
    : match[1] === "audio/wav" ? bytes.length >= 44 && text(0, 4) === "RIFF" && text(8, 4) === "WAVE"
    : match[1].endsWith("/ogg") ? bytes.length > 27 && text(0, 4) === "OggS"
    : match[1] === "audio/mpeg" ? bytes.length > 10 && (text(0, 3) === "ID3" || (bytes[0] === 255 && (bytes[1] & 224) === 224))
    : match[1] === "video/mp4" ? bytes.length > 16 && text(4, 4) === "ftyp"
    : bytes.length > 16 && starts(26, 69, 223, 163);
  if (!valid) throw new Error("Invalid embedded media payload");
}
