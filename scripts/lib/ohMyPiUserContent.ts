import type { ImageContent, TextContent } from "@oh-my-pi/pi-ai";

export class ImageTransportError extends Error {
  readonly status = 400;
  constructor(readonly code: string, message: string, readonly partIndex?: number) {
    super(message);
    this.name = "ImageTransportError";
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function hasImagePart(content: unknown): boolean {
  return Array.isArray(content) && content.some(part => record(part) && (part.type === "image_url" || part.type === "image"));
}

function matchesImageHeader(bytes: Buffer, mimeType: string): boolean {
  if (mimeType === "image/png") return bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/jpeg") return bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mimeType === "image/gif") return bytes.length >= 14 && ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6));
  return bytes.length >= 16 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}

/** Only inline images are supported: never fetch remote URLs or silently discard parts. */
export function convertUserContent(content: unknown, supportsImages: boolean): (TextContent | ImageContent)[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (content === null || content === undefined) return [];
  if (!Array.isArray(content)) throw new ImageTransportError("invalid-content", "User content must be text or an array of content parts");
  return content.map((part, index) => {
    if (record(part) && part.type === "text" && typeof part.text === "string") return { type: "text", text: part.text };
    if (!record(part) || part.type !== "image_url" || !record(part.image_url) || typeof part.image_url.url !== "string") {
      throw new ImageTransportError("invalid-content-part", `User content[${index}] must be text or image_url with a URL`, index);
    }
    if (!supportsImages) throw new ImageTransportError("unsupported-model-image", "Selected provider model does not support image input");
    const match = /^data:(image\/(?:png|jpeg|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(part.image_url.url);
    const mimeType = match?.[1], data = match?.[2];
    if (!mimeType || !data || data.length % 4 !== 0 || Buffer.from(data, "base64").toString("base64") !== data) {
      throw new ImageTransportError("invalid-image-url", `User content[${index}] requires a nonempty base64 PNG, JPEG, GIF or WebP data URL`, index);
    }
    if (!matchesImageHeader(Buffer.from(data, "base64"), mimeType)) {
      throw new ImageTransportError("invalid-image-data", `User content[${index}] bytes do not match the declared image MIME type`, index);
    }
    const detail = part.image_url.detail;
    if (detail !== undefined && detail !== "auto" && detail !== "low" && detail !== "high") {
      throw new ImageTransportError("invalid-image-detail", `User content[${index}] detail must be auto, low or high`, index);
    }
    return { type: "image", mimeType, data, ...(detail === undefined ? {} : { detail }) };
  });
}
