/**
 * 에셋 스토어 팩 형식 `oprn-store-pack/1` — 외부 스토어 서버·Electron 메인·에디터가 같이 쓴다.
 * 이 파일은 편집기·브라우저 모듈을 import 하지 않는다(서버 번들에 들어간다). 타입만 project 에서 빌린다.
 * 설계: docs/superpowers/specs/2026-10-06-asset-store-design.md, 위키 openwiki/asset-store.md.
 */
import type { TilesetDef, UploadedAsset } from "../project/types";
import { validateObjectSpec, type ObjectSpecV1 } from "../project/objectSpec";

export const STORE_PACK_SCHEMA = "oprn-store-pack/1" as const;
/** 매니페스트 안의 data URL 을 대신하는 blob 자리표시. 받을 때 data URL 로 되돌린다. */
export const STORE_BLOB_PREFIX = "oprn-blob:" as const;
export const STORE_SLUG_SEPARATOR = "__" as const;

export const STORE_LICENSES = ["CC0", "CC-BY-4.0", "CC-BY-SA-4.0", "OPRN-GAME", "REFMAP-MODIFIED"] as const;
/**
 * REFMAP-MODIFIED(2026-10-29 사용자 결정): REFMAP 무료 RPG Maker 2000 캐릭터 칩을 고친 그림 전용. 저작권은 REFMAP 에 남아 CC 를 붙일 수 없어
 * REFMAP 약관(https://refmap-l.blog.jp/archives/8633403.html · 8653555.html)을 그대로 옮긴다: 게임(유료·무료)에 자유, 고친 그림은 다시 나눠도 되나
 * 고쳤다는 표기와 「REFMAP」+사이트 주소가 있어야 하고, 고치지 않은 원본은 나누지 않는다. 이 라이선스 상품만 이름의 「refmap」을 허용한다
 * (storeThirdPartyName 의 license 인자). 크레딧에 REFMAP_CREDIT 이 있어야 한다.
 */
export const REFMAP_CREDIT = "REFMAP (http://refmap.wixsite.com/fsm-material), modified";
/**
 * 그림·소리 하나를 어떻게 만들었나(2026-10-20 감독 결정 — AI 표시는 정확해야 한다. 「에이전트가 냈다」와 「AI 가 그렸다」는 다르다).
 * - generative-model: 생성 모델이 만들었다(이미지·소리 생성, LLM 이 픽셀을 직접 찍기 포함). model 필수.
 * - procedural: 스크립트만(색 바꾸기·조각 합성·규칙 생성), 생성 모델 없음. model 을 적지 않는다.
 * - mixed: 둘 다(예: 스크립트로 합성한 칩 + 생성 모델 초상). model 필수.
 * engine = 실제로 돌린 도구(예 "tile-gen 0.2.0", "char-gen compose"). tile-gen·char-gen·에디터가 같은 꼴을 쓴다.
 */
export const STORE_GENERATION_METHODS = ["generative-model", "procedural", "mixed"] as const;
export type StoreLicense = (typeof STORE_LICENSES)[number];
export const STORE_LICENSE_LABELS: Readonly<Record<StoreLicense, string>> = {
  "CC0": "CC0 — 조건 없이 자유 사용",
  "CC-BY-4.0": "CC BY 4.0 — 저작자 표기 후 자유 사용",
  "CC-BY-SA-4.0": "CC BY-SA 4.0 — 저작자 표기, 같은 조건으로 공유",
  "OPRN-GAME": "OPRN 게임 사용 — 게임 안에서는 자유, 원본 파일 재배포 금지",
  "REFMAP-MODIFIED": "REFMAP 약관(고친 그림) — 게임에 자유, 출처·「고침」 표기, 원본 재배포 금지",
};

export const STORE_ITEM_KINDS = ["tileset", "character", "face", "battler", "picture", "music", "sound", "pack"] as const;
export type StoreItemKind = (typeof STORE_ITEM_KINDS)[number];
export const STORE_KIND_LABELS: Readonly<Record<StoreItemKind, string>> = {
  tileset: "타일셋", character: "캐릭터", face: "얼굴", battler: "전투 그림",
  picture: "그림", music: "음악", sound: "효과음", pack: "묶음",
};

