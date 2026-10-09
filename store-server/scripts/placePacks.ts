/**
 * 버들항 장소 팩 — `scripts/content/beodeul-picks/build_place_packs.py` 가 만든 폴더(build/place-packs/<slug>/)를 스토어 팩으로 올린다.
 * 장소 하나 = 팩 하나(작은 타일셋 + 참고문서 + 전투 배경). 받은 사람의 조수가 이 팩 하나만으로 그 장소를 깐다.
 *
 *   python3 scripts/content/beodeul-picks/build_place_packs.py --all
 *   npx tsx store-server/scripts/placePacks.ts --dry [--only desert-castle]
 *   npx tsx store-server/scripts/placePacks.ts --base http://mdc-server:18320 --dev admin@openrpgmaker.com [--only slug] [--new-version]
 *   (운영은 --base https://store.openrpgmaker.com --link-token <admin-link 토큰> — 사용자 지시가 있을 때만)
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { STORE_PACK_SCHEMA, blobPlaceholder, mapStrings, validateManifest, type StoreBlobMime, type StoreLocalizedTexts, type StorePackManifest } from "../../src/assetStore/format";
import { pngSize, sniffMime } from "../../src/assetStore/sniff";
import type { TilesetDef } from "../../src/project/types";
import { adminSession, addVersion, closeSession, linkSession, publishPack } from "./seedBundles";

const ROOT = join(import.meta.dirname, "..", "..");
const PACKS = join(ROOT, "build", "place-packs");

/** 슬러그 → 영어 이름. 상품 글의 en 판. */
const EN: Record<string, string> = {
  "plains-highroad": "Plains High Road", "ancient-forest": "Ancient Forest Ruins", "ice-age-field": "Ice Age Snowfield", "desert-pyramid": "Desert Pyramid",
  "volcano-field": "Volcano Field", "swamp-dungeon": "Swamp Dungeon", "rock-cave": "Rock Cave", "mine-tunnels": "Mine Tunnels", "ice-cave": "Ice Cave",
  "dark-fortress": "Dark Fortress", "graveyard-crypt": "Graveyard & Crypt", "tower-interior": "Tower Interior", "ruined-village": "Ruined Village",
  "mountain-fortress": "Mountain Fortress", "prehistoric-village": "Prehistoric Village", "future-ruins": "Future Ruins", "sky-city": "Sky City",
  "time-rift": "Time Rift", "airship": "Airship Deck & Cabins", "machine-factory": "Machine Factory & Lab", "opera-stage": "Opera House & Stage",
  "ghost-train": "Ghost Train Station", "empire-city": "Iron Empire City", "wasteland-world": "Wasteland After the Collapse", "final-tower": "Final Tower",
  "desert-castle": "Desert Castle & Oasis", "rain-ruin-town": "Rainy Vertical Ruin Town", "veldt-coliseum": "Veldt & Coliseum", "cultist-tower": "Cultist Tower",
  "mansion-art-city": "Noble Mansion & Art City", "eastern-castle": "Eastern Castle & Ninja Village",
  "airship-dock": "Airship Dock", "bamboo-valley": "Bamboo Valley", "bleak-moor": "Bleak Moor", "clockwork-tower": "Clockwork Tower Interior",
  "european-quarter-stone": "Stone European Avenue", "european-quarter-timber": "Timber-Frame Old Town", "european-quarter-verdigris": "Verdigris-Roof Manor District",
  "european-tavern-cellar": "Tavern Cellar & Kitchen", "gothic-village": "Misty Gothic Village", "haunted-manor": "Haunted Manor Interior",
  "lantern-river-town": "Lantern River Town", "natural-forest-clearing": "Natural Forest Clearing", "steam-city": "Steam City Streets", "wuxia-sect-mountain": "Mountain Martial Sect",
  "event-props": "Event Props (Save Crystal, Warp Pad, Chests, Doors)",
};

interface PlaceMeta { slug: string; ko: string; cats: string[]; kits: number; autotiles: number; strips: number; cells: number; count: number; use: string; hasBattleBg: boolean; images: string[]; battleBgName: string }

