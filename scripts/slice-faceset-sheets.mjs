// 4x4 얼굴 시트를 48x48 낱장 PNG 로 물리 분할하고, 낱장 리소스 목록
// src/assets/facesetFaceAssets.ts 를 다시 생성한다.
//
// 왜 파일을 쪼개는가: 얼굴은 "시트 + 칸 번호" 쌍이 아니라 **그림 한 장**이다.
// 데이터·에디터·런타임 어디에도 시트 칸 번호 계약이 남지 않게 하려면 파일부터 낱장이어야 한다.
//
// 칸 번호 -> 좌표 규약(레거시 시트와 동일한 row-major): col = n % 4, row = floor(n / 4),
// 잘라낼 영역 = (col*48, row*48, 48, 48). 파일 이름은 00..15 (2자리 0 채움).
//
// 사용:
//   node scripts/slice-faceset-sheets.mjs            # 낱장 PNG + TS 목록 생성(멱등)
//   node scripts/slice-faceset-sheets.mjs --verify    # 쓰지 않고 검사만. 불일치 1개라도 있으면 exit 1
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Jimp from "jimp";

const SCRIPT_NAME = "scripts/slice-faceset-sheets.mjs";
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const GENERATED_TS_PATH = path.join(ROOT_DIR, "src", "assets", "facesetFaceAssets.ts");

const FACE_SIZE = 48;
const COLUMNS = 4;
const ROWS = 4;
const FACE_COUNT = COLUMNS * ROWS;

// 시트 목록은 하드코딩이다 — 디렉터리 스캔으로 자동 수집하면 낱장 결과물(하위 디렉터리)이나
// 얼굴이 아닌 정사각 이미지까지 다시 쪼개려 든다.
const SHEETS = [
  sheet("assets/easyrpg/faceset/Actor1.png", "easyrpg-faceset-actor1", "easyrpg"),
  sheet("assets/easyrpg/faceset/Actor2.png", "easyrpg-faceset-actor2", "easyrpg"),
  sheet("assets/easyrpg/faceset/Monster.png", "easyrpg-faceset-monster", "easyrpg"),
  sheet("assets/easyrpg/faceset/People1.png", "easyrpg-faceset-people1", "easyrpg"),
  sheet("assets/easyrpg/faceset/People2.png", "easyrpg-faceset-people2", "easyrpg"),
  sheet("assets/generated/starter/hero-01-face.png", "generated-actor-hero-01-face", "generated"),
  sheet("assets/generated/starter/hero-02-face.png", "generated-actor-hero-02-face", "generated"),
];

function sheet(sheetPath, sheetResourceId, origin) {
  const stem = path.posix.basename(sheetPath, ".png");
  const dirPath = path.posix.join(path.posix.dirname(sheetPath), stem);
  return { sheetPath, sheetResourceId, origin, stem, dirPath };
}

function faceEntries(sheetSpec) {
  const entries = [];
  for (let index = 0; index < FACE_COUNT; index += 1) {
    const cell = String(index).padStart(2, "0");
    entries.push({
      id: `${sheetSpec.sheetResourceId}-${cell}`,
      name: faceName(sheetSpec, index),
      path: `${sheetSpec.dirPath}/${cell}.png`,
      sheetResourceId: sheetSpec.sheetResourceId,
      sheetIndex: index,
    });
  }
  return entries;
}

// EasyRPG 시트에서 온 얼굴만 " · EasyRPG" 출처를 붙인다. 생성 에셋은 우리가 만든 그림이다.
function faceName(sheetSpec, index) {
  const label = `${sheetSpec.stem} 얼굴 ${index + 1}`;
  return sheetSpec.origin === "easyrpg" ? `${label} · EasyRPG` : label;
}

function faceRect(index) {
  return {
    x: (index % COLUMNS) * FACE_SIZE,
    y: Math.floor(index / COLUMNS) * FACE_SIZE,
  };
}

async function readSheet(sheetSpec) {
  const absolute = path.join(ROOT_DIR, "public", sheetSpec.sheetPath);
  if (!existsSync(absolute)) throw new Error(`시트 파일이 없습니다: public/${sheetSpec.sheetPath}`);
  const image = await Jimp.read(absolute);
  const { width, height } = image.bitmap;
  if (width !== COLUMNS * FACE_SIZE || height !== ROWS * FACE_SIZE) {
    throw new Error(
      `public/${sheetSpec.sheetPath} 크기가 ${COLUMNS * FACE_SIZE}x${ROWS * FACE_SIZE} 가 아닙니다: ${width}x${height}`
    );
  }
  return image;
}

