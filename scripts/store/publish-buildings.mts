/**
 * 건물 검수 하네스(beodeul-building-review)에서 사람이 허용한 건물 팩을 스토어에 올린다. 프로필마다 한 상품.
 * 하네스 화면의 「스토어에 올리기」가 OPRN_STORE_PUBLISHER 로 이 명령을 부른다(src/harnesses/beodeul-building-review/node/mount.py).
 * 팩 내용은 저장소의 설치 결과(profiles.json 의 bundle: 시트·카탈로그·참고문서)다 — 먼저 install/rebuild 로 굽는다.
 *
 *   OPRN_STORE_PUBLISHER="npm run -s store:publish-buildings --"      (= vite-node --script scripts/store/publish-buildings.mts --)
 *   … --profile beodeul --target plan
 *   … --profile beodeul --target staging                                   (STORE_PUBLISH_STAGING_URL · STORE_PUBLISH_DEV_EMAIL)
 *   STORE_LINK_TOKEN=… … --profile beodeul --target production --confirm <contentHash>   (STORE_PUBLISH_PRODUCTION_URL)
 *
 * 운영은 되돌리기 어려워서 plan 이 알려 준 contentHash 를 --confirm 으로 되돌려 줘야 올린다.
 * 같은 내용이 이미 그 대상에 올라가 있으면(DATA/store-uploads.json) 건너뛰고, 내용이 바뀌면 판본을 더한다.
 * 마지막 줄은 항상 한 줄 JSON 결과다(mount.py 가 읽는다).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { createBeodeulReviewedStandalone } from "../../src/project/defaults/beodeulReviewed";
import type { TilesetDef } from "../../src/project/types";
import { STORE_LOCALES } from "../../src/assetStore/format";
import { z } from "zod";
import { bundlePack, type BundleSeed } from "./seedBundles.mts";
import { PublishError, addVersion, closeSession, createItem, findOwnItem, findPublicItem, openSession, publishProblems, requireTargetBase, targetBase, type PublishTarget } from "./storePublish.mts";

/** 프로필 id → 호스트 없이 쓰는 타일셋 생성기. 새 프로필은 여기에 한 줄 더한다. */
const CREATORS: Readonly<Record<string, () => TilesetDef>> = { beodeul: createBeodeulReviewedStandalone };

const LocalizedText = z.object({ title: z.string(), summary: z.string(), description: z.string() });
const BuildingProfile = z.object({
  id: z.string(), dataEnv: z.string().optional(), dataDir: z.string(),
  bundle: z.object({ publicDir: z.string(), catalog: z.string(), name: z.string() }),
  store: z.object({ title: z.string(), summary: z.string(), description: z.string(), tags: z.array(z.string()), previews: z.array(z.string()), locales: z.partialRecord(z.enum(STORE_LOCALES), LocalizedText).optional() }),
});
const UploadRecords = z.record(z.string(), z.object({ contentHash: z.string(), slug: z.string(), at: z.string(), versions: z.number() }));
type UploadRecord = z.infer<typeof UploadRecords>[string];

const root = resolve(import.meta.dirname, "..", "..");
const arg = (name: string): string | undefined => { const index = process.argv.indexOf(name); return index > 0 ? process.argv[index + 1] : undefined; };
/** 마지막 줄 JSON 을 찍고 끝낸다. 함수 선언이라야 호출 뒤 좁히기가 된다. */
function out(value: object, code = 0): never {
  console.log(JSON.stringify(value));
  process.exit(code);
}

const profileId = arg("--profile") ?? "beodeul";
const listed = z.object({ profiles: z.array(z.looseObject({ id: z.string() })) }).parse(JSON.parse(readFileSync(join(root, "src/harnesses/beodeul-building-review/profiles.json"), "utf8"))).profiles;
const found = listed.find((p) => p.id === profileId);
if (!found) out({ ok: false, error: `알 수 없는 프로필: ${profileId}` }, 2);
// 사람만 고르는 프로필(gate:false)에는 번들·스토어 글이 없을 수 있다 — 고른 프로필만 엄격히 읽는다.
const parsed = BuildingProfile.safeParse(found);
if (!parsed.success) out({ ok: false, error: `프로필 ${profileId} 에 스토어 게시 설정(bundle·store)이 없습니다: ${parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")}` }, 2);
const profile = parsed.data;
const create = CREATORS[profile.id];
if (!create) out({ ok: false, error: `프로필 ${profile.id} 의 타일셋 생성기가 publish-buildings.mts CREATORS 에 없습니다.` }, 2);
const target = arg("--target") ?? "plan";
if (target !== "plan" && target !== "staging" && target !== "production") out({ ok: false, error: `--target 은 plan|staging|production 이어야 합니다(지금 ${target}).` }, 2);

