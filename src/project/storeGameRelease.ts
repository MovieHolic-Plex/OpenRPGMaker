/**
 * 스토어 「바로 플레이」 게임 판본 만들기 — 편집기 발행 대화상자와 scripts/store/publish-game.mts 가 같이 쓴다.
 *
 * - 파일: 웹 내보내기 ZIP 과 똑같은 목록(project.json + 공식 플레이어 + 쓰는 그림·소리)을 경로 → 바이트로 만든다.
 *   스토어 서버가 판본 폴더 `<slug>/<판본>/` 에 그대로 놓고, 진입 문서 index.html(부팅 설정·CSP)만 서버가 쓴다.
 * - 바뀐 점: 지금 판본의 project.json 과 견줘 맵·이벤트·캐릭터를 더함/바꿈/뺌으로 센다. 글은 작가가 고칠 수 있다.
 * - 판본 번호는 서버가 정한다(1.0 → 1.1, 큰 갱신이면 2.0). 여기서는 미리 보여 줄 값만 계산한다.
 * 서버 계약: OpenRPGMaker-store src/games.ts.
 */
import type { Project } from "@/project/types";
import { prepareWebExport } from "@/project/webExport";
import { loadVerifiedPlayerDeployment } from "@/project/playerDeploymentLoader";
import { exactWebExportEntries } from "@/project/webExportZip";
import type { FetchBytes } from "@/project/playerDeploymentTypes";

export interface StoreGameChangeSet { readonly added: readonly string[]; readonly changed: readonly string[]; readonly removed: readonly string[] }
export type StoreGameChanges = Readonly<Record<"maps" | "events" | "characters", StoreGameChangeSet>>;

const stable = (value: unknown): string => JSON.stringify(value);

function diffById<T>(before: ReadonlyMap<string, T>, after: ReadonlyMap<string, T>, name: (item: T, id: string) => string): StoreGameChangeSet {
  const added: string[] = [];
  const changed: string[] = [];
  const removed: string[] = [];
  for (const [id, item] of after) {
    const old = before.get(id);
    if (old === undefined) added.push(name(item, id));
    else if (stable(old) !== stable(item)) changed.push(name(item, id));
  }
  for (const [id, item] of before) if (!after.has(id)) removed.push(name(item, id));
  return { added, changed, removed };
}

type MapLike = { readonly name?: string; readonly events?: readonly { readonly id: string; readonly name?: string }[] };
type ProjectLike = { readonly maps?: Readonly<Record<string, MapLike>>; readonly database?: { readonly actors?: readonly { readonly id: string | number; readonly name?: string }[] } };

/**
 * 두 프로젝트(지금 판본 → 새 판본)의 차이. before 가 없으면 첫 판본이라 모두 「더함」이 아니라 빈 차이를 돌려준다.
 * 맵의 「바뀜」은 이벤트를 뺀 맵 자체(타일·크기·설정)가 바뀐 것이다 — 이벤트는 따로 센다.
 */
export function projectChangeSummary(before: ProjectLike | null, after: ProjectLike): StoreGameChanges {
  const empty = { added: [], changed: [], removed: [] };
  if (!before) return { maps: empty, events: empty, characters: empty };
  const mapsOf = (project: ProjectLike) => new Map(Object.entries(project.maps ?? {}).map(([id, map]) => {
    const { events: _events, ...rest } = map;
    return [id, rest as MapLike];
  }));
  const mapName = (project: ProjectLike, id: string) => project.maps?.[id]?.name || id;
  const eventsOf = (project: ProjectLike) => {
    const out = new Map<string, { readonly mapId: string; readonly name?: string; readonly id: string }>();
    for (const [mapId, map] of Object.entries(project.maps ?? {})) for (const event of map.events ?? []) out.set(`${mapId}/${event.id}`, { ...event, mapId });
    return out;
  };
  const actorsOf = (project: ProjectLike) => new Map((project.database?.actors ?? []).map((actor) => [String(actor.id), actor]));
  return {
    maps: diffById(mapsOf(before), mapsOf(after), (_map, id) => mapName(after.maps?.[id] ? after : before, id)),
    events: diffById(eventsOf(before), eventsOf(after), (event) => `${mapName(after.maps?.[event.mapId] ? after : before, event.mapId)} · ${event.name || event.id}`),
    characters: diffById(actorsOf(before), actorsOf(after), (actor, id) => actor.name || id),
  };
}

