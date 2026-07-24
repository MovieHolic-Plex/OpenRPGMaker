/**
 * Seed the OpenRPGMaker community tables with sample content.
 * The seed game package is produced by the EDITOR'S OWN code
 * (createBlankProject + createProjectPackage) so interop is guaranteed.
 *
 * Run from repo root:  npx tsx community-site/db/seed-community.mts
 */
import { readFile } from "node:fs/promises";
import { createBlankProject } from "@/project/defaults/defaultProject";
import { createProjectPackage } from "@/project/package";
import { Client } from "pg";

const connectionString = process.env.COMMUNITY_DATABASE_URL;
if (connectionString === undefined || connectionString.trim().length === 0) {
  console.error("COMMUNITY_DATABASE_URL is required.");
  process.exit(1);
}

const client = new Client({ connectionString });
await client.connect();

async function upsert(table: string, row: Record<string, unknown>): Promise<void> {
  if (table === "openrpg_assets") {
    await client.query(
      `insert into public.openrpg_assets (slug,name,kind,description,author,tags,data_url,meta)
       values ($1,$2,$3,$4,$5,$6,$7,$8)
       on conflict (slug) do update set name=excluded.name, description=excluded.description,
         data_url=excluded.data_url, meta=excluded.meta`,
      [row.slug, row.name, row.kind, row.description, row.author, row.tags, row.data_url, JSON.stringify(row.meta)],
    );
    return;
  }
  await client.query(
    `insert into public.openrpg_games (slug,title,description,author,tags,package_base64,map_count,asset_count)
     values ($1,$2,$3,$4,$5,$6,$7,$8)
     on conflict (slug) do update set title=excluded.title, description=excluded.description,
       package_base64=excluded.package_base64, map_count=excluded.map_count, asset_count=excluded.asset_count`,
    [row.slug, row.title, row.description, row.author, row.tags, row.package_base64, row.map_count, row.asset_count],
  );
}

async function toDataUrl(path: string): Promise<{ dataUrl: string; bytes: number }> {
  const buf = await readFile(path);
  return { dataUrl: `data:image/png;base64,${buf.toString("base64")}`, bytes: buf.length };
}

const project = createBlankProject();
project.meta.title = "Sample Adventure (Community Seed)";
const blob = createProjectPackage(project);
const pkgBase64 = Buffer.from(await blob.arrayBuffer()).toString("base64");
const mapCount = Object.keys(project.maps).length;
const uploadedCount = Object.keys(project.assets.uploaded).length;
console.log(`package: ${pkgBase64.length} base64 chars, maps=${mapCount}, uploadedAssets=${uploadedCount}`);

const charset = await toDataUrl("public/assets/easyrpg-charset-object1.png");
const chipset = await toDataUrl("public/assets/easyrpg-chipset-interior.png");
const face = await toDataUrl("public/assets/generated/rm2k3/hero-01-face.png");

const assets = [
  {
    slug: "easyrpg-charset-object1",
    name: "EasyRPG Object Charset 1",
    kind: "charset",
    description: "RTP-style object/door/switch charset in the EasyRPG tradition. Drop it straight onto event graphics.",
    author: "openrpgmaker",
    tags: ["rtp", "object", "event"],
    data_url: charset.dataUrl,
    meta: { width: 288, height: 256, frames: 4 },
  },
  {
    slug: "easyrpg-chipset-interior",
    name: "EasyRPG Interior Chipset",
    kind: "chipset",
    description: "Interior tiles for houses, shops and dungeons. Import as a chipset resource and assign it to your tilesets.",
    author: "openrpgmaker",
    tags: ["rtp", "interior", "tileset"],
    data_url: chipset.dataUrl,
    meta: { tileSize: 48, width: 768, height: 720 },
  },
  {
    slug: "hero-01-face",
    name: "Hero Faceset 01",
    kind: "faceset",
    description: "RM2k3-style hero faceset. Register it as an actor faceset in the database.",
    author: "openrpgmaker",
    tags: ["hero", "face", "generated"],
    data_url: face.dataUrl,
    meta: { width: 192, height: 192 },
  },
];

for (const a of assets) {
  await upsert("openrpg_assets", a);
  console.log("asset seeded:", a.slug);
}

await upsert("openrpg_games", {
  slug: "sample-adventure",
  title: "Sample Adventure",
  description:
    "A sample game package built from the editor's blank template. Download the .oprn and open it from the editor's Import menu — maps and database arrive as-is.",
  author: "openrpgmaker",
  tags: ["sample", "blank-template"],
  package_base64: pkgBase64,
  map_count: mapCount,
  asset_count: uploadedCount,
});
console.log("game seeded: sample-adventure");
await client.end();
console.log("seed complete");
