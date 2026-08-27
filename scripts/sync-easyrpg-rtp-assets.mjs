import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";

const EASYRPG_RTP_COMMIT = "993d88cbc78c658d348bbfa74a3b424d393d27e5";
const REPO = "EasyRPG/RTP";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const PUBLIC_RTP_DIR = path.join(ROOT_DIR, "public", "assets", "easyrpg");
const SOURCE_MANIFEST_PATH = path.join(ROOT_DIR, "src", "assets", "easyrpgRtp.ts");
const PUBLIC_MANIFEST_PATH = path.join(PUBLIC_RTP_DIR, "rtp-manifest.json");

// `label` 은 **사용자에게 보이는** 카테고리 이름이다. 원본 디렉터리 이름(ChipSet/CharSet…)은
// Enterbrain 계보 용어라 표시명에 쓰지 않는다 — uiCopy 의 중립어(타일 그림판 등)를 따른다.
// sourceDir 자체는 원본 저장소 경로이므로 그대로 둔다(재동기화 대조에 쓰인다).
const CATEGORY_CONFIG = [
  { sourceDir: "Battle", category: "battle", extension: ".png", publicDir: "battle", label: "전투 효과" },
  { sourceDir: "BattleWeapon", category: "battleWeapon", extension: ".png", publicDir: "battle-weapon", label: "전투 무기" },
  { sourceDir: "CharSet", category: "charset", extension: ".png", publicDir: "charset", label: "캐릭터 그림" },
  { sourceDir: "ChipSet", category: "chipset", extension: ".png", publicDir: "chipset", label: "타일 그림판" },
  { sourceDir: "FaceSet", category: "faceset", extension: ".png", publicDir: "faceset", label: "얼굴 그림" },
  { sourceDir: "GameOver", category: "gameOver", extension: ".png", publicDir: "game-over", label: "게임오버 화면" },
  { sourceDir: "Monster", category: "monster", extension: ".png", publicDir: "monster", label: "몬스터 그림" },
  { sourceDir: "Music", category: "music", extension: ".mid", publicDir: "music", label: "음악" },
  { sourceDir: "Panorama", category: "backdrop", extension: ".png", publicDir: "backdrop", label: "배경 그림" },
  { sourceDir: "Picture", category: "picture", extension: ".png", publicDir: "picture", label: "그림" },
  { sourceDir: "Sound", category: "sound", extension: ".wav", publicDir: "sound", label: "효과음" },
  { sourceDir: "System", category: "system", extension: ".png", publicDir: "system", label: "시스템 그림" },
  { sourceDir: "System2", category: "system2", extension: ".png", publicDir: "system2", label: "시스템 그림 2" },
  { sourceDir: "Title", category: "title", extension: ".png", publicDir: "title", label: "타이틀 화면" },
];

// 캐릭터 그림 시트의 **행 순서**다 — 알파벳 순이 아니라 시트에 그려진 순서여야 한다.
// 실측 계약(test/easyrpgRtpAssets.test.ts): characterIndex 0 · down · pattern 1 → 프레임 25,
// 즉 down 은 3번째 행(index 2)이고 up 이 첫 행이다. 여기가 ["down","left","right","up"]
// 이었는데 생성된 파일은 아래 순서였다 — 생성기가 낡아 재생성하면 방향이 뒤집혔다.
const CHARSET_DIRECTIONS = ["up", "right", "down", "left"];

function requestBuffer(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "rpg-zzu-easyrpg-rtp-sync",
          Accept: "application/vnd.github+json, application/octet-stream",
        },
      },
      (response) => {
        const statusCode = response.statusCode ?? 0;
        const location = response.headers.location;
        if (statusCode >= 300 && statusCode < 400 && location && redirects < 5) {
          response.resume();
          resolve(requestBuffer(new URL(location, url).toString(), redirects + 1));
          return;
        }
        if (statusCode < 200 || statusCode >= 300) {
          response.resume();
          reject(new Error(`HTTP ${statusCode} for ${url}`));
          return;
        }
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => resolve(Buffer.concat(chunks)));
      }
    );
    request.on("error", reject);
  });
}

async function requestJson(url) {
  const buffer = await requestBuffer(url);
  return JSON.parse(buffer.toString("utf8"));
}

function selectedAsset(sourcePath) {
  for (const config of CATEGORY_CONFIG) {
    const prefix = `${config.sourceDir}/`;
    if (
      sourcePath.startsWith(prefix) &&
      sourcePath.endsWith(config.extension) &&
      sourcePath.slice(prefix.length).includes("/") === false
    ) {
      return config;
    }
  }
  return null;
}

function assetId(category, fileName) {
  const stem = fileName.slice(0, fileName.lastIndexOf("."));
  return `easyrpg-${slug(category)}-${slug(stem)}`;
}