const dataDir = (process.env[profile.dataEnv ?? ""] || profile.dataDir).replace(/^~/, homedir());
const recordFile = join(dataDir, "store-uploads.json");
const seed: BundleSeed = {
  create, sheet: `${profile.bundle.publicDir.replace(/^public\//, "")}/chipset.png`,
  title: profile.store.title, summary: profile.store.summary, description: profile.store.description, tags: profile.store.tags, previews: profile.store.previews,
  displayName: profile.bundle.name, ...(profile.store.locales ? { locales: profile.store.locales } : {}),
};
const pack = bundlePack(seed, join(root, "public"));
const contentHash = createHash("sha256").update(JSON.stringify(pack.manifest)).digest("hex");
const catalog = z.object({ buildings: z.array(z.unknown()), count: z.number() }).parse(JSON.parse(readFileSync(join(root, profile.bundle.catalog), "utf8")));
const bytes = [...pack.blobs.values()].reduce((sum, blob) => sum + blob.byteLength, 0);
const problems = publishProblems(pack.manifest);
const summary = { profile: profile.id, title: seed.title, buildings: catalog.buildings.length, tiles: catalog.count, blobs: pack.blobs.size, megabytes: +(bytes / 1048576).toFixed(2), contentHash, valid: problems.length === 0, errors: problems };
if (problems.length > 0) out({ ...summary, ok: false, error: "올리기 전 검사 실패" }, 1);

const records: Record<string, UploadRecord> = existsSync(recordFile) ? UploadRecords.parse(JSON.parse(readFileSync(recordFile, "utf8"))) : {};
const recordKey = (t: PublishTarget): string => `${profile.id}:${t}`;

if (target === "plan") {
  const state: Record<string, unknown> = {};
  for (const t of ["staging", "production"] as const) {
    const base = targetBase(t);
    if (!base) { state[t] = { configured: false }; continue; }
    try {
      const slug = await findPublicItem(base, seed.title);
      const rec = records[recordKey(t)];
      state[t] = { configured: true, reachable: true, slug, exists: slug !== null, uploadedHash: rec?.contentHash ?? null, upToDate: slug !== null && rec?.contentHash === contentHash };
    } catch (error) {
      state[t] = { configured: true, reachable: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  out({ ...summary, ok: true, targets: state });
}

const publishTarget: PublishTarget = target === "production" ? "production" : "staging";
try {
  const base = requireTargetBase(publishTarget);
  if (publishTarget === "production" && arg("--confirm") !== contentHash) {
    throw new PublishError("운영에 올리려면 plan 이 보여 준 contentHash 확인이 필요합니다(그 사이 내용이 바뀌었을 수도 있습니다).", 2);
  }
  const session = await openSession(publishTarget, base);
  let result: Record<string, unknown>;
  try {
    const slug = await findOwnItem(session, seed.title);
    const rec = records[recordKey(publishTarget)];
    if (slug && rec?.contentHash === contentHash) result = { action: "skip", slug, note: "같은 내용이 이미 올라가 있습니다." };
    else if (slug) {
      const added = await addVersion(session, slug, pack);
      result = { action: "version", slug, version: added.version, status: added.status };
      records[recordKey(publishTarget)] = { contentHash, slug, at: new Date().toISOString(), versions: (rec?.versions ?? 0) + 1 };
    } else {
      const created = await createItem(session, pack);
      result = { action: "create", slug: created.slug, status: created.status };
      records[recordKey(publishTarget)] = { contentHash, slug: created.slug, at: new Date().toISOString(), versions: 1 };
    }
  } finally {
    // process.exit 는 finally 를 건너뛰므로 세션을 먼저 닫고 결과를 찍는다.
    await closeSession(session);
  }
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(recordFile, `${JSON.stringify(records, null, 1)}\n`);
  out({ ...summary, ok: true, target: publishTarget, ...result });
} catch (error) { // no-excuse-ok: catch — CLI 경계, 마지막 줄 JSON 으로 돌려준다
  out({ ...summary, ok: false, target: publishTarget, error: error instanceof Error ? error.message : String(error) }, error instanceof PublishError ? error.exitCode : 1);
}
