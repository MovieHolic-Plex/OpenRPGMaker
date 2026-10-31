// 스크립트가 정하는 진행 — 자동 플레이가 실패한 자리의 진행 조건이 스크립트가 쓰는 스위치·변수·아이템에 걸려 있는가.
//
// 왜(2026-10-31 script-ab sab-1031): 마을 판에서 「평판 ≥ 10 → 촌장 엔딩」의 평판은 「sw_0002 이면 +10」 분기가 올리고, sw_0002 는
// 할머니 스크립트가 「약초 세 포기를 가졌으면」 켠다. 자동 플레이의 계획기는 스크립트 안의 아이템 개수·시각·플레이어 위치 같은 조건을
// 모르니 할머니를 빈손으로 부르고 엔딩에서 실패한다 — 그런데 실제 플레이로는 끝까지 간다. 던전 판의 철창도 스크립트가 시간·위치를 보고 연다.
// 스크립트가 쓰는 값(effects, `project/script/effects.ts`)이 그 실패의 조건 사슬에 끼어 있으면 «막힘»이 아니라 «판정 보류»로 낮춘다.
// 사슬에 스크립트가 없으면 그대로 막힘이다 — 스크립트가 없는 게임의 판정은 바뀌지 않는다.

import { projectScriptUsage, type ProjectScriptUsage } from "@/project/script/effects";
import type { Project } from "@/project/types";
import { allPages, childLists, conditionLeaves, type PageRef, type RawCommand } from "./walk";
import type { CommandWhere } from "./types";

type Key = { readonly kind: "switch" | "variable" | "item"; readonly id: string };

export interface ScriptGate {
  /** 사슬에서 스크립트가 쓰는 값(사람이 읽는 꼴). */
  readonly keys: readonly string[];
  /** 스크립트가 계산된 id 로 써서 무엇을 쓰는지 다 알 수 없다. */
  readonly dynamic: boolean;
}

const MAX_DEPTH = 5;
const WALK_FAILURE = /걸어갈 길이 없|길이 막/u;

function keyOf(kind: Key["kind"], id: string): string {
  return `${kind}:${id}`;
}

/** 조건 잎에서 읽는 값. */
function conditionKeys(condition: unknown): Key[] {
  const out: Key[] = [];
  for (const leaf of conditionLeaves(condition)) {
    if (leaf.kind === "switch" && typeof leaf.switchId === "string") out.push({ kind: "switch", id: leaf.switchId });
    if (leaf.kind === "variable" && typeof leaf.variableId === "string") out.push({ kind: "variable", id: leaf.variableId });
    if (leaf.kind === "item" && typeof leaf.itemId === "string") out.push({ kind: "item", id: leaf.itemId });
  }
  return out;
}

/** 페이지 조건과 그 페이지 안 분기 조건이 읽는 값. 스크립트 명령이 있으면 hasScript. */
function pageReads(page: PageRef): { keys: Key[]; hasScript: boolean } {
  const keys = page.conditions.flatMap(conditionKeys);
  let hasScript = false;
  const scan = (list: readonly RawCommand[]): void => {
    for (const command of list) {
      if (command.kind === "script") hasScript = true;
      if (command.kind === "fork") keys.push(...conditionKeys(command.condition));
      for (const child of childLists(command)) scan(child.list);
    }
  };
  scan(page.commands);
  return { keys, hasScript };
}

/** 명령(스크립트 제외)으로 이 값을 쓰는 페이지들. */
function writerPages(pages: readonly PageRef[], key: Key): PageRef[] {
  const writes = (command: RawCommand): boolean =>
    (key.kind === "switch" && command.kind === "setSwitch" && command.switchId === key.id)
    || (key.kind === "variable" && command.kind === "setVariable" && command.variableId === key.id)
    || (key.kind === "item" && (command.kind === "changeItem" || command.kind === "giveItem") && command.itemId === key.id);
  return pages.filter((page) => {
    let found = false;
    const scan = (list: readonly RawCommand[]): void => {
      for (const command of list) {
        if (found) return;
        if (writes(command)) { found = true; return; }
        for (const child of childLists(command)) scan(child.list);
      }
    };
    scan(page.commands);
    return found;
  });
}

function scriptWritesKey(usage: ProjectScriptUsage, key: Key): boolean {
  return usage.ids("write", key.kind).has(key.id) || usage.dynamic(key.kind, "write");
}

/**
 * 자동 플레이 실패 자리(where)의 진행 조건 사슬에 스크립트가 쓰는 값이 끼어 있으면 그 값들을 돌려준다.
 * 사슬: 실패한 이벤트의 페이지·분기 조건 → 그 값을 명령으로 쓰는 이벤트의 조건 → …(깊이 5). 걷기 실패면 그 맵 이벤트들의 조건도 본다
 * (문·철창 이벤트의 페이지가 통행을 정한다). 실패한 이벤트 자체가 스크립트를 돌려 진행을 정해도(스크립트 안 분기) 보류다.
 */
export function scriptGatedFailure(project: Project, where: CommandWhere | undefined, detail: string, usage: ProjectScriptUsage = projectScriptUsage(project)): ScriptGate | undefined {
  if (!usage.scriptCount || !where?.mapId) return undefined;
  const pages = allPages(project);
  const seeds = pages.filter((page) => page.map?.id === where.mapId && (WALK_FAILURE.test(detail) || page.event?.id === where.eventId));
  const hits = new Map<string, Key>();
  let dynamic = false;
  let failedEventScript = false;
  const seen = new Set<string>();
  let frontier: Key[] = [];
  for (const page of seeds) {
    const { keys, hasScript } = pageReads(page);
    if (hasScript && page.event?.id === where.eventId) failedEventScript = true;
    frontier.push(...keys);
  }
  for (let depth = 0; depth < MAX_DEPTH && frontier.length; depth += 1) {
    const next: Key[] = [];
    for (const key of frontier) {
      const k = keyOf(key.kind, key.id);
      if (seen.has(k)) continue;
      seen.add(k);
      if (scriptWritesKey(usage, key)) {
        hits.set(k, key);
        if (!usage.ids("write", key.kind).has(key.id)) dynamic = true;
        continue;
      }
      for (const page of writerPages(pages, key)) next.push(...pageReads(page).keys);
    }
    frontier = next;
  }
  if (!hits.size && !failedEventScript) return undefined;
  const label = (key: Key): string => key.kind === "switch" ? `스위치 ${project.switches.find((s) => s.id === key.id)?.name || key.id}`
    : key.kind === "variable" ? `변수 ${project.variables.find((v) => v.id === key.id)?.name || key.id}` : `아이템 ${key.id}`;
  const keys = [...hits.values()].map(label);
  if (failedEventScript && !keys.length) keys.push("실패한 이벤트의 스크립트");
  return { keys, dynamic };
}
