/**
 * 대표 데모게임을 스토어 「바로 플레이」에 올린다(판본은 서버가 자동으로 매긴다 — 1.0 → 1.1, --major 면 2.0).
 * 주소·토큰은 환경 변수로만 받는다(storePublish.mts). 플레이어는 먼저 `npm run build:player` 로 dist/export-player 에 만든다.
 *
 *   npm run -s store:publish-game -- --demo chrono-bell --dry
 *   npm run -s store:publish-game -- --demo chrono-bell --target staging [--major] [--changelog "…" | --changelog-file notes.txt] [--version 1.4]
 * 바뀐 점은 여러 줄 글이다: 첫 줄 = 한 줄 제목, `+ ` 새 기능 · `~ ` 개선 · `! ` 버그 수정(openwiki/asset-store.md 「바뀐 점 쓰는 법」).
 * --changelog 안의 글자 `\n` 은 줄바꿈으로 읽는다.
 *   STORE_LINK_TOKEN=… npm run -s store:publish-game -- --demo chrono-bell --target production --confirm <contentHash>
 *   npm run -s store:publish-game -- --rollback fallen-star@1.0 --target staging
 * 제작자 목소리(스토어 「소식」 탭·판본 카드): 올릴 때 [--comment "…"] [--post-title "…" (--post-body "…" | --post-file post.md) [--post-pin]].
 * 판본 없이 소식만: --news <slug> --post-title "…" --post-file post.md [--post-version 1.17] [--post-pin] [--comment "…" --comment-version 1.17].
 * 마지막 줄은 한 줄 JSON 결과다. 그림·BGM 이 이 체크아웃 public/ 에 없으면 OPRN_ASSET_ROOTS(콜론 구분)의 public 폴더에서 찾는다.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import type { FlagshipDemoId } from "@/project/flagship";
import { publishStoreGame, type StoreGameMeta, type StoreGameMine, type StoreGameTransport } from "@/assetStore/gamePublish";
import { PublishError, closeSession, openSession, requireTargetBase, type Session } from "./storePublish.mts";

const root = resolve(import.meta.dirname, "..", "..");
const arg = (name: string): string | undefined => { const index = process.argv.indexOf(name); return index > 0 ? process.argv[index + 1] : undefined; };
function out(value: object, code = 0): never {
  console.log(JSON.stringify(value));
  process.exit(code);
}

/** 데모 → 스토어 주소·글. 소개 글은 첫 화면 「기본 게임」 선반(builtinGames.ts)과 같다. */
const DEMOS: Record<string, { readonly slug: string; readonly builtin: string; readonly description: string; readonly pointer?: boolean }> = {
  "chrono-bell": {
    slug: "fallen-star", builtin: "chrono-bell",
    description: "OPRN 에디터의 대표 데모 JRPG 입니다. 북쪽 숲에 떨어진 별, 그 속에서 깨어난 기계 소녀, 그리고 별을 쫓는 심문관.\n제1막(약 20분)을 처음부터 끝까지 플레이할 수 있습니다. 전투·대화·컷신·세이브가 모두 들어 있습니다.",
  },
  "emerald-crown": {
    slug: "astra-horizon", builtin: "emerald-crown", pointer: true,
    description: "OPRN 에디터로 만든 몬스터 수집 RPG 데모입니다. 다우닝 시티 연구소에서 첫 파트너를 고르고, 풀숲에서 몬스터를 잡고, 체육관을 돌아 아스트라 성소까지 갑니다(약 30분).",
  },
  "first-love": {
    slug: "first-love", builtin: "first-love",
    description: "OPRN 에디터로 만든 오피스 로맨스 데모입니다. 첫 출근 날 사수로 배정된 사람은 10년 전 그 선배였습니다. 그런데 그는 「처음 뵙겠습니다」라고 합니다.\n선택에 따라 엔딩이 셋으로 갈립니다(약 20분).",
  },
};
const ALIASES: Record<string, FlagshipDemoId> = { "fallen-star": "chrono-bell", "astra-horizon": "emerald-crown" };

