// 명세 은행의 파일 모양과 같이 쓰는 작은 함수. 제품 코드를 끌어오지 않는다 — 옛 커밋의 작업 폴더에 이 폴더만 복사해도 재생(replayGame.mts)이 돈다.
// 문서: openwiki/assistant-v2.md 「명세 은행」.
import { createHash } from "node:crypto";

/** 모델이 보낸 호출 하나. n 이름 · a 인자 · ok 그때의 성공 여부 · s 그때 결과 요약(견줄 때만 본다) · stop 이 호출 뒤 모델이 멈췄다 · read 프로젝트를 바꾸지 않는 호출. */
export interface SpecCall { n: string; a: unknown; ok: boolean; s?: string; stop?: 1; read?: 1 }
/** 사용자 글 하나가 연 턴. task = 실행기에 간 글(앞 요청 메모가 붙은 것). polishFrom = 완성 뒤 대사 윤문 차례가 시작한 호출 번호. */
export interface SpecTurn {
  input: string; task: string; calls: SpecCall[]; polishFrom?: number; verdict?: { complete: boolean; summary: string };
  /** 그 턴에 함수·판정자가 덧붙인 할 일 항목(관문 g… · 비평 c… · 화면 검수 v…)의 id → 글 앞머리. 재생은 번호가 아니라 글로 같은 항목을 찾는다. */
  items?: Record<string, string>;
}
/** 저장본의 맵 하나 요약 — 재생이 저장본을 얼마나 되살렸는지 재는 기준. tiles = 층 타일의 지문(이벤트 제외). */
export interface RefMap { name: string; w: number; h: number; tileset: string; tiles: string; events: RefEvent[] }
export interface RefEvent { cls: string; name: string; x: number; y: number; pages: number }
export interface Reference { title: string; startMap: string; maps: RefMap[]; blueprint?: { title: string; setting?: string; places: number; steps: number }; quests: number; endings: number; troops: number; items: number }
export interface Spec {
  version: 1;
  id: string;
  /** game = 게임 하나를 지은 판(여러 턴) · place = 장소 하나를 깐 판(맵 깔기 24가지). */
  kind: "game" | "place";
  source: { run: string; head: string; model: string; provider: string; startedAt?: string; note?: string };
  request: string;
  /** 요청의 projectKey — 장소 변주 열쇠(spec.variety)에 들어가므로 그때 값 그대로. 무작위 uuid 일 뿐이다. */
  projectKey: string;
  /** 빈 프로젝트의 제목(하네스가 준 것). */
  title: string;
  turns: SpecTurn[];
  /** 장소 이름 → 그때 빌더가 뽑은 소금(저장본의 장소 설계 기억에서). 없는 판은 이름에서 정한 값으로 재생한다. */
  salts: Record<string, number>;
  /** 그때의 맵 id → 그 맵이 가졌던 이름들. 재생은 이름으로 새 id 를 찾는다. */
  maps: Record<string, string[]>;
  /**
   * 호출 인자에 나오는 그때의 이벤트 id → 어느 맵(그때 id)의 무슨 이벤트였나. 저장본에 없는 id(그 판 도중에 생겼다 지워진 것)는
   * at = 그 id 가 처음 나온 결과 글의 자리([턴, 호출, 그 글의 몇 번째 이벤트 id]) — 재생은 같은 호출의 결과 글에서 같은 차례의 id 를 쓴다.
   */
  events: Record<string, { map: string; name: string; x: number; y: number } | { at: [number, number, number] }>;
  /** 턴마다 끝났을 때의 저장본 요약(스냅숏이 있는 턴만) + 마지막 저장본. */
  reference: { afterTurn: Record<string, Reference>; final?: Reference };
  /** 은행에 담지 않은 것(이름 → 수)과 까닭. */
  dropped: Record<string, number>;
}

export const sha = (value: unknown, n = 12): string => createHash("sha1").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex").slice(0, n);

/** 프로젝트를 바꾸지 않는 호출 — 제품의 READ_VERB(src/ai/v2/loop/todoTools.ts)와 같은 낱말. 은행에는 남기고 표시만 한다(읽기가 뒤 쓰기의 관문을 여는 도구가 있다). */
const READ_VERB = /^(todo|inspect|ask_user|ask_helpers|room_parts|dungeon_parts|run_scene_test|simulate_battle|load_tools|recommend_bgm)$|^(get|list|find|read|show|preview|search|lint|check|validate|probe|describe|view|inspect)_|^store_(find|read|list|get)/u;
export const isRead = (name: string): boolean => name !== "todo" && READ_VERB.test(name);

/** 모델·그림 생성·사용자·네트워크가 있어야 같은 결과가 나오는 호출 — 재생은 부르되 «그대로 못 되살림»으로 센다. */
export const NEEDS_OUTSIDE = /^(generate_|draw_object$|ask_user$|ask_helpers$|store_|web_search$|compose_music$|recommend_bgm$)/u;

/** 이벤트 id 의 갈래 — 무작위 꼬리(uuid·base36)와 맵 id 를 뗀 앞머리. */
export function eventClass(id: string, mapId?: string): string {
  let s = mapId ? id.split(mapId).join("<map>") : id;
  s = s.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gu, "<uuid>");
  s = s.replace(/^(ev_world_gate)_[a-z0-9]+$/u, "$1_<r>");
  return s;
}