/** 스토어가 지원하는 언어(편집기 i18n 과 같은 넷). zh 는 간체. */
export const STORE_LOCALES = ["ko", "en", "ja", "zh"] as const;
export type StoreLocale = (typeof STORE_LOCALES)[number];
export const isStoreLocale = (value: unknown): value is StoreLocale => typeof value === "string" && (STORE_LOCALES as readonly string[]).includes(value);
/** 종류·라이선스의 언어별 이름. 웹 스토어와 편집기 스토어 창이 같이 쓴다(편집기 번역 카탈로그를 거치지 않는다). */
export const STORE_KIND_NAMES: Readonly<Record<StoreItemKind, Readonly<Record<StoreLocale, string>>>> = {
  tileset: { ko: "타일셋", en: "Tilesets", ja: "タイルセット", zh: "图块集" },
  character: { ko: "캐릭터", en: "Characters", ja: "キャラクター", zh: "角色" },
  face: { ko: "얼굴·초상", en: "Faces & portraits", ja: "顔グラ・立ち絵", zh: "头像与立绘" },
  battler: { ko: "전투 그림", en: "Battlers", ja: "バトラー", zh: "战斗图" },
  picture: { ko: "그림", en: "Pictures", ja: "ピクチャー", zh: "图片" },
  music: { ko: "음악", en: "Music", ja: "音楽", zh: "音乐" },
  sound: { ko: "효과음", en: "Sound effects", ja: "効果音", zh: "音效" },
  pack: { ko: "묶음", en: "Bundles", ja: "バンドル", zh: "合集" },
};
export const STORE_LICENSE_NAMES: Readonly<Record<StoreLicense, Readonly<Record<StoreLocale, string>>>> = {
  "CC0": { ko: "CC0 — 조건 없이 자유 사용", en: "CC0 — free to use, no conditions", ja: "CC0 — 条件なしで自由に使用", zh: "CC0 — 无条件自由使用" },
  "CC-BY-4.0": { ko: "CC BY 4.0 — 저작자 표기 후 자유 사용", en: "CC BY 4.0 — free to use with attribution", ja: "CC BY 4.0 — クレジット表記で自由に使用", zh: "CC BY 4.0 — 署名后自由使用" },
  "CC-BY-SA-4.0": { ko: "CC BY-SA 4.0 — 저작자 표기, 같은 조건으로 공유", en: "CC BY-SA 4.0 — attribution, share alike", ja: "CC BY-SA 4.0 — クレジット表記・同条件で共有", zh: "CC BY-SA 4.0 — 署名，以相同方式共享" },
  "OPRN-GAME": { ko: "OPRN 게임 사용 — 게임 안에서는 자유, 원본 파일 재배포 금지", en: "OPRN Game Use — free inside games; no redistribution of source files", ja: "OPRN ゲーム使用 — ゲーム内では自由、元ファイルの再配布は禁止", zh: "OPRN 游戏使用 — 游戏内自由使用，禁止再分发原始文件" },
  "REFMAP-MODIFIED": { ko: "REFMAP 약관(고친 그림) — 게임에 자유, 출처·「고침」 표기, 원본 재배포 금지", en: "REFMAP terms (modified) — free in games; credit REFMAP and note it is modified; no unmodified redistribution", ja: "REFMAP 規約（改変素材）— ゲームに自由、REFMAP 表記と改変の旨を記載、無加工の再配布は禁止", zh: "REFMAP 条款（修改版）— 游戏内自由使用，须注明 REFMAP 及已修改，禁止再分发未修改原图" },
};
export const STORE_LICENSE_SHORT: Readonly<Record<StoreLicense, string>> = { "CC0": "CC0", "CC-BY-4.0": "CC BY 4.0", "CC-BY-SA-4.0": "CC BY-SA 4.0", "OPRN-GAME": "OPRN Game", "REFMAP-MODIFIED": "REFMAP (modified)" };
/** 상품 글의 다른 언어판. 기본 글(title·summary·description)은 작가가 쓴 언어 그대로 두고 여기에 번역을 더한다. */
export interface StoreLocalizedText { title: string; summary: string; description: string }
export type StoreLocalizedTexts = Partial<Record<StoreLocale, StoreLocalizedText>>;

/** 등급: 참고문서가 있는 타일셋이 하나라도 있으면 pack(「조수 사용 가능」). 서버가 판정한다. */
export type StoreGrade = "single" | "pack";
export type StoreItemStatus = "pending" | "visible" | "hidden" | "removed";

export const STORE_BLOB_MIMES = ["image/png", "image/jpeg", "image/webp", "audio/ogg", "audio/mpeg", "audio/wav", "audio/mp4"] as const;
export type StoreBlobMime = (typeof STORE_BLOB_MIMES)[number];

export const STORE_LIMITS = {
  /** 매니페스트 JSON 바이트(자리표시로 바꾼 뒤). 칸 2만 개짜리 타일셋 정의(버들항 8.7MB)와 참고문서 MD 가 이 안에 든다. */
  manifestBytes: 24 * 1024 * 1024,
  blobBytes: 32 * 1024 * 1024,
  packBytes: 160 * 1024 * 1024,
  blobs: 512,
  assets: 256,
  tilesets: 32,
  /** 타일셋 하나의 칸 수 상한(가장 큰 공식 팩 버들항이 2만 4천 칸). */
  tilesetCells: 131_072,
  previews: 6,
  title: 80,
  summary: 160,
  description: 8000,
  credits: 400,
  tags: 12,
  tagLength: 24,
  /** 캐릭터 칸 설명(StorePackCharacter): 에셋 상한 × 8칸. */
  characters: 2048,
  characterLabel: 40,
  characterAppearance: 240,
  /** 기물 설명서(content.objects): 타일셋 하나에 기물 수백 개가 들어간다(버들항 키트 120). */
  objects: 4096,
} as const;

/** 에디터 UploadedAsset.kind 중 스토어로 오갈 수 있는 것. */
export const STORE_ASSET_KINDS = [
  "tileset", "sprite", "chipset", "charset", "faceset", "battle", "battleCharset", "battleWeapon",
  "backdrop", "monster", "picture", "title", "gameOver", "system", "system2", "music", "sound",
] as const;
export type StoreAssetKind = (typeof STORE_ASSET_KINDS)[number];

/**
 * 스토어가 받는 그림 규격 — 에디터가 그대로 쓰는 크기만 받는다(src/assets/resourceSlicing.ts 와 같은 값).
 * 에디터는 규격이 다른 캐릭터 시트를 말없이 건너뛰므로(bundled.ts registerUploadedCharsetTextures), 올릴 때 막는다.
 */
export const STORE_TILE_SIZE = 16;
export const STORE_FIXED_SHEETS: Readonly<Partial<Record<StoreAssetKind, { width: number; height: number; label: string }>>> = {
  charset: { width: 288, height: 256, label: "캐릭터 시트는 24×32 칸 12×8 = 288×256" },
  battleCharset: { width: 144, height: 384, label: "전투 그림은 48×48 칸 3×8 = 144×384" },
  battleWeapon: { width: 192, height: 512, label: "전투 무기는 64×64 칸 3×8 = 192×512" },
};

/** 크기 규격이 있는 종류인가. 얼굴·그림·배경은 크기가 자유다. */
export const storeImageHasSpec = (kind: StoreAssetKind): boolean => Object.hasOwn(STORE_FIXED_SHEETS, kind) || kind === "chipset" || kind === "tileset";

