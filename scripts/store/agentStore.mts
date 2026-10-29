/**
 * 코딩 에이전트의 스토어 제출 명령 — `npm run -s store -- <명령>`. 문서: openwiki/store-agent-contribution.md
 *
 *   npm run -s store -- whoami                                   # 토큰 파일·계정·에이전트 이름 확인(토큰은 찍지 않는다)
 *   npm run -s store -- init <폴더> --kind character --title "…" --license CC-BY-4.0 --method generative-model --engine <도구> --model <모델> --file a.png [--file b.png]
 *                         # --method: generative-model·mixed(--model 필수)|procedural(생성 모델 없음, --model 없음). 실제로 돌린 그대로
 *                         [--summary "…"] [--description "…"] [--tags a,b] [--credits "…"]   # 그림·소리 파일로 팩 폴더 만들기
 *   npm run -s store -- check <폴더>                             # 올리기 전 검사만(형식·규격·타사 이름·AI 표시·3/4 관문)
 *   npm run -s store -- publish <폴더> [--draft]                  # 검사 → 파일 올리기 → 새 상품 제출(항상 확인 대기)
 *   npm run -s store -- version <slug> <폴더>                     # 에이전트가 제출한 내 상품에 새 판본(다시 확인 대기)
 *   npm run -s store -- mine                                     # 내 계정 상품과 상태
 *   npm run -s store -- preview <폴더> [--scene out.png]          # 제출 전 비공개 일회용 미리보기(나만, 24시간). 관문 없이 내용 검사만
 *   npm run -s store -- submit <폴더> [--slug <내 상품>]           # 그 미리보기를 제출(검사+3/4 관문 다시) — 새 상품 또는 새 판본
 *   npm run -s store -- discard <폴더>                            # 미리보기 버리기
 *
 * 팩 폴더 = manifest.json(oprn-store-pack/1) + blobs/<sha256>. 스토어 명령줄 `pull` 과 같은 모양이다.
 * 공통 옵션: --base <스토어 주소>(기본 OPRN_STORE_URL 또는 https://store.openrpgmaker.com), --agent "<모델·도구>"(기본 OPRN_AGENT).
 * 토큰: 주인이 발급한 에이전트 토큰(oprn_agent_…)을 권한 600 파일에서 읽는다 — 기본 주소면 ~/.config/oprn-store/agent-token,
 * 다른 주소면 ~/.config/oprn-store/agent-token.<호스트[_포트]>, 또는 OPRN_STORE_AGENT_TOKEN_FILE. 값은 어디에도 찍지 않는다.
 * 마지막 줄은 한 줄 JSON 결과다(에이전트가 읽는다). 종료 코드: 0 성공, 1 검사·서버 거절, 2 사용법·설정 오류.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { PNG } from "pngjs";
import {
  STORE_GENERATION_METHODS, STORE_ITEM_KINDS, STORE_LICENSES, STORE_PACK_SCHEMA, storePackGeneration, STORE_TILE_SIZE, storeImageSizeProblem, storeThirdPartyName, validateManifest,
  type StoreAssetKind, type StoreBlobMime, type StoreGeneration, type StoreGenerationMethod, type StoreItemKind, type StoreLicense, type StorePackManifest,
} from "../../src/assetStore/format";
import { basicTilesetFor } from "../../src/assetStore/pack";
import { pngSize, sniffMime } from "../../src/assetStore/sniff";
import { passingCellIndex, readBaseline, uncoveredSheetCells } from "../../src/harnesses/object-gate/node/cells";

const DEFAULT_BASE = "https://store.openrpgmaker.com";
const TOKEN_PREFIX = "oprn_agent_";
/** 3/4 관문(AGENTS.md hard rule)을 받아야 하는 에셋 종류: 맵에 깔리는 타일·기물 시트. */
const GATED_KINDS: ReadonlySet<StoreAssetKind> = new Set(["chipset", "tileset"]);
/** init 의 상품 종류 → 에셋 종류(스토어 서버 낱장 올리기와 같은 표). */
const ASSET_KIND: Partial<Record<StoreItemKind, StoreAssetKind>> = {
  tileset: "chipset", character: "charset", face: "faceset", battler: "battleCharset", picture: "picture", music: "music", sound: "sound",
};

