// 픽셀이 아닌 리소스(오디오·동영상)의 가져오기 규칙과 실행.
//
// 이미지 가져오기는 크기 규격 검사가 본질이라 resourceManager.ts 에 남는다.
// 여기 규칙은 "어떤 컨테이너를 받아 어떤 id 로 등록하는가" 하나만 소유한다.
import { store } from "@/project/store";
import type { ResourceKind, UploadedAsset } from "@/project/types";
import { genId } from "@/util/id";
import { toast } from "@/util/toast";
import { isStorageQuotaError, ProjectStorageQuotaError } from "@/project/storageQuota";
import { persistMediaImport } from "./mediaImportPersistence";

export type MediaImportRule = {
  readonly kind: ResourceKind;
  /** <input type="file"> accept 값. */
  readonly accept: string;
  readonly maxBytes: number;
  readonly filePattern: RegExp;
  readonly dataUrlPrefix: string;
  readonly idPrefix: string;
  readonly fileError: string;
  readonly dataError: string;
};

const AUDIO_ACCEPT = "audio/wav,audio/mpeg,audio/ogg,.wav,.mp3,.ogg";
const AUDIO_PATTERN = /\.(wav|mp3|ogg)$/i;
const AUDIO_FILE_ERROR = "WAV/MP3/OGG 파일만 가져올 수 있습니다.";
const AUDIO_DATA_ERROR = "오디오 데이터만 가져올 수 있습니다.";

const MEDIA_IMPORT_RULES: Partial<Record<ResourceKind, MediaImportRule>> = {
  music: {
    kind: "music",
    accept: AUDIO_ACCEPT,
    maxBytes: 8 * 1024 * 1024,
    filePattern: AUDIO_PATTERN,
    dataUrlPrefix: "data:audio/",
    idPrefix: "bgm",
    fileError: AUDIO_FILE_ERROR,
    dataError: AUDIO_DATA_ERROR,
  },
  sound: {
    kind: "sound",
    accept: AUDIO_ACCEPT,
    maxBytes: 8 * 1024 * 1024,
    filePattern: AUDIO_PATTERN,
    dataUrlPrefix: "data:audio/",
    idPrefix: "se",
    fileError: AUDIO_FILE_ERROR,
    dataError: AUDIO_DATA_ERROR,
  },
  movie: {
    kind: "movie",
    // 브라우저 <video> 가 확실히 재생하는 컨테이너만. playMoviePreview 의 화이트리스트와 같은 집합이다.
    accept: "video/webm,video/mp4,video/ogg,.webm,.mp4,.m4v,.ogv",
    maxBytes: 32 * 1024 * 1024,
    filePattern: /\.(webm|mp4|m4v|ogv)$/i,
    dataUrlPrefix: "data:video/",
    idPrefix: "movie",
    fileError: "WEBM/MP4/OGV 파일만 가져올 수 있습니다.",
    dataError: "동영상 데이터만 가져올 수 있습니다.",
  },
};

/** 이 종류가 미디어 파일 가져오기 경로를 타는지. 이미지 종류면 null. */
export function mediaImportRuleFor(kind: "music" | "sound" | "movie"): MediaImportRule;
export function mediaImportRuleFor(kind: ResourceKind): MediaImportRule | null;
export function mediaImportRuleFor(kind: ResourceKind): MediaImportRule | null {
  return MEDIA_IMPORT_RULES[kind] ?? null;
}

/** 파일을 데이터 URL 업로드 + 리소스 프로필로 등록한다. 등록이 끝나면 onImported 로 알린다. */
export function importMediaResource(file: File, rule: MediaImportRule, onImported: (asset: UploadedAsset) => void): void {
  if (file.size > rule.maxBytes) {
    toast(`파일이 너무 큽니다 (${Math.round(rule.maxBytes / 1024 / 1024)}MB 초과).`, "error");
    return;
  }
  if (!rule.filePattern.test(file.name)) {
    toast(rule.fileError, "error");
    return;
  }
  const reader = new FileReader();
  const identity = store.getProjectIdentity();
  let active = true;
  const unsubscribe = store.subscribe((_project, change) => {
    if (!change.projectSwitch) return;
    active = false;
    unsubscribe();
    reader.abort();
  });
  reader.addEventListener("loadend", unsubscribe, { once: true });
  reader.onload = async () => {
    const currentIdentity = store.getProjectIdentity();
    if (!active || identity.kind !== currentIdentity.kind || identity.id !== currentIdentity.id) {
      toast("프로젝트가 바뀌어 가져오기를 취소했습니다.", "info");
      return;
    }
    const dataUrl = String(reader.result ?? "");
    if (!dataUrl.startsWith(rule.dataUrlPrefix)) {
      toast(rule.dataError, "error");
      return;
    }
    const id = genId(rule.idPrefix);
    const asset: UploadedAsset & { readonly kind: ResourceKind } = {
      id,
      name: file.name.replace(/\.[^.]+$/, ""),
      kind: rule.kind,
      dataUrl,
      meta: {},
    };
    try {
      if (!await persistMediaImport(asset)) return;
      toast(`가져오기 완료: ${asset.name}`, "ok");
      onImported(asset);
    } catch (error) {
      const message = isStorageQuotaError(error)
        ? new ProjectStorageQuotaError(error).message
        : error instanceof Error ? error.message : String(error);
      toast(`미디어 저장 실패: ${message}`, "error");
    }
  };
  reader.onerror = () => toast("파일을 읽지 못했습니다.", "error");
  reader.readAsDataURL(file);
}
