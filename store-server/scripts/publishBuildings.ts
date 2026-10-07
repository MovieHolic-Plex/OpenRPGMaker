/**
 * 건물 검수 하네스(beodeul-building-review)에서 사람이 허용한 건물 팩을 스토어에 올린다. 프로필마다 한 상품.
 * 팩 내용은 저장소의 설치 결과(profiles.json 의 bundle: 시트·카탈로그·참고문서)다 — 먼저 install/rebuild 로 굽는다.
 *
 *   vite-node store-server/scripts/publishBuildings.ts --profile beodeul --target plan
 *   vite-node store-server/scripts/publishBuildings.ts --profile beodeul --target staging            (mdc-server:18320, 개발 로그인)
 *   STORE_LINK_TOKEN=<admin-link 토큰> vite-node store-server/scripts/publishBuildings.ts --profile beodeul --target production --confirm <contentHash>
 *
 * 운영(공개 장터)은 되돌리기 어려워서 plan 이 알려 준 contentHash 를 --confirm 으로 되돌려 줘야 올린다.
 * 같은 내용이 이미 그 대상에 올라가 있으면(기록 DATA/store-uploads.json) 건너뛰고, 내용이 바뀌면 판본을 더한다.
 * 마지막 줄은 항상 한 줄 JSON 결과다.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createBeodeulReviewedStandalone } from "../../src/project/defaults/beodeulReviewed";
import { validateManifest } from "../../src/assetStore/format";
import { addVersion, adminSession, bundlePack, closeSession, linkSession, publishPack, type BundleSeed } from "./seedBundles";

/** 프로필 id → 호스트 없이 쓰는 타일셋 생성기. 새 프로필은 여기에 한 줄 더한다. */
const CREATORS: Record<string, () => import("../../src/project/types").TilesetDef> = {
  beodeul: createBeodeulReviewedStandalone,
};
const TARGETS = {
  staging: { base: "http://mdc-server:18320", dev: "admin@openrpgmaker.com" },
  production: { base: "https://store.openrpgmaker.com" },
} as const;

const arg = (name: string): string | undefined => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const root = join(import.meta.dirname, "..", "..");
const profiles = (JSON.parse(readFileSync(join(root, "src/harnesses/beodeul-building-review/profiles.json"), "utf8")).profiles as any[]);
const profile = profiles.find((p) => p.id === (arg("--profile") ?? "beodeul"));
if (!profile) throw new Error(`알 수 없는 프로필: ${arg("--profile")}`);
const create = CREATORS[profile.id];
if (!create) throw new Error(`프로필 ${profile.id} 의 타일셋 생성기가 publishBuildings.ts CREATORS 에 없습니다.`);
const target = (arg("--target") ?? "plan") as "plan" | "staging" | "production";
const B = profile.bundle, S = profile.store;
const dataDir = (process.env[profile.dataEnv ?? ""] || profile.dataDir).replace(/^~/, homedir());
const recordFile = join(dataDir, "store-uploads.json");

const seed: BundleSeed = {
  create, sheet: `${(B.publicDir as string).replace(/^public\//, "")}/chipset.png`,
  title: S.title, summary: S.summary, description: S.description, tags: S.tags, previews: S.previews,
  displayName: B.name, locales: S.locales,
};
const pack = bundlePack(seed, join(root, "public"));
const checked = validateManifest(pack.manifest);
const contentHash = createHash("sha256").update(JSON.stringify(pack.manifest)).digest("hex");
const catalog = JSON.parse(readFileSync(join(root, B.catalog), "utf8"));
const bytes = [...pack.blobs.values()].reduce((sum, blob) => sum + blob.byteLength, 0);
const records: Record<string, { contentHash: string; slug: string; at: string; versions: number }> = existsSync(recordFile) ? JSON.parse(readFileSync(recordFile, "utf8")) : {};
const recordKey = (t: string) => `${profile.id}:${t}`;
const out = (value: object, code = 0): never => { console.log(JSON.stringify(value)); process.exit(code); };

async function findItem(base: string) {
  const listing = await (await fetch(`${base}/api/v1/items?pageSize=48&lang=ko`)).json() as { items: { title: string; slug: string }[] };
  return listing.items.find((item) => item.title === seed.title) ?? null;
}

const summary = { profile: profile.id, title: seed.title, buildings: catalog.buildings.length, tiles: catalog.count, blobs: pack.blobs.size, megabytes: +(bytes / 1048576).toFixed(2), contentHash, valid: checked.ok, errors: checked.ok ? [] : checked.errors };
if (!checked.ok) out({ ...summary, ok: false, error: "매니페스트 검증 실패" }, 1);

if (target === "plan") {
  const state: Record<string, unknown> = {};
  for (const t of ["staging", "production"] as const) {
    try {
      const found = await findItem(TARGETS[t].base);
      const rec = records[recordKey(t)];
      state[t] = { reachable: true, slug: found?.slug ?? null, exists: !!found, uploadedHash: rec?.contentHash ?? null, upToDate: !!found && rec?.contentHash === contentHash };
    } catch (error) { state[t] = { reachable: false, error: String((error as Error).message ?? error) }; }
  }
  out({ ...summary, ok: true, targets: state });
}

if (target === "production") {
  if (arg("--confirm") !== contentHash) out({ ...summary, ok: false, error: "운영에 올리려면 plan 이 보여 준 contentHash 확인이 필요합니다(그 사이 내용이 바뀌었을 수도 있습니다)." }, 2);
  if (!process.env.STORE_LINK_TOKEN) out({ ...summary, ok: false, error: "STORE_LINK_TOKEN(admin-link 일회용 토큰)이 필요합니다." }, 2);
}
const spec = TARGETS[target];
const session = target === "staging" ? await adminSession(spec.base, (spec as { dev: string }).dev) : await linkSession(spec.base, process.env.STORE_LINK_TOKEN!);
try {
  const found = await findItem(spec.base);
  const rec = records[recordKey(target)];
  let result: Record<string, unknown>;
  if (found && rec?.contentHash === contentHash) result = { action: "skip", slug: found.slug, note: "같은 내용이 이미 올라가 있습니다." };
  else if (found) {
    const added = await addVersion(session, found.slug, pack);
    if (added.status !== 201 && added.status !== 200) throw new Error(`판본 더하기 실패 ${added.status}: ${added.body}`);
    result = { action: "version", slug: found.slug, status: added.status };
    records[recordKey(target)] = { contentHash, slug: found.slug, at: new Date().toISOString(), versions: (rec?.versions ?? 0) + 1 };
  } else {
    const created = await publishPack(session, pack);
    result = { action: "create", slug: created.slug, status: created.status };
    records[recordKey(target)] = { contentHash, slug: created.slug, at: new Date().toISOString(), versions: 1 };
  }
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(recordFile, JSON.stringify(records, null, 1) + "\n");
  out({ ...summary, ok: true, target, base: spec.base, ...result });
} catch (error) {
  out({ ...summary, ok: false, target, error: String((error as Error).message ?? error) }, 1);
} finally {
  await closeSession(session).catch(() => {});
}