function textureKey(fileName) {
  const stem = fileName.slice(0, fileName.lastIndexOf("."));
  return `tex_easyrpg_charset_${slug(stem)}`;
}

function slug(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1-$2").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function charsetGroup(fileName) {
  const stem = fileName.slice(0, fileName.lastIndexOf("."));
  const match = /^[A-Za-z]+/.exec(stem);
  return match?.[0] ?? "Other";
}

// 표시명에서 `RTP` 를 뺀다 — RTP 는 Enterbrain 의 용어이고, 이 파일들은 EasyRPG 의
// **대체본**이다(public/assets/easyrpg/COPYING). 출처 표기(EasyRPG)는 남긴다: 실제 저작자
// 크레딧이고 자료 보관함 검색어로도 쓰인다. bundled.ts 의 표시명 규칙과 같은 형태다.
function displayName(config, fileName) {
  const stem = fileName.slice(0, fileName.lastIndexOf("."));
  return `${stem} · ${config.label} · EasyRPG`;
}

function publicPath(config, fileName) {
  return `assets/easyrpg/${config.publicDir}/${fileName}`;
}

function rawUrl(sourcePath) {
  return `https://raw.githubusercontent.com/${REPO}/${EASYRPG_RTP_COMMIT}/${sourcePath.split("/").map(encodeURIComponent).join("/")}`;
}

function tsString(value) {
  return JSON.stringify(value);
}

function assetRecord(config, sourcePath) {
  const fileName = pathModuleBasename(sourcePath);
  const common = {
    category: config.category,
    id: assetId(config.category, fileName),
    name: displayName(config, fileName),
    sourcePath,
    path: publicPath(config, fileName),
    fileName,
  };
  if (config.category !== "charset") return common;
  return { ...common, textureKey: textureKey(fileName), group: charsetGroup(fileName) };
}

function pathModuleBasename(sourcePath) {
  return path.posix.basename(sourcePath);
}

function generateSource(assets) {
  const charsetAssets = assets.filter((asset) => asset.category === "charset");
  return `${generatedHeader()}${generatedTypes()}${assetArray("EASYRPG_RTP_ASSETS", assets)}
export const EASYRPG_BACKDROP_ASSETS = EASYRPG_RTP_ASSETS.filter((asset) => asset.category === "backdrop");
export const EASYRPG_BATTLE_ASSETS = EASYRPG_RTP_ASSETS.filter((asset) => asset.category === "battle");
export const EASYRPG_BATTLE_WEAPON_ASSETS = EASYRPG_RTP_ASSETS.filter((asset) => asset.category === "battleWeapon");
export const EASYRPG_CHIPSET_ASSETS = EASYRPG_RTP_ASSETS.filter((asset) => asset.category === "chipset");
// 분할 전 얼굴 시트 5장. 새 작업은 FACESET_FACE_ASSETS(낱장)를 쓴다 — 이 목록은
// 이미 이 id 를 저장한 프로젝트가 여전히 역직렬화되게 하기 위해 둔다.
export const LEGACY_FACESET_SHEET_ASSETS = EASYRPG_RTP_ASSETS.filter((asset) => asset.category === "faceset");
export const EASYRPG_GAME_OVER_ASSETS = EASYRPG_RTP_ASSETS.filter((asset) => asset.category === "gameOver");
export const EASYRPG_MONSTER_ASSETS = EASYRPG_RTP_ASSETS.filter((asset) => asset.category === "monster");
export const EASYRPG_MUSIC_ASSETS = EASYRPG_RTP_ASSETS.filter((asset) => asset.category === "music");
export const EASYRPG_PICTURE_ASSETS = EASYRPG_RTP_ASSETS.filter((asset) => asset.category === "picture");
export const EASYRPG_SOUND_ASSETS = EASYRPG_RTP_ASSETS.filter((asset) => asset.category === "sound");
export const EASYRPG_SYSTEM_ASSETS = EASYRPG_RTP_ASSETS.filter((asset) => asset.category === "system");
export const EASYRPG_SYSTEM2_ASSETS = EASYRPG_RTP_ASSETS.filter((asset) => asset.category === "system2");
export const EASYRPG_TITLE_ASSETS = EASYRPG_RTP_ASSETS.filter((asset) => asset.category === "title");
export const EASYRPG_CHARSET_ASSETS = [
${charsetAssets.map((asset) => `  ${tsObject(asset)},`).join("\n")}
] as const satisfies readonly EasyRpgCharsetAsset[];

${frameHelpers()}`;
}

