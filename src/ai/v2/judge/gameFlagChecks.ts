// 게임 내용 검사 — 깃발: 스위치·변수·셀프 스위치의 선언·켜기·읽기가 맞물리나.
import { tagged, type Finding } from "./finding";
import { lostLinks } from "./storyFlowChecks";
import { type GameCheck, Obj, allCommands, flatConditions, readsOf } from "./gameCheckReads";

/** 깃발 — 선언 안 한 스위치·변수, 켜기만 하고 아무도 안 읽는 것, 고쳐 쓰다 끊긴 고리. */
export function flagChecks({ before, after, changed, cmds }: GameCheck): Finding[] {
  const problems: Finding[] = [];
  // 5) 깃발: 선언 안 한 스위치·변수, 켜기만 하고 아무도 안 읽는 것(「이미 했다」 페이지가 빠졌다), 선언만 하고 안 쓰는 것.
  const declaredSw = new Set(after.switches.map((s) => s.id)), declaredVar = new Set(after.variables.map((v) => v.id));
  const reads = readsOf(after);
  const setSw = new Map<string, string>(), setVar = new Map<string, string>(), usedSw = new Set<string>(), usedVar = new Set<string>();
  for (const r of cmds) {
    if (r.cmd.kind === "setSwitch" && typeof r.cmd.switchId === "string") setSw.set(r.cmd.switchId, r.ev.name);
    if (r.cmd.kind === "setVariable" && typeof r.cmd.variableId === "string") setVar.set(r.cmd.variableId, r.ev.name);
    for (const c of [...flatConditions(r.cmd.condition)]) { if (typeof c.switchId === "string") usedSw.add(c.switchId); if (typeof c.variableId === "string") usedVar.add(c.variableId); }
  }
  for (const ev of changed) for (const page of ev.pages) for (const c of flatConditions(page.conditions)) { if (typeof c.switchId === "string") usedSw.add(c.switchId); if (typeof c.variableId === "string") usedVar.add(c.variableId); }
  const undeclared = [...new Set([...setSw.keys(), ...usedSw])].filter((id) => !declaredSw.has(id)).concat([...new Set([...setVar.keys(), ...usedVar])].filter((id) => !declaredVar.has(id)));
  if (undeclared.length) problems.push(tagged("game", "깃발", `선언 안 된 스위치·변수: ${undeclared.slice(0, 6).join(", ")} — declare_story_flag 로 선언하거나 이미 선언된 깃발 id 를 쓴다.`, { variant: "undeclared" }));
  const unread = [...setSw.entries()].filter(([id]) => !reads.switches.has(id));
  if (unread.length) problems.push(tagged("game", "깃발", `켜기만 하고 어떤 페이지·분기도 읽지 않는 스위치: ${unread.slice(0, 5).map(([id, who]) => `${id}(「${who}」)`).join(", ")} — 한 번만 일어나야 하는 관문이면 그 스위치 조건의 «이미 했다» 페이지를 두고, 필요 없는 깃발이면 지운다.`, { variant: "unread-switch" }));
  // 퀘스트 도구가 등록한 진행 변수(var_<key>_progress — 퀘스트 기록이 읽는다)는 조건에서 안 읽어도 쓰는 값이다 —
  // «쓰거나 지운다» 로 돌려보내면 조수가 퀘스트 변수를 지우거나 헛조건을 단다(2026-11-10 Terra 두 판 모두 이 줄을 받았다).
  const questVars = new Set((Array.isArray((after as unknown as Obj).quests) ? ((after as unknown as Obj).quests as Obj[]) : []).map((q) => `var_${String(q?.key ?? q?.id ?? "")}_progress`));
  const unreadVar = [...setVar.entries()].filter(([id]) => !reads.variables.has(id) && !questVars.has(id));
  if (unreadVar.length) problems.push(tagged("game", "깃발", `값만 바꾸고 아무도 읽지 않는 변수: ${unreadVar.slice(0, 5).map(([id, who]) => `${id}(「${who}」)`).join(", ")} — 조건·분기에서 쓰거나 지운다.`, { variant: "unread-variable" }));
  // 고쳐 쓰다 끊긴 고리: 전에는 어떤 이벤트가 켜던(바꾸던·부르던) 스위치·변수·공통 이벤트를 이번 실행 뒤에는 아무도 안 켜는데, 그것을 조건으로 보는
  // 페이지·분기는 남았다 → 그 내용에 영영 닿지 못한다(2026-10-25 조수 단독 게임 G15: 서연 대사를 날마다 다르게 다시 쓰며 「퇴근길에 같이 걸을래요?」
  // 초대가 빠졌고, 걷는 장면은 sw_0005 를 기다리는데 켜는 곳이 사라졌다 — 보고는 「못 한 것 없음」).
  const lost = lostLinks(before, after);
  if (lost.length) problems.push(tagged("game", "끊긴 고리", `이번에 고친 이벤트에서 빠진 명령 때문에 닿을 수 없게 된 내용이 있다: ${lost.slice(0, 4).join(" / ")} — 빠뜨린 명령(초대·스위치 켜기·공통 이벤트 부르기)을 새 페이지에 다시 넣거나, 일부러 없앤 것이면 그 조건 페이지도 지우고 보고에 적는다.`));
  return problems;
}

/** 셀프 스위치와 선언만 한 깃발 — 켰는데 아무 페이지도 안 보거나, 선언하고 어디서도 안 쓴다. */
export function selfSwitchChecks({ before, after, changed }: GameCheck): Finding[] {
  const problems: Finding[] = [];
  const reads = readsOf(after);
  // 셀프 스위치: 켰는데 그 이벤트 어느 페이지도 그 키를 조건으로 안 본다.
  for (const ev of changed) {
    const key = `${ev.mapId === "common" ? "common" : ev.mapId}/${ev.id}`;
    const setKeys = new Set(allCommands(ev).filter((r) => r.cmd.kind === "setSelfSwitch" && r.cmd.value !== false).map((r) => String(r.cmd.key)));
    const seen = reads.selfKeys.get(key) ?? new Set();
    const missing = [...setKeys].filter((k) => !seen.has(k));
    if (missing.length) problems.push(tagged("game", "깃발", `「${ev.name}」(${ev.id}) 이 셀프 스위치 ${missing.join(",")} 를 켜지만 그 조건의 페이지가 없다 — 「이미 했다」 페이지(셀프 스위치 ${missing[0]} 조건)를 더한다.`, { variant: "self-switch", target: { mapId: ev.mapId, eventId: ev.id } }));
  }
  const newDeclared = after.switches.filter((s) => !before.switches.some((b) => b.id === s.id)).map((s) => s.id)
    .concat(after.variables.filter((v) => !before.variables.some((b) => b.id === v.id)).map((v) => v.id));
  if (newDeclared.length) {
    const everywhere = JSON.stringify({ maps: Object.values(after.maps).map((m) => m.events), common: after.commonEvents, endings: after.endings, quests: after.quests });
    // 던전 도구가 적마다 만드는 「처치」 스위치(sw_ev_<맵>_<적>_clear)는 다시 짓기로 그 적이 사라져도 남는다 — 엔진 장부라 사용자 깃발로 세지 않는다.
    const idle = newDeclared.filter((id) => !/^sw_ev_.+_clear$/u.test(id) && !everywhere.includes(`"${id}"`) && !everywhere.includes(`[${id}]`));
    if (idle.length) problems.push(tagged("game", "깃발", `선언만 하고 어디서도 쓰지 않는 깃발: ${idle.slice(0, 6).join(", ")} — 쓰거나 지운다.`, { variant: "unused" }));
  }
  return problems;
}
