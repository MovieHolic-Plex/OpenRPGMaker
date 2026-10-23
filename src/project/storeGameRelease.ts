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

export async function buildStoreGameFiles(project: Project, options: { readonly fetchBytes: FetchBytes; readonly bundleBase: string }): Promise<StoreGameFiles> {
  const prepared = prepareWebExport(project);
  const deployment = await loadVerifiedPlayerDeployment({ bundleBase: options.bundleBase, adapters: { fetchBytes: options.fetchBytes } });
  const entries = await exactWebExportEntries(prepared, deployment, options.fetchBytes);
  const files = new Map<string, Uint8Array>();
  for (const entry of entries) {
    if (entry.name.toLowerCase() === "index.html") continue;
    files.set(entry.name, entry.bytes);
  }
  const entry = files.has("player.html") ? "player.html" : [...files.keys()].find((name) => name.endsWith(".html") && !name.includes("/"));
  if (!entry) throw new Error("플레이어 진입 문서(player.html)가 내보내기 목록에 없습니다.");
  return { files, entry, projectJson: prepared.projectJson, mapCount: prepared.summary.mapCount };
}

/** 표지·장면 그림을 판본 파일에 더할 때 쓰는 경로(게임 그림과 섞이지 않게 store/ 아래). */
export const storeArtPath = (name: string): string => `store/${name.replace(/[^\w.-]+/g, "-")}`;
