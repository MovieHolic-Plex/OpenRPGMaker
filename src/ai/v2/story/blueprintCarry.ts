// 청사진을 다시 쓰면 앞 경로가 지어 둔 것을 새 단계가 물려받는다 — 다시 쓰기는 경로를 «바꾸는» 것이지 한 벌 더 «쌓는» 것이 아니다.
//
// 왜(2026-11-12 Terra 측정 r1, 저장된 판 13개 중 6개): 관문 하나에 답하느라 모델이 청사진을 다시 썼다 — 단계 수·장소는 그대로, 사람 이름만 바뀌었다.
// 경로 빌더는 단계의 이벤트를 «그 맵의 같은 이름 이벤트» 로 찾으므로 이름이 바뀐 단계는 새 사람을 세웠고, 앞 경로의 사람은 그대로 남았다.
// 남은 사람은 여전히 제 스위치를 켜고(문·길은 그 스위치로 잠겨 있다), 새 사람은 다른 스위치를 켠다 — 이야기 줄이 두 벌이 됐다
// (r1-fun: 닫힌 길이 앞 경로의 «나디아» 를 찾으라 하고, 본편의 «샘지기 아말» 은 길을 열지 못함. 눈가림 판정의 «이름 겹침 · 겹쳐 선 사람 · 끝나지 않는 의뢰»).
//
// 그래서 단계는 제가 지어 둔 것을 적어 둔다(GameBlueprintStep.built: 맵·이벤트·켜는 스위치·주는 물건).
//  - write_blueprint → carryBuilt: 새 청사진의 단계가 앞 단계의 built 를 물려받는다(이름이 같은 단계 먼저, 그다음 같은 id). 받을 단계가 없는 것은 retired 로.
//  - build_blueprint_path → settleCarriedSteps: 물려받은 이벤트의 이름을 새 이름으로 바꾸고(그 이름을 부르던 다른 글도), 장소를 옮긴 단계·빠진 단계의
//    이벤트는 걷고, 아무도 켜지 않게 된 스위치를 기다리는 조건을 푼다. 그 뒤 빌더가 같은 이벤트·같은 스위치로 그 단계를 다시 짓는다.
// 함수가 지은 이벤트(ev_chain_*)만 지우고 이름을 바꾼다 — 모델·사람이 지은 이벤트는 건드리지 않는다.
import type { GameBlueprint, GameBlueprintStep, GameBlueprintStepBuilt } from "@/project/gameBlueprint";
import type { GameMap, Project } from "@/project/types";
import { josa, mapFor, norm } from "./blueprintPathNames";

type Ev = GameMap["events"][number];
const nameOf = (ev: Ev): string => String((ev as { name?: string }).name ?? "");
const BUILT_BY_FUNCTION = /^ev_chain_/u;

/** 새 청사진의 단계에 앞 청사진 단계의 built 를 옮긴다. 모델이 보낸 built·retired 는 버린다(함수만 쓴다). */
export function carryBuilt(prior: GameBlueprint | undefined, next: GameBlueprint): GameBlueprint {
  const { retired: _modelRetired, ...rest } = next;
  const bare = next.steps.map(({ built: _modelBuilt, ...step }): GameBlueprintStep => step);
  if (!prior) return { ...rest, steps: bare };
  const pool = prior.steps.filter((step) => step.built);
  const used = new Set<string>();
  const take = (old: GameBlueprintStep | undefined): GameBlueprintStepBuilt | undefined => { if (!old || used.has(old.id)) return undefined; used.add(old.id); return old.built; };
  // 1) 같은 이름(또는 그 이벤트 id 를 가리키는) 단계 — 순서가 바뀌어도 같은 것이다.
  const byName = bare.map((step) => take(pool.find((old) => !used.has(old.id) && (norm(old.event) === norm(step.event) || old.built!.eventId === step.event))));
  // 2) 같은 자리(id)의 단계 — 이름을 바꾼 다시 쓰기.
  const steps = bare.map((step, i): GameBlueprintStep => { const built = byName[i] ?? take(pool.find((old) => old.id === step.id)); return built ? { ...step, built } : step; });
  const retired = [...(prior.retired ?? []), ...pool.filter((old) => !used.has(old.id)).map((old) => old.built!)];
  return { ...rest, steps, ...(retired.length ? { retired } : {}) };
}