/** 그림 에셋 크기가 규격에 맞지 않으면 사유를, 맞거나 규격이 없는 종류(얼굴·그림 등)면 null 을 돌려준다. */
export function storeImageSizeProblem(kind: StoreAssetKind, width: number, height: number): string | null {
  const fixed = STORE_FIXED_SHEETS[kind];
  if (fixed) return width === fixed.width && height === fixed.height ? null : `${fixed.label} 이어야 합니다(지금 ${width}×${height}).`;
  if (kind === "chipset" || kind === "tileset") {
    return width > 0 && height > 0 && width % STORE_TILE_SIZE === 0 && height % STORE_TILE_SIZE === 0
      ? null : `타일셋은 ${STORE_TILE_SIZE}×${STORE_TILE_SIZE} 칸이라 가로·세로가 ${STORE_TILE_SIZE}의 배수여야 합니다(지금 ${width}×${height}).`;
  }
  return null;
}

export interface StoreBlobRef { readonly sha256: string; readonly mime: StoreBlobMime; readonly bytes: number }

export type StoreGenerationMethod = (typeof STORE_GENERATION_METHODS)[number];
export interface StoreGeneration {
  method: StoreGenerationMethod;
  engine: string;
  /** 생성 모델 이름(예 "claude-opus-5.5"). generative-model·mixed 면 필수, procedural 이면 없음. */
  model?: string;
}

export interface StorePackAsset {
  id: string;
  name: string;
  kind: StoreAssetKind;
  blob: string;
  mime: StoreBlobMime;
  meta: UploadedAsset["meta"];
  /** 만든 방법(선택). 없으면 「AI 생성」으로 친다(팩의 다른 에셋이 방법을 밝힌 경우). */
  generation?: StoreGeneration;
}

/**
 * 캐릭터 칸의 짝 초상(char-gen 캐릭터 세트, 2026-10-20). 같은 팩의 에셋 id 를 가리킨다.
 * face = faceset(48×48 낱장), bust·full = 표정 → picture. 표정 이름은 공용 초상 16표정과 같고 base 가 있어야 한다.
 * extra 는 그 밖의 표정(thinking, hurt …) — 그림으로만 들어오고 대사 표정이 저절로 바꾸지는 않는다.
 * 넣으면 그 칸의 캐릭터 외형(database.characterAppearances)이 생기고 표정 짝이 portraitExpressions 로 들어간다.
 */
export const STORE_PORTRAIT_EXPRESSIONS = [
  "base", "smile", "happy", "content", "surprised", "embarrassed", "doubtful", "serious",
  "annoyed", "angry", "sad", "crying", "worried", "determined", "shy", "wink",
] as const;
export type StorePortraitExpression = (typeof STORE_PORTRAIT_EXPRESSIONS)[number];
export interface StorePackCharacterPortraits {
  face?: string;
  bust?: Partial<Record<StorePortraitExpression, string>>;
  full?: Partial<Record<StorePortraitExpression, string>>;
  extra?: Record<string, { bust?: string; full?: string }>;
}

/**
 * 캐릭터 시트 한 칸의 설명. 팩을 넣으면 프로젝트 charsetLabels(spriteType "uploaded")로 들어가
 * NPC 그림 검색(list_npc_graphics·그래픽 고르기)이 외형으로 찾는다. 없으면 「시트 이름 / 칸 N」으로만 보인다.
 */
export interface StorePackCharacter {
  /** content.assets 의 charset 에셋 id. */
  asset: string;
  /** 0~7(4열×2행). */
  characterIndex: number;
  label: string;
  tags?: string[];
  gender?: "male" | "female" | "none";
  age?: "child" | "youth" | "middle" | "elder";
  appearance?: string;
  /** 이 캐릭터(칩·초상 묶음)를 만든 방법. 칩은 스크립트 + 초상은 생성 모델이면 mixed. */
  generation?: StoreGeneration;
  /** 짝 초상(선택). */
  portraits?: StorePackCharacterPortraits;
}

/**
 * 팩에 든 기물 하나(2026-10-20). 정본은 그 타일셋 구조 킷의 `spec`(ObjectSpec v1)이고, 이 목록은 거기서 만든 사본이다 —
 * 스토어 상품 화면이 타일셋 정의를 다 풀지 않고 「들어 있는 기물」을 보여 주고, tile-gen 이 만든 팩을 같은 꼴로 읽는다.
 */
export interface StorePackObject {
  /** content.tilesets 의 키. */
  tileset: string;
  /** 그 타일셋 structureKits 의 id. */
  kit: string;
  spec: ObjectSpecV1;
}

export interface StorePackContent {
  assets: Record<string, StorePackAsset>;
  tilesets: Record<string, TilesetDef>;
  characters?: StorePackCharacter[];
  /** 기물 설명서 목록(없어도 된다 — 옛 팩·캐릭터·소리 팩). */
  objects?: StorePackObject[];
}

export interface StorePackManifest {
  schema: typeof STORE_PACK_SCHEMA;
  title: string;
  summary: string;
  description: string;
  tags: string[];
  kind: StoreItemKind;
  license: StoreLicense;
  aiGenerated: boolean;
  credits: string;
  /** 다른 언어판(선택). 없는 언어는 기본 글을 보여 준다. */
  locales?: StoreLocalizedTexts;
  content: StorePackContent;
  previews: string[];
  blobs: StoreBlobRef[];
}

/** 프로젝트에 넣은 스토어 에셋의 출처. UploadedAsset.origin 에 남고 크레딧이 여기서 만들어진다. */
export interface StoreAssetOrigin {
  store: string;
  itemSlug: string;
  version: number;
  title: string;
  author: string;
  license: StoreLicense;
  aiGenerated: boolean;
  credits: string;
  url: string;
}

