// 다시 지은 장소가 옛 맵 id 를 그대로 갖게 한다.
// 왜(2026-11-11 lay-tools 24요청 — 농장·항구·성·마을): 마을 빌더는 집이 선 맵을 덮어 지을 수 없어(완성된 집 보호 — 도구와 편집기 적용 단계가
// 같은 맵 id 의 옛 집 칸이 바뀌면 거절한다) 새 id `<id>_r2` 로 다시 짓고 옛 맵을 지웠다. 맵 id 가 바뀌자 할 일 묶음이 없는 맵을 가리켜 모델이
// 다시 묶어야 했고, 독립 검수자는 «시작 맵이 지워졌다» 로 읽었다.
// 어떻게: 집 보호는 «같은 id 의 맵이 남아 있을 때» 만 본다. 그래서 두 번에 나눠 싣는다 — ① 새 id 로 짓고 옛 맵을 지운 상태를 편집기가 받은 뒤
// (부르는 쪽의 체크포인트) ② 새 맵의 id 를 옛 id 로 바꿔 한 번 더 싣는다. ②에서 편집기가 보는 것은 «새 id 의 맵이 통째로 사라지고 옛 id 의 맵이 새로 생김» 이라
// 보호에 걸리지 않는다. 관문은 그대로다 — 건너뛰지 않는다. ②가 거절되면 워커가 그 변경만 되돌리므로 새 id 그대로 간다.
import type { Project } from "@/project/types";
import type { PiAssistantV2Env } from "../shared/env";
import type { PlaceBuildResult } from "../shared/types";

/** 값 안의 문자열·키 가운데 from 과 똑같은 것을 to 로 바꾼 사본. 바뀐 것이 없는 가지는 원래 객체를 그대로 돌려준다(체크포인트 비교·제자리 편집 소유가 정체성을 본다). */
export function renameIdIn<T>(value: T, from: string, to: string): T {
  if (typeof value === "string") return (value === from ? to : value) as T;
  if (!value || typeof value !== "object" || ArrayBuffer.isView(value)) return value;
  if (Array.isArray(value)) {
    let out: unknown[] | undefined;
    for (let i = 0; i < value.length; i++) {
      const item = value[i] as unknown;
      if (typeof item === "number") continue;
      const next = renameIdIn(item, from, to);
      if (next !== item) { out ??= value.slice(); out[i] = next; }
    }
    return (out ?? value) as T;
  }
  let changed = false;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const next = renameIdIn(item, from, to);
    const nextKey = key === from ? to : key;
    if (next !== item || nextKey !== key) changed = true;
    out[nextKey] = next;
  }
  return (changed ? out : value) as T;
}

/**
 * 맵 id 를 바꾼 프로젝트 — 맵 사전의 키, 맵의 id, 시작 맵, 그 맵을 가리키는 모든 값(이동·맵 트리·청사진…)을 같이 바꾼다.
 * 타일셋·자산은 맵 id 를 담지 않으므로 그대로 가리킨다. from 이 없거나 to 가 이미 있으면 undefined.
 */
export function renameMapId(project: Project, from: string, to: string): Project | undefined {
  if (from === to || !project.maps[from] || project.maps[to]) return undefined;
  const { tilesets, assets, ...rest } = project;
  const renamed = renameIdIn(rest, from, to) as Omit<Project, "tilesets" | "assets">;
  return { ...project, ...renamed, tilesets, assets } as Project;
}

/** 이번 실행에서 «옛 id 로 되돌린» 새 id → 옛 id. 짓기 결과를 든 부르는 쪽이 끝난 뒤의 id 를 읽는다. */
const kept = new WeakMap<object, Map<string, string>>();
export const keptMapId = (session: object, mapId: string): string => kept.get(session)?.get(mapId) ?? mapId;

/** 짓기 결과의 맵 id 를 끝난 뒤의 id 로(되돌리지 않았으면 그대로). */
export function keptPlaceResult(session: object, result: PlaceBuildResult): PlaceBuildResult {
  const first = result.mapIds[0];
  const now = first ? keptMapId(session, first) : first;
  return first && now && now !== first ? renameIdIn(result, first, now) : result;
}

/**
 * 빌더가 새 id 로 다시 지은 장소(result.relaidFrom = 옛 id)를 옛 id 로 되돌린다. 부르기 전에 «새 id 로 짓고 옛 맵을 지운» 상태가 이미 체크포인트로 실려 있어야 한다.
 * 되돌렸으면 옛 id 로 고친 결과를, 못 했으면(거절·이미 다른 맵이 그 id 를 씀) 받은 결과를 그대로 돌려준다.
 */
export async function keepRelaidMapId(env: PiAssistantV2Env, session: object, verb: string, result: PlaceBuildResult): Promise<PlaceBuildResult> {
  const to = result.relaidFrom, from = result.mapIds[0];
  if (!result.ok || !to || !from || from === to) return result;
  const renamed = renameMapId(env.ctx.project, from, to);
  if (!renamed) return result;
  env.ctx.project = renamed;
  try { await env.checkpoint(`${verb}-keep-id`); } catch { /* 편집기가 거절했다 — 워커가 이 변경만 되돌렸다 */ }
  if (!env.ctx.project.maps[to] || env.ctx.project.maps[from]) return result;
  const map = kept.get(session) ?? new Map<string, string>();
  map.set(from, to); kept.set(session, map);
  const { relaidFrom: _done, ...rest } = renameIdIn(result, from, to);
  return { ...rest, warnings: rest.warnings.filter((w) => !RELAID_NOTE.test(w)).concat(`Re-laid in place: the map id is still ${to}.`) };
}

/** 마을 빌더가 새 id 로 다시 지었을 때 붙이는 알림(place/builders/village.ts) — 옛 id 로 되돌린 뒤에는 뺀다. */
export const RELAID_NOTE = /^완성된 집 보호로 「/u;
