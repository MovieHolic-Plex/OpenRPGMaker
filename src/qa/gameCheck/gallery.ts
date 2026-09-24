// 미술관 퍼즐 호러(이브식) 장르 검사 — 「부서지는 생명(꽃잎 체력)」이 게임 규칙으로 성립하나.
//
// 오프라인 QA 도구다(조수 경로의 게이트가 아니다). 전부 경고다.
// 2026-09-24 갤러리 호러 도그푸딩: 기획은 「꽃잎 5장이 체력, 꽃병에 꽂으면 회복, 0장이면 게임오버」인데
// 산출물은 함정마다 `setVariable v_petals -= 1` 만 있었다 — 변수 시작값 0(첫 함정에 -1), 0장을 보는 곳 없음
// (게임 오버 없음), 화면에 꽃잎 표시 없음(기본 HUD). 어떤 막힘 검사도 이걸 못 봤다.

import type { Project } from "@/project/types";
import { briefTextOf } from "./brief";
import { allPages, conditionLeaves, visitAllCommands, visitPageCommands, type CommandVisit } from "./walk";
import type { Finding } from "./types";

const LIFE_BRIEF = /꽃잎|체력|생명|목숨|hp\b|게임\s*오버|게임오버|꽃병/iu;

interface LifeUse { readonly decrements: CommandVisit[]; restores: CommandVisit[]; defeatChecks: number }

function defeatInCommands(commands: unknown): boolean {
  return /"kind":"(gameOver|killPlayer|triggerEnding|ending|returnToTitle)"/u.test(JSON.stringify(commands ?? []));
}

export function checkGallery(project: Project, briefText = briefTextOf(project)): Finding[] {
  if (!LIFE_BRIEF.test(briefText)) return [];
  const uses = new Map<string, LifeUse>();
  const use = (id: string): LifeUse => {
    let entry = uses.get(id);
    if (!entry) { entry = { decrements: [], restores: [], defeatChecks: 0 }; uses.set(id, entry); }
    return entry;
  };
  visitAllCommands(project, (visit) => {
    const command = visit.command;
    if (command.kind !== "setVariable" || typeof command.variableId !== "string") return;
    const op = String(command.op ?? "=");
    const value = typeof command.value === "number" ? command.value : Number.NaN;
    if (op === "-=" || (op === "+=" && value < 0)) use(command.variableId).decrements.push(visit);
    else if (op === "=" || op === "+=") use(command.variableId).restores.push(visit);
  });
  const lifeVariables = [...uses.entries()].filter(([, entry]) => entry.decrements.length > 0);
  if (lifeVariables.length === 0) {
    const hpDamage = /"kind":"changeActorHp"/u.test(JSON.stringify(project.maps)) || /"kind":"changeActorHp"/u.test(JSON.stringify(project.commonEvents ?? []));
    return hpDamage ? [] : [{
      severity: "warning", code: "gallery-no-life-damage",
      message: "기획에 체력(꽃잎·생명·게임오버)이 있는데 체력을 깎는 곳이 없습니다 — 함정·튀어나오는 그림이 아무 대가 없이 지나갑니다. set_life_flower 로 만들고 함정에서 ce_life_damage 를 부르세요.",
    }];
  }
  // 0 이하를 보는 곳: fork 조건, 또는 페이지 조건(변수 <=/==/< …) 뒤에 게임 오버·엔딩.
  const readsLow = (leaf: Record<string, unknown>, id: string): boolean =>
    leaf.kind === "variable" && leaf.variableId === id && typeof leaf.value === "number"
    && ((["<=", "=="].includes(String(leaf.op)) && leaf.value <= 0) || (leaf.op === "<" && leaf.value <= 1));
  visitAllCommands(project, (visit) => {
    if (visit.command.kind !== "fork") return;
    for (const [id, entry] of uses) {
      if (conditionLeaves(visit.command.condition).some((leaf) => readsLow(leaf, id)) && defeatInCommands(visit.command.then)) entry.defeatChecks += 1;
      else if (conditionLeaves(visit.command.condition).some((leaf) => leaf.kind === "variable" && leaf.variableId === id && leaf.op === ">" && leaf.value === 0) && defeatInCommands(visit.command.else)) entry.defeatChecks += 1;
    }
  });
  for (const page of allPages(project)) {
    for (const [id, entry] of uses) {
      if (page.conditions.some((condition) => conditionLeaves(condition).some((leaf) => readsLow(leaf, id)))) {
        let defeat = false;
        visitPageCommands(page, (visit) => { if (defeatInCommands([visit.command])) defeat = true; });
        if (defeat) entry.defeatChecks += 1;
      }
    }
  }
  const hudVariables = new Set((project.system.fieldHud?.widgets ?? []).filter((widget) => widget.enabled !== false && widget.source === "variable").map((widget) => widget.variableId));
  const findings: Finding[] = [];
  for (const [id, entry] of lifeVariables) {
    const name = project.variables.find((variable) => variable.id === id)?.name ?? id;
    const start = project.session?.variables?.[id] ?? 0;
    const first = entry.decrements[0]!;
    const setBeforeDamage = entry.restores.some((visit) => visit.page.trigger?.kind === "auto" || visit.page.trigger?.kind === "parallel");
    if (start <= 0 && !setBeforeDamage) {
      findings.push({ severity: "warning", code: "gallery-life-starts-empty", message: `체력 변수 ${name}(${id}) 의 시작값이 ${start} 입니다 — 첫 피해에 ${start - 1} 이 됩니다. 시작값을 최댓값으로 두세요(set_life_flower 는 자동).`, where: first.where });
    }
    if (entry.defeatChecks === 0) {
      findings.push({ severity: "warning", code: "gallery-life-no-defeat", message: `체력 변수 ${name}(${id}) 을 ${entry.decrements.length}곳에서 깎지만 0 이 됐을 때 게임 오버·엔딩으로 가는 곳이 없습니다 — 체력이 의미가 없습니다.`, where: first.where });
    }
    if (entry.restores.filter((visit) => visit.page.trigger?.kind !== "auto").length === 0) {
      findings.push({ severity: "warning", code: "gallery-life-no-restore", message: `체력 변수 ${name}(${id}) 을 되살리는 곳(꽃병 등)이 없습니다.`, where: first.where });
    }
    if (!hudVariables.has(id)) {
      findings.push({ severity: "warning", code: "gallery-life-not-shown", message: `체력 변수 ${name}(${id}) 이 화면(HUD)에 보이지 않습니다 — 플레이어는 꽃잎이 몇 장 남았는지 모릅니다.`, where: first.where });
    }
  }
  return findings;
}
