// 플레이어가 읽는 글을 청사진에서 짓는 한 곳 — 「현재 목표」 줄 · 잠긴 단계의 안내 · 대사 없는 사람의 서술.
// 규칙: 화면에 나가는 글은 플레이어에게 쓴 칸(대사 lines · goal · 엔딩 closing · playerGoal)과 화면에 뜨는 이름(사람 · 이벤트 · 맵 · 소지품)으로만 짓는다.
// 설계 칸(action · needs · gives · feeling)은 넣지 않는다 — 기획서 말투와 깃발 이름이 목표 줄·대사로 나갔다(2026-11-12 증기의 심장).
import type { GameBlueprintStep } from "@/project/gameBlueprint";
import { eventNoun, josa, sameName } from "./blueprintPathNames";

type StepNames = Pick<GameBlueprintStep, "kind" | "who" | "event" | "place"> & { readonly text?: { readonly goal?: string } };

/** 이 단계가 다음 할 일일 때의 「현재 목표」 줄(마침표 없음). 모델이 쓴 goal 이 먼저, 없으면 단계 종류와 이름으로 짓는다. */
export function stepGoal(step: StepNames): string {
  const own = step.text?.goal?.trim().replace(/[.。!]+$/u, "");
  if (own) return own;
  const who = step.who?.trim();
  const name = eventNoun(step.event);
  if (step.kind === "battle") { const foe = who || name; return `${foe}${josa(foe, "을", "를")} 쓰러뜨리자`; }
  if (step.kind === "puzzle") return `${name}의 번호를 맞히자`;
  if (step.kind === "choice" && who) return `${who}${josa(who, "과", "와")} 이야기하고 마음을 정하자`;
  if ((step.kind === "talk" || step.kind === "choice") && who) return `${who}에게 말을 걸자`;
  return `${name}${josa(name, "을", "를")} 살펴보자`;
}

/**
 * 잠긴 단계의 안내 한 줄 — 이 단계를 여는 앞 단계의 사람·물건을 이름으로 가리킨다(무엇이 «있어야» 하는지 깃발 이름으로 말하지 않는다).
 * here = 잠긴 단계의 맵 이름. 다른 맵이면 그 맵 이름을 앞에 붙인다.
 */
export function lockedHint(prev: StepNames, here: string): string {
  const where = sameName(prev.place, here) ? "" : `${prev.place}의 `;
  const who = prev.who?.trim();
  const name = eventNoun(prev.event);
  if (prev.kind === "battle") { const foe = who || name; return `먼저 ${where}「${foe}」${josa(foe, "을", "를")} 쓰러뜨려야 한다.`; }
  if ((prev.kind === "talk" || prev.kind === "choice") && who) return `먼저 ${where}「${who}」에게 말을 걸어 보자.`;
  return `먼저 ${where}「${name}」${josa(name, "을", "를")} 살펴보자.`;
}

/** 대사를 받지 못한 사람 단계의 서술 한 줄(자리표시) — 이름으로만 짓는다. */
export function wordlessLine(step: StepNames): string {
  const who = step.who?.trim() || eventNoun(step.event);
  return step.kind === "battle" ? `(${who}${josa(who, "이", "가")} 앞을 막아선다.)` : `(${who}${josa(who, "과", "와")} 이야기를 나누었다.)`;
}
