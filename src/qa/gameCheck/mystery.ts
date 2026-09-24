// 추리 게임 장르 검사 — 「끝까지 갈 수 있나」 다음 질문, 「추리가 성립하나」 를 데이터로 짚는다.
//
// 오프라인 QA 도구다(조수 경로의 게이트가 아니다). 전부 경고다.
// 2026-09-23~24 추리 도그푸딩에서 찾은 것:
//   - 증거를 한 번도 모으지 않고 시작 3칸 옆 NPC 에게 말 걸고 두 번 고르면 진엔딩이었다(엔딩 페이지에 조건 없음).
//   - 오답 결말을 기획했는데 엔딩이 하나뿐이거나, 오답 엔딩으로 가는 길이 막혀 있었다.
// 모든 엔딩을 걷는 자동 플레이(autoPlay 「다른 엔딩 …」)가 오답 엔딩 도달을 본다. 여기서는 설계 결함만 본다.

import type { Project } from "@/project/types";
import { briefTextOf } from "./brief";
import { endingGoal, planCriticalPath } from "./autoPlay";
import { allPages, visitPageCommands, type CommandVisit } from "./walk";
import type { Finding } from "./types";

const MYSTERY = /추리|탐정|범인|용의자|살인|독살|사건의 진상|murder|detective|whodunit|culprit|suspect/iu;
const WRONG_ENDING = /오답|틀린|배드|억울|오판|엉뚱한|wrong|bad ending/iu;

export function isMysteryProject(project: Project, briefText = briefTextOf(project)): boolean {
  return MYSTERY.test(briefText) || project.database.items.some((item) => item.id.startsWith("item_mystery_"));
}

export function checkMystery(project: Project, briefText = briefTextOf(project)): Finding[] {
  if (!isMysteryProject(project, briefText)) return [];
  const findings: Finding[] = [];
  const endings: CommandVisit[] = [];
  for (const page of allPages(project)) {
    if (!page.map || !page.event) continue;
    visitPageCommands(page, (visit) => { if (visit.command.kind === "triggerEnding" || visit.command.kind === "ending") endings.push(visit); });
  }
  if (endings.length === 0) return findings;
  const endingIds = new Set(endings.map((visit) => String(visit.command.endingId ?? visit.command.title ?? "")));
  if (WRONG_ENDING.test(briefText) && endingIds.size < 2) {
    findings.push({ severity: "warning", code: "mystery-single-ending", message: `기획은 틀린 지목의 결말을 말하는데 엔딩이 ${endingIds.size}종뿐입니다 — 오답 지목이 정답과 같은 결말이거나 결말 없이 끝납니다.` });
  }
  for (const visit of endings) {
    const plan = planCriticalPath(project, visit, endingGoal(visit));
    // 사슬이 엔딩 하나뿐 = 어떤 증거·스위치도 없이 그 이벤트에 말만 걸면 엔딩이다.
    if (plan.goals.length === 1 && plan.unresolved.length === 0) {
      findings.push({
        severity: "warning", code: "mystery-ending-unconditioned",
        message: `엔딩 ${String(visit.command.endingId ?? visit.command.title ?? "(자동)")} 은 증거·조사 없이 바로 닿습니다 — '${visit.where.eventName ?? visit.where.eventId}' 에게 말 걸고 고르기만 하면 사건이 끝납니다. 지목 페이지에 증거(아이템·스위치) 조건을 거세요.`,
        where: visit.where,
      });
    }
  }
  const itemGated = allPages(project).some((page) => JSON.stringify(page.conditions).includes("item"));
  let presents = false;
  for (const page of allPages(project)) visitPageCommands(page, (visit) => { if (visit.command.kind === "presentItem") presents = true; });
  if (!itemGated && !presents) {
    findings.push({ severity: "warning", code: "mystery-no-evidence", message: "추리 기획인데 증거(아이템)를 조건으로 거는 페이지도, 증거 제시(presentItem)도 없습니다 — 단서가 진행에 쓰이지 않습니다." });
  }
  return findings;
}
