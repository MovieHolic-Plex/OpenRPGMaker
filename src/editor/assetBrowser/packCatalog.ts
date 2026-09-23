/** zip 해시 → 해석. 그림 바이트는 여기 두지 않는다. */
export const PACK_TILE_SIZES = [16, 32, 48] as const;

export type PackTileSize = (typeof PACK_TILE_SIZES)[number];

export type PackCatalogEntry = {
  readonly zipSha256: string;
  readonly entryName: string;
  readonly tileSize: PackTileSize;
  readonly name: string;
  readonly pageUrl: string;
};

/** 앱에 실어 두는 작성 메타데이터. 같은 zip을 받으면 시트와 칸 크기를 다시 묻지 않는다. */
export const BUNDLED_PACK_CATALOG: readonly PackCatalogEntry[] = [];

const LEARNED_PACK_CATALOG_KEY = "oprn.packCatalog.v1";

export function lookupPackCatalog(zipSha256: string, learned: readonly PackCatalogEntry[] = []): PackCatalogEntry | null {
  return BUNDLED_PACK_CATALOG.find((entry) => entry.zipSha256 === zipSha256)
    ?? learned.find((entry) => entry.zipSha256 === zipSha256)
    ?? null;
}

export function readLearnedPackCatalog(): readonly PackCatalogEntry[] {
  const storage = catalogStorage();
  if (storage === null) return [];
  const raw = storage.getItem(LEARNED_PACK_CATALOG_KEY);
  if (raw === null || raw.length === 0) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((item) => {
    const entry = readPackCatalogEntry(item);
    return entry === null ? [] : [entry];
  });
}

export function rememberPackCatalog(entry: PackCatalogEntry): void {
  const storage = catalogStorage();
  if (storage === null) return;
  const next = [entry, ...readLearnedPackCatalog().filter((known) => known.zipSha256 !== entry.zipSha256)];
  try {
    storage.setItem(LEARNED_PACK_CATALOG_KEY, JSON.stringify(next));
  } catch (error) {
    if (!(error instanceof DOMException)) throw error;
  }
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function packTileSize(value: number): PackTileSize | null {
  return PACK_TILE_SIZES.find((size) => size === value) ?? null;
}

function readPackCatalogEntry(value: unknown): PackCatalogEntry | null {
  if (!isRecord(value)) return null;
  const zipSha256 = value.zipSha256;
  const entryName = value.entryName;
  const tileSize = value.tileSize;
  const name = value.name;
  const pageUrl = value.pageUrl;
  if (typeof zipSha256 !== "string" || typeof entryName !== "string" || typeof name !== "string" || typeof pageUrl !== "string") return null;
  if (typeof tileSize !== "number") return null;
  const size = packTileSize(tileSize);
  if (size === null || zipSha256.length === 0 || entryName.length === 0) return null;
  return { zipSha256, entryName, tileSize: size, name, pageUrl };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function catalogStorage(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}