/** 목록·상세 응답(서버 → 앱). */
export interface StoreItemSummary {
  slug: string;
  title: string;
  summary: string;
  kind: StoreItemKind;
  grade: StoreGrade;
  license: StoreLicense;
  aiGenerated: boolean;
  /** 「AI 생성」 표시의 근거(storePackGeneration). 옛 상품·방법을 밝히지 않은 상품은 없다. */
  generation?: StorePackGenerationSummary | null;
  author: string;
  tags: string[];
  latestVersion: number;
  cover: string | null;
  downloads: number;
  updatedAt: string;
  /** 이 상품 글이 있는 언어(기본 글의 언어는 모른다 — 번역이 있는 언어만). */
  languages?: StoreLocale[];
}
export interface StoreItemDetail extends StoreItemSummary {
  description: string;
  credits: string;
  previews: string[];
  status: StoreItemStatus;
  versions: { version: number; createdAt: string; manifestSha256: string; bytes: number }[];
  counts: { tilesets: number; assets: number; referenceDocuments: number };
}
export interface StoreCatalogPage { items: StoreItemSummary[]; total: number; page: number; pageSize: number }

export type Validation<T> = { ok: true; value: T } | { ok: false; errors: string[] };

const SHA256 = /^[0-9a-f]{64}$/;
/** 에셋·타일셋 id. 객체 키로 쓰이므로 프로토타입 이름(__proto__ 등)은 받지 않는다. */
const ASSET_ID = /^(?!(?:__proto__|constructor|prototype)$)[A-Za-z0-9_.:-]{1,120}$/;
/** `--` 는 받지 않는다 — 프로젝트 id 가 slug 의 `-` 를 `_` 로 바꾸므로 `a--b` + `x` 가 `a` + `b__x` 와 같은 id 가 된다. */
export const STORE_SLUG = /^(?!.*--)[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;

export const isSha256 = (value: unknown): value is string => typeof value === "string" && SHA256.test(value);
export const blobPlaceholder = (sha256: string): string => `${STORE_BLOB_PREFIX}${sha256}`;
export function placeholderSha(value: string): string | null {
  if (!value.startsWith(STORE_BLOB_PREFIX)) return null;
  const sha = value.slice(STORE_BLOB_PREFIX.length);
  return isSha256(sha) ? sha : null;
}

/** 값 안의 모든 문자열을 훑어 blob 자리표시의 sha 를 모은다. */
export function collectPlaceholders(value: unknown, into: Set<string> = new Set()): Set<string> {
  if (typeof value === "string") {
    const sha = placeholderSha(value);
    if (sha) into.add(sha);
  } else if (Array.isArray(value)) {
    for (const item of value) collectPlaceholders(item, into);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectPlaceholders(item, into);
  }
  return into;
}

/** 값 안의 문자열을 바꿔 새 값을 만든다(원본은 그대로). */
export function mapStrings(value: unknown, fn: (text: string) => string): unknown {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, fn));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapStrings(item, fn)]));
  }
  return value;
}

const ROMAN_INITIAL = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
const ROMAN_MEDIAL = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
const ROMAN_FINAL = ["", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t"];

/** 한글 음절을 국어의 로마자 표기법(단순화: 음운 변화 없음)으로 옮긴다. 주소 조각용. */
export function romanizeHangul(text: string): string {
  let out = "";
  for (const char of text) {
    const code = char.codePointAt(0)! - 0xac00;
    if (code < 0 || code > 11171) { out += char; continue; }
    out += ROMAN_INITIAL[Math.floor(code / 588)]! + ROMAN_MEDIAL[Math.floor((code % 588) / 28)]! + ROMAN_FINAL[code % 28]!;
  }
  return out;
}

/** 이름·제목에서 URL 조각을 만든다. 한글은 로마자로 옮기고, 남는 것이 없으면 item- 으로 시작한다. */
export function slugify(title: string, suffix: string): string {
  const base = romanizeHangul(title.normalize("NFC")).normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/, "");
  const tail = suffix.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8) || "item";
  return base.length >= 3 ? `${base}-${tail}` : `item-${tail}`;
}

/** content.characters[i].portraits 검사 — 가리키는 에셋의 종류·표정 이름·base. */
function portraitProblems(raw: unknown, assets: Record<string, unknown>, where: string): string[] {
  const out: string[] = [];
  if (!isRecord(raw)) return [`캐릭터 초상 설명이 올바르지 않습니다: ${where}`];
  const kindOf = (id: unknown): unknown => (typeof id === "string" && Object.hasOwn(assets, id) && isRecord(assets[id]) ? (assets[id] as Record<string, unknown>).kind : undefined);
  if (raw.face !== undefined && kindOf(raw.face) !== "faceset") out.push(`캐릭터 얼굴은 팩의 얼굴(faceset) 에셋이어야 합니다: ${where}`);
  for (const mode of ["bust", "full"] as const) {
    const map = raw[mode];
    if (map === undefined) continue;
    if (!isRecord(map)) { out.push(`캐릭터 ${mode} 초상 목록이 올바르지 않습니다: ${where}`); continue; }
    const names = Object.keys(map);
    if (names.length > 0 && !Object.hasOwn(map, "base")) out.push(`캐릭터 ${mode} 초상에 기본(base) 표정이 없습니다: ${where}`);
    for (const name of names) {
      if (!(STORE_PORTRAIT_EXPRESSIONS as readonly string[]).includes(name)) out.push(`캐릭터 ${mode} 초상 표정 이름이 올바르지 않습니다(${name.slice(0, 24)}): ${where}`);
      else if (kindOf(map[name]) !== "picture") out.push(`캐릭터 ${mode} ${name} 초상은 팩의 그림(picture) 에셋이어야 합니다: ${where}`);
    }
  }
  if (raw.extra !== undefined) {
    if (!isRecord(raw.extra) || Object.keys(raw.extra).length > 16) out.push(`캐릭터 추가 표정은 16개 이하의 목록이어야 합니다: ${where}`);
    else {
      for (const [name, pair] of Object.entries(raw.extra)) {
        if (!/^[a-z][a-z0-9-]{0,23}$/u.test(name) || !isRecord(pair)) { out.push(`캐릭터 추가 표정이 올바르지 않습니다(${name.slice(0, 24)}): ${where}`); continue; }
        for (const mode of ["bust", "full"] as const) {
          if (pair[mode] !== undefined && kindOf(pair[mode]) !== "picture") out.push(`캐릭터 추가 표정 ${name} ${mode} 는 그림(picture) 에셋이어야 합니다: ${where}`);
        }
      }
    }
  }
  return out;
}

