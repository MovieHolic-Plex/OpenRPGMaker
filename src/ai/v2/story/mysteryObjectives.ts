// 추리 사건의 목표 줄 — 용의자를 다 듣기 전 목표 가르기(gateSuspectObjectives), 목표가 가리키는 물건 이름 맞추기(alignObjectiveThings).
import type { GameEvent, GameMap, Project } from "@/project/types";
import { withWhere } from "../judge/objectiveWhere";
import { isObjectiveCommand, objectiveCommand } from "../judge/objectiveCommand";
import { tileLabel } from "../place/cells";
import { Obj, nameOf, walkCommands, resolveSteps, jo, ACCUSE_PROMPT, thingWords } from "./mysteryCaseRead";
import { suspectsHeard } from "./mysteryCaseLines";
import { pendingClueChain } from "./mysteryClues";

const UNHEARD_OBJECTIVE = "아직 이야기 안 한 용의자";

const PENDING_MARK = /아직 못 찾은 단서가 있다|의 이야기를 듣지 않았다/u;

const forkObjectiveText = (c: Obj): string => {
  const then = (c.then ?? []) as Obj[];
  return then.length === 1 && isObjectiveCommand(then[0] as never) ? String(((then[0]!.fields ?? {}) as Obj).message ?? "") : "";
};

/** gateSuspectObjectives·pendingClueChain 이 씌운 갈래인가. */
const isWrapFork = (c: Obj): boolean => c.kind === "fork" && Array.isArray(c.else) && (c.else as Obj[]).length === 1 && (forkObjectiveText(c).includes(UNHEARD_OBJECTIVE) || PENDING_MARK.test(forkObjectiveText(c)));

/** 씌운 갈래를 벗긴 맨 안쪽 목표. */
const innerFinal = (c: Obj): Obj => (isWrapFork(c) ? innerFinal((c.else as Obj[])[0]!) : c);

/**
 * 용의자 대화 페이지의 목표를 「아직 이야기 안 한 용의자」 갈래로 건다 — 「이야기 들음」 스위치가 꺼진 용의자가 남아 있으면 그 사람에게 말을 걸라고,
 * 모두 들었을 때만 원래 목표(지목 자리)로. 끝맺음 맨 끝(fillStaleObjectives·refreshObjectiveRoutes 뒤)에 돈다 — 그 둘이 걸거나 다시 쓰는 목표도 감싼다.
 * 왜(2026-10-29 vm4 argon 추리 재생, 감독 지적): 리노와 이야기하자 다른 둘을 듣기 전인데도 목표가 「「범인 지목」을 찾아가자」였다(지목은 다 들어야 열린다).
 */
export function gateSuspectObjectives(project: Project): string[] {
  const registered = new Set((project.switches ?? []).map((w) => String((w as { id?: string }).id ?? "")));
  const suspects = suspectsHeard(project).filter((s) => registered.has(s.switchId));
  if (suspects.length < 2) return [];
  let gate: { mapId: string; ev: GameEvent } | undefined;
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => { if (!gate && c.kind === "choices" && c.prompt === ACCUSE_PROMPT) gate = { mapId: map.id, ev }; });
  const gateName = gate ? nameOf(gate.ev) : "";
  let wrapped = 0;
  for (const s of suspects) {
    const ev = (project.maps[s.mapId]?.events ?? []).find((e) => e.id === s.ev.id);
    if (!ev) continue;
    const chain = (final0: Obj): Obj[] => suspects.slice().reverse().reduce<Obj[]>((acc, other) => [{
      kind: "fork",
      condition: { kind: "switch", switchId: other.switchId, value: false },
      then: [objectiveCommand(withWhere(project, s.mapId, `${UNHEARD_OBJECTIVE} 「${other.name}」에게 말을 걸어 보자.`, other.ev.id)) as Obj],
      else: acc,
    }], [pendingClueChain(project, s.mapId, final0)]);
    for (const pg of (ev.pages ?? []) as unknown as Obj[]) {
      const cmds = (pg.commands ?? []) as Obj[];
      const at = cmds.findIndex((c) => c.kind === "setSwitch" && c.switchId === s.switchId);
      if (at < 0) continue;
      // 이미 감싼 페이지는 감싼 갈래를 풀어 맨 안쪽 목표를 다시 감싼다(남은 단서 갈래가 새로 붙거나 바뀌게 — 되풀이 안전).
      if (cmds.some(isWrapFork)) {
        const before = JSON.stringify(cmds);
        pg.commands = cmds.flatMap((c) => (isWrapFork(c) ? chain(innerFinal(c)) : [c]));
        if (JSON.stringify(pg.commands) !== before) wrapped += 1;
        continue;
      }
      if (JSON.stringify(cmds).includes(UNHEARD_OBJECTIVE)) continue;
      const chips = cmds.filter((c) => isObjectiveCommand(c as never));
      if (chips.length) pg.commands = cmds.flatMap((c) => chips.includes(c) ? chain(c) : [c]);
      else if (gate) pg.commands = [...cmds.slice(0, at + 1), ...chain(objectiveCommand(withWhere(project, s.mapId, `용의자들의 이야기를 모두 들었다. 「${gateName}」에서 증거를 내밀어 범인을 지목하자.`, gate.ev.id)) as Obj), ...cmds.slice(at + 1)];
      else continue;
      wrapped += 1;
    }
  }
  return wrapped ? [`용의자 대화 목표 ${wrapped}곳: 다 듣기 전엔 「${UNHEARD_OBJECTIVE}」, 다 들은 뒤에만 지목`] : [];
}