const KIND_LABEL: Record<keyof StoreGameChanges, string> = { maps: "맵", events: "이벤트", characters: "캐릭터" };

/** 「무엇이 바뀌었나」 초안 — 작가가 고칠 수 있다. 바뀐 것이 없으면 그렇게 쓴다. */
export function changelogFromChanges(changes: StoreGameChanges, baselineVersion: string | null): string {
  if (!baselineVersion) return "첫 판본입니다.";
  const lines: string[] = [];
  const names = (list: readonly string[]) => `${list.slice(0, 5).join(", ")}${list.length > 5 ? ` 외 ${list.length - 5}` : ""}`;
  for (const kind of ["maps", "events", "characters"] as const) {
    const set = changes[kind];
    const parts = [
      set.added.length ? `더함 ${set.added.length}(${names(set.added)})` : "",
      set.changed.length ? `바꿈 ${set.changed.length}(${names(set.changed)})` : "",
      set.removed.length ? `뺌 ${set.removed.length}(${names(set.removed)})` : "",
    ].filter(Boolean);
    if (parts.length) lines.push(`${KIND_LABEL[kind]}: ${parts.join(" · ")}`);
  }
  return lines.length ? `v${baselineVersion} 에서 바뀐 점\n${lines.join("\n")}` : `v${baselineVersion} 과 맵·이벤트·캐릭터는 같습니다(그림·소리·설정만 바뀜).`;
}

/** 서버가 보여 줄 다음 판본 번호를 미리 계산한다(1.0 → 1.1, 큰 갱신 → 2.0). 서버가 최종으로 정한다. */
export function previewNextVersion(latest: string | null, bump: "minor" | "major"): string {
  const match = latest ? /^(\d+)\.(\d+)$/.exec(latest) : null;
  if (!match) return "1.0";
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return bump === "major" ? `${major + 1}.0` : `${major}.${minor + 1}`;
}

/** 판본 파일: 경로 → 바이트. 웹 내보내기 ZIP 과 같은 목록이다(index.html 은 서버가 쓰므로 없다). */
export interface StoreGameFiles {
  readonly files: ReadonlyMap<string, Uint8Array>;
  readonly entry: string;
  readonly projectJson: string;
  readonly mapCount: number;
}

/**
 * 판본에 싣기 전에 큰 소리 파일을 줄이는 변환(선택). 경로·바이트를 받아 새 경로·바이트를 돌려준다(못 줄이면 null).
 * 노드 게시 도구(scripts/store/publish-game.mts)는 ffmpeg 로 WAV 를 MP3 로 바꾼다. 편집기 안 게시는 아직 원본 그대로 싣는다.
 */
export type StoreAudioTranscoder = (path: string, bytes: Uint8Array) => Promise<{ readonly path: string; readonly bytes: Uint8Array } | null>;
/** 이보다 큰 WAV 만 바꾼다(효과음은 작고 바로 디코딩되어야 한다). */
const TRANSCODE_MIN_BYTES = 2 * 1024 * 1024;