/** 프로젝트에 넣을 때의 id. 같은 상품의 다음 판본이 같은 id 를 덮어써 맵 참조가 유지된다. */
export const storeProjectId = (slug: string, originalId: string): string => `store_${slug.replace(/-/g, "_")}${STORE_SLUG_SEPARATOR}${originalId}`;

export function packGrade(content: StorePackContent): StoreGrade {
  return Object.values(content.tilesets).some((tileset) => (tileset.referenceDocuments ?? []).some((category) => category.documents.length > 0))
    ? "pack"
    : "single";
}

export function referenceDocumentCount(content: StorePackContent): number {
  return Object.values(content.tilesets).reduce((sum, tileset) => sum + (tileset.referenceDocuments ?? []).reduce((n, c) => n + c.documents.length, 0), 0);
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown, max: number, min = 0): value is string => typeof value === "string" && value.length >= min && value.length <= max;
const includes = <T extends string>(list: readonly T[], value: unknown): value is T => typeof value === "string" && (list as readonly string[]).includes(value);

/** 타일셋이 가리키는 업로드 에셋 id(그림·이식 원본). 번들 칩셋 이름은 받는 쪽 편집기에도 있으므로 뺀다. */
export function tilesetUploadedAssetIds(tileset: TilesetDef, assetIds: ReadonlySet<string>): string[] {
  const ids = new Set<string>();
  if (tileset.image?.type === "uploaded") ids.add(tileset.image.id);
  for (const graft of tileset.tileGrafts ?? []) if (assetIds.has(graft.sourceChipset)) ids.add(graft.sourceChipset);
  return [...ids];
}

/** 붙여 쓰거나 숫자를 붙여도 그대로 드러나는 제3자 팩 이름. */
const THIRD_PARTY_SUBSTRINGS = ["rasak", "라삭", "refmap", "rpgmaker", "알만툴", "쯔꾸르", "ツクール"] as const;
/** 다른 낱말 안에 흔히 들어 있어(pawn, mvp) 낱말 하나로 떨어질 때만 보는 이름. */
const THIRD_PARTY_TOKENS = ["paw", "mv", "mz", "rtp"] as const;

/**
 * 남이 만든 유료·제3자 팩 계열 이름이면 걸린 낱말을, 아니면 null(2026-10-06 결정: Rasak·REFMAP·RPG Maker MV/MZ·PAW 는 스토어에 올리지 않는다).
 * 편집기 buildPack·올리기 화면과 스토어 서버 검열이 같이 쓴다. id·이름에만 쓴다(참고문서 본문의 `layer-model: mz4` 같은 표지는 대상이 아니다).
 * 이름으로 막는 안전장치일 뿐 권리 확인은 올리는 사람 몫이다.
 */
export function storeThirdPartyName(text: string, license?: string): string | null {
  const spaced = text.normalize("NFKC")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/(\p{L})(?=\p{N})|(\p{N})(?=\p{L})/gu, "$1$2 ")
    .toLowerCase();
  const compact = spaced.replace(/[^\p{L}\p{N}]+/gu, "");
  const tokens = new Set(spaced.split(/[^\p{L}\p{N}]+/u));
  // REFMAP 약관 상품(고친 REFMAP 칩)은 「refmap」 만 허용한다 — 다른 제3자 이름은 그대로 막는다.
  const allowed = license === "REFMAP-MODIFIED" ? (word: string) => word !== "refmap" : () => true;
  return THIRD_PARTY_SUBSTRINGS.find((word) => allowed(word) && compact.includes(word)) ?? THIRD_PARTY_TOKENS.find((word) => tokens.has(word)) ?? null;
}

const GENERATION_NAME = 80;

/** generation 객체 하나의 문제(없으면 빈 배열). where = 「에셋 a_x」 같은 사람이 읽는 위치. */
export function storeGenerationProblems(raw: unknown, where: string): string[] {
  if (!isRecord(raw) || !includes(STORE_GENERATION_METHODS, raw.method)) return [`${where}: generation.method 는 ${STORE_GENERATION_METHODS.join("|")} 중 하나여야 합니다.`];
  const out: string[] = [];
  if (!isString(raw.engine, GENERATION_NAME, 1)) out.push(`${where}: generation.engine(실제로 돌린 도구 이름, 1~${GENERATION_NAME}자)이 있어야 합니다.`);
  if (raw.model !== undefined && !isString(raw.model, GENERATION_NAME, 1)) out.push(`${where}: generation.model 은 1~${GENERATION_NAME}자 글이어야 합니다.`);
  if (raw.method === "procedural" && raw.model !== undefined) out.push(`${where}: procedural(생성 모델 없음)인데 generation.model 이 있습니다 — 모델을 썼으면 mixed 입니다.`);
  if (raw.method !== "procedural" && raw.model === undefined) out.push(`${where}: ${raw.method} 이면 쓴 생성 모델 이름(generation.model)을 적어야 합니다.`);
  return out;
}

/** 상품 단위 「만든 방법」 요약. 상품 화면·목록의 표시가 이것으로 정해진다. */
export interface StorePackGenerationSummary {
  /** ai-generated: 생성 모델·섞음이 하나라도 있거나 방법을 안 밝힌 것이 있다. procedural: 전부 스크립트. */
  label: "ai-generated" | "procedural";
  counts: Record<StoreGenerationMethod | "unstated", number>;
  engines: string[];
  models: string[];
}

/**
 * 팩의 만든 방법 요약. 에셋·캐릭터 어디에도 generation 이 없으면 null — 그때는 매니페스트 aiGenerated 가 정한다(사람이 손으로 만든 팩은 false).
 * 하나라도 밝혔으면: 생성 모델·섞음이 있거나 안 밝힌 에셋이 있으면 ai-generated, 전부 procedural 이면 procedural.
 */