class CliError extends Error {
  constructor(message: string, readonly code = 1, readonly details: string[] = []) { super(message); }
}

const argv = process.argv.slice(2);
const options = new Map<string, string[]>();
const positional: string[] = [];
const BOOLEAN_FLAGS = new Set(["--draft"]);
let parseError: string | null = null;
for (let index = 0; index < argv.length; index += 1) {
  const arg = argv[index]!;
  if (arg === "--") continue;
  if (arg.startsWith("--")) {
    if (BOOLEAN_FLAGS.has(arg)) { options.set(arg, ["1"]); continue; }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) { parseError ??= `${arg} 에 값이 필요합니다.`; continue; }
    options.set(arg, [...(options.get(arg) ?? []), value]);
    index += 1;
  } else positional.push(arg);
}
const opt = (name: string): string | undefined => options.get(name)?.at(-1);
const base = (opt("--base") ?? process.env.OPRN_STORE_URL ?? DEFAULT_BASE).replace(/\/+$/, "");
const agentName = (opt("--agent") ?? process.env.OPRN_AGENT ?? "").trim();

function usage(message: string): CliError {
  return new CliError(`${message}\n명령: whoami · init <폴더> · check <폴더> · publish <폴더> [--draft] · version <slug> <폴더> · mine · preview <폴더> · submit <폴더> [--slug s] · discard <폴더> (openwiki/store-agent-contribution.md)`, 2);
}

// ── 토큰 ─────────────────────────────────────────────────────────────
function tokenFile(): string {
  if (process.env.OPRN_STORE_AGENT_TOKEN_FILE) return resolve(process.env.OPRN_STORE_AGENT_TOKEN_FILE);
  const dir = join(homedir(), ".config", "oprn-store");
  if (base === DEFAULT_BASE) return join(dir, "agent-token");
  const url = new URL(base);
  return join(dir, `agent-token.${url.hostname}${url.port ? `_${url.port}` : ""}`);
}

function readToken(): string {
  const file = tokenFile();
  if (!existsSync(file)) throw new CliError(`에이전트 토큰 파일이 없습니다: ${file}\n주인이 ${base}/me/agent-tokens 에서 발급해 이 경로에 권한 600 으로 저장해야 합니다.`, 2);
  if ((statSync(file).mode & 0o077) !== 0) throw new CliError(`토큰 파일 권한이 너무 넓습니다: ${file} — chmod 600 "${file}"`, 2);
  const token = readFileSync(file, "utf8").trim();
  if (!token.startsWith(TOKEN_PREFIX) || /\s/.test(token)) throw new CliError(`토큰 파일 내용이 에이전트 토큰(${TOKEN_PREFIX}…)이 아닙니다: ${file}`, 2);
  return token;
}