export interface CarriedSteps {
  /** 이름을 새 단계 이름으로 바꾼 이벤트 — 빌더는 그대로 두지 않고 다시 짓는다(대사·그림이 앞 사람의 것이다). */
  readonly renamed: ReadonlySet<string>;
  readonly notes: readonly string[];
}

/** 이 스위치를 기다리는 페이지 조건을 푼다 — 켜던 이벤트가 사라졌다. */
function dropSwitchConditions(project: Project, switchId: string): number {
  let dropped = 0;
  for (const map of Object.values(project.maps)) {
    let touched = false;
    const events = (map.events ?? []).map((ev) => {
      const pages = (ev.pages ?? []).map((page) => {
        const conditions = (page.conditions ?? []) as unknown as { kind?: string; switchId?: string }[];
        if (!conditions.some((c) => c.kind === "switch" && c.switchId === switchId)) return page;
        dropped += 1; touched = true;
        return { ...page, conditions: conditions.filter((c) => !(c.kind === "switch" && c.switchId === switchId)) } as typeof page;
      });
      return touched ? { ...ev, pages } : ev;
    });
    if (touched) map.events = events;
  }
  return dropped;
}

/** 「옛 이름」을 부르는 글(잠김 안내 · 목표 꼬리)을 새 이름으로 — 조사는 새 이름 받침에 맞춘다. */
function swapNames(project: Project, pairs: readonly (readonly [string, string])[]): void {
  if (!pairs.length) return;
  const esc = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const fit = (to: string, particle: string | undefined): string => !particle ? "" : /^[을를]$/u.test(particle) ? josa(to, "을", "를") : /^[이가]$/u.test(particle) ? josa(to, "이", "가") : /^[은는]$/u.test(particle) ? josa(to, "은", "는") : /^[과와]$/u.test(particle) ? josa(to, "과", "와") : particle;
  const swap = (json: string): string => pairs.reduce((text, [from, to]) => text.replace(new RegExp(`「${esc(JSON.stringify(from).slice(1, -1))}」(?:(을|를|이|가|은|는|과|와)(?![가-힣]))?`, "gu"), (_all, particle?: string) => `「${JSON.stringify(to).slice(1, -1)}」${fit(to, particle)}`), json);
  for (const map of Object.values(project.maps)) {
    const before = JSON.stringify(map.events ?? []);
    const after = swap(before);
    if (after !== before) map.events = JSON.parse(after) as GameMap["events"];
  }
}

/**
 * 경로를 짓기 직전: 물려받은 것을 새 청사진에 맞춘다(프로젝트를 제자리에서 고친다).
 * 이벤트가 이미 새 이름이면 아무것도 하지 않는다 — 다시 불러도 같다.
 */
export function settleCarriedSteps(project: Project): CarriedSteps {
  const bp = project.gameBlueprint;
  const renamed = new Set<string>();
  const notes: string[] = [];
  if (!bp || (!bp.retired?.length && !bp.steps.some((step) => step.built))) return { renamed, notes };
  const find = (built: GameBlueprintStepBuilt): Ev | undefined => project.maps[built.mapId]?.events?.find((ev) => ev.id === built.eventId);
  const remove = (built: GameBlueprintStepBuilt, why: string): boolean => {
    const map = project.maps[built.mapId];
    const ev = find(built);
    if (!map || !ev || !BUILT_BY_FUNCTION.test(ev.id)) return false;
    map.events = map.events.filter((other) => other.id !== ev.id);
    notes.push(`앞 경로의 「${nameOf(ev) || ev.id}」(${map.name ?? map.id}) 를 걷었다 — ${why}`);
    return true;
  };
  const pairs: (readonly [string, string])[] = [];
  for (const step of bp.steps) {
    const built = step.built;
    const ev = built ? find(built) : undefined;
    if (!built || !ev) continue;
    const target = mapFor(project, step.place);
    if (!target || target.id !== built.mapId) { remove(built, `${step.id} 단계가 「${step.place}」(으)로 옮겨 갔다`); continue; }
    const name = nameOf(ev);
    if (ev.id === step.event || norm(name) === norm(step.event)) continue;
    // 그 이름의 이벤트가 따로 있으면(모델이 손으로 세웠다) 그것이 이 단계다 — 앞 경로의 것은 남는 것이다.
    if (target.events.some((other) => other.id !== ev.id && norm(nameOf(other)) === norm(step.event))) { remove(built, `${step.id} 단계의 이벤트 「${step.event}」가 따로 있다`); continue; }
    if (!BUILT_BY_FUNCTION.test(ev.id)) continue;
    target.events = target.events.map((other) => (other.id === ev.id ? { ...other, name: step.event } : other));
    renamed.add(ev.id);
    if (name.trim()) pairs.push([name.trim(), step.event]);
    notes.push(`${step.id}: 앞 경로의 「${name || ev.id}」가 「${step.event}」(이)가 됐다(같은 이벤트 ${ev.id})`);
  }
  swapNames(project, pairs);
  const live = new Set(bp.steps.flatMap((step) => (step.built?.switchId ? [step.built.switchId] : [])));
  for (const built of bp.retired ?? []) {
    const gone = remove(built, "새 청사진에 그 단계가 없다");
    if (gone && built.switchId && !live.has(built.switchId)) {
      const dropped = dropSwitchConditions(project, built.switchId);
      if (dropped) notes.push(`그 단계가 켜던 스위치를 기다리던 조건 ${dropped}개를 풀었다`);
    }
  }
  if (bp.retired?.length) { const { retired: _done, ...rest } = bp; project.gameBlueprint = rest; }
  return { renamed, notes };
}

