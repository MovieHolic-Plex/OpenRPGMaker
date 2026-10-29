// src/editor/assetStore/storeText.ts
/**
 * 스토어 창의 사람 문장 — 라이선스 한 문장, 「넣으면 무엇이 들어오나」, 크기, 오류를 고칠 방법과 함께.
 * 순수 함수다. 문장은 한국어 원문 한 덩어리(템플릿 리터럴)로 만든다 — DOM 번역기가 `{0}` 템플릿으로 통째로 옮긴다
 * (openwiki/i18n.md 「문장을 조각으로 이어 붙이지 마라」).
 */
import type { StoreItemKind, StoreLicense } from "@/assetStore/format";
import type { Project } from "@/project/types";
import type { StoreFailure } from "./storeBridge";

/** 첫 화면 큰 칸: 처음 온 사람이 아는 낱말로. `kind` 는 서버 목록 거르기 값이다. */
export const STORE_HOME_CATEGORIES: readonly { kind: StoreItemKind; label: string; hint: string }[] = [
  { kind: "tileset", label: "땅·건물 타일", hint: "맵을 칠하는 바닥·벽·집" },
  { kind: "character", label: "캐릭터", hint: "걸어 다니는 주인공·마을 사람" },
  { kind: "music", label: "음악", hint: "마을·전투·동굴 배경음악" },
  { kind: "sound", label: "효과음", hint: "문 열기·아이템·타격 소리" },
  { kind: "pack", label: "게임 시작 세트", hint: "타일·캐릭터·음악을 한 번에" },
  { kind: "face", label: "얼굴·초상", hint: "대화창에 나오는 얼굴" },
];

/** 바이트를 사람이 읽는 크기로(1.9MB). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)}MB`;
}

/** 이보다 크면 받기 전에 한 번 묻는다(팩 상한 160MB 안에서도 사람이 놀라는 크기). */
export const STORE_LARGE_DOWNLOAD_BYTES = 50 * 1024 * 1024;

/** 라이선스와 크레딧을 한 문장으로. 작가 이름은 데이터라 템플릿 자리로 넣는다. */
export function licenseSentence(license: StoreLicense, author: string): string {
  switch (license) {
    case "CC0": return "누구나 조건 없이 쓸 수 있어요. 크레딧을 적지 않아도 돼요.";
    case "CC-BY-4.0": return `게임에 자유롭게 쓸 수 있고, 크레딧에 「${author}」 이름이 자동으로 들어가요.`;
    case "CC-BY-SA-4.0": return `게임에 쓸 수 있고 크레딧에 「${author}」 이름이 자동으로 들어가요. 고쳐서 다시 나눌 때는 같은 조건으로 나눠야 해요.`;
    case "OPRN-GAME": return "내 게임 안에서는 자유롭게 쓸 수 있어요. 그림·소리 파일만 따로 떼어 나눠 주면 안 돼요.";
    case "REFMAP-MODIFIED": return "REFMAP 그림을 고친 것이에요. 게임(무료·유료)에 자유롭게 쓸 수 있고, 크레딧에 「REFMAP」과 고쳤다는 표시가 자동으로 들어가요.";
  }
}

/** 상세에서 넣기 전에 보여 줄 「들어오는 것」 한 문장. 서버 상세는 개수만 준다. */
export function contentsSentence(kind: StoreItemKind, counts: { tilesets: number; assets: number; referenceDocuments: number }): string {
  const files = Math.max(0, counts.assets - counts.tilesets);
  if (counts.tilesets > 0 && files > 0) return `타일셋 ${counts.tilesets}개와 그림·소리 ${files}개가 내 프로젝트에 들어가요.`;
  if (counts.tilesets > 0) return counts.referenceDocuments > 0
    ? `타일셋 ${counts.tilesets}개가 들어가요. 깔기 안내 ${counts.referenceDocuments}개가 있어 조수가 바로 칠할 수 있어요.`
    : `타일셋 ${counts.tilesets}개가 내 프로젝트에 들어가요.`;
  if (kind === "music") return `음악 ${counts.assets}곡이 내 프로젝트에 들어가요.`;
  if (kind === "sound") return `효과음 ${counts.assets}개가 내 프로젝트에 들어가요.`;
  if (kind === "character") return `캐릭터 그림 ${counts.assets}장이 들어가요. 한 장에 캐릭터 8명이 있어요.`;
  return `그림·소리 ${counts.assets}개가 내 프로젝트에 들어가요.`;
}

export interface LandedSummary {
  readonly tiles: number;
  readonly characters: number;
  readonly pictures: number;
  readonly music: number;
  readonly sounds: number;
}

/** 넣은 뒤 실제로 프로젝트에 들어온 것을 센다(타일 칸·캐릭터 명·곡). */
export function landedSummary(project: Project, assetIds: readonly string[], tilesetIds: readonly string[]): LandedSummary {
  const tilesetImages = new Set(tilesetIds.flatMap((id) => {
    const image = project.tilesets[id]?.image;
    return image?.type === "uploaded" ? [image.id] : [];
  }));
  let characters = 0, pictures = 0, music = 0, sounds = 0;
  for (const id of assetIds) {
    const asset = project.assets.uploaded[id];
    if (!asset || tilesetImages.has(id)) continue;
    if (asset.kind === "charset") characters += 8;
    else if (asset.kind === "music") music += 1;
    else if (asset.kind === "sound") sounds += 1;
    else pictures += 1;
  }
  const tiles = tilesetIds.reduce((sum, id) => sum + (project.tilesets[id]?.count ?? 0), 0);
  return { tiles, characters, pictures, music, sounds };
}