export function storePackGeneration(manifest: Pick<StorePackManifest, "content">): StorePackGenerationSummary | null {
  const assets = Object.values(manifest.content?.assets ?? {});
  const characters = manifest.content?.characters ?? [];
  const stated = [...assets, ...characters].map((entry) => entry.generation).filter((g): g is StoreGeneration => Boolean(g));
  if (stated.length === 0) return null;
  const counts: StorePackGenerationSummary["counts"] = { "generative-model": 0, procedural: 0, mixed: 0, unstated: 0 };
  for (const asset of assets) counts[asset.generation?.method ?? "unstated"] += 1;
  for (const character of characters) if (character.generation) counts[character.generation.method] += 1;
  const uniq = (values: (string | undefined)[]): string[] => [...new Set(values.filter((v): v is string => Boolean(v)))].slice(0, 8);
  return {
    label: counts["generative-model"] + counts.mixed + counts.unstated > 0 ? "ai-generated" : "procedural",
    counts, engines: uniq(stated.map((g) => g.engine)), models: uniq(stated.map((g) => g.model)),
  };
}

/** 이 팩을 「AI 생성」으로 표시하는가. 방법을 밝혔으면 요약이, 아니면 aiGenerated 가 정한다. */
export function storeIsAiGenerated(manifest: Pick<StorePackManifest, "aiGenerated" | "content">): boolean {
  const summary = storePackGeneration(manifest);
  return summary ? summary.label === "ai-generated" : manifest.aiGenerated;
}

/**
 * 매니페스트 구조 검증. blob 바이트 검증(시그니처·해시)은 서버가 따로 한다.
 * 실패 문구는 사람이 읽는 한국어다 — 업로드 화면·에디터에 그대로 보인다.
 */