const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export function placePack(slug: string, dir = join(PACKS, slug)): { manifest: StorePackManifest; blobs: Map<string, Uint8Array>; meta: PlaceMeta } {
  const meta = JSON.parse(readFileSync(join(dir, "meta.json"), "utf8")) as PlaceMeta;
  const blobs = new Map<string, { bytes: Uint8Array; mime: StoreBlobMime }>();
  const add = (bytes: Uint8Array): string => {
    const mime = sniffMime(bytes);
    if (!mime) throw new Error(`${slug}: 알 수 없는 형식`);
    const key = sha(bytes);
    blobs.set(key, { bytes, mime });
    return key;
  };
  const sheetBytes = new Uint8Array(readFileSync(join(dir, "sheet.png")));
  const sheetSize = pngSize(sheetBytes);
  if (!sheetSize) throw new Error(`${slug}: sheet.png 가 PNG 가 아닙니다`);
  const sheetSha = add(sheetBytes);
  const source = JSON.parse(readFileSync(join(dir, "tileset.json"), "utf8")) as TilesetDef;
  const tileset = mapStrings(source, (text) => {
    if (!/^\/images\/.+\.png$/i.test(text)) return text;
    const file = join(dir, text.slice(1));
    return existsSync(file) ? blobPlaceholder(add(new Uint8Array(readFileSync(file)))) : text;
  }) as TilesetDef;
  const sheetAssetId = (source.image as { id: string }).id;
  const assets: StorePackManifest["content"]["assets"] = {
    [sheetAssetId]: { id: sheetAssetId, name: source.name, kind: "chipset", blob: sheetSha, mime: "image/png", meta: { width: sheetSize.width, height: sheetSize.height, tileSize: 16 } },
  };
  const previews: string[] = [];
  const map = meta.images.find((name) => name.endsWith("-map.png"));
  if (map) previews.push(add(new Uint8Array(readFileSync(join(dir, "images", map)))));
  const partsImg = meta.images.find((name) => name.endsWith("-parts.png"));
  if (partsImg) previews.push(add(new Uint8Array(readFileSync(join(dir, "images", partsImg)))));
  if (meta.hasBattleBg) {
    const bytes = new Uint8Array(readFileSync(join(dir, "battle-bg.png")));
    const size = pngSize(bytes);
    if (!size || size.width !== 640 || size.height !== 360) throw new Error(`${slug}: 전투 배경은 640×360 이어야 합니다`);
    const id = `beodeul_${slug.replace(/-/g, "_")}_battle_bg`;
    assets[id] = { id, name: meta.battleBgName, kind: "backdrop", blob: add(bytes), mime: "image/png", meta: { width: 640, height: 360 } };
    previews.push(sha(bytes));
  }
  previews.push(sheetSha);

  const en = EN[slug] ?? meta.ko;
  const title = `버들항 장소 — ${meta.ko}`;
  const summary = `${meta.ko} 16px 손 도트 타일셋. 키트 ${meta.kits}종·참고문서 포함${meta.hasBattleBg ? "·전투 배경 1장" : ""}.`.slice(0, 160);
  const description = [
    `${meta.ko}을(를) 깔 수 있는 버들항 화풍(16px 3/4 시점 손 도트) 타일셋입니다. 칸 ${meta.cells}개, 구조물·소품 키트 ${meta.kits}종${meta.autotiles ? `, 16변형 오토타일 ${meta.autotiles}종` : ""}${meta.strips ? `, 애니메이션 칸 ${meta.strips}종` : ""}.`,
    meta.use ? `\n장소 설명: ${meta.use.slice(0, 700)}` : "",
    "\n참고문서(구역 표·조각 표·조립 순서·정상/오류 그림)가 들어 있어 에디터 조수가 이 장소를 바로 짓습니다.",
    meta.hasBattleBg ? "\n같은 화풍의 전투 배경(640×360) 1장이 함께 들어 있습니다 — 전투 배경 고르기에서 업로드한 그림으로 보입니다." : "",
  ].join("");
  const locales: StoreLocalizedTexts = {
    en: {
      title: `Beodeul Place — ${en}`,
      summary: `16px hand-pixel 3/4 tileset for ${en}. ${meta.kits} kits with reference docs${meta.hasBattleBg ? " and one battle background" : ""}.`.slice(0, 160),
      description: `A 16px hand-pixel (3/4 view) tileset for building ${en} in the Beodeul art style: ${meta.cells} tiles and ${meta.kits} structure/prop kits${meta.autotiles ? `, ${meta.autotiles} 16-variant autotiles` : ""}${meta.strips ? `, ${meta.strips} animated strips` : ""}.\nIncluded reference docs (zone table, part table, build order, correct/incorrect pictures) let the editor assistant build this place right away.${meta.hasBattleBg ? "\nA matching 640×360 battle background is included." : ""}`,
    },
  };
  const manifest: StorePackManifest = {
    schema: STORE_PACK_SCHEMA,
    title, summary, description,
    locales: { ko: { title, summary, description }, ...locales },
    tags: ["버들항", meta.ko.slice(0, 20), "16px", "판타지"].filter((tag, i, all) => tag.length <= 24 && all.indexOf(tag) === i).slice(0, 12),
    kind: "tileset",
    license: "OPRN-GAME",
    aiGenerated: true,
    credits: `${title} — OPRN 공식 팩 (openrpgmaker.com)`,
    content: { assets, tilesets: { [tileset.id]: tileset } },
    previews: previews.slice(0, 6),
    blobs: [...blobs].map(([key, blob]) => ({ sha256: key, mime: blob.mime, bytes: blob.bytes.byteLength })),
  };
  return { manifest, blobs: new Map([...blobs].map(([key, blob]) => [key, blob.bytes])), meta };
}