const MAP_ID = /map_(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|auto_[a-z0-9]+|[A-Za-z0-9]+_[0-9]{3,})/gu;
/** 글 안의 맵 id 들(uuid·자동·열쇠 꼴). map_blank_start 같은 고정 id 는 재생에서도 같으니 뺀다. */
export const mapIdsIn = (text: string): string[] => [...new Set(text.match(MAP_ID) ?? [])];
/** 결과 글에 나온 이벤트 id 들(처음 나온 차례대로, 겹침 없이). */
export const eventTokens = (text: string): string[] => [...new Set(text.match(/ev_[A-Za-z0-9_-]+/gu) ?? [])];
/** 글 안의 이벤트 id 후보 — "ev_…" 따옴표 안 값. */
export const eventIdsIn = (text: string): string[] => [...new Set([...text.matchAll(/"(ev_[A-Za-z0-9_\-]+)"/gu)].map((m) => m[1]!))];

/** 할 일 항목 글의 견줄 앞머리 — 맵·이벤트 id 는 판마다 달라 가린다. */
export const itemKey = (content: string): string => content.replace(/map_[A-Za-z0-9_-]+|ev_[A-Za-z0-9_-]+/gu, "#").replace(/\s+/gu, " ").slice(0, 70);

/** 이름 견주기 — 공백·모양 차이를 지운다. 재생기가 String.prototype.normalize 를 엿듣기 전에 원래 함수를 잡아 둔다(우리 호출이 엿듣기에 섞이지 않게). */
const NORMALIZE = String.prototype.normalize;
export const nameKey = (name: string | undefined): string => NORMALIZE.call(String(name ?? ""), "NFC").replace(/\s+/gu, "");

/** 층 타일 지문 — 맵 크기·칩셋·타일 층(이름에 tiles·layers·relief 가 든 칸)만. 이벤트·이름·id·음악·장소 이름표는 뺀다. */
export function tilesPrint(map: Record<string, unknown>): string {
  const keys = Object.keys(map).filter((k) => /tiles|layers|relief/iu.test(k)).sort();
  return sha({ w: map.width, h: map.height, t: map.tilesetId, l: keys.map((k) => [k, map[k]]) }, 16);
}

type AnyMap = Record<string, unknown> & { id: string; name?: string; width: number; height: number; tilesetId?: string; events?: { id: string; name?: string; x: number; y: number; pages?: unknown[] }[] };
type AnyProject = { meta?: { title?: string }; startMapId: string; maps: Record<string, AnyMap>; gameBlueprint?: { title?: string; setting?: string; places?: unknown[]; steps?: unknown[] }; quests?: unknown[]; endings?: unknown[]; database?: { troops?: unknown[]; items?: unknown[] } };

/** 프로젝트 → 견줄 요약. 재생한 것과 저장본을 같은 함수로 줄인다. */
export function referenceOf(project: unknown): Reference {
  const p = project as AnyProject;
  const maps = Object.values(p.maps).map((m) => ({
    name: m.name ?? m.id, w: m.width, h: m.height, tileset: m.tilesetId ?? "", tiles: tilesPrint(m),
    events: (m.events ?? []).map((e) => ({ cls: eventClass(e.id, m.id), name: e.name ?? "", x: e.x, y: e.y, pages: (e.pages ?? []).length })),
  }));
  const bp = p.gameBlueprint;
  return {
    title: p.meta?.title ?? "", startMap: p.maps[p.startMapId]?.name ?? p.startMapId, maps,
    ...(bp ? { blueprint: { title: bp.title ?? "", ...(bp.setting ? { setting: bp.setting } : {}), places: (bp.places ?? []).length, steps: (bp.steps ?? []).length } } : {}),
    quests: (p.quests ?? []).length, endings: (p.endings ?? []).length, troops: (p.database?.troops ?? []).length, items: (p.database?.items ?? []).length,
  };
}

export interface Trust { maps: { saved: number; replayed: number; named: number; sameSize: number; sameTiles: number }; events: { saved: number; replayed: number; matched: number; samePlace: number }; missingMaps: string[]; extraMaps: string[] }

/**
 * 저장본 요약과 재생 요약을 견준다. 맵은 이름으로 짝짓고(크기·타일 지문), 이벤트는 같은 맵 안에서 갈래+이름으로 짝짓는다(같은 칸이면 samePlace).
 * 신뢰 수치 = sameTiles/saved(맵) · matched/saved(이벤트) — 은행 재생이 그때 지은 것을 얼마나 되살리는가.
 */
export function compareReference(saved: Reference, replayed: Reference): Trust {
  const byName = new Map(replayed.maps.map((m) => [nameKey(m.name), m]));
  const t: Trust = { maps: { saved: saved.maps.length, replayed: replayed.maps.length, named: 0, sameSize: 0, sameTiles: 0 }, events: { saved: 0, replayed: replayed.maps.reduce((n, m) => n + m.events.length, 0), matched: 0, samePlace: 0 }, missingMaps: [], extraMaps: [] };
  const used = new Set<string>();
  for (const m of saved.maps) {
    t.events.saved += m.events.length;
    const r = byName.get(nameKey(m.name));
    if (!r) { t.missingMaps.push(m.name); continue; }
    used.add(nameKey(m.name));
    t.maps.named += 1;
    if (r.w === m.w && r.h === m.h && r.tileset === m.tileset) t.maps.sameSize += 1;
    if (r.tiles === m.tiles) t.maps.sameTiles += 1;
    const pool = r.events.map((e) => ({ ...e, taken: false }));
    for (const e of m.events) {
      const same = pool.find((x) => !x.taken && x.cls === e.cls && x.name === e.name && x.x === e.x && x.y === e.y);
      const hit = same ?? pool.find((x) => !x.taken && x.cls === e.cls && x.name === e.name);
      if (!hit) continue;
      hit.taken = true;
      t.events.matched += 1;
      if (same) t.events.samePlace += 1;
    }
  }
  t.extraMaps = replayed.maps.filter((m) => !used.has(nameKey(m.name))).map((m) => m.name);
  return t;
}
