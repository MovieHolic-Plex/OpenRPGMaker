// 들어가는 단계는 들어가면 끝난다 — 「동굴 입구: 열쇠로 잠긴 입구를 열고 들어간다」가 맵 안 깊은 곳의 투명 칸(눌러야 끝남)이면,
// 그 맵으로 옮기는 문이 이미 같은 조건(열쇠)으로 잠겨 있을 때 그 문을 지나는 순간 단계의 «하는» 명령(스위치·아이템·목표)을 한 번 돈다.
// 왜(2026-10-29 vm8 argon jrpg): 「동굴 입구」 단계 칸이 동굴 안 마왕 옆 (7,8) 투명 칸이었다. 판정자는 열쇠로 마을 동굴 문 (32,5)를 지나 들어가
// 보스를 이겼는데, 마왕은 「먼저 「동굴 입구」를 마쳐야 한다」만 말하고 목표는 「잠긴 동굴 입구를 열고 들어간다」에 멈춰 엔딩이 안 났다.
// 규칙: 이름·행동이 들어가기(입구·진입·들어간다)인 청사진 단계 이벤트가 모든 페이지 투명·이동 없음이고, 조건 붙은 «하는» 페이지(스위치를 켬)가 있을 때,
// 다른 맵에서 이 맵으로 옮기는 이벤트 페이지 중 그 조건을 모두 가진 것(이미 같은 것으로 잠긴 문 — 사본 포함)의 이동 앞에
// 「아직 안 했으면(단계 마침 스위치 꺼짐)」 갈래로 하는 페이지 명령을 넣는다. 결정적·되풀이 안전(맨 앞에 같은 갈래가 있으면 다시 넣지 않는다).
import type { FinishStage } from "../types";
import type { GameMap, Project } from "@/project/types";
import { resolveSteps } from "../../mysteryCase";

const ENTRY = /입구|진입|들어가|들어간|입장|entrance|enter/iu;
type Cmd = Record<string, unknown>;
type Page = { conditions?: unknown[]; commands?: Cmd[]; graphic?: { transparent?: boolean; sprite?: unknown } };

function transfersTo(cmds: unknown, mapId: string): boolean {
  if (Array.isArray(cmds)) return cmds.some((c) => transfersTo(c, mapId));
  if (!cmds || typeof cmds !== "object") return false;
  const r = cmds as Cmd;
  if (r.kind === "transfer" && r.mapId === mapId) return true;
  return Object.values(r).some((v) => v && typeof v === "object" && transfersTo(v, mapId));
}
const condKey = (c: unknown) => { const r = c as { kind?: string; switchId?: string; itemId?: string; value?: unknown; present?: unknown }; return `${r.kind}:${r.switchId ?? r.itemId ?? ""}:${String(r.value ?? r.present ?? true)}`; };

export function arrivalCompletesEntrySteps(project: Project): string[] {
  if (!project.gameBlueprint) return [];
  const notes: string[] = [];
  for (const r of resolveSteps(project)) {
    if (!ENTRY.test(`${r.step.event} ${r.step.action}`)) continue;
    const pages = (r.ev.pages ?? []) as unknown as Page[];
    if (!pages.length || pages.some((p) => p.graphic && !p.graphic.transparent && p.graphic.sprite) || transfersTo(pages.map((p) => p.commands), r.map.id) || JSON.stringify(pages).includes('"transfer"')) continue;
    const doing = pages.find((p) => (p.conditions ?? []).length > 0 && (p.commands ?? []).some((c) => c.kind === "setSwitch" && c.value === true));
    if (!doing) continue;
    const done = (doing.commands ?? []).filter((c) => c.kind === "setSwitch" && c.value === true).map((c) => String(c.switchId)).at(-1)!;
    const need = new Set((doing.conditions ?? []).map(condKey));
    const body = (doing.commands ?? []).filter((c) => c.kind !== "transfer");
    let hit = 0;
    for (const map of Object.values(project.maps) as GameMap[]) {
      if (map.id === r.map.id) continue;
      let touched = false;
      const events = map.events.map((ev) => {
        const evPages = (ev.pages ?? []) as unknown as Page[];
        if (!evPages.some((p) => transfersTo(p.commands, r.map.id))) return ev;
        const next = evPages.map((p) => {
          const first = (p.commands ?? [])[0] as { kind?: string; condition?: { switchId?: string } } | undefined;
          if (!transfersTo(p.commands, r.map.id) || (first?.kind === "fork" && first.condition?.switchId === done)) return p;
          const have = new Set((p.conditions ?? []).map(condKey));
          if (![...need].every((k) => have.has(k))) return p;
          touched = true;
          // 갈래 안에 이동까지 넣는다 — 목표 줄이 「이동 뒤 맵」에서 걸린 것으로 읽힌다(objectiveLandings). 이미 했으면 원래 명령 그대로.
          const fork = { kind: "fork", condition: { kind: "switch", switchId: done, value: false }, then: [...structuredClone(body), ...structuredClone(p.commands ?? [])], else: structuredClone(p.commands ?? []) };
          return { ...p, commands: [fork] };
        });
        return touched ? { ...ev, pages: next as unknown as typeof ev.pages } : ev;
      });
      if (touched) { map.events = events; hit += 1; notes.push(`「${r.step.event}」 단계는 ${map.name ?? map.id} → ${r.map.name ?? r.map.id} 문을 지나면 끝난다`); }
    }
    void hit;
  }
  return notes;
}

export const stage: FinishStage = {
  id: "entry-steps-on-arrival", phase: "assembly", order: 285,
  run({ env, assembled }) {
    try { assembled.push(...arrivalCompletesEntrySteps(env.ctx.project)); }
    catch { /* 들어가기 단계 마침 실패는 끝맺음을 깨지 않는다 */ }
  },
};