const CREDITS = [
  "만든 곳: OPRN 팀 (OPRN 에디터 공식 데모)",
  "그림·소리: OPRN 기본 에셋과 공개 라이선스 에셋 — 저작자 표기는 게임 안 assets/ATTRIBUTION.md 와 타이틀 화면 「라이선스」에 있습니다.",
  "게임 런타임: OPRN Player (MIT)",
].join("\n");

const CONTROLS = (pointer: boolean) => [
  { keys: "← ↑ → ↓ · W A S D", action: "이동" },
  { keys: "Enter · Space · Z", action: "확인 · 말 걸기 · 조사" },
  { keys: "Esc · X", action: "취소 · 메뉴" },
  { keys: "Shift", action: "누르고 있으면 달리기" },
  ...(pointer ? [{ keys: "마우스 클릭", action: "메뉴·전투 명령 고르기 (오른쪽 클릭 = 취소)" }] : []),
  { keys: "휴대폰: 맵 탭", action: "그곳까지 걷기 · 사람을 탭하면 다가가 말 걸기" },
  { keys: "휴대폰: 왼쪽 패드 · A · B", action: "이동 · 확인 · 취소 (「달리기」 단추로 걷기/달리기)" },
];

/** dist/export-player 는 이 체크아웃에서, 공용 그림·소리는 public/(없으면 OPRN_ASSET_ROOTS). */
const assetRoots = [join(root, "public"), ...(process.env.OPRN_ASSET_ROOTS ?? "").split(":").filter(Boolean).map((dir) => resolve(dir)), join(root, "dist")];
async function fetchBytes(path: string): Promise<Uint8Array> {
  if (/^https?:\/\//.test(path)) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`${path} ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }
  const clean = decodeURIComponent(path.split("?")[0]!).replace(/^\/+/, "");
  if (clean.split("/").includes("..")) throw new Error(`bad path ${path}`);
  const candidates = clean.startsWith("export-player/") ? [join(root, "dist", clean)] : assetRoots.map((dir) => join(dir, clean));
  const found = candidates.find((file) => existsSync(file));
  if (!found) { console.error(`[publish-game] 없는 파일: /${clean}`); throw new Error(`없는 파일: /${clean}`); }
  return new Uint8Array(readFileSync(found));
}

function sessionTransport(session: Session): StoreGameTransport {
  return {
    async json(method, path, body) {
      const response = await fetch(`${session.base}${path}`, {
        method, headers: { ...session.headers, ...(body === undefined ? {} : { "content-type": "application/json" }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const text = await response.text();
      if (!response.ok) throw new PublishError(`${method} ${path} ${response.status}: ${text.slice(0, 400)}`);
      return text ? JSON.parse(text) : {};
    },
    async upload(path, bytes, headers) {
      for (let attempt = 1; ; attempt += 1) {
        const response = await fetch(`${session.base}${path}`, { method: "POST", headers: { ...session.headers, ...headers }, body: new Uint8Array(bytes) as unknown as BodyInit });
        if (response.ok) return;
        if (attempt >= 3 || response.status < 500) throw new PublishError(`파일 올리기 ${response.status}: ${(await response.text()).slice(0, 300)}`);
      }
    },
  };
}

const target = arg("--target");
const rollback = arg("--rollback");
if (rollback) {
  const [slug, version] = rollback.split("@");
  if (!slug || !version) out({ ok: false, error: "--rollback <slug>@<판본>" }, 2);
  if (target !== "staging" && target !== "production") out({ ok: false, error: "--target staging|production" }, 2);
  const session = await openSession(target, requireTargetBase(target));
  try {
    const result = await sessionTransport(session).json("POST", `/api/v1/games/${encodeURIComponent(slug)}/current`, { version });
    out({ ok: true, target, action: "rollback", slug, ...(result as object) });
  } finally { await closeSession(session); }
}

/** --post-title·--post-body/--post-file·--post-pin → 소식 글(없으면 null). 본문 안의 글자 `\n` 은 줄바꿈. */
function postFromArgs(): { title: string; body: string; pinned: boolean } | null {
  const title = arg("--post-title")?.trim();
  if (!title) return null;
  const file = arg("--post-file");
  const body = file ? readFileSync(resolve(file), "utf8") : (arg("--post-body") ?? "").replace(/\\n/g, "\n");
  return { title, body, pinned: process.argv.includes("--post-pin") };
}
const commentArg = arg("--comment")?.replace(/\\n/g, "\n").trim() ?? "";

const news = arg("--news");
if (news) {
  const post = postFromArgs();
  if (!post && !commentArg) out({ ok: false, error: "--news <slug> 에는 --post-title(+ --post-body|--post-file) 이나 --comment 가 필요합니다" }, 2);
  if (target !== "staging" && target !== "production") out({ ok: false, error: "--target staging|production" }, 2);
  const session = await openSession(target, requireTargetBase(target));
  try {
    const transport = sessionTransport(session);
    const slug = encodeURIComponent(news);
    const version = arg("--post-version") ?? null;
    const made = post ? await transport.json("POST", `/api/v1/games/${slug}/posts`, { ...post, version }) : null;
    const label = arg("--comment-version") ?? version ?? (await transport.json("GET", `/api/v1/games/${slug}`) as { currentVersion?: string }).currentVersion;
    const comment = commentArg && label ? await transport.json("PUT", `/api/v1/games/${slug}/versions/${encodeURIComponent(label)}/comment`, { comment: commentArg }) : null;
    out({ ok: true, target, action: "news", slug: news, post: made, comment });
  } finally { await closeSession(session); }
}

// 무거운 모듈(데모 빌더·내보내기)은 되돌리기에는 필요 없다 — 여기서부터 읽는다.
const { FLAGSHIP_DEMO_IDS, createFlagshipDemoProject } = await import("@/project/flagship");
const { deserialize } = await import("@/project/io");
const { buildStoreGameFiles, changelogFromChanges, projectChangeSummary, storeArtPath } = await import("@/project/storeGameRelease");
const { BUILTIN_GAMES } = await import("@/start/home/builtinGames");
const { setInstalledBgmFiles } = await import("@/assets/installedBgm");

const demoArg = arg("--demo") ?? "";
const demoId = (ALIASES[demoArg] ?? demoArg) as FlagshipDemoId;
const demo = DEMOS[demoId];
if (!demo || !(FLAGSHIP_DEMO_IDS as readonly string[]).includes(demoId)) out({ ok: false, error: `--demo 은 ${Object.keys(DEMOS).join("|")}` }, 2);
const builtin = BUILTIN_GAMES.find((game) => game.id === demo.builtin)!;

// 데모 빌더는 맵 BGM 이 «설치됨»인지 본다. 이 체크아웃(또는 OPRN_ASSET_ROOTS)에 실제로 있는 곡 파일을 설치 목록으로 쓴다 —
// 없는 곡은 여전히 거절되고, 있는 곡은 판본 파일에 함께 실린다.
const catalogBgm = assetRoots.flatMap((dir) => {
  const folder = join(dir, "assets", "cc0", "audio", "catalog");
  return existsSync(folder) ? readdirSync(folder) : [];
});
setInstalledBgmFiles([...new Set(catalogBgm)]);

const started = performance.now();
const baked = join(root, "dist", "demos", `${demoId}.play.json`);
// 빌드가 구워 둔 데모(bake-flagship-demos)가 있으면 그것을, 없으면 데모 빌더로 짓는다.
const project = existsSync(baked) && !process.argv.includes("--rebuild") ? deserialize(readFileSync(baked, "utf8")) : createFlagshipDemoProject(demoId).project;
// 큰 WAV(루프 마스터 40MB 대)는 MP3 192kbps 로 바꿔 싣는다 — 같은 입력이면 같은 바이트(bitexact), 결과는 해시로 캐시.
const transcodeCache = join(homedir(), ".cache", "oprn-store-transcode");
const transcodeAudio = async (path: string, input: Uint8Array): Promise<{ path: string; bytes: Uint8Array } | null> => {
  const sha = createHash("sha256").update(input).digest("hex");
  const cached = join(transcodeCache, `${sha}.mp3`);
  if (!existsSync(cached)) {
    mkdirSync(transcodeCache, { recursive: true });
    const source = join(transcodeCache, `${sha}.src.wav`);
    writeFileSync(source, input);
    const tmp = `${cached}.part.mp3`;
    try {
      execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", source, "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact", "-codec:a", "libmp3lame", "-b:a", "192k", tmp]);
      renameSync(tmp, cached);
    } catch (error) {
      console.error(`[publish-game] ${path} 를 MP3 로 바꾸지 못해 원본을 싣습니다:`, error instanceof Error ? error.message : error);
      return null;
    } finally {
      try { (await import("node:fs")).rmSync(source, { force: true }); } catch { /* 임시 파일 */ }
    }
  }
  return { path: path.replace(/\.wav$/i, ".web.mp3"), bytes: new Uint8Array(readFileSync(cached)) };
};
const built = await buildStoreGameFiles(project, { fetchBytes, bundleBase: "/export-player/", transcodeAudio });
const files = new Map(built.files);
const art: string[] = [];
for (const frame of builtin.frames) {
  const name = storeArtPath(frame.split("/").pop()!);
  files.set(name, await fetchBytes(frame));
  art.push(name);
}
const cover = storeArtPath(builtin.cover.split("/").pop()!);
const bytes = [...files.values()].reduce((sum, file) => sum + file.byteLength, 0);
const sortedHashes = [...files.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([path, file]) => [path, createHash("sha256").update(file).digest("hex")]);
const contentHash = createHash("sha256").update(JSON.stringify(sortedHashes)).digest("hex");
const summary = {
  demo: demoId, slug: demo.slug, maps: built.mapCount, files: files.size, megabytes: +(bytes / 1048576).toFixed(1),
  projectMegabytes: +(built.projectJson.length / 1048576).toFixed(1), buildSeconds: +((performance.now() - started) / 1000).toFixed(1), contentHash,
};
if (process.argv.includes("--dry")) out({ ok: true, dry: true, ...summary });
if (target !== "staging" && target !== "production") out({ ...summary, ok: false, error: "--target staging|production 이 필요합니다(또는 --dry)." }, 2);

const meta: StoreGameMeta = {
  title: builtin.title, summary: builtin.description, description: demo.description, credits: CREDITS, genre: builtin.genre, controls: CONTROLS(demo.pointer === true),
};
try {
  const base = requireTargetBase(target);
  if (target === "production" && arg("--confirm") !== contentHash) throw new PublishError("운영에 올리려면 --dry 가 보여 준 contentHash 를 --confirm 으로 주세요.", 2);
  const session = await openSession(target, base);
  try {
    const transport = sessionTransport(session);
    const projectKey = `demo:${demoId}`;
    const mine = await transport.json("GET", `/api/v1/games/mine?projectKey=${encodeURIComponent(projectKey)}`) as StoreGameMine;
    // 바뀐 점: 지금 판본 project.json 과 견준다(공개 파일 주소).
    let previous: unknown = null;
    if (mine.baseline) {
      const response = await fetch(mine.baseline.projectUrl);
      if (response.ok) previous = await response.json();
    }
    const changes = projectChangeSummary(previous as never, JSON.parse(built.projectJson));
    const changelogFile = arg("--changelog-file");
    const changelog = (changelogFile ? readFileSync(resolve(changelogFile), "utf8").trim() : arg("--changelog")?.replace(/\\n/g, "\n")) ?? changelogFromChanges(changes, mine.baseline?.version ?? null);
    let lastLine = 0;
    const result = await publishStoreGame(transport, {
      projectKey, slug: demo.slug, meta, files, entry: built.entry, cover, art, changelog, changes,
      bump: process.argv.includes("--major") ? "major" : "minor", version: arg("--version") ?? null,
      ...(commentArg ? { comment: commentArg } : {}), post: postFromArgs(),
    }, (progress) => {
      if (progress.phase === "upload" && (progress.done === progress.total || Date.now() - lastLine > 5000)) {
        lastLine = Date.now();
        console.error(`[publish-game] upload ${progress.done}/${progress.total}`);
      }
    });
    out({ ...summary, ok: true, target, previous: mine.game?.currentVersion ?? null, changelog, ...result });
  } finally {
    await closeSession(session);
  }
} catch (error) { // no-excuse-ok: catch — CLI 경계, 마지막 줄 JSON 으로 돌려준다
  out({ ...summary, ok: false, target, error: error instanceof Error ? error.message : String(error) }, error instanceof PublishError ? error.exitCode : 1);
}