function cropFace(sheetImage, index) {
  const { x, y } = faceRect(index);
  return sheetImage.clone().crop(x, y, FACE_SIZE, FACE_SIZE);
}

async function sliceSheet(sheetSpec) {
  const sheetImage = await readSheet(sheetSpec);
  await mkdir(path.join(ROOT_DIR, "public", sheetSpec.dirPath), { recursive: true });
  let written = 0;
  let unchanged = 0;
  for (const entry of faceEntries(sheetSpec)) {
    const face = cropFace(sheetImage, entry.sheetIndex);
    const absolute = path.join(ROOT_DIR, "public", entry.path);
    // 멱등성: 이미 같은 픽셀이면 다시 쓰지 않는다(PNG 인코더 출력이 바이트 단위로
    // 같다는 보장에 의존하지 않는다).
    if (await facePixelsMatch(absolute, face)) {
      unchanged += 1;
      continue;
    }
    await face.writeAsync(absolute);
    written += 1;
  }
  console.log(`[slice] ${sheetSpec.stem}: ${written} written, ${unchanged} unchanged -> public/${sheetSpec.dirPath}/`);
  return { written, unchanged };
}

async function facePixelsMatch(absolute, face) {
  if (!existsSync(absolute)) return false;
  const existing = await Jimp.read(absolute);
  if (existing.bitmap.width !== FACE_SIZE || existing.bitmap.height !== FACE_SIZE) return false;
  return Buffer.compare(Buffer.from(existing.bitmap.data), Buffer.from(face.bitmap.data)) === 0;
}

async function verifySheet(sheetSpec) {
  const sheetImage = await readSheet(sheetSpec);
  const problems = [];
  for (const entry of faceEntries(sheetSpec)) {
    const absolute = path.join(ROOT_DIR, "public", entry.path);
    if (!existsSync(absolute)) {
      problems.push(`${entry.path}: 파일 없음`);
      continue;
    }
    const face = await Jimp.read(absolute);
    if (face.bitmap.width !== FACE_SIZE || face.bitmap.height !== FACE_SIZE) {
      problems.push(`${entry.path}: ${face.bitmap.width}x${face.bitmap.height} (${FACE_SIZE}x${FACE_SIZE} 이어야 함)`);
      continue;
    }
    const expected = cropFace(sheetImage, entry.sheetIndex);
    if (Buffer.compare(Buffer.from(face.bitmap.data), Buffer.from(expected.bitmap.data)) !== 0) {
      problems.push(`${entry.path}: 원본 crop 과 픽셀이 다름`);
    }
  }
  const ok = problems.length === 0;
  console.log(
    `[verify] ${sheetSpec.stem}: ${FACE_COUNT - problems.length}/${FACE_COUNT} faces ${FACE_SIZE}x${FACE_SIZE} pixel-identical -> ${ok ? "OK" : `FAIL (${problems.length})`}`
  );
  for (const problem of problems) console.error(`  - ${problem}`);
  return ok;
}

