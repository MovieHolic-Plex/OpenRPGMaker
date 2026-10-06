/**
 * 첫 진열 팩: 저장소에 있는 직접 만든 번들 타일셋 4종을 스토어 팩으로 바꿔 올린다.
 * (Rasak·REFMAP·MV 팩 계열·PAW 는 제외 — 2026-10-06 사용자 결정. 여기 목록에 넣지 않는다.)
 * 번들 그림(`/assets/...`)과 참고문서 그림을 blob 으로 바꿔, 다른 판의 편집기에서도 팩 하나로 닫히게 한다.
 * 스테이징·e2e 가 같이 쓴다. 운영자(관리자) 세션으로 올리므로 바로 공개된다.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { STORE_PACK_SCHEMA, blobPlaceholder, mapStrings, type StoreBlobMime, type StorePackManifest } from "../../src/assetStore/format";
import { pngSize, sniffMime } from "../../src/assetStore/sniff";
import { createAtlasBiomeInteriorTileset } from "../../src/project/defaults/atlasBiomeInterior";
import { createBeodeulCityTileset } from "../../src/project/defaults/beodeulCity";
import { createJoseonBaramTileset } from "../../src/project/defaults/joseonBaram";
import { createJpCityTileset } from "../../src/project/defaults/jpCity";
import type { TilesetDef } from "../../src/project/types";

interface BundleSeed {
  create: () => TilesetDef;
  sheet: string;
  title: string;
  summary: string;
  description: string;
  tags: string[];
  /** 표지·미리보기로 쓸 완성 예시 그림(편집기 public/ 기준). 없으면 시트 그림. */
  previews: string[];
}

export const SEED_BUNDLES: readonly BundleSeed[] = [
  {
    create: createBeodeulCityTileset, sheet: "assets/beodeul-city/beodeul-city-chipset.png",
    title: "버들항 — 로마풍 항구 도시", summary: "손 도트 16px 항구 도시. 구역·건물·소품 키트 120종과 조립 참고문서가 들어 있습니다.",
    description: "광장·시장·항구·성벽·주택가를 칸 단위로 조립하는 16px 손 도트 타일셋입니다.\n참고문서(용도별 MD + 정상/오류 그림)가 들어 있어 에디터 조수가 바로 이 타일로 도시를 깝니다.",
    tags: ["도시", "항구", "16px", "판타지"],
    previews: ["assets/beodeul-city/references/city-overview.png", "assets/beodeul-city/references/kit-castle.png", "assets/beodeul-city/references/kit-forum.png", "assets/beodeul-city/references/manor-kits.png"],
  },
  {
    create: createJoseonBaramTileset, sheet: "assets/joseon-baram/joseon-baram-chipset.png",
    title: "조선 — 바람의나라풍 마을", summary: "기와집·초가·성문·사냥터·동굴까지 조선풍 손 도트 칩셋.",
    description: "코드로 찍은 조선풍 16px 조각을 한 장으로 구운 칩셋입니다. 칸마다 통행·층이 구워져 있고, 마을·국내성·실내 조립 참고문서가 함께 들어 있습니다.",
    tags: ["조선", "한국", "마을", "16px"],
    previews: ["assets/joseon-baram/references/village-overview.png", "assets/joseon-baram/references/ex-manor.png", "assets/joseon-baram/references/ex-row.png", "assets/joseon-baram/references/ex-bridge.png"],
  },
  {
    create: createAtlasBiomeInteriorTileset, sheet: "assets/atlas-interior/interior-chipset.png",
    title: "손 도트 실내 v5", summary: "빵집·여관·민가·상점 실내를 꾸미는 3/4 시점 가구 칩셋.",
    description: "윗면과 앞면이 같이 보이는 3/4 시점 손 도트 실내 가구입니다. 방 종류별 배치 참고문서가 들어 있습니다.",
    tags: ["실내", "가구", "16px"],
    previews: ["assets/hand-interior-references/hand-interior-bakery.png", "assets/hand-interior-references/hand-interior-tavern.png", "assets/hand-interior-references/hand-interior-smithy.png", "assets/hand-interior-references/hand-interior-chapel.png"],
  },
  {
    create: createJpCityTileset, sheet: "assets/jp-city/jp-city-chipset.png",
    title: "일본 도시 — 상가·주택·역·신사", summary: "현대 일본 거리의 주택가·역·공원·신사를 그리는 도트 칩셋.",
    description: "3/4 시점 현대 일본 도시 타일셋입니다. 건물 외형·소품·바닥 타일과 조립 참고문서가 들어 있습니다.",
    tags: ["현대", "일본", "도시"],
    previews: ["assets/store-covers/jp-city-street.png", "assets/jp-city-references/ex-konbini_block.png", "assets/jp-city-references/ex-ramen_tower.png", "assets/jp-city-references/road-trunk-cross.png"],
  },
];

