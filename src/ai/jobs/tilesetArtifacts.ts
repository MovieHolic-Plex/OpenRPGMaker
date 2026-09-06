import { assert } from "@/project/io/guards";
import type { AiJobHost } from "../../../scripts/lib/aiJobs/scheduler.mjs";
import type { BlobRef } from "./contracts";

export async function tilesetImageDataUrl(host: AiJobHost, ref: BlobRef): Promise<string> {
  const bytes = await host.readBlob(ref);
  assert(bytes.byteLength === ref.byteLength && bytes.byteLength > 0, "Invalid captured image length");
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return `data:${ref.mediaType};base64,${btoa(binary)}`;
}
export async function retainTilesetImage(host: AiJobHost, dataUrl: string): Promise<BlobRef> {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  assert(match !== null, "Renderer did not return an image data URL");
  const binary = atob(match[2]!);
  return host.putBlob(Uint8Array.from(binary, c => c.charCodeAt(0)), match[1]!);
}

export function uniqueTilesetArtifacts(refs: readonly BlobRef[]): BlobRef[] {
  return [...new Map(refs.map(ref => [`${ref.sha256}/${ref.mediaType}`, ref])).values()];
}
