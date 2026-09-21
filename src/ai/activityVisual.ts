import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { GameMap, Project, TilesetDef, UploadedAsset } from "@/project/types";

/** Execution-time, bounded visual evidence. No live project references or command bodies. */
export interface ActivityVisual {
  kind: "map" | "asset" | "record";
  title: string;
  caption: string;
  phase: "before" | "draft" | "read" | "failed";
  target: string;
  resourceId?: string;
  uploaded?: string;
  uploadedAsset?: UploadedAsset;
  pattern?: number;
  hue?: number;
  stats?: [string, string][];
  map?: GameMap;
  tileset?: TilesetDef;
  origin?: { x: number; y: number };
}
export interface ActivityVisualRef { id: string; title: string; phase: ActivityVisual["phase"]; target: string; kind: ActivityVisual["kind"] }
const obj = (v: unknown): Record<string, any> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, any> : {};
const str = (v: unknown): string => typeof v === "string" ? v.slice(0, 180) : "";
const collections: Record<string, string> = { actor: "actors", enemy: "enemies", item: "items", equipment: "equipment", skill: "skills" };
const statLabels: Record<string, string> = { price: "가격", hp: "HP", maxHp: "최대 HP", mp: "MP", attack: "공격", defense: "방어", exp: "경험치", gold: "골드", atk: "공격", def: "방어", speed: "속도", hitRate: "명중률" };
function asset(project: Project, resourceId: unknown): Pick<ActivityVisual, "resourceId" | "uploaded" | "uploadedAsset"> {
  const id = str(resourceId);
  const source = project.assets.uploaded[id];
  const data = source?.dataUrl;
  return { resourceId: id || undefined, ...(source?.ref ? { uploadedAsset: structuredClone({ ...source, dataUrl: undefined }) } : data && data.length <= 1_000_000 ? { uploaded: data } : {}) };
}

/** Search rows identify a hit (`charset:sheet:index`, `backdrop:id`). Pictures need the file id. */
function searchedDrawableId(row: Record<string, any>): string {
  const spriteId = str(obj(obj(row.nativeGraphic).sprite).id);
  if (spriteId) return spriteId;
  const direct = str(row.resourceId || row.textureKey);
  if (direct) return direct;
  const id = str(row.id);
  return id.match(/^charset:([^:]+):\d+$/)?.[1]
    ?? id.match(/^backdrop:(.+)$/)?.[1]
    ?? id;
}

function searchedFrame(row: Record<string, any>): number | undefined {
  const pattern = obj(row.nativeGraphic).pattern;
  if (typeof pattern === "number" && Number.isFinite(pattern)) return pattern;
  if (typeof row.characterIndex !== "number" || !Number.isFinite(row.characterIndex)) return undefined;
  return Math.floor(row.characterIndex / 4) * 48 + (row.characterIndex % 4) * 3 + 1;
}

function canDrawAsset(project: Project, resourceId: string): boolean {
  const drawn = asset(project, resourceId);
  return Boolean(drawn.uploaded || drawn.uploadedAsset || (drawn.resourceId && resolveAssetResourceUrl(drawn.resourceId)));
}