const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** 번들 타일셋 → 스토어 팩(매니페스트 + blob). publicDir 은 편집기 public/ 폴더. */
export function bundlePack(seed: BundleSeed, publicDir: string): { manifest: StorePackManifest; blobs: Map<string, Uint8Array> } {
  const blobs = new Map<string, { bytes: Uint8Array; mime: StoreBlobMime }>();
  const add = (bytes: Uint8Array): string => {
    const mime = sniffMime(bytes);
    if (!mime) throw new Error("알 수 없는 형식");
    const key = sha(bytes);
    blobs.set(key, { bytes, mime });
    return key;
  };
  const sheetBytes = new Uint8Array(readFileSync(join(publicDir, seed.sheet)));
  const size = pngSize(sheetBytes);
  if (!size) throw new Error(`${seed.sheet}: PNG 가 아닙니다`);
  const sheetSha = add(sheetBytes);
  const source = seed.create();
  const assetId = `${source.id}_sheet`;
  // 참고문서 그림의 `/assets/...` 경로를 blob 으로 바꾼다.
  const tileset = mapStrings(source, (text) => {
    if (!/^\/assets\/.+\.(png|jpe?g|webp)$/i.test(text)) return text;
    const file = join(publicDir, text.slice(1));
    if (!existsSync(file)) return text;
    return blobPlaceholder(add(new Uint8Array(readFileSync(file))));
  }) as TilesetDef;
  const previews = seed.previews.filter((path) => existsSync(join(publicDir, path))).map((path) => add(new Uint8Array(readFileSync(join(publicDir, path)))));
  tileset.image = { type: "uploaded", id: assetId };
  const manifest: StorePackManifest = {
    schema: STORE_PACK_SCHEMA,
    title: seed.title,
    summary: seed.summary,
    description: seed.description,
    tags: seed.tags,
    kind: "tileset",
    license: "OPRN-GAME",
    aiGenerated: true,
    credits: `${seed.title} — OPRN 공식 팩 (openrpgmaker.com)`,
    content: {
      assets: { [assetId]: { id: assetId, name: source.name, kind: "chipset", blob: sheetSha, mime: "image/png", meta: { width: size.width, height: size.height, tileSize: source.tileSize } } },
      tilesets: { [tileset.id]: tileset },
    },
    previews: [...previews, sheetSha].slice(0, 6),
    blobs: [...blobs].map(([key, blob]) => ({ sha256: key, mime: blob.mime, bytes: blob.bytes.byteLength })),
  };
  return { manifest, blobs: new Map([...blobs].map(([key, blob]) => [key, blob.bytes])) };
}

interface Session { base: string; headers: Record<string, string> }

/** 개발 로그인(스테이징 전용)으로 운영자 세션을 만든다. */
export async function adminSession(base: string, email: string): Promise<Session> {
  const login = await fetch(`${base}/auth/dev`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ email, name: "OPRN 운영", next: "/" }) });
  const cookie = login.headers.getSetCookie().map((line) => line.split(";")[0]).join("; ");
  if (login.status !== 303 || !cookie) throw new Error(`개발 로그인 실패 (${login.status}). STORE_DEV_LOGIN=1 인지 확인하세요.`);
  const page = await (await fetch(`${base}/`, { headers: { cookie } })).text();
  const csrf = /<meta name="csrf" content="([^"]+)"/.exec(page)?.[1] ?? "";
  return { base, headers: { cookie, "x-csrf-token": csrf } };
}

export async function publishPack(session: Session, pack: { manifest: StorePackManifest; blobs: Map<string, Uint8Array> }): Promise<{ slug: string; status: string }> {
  const check = await fetch(`${session.base}/api/v1/blobs/check`, { method: "POST", headers: { ...session.headers, "content-type": "application/json" }, body: JSON.stringify({ sha256s: [...pack.blobs.keys()] }) });
  const { missing } = await check.json() as { missing: string[] };
  for (const key of missing) {
    const response = await fetch(`${session.base}/api/v1/blobs`, { method: "POST", headers: { ...session.headers, "x-sha256": key, "content-type": "application/octet-stream" }, body: Buffer.from(pack.blobs.get(key)!) });
    if (!response.ok) throw new Error(`blob 올리기 실패 ${response.status}: ${await response.text()}`);
  }
  const created = await fetch(`${session.base}/api/v1/items`, { method: "POST", headers: { ...session.headers, "content-type": "application/json" }, body: JSON.stringify({ manifest: pack.manifest }) });
  const body = await created.json() as { slug: string; status: string; message?: string; details?: string[] };
  if (created.status !== 201) throw new Error(`상품 만들기 실패 ${created.status}: ${body.message} ${(body.details ?? []).join(" / ")}`);
  return body;
}

/** 카탈로그에 같은 제목이 없을 때만 올린다(다시 돌려도 중복이 생기지 않는다). */
export async function seedBundles(base: string, adminEmail: string, publicDir: string, log: (line: string) => void = () => {}): Promise<string[]> {
  const session = await adminSession(base, adminEmail);
  const existing = await (await fetch(`${base}/api/v1/items?page=1`)).json() as { items: { title: string; slug: string }[] };
  const slugs: string[] = [];
  for (const seed of SEED_BUNDLES) {
    const found = existing.items.find((item) => item.title === seed.title);
    if (found) { slugs.push(found.slug); continue; }
    const pack = bundlePack(seed, publicDir);
    const created = await publishPack(session, pack);
    log(`[seed] ${seed.title} → ${created.slug} (${created.status}, blob ${pack.blobs.size})`);
    slugs.push(created.slug);
  }
  return slugs;
}