async function api<T>(path: string, init: { method?: string; json?: unknown; body?: Uint8Array; headers?: Record<string, string> } = {}): Promise<T> {
  const headers: Record<string, string> = { authorization: `Bearer ${readToken()}`, ...(init.headers ?? {}) };
  if (agentName) headers["x-oprn-agent"] = agentName.slice(0, 80);
  if (init.json !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(base + path, {
    method: init.method ?? (init.json !== undefined || init.body ? "POST" : "GET"),
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body ? Buffer.from(init.body) : undefined,
  });
  const text = await response.text();
  let body: (T & { message?: string; error?: string; details?: string[] }) | null = null;
  try { body = text ? JSON.parse(text) : null; } catch { /* 본문이 JSON 이 아니면 상태만 */ }
  if (!response.ok) throw new CliError(`${response.status} ${body?.error ?? ""} ${body?.message ?? text.slice(0, 200)}`.replace(/\s+/g, " ").trim(), response.status === 401 ? 2 : 1, body?.details ?? []);
  return body as T;
}

// ── 팩 폴더 ──────────────────────────────────────────────────────────
interface Pack { manifest: StorePackManifest; blobs: Map<string, Uint8Array> }

function readPack(dir: string): Pack {
  const path = join(dir, "manifest.json");
  if (!existsSync(path)) throw usage(`팩 폴더에 manifest.json 이 없습니다: ${dir}`);
  const manifest = JSON.parse(readFileSync(path, "utf8")) as StorePackManifest;
  const blobs = new Map<string, Uint8Array>();
  for (const ref of Array.isArray(manifest.blobs) ? manifest.blobs : []) {
    const file = join(dir, "blobs", String(ref.sha256));
    if (existsSync(file)) blobs.set(ref.sha256, new Uint8Array(readFileSync(file)));
  }
  return { manifest, blobs };
}

const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

/** 올리기 전 검사. 문제 목록(빈 배열 = 통과)과, 3/4 관문을 거친 시트 수. */
function checkPack(pack: Pack, { gate = true }: { gate?: boolean } = {}): { problems: string[]; notes: string[] } {
  const { manifest, blobs } = pack;
  const problems: string[] = [];
  const notes: string[] = [];
  const valid = validateManifest(manifest);
  if (!valid.ok) problems.push(...valid.errors);
  // 만든 방법(generation)을 밝히면 그대로 표시한다(procedural 만 AI 생성 아님). 밝히지 않으면 에이전트 제출은 AI 생성이어야 한다(서버도 같다).
  if (!storePackGeneration(manifest) && manifest.aiGenerated !== true) problems.push("만든 방법(에셋 generation)을 밝히지 않은 에이전트 제출은 aiGenerated: true 여야 합니다 — 생성 모델 없이 스크립트로만 만들었으면 에셋마다 generation: {method: \"procedural\", engine} 을 적으세요(서버도 거절한다).");
  if (!manifest.credits?.trim()) problems.push("credits 가 비었습니다 — 만든 에이전트·모델과 원작 출처(없으면 「직접 생성」)를 적으세요.");
  // 타사 소재(Rasak·REFMAP·PAW·RPG Maker MV/MZ·RTP) 이름은 서버가 누구에게서나 거절한다. 같은 판정을 먼저 돌린다.
  const named: [string, string][] = [["제목", manifest.title ?? ""], ["크레딧", manifest.credits ?? ""], ...(manifest.tags ?? []).map((tag): [string, string] => ["태그", tag])];
  for (const text of Object.values(manifest.locales ?? {})) if (text?.title) named.push(["번역 제목", text.title]);
  for (const [key, asset] of Object.entries(manifest.content?.assets ?? {})) named.push([`에셋 ${key}`, key], [`에셋 ${key}`, asset.id], [`에셋 ${key}`, asset.name]);
  for (const [key, tileset] of Object.entries(manifest.content?.tilesets ?? {})) {
    named.push([`타일셋 ${key}`, key], [`타일셋 ${key}`, tileset.id], [`타일셋 ${key}`, tileset.name], [`타일셋 ${key} 그림`, tileset.image?.id ?? ""], [`타일셋 ${key} 참고`, tileset.referenceSourceTilesetId ?? ""]);
    for (const graft of tileset.tileGrafts ?? []) named.push([`타일셋 ${key} 이식`, graft.sourceChipset]);
  }
  for (const [where, text] of named) {
    const hit = text ? storeThirdPartyName(text, manifest.license) : null;
    if (hit) problems.push(`${where}: 타사 소재 이름 「${hit}」 — 스토어는 Rasak·REFMAP·PAW·RPG Maker MV/MZ·RTP 소재를 받지 않는다.`);
  }
  for (const ref of manifest.blobs ?? []) {
    const bytes = blobs.get(ref.sha256);
    if (!bytes) { problems.push(`blobs/${ref.sha256} 파일이 없습니다.`); continue; }
    if (sha256(bytes) !== ref.sha256) problems.push(`blobs/${ref.sha256.slice(0, 12)} 의 해시가 이름과 다릅니다.`);
    if (bytes.byteLength !== ref.bytes) problems.push(`blobs/${ref.sha256.slice(0, 12)} 의 크기가 매니페스트(bytes)와 다릅니다.`);
    const mime = sniffMime(bytes);
    if (mime !== ref.mime) problems.push(`blobs/${ref.sha256.slice(0, 12)} 의 실제 형식(${mime ?? "알 수 없음"})이 매니페스트(${ref.mime})와 다릅니다.`);
  }
  if (problems.length > 0) return { problems, notes };
  // 그림 규격 + 3/4 관문. 관문은 영수증만 본다(모델 호출 없음) — 받는 법은 object-gate review.
  const baseline = readBaseline();
  let passing: ReturnType<typeof passingCellIndex> | null = null;
  for (const asset of Object.values(manifest.content.assets)) {
    if (asset.mime !== "image/png") continue;
    const bytes = blobs.get(asset.blob)!;
    const size = pngSize(bytes);
    const sizeProblem = size ? storeImageSizeProblem(asset.kind, size.width, size.height) : "PNG 크기를 읽지 못했습니다.";
    if (sizeProblem) { problems.push(`${asset.name}: ${sizeProblem}`); continue; }
    if (!GATED_KINDS.has(asset.kind)) continue;
    if (!gate) { notes.push(`${asset.name}: 미리보기라 3/4 관문은 아직 보지 않았다 — submit 할 때 본다.`); continue; }
    passing ??= passingCellIndex("store");
    const image = PNG.sync.read(Buffer.from(bytes));
    const data = new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.length);
    const uncovered = uncoveredSheetCells({ width: image.width, height: image.height, data, tileSize: STORE_TILE_SIZE }, baseline, passing);
    if (uncovered.length > 0) {
      problems.push(`${asset.name}: 3/4 관문 영수증이 없는 칸 ${uncovered.length}개(예: ${uncovered.slice(0, 5).map((cell) => `#${cell.index}`).join(" ")}) — `
        + "새 타일·기물 그림은 `npm run harness -- object-gate review` 로 판정받아 store 출구를 통과해야 한다(AGENTS.md 「3/4 탑뷰 관문」). 관문을 건너뛰거나 기준을 낮추지 마라.");
    } else notes.push(`${asset.name}: 3/4 관문 통과(칸 ${image.width / STORE_TILE_SIZE}×${image.height / STORE_TILE_SIZE})`);
  }
  return { problems, notes };
}

