// 빌더가 덮은 방 검사 닫기 — 세계 구성기가 깐 맵에 모델이 건 방 검사 항목은 아무도 할 수 없다. 쓰기가 성공할 때마다 빌더의 사실(judge/todoRoomChecks.ts builderCover)이 맞으면 닫는다.
import type { PiAssistantV2Env } from "../shared/env";
import { modelTextCut, type CheckResult, type TodoItem } from "../todo/types";
import type { HookStats } from "./hookStats";
import { changedSince, checkItem, indexProject } from "./refs";
import { isOpen, type TodoStore } from "./todoStore";

/** 빌더가 덮을 수 있는 검사 종류. */
export const COVERABLE: ReadonlySet<string> = new Set(["layout_built", "layout_review", "room_graph", "room_zones"]);

/** 열린 방 검사 항목 가운데 빌더가 덮은 것을 닫는다. 돌려주는 값: 결과에 붙일 한 줄(닫은 것이 없으면 undefined). */
export function closeBuilderCovered(env: PiAssistantV2Env, store: TodoStore, hooks: HookStats): string | undefined {
  const open = store.items.filter((i) => isOpen(i.status) && !!i.check && COVERABLE.has(i.check.kind));
  if (!open.length) return undefined;
  let changed: ReturnType<typeof changedSince> | undefined;
  try { changed = store.baseline ? changedSince(store.baseline, indexProject(env.ctx.project)) : undefined; } catch { changed = undefined; }
  const closed: { item: TodoItem; check: CheckResult }[] = [];
  for (const item of open) {
    let check: CheckResult | undefined;
    try { check = checkItem(env.ctx.project, store, item, changed); } catch { check = undefined; }
    if (check?.pass && check.covered && store.done(item, check, "auto")) closed.push({ item, check });
  }
  if (!closed.length) return undefined;
  const first = closed[0]!.check;
  hooks.fire("auto_done", `빌더가 덮은 항목 ${closed.map((c) => c.item.id).join(", ")} 자동 끝`, { items: closed.map((c) => c.item.id), covered: true });
  env.emit({ type: "execution_status", name: "v2.todo.covered", ok: true, summary: `할 일 ${closed.map((c) => c.item.id).join(", ")} — 빌더가 덮음: ${first.detail.slice(0, 160)}` });
  return `[Covered by the builder ✓] ${closed.map((c) => `${c.item.id} «${modelTextCut(c.item, 50)}»`).join(", ")} closed — ${(first.en ?? first.detail).slice(0, 240)}. The composer laid this map in one pass; there is no layout to write or review for it (no need to call todo done).`;
}