/** 「타일 3,456칸 · 캐릭터 16명 · 음악 1곡이 들어왔어요」 — 한 덩어리 문장들을 고른다(조각 이어 붙이기 금지). */
export function landedLines(summary: LandedSummary): string[] {
  const lines: string[] = [];
  if (summary.tiles > 0) lines.push(`타일 ${summary.tiles.toLocaleString("en-US")}칸 → 타일 팔레트`);
  if (summary.characters > 0) lines.push(`캐릭터 ${summary.characters}명 → 캐릭터 그림 목록`);
  if (summary.pictures > 0) lines.push(`그림 ${summary.pictures}장 → 리소스 목록`);
  if (summary.music > 0) lines.push(`음악 ${summary.music}곡 → 음악 목록`);
  if (summary.sounds > 0) lines.push(`효과음 ${summary.sounds}개 → 효과음 목록`);
  return lines;
}

export type StoreFixAction = "retry" | "cached" | "report" | "openProject" | "login" | "dismiss";

export interface HumanStoreError {
  readonly title: string;
  readonly hint: string;
  readonly actions: readonly StoreFixAction[];
  /** 원래 문구(접힌 「자세히」 안에만). 사람이 이미 읽을 수 있는 한국어면 비운다. */
  readonly detail: string;
}

const looksInternal = (text: string): boolean => /^[\x20-\x7e]+$/.test(text) && /[a-z]/i.test(text);

/**
 * 스토어·넣기 오류를 「무슨 일 + 어떻게 하면 되나 + 누를 단추」로 바꾼다.
 * 원문은 그대로 보이되 접힌 자세히 안에만 둔다 — 내부 영어 오류(TypeError 등)가 제목이 되지 않게.
 */
export function humanStoreError(failure: StoreFailure): HumanStoreError {
  const message = failure.message.trim();
  const raw = [message, ...failure.details].filter(Boolean).join("\n");
  if (failure.status === 401 || /로그인이 만료|먼저 로그인|로그인이 필요/.test(message)) {
    return { title: "다시 로그인해 주세요", hint: "로그인이 끝났거나 만료되었어요. 둘러보기와 넣기는 로그인 없이도 돼요.", actions: ["login", "dismiss"], detail: "" };
  }
  if (/열린 프로젝트 폴더가 없습니다/.test(message)) {
    return { title: "먼저 프로젝트를 열어 주세요", hint: "에셋은 열려 있는 프로젝트 폴더에 들어가요. 프로젝트를 열거나 새로 만든 뒤 다시 눌러 주세요.", actions: ["openProject", "dismiss"], detail: "" };
  }
  if (/읽기 전용|쓰기 권한/.test(message)) {
    return { title: "이 프로젝트는 지금 고칠 수 없어요", hint: "이 프로젝트를 보기 전용으로 열었거나 폴더에 쓸 권한이 없어요.", actions: ["dismiss"], detail: "" };
  }
  if (failure.status === 0 && /연결하지 못했습니다|fetch failed|ECONNREFUSED|ENOTFOUND|network/i.test(raw)) {
    return { title: "스토어에 연결할 수 없어요", hint: "인터넷 연결을 확인하고 다시 시도해 주세요. 이미 받아 둔 에셋은 인터넷 없이도 프로젝트에 넣을 수 있어요.", actions: ["retry", "cached"], detail: raw };
  }
  if (failure.status === 429) return { title: "잠시 뒤에 다시 해 주세요", hint: "짧은 시간에 요청이 많았어요. 1분쯤 뒤에 다시 눌러 주세요.", actions: ["retry", "dismiss"], detail: "" };
  if (failure.status === 404 || /찾지 못했습니다|없는 주소/.test(message)) {
    return { title: "이 에셋을 찾을 수 없어요", hint: "작가가 내렸거나 아직 검토 중이에요. 목록을 새로 불러와 주세요.", actions: ["retry", "dismiss"], detail: raw };
  }
  if (/oprn-store-pack\/1/.test(raw)) {
    return { title: "더 새 편집기가 필요한 에셋이에요", hint: "편집기를 최신 버전으로 업데이트한 뒤 다시 넣어 주세요.", actions: ["dismiss"], detail: raw };
  }
  if (/너무 큽니다|160MB|32MB|413/.test(raw) || failure.status === 413) {
    return { title: "파일이 너무 커요", hint: "스토어가 받는 크기(파일 하나 32MB, 묶음 160MB)를 넘었어요.", actions: ["dismiss"], detail: raw };
  }
  if (/해시|손상|깨졌습니다|빠졌습니다|형식이 팩 설명과|형식이 올바르지|잘렸습니다|칸 수/.test(raw)) {
    return { title: "받은 파일이 손상되었거나 잘못 만들어졌어요", hint: "내 프로젝트는 바뀌지 않았어요. 다시 시도해 보고, 또 그러면 신고해 주세요.", actions: ["retry", "report", "dismiss"], detail: raw };
  }
  if (looksInternal(message)) {
    return { title: "이 에셋을 넣지 못했어요", hint: "내 프로젝트는 바뀌지 않았어요. 다시 시도해 보고, 또 그러면 신고해 주세요.", actions: ["retry", "report", "dismiss"], detail: raw };
  }
  return { title: message || "알 수 없는 문제가 생겼어요", hint: failure.details.length > 0 ? "" : "다시 시도해 주세요.", actions: ["retry", "dismiss"], detail: failure.details.join("\n") };
}