const arg = (name: string): string | undefined => { const index = process.argv.indexOf(name); return index > 0 ? process.argv[index + 1] : undefined; };

async function main() {
  const only = arg("--only");
  const slugs = readdirSync(PACKS).filter((name) => existsSync(join(PACKS, name, "meta.json")) && (!only || name === only)).sort();
  if (slugs.length === 0) throw new Error(`build/place-packs 에 팩이 없습니다 — build_place_packs.py --all 을 먼저 돌리세요.`);
  const packs = slugs.map((slug) => placePack(slug));
  let bad = 0;
  for (const [i, pack] of packs.entries()) {
    const checked = validateManifest(pack.manifest);
    const bytes = [...pack.blobs.values()].reduce((sum, blob) => sum + blob.byteLength, 0);
    console.log(`[pack] ${slugs[i]}: 에셋 ${Object.keys(pack.manifest.content.assets).length} · blob ${pack.blobs.size} (${(bytes / 1048576).toFixed(2)}MB) · 매니페스트 ${(JSON.stringify(pack.manifest).length / 1024).toFixed(0)}KB ${checked.ok ? "OK" : "실패"}`);
    if (!checked.ok) { bad += 1; console.log("   " + checked.errors.join("\n   ")); }
  }
  if (bad) throw new Error(`${bad}개 팩 검증 실패`);
  if (process.argv.includes("--dry")) return;
  const base = arg("--base");
  if (!base) throw new Error("--base 가 필요합니다.");
  const dev = arg("--dev");
  const token = arg("--link-token");
  const session = dev ? await adminSession(base, dev) : token ? await linkSession(base, token) : null;
  if (!session) throw new Error("--dev 또는 --link-token 이 필요합니다.");
  try {
    const listing = await (await fetch(`${base}/api/v1/items?pageSize=48&lang=ko`)).json() as { items: { title: string; slug: string }[] };
    const all: { title: string; slug: string }[] = [...listing.items];
    for (let page = 2; page <= 20 && listing.items.length === 48; page += 1) {
      const next = await (await fetch(`${base}/api/v1/items?pageSize=48&lang=ko&page=${page}`)).json() as { items: { title: string; slug: string }[] };
      all.push(...next.items);
      if (next.items.length < 48) break;
    }
    for (const [i, pack] of packs.entries()) {
      const found = all.find((item) => item.title === pack.manifest.title);
      if (found && process.argv.includes("--new-version")) {
        const added = await addVersion(session, found.slug, pack);
        console.log(`[version] ${slugs[i]} → ${found.slug} ${added.status}`);
      } else if (found) console.log(`[skip] ${slugs[i]} 이미 있음 → ${found.slug}`);
      else {
        const created = await publishPack(session, pack);
        console.log(`[ok] ${slugs[i]} → ${created.slug} (${created.status})`);
      }
    }
  } finally {
    await closeSession(session);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
