// 「현재 목표」가 가리키는 다음 대상 — 목표 글에서 지금 맵의 이벤트(또는 다른 맵으로 가는 문)를 찾는다(순수 함수).
//
// 왜(2026-10-29 VM 측정 판 5개 판정자 공통 지적): 「조사 위치가 눈에 안 띈다 · 어떤 물건이 메모·시계인지 모른다 · 장화 자국 위치를 못 찾았다」.
// 조사 이벤트는 대부분 투명이고 반짝임은 반경 2칸 안에서 한 번만 뜬다. 목표 글은 빌더가 「(젖은 장화: 시골 여관 가운데)」처럼
// 대상 이벤트 이름을 꼬리에 붙이므로(ai/v2/discoverability withWhere), 그 이름으로 대상을 찾아 화면에 은은한 표시를 늘 둔다.
import type { RuntimeEventView } from "@/project/runtimeEventState";
import type { Command, GameMap, Project } from "@/project/types";

const bare = (text: string): string => text.replace(/[\s「」『』"'·.,!?]/gu, "");

/** 조작으로 부를 수 있는 대상(조사·접촉) — 자동 실행·병렬·목표 걸기는 대상이 아니다. 관문 이벤트는 문(다른 맵으로 가는 것)일 때만. */
function pickable(view: RuntimeEventView, allowGate = false): boolean {
  const id = view.event.id;
  if (!view.page || id.startsWith("ev_objective") || (!allowGate && id.startsWith("ev_gate_"))) return false;
  const kind = view.trigger.kind;
  return kind === "action" || kind === "playerTouch" || kind === "eventTouch";
}

function transferMapIds(commands: readonly Command[] | undefined, out: Set<string>): void {
  for (const command of commands ?? []) {
    const record = command as unknown as Record<string, unknown>;
    if (command.kind === "transfer" && typeof record.mapId === "string") out.add(record.mapId);
    for (const value of Object.values(record)) {
      if (Array.isArray(value) && value.length && typeof value[0] === "object" && value[0] && "kind" in (value[0] as object)) transferMapIds(value as Command[], out);
    }
    if (command.kind === "choices") for (const option of command.options) transferMapIds(option.branch, out);
  }
}

/** 지금 맵에서 mapIds 중 하나로 가는 문·계단 이벤트. */
function doorsTo(views: readonly RuntimeEventView[], mapIds: ReadonlySet<string>): RuntimeEventView[] {
  return views.filter((view) => {
    const targets = new Set<string>();
    transferMapIds(view.page?.commands, targets);
    return [...targets].some((id) => mapIds.has(id));
  });
}

/**
 * 목표 글의 대상 이벤트들(지금 맵).
 * 1) 꼬리 「(이름: 자리)」의 이름과 같은 이벤트 — 「(<맵> 입구: …)」 면 그 맵으로 가는 문.
 * 2) 글에 이름이 나온 이벤트(두 글자 이상, 다른 나온 이름에 품긴 짧은 이름은 뺀다).
 * 3) 글에 이름이 나온 다른 맵으로 가는 문.
 */
export function objectiveTargetViews(project: Pick<Project, "maps">, map: GameMap, views: readonly RuntimeEventView[], text: string | null | undefined): RuntimeEventView[] {
  const objective = (text ?? "").trim();
  if (!objective) return [];
  const candidates = views.filter((view) => pickable(view));
  const doorCandidates = views.filter((view) => pickable(view, true));
  const tail = /\(([^():]+):[^()]*\)\s*$/u.exec(objective)?.[1]?.trim();
  if (tail) {
    const entrance = /^(.+?)\s*입구$/u.exec(tail)?.[1];
    if (entrance) {
      const others = Object.values(project.maps).filter((other) => other.id !== map.id);
      const key = bare(entrance);
      // 「객실 입구」→ 「2층 객실」처럼 맵 이름이 목표 글보다 길 때도 잇는다(같은 이름이 먼저).
      const exactMaps = others.filter((other) => bare(other.name ?? "") === key);
      const ids = new Set((exactMaps.length || key.length < 2 ? exactMaps : others.filter((other) => bare(other.name ?? "").includes(key))).map((other) => other.id));
      const doors = doorsTo(doorCandidates, ids);
      if (doors.length) return doors;
    }
    const exact = candidates.filter((view) => bare(view.event.name ?? "") === bare(tail));
    if (exact.length) return exact;
  }
  const plain = bare(objective);
  // 글에 이름이 나온 이벤트 전부 — 다른 나온 이름의 일부인 것(「상인」 ⊂ 「상인 도윤」)은 뺀다. 용의자 셋을 한 목표가 부르면 셋 다.
  const named0 = candidates.filter((view) => { const name = bare(view.event.name ?? ""); return name.length >= 2 && plain.includes(name); });
  const best = named0.filter((view) => { const name = bare(view.event.name ?? ""); return !named0.some((other) => { const o = bare(other.event.name ?? ""); return o.length > name.length && o.includes(name); }); });
  if (best.length) return best;
  const named = new Set(Object.values(project.maps).filter((other) => other.id !== map.id && bare(other.name ?? "").length >= 2 && plain.includes(bare(other.name ?? ""))).map((other) => other.id));
  return named.size ? doorsTo(doorCandidates, named) : [];
}

const GENERIC_NAME = /^(?:ev[_-]|event|이벤트|npc\b|조사\s*지점$|조사$|단서$|지점$)/iu;

/** 「Z 조사 · 책장」의 이름 부분 — 이벤트 이름(사람이 읽는 이름이면), 문이면 가는 맵 이름, 없으면 그 칸 가구 이름표. */
export function promptTargetName(project: Pick<Project, "maps">, view: RuntimeEventView | undefined, label: string | null, tileLabel?: string): string | undefined {
  if (!view || !label) return undefined;
  const clip = (name: string): string => (name.length > 12 ? `${name.slice(0, 11)}…` : name);
  if (label === "Z 이동") {
    const targets = new Set<string>();
    transferMapIds(view.page?.commands, targets);
    const name = [...targets].map((id) => project.maps[id]?.name?.trim()).find(Boolean);
    return name ? clip(name) : undefined;
  }
  const raw = String(view.event.name ?? "").replace(/^숨을\s*곳\s*:\s*/u, "").trim();
  if (raw && !GENERIC_NAME.test(raw) && /[\p{L}]/u.test(raw)) return clip(raw);
  const tile = tileLabel?.split(" · ")[0]?.replace(/\s*\([^)]*\)/gu, "").replace(/\s+\d+\s*[w×x]\s*\d*$/iu, "").trim();
  return tile ? clip(tile) : undefined;
}