export function validateManifest(input: unknown): Validation<StorePackManifest> {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ["매니페스트가 JSON 객체가 아닙니다."] };
  const m = input;
  if (m.schema !== STORE_PACK_SCHEMA) errors.push(`schema 는 ${STORE_PACK_SCHEMA} 이어야 합니다.`);
  if (!isString(m.title, STORE_LIMITS.title, 2)) errors.push(`제목은 2~${STORE_LIMITS.title}자여야 합니다.`);
  if (!isString(m.summary, STORE_LIMITS.summary)) errors.push(`한 줄 소개는 ${STORE_LIMITS.summary}자 이하여야 합니다.`);
  if (!isString(m.description, STORE_LIMITS.description)) errors.push(`설명은 ${STORE_LIMITS.description}자 이하여야 합니다.`);
  if (!isString(m.credits, STORE_LIMITS.credits)) errors.push(`크레딧 표기는 ${STORE_LIMITS.credits}자 이하여야 합니다.`);
  if (!Array.isArray(m.tags) || m.tags.length > STORE_LIMITS.tags || !m.tags.every((tag) => isString(tag, STORE_LIMITS.tagLength, 1))) {
    errors.push(`태그는 ${STORE_LIMITS.tags}개 이하, 각 ${STORE_LIMITS.tagLength}자 이하여야 합니다.`);
  }
  if (!includes(STORE_ITEM_KINDS, m.kind)) errors.push("종류가 올바르지 않습니다.");
  if (!includes(STORE_LICENSES, m.license)) errors.push("라이선스를 골라야 합니다.");
  else if (m.license === "REFMAP-MODIFIED" && (typeof m.credits !== "string" || !m.credits.includes(REFMAP_CREDIT))) {
    errors.push(`REFMAP 약관 상품은 크레딧에 「${REFMAP_CREDIT}」 를 적어야 합니다.`);
  }
  if (typeof m.aiGenerated !== "boolean") errors.push("AI 생성 여부(aiGenerated)를 밝혀야 합니다.");
  if (m.locales !== undefined) {
    if (!isRecord(m.locales)) errors.push("locales 는 언어별 글 객체여야 합니다.");
    else for (const [locale, text] of Object.entries(m.locales)) {
      if (!isStoreLocale(locale)) { errors.push(`지원하지 않는 언어입니다: ${locale.slice(0, 12)}`); continue; }
      if (!isRecord(text) || !isString(text.title, STORE_LIMITS.title, 2) || !isString(text.summary, STORE_LIMITS.summary) || !isString(text.description, STORE_LIMITS.description)) {
        errors.push(`${locale} 글은 제목 2~${STORE_LIMITS.title}자, 소개 ${STORE_LIMITS.summary}자, 설명 ${STORE_LIMITS.description}자 이하여야 합니다.`);
      }
    }
  }

  const blobs = new Map<string, StoreBlobRef>();
  if (!Array.isArray(m.blobs) || m.blobs.length === 0 || m.blobs.length > STORE_LIMITS.blobs) {
    errors.push(`blob 목록은 1~${STORE_LIMITS.blobs}개여야 합니다.`);
  } else {
    let total = 0;
    for (const raw of m.blobs) {
      if (!isRecord(raw) || !isSha256(raw.sha256) || !includes(STORE_BLOB_MIMES, raw.mime) || !Number.isSafeInteger(raw.bytes) || (raw.bytes as number) <= 0 || (raw.bytes as number) > STORE_LIMITS.blobBytes) {
        errors.push("blob 항목은 sha256·허용 형식·32MB 이하 크기를 가져야 합니다.");
        continue;
      }
      if (blobs.has(raw.sha256)) errors.push(`같은 blob 이 두 번 적혔습니다: ${raw.sha256.slice(0, 12)}`);
      blobs.set(raw.sha256, { sha256: raw.sha256, mime: raw.mime, bytes: raw.bytes as number });
      total += raw.bytes as number;
    }
    if (total > STORE_LIMITS.packBytes) errors.push("팩 전체 크기가 160MB 를 넘습니다.");
  }

  const content = isRecord(m.content) ? m.content : null;
  if (!content || !isRecord(content.assets) || !isRecord(content.tilesets)) {
    errors.push("content.assets 와 content.tilesets 가 있어야 합니다.");
  } else {
    const assets = content.assets as Record<string, unknown>;
    const tilesets = content.tilesets as Record<string, unknown>;
    const assetIds = new Set(Object.keys(assets));
    if (assetIds.size === 0) errors.push("에셋이 하나도 없습니다.");
    if (assetIds.size > STORE_LIMITS.assets) errors.push(`에셋은 ${STORE_LIMITS.assets}개 이하여야 합니다.`);
    if (Object.keys(tilesets).length > STORE_LIMITS.tilesets) errors.push(`타일셋은 ${STORE_LIMITS.tilesets}개 이하여야 합니다.`);
    for (const [id, raw] of Object.entries(assets)) {
      if (!ASSET_ID.test(id) || !isRecord(raw) || raw.id !== id) { errors.push(`에셋 id 가 올바르지 않습니다: ${id.slice(0, 40)}`); continue; }
      if (!isString(raw.name, 120, 1)) errors.push(`에셋 ${id} 의 이름이 없습니다.`);
      if (!includes(STORE_ASSET_KINDS, raw.kind)) errors.push(`에셋 ${id} 의 종류가 올바르지 않습니다.`);
      if (!isSha256(raw.blob) || !blobs.has(raw.blob)) errors.push(`에셋 ${id} 의 blob 이 목록에 없습니다.`);
      else if (blobs.get(raw.blob)!.mime !== raw.mime) errors.push(`에셋 ${id} 의 형식이 blob 과 다릅니다.`);
      if (!isRecord(raw.meta)) errors.push(`에셋 ${id} 의 meta 가 없습니다.`);
      if (raw.generation !== undefined) errors.push(...storeGenerationProblems(raw.generation, `에셋 ${id}`));
    }
    for (const [id, raw] of Object.entries(tilesets)) {
      if (!ASSET_ID.test(id) || !isRecord(raw) || raw.id !== id) { errors.push(`타일셋 id 가 올바르지 않습니다: ${id.slice(0, 40)}`); continue; }
      const tileset = raw as unknown as TilesetDef;
      if (!isRecord(tileset.image) || (tileset.image.type !== "uploaded" && tileset.image.type !== "bundled") || typeof tileset.image.id !== "string") {
        errors.push(`타일셋 ${id} 의 그림 참조가 없습니다.`);
      } else if (tileset.image.type === "uploaded" && !assetIds.has(tileset.image.id)) {
        errors.push(`타일셋 ${id} 의 그림(${tileset.image.id})이 팩에 없습니다.`);
      }
      // 칸 수에 상한을 둔다 — 편집기가 칸마다 도는 곳이 많아 터무니없는 값은 편집기를 멈춘다.
      if (tileset.tileSize !== STORE_TILE_SIZE) errors.push(`타일셋 ${id} 의 칸 크기는 ${STORE_TILE_SIZE}px 이어야 합니다(지금 ${String(tileset.tileSize).slice(0, 8)}).`);
      else if (!Number.isSafeInteger(tileset.count) || tileset.count <= 0 || tileset.count > STORE_LIMITS.tilesetCells
        || !Number.isSafeInteger(tileset.tilesPerRow) || tileset.tilesPerRow <= 0 || tileset.tilesPerRow > 4096) {
        errors.push(`타일셋 ${id} 의 칸 크기·칸 수가 올바르지 않습니다.`);
      }
      if (!Array.isArray(tileset.passability) || !Array.isArray(tileset.priority)) errors.push(`타일셋 ${id} 의 통행·층 정보가 없습니다.`);
      else if (tileset.passability.length > STORE_LIMITS.tilesetCells || tileset.priority.length > STORE_LIMITS.tilesetCells) errors.push(`타일셋 ${id} 의 통행·층 정보가 너무 깁니다.`);
      else if (tileset.passability.length !== tileset.count || tileset.priority.length !== tileset.count
        || (Array.isArray(tileset.terrain) && tileset.terrain.length !== tileset.count)) {
        errors.push(`타일셋 ${id} 의 칸 수(count)와 통행·층 정보 길이가 다릅니다.`);
      }
      if (tileset.referenceSourceTilesetId !== undefined && !Object.hasOwn(tilesets, tileset.referenceSourceTilesetId)) {
        errors.push(`타일셋 ${id} 이 팩 밖의 참고문서(${tileset.referenceSourceTilesetId})를 가리킵니다.`);
      }
    }
    if (content.characters !== undefined) {
      if (!Array.isArray(content.characters) || content.characters.length > STORE_LIMITS.characters) {
        errors.push(`캐릭터 설명은 ${STORE_LIMITS.characters}개 이하의 목록이어야 합니다.`);
      } else {
        const seen = new Set<string>();
        for (const raw of content.characters as unknown[]) {
          const c = isRecord(raw) ? raw : null;
          const asset = c && typeof c.asset === "string" ? assets[c.asset] : undefined;
          const where = c && typeof c.asset === "string" ? `${c.asset.slice(0, 40)} 칸 ${String(c.characterIndex).slice(0, 4)}` : "?";
          if (!c || !isRecord(asset) || asset.kind !== "charset") { errors.push(`캐릭터 설명이 팩의 캐릭터 시트를 가리키지 않습니다: ${where}`); continue; }
          if (!Number.isInteger(c.characterIndex) || (c.characterIndex as number) < 0 || (c.characterIndex as number) > 7) errors.push(`캐릭터 칸은 0~7 이어야 합니다: ${where}`);
          if (!isString(c.label, STORE_LIMITS.characterLabel, 1)) errors.push(`캐릭터 이름은 1~${STORE_LIMITS.characterLabel}자여야 합니다: ${where}`);
          if (c.tags !== undefined && (!Array.isArray(c.tags) || c.tags.length > STORE_LIMITS.tags || !c.tags.every((tag) => isString(tag, STORE_LIMITS.tagLength, 1)))) {
            errors.push(`캐릭터 태그는 ${STORE_LIMITS.tags}개 이하, 각 ${STORE_LIMITS.tagLength}자 이하여야 합니다: ${where}`);
          }
          if (c.gender !== undefined && !["male", "female", "none"].includes(c.gender as string)) errors.push(`캐릭터 성별 값이 올바르지 않습니다: ${where}`);
          if (c.age !== undefined && !["child", "youth", "middle", "elder"].includes(c.age as string)) errors.push(`캐릭터 나이 값이 올바르지 않습니다: ${where}`);
          if (c.appearance !== undefined && !isString(c.appearance, STORE_LIMITS.characterAppearance)) errors.push(`캐릭터 외형 설명은 ${STORE_LIMITS.characterAppearance}자 이하여야 합니다: ${where}`);
          if (c.generation !== undefined) errors.push(...storeGenerationProblems(c.generation, `캐릭터 ${where}`));
          if (c.portraits !== undefined) errors.push(...portraitProblems(c.portraits, assets, where));
          const key = `${c.asset as string}#${String(c.characterIndex)}`;
          if (seen.has(key)) errors.push(`같은 캐릭터 칸이 두 번 적혔습니다: ${where}`);
          seen.add(key);
        }
      }
    }
    if (content.objects !== undefined) {
      if (!Array.isArray(content.objects) || content.objects.length > STORE_LIMITS.objects) {
        errors.push(`기물 설명서는 ${STORE_LIMITS.objects}개 이하의 목록이어야 합니다.`);
      } else {
        const seen = new Set<string>();
        for (const raw of content.objects as unknown[]) {
          const o = isRecord(raw) ? raw : null;
          const tileset = o && typeof o.tileset === "string" && Object.hasOwn(tilesets, o.tileset) ? tilesets[o.tileset] : undefined;
          const where = o && typeof o.tileset === "string" && typeof o.kit === "string" ? `${o.tileset.slice(0, 40)}/${o.kit.slice(0, 40)}` : "?";
          if (!o || !isRecord(tileset)) { errors.push(`기물 설명서가 팩의 타일셋을 가리키지 않습니다: ${where}`); continue; }
          const kits = Array.isArray(tileset.structureKits) ? tileset.structureKits as unknown[] : [];
          if (typeof o.kit !== "string" || !kits.some((kit) => isRecord(kit) && kit.id === o.kit)) errors.push(`기물 설명서의 킷이 그 타일셋에 없습니다: ${where}`);
          const spec = validateObjectSpec(o.spec);
          if (!spec.ok) errors.push(...spec.errors.slice(0, 4).map((e) => `${where}: ${e}`));
          else if (spec.value.id !== o.kit) errors.push(`기물 설명서 id(${spec.value.id.slice(0, 40)})가 킷 id 와 다릅니다: ${where}`);
          const key = `${o.tileset as string}\u0000${String(o.kit)}`;
          if (seen.has(key)) errors.push(`같은 기물이 두 번 적혔습니다: ${where}`);
          seen.add(key);
        }
      }
    }
    for (const sha of collectPlaceholders(content)) if (!blobs.has(sha)) errors.push(`자리표시 blob 이 목록에 없습니다: ${sha.slice(0, 12)}`);
    // 쓰지 않는 blob 은 받지 않는다 — 몰래 끼운 파일을 막는다.
    const used = new Set<string>([...Object.values(assets).map((a) => (a as StorePackAsset).blob), ...collectPlaceholders(content)]);
    if (Array.isArray(m.previews)) for (const p of m.previews) if (typeof p === "string") used.add(p);
    for (const sha of blobs.keys()) if (!used.has(sha)) errors.push(`쓰이지 않는 blob 이 있습니다: ${sha.slice(0, 12)}`);
  }

  // 그림이 든 팩은 표지가 있어야 한다. 음원만 든 팩은 표지 없이 올 수 있다(화면이 음표로 대신한다).
  const hasImage = Array.isArray(m.blobs) && m.blobs.some((b) => isRecord(b) && typeof b.mime === "string" && b.mime.startsWith("image/"));
  if (!Array.isArray(m.previews) || m.previews.length > STORE_LIMITS.previews || (hasImage && m.previews.length === 0)) {
    errors.push(`미리보기는 ${hasImage ? 1 : 0}~${STORE_LIMITS.previews}장이어야 합니다.`);
  } else {
    for (const sha of m.previews) {
      const blob = isSha256(sha) ? blobs.get(sha) : undefined;
      if (!blob || !blob.mime.startsWith("image/")) errors.push("미리보기는 팩 안의 그림 blob 이어야 합니다.");
    }
  }
  // 문자열 안에 data URL 이 남아 있으면 안 된다(전부 blob 으로 빼야 한다). 크기 제한을 우회하는 길이다.
  if (content && JSON.stringify(content).includes('"data:')) errors.push("매니페스트에 data: URL 이 남아 있습니다. blob 으로 빼야 합니다.");
  if (errors.length === 0 && typeof m.aiGenerated === "boolean") {
    const summary = storePackGeneration(m as unknown as StorePackManifest);
    if (summary && m.aiGenerated !== (summary.label === "ai-generated")) {
      errors.push(summary.label === "procedural"
        ? "모든 에셋이 procedural(생성 모델 없음)인데 aiGenerated 가 true 입니다 — false 로 적으세요."
        : "생성 모델·섞음이거나 만든 방법을 밝히지 않은 에셋이 있는데 aiGenerated 가 false 입니다.");
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, value: m as unknown as StorePackManifest };
}

/** 요청 언어의 글. 그 언어판이 없으면 기본 글. */
export function localizedText(base: StoreLocalizedText, locales: StoreLocalizedTexts | null | undefined, locale: StoreLocale | null | undefined): StoreLocalizedText {
  const found = locale ? locales?.[locale] : undefined;
  return found ? { title: found.title, summary: found.summary, description: found.description } : base;
}
