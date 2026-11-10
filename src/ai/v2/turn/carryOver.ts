// 턴 사이 기억 — 앞 턴의 할 일을 이어 받을 때 막힌 항목을 다시 열지 정한다(2026-11-11 B4, openwiki/assistant-v2.md 「턴 사이 기억」).
// 규칙: 막힌 항목은 막힌 채로 온다. 다시 여는 것은 (1) 그 항목의 대상(맵·이벤트)이 막힌 뒤로 바뀌었을 때 (2) 이번 요청이 그 항목을 짚을 때뿐이다.
// 화면 검수 항목은 대상이 바뀌어도 열지 않는다 — 이번 턴 화면 검수가 장부로 다시 본다. 앞 턴 보고를 두고 한 검토(검토자·리드)는 뺀다 — 그 보고는 이제 없다.
import type { Project } from "@/project/types";
import { textHash } from "../loop/continuation";
import type { ProjectIndex } from "../loop/refs";
import type { CarryDecision, TodoMeta, TodoStore } from "../loop/todoStore";
import type { TodoItem } from "../todo/types";

/** 검토자·리드 항목의 열쇠 — 지적 글에서 만든다(순번 열쇠는 다음 검토의 다른 지적이 같은 열쇠를 받아 내용을 덮었다). */
export const reviewKey = (prefix: "adv" | "lead", text: string): string => `${prefix}:${textHash(text)}`;
const isReportReview = (meta: TodoMeta): boolean => /^(adv|lead):/u.test(meta.key ?? "");

/** 항목이 가리키는 맵·이벤트의 지금 지문들 — 묶인 id(refs), 장소 열쇠의 맵, 항목 글에 적힌 맵·이벤트 id. */
function targetPrints(item: TodoItem, meta: TodoMeta, now: ProjectIndex): string[] {
  const mapIds = new Set<string>(item.refs?.mapIds ?? []);
  const eventIds = new Set<string>(item.refs?.eventIds ?? []);
  const place = /^place:([^:]+):/u.exec(meta.key ?? "");
  if (place) mapIds.add(place[1]!);
  for (const m of item.content.matchAll(/\bmap_[A-Za-z0-9_-]+/gu)) mapIds.add(m[0]);
  for (const m of item.content.matchAll(/\bev_[A-Za-z0-9_-]+/gu)) eventIds.add(m[0]);
  const out: string[] = [];
  for (const id of mapIds) if (now.maps.has(id)) out.push(`map:${id}=${now.maps.get(id)}`);
  for (const [key, print] of now.events) if (eventIds.has(key) || eventIds.has(key.slice(key.indexOf(":") + 1))) out.push(`ev:${key}=${print}`);
  return out.sort();
}

/** 대상 지문 하나(대상을 모르면 undefined — 그런 항목은 «바뀌었다»로 열리지 않는다). */
function targetFingerprint(item: TodoItem, meta: TodoMeta, now: ProjectIndex): string | undefined {
  const prints = targetPrints(item, meta, now);
  return prints.length ? textHash(prints.join("|")) : undefined;
}

/** 저장 직전에 부른다 — 막힌 항목마다 지금 대상 지문을 적어 둔다(다음 턴의 시작 저장본과 견줄 값이라 저장할 때마다 새로 뜬다). */
export function stampTargets(store: TodoStore, now: ProjectIndex): void {
  for (const item of store.items) {
    const meta = store.meta.get(item.id);
    if (!meta) continue;
    const print = item.status === "blocked" ? targetFingerprint(item, meta, now) : undefined;
    if (print) meta.targetFp = print; else delete meta.targetFp;
  }
}

/** 요청이 이 항목을 짚는가 — 항목 id(「v16」), 확인이 찾는 이름(장소·인물·아이템…), 묶인 맵의 이름이 요청 글에 있다. */
function namedByRequest(task: string, item: TodoItem, project: Project): boolean {
  if (new RegExp(`(?<![A-Za-z0-9_])${item.id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}(?![A-Za-z0-9_])`, "u").test(task)) return true;
  const c = item.check;
  const names = !c ? [] : c.kind === "place" || c.kind === "person" || c.kind === "item" || c.kind === "party_join" ? [c.name]
    : c.kind === "talk" ? [c.who] : c.kind === "battle" ? [c.who ?? ""] : c.kind === "link" ? [c.to] : c.kind === "present_evidence" ? [c.item]
    : c.kind === "reachable" ? [c.target] : c.kind === "ending" ? ["엔딩"] : "map" in c && typeof c.map === "string" ? [c.map] : [];
  for (const id of item.refs?.mapIds ?? []) names.push(project.maps[id]?.name ?? "");
  for (const m of item.content.matchAll(/\bmap_[A-Za-z0-9_-]+/gu)) names.push(project.maps[m[0]]?.name ?? "");
  return names.map((n) => n.trim()).some((n) => n.length >= 2 && task.includes(n));
}

/** TodoStore.restore 에 넘기는 결정 함수. now = 이번 턴 시작 저장본의 지문. */
export function carryOver(task: string, project: Project, now: ProjectIndex): (item: TodoItem, meta: TodoMeta) => CarryDecision {
  return (item, meta) => {
    if (isReportReview(meta)) return { drop: "앞 턴의 보고를 두고 한 검토 — 이번 턴 보고는 다시 검토한다" };
    if (item.status !== "blocked") return "keep";
    if (namedByRequest(task, item, project)) return "reopen";
    if (item.source === "vqa") return "keep";
    const before = meta.targetFp;
    return before && before !== targetFingerprint(item, meta, now) ? "reopen" : "keep";
  };
}