type Gives = { readonly switchId?: string; readonly itemId?: string };

/**
 * 다시 지은 단계가 넘기는 것이 바뀌었으면(물건을 주던 단계가 이제 깃발을 켠다 — 모델이 gives 의 글을 바꿨다) 옛 것을 기다리던 조건을 새 것으로 옮긴다.
 * 옛 스위치·물건을 아직 누가 켜거나 주면 건드리지 않는다. 문·길의 잠금은 단계가 넘기는 것의 id 로 쌓여 있어, 옮기지 않으면 아무도 주지 않는 물건을 기다린다
 * (r1-fun 재생: 고르기 단계가 «라일라의 약속»(물건) → «대상을 돕기로 했다»(깃발) 로 바뀌자 시장의 동쪽 길 열한 칸이 그 물건을 기다렸다).
 */
export function remapGives(project: Project, from: Gives | undefined, to: Gives | undefined): number {
  if (!from) return 0;
  const all = (): string => JSON.stringify(Object.values(project.maps).map((map) => map.events ?? []));
  const text = all();
  const stale: Gives = {
    ...(from.switchId && from.switchId !== to?.switchId && !text.includes(`"kind":"setSwitch","switchId":${JSON.stringify(from.switchId)}`) ? { switchId: from.switchId } : {}),
    ...(from.itemId && from.itemId !== to?.itemId && !text.includes(`"kind":"changeItem","itemId":${JSON.stringify(from.itemId)}`) ? { itemId: from.itemId } : {}),
  };
  if (!stale.switchId && !stale.itemId) return 0;
  const next: Record<string, unknown> | undefined = to?.switchId ? { kind: "switch", switchId: to.switchId, value: true } : to?.itemId ? { kind: "item", itemId: to.itemId, present: true } : undefined;
  let moved = 0;
  const hit = (node: Record<string, unknown>): boolean => (node.kind === "switch" && !!stale.switchId && node.switchId === stale.switchId && node.value !== false) || (node.kind === "item" && !!stale.itemId && node.itemId === stale.itemId && node.present !== false);
  const key = (node: unknown): string => JSON.stringify(node);
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) {
      const out: unknown[] = [];
      for (const item of node) {
        if (item && typeof item === "object" && !Array.isArray(item) && hit(item as Record<string, unknown>)) { moved += 1; if (next && !out.some((o) => key(o) === key(next)) && !node.some((o) => key(o) === key(next))) out.push({ ...next }); continue; }
        out.push(walk(item));
      }
      return out;
    }
    if (!node || typeof node !== "object") return node;
    const record = node as Record<string, unknown>;
    return Object.fromEntries(Object.entries(record).map(([k, v]) => {
      // 갈래의 조건 하나(fork.condition)는 지울 수 없다 — 새 것이 없으면 그대로 둔다.
      if (v && typeof v === "object" && !Array.isArray(v) && hit(v as Record<string, unknown>) && next) { moved += 1; return [k, { ...next }]; }
      return [k, walk(v)];
    }));
  };
  for (const map of Object.values(project.maps)) map.events = (map.events ?? []).map((ev) => ({ ...ev, pages: walk(ev.pages ?? []) as typeof ev.pages }));
  return moved;
}