export async function buildStoreGameFiles(project: Project, options: { readonly fetchBytes: FetchBytes; readonly bundleBase: string; readonly transcodeAudio?: StoreAudioTranscoder }): Promise<StoreGameFiles> {
  const prepared = prepareWebExport(project);
  const deployment = await loadVerifiedPlayerDeployment({ bundleBase: options.bundleBase, adapters: { fetchBytes: options.fetchBytes } });
  const entries = await exactWebExportEntries(prepared, deployment, options.fetchBytes);
  const files = new Map<string, Uint8Array>();
  const cssAssets = new Set<string>();
  for (const entry of entries) {
    if (entry.name.toLowerCase() === "index.html") continue;
    if (entry.name.endsWith(".css")) {
      for (const match of new TextDecoder().decode(entry.bytes).matchAll(/url\(\s*["']?\/(assets\/[^"')?#\s]+)/g)) cssAssets.add(match[1]!);
      files.set(entry.name, relativeCssAssetUrls(entry.name, entry.bytes));
    } else files.set(entry.name, entry.bytes);
  }
  // CSS 가 가리키는 공용 그림·글꼴(배틀 배경·메뉴 아이콘·도트 글꼴)도 판본 폴더에 함께 싣는다.
  for (const path of cssAssets) if (!files.has(path)) files.set(path, await options.fetchBytes(`/${path}`));
  if (options.transcodeAudio) await transcodeLargeAudio(files, options.transcodeAudio);
  files.set(PRELOAD_FILES_NAME, new TextEncoder().encode(JSON.stringify(preloadFileList(files))));
  const entry = files.has("player.html") ? "player.html" : [...files.keys()].find((name) => name.endsWith(".html") && !name.includes("/"));
  if (!entry) throw new Error("플레이어 진입 문서(player.html)가 내보내기 목록에 없습니다.");
  return { files, entry, projectJson: prepared.projectJson, mapCount: prepared.summary.mapCount };
}

/**
 * 플레이어 CSS 의 공용 그림·글꼴 주소는 `/assets/…`(사이트 뿌리) 꼴이다. 스토어 판본은 `<slug>/<판본>/` 아래에 놓이므로
 * 같은 판본 폴더의 assets/ 를 가리키게 상대 주소로 바꾼다(그 파일들은 내보내기 목록에 함께 실린다).
 */
export function relativeCssAssetUrls(path: string, bytes: Uint8Array): Uint8Array {
  const depth = path.split("/").length - 1;
  const up = depth === 0 ? "./" : "../".repeat(depth);
  const text = new TextDecoder().decode(bytes);
  const out = text.replace(/url\(\s*(["']?)\/assets\//g, (_match, quote: string) => `url(${quote}${up}assets/`);
  return out === text ? bytes : new TextEncoder().encode(out);
}

/** 표지·장면 그림을 판본 파일에 더할 때 쓰는 경로(게임 그림과 섞이지 않게 store/ 아래). */
export const storeArtPath = (name: string): string => `store/${name.replace(/[^\w.-]+/g, "-")}`;

/**
 * 판본의 모든 게임 파일 목록 — 플레이어가 시작한 뒤 뒤에서 «전부» 받을 때 쓴다(scenePreload.ts).
 * 프로젝트 글자로는 안 보이는 파일(코드가 고르는 전투 그림·스킬 효과 시트·코드 조각)까지 들어 있다.
 * 진입 문서·데이터(html·project.json·loading.json)는 이미 받았으므로 뺀다.
 */
export const PRELOAD_FILES_NAME = "preload-files.json";
function preloadFileList(files: ReadonlyMap<string, Uint8Array>): string[] {
  return [...files.keys()]
    .filter((path) => !/\.(html?|md)$/i.test(path) && path !== "project.json" && path !== "loading.json" && path !== PRELOAD_FILES_NAME)
    .sort();
}

/** 큰 WAV 를 줄인 파일로 바꾸고, 플레이어가 원래 주소 대신 그 파일을 부르도록 loading.json 의 aliases 에 적는다. */
async function transcodeLargeAudio(files: Map<string, Uint8Array>, transcode: StoreAudioTranscoder): Promise<void> {
  const aliases: Record<string, string> = {};
  for (const [path, bytes] of [...files]) {
    if (!/^assets\/.+\.wav$/i.test(path) || bytes.byteLength < TRANSCODE_MIN_BYTES) continue;
    const out = await transcode(path, bytes);
    if (!out || files.has(out.path) || out.bytes.byteLength >= bytes.byteLength) continue;
    files.delete(path);
    files.set(out.path, out.bytes);
    aliases[path] = out.path;
  }
  if (Object.keys(aliases).length === 0) return;
  const loading = files.get("loading.json");
  const info = loading ? JSON.parse(new TextDecoder().decode(loading)) as Record<string, unknown> : {};
  files.set("loading.json", new TextEncoder().encode(JSON.stringify({ ...info, aliases })));
}