function generatedSource(entries) {
  const generatedSheetIds = new Set(SHEETS.filter((sheetSpec) => sheetSpec.origin === "generated").map((sheetSpec) => sheetSpec.sheetResourceId));
  const generatedFaceIds = entries.filter((entry) => generatedSheetIds.has(entry.sheetResourceId)).map((entry) => entry.id);
  const rows = entries
    .map(
      (entry) =>
        `  { id: ${json(entry.id)}, name: ${json(entry.name)}, path: ${json(entry.path)}, sheetResourceId: ${json(entry.sheetResourceId)}, sheetIndex: ${entry.sheetIndex} },`
    )
    .join("\n");
  const sheetIds = SHEETS.map((sheetSpec) => `  ${json(sheetSpec.sheetResourceId)},`).join("\n");
  const generatedIds = generatedFaceIds.map((id) => `  ${json(id)},`).join("\n");
  return `// Generated by ${SCRIPT_NAME}. Do not edit by hand.
// 얼굴 한 칸 = 파일 한 장. 시트를 물리 분할한 결과물 목록이다.
// 다시 만들기: node ${SCRIPT_NAME}   검사: node ${SCRIPT_NAME} --verify

export type FacesetFaceAsset = {
  readonly id: string;
  readonly name: string;
  /** public/ 아래 경로. 런타임 URL 은 \`/\${path}\` 다(EASYRPG_RTP_ASSETS 와 같은 규약). */
  readonly path: string;
  /** 이 얼굴이 잘려 나온 레거시 시트의 리소스 id. */
  readonly sheetResourceId: string;
  /** 레거시 시트에서의 칸 번호(0..${FACE_COUNT - 1}). 마이그레이션 대조용으로만 남긴다. */
  readonly sheetIndex: number;
};

export const FACE_CELL_COUNT = ${FACE_COUNT};

/** 분할 전 시트 리소스 id. 저장된 프로젝트가 이 id 를 들고 있어 등록 자체는 유지한다. */
export const LEGACY_FACESET_SHEET_IDS: readonly string[] = [
${sheetIds}
];

export const FACESET_FACE_ASSETS: readonly FacesetFaceAsset[] = [
${rows}
];

/** 생성 시리즈(hero-XX-face) 낱장 얼굴 id. 저장본 해석·검증을 위해 FACESET_FACE_ASSETS 등록은
 *  유지하지만, 저작 목록(리소스 관리자·얼굴 피커·AI 카탈로그)에는 올리지 않는다. */
export const GENERATED_FACESET_FACE_IDS: ReadonlySet<string> = new Set([
${generatedIds}
]);

/** 저작 목록에 보이는 낱장 얼굴 — 생성 시리즈를 뺀 목록이다. */
export const AUTHORABLE_FACESET_FACE_ASSETS: readonly FacesetFaceAsset[] =
  FACESET_FACE_ASSETS.filter((face) => !GENERATED_FACESET_FACE_IDS.has(face.id));

const FACE_ID_BY_SHEET_CELL = new Map<string, string>(
  FACESET_FACE_ASSETS.map((face) => [\`\${face.sheetResourceId}#\${face.sheetIndex}\`, face.id])
);

/**
 * 레거시 (시트 id, 칸 번호) 쌍을 낱장 얼굴 id 로 바꾼다. 모든 입력에 대해 정의된 함수다 — 절대 던지지 않는다.
 * - 시트 id 가 아니면(이미 낱장 id 이거나 남의 리소스면) 입력을 그대로 돌려준다.
 * - 칸 번호가 undefined·NaN·무한이면 0 (RM2K 계보의 "생략은 0칸" 계약).
 * - 범위를 벗어나면 0..${FACE_COUNT - 1} 로 가둔다.
 */
export function faceIdForSheetCell(sheetResourceId: string, legacySheetCell: number | undefined): string {
  const cell = clampFaceCell(legacySheetCell);
  return FACE_ID_BY_SHEET_CELL.get(\`\${sheetResourceId}#\${cell}\`) ?? sheetResourceId;
}

function clampFaceCell(legacySheetCell: number | undefined): number {
  if (legacySheetCell === undefined || !Number.isFinite(legacySheetCell)) return 0;
  return Math.max(0, Math.min(FACE_CELL_COUNT - 1, Math.trunc(legacySheetCell)));
}
`;
}

function json(value) {
  return JSON.stringify(value);
}

async function writeGeneratedSource(entries) {
  const source = generatedSource(entries);
  const current = existsSync(GENERATED_TS_PATH) ? await readFile(GENERATED_TS_PATH, "utf8") : null;
  if (current === source) {
    console.log("[slice] src/assets/facesetFaceAssets.ts unchanged");
    return;
  }
  await writeFile(GENERATED_TS_PATH, source, "utf8");
  console.log(`[slice] src/assets/facesetFaceAssets.ts written (${entries.length} faces)`);
}

async function verifyGeneratedSource(entries) {
  const source = generatedSource(entries);
  const current = existsSync(GENERATED_TS_PATH) ? await readFile(GENERATED_TS_PATH, "utf8") : null;
  const ok = current === source;
  console.log(`[verify] src/assets/facesetFaceAssets.ts: ${ok ? "up to date" : "STALE — run node " + SCRIPT_NAME}`);
  return ok;
}

async function main() {
  const verifyOnly = process.argv.slice(2).includes("--verify");
  const entries = SHEETS.flatMap((sheetSpec) => faceEntries(sheetSpec));
  if (verifyOnly) {
    let ok = true;
    for (const sheetSpec of SHEETS) ok = (await verifySheet(sheetSpec)) && ok;
    ok = (await verifyGeneratedSource(entries)) && ok;
    console.log(`[verify] ${entries.length} faces across ${SHEETS.length} sheets: ${ok ? "OK" : "FAIL"}`);
    process.exit(ok ? 0 : 1);
  }
  for (const sheetSpec of SHEETS) await sliceSheet(sheetSpec);
  await writeGeneratedSource(entries);
  console.log(`[slice] ${entries.length} faces across ${SHEETS.length} sheets`);
}

main().catch((error) => {
  console.error(`[slice] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