const THING_NOUN = "책상|탁자|테이블|식탁|의자|상자|궤짝|금고|서랍|책장|선반|침대|난로|벽난로|게시판|단상|제단|석상|우물|항아리|화분|장롱|옷장|진열장|진열대|계산대|카운터|수납장|보관함|장식장|책꽂이|작업대";

/**
 * 목표 글이 가리키는 물건이 맵에 없으면(이벤트 이름·칩셋 그림 어디에도 없는 꾸민 이름) 실제 대상 이벤트 이름으로 바꾼다 —
 * 지목 목표면 지목 이벤트, 아니면 그 목표를 거는 이벤트 다음 청사진 단계 이벤트. 대상을 모르면 두고, 「」로 감싼 이름은 건드리지 않는다.
 * 왜(2026-10-29 vm6 terra 추리): 목표 「홀의 단서 정리 책상에서 범인을 지목하고 증거를 제시하자」 — 그 책상은 맵 어디에도 없고 지목 칸은 「범인 지목」이었다.
 */
export function alignObjectiveThings(project: Project): string[] {
  const bare = (t: string) => t.replace(/\s+/gu, "");
  const eventNames = Object.values(project.maps).flatMap((m) => (m.events ?? []).map((e) => bare(nameOf(e)))).filter((n) => n.length >= 2);
  const artOn = new Map<string, string[]>();
  const artNames = (map: GameMap): string[] => {
    const hit = artOn.get(map.id);
    if (hit) return hit;
    const seen = new Set<number>();
    const m = map as unknown as Record<string, ArrayLike<number> | undefined>;
    for (const key of ["lowerTiles", "lowerOverlayTiles", "upperTiles", "upperOverlayTiles"]) { const a = m[key]; if (a) for (let i = 0; i < a.length; i += 1) if (a[i]! >= 0) seen.add(a[i]!); }
    const out = [...seen].map((t) => bare(thingWords(tileLabel(project, map, t).replace(/^.*·\s*/u, "")))).filter(Boolean);
    artOn.set(map.id, out);
    return out;
  };
  let gate: { mapId: string; ev: GameEvent } | undefined;
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => { if (!gate && c.kind === "choices" && c.prompt === ACCUSE_PROMPT) gate = { mapId: map.id, ev }; });
  const steps = project.gameBlueprint ? resolveSteps(project) : [];
  const phrase = new RegExp(`((?:[가-힣]+\\s+){1,3})([가-힣]*(?:${THING_NOUN}))(에서|을|를|에게|으로|로|에|앞|옆|위)`, "gu");
  const notes: string[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) for (const pg of ev.pages ?? []) walkCommands(pg.commands, (c) => {
    if (!isObjectiveCommand(c as never)) return;
    const fields = c.fields as Obj;
    const message = String(fields.message);
    const body = message.replace(/\s*\([^()]*\)\s*$/u, "");
    let next = body;
    for (const hit of body.matchAll(phrase)) {
      // 「X의」·조사 붙은 앞말은 꾸밈말이 아니다 — 물건 이름은 그 뒤부터.
      const lead = hit[1]!.trim().split(/\s+/u);
      let cut = lead.length;
      while (cut > 0 && !/(의|에서|에게|을|를|은|는|하고|하여|해서|하면)$/u.test(lead[cut - 1]!)) cut -= 1;
      const words = [...lead.slice(cut), hit[2]!];
      if (words.length < 2) continue; // 「책상」 하나는 그림 아무 책상 — 꾸민 이름만 본다
      const name = bare(words.join(""));
      if (eventNames.some((n) => n.includes(name) || name.includes(n) && n.length >= 3) || artNames(map).some((a) => a.includes(name))) continue;
      const target = /지목|범인/u.test(body) && gate ? gate
        : (() => { const k = steps.findIndex((r) => r.ev.id === ev.id); const r = k >= 0 ? steps[k + 1] : undefined; return r ? { mapId: r.map.id, ev: r.ev } : undefined; })();
      const targetName = target ? nameOf(target.ev) : "";
      if (!targetName || /^ev_/u.test(targetName)) continue;
      const particle = hit[3]!;
      const fixed = /^(을|를)$/u.test(particle) ? jo(targetName, "을/를") : /^(으로|로)$/u.test(particle) ? (() => { const code = targetName.charCodeAt(targetName.length - 1) - 0xac00; const fin = code >= 0 && code < 11172 ? code % 28 : 0; return fin && fin !== 8 ? "으로" : "로"; })() : particle;
      next = next.replace(`${words.join(" ")}${particle}`, `「${targetName}」${fixed}`);
    }
    if (next === body) return;
    fields.message = withWhere(project, map.id, next, gate && next.includes(`「${nameOf(gate.ev)}」`) ? gate.ev.id : undefined);
    notes.push(`목표 「${body}」 → 「${String(fields.message)}」(맵에 없는 물건 이름)`);
  });
  return notes;
}
