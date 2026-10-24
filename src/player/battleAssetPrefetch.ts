import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { withInlineAsset } from "@/assets/inlineAssetStore";
import { retroPixelFxForResource, retroPixelFxResourceId, retroPixelAnimationId } from "@/assets/retroPixelAnimations";
import { bundledRetroPixelAnimation } from "@/project/defaults/retroPixelAnimationRecords";
import { collectCommands } from "@/project/mapInspection";
import type { BattleAnimationRecord, GameMap, Project, TroopRecord } from "@/project/types";
import { decodeImageUrl } from "@/player/battleReadiness";

/**
 * 맵에서 미리 데우기. 맵에 들어오면 그 맵에서 나올 수 있는 모든 적 그룹(랜덤 인카운트 표·troopIds·이벤트 전투)의
 * 그림을 한가한 때 조용히 받아 디코딩 캐시(battleReadiness.decodeImageUrl)에 올린다. 전투 첫 화면 관문은 같은 캐시를
 * 쓰므로 이미 받은 그림은 바로 풀린다. 같은 맵·같은 그림은 한 번만, 동시에 몇 장만 받는다.
 */
const PREFETCH_CONCURRENCY = 2;
const warmedMaps = new Set<string>();
const queued = new Set<string>();
const queue: string[] = [];
let running = 0;

function absolute(url: string): string {
  try {
    return new URL(url, document.baseURI).href;
  } catch {
    return url;
  }
}

function pump(): void {
  while (running < PREFETCH_CONCURRENCY && queue.length > 0) {
    const url = queue.shift()!;
    running += 1;
    void decodeImageUrl(url).finally(() => {
      running -= 1;
      pump();
    });
  }
}

function enqueue(urls: Iterable<string>): void {
  for (const raw of urls) {
    const url = absolute(raw);
    if (queued.has(url)) continue;
    queued.add(url);
    queue.push(url);
  }
  schedule();
}

function schedule(): void {
  const idle = (globalThis as { requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(pump, { timeout: 1500 });
  else setTimeout(pump, 200);
}

/** 맵에서 나올 수 있는 적 그룹 id 전부. 변수로 고르는 전투는 정해진 id 가 없어 건너뛴다. */
export function troopIdsReachableOnMap(map: GameMap): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const id of map.troopIds ?? []) ids.add(id);
  for (const entry of map.encounterTable ?? []) ids.add(entry.troopId);
  for (const command of collectCommands(map.events ?? [])) {
    if ((command.kind === "battleProcessing" && command.troopSource !== "variable") || command.kind === "tacticsBattle") ids.add(command.troopId);
  }
  return ids;
}

function trainerSpriteUrl(project: Project, id: string | undefined, file: string): string | undefined {
  if (!id) return undefined;
  if (project.assets.uploaded[id]) return resolveAssetResourceUrl(id, { project }) ?? undefined;
  return /^[a-z][a-z0-9_]*$/u.test(id) ? withInlineAsset(`/assets/battle-trainers/${id}/${file}.png`) : undefined;
}

function troopImageUrls(project: Project, troop: TroopRecord): Set<string> {
  const urls = new Set<string>();
  const add = (resourceId: string | undefined): void => {
    if (!resourceId) return;
    const url = resolveAssetResourceUrl(resourceId, { project });
    if (url) urls.add(url);
  };
  const records = project.database.battleAnimations;
  const findRecord = (id: string): BattleAnimationRecord | undefined => records.find((entry) => entry.id === id) ?? bundledRetroPixelAnimation(id);
  const addAnimation = (animationId: string | undefined): void => {
    const record = animationId ? findRecord(animationId) : undefined;
    if (!record) return;
    add(record.resourceId);
    const key = retroPixelFxForResource(record.resourceId);
    if (key) add(findRecord(retroPixelAnimationId(key))?.resourceId ?? retroPixelFxResourceId(key));
  };
  const enemyIds = troop.members?.length ? troop.members.map((member) => member.enemyId) : troop.enemyIds;
  for (const enemyId of new Set(enemyIds)) {
    const enemy = project.database.enemies.find((entry) => entry.id === enemyId);
    if (!enemy) continue;
    add(enemy.monsterResourceId);
    add(enemy.speciesId ? project.database.monsterSpecies?.find((species) => species.id === enemy.speciesId)?.graphic?.monsterResourceId : undefined);
    for (const skillId of enemy.skillIds) addAnimation(project.database.skills.find((entry) => entry.id === skillId)?.animationId);
  }
  add(troop.previewBackgroundResourceId);
  for (const [id, file] of [[troop.trainerSprite?.front, "front"], [troop.trainerSprite?.back, "back"]] as const) {
    const url = trainerSpriteUrl(project, id, file);
    if (url) urls.add(url);
  }
  return urls;
}

/** 맵에 들어올 때 부른다. 이미 데운 맵이면 아무것도 안 한다. 실패·미지원 환경은 조용히 넘어간다. */
export function prefetchBattleAssetsForMap(project: Project, map: GameMap): void {
  if (typeof document === "undefined" || warmedMaps.has(map.id)) return;
  warmedMaps.add(map.id);
  try {
    const troopIds = troopIdsReachableOnMap(map);
    if (troopIds.size === 0) return;
    const urls = new Set<string>();
    const mapBackdrop = map.battleBackground ? resolveAssetResourceUrl(map.battleBackground, { project }) : null;
    if (mapBackdrop) urls.add(mapBackdrop);
    for (const troopId of troopIds) {
      const troop = project.database.troops.find((entry) => entry.id === troopId);
      if (troop) for (const url of troopImageUrls(project, troop)) urls.add(url);
    }
    enqueue(urls);
  } catch (error) {
    console.warn("[battle-prefetch] skipped", error);
  }
}