// ── init ─────────────────────────────────────────────────────────────
function init(dir: string): Pack {
  const kind = opt("--kind") as StoreItemKind | undefined;
  const assetKind = kind ? ASSET_KIND[kind] : undefined;
  if (!kind || !assetKind) throw usage(`--kind 는 ${Object.keys(ASSET_KIND).join("|")} 중 하나여야 합니다(여러 종류를 섞은 팩은 manifest.json 을 직접 쓴다).`);
  const title = opt("--title");
  const license = opt("--license") as StoreLicense | undefined;
  const files = options.get("--file") ?? [];
  if (!title) throw usage("--title 이 필요합니다.");
  if (!license || !(STORE_LICENSES as readonly string[]).includes(license)) throw usage(`--license 는 ${STORE_LICENSES.join("|")} 중 하나여야 합니다.`);
  if (files.length === 0) throw usage("--file <그림·소리 파일> 이 하나 이상 필요합니다.");
  if (existsSync(join(dir, "manifest.json"))) throw usage(`이미 팩 폴더입니다: ${dir} (덮어쓰지 않는다)`);
  const method = opt("--method") as StoreGenerationMethod | undefined;
  if (!method || !(STORE_GENERATION_METHODS as readonly string[]).includes(method)) {
    throw usage(`--method 는 ${STORE_GENERATION_METHODS.join("|")} 중 하나여야 합니다(실제로 돌린 것 그대로: 생성 모델이 그렸으면 generative-model + --model, 스크립트만이면 procedural).`);
  }
  const engine = opt("--engine");
  const model = opt("--model");
  if (!engine) throw usage("--engine <실제로 돌린 도구>(예 \"char-gen compose\")가 필요합니다.");
  const generation: StoreGeneration = { method, engine, ...(model ? { model } : {}) };
  const audio = kind === "music" || kind === "sound";
  const assets: StorePackManifest["content"]["assets"] = {};
  const tilesets: StorePackManifest["content"]["tilesets"] = {};
  const blobs = new Map<string, Uint8Array>();
  const refs: StorePackManifest["blobs"] = [];
  for (const file of files) {
    const bytes = new Uint8Array(readFileSync(file));
    const mime = sniffMime(bytes) as StoreBlobMime | null;
    if (!mime) throw new CliError(`받지 않는 파일 형식입니다: ${file} (PNG·JPEG·WebP·OGG·MP3·WAV·M4A)`, 2);
    if (audio !== mime.startsWith("audio/")) throw new CliError(`${file}: ${audio ? "음악·효과음은 소리 파일" : "그림 종류는 PNG"} 이어야 합니다.`, 2);
    if (!audio && mime !== "image/png") throw new CliError(`${file}: 그림은 PNG 만 받습니다.`, 2);
    const sha = sha256(bytes);
    if (blobs.has(sha)) continue;
    blobs.set(sha, bytes);
    refs.push({ sha256: sha, mime, bytes: bytes.byteLength });
    const id = `a_${sha.slice(0, 12)}`;
    const name = basename(file).replace(/\.[a-z0-9]+$/i, "").slice(0, 120) || title;
    const meta: Record<string, number> = {};
    if (!audio) {
      const size = pngSize(bytes)!;
      Object.assign(meta, { width: size.width, height: size.height });
      if (assetKind === "chipset") {
        Object.assign(meta, { tileSize: STORE_TILE_SIZE, frameWidth: STORE_TILE_SIZE, frameHeight: STORE_TILE_SIZE, frames: (size.width / STORE_TILE_SIZE) * (size.height / STORE_TILE_SIZE) });
        const tileset = basicTilesetFor(id, name.slice(0, 80), size.width, size.height, STORE_TILE_SIZE);
        tilesets[tileset.id] = tileset;
      }
    }
    assets[id] = { id, name, kind: assetKind, blob: sha, mime, meta, generation };
  }
  const manifest: StorePackManifest = {
    schema: STORE_PACK_SCHEMA,
    title,
    summary: opt("--summary") ?? "",
    description: opt("--description") ?? "",
    tags: (opt("--tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
    kind: (STORE_ITEM_KINDS as readonly string[]).includes(kind) ? kind : "pack",
    license,
    aiGenerated: generation.method !== "procedural",
    credits: opt("--credits") ?? (agentName ? `AI 생성: ${agentName}` : ""),
    content: { assets, tilesets },
    previews: audio ? [] : refs.filter((ref) => ref.mime.startsWith("image/")).slice(0, 8).map((ref) => ref.sha256),
    blobs: refs,
  };
  mkdirSync(join(dir, "blobs"), { recursive: true });
  for (const [sha, bytes] of blobs) writeFileSync(join(dir, "blobs", sha), bytes);
  writeFileSync(join(dir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return { manifest, blobs };
}

// ── 올리기 ───────────────────────────────────────────────────────────
async function uploadBlobs(pack: Pack): Promise<number> {
  const { missing } = await api<{ missing: string[] }>("/api/v1/blobs/check", { json: { sha256s: [...pack.blobs.keys()] } });
  for (const [index, sha] of missing.entries()) {
    await api("/api/v1/blobs", { body: pack.blobs.get(sha)!, headers: { "x-sha256": sha, "content-type": "application/octet-stream" } });
    console.error(`  파일 ${index + 1}/${missing.length}`);
  }
  return missing.length;
}

function requireClean(pack: Pack): void {
  const { problems, notes } = checkPack(pack);
  for (const note of notes) console.error(`  ${note}`);
  if (problems.length > 0) throw new CliError("올리기 전 검사 실패 — 아무것도 보내지 않았다.", 1, problems);
}

const reviewNote = "에이전트 제출은 항상 확인 대기(pending)다. 주인이 스토어 「내 에이전트 제출」(/me/agent)에서 고르고 승인해야 한다(3/4 관문 보정 전에는 운영자 확인도 한 번 더) — 에이전트가 공개·승인할 길은 없다.";

// ── 일회용 미리보기(스토어 /scratch) ─────────────────────────────────
/** 팩 폴더 안 .scratch.json: 미리보기 id(비밀 주소이므로 권한 600)와 만들 때의 manifest.json 해시. */
interface ScratchState { base: string; id: string; previewUrl: string; sceneUrl: string; expiresAt: string; manifestSha256: string }
const scratchFile = (dir: string): string => join(dir, ".scratch.json");
const manifestFileSha = (dir: string): string => sha256(new Uint8Array(readFileSync(join(dir, "manifest.json"))));

function readScratch(dir: string): ScratchState {
  const file = scratchFile(dir);
  if (!existsSync(file)) throw usage(`미리보기가 없습니다: ${dir} — 먼저 preview ${dir}`);
  const state = JSON.parse(readFileSync(file, "utf8")) as ScratchState;
  if (state.base !== base) throw usage(`이 미리보기는 다른 스토어(${state.base})에 있습니다. --base ${state.base}`);
  return state;
}

const commands: Record<string, () => Promise<object>> = {
  async whoami() {
    const me = await api<{ user: { email: string; displayName: string; role: string }; agent?: { label: string }; items: unknown[] }>("/api/v1/me");
    if (!me.agent) throw new CliError("이 토큰은 에이전트 토큰이 아닙니다. 주인이 /me/agent-tokens 에서 발급한 토큰을 쓰세요.", 2);
    return { ok: true, base, account: me.user.displayName, tokenLabel: me.agent.label, agent: agentName || null, tokenFile: tokenFile(), items: me.items.length };
  },
  async init() {
    const [dir] = positional;
    if (!dir) throw usage("init <폴더> 가 필요합니다.");
    const pack = init(resolve(dir));
    const { problems, notes } = checkPack(pack);
    if (problems.length > 0) throw new CliError(`팩 폴더(${resolve(dir)})는 만들었지만 검사를 통과하지 못했다 — 고친 뒤 check.`, 1, problems);
    return { ok: true, dir: resolve(dir), assets: Object.keys(pack.manifest.content.assets).length, blobs: pack.blobs.size, notes, next: `npm run -s store -- publish ${dir}` };
  },
  async check() {
    const [dir] = positional;
    if (!dir) throw usage("check <폴더> 가 필요합니다.");
    const pack = readPack(resolve(dir));
    const { problems, notes } = checkPack(pack);
    if (problems.length > 0) throw new CliError("검사 실패", 1, problems);
    return { ok: true, title: pack.manifest.title, assets: Object.keys(pack.manifest.content.assets).length, blobs: pack.blobs.size, notes };
  },
  async publish() {
    const [dir] = positional;
    if (!dir) throw usage("publish <폴더> 가 필요합니다.");
    const pack = readPack(resolve(dir));
    requireClean(pack);
    const uploaded = await uploadBlobs(pack);
    const created = await api<{ slug: string; status: string; version: number }>("/api/v1/items", { json: { manifest: pack.manifest } });
    return { ok: true, slug: created.slug, status: created.status, version: created.version, uploaded, url: `${base}/items/${created.slug}`, note: reviewNote };
  },
  async version() {
    const [slug, dir] = positional;
    if (!slug || !dir) throw usage("version <slug> <폴더> 가 필요합니다.");
    const pack = readPack(resolve(dir));
    requireClean(pack);
    const uploaded = await uploadBlobs(pack);
    const created = await api<{ status: string; version: number }>(`/api/v1/items/${encodeURIComponent(slug)}/versions`, { json: { manifest: pack.manifest } });
    return { ok: true, slug, status: created.status, version: created.version, uploaded, url: `${base}/items/${slug}`, note: reviewNote };
  },
  async preview() {
    const [dir] = positional;
    if (!dir) throw usage("preview <폴더> 가 필요합니다.");
    const path = resolve(dir);
    const pack = readPack(path);
    const { problems, notes } = checkPack(pack, { gate: false });
    for (const note of notes) console.error(`  ${note}`);
    if (problems.length > 0) throw new CliError("미리보기 전 검사 실패 — 아무것도 보내지 않았다.", 1, problems);
    const uploaded = await uploadBlobs(pack);
    const view = await api<{ id: string; previewUrl: string; sceneUrl: string; expiresAt: string; summary: { wouldHold: string[]; warnings: string[] } }>("/api/v1/scratches", { json: { manifest: pack.manifest } });
    const state: ScratchState = { base, id: view.id, previewUrl: view.previewUrl, sceneUrl: view.sceneUrl, expiresAt: view.expiresAt, manifestSha256: manifestFileSha(path) };
    writeFileSync(scratchFile(path), JSON.stringify(state, null, 2), { mode: 0o600 });
    let scene: string | null = null;
    const out = opt("--scene");
    if (out) {
      const response = await fetch(`${base}/api/v1/scratches/${view.id}/scene.png?scale=2`, { headers: { authorization: `Bearer ${readToken()}` } });
      if (!response.ok) throw new CliError(`장면 그림을 받지 못했다: ${response.status}`);
      writeFileSync(resolve(out), new Uint8Array(await response.arrayBuffer()));
      scene = resolve(out);
    }
    return {
      ok: true, previewUrl: view.previewUrl, sceneUrl: view.sceneUrl, scene, expiresAt: view.expiresAt, uploaded, wouldHold: view.summary.wouldHold, warnings: view.summary.warnings,
      note: "나만 보는 미리보기다(제출 아님). 주소는 주인이 브라우저에서 로그인해 같이 볼 수 있다. 정하면 submit 또는 discard.",
    };
  },
  async submit() {
    const [dir] = positional;
    if (!dir) throw usage("submit <폴더> [--slug <내 상품>] 가 필요합니다.");
    const path = resolve(dir);
    const state = readScratch(path);
    if (manifestFileSha(path) !== state.manifestSha256) throw usage("미리보기 뒤에 manifest.json 이 바뀌었다 — 바뀐 것을 다시 preview 해서 보고 내라.");
    requireClean(readPack(path));
    const slug = opt("--slug");
    const created = await api<{ slug: string; status: string; version: number }>(`/api/v1/scratches/${state.id}/submit`, { json: slug ? { slug } : {} });
    rmSync(scratchFile(path), { force: true });
    return { ok: true, slug: created.slug, status: created.status, version: created.version, url: `${base}/items/${created.slug}`, review: `${base}/me/agent`, note: reviewNote };
  },
  async discard() {
    const [dir] = positional;
    if (!dir) throw usage("discard <폴더> 가 필요합니다.");
    const path = resolve(dir);
    const state = readScratch(path);
    await api(`/api/v1/scratches/${state.id}/discard`, { json: {} });
    rmSync(scratchFile(path), { force: true });
    return { ok: true, discarded: true };
  },
  async mine() {
    const me = await api<{ items: { slug: string; title: string; status: string; kind: string; latestVersion: number; submittedVia: string | null }[] }>("/api/v1/me");
    for (const item of me.items) console.error(`${item.status.padEnd(8)} ${item.kind.padEnd(10)} v${item.latestVersion} ${item.slug}  ${item.title}${item.submittedVia ? `  [${item.submittedVia}]` : ""}`);
    return { ok: true, items: me.items.map(({ slug, status, submittedVia }) => ({ slug, status, submittedVia })) };
  },
};

const command = positional.shift();
const run = command ? commands[command] : undefined;
try {
  if (parseError) throw usage(parseError);
  if (!run) throw usage(command ? `모르는 명령: ${command}` : "명령이 필요합니다.");
  if (options.has("--slug") && command !== "submit") throw usage("--slug 는 submit 에만 쓴다.");
  if (options.has("--scene") && command !== "preview") throw usage("--scene 는 preview 에만 쓴다.");
  if (options.has("--draft") && command !== "publish") throw usage("--draft 는 publish 에만 쓴다(제출은 어차피 항상 확인 대기다).");
  console.log(JSON.stringify(await run()));
} catch (error) {
  const failure = error instanceof CliError ? error : new CliError(error instanceof Error ? error.message : String(error));
  console.error(failure.message);
  for (const detail of failure.details) console.error(`  - ${detail}`);
  console.log(JSON.stringify({ ok: false, error: failure.message, details: failure.details }));
  process.exit(failure.code);
}
