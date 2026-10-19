/**
 * 공식 번들 팩 하나(seedBundles.mts SEED_BUNDLES)를 스토어에 올린다. 주소·토큰은 환경 변수로만 받는다(storePublish.mts).
 *
 *   npm run -s store:publish-bundle -- --list
 *   npm run -s store:publish-bundle -- --title "<제목>" --dry                       # 팩만 만들어 검사, contentHash 출력
 *   npm run -s store:publish-bundle -- --title "<제목>" --target staging
 *   STORE_LINK_TOKEN=… npm run -s store:publish-bundle -- --title "<제목>" --target production --confirm <contentHash>
 *   (이미 있는 상품에 고친 팩을 판본으로 더할 때는 --new-version. 없으면 같은 제목은 건너뛴다.)
 * 마지막 줄은 한 줄 JSON 결과다.
 */
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { SEED_BUNDLES, bundlePack } from "./seedBundles.mts";
import { PublishError, addVersion, closeSession, createItem, findOwnItem, openSession, publishProblems, requireTargetBase } from "./storePublish.mts";

const root = resolve(import.meta.dirname, "..", "..");
const arg = (name: string): string | undefined => { const index = process.argv.indexOf(name); return index > 0 ? process.argv[index + 1] : undefined; };
/** 마지막 줄 JSON 을 찍고 끝낸다. 함수 선언이라야 호출 뒤 좁히기가 된다. */
function out(value: object, code = 0): never {
  console.log(JSON.stringify(value));
  process.exit(code);
}

if (process.argv.includes("--list")) out({ ok: true, titles: SEED_BUNDLES.map((seed) => seed.title) });
const title = arg("--title");
const seed = SEED_BUNDLES.find((item) => item.title === title);
if (!seed) out({ ok: false, error: `--title 이 SEED_BUNDLES 에 없습니다: ${title ?? "(없음)"} (--list 로 목록)` }, 2);

const pack = bundlePack(seed, join(root, "public"));
const contentHash = createHash("sha256").update(JSON.stringify(pack.manifest)).digest("hex");
const bytes = [...pack.blobs.values()].reduce((sum, blob) => sum + blob.byteLength, 0);
const problems = publishProblems(pack.manifest);
const summary = { title: seed.title, assets: Object.keys(pack.manifest.content.assets).length, blobs: pack.blobs.size, megabytes: +(bytes / 1048576).toFixed(2), contentHash, valid: problems.length === 0, errors: problems };
if (problems.length > 0) out({ ...summary, ok: false, error: "올리기 전 검사 실패" }, 1);
if (process.argv.includes("--dry")) out({ ...summary, ok: true, dry: true });

const target = arg("--target");
if (target !== "staging" && target !== "production") out({ ...summary, ok: false, error: "--target staging|production 이 필요합니다(또는 --dry)." }, 2);
try {
  const base = requireTargetBase(target);
  if (target === "production" && arg("--confirm") !== contentHash) throw new PublishError("운영에 올리려면 --dry 가 보여 준 contentHash 를 --confirm 으로 주세요.", 2);
  const session = await openSession(target, base);
  let result: Record<string, unknown>;
  try {
    const slug = await findOwnItem(session, seed.title);
    if (slug && process.argv.includes("--new-version")) result = { action: "version", slug, ...(await addVersion(session, slug, pack)) };
    else if (slug) result = { action: "skip", slug, note: "이미 있습니다(판본을 더하려면 --new-version)." };
    else result = { action: "create", ...(await createItem(session, pack)) };
  } finally {
    // process.exit 는 finally 를 건너뛰므로 세션을 먼저 닫고 결과를 찍는다.
    await closeSession(session);
  }
  out({ ...summary, ok: true, target, ...result });
} catch (error) { // no-excuse-ok: catch — CLI 경계, 마지막 줄 JSON 으로 돌려준다
  out({ ...summary, ok: false, target, error: error instanceof Error ? error.message : String(error) }, error instanceof PublishError ? error.exitCode : 1);
}