export function captureActivityVisuals(project: Project, name: string, input: unknown, result?: unknown, phase: ActivityVisual["phase"] = "read"): ActivityVisual[] {
  // Observability must never prevent a tool from executing.
  try { return capture(project, name, obj(input), obj(obj(result).data), phase); } catch { return []; }
}
function capture(project: Project, name: string, args: Record<string, any>, data: Record<string, any>, phase: ActivityVisual["phase"]): ActivityVisual[] {
  const visuals: ActivityVisual[] = [];
  const mapId = str(args.mapId || data.mapId);
  const map = project.maps[mapId];
  if (map) {
    const eventId = str(args.eventId || args.id || data.eventId || obj(data.event).id);
    const event = map.events.find(e => e.id === eventId) ?? (name.includes("npc") ? map.events.find(e => e.name === args.name) : undefined);
    const points = Array.isArray(args.points) ? args.points.map(obj).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y)) : [];
    const bounds = points.length ? { x: Math.min(...points.map(p => p.x)), y: Math.min(...points.map(p => p.y)), width: Math.max(...points.map(p => p.x)) - Math.min(...points.map(p => p.x)) + 3, height: Math.max(...points.map(p => p.y)) - Math.min(...points.map(p => p.y)) + 3 } : args;
    const area = obj(args.region ?? args.rect ?? args.area ?? bounds);
    const x = Number(area.x ?? event?.x ?? 0), y = Number(area.y ?? event?.y ?? 0);
    const w = Math.min(32, Math.max(12, Number(area.width ?? area.w ?? 24))), h = Math.min(24, Math.max(8, Number(area.height ?? area.h ?? 16)));
    if (Number.isFinite(x + y + w + h) && map.width > 0 && map.height > 0) {
      const width = Math.min(map.width, Math.ceil(w)), height = Math.min(map.height, Math.ceil(h));
      const ox = Math.max(0, Math.min(map.width - width, Math.floor(x - (/npc|event/.test(name) ? width / 2 : 1))));
      const oy = Math.max(0, Math.min(map.height - height, Math.floor(y - (/npc|event/.test(name) ? height / 2 : 1))));
      const cut = (tiles: number[]) => Array.from({ length: width * height }, (_, i) => tiles[(oy + Math.floor(i / width)) * map.width + ox + i % width] ?? -1);
      const source = project.tilesets[map.tilesetId];
      if (source) {
        const { id, name: title, image, kind, tileSize, tilesPerRow, count, passability, priority, terrain, transparentColor, autotileGroups, tileMeta, tileGrafts } = source;
        const tileset = structuredClone({ id, name: title, image, kind, tileSize, tilesPerRow, count, passability, priority, terrain, transparentColor, autotileGroups, tileMeta, tileGrafts });
        const cropped: GameMap = { id: map.id, name: map.name, width, height, tileSize: map.tileSize, tilesetId: map.tilesetId, lowerTiles: cut(map.lowerTiles), upperTiles: cut(map.upperTiles), events: map.events.filter(e => e.x >= ox && e.y >= oy && e.x < ox + width && e.y < oy + height).slice(0, 40).map(e => ({ id: e.id, name: e.name, x: e.x - ox, y: e.y - oy, trigger: e.trigger, commands: [] })) };
        const visual: ActivityVisual = { kind: "map", title: map.name, caption: `영역 (${ox}, ${oy}) · ${width}×${height} · 이벤트는 위치 표시`, phase, target: `map:${mapId}:${ox},${oy}`, map: cropped, tileset, ...asset(project, image.type === "uploaded" ? image.id : undefined), origin: { x: ox, y: oy } };
        if (JSON.stringify(visual).length <= 1_100_000) visuals.push(visual);
      }
    }
    if (event) {
      const graphic = event.pages?.find(p => p.graphic?.sprite)?.graphic;
      const sprite = graphic?.sprite ?? event.sprite;
      visuals.unshift({ kind: "asset", title: event.name || event.pages?.[0]?.name || event.id, caption: `${map.name} · (${event.x}, ${event.y})`, phase, target: `event:${mapId}:${event.id}`, ...asset(project, sprite?.id), pattern: graphic?.pattern ?? 0 });
    }
  }
  const collection = str(args.collection || data.collection) || Object.entries(collections).find(([word]) => new RegExp(`(?:^|_)${word}(?:_|$)`).test(name))?.[1];
  const records = collection ? (project.database as unknown as Record<string, Record<string, any>[]>)[collection] : undefined;
  if (Array.isArray(records)) {
    const id = str(args.id || obj(args.record).id || obj(args[name.split("_").at(-1)!]).id || args[`${name.split("_").at(-1)}Id`] || obj(data.record).id || data.id);
    const found = id ? records.filter(r => r.id === id) : Array.isArray(data.records) ? data.records.slice(0, 6).map((r: any) => records.find(x => x.id === r.id)).filter(Boolean) : [];
    for (const record of found) {
      if (!record) continue;
      const resource = record.faceResourceId || record.monsterResourceId || record.iconResourceId || record.imageResourceId;
      const fields = { ...obj(record.stats), ...obj(record.statBonuses), ...record };
      const stats = Object.entries(statLabels).filter(([key]) => ["number", "string"].includes(typeof fields[key])).slice(0, 6).map(([key, label]) => [label, String(fields[key]).slice(0, 80)] as [string, string]);
      visuals.push({ kind: resource ? "asset" : "record", title: str(record.name || record.id), caption: ({ actors: "캐릭터", enemies: "몬스터", items: "아이템", equipment: "장비", skills: "스킬" } as Record<string, string>)[collection!] ?? "대상 정보", phase, target: `record:${collection}:${record.id}`, ...asset(project, resource), hue: Number(record.graphicHue) || 0, stats });
    }
  }
  if (/resource|graphic/.test(name)) {
    const matches = data.resources ?? data.matches ?? (data.resource ? [data.resource] : []);
    if (Array.isArray(matches) && !["bgm", "se", "music", "sound"].includes(args.kind)) for (const match of matches.slice(0, 6)) {
      const row = obj(match);
      const searchId = str(row.resourceId || row.textureKey || row.id);
      const drawableId = searchedDrawableId(row);
      if (!searchId || !canDrawAsset(project, drawableId)) continue;
      const pattern = searchedFrame(row);
      visuals.push({ kind: "asset", title: str(row.name || row.label || searchId), caption: "검색된 소재", phase, target: `resource:${searchId}`, ...asset(project, drawableId), ...(pattern === undefined ? {} : { pattern }) });
    }
  }
  return visuals.slice(0, 6);
}
