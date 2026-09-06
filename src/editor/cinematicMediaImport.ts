import {
  decideImageImport,
  IMAGE_IMPORT_MAX_BYTES,
} from "@/editor/panels/resourceManagerImageImport";
import { mediaImportRuleFor } from "@/editor/panels/resourceManagerMediaImport";
import type { UploadedAsset } from "@/project/types";
import { genId } from "@/util/id";

const PREPARATION_TIMEOUT_MS = 15_000;

const MEDIA_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  ogg: "audio/ogg",
  webm: "video/webm",
  mp4: "video/mp4",
  m4v: "video/mp4",
  ogv: "video/ogg",
};

/**
 * Prepare an asset only. The caller owns project/scene freshness, resource-profile
 * registration and the single labelled, undoable authoring transaction.
 *
 * Unlike the resource manager's image import, this never rasterizes animation.
 * A MIME correction changes only the data URL header, never the file bytes.
 */
export async function prepareCinematicUpload(
  file: File,
  kind: "image" | "video" | "audio",
  signal: AbortSignal,
): Promise<UploadedAsset> {
  signal.throwIfAborted();
  if (file.size === 0) throw new RangeError("빈 파일은 가져올 수 없습니다.");

  const assetKind = kind === "image" ? "picture" : kind === "video" ? "movie" : "sound";
  let mime: string;
  let idPrefix: string;
  if (kind === "image") {
    const decision = decideImageImport({
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    if (!decision.ok) {
      // Do not reuse the legacy message promising GIF/WebP flattening.
      if (decision.reason === "size") {
        throw new RangeError(`이미지는 ${IMAGE_IMPORT_MAX_BYTES / 1024 / 1024}MB 이하여야 합니다.`);
      }
      throw new TypeError("PNG/JPEG/WebP/GIF 이미지만 가져올 수 있습니다.");
    }
    mime = `image/${decision.format}`;
    idPrefix = "picture_img";
  } else {
    // Both kinds have existing, mandatory resource-manager rules.
    const rule = mediaImportRuleFor(kind === "video" ? "movie" : "sound");
    if (file.size > rule.maxBytes) {
      throw new RangeError(`파일은 ${rule.maxBytes / 1024 / 1024}MB 이하여야 합니다.`);
    }
    const extension = file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase();
    const detectedMime = MEDIA_MIME_BY_EXTENSION[extension];
    if (!rule.filePattern.test(file.name) || !detectedMime) throw new TypeError(rule.fileError);
    mime = detectedMime;
    const declaredMime = file.type.trim().toLowerCase()
      .replace(/^audio\/x-wav$/, "audio/wav")
      .replace(/^video\/x-m4v$/, "video/mp4");
    if (declaredMime && declaredMime !== "application/octet-stream" && declaredMime !== mime) {
      throw new TypeError(rule.dataError);
    }
    idPrefix = rule.idPrefix;
  }

  const prepared = await new Promise<{
    dataUrl: string;
    meta: UploadedAsset["meta"];
  }>((resolve, reject) => {
    const reader = new FileReader();
    let image: HTMLImageElement | undefined;
    let media: HTMLMediaElement | undefined;
    let dataUrl = "";
    let settled = false;

    const finish = (error: unknown | null, meta: UploadedAsset["meta"] = {}): void => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      signal.removeEventListener("abort", onAbort);
      reader.onload = null;
      reader.onerror = null;
      reader.onabort = null;
      if (reader.readyState === 1) reader.abort();
      if (image) {
        image.onload = null;
        image.onerror = null;
        image.removeAttribute("src");
      }
      if (media) {
        media.onloadedmetadata = null;
        media.onloadeddata = null;
        media.onerror = null;
        media.onabort = null;
        media.pause();
        media.removeAttribute("src");
        media.load();
      }
      if (error !== null) reject(error);
      else resolve({ dataUrl, meta });
    };
    const onAbort = (): void => {
      finish(signal.reason ?? new DOMException("가져오기를 취소했습니다.", "AbortError"));
    };
    const onDecodeError = (): void => {
      finish(new DOMException("미디어를 읽거나 재생할 수 없습니다.", "EncodingError"));
    };
    const deadline = setTimeout(() => {
      finish(new DOMException("미디어 확인 시간이 초과되었습니다.", "TimeoutError"));
    }, PREPARATION_TIMEOUT_MS);

    signal.addEventListener("abort", onAbort, { once: true });
    reader.onerror = () => {
      finish(reader.error ?? new DOMException("파일을 읽지 못했습니다.", "NotReadableError"));
    };
    reader.onabort = () => {
      finish(new DOMException("파일 읽기를 취소했습니다.", "AbortError"));
    };
    reader.onload = () => {
      const prefix = `data:${mime};base64,`;
      if (
        typeof reader.result !== "string"
        || !reader.result.startsWith(prefix)
        || reader.result.length === prefix.length
      ) {
        finish(new DOMException("파일 데이터가 비어 있거나 올바르지 않습니다.", "NotReadableError"));
        return;
      }
      dataUrl = reader.result;
      try {
        if (kind === "image") {
          const target = new Image();
          image = target;
          target.onerror = onDecodeError;
          target.onload = () => {
            const width = target.naturalWidth;
            const height = target.naturalHeight;
            if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
              onDecodeError();
              return;
            }
            finish(null, { width, height });
          };
          target.src = dataUrl;
          return;
        }

        const video = kind === "video" ? document.createElement("video") : undefined;
        const target = video ?? document.createElement("audio");
        media = target;
        target.preload = "auto";
        target.muted = true;
        target.onerror = onDecodeError;
        target.onabort = onDecodeError;
        const onReady = (): void => {
          // A decoded WebM can report Infinity until its duration is discovered.
          // First-frame data and dimensions, not a known video length, are required.
          if (Number.isNaN(target.duration) || target.duration <= 0 || (!video && !Number.isFinite(target.duration))) {
            onDecodeError();
            return;
          }
          if (video && (
            !Number.isFinite(video.videoWidth)
            || !Number.isFinite(video.videoHeight)
            || video.videoWidth <= 0
            || video.videoHeight <= 0
          )) {
            onDecodeError();
            return;
          }
          // Metadata alone can describe a file whose first frame cannot decode.
          if (target.readyState < 2) return;
          finish(null, video ? { width: video.videoWidth, height: video.videoHeight } : {});
        };
        target.onloadedmetadata = onReady;
        target.onloadeddata = onReady;
        target.src = dataUrl;
        target.load();
      } catch (error) {
        finish(error);
      }
    };

    try {
      // Blob.slice preserves payload bytes while supplying a resolver-safe MIME.
      reader.readAsDataURL(file.slice(0, file.size, mime));
    } catch (error) {
      finish(error);
    }
  });

  // Cover cancellation after the final native event but before this continuation.
  signal.throwIfAborted();
  return {
    id: genId(idPrefix),
    name: file.name.replace(/\.[^.]+$/, ""),
    kind: assetKind,
    dataUrl: prepared.dataUrl,
    meta: prepared.meta,
  };
}