function generatedHeader() {
  return `// Generated by scripts/sync-easyrpg-rtp-assets.mjs. Do not edit by hand.
// Source: https://github.com/${REPO}/tree/${EASYRPG_RTP_COMMIT}

import { FACE_IMAGE_SIZE, RESOURCE_SLICING, type ResourceSlicingSpec } from "@/assets/resourceSlicing";

export const EASYRPG_RTP_COMMIT = ${tsString(EASYRPG_RTP_COMMIT)};
export const EASYRPG_RTP_SOURCE_URL = ${tsString(`https://github.com/${REPO}`)};
`;
}

function generatedTypes() {
  return `export type EasyRpgRtpCategory =
  | "backdrop"
  | "battle"
  | "battleWeapon"
  | "charset"
  | "chipset"
  | "faceset"
  | "gameOver"
  | "monster"
  | "music"
  | "picture"
  | "sound"
  | "system"
  | "system2"
  | "title";
export type CharsetDirection = "down" | "left" | "right" | "up";

export type EasyRpgRtpAsset = {
  readonly category: EasyRpgRtpCategory;
  readonly id: string;
  readonly name: string;
  readonly sourcePath: string;
  readonly path: string;
  readonly fileName: string;
  readonly textureKey?: string;
  readonly group?: string;
};

export type EasyRpgCharsetAsset = EasyRpgRtpAsset & {
  readonly category: "charset";
  readonly textureKey: string;
  readonly group: string;
};
`;
}

function assetArray(name, assets) {
  return `export const ${name} = [
${assets.map((asset) => `  ${tsObject(asset)},`).join("\n")}
] as const satisfies readonly EasyRpgRtpAsset[];
`;
}

function tsObject(asset) {
  const entries = Object.entries(asset).map(([key, value]) => `${key}: ${tsString(value)}`);
  return `{ ${entries.join(", ")} }`;
}

function frameHelpers() {
  return `export const EASYRPG_RTP_CATEGORY_SLICING = {
  backdrop: RESOURCE_SLICING.backdrop,
  battle: RESOURCE_SLICING.battle,
  battleWeapon: RESOURCE_SLICING.battleWeapon,
  charset: RESOURCE_SLICING.charset,
  chipset: RESOURCE_SLICING.chipset,
  faceset: RESOURCE_SLICING.faceset,
  gameOver: RESOURCE_SLICING.gameOver,
  monster: RESOURCE_SLICING.monster,
  music: RESOURCE_SLICING.music,
  picture: RESOURCE_SLICING.picture,
  sound: RESOURCE_SLICING.sound,
  system: RESOURCE_SLICING.system,
  system2: RESOURCE_SLICING.system2,
  title: RESOURCE_SLICING.title,
} as const satisfies Record<EasyRpgRtpCategory, ResourceSlicingSpec>;

export const CHIPSET_SLICING = RESOURCE_SLICING.chipset;
export const FACESET_SLICING = RESOURCE_SLICING.faceset;
export const CHARSET_SLICING = RESOURCE_SLICING.charset;

export const FACESET_FACE_WIDTH = FACE_IMAGE_SIZE;
export const FACESET_FACE_HEIGHT = FACE_IMAGE_SIZE;

export const CHARSET_FRAME_WIDTH = CHARSET_SLICING.cellWidth;
export const CHARSET_FRAME_HEIGHT = CHARSET_SLICING.cellHeight;
export const CHARSET_SHEET_COLUMNS = CHARSET_SLICING.columns;
export const CHARSET_SHEET_ROWS = CHARSET_SLICING.rows;
export const CHARSET_CHARACTER_COLUMNS = 3;
export const CHARSET_CHARACTER_ROWS = 4;
export const CHARSET_CHARACTERS_PER_ROW = 4;
export const CHARSET_CHARACTER_COUNT = 8;
export const CHARSET_FRAME_COUNT = CHARSET_SHEET_COLUMNS * CHARSET_SHEET_ROWS;
export const CHARSET_DIRECTIONS = [${CHARSET_DIRECTIONS.map(tsString).join(", ")}] as const satisfies readonly CharsetDirection[];

export type CharsetFrameSelection = {
  readonly characterIndex: number;
  readonly direction: CharsetDirection;
  readonly pattern: number;
};

export type CharsetFrameSource = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export function charsetFrameIndex(selection: CharsetFrameSelection): number {
  const characterIndex = boundedInt(selection.characterIndex, 0, CHARSET_CHARACTER_COUNT - 1);
  const pattern = boundedInt(selection.pattern, 0, CHARSET_CHARACTER_COLUMNS - 1);
  const directionRow = CHARSET_DIRECTIONS.indexOf(selection.direction);
  const characterColumn = characterIndex % CHARSET_CHARACTERS_PER_ROW;
  const characterRow = Math.floor(characterIndex / CHARSET_CHARACTERS_PER_ROW);
  const column = characterColumn * CHARSET_CHARACTER_COLUMNS + pattern;
  const row = characterRow * CHARSET_CHARACTER_ROWS + Math.max(directionRow, 0);
  return row * CHARSET_SHEET_COLUMNS + column;
}

export function decodeCharsetFrameIndex(frameIndex: number): CharsetFrameSelection {
  const normalized = boundedInt(frameIndex, 0, CHARSET_FRAME_COUNT - 1);
  const column = normalized % CHARSET_SHEET_COLUMNS;
  const row = Math.floor(normalized / CHARSET_SHEET_COLUMNS);
  const characterColumn = Math.floor(column / CHARSET_CHARACTER_COLUMNS);
  const characterRow = Math.floor(row / CHARSET_CHARACTER_ROWS);
  const direction = CHARSET_DIRECTIONS[row % CHARSET_CHARACTER_ROWS] ?? "down";
  return {
    characterIndex: characterRow * CHARSET_CHARACTERS_PER_ROW + characterColumn,
    direction,
    pattern: column % CHARSET_CHARACTER_COLUMNS,
  };
}

export function charsetFrameSource(selection: CharsetFrameSelection): CharsetFrameSource {
  const frameIndex = charsetFrameIndex(selection);
  const column = frameIndex % CHARSET_SHEET_COLUMNS;
  const row = Math.floor(frameIndex / CHARSET_SHEET_COLUMNS);
  return {
    x: column * CHARSET_FRAME_WIDTH,
    y: row * CHARSET_FRAME_HEIGHT,
    width: CHARSET_FRAME_WIDTH,
    height: CHARSET_FRAME_HEIGHT,
  };
}

function boundedInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}
`;
}

async function main() {
  // --manifest-only: 에셋 바이너리를 다시 내리지 않고 매니포스트만 재생성하는 경로.
  // 표시명·id 같은 **파생 메타데이타**만 바뀌는 변경에 쓴다. 파일 목록은 직전 싱킹이
  // 쓰고 간 rtp-manifest.json 에서 읽는다 — 출처는 여전하게 EASYRPG_RTP_COMMIT 에 못박혀 있다.
  const manifestOnly = process.argv.includes("--manifest-only");
  const sourceFiles = manifestOnly ? await manifestSourceFiles() : await remoteSourceFiles();
  const assets = sourceFiles.flatMap((sourcePath) => {
    const config = selectedAsset(sourcePath);
    return config ? [assetRecord(config, sourcePath)] : [];
  });

  if (!manifestOnly) {
    for (const sourcePath of sourceFiles) {
      const config = selectedAsset(sourcePath);
      if (!config) continue;
      const fileName = pathModuleBasename(sourcePath);
      const targetPath = path.join(PUBLIC_RTP_DIR, config.publicDir, fileName);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, await requestBuffer(rawUrl(sourcePath)));
      console.log(`synced ${sourcePath}`);
    }

    for (const sourcePath of ["AUTHORS.md", "COPYING"]) {
      const targetPath = path.join(PUBLIC_RTP_DIR, sourcePath);
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, await requestBuffer(rawUrl(sourcePath)));
      console.log(`synced ${sourcePath}`);
    }
  }

  await writeFile(SOURCE_MANIFEST_PATH, generateSource(assets));
  await writeFile(
    PUBLIC_MANIFEST_PATH,
    `${JSON.stringify({ source: { repository: `https://github.com/${REPO}`, commit: EASYRPG_RTP_COMMIT }, assets }, null, 2)}\n`
  );
  console.log(`generated ${assets.length} scoped EasyRPG assets${manifestOnly ? " (manifest only)" : ""}`);
}

/** 원본 저장소(고정 쯤)의 트리에서 대상 파일 경로를 수집한다. */
async function remoteSourceFiles() {
  const treeUrl = `https://api.github.com/repos/${REPO}/git/trees/${EASYRPG_RTP_COMMIT}?recursive=1`;
  const tree = await requestJson(treeUrl);
  return tree.tree
    .filter((entry) => entry.type === "blob")
    .map((entry) => entry.path)
    .filter((sourcePath) => selectedAsset(sourcePath) !== null)
    .sort((left, right) => left.localeCompare(right));
}

/** 직전 싱킹이 기록한 매니포스트에서 대상 파일 경로를 읽는다(네트워키 없이 재생성). */
async function manifestSourceFiles() {
  const previous = JSON.parse(await readFile(PUBLIC_MANIFEST_PATH, "utf8"));
  if (previous.source?.commit !== EASYRPG_RTP_COMMIT) {
    throw new Error(
      `rtp-manifest.json 의 commit(${previous.source?.commit}) 이 EASYRPG_RTP_COMMIT 과 다릅니다 — --manifest-only 로는 재생성할 수 없습니다.`
    );
  }
  return previous.assets
    .map((asset) => asset.sourcePath)
    .filter((sourcePath) => selectedAsset(sourcePath) !== null)
    .sort((left, right) => left.localeCompare(right));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
