const DATA_URL_HEADER = /^data:([^;,]+)((?:;[^,]*)*),/;

export function dataUrlMime(dataUrl: string): string | null {
  const match = DATA_URL_HEADER.exec(dataUrl.trim());
  return match?.[1] ?? null;
}

export function isBase64DataUrl(dataUrl: string): boolean {
  const match = DATA_URL_HEADER.exec(dataUrl.trim());
  return match !== null && (match[2] ?? "").includes(";base64");
}

export function dataUrlExtension(dataUrl: string, mime: string): string {
  const explicit = /^data:[^;,]+;[^,]*?(?:name|filename)=([^;,]+)/.exec(dataUrl)?.[1];
  if (explicit) {
    const dot = explicit.lastIndexOf(".");
    if (dot !== -1 && dot < explicit.length - 1) return explicit.slice(dot + 1).toLowerCase();
  }
  const fromMime = mime.split("/")[1]?.split("+")[0];
  if (!fromMime) return "bin";
  if (fromMime === "jpeg") return "jpg";
  if (fromMime === "mpeg") return "mp3";
  return fromMime.toLowerCase();
}

export function encodeDataUrlBytes(bytes: Uint8Array, mime: string): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:${mime};base64,${btoa(binary)}`;
}

export function decodeDataUrlBytes(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(",");
  if (comma === -1) return new Uint8Array();
  const header = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  if (!header.includes(";base64")) return new TextEncoder().encode(decodeURIComponent(payload));
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}