/**
 * 공식 번들 팩 하나를 스토어에 올린다(운영·스테이징 공통). seedBundles 는 개발 로그인(스테이징·e2e) 전용이라
 * 운영(https)에는 admin-link 일회용 토큰으로 들어와 같은 팩을 올린다. 같은 제목이 이미 있으면 건너뛴다.
 *
 *   npx tsx store-server/scripts/publishBundle.ts --title "마법 학교 — 고딕 성채·교실·숲·호수" --dry
 *   npx tsx store-server/scripts/publishBundle.ts --base http://mdc-server:18320 --dev admin@openrpgmaker.com --title …
 *   npx tsx store-server/scripts/publishBundle.ts --base https://store.openrpgmaker.com --link-token <admin-link 토큰> --title …
 */
import { join } from "node:path";
import { validateManifest } from "../../src/assetStore/format";
import { SEED_BUNDLES, adminSession, bundlePack, publishPack } from "./seedBundles";

const arg = (name: string): string | undefined => { const index = process.argv.indexOf(name); return index > 0 ? process.argv[index + 1] : undefined; };
const title = arg("--title");
const seed = SEED_BUNDLES.find((item) => item.title === title);
if (!seed) throw new Error(`--title 이 SEED_BUNDLES 에 없습니다: ${title ?? "(없음)"}\n${SEED_BUNDLES.map((item) => `  ${item.title}`).join("\n")}`);

const pack = bundlePack(seed, join(import.meta.dirname, "..", "..", "public"));
const checked = validateManifest(pack.manifest);
const bytes = [...pack.blobs.values()].reduce((sum, blob) => sum + blob.byteLength, 0);
console.log(`[pack] ${seed.title}: 에셋 ${Object.keys(pack.manifest.content.assets).length} · blob ${pack.blobs.size} (${(bytes / 1048576).toFixed(1)}MB) · 매니페스트 ${(JSON.stringify(pack.manifest).length / 1048576).toFixed(1)}MB`);
if (!checked.ok) throw new Error(`매니페스트 검증 실패:\n  ${checked.errors.join("\n  ")}`);
if (process.argv.includes("--dry")) process.exit(0);

const base = arg("--base");
if (!base) throw new Error("--base 가 필요합니다.");

async function linkSession(token: string) {
  const login = await fetch(`${base}/auth/link`, { method: "POST", redirect: "manual", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token }) });
  const cookie = login.headers.getSetCookie().map((line) => line.split(";")[0]).join("; ");
  if (!cookie) throw new Error(`링크 로그인 실패 (${login.status}). 토큰은 15분·한 번만 쓸 수 있다.`);
  const page = await (await fetch(`${base}/`, { headers: { cookie } })).text();
  const csrf = /<meta name="csrf" content="([^"]+)"/.exec(page)?.[1];
  if (!csrf) throw new Error("로그인하지 못했습니다(csrf 없음).");
  return { base: base!, headers: { cookie, "x-csrf-token": csrf } };
}

const dev = arg("--dev");
const token = arg("--link-token");
const session = dev ? await adminSession(base, dev) : token ? await linkSession(token) : null;
if (!session) throw new Error("--dev 또는 --link-token 이 필요합니다.");
try {
  const listing = await (await fetch(`${base}/api/v1/items?pageSize=48&lang=ko`)).json() as { items: { title: string; slug: string }[] };
  const found = listing.items.find((item) => item.title === seed.title);
  if (found) console.log(`[skip] 이미 있음 → ${found.slug}`);
  else {
    const created = await publishPack(session, pack);
    console.log(`[ok] ${seed.title} → ${created.slug} (${created.status})`);
  }
} finally {
  // 쓰고 난 운영자 세션을 남기지 않는다(/api/v1/logout 은 앱 토큰만 지운다).
  await fetch(`${base}/logout`, { method: "POST", redirect: "manual", headers: { cookie: session.headers.cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrf: session.headers["x-csrf-token"] }) });
}
