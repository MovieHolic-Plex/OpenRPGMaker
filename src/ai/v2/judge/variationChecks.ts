// 변주 카드의 구조·사건이 게임에 실제로 들어갔나 — 카드가 이름 댄 장치(decks.ts AxisOption.tools)와 순서 제약을 저장 문서에서 센다.
//
// 왜(2026-11-26 variant-remeasure 호러 판별): 구조 축 실패 넷 중 «도구 없음»은 0 — 도구를 찾지 않았거나(낮과 밤 → configure_time_system 미사용)
// 설계에서 순서를 놓쳤다(«층을 내려간다» 인데 마지막이 위층 예배당, «사흘» 인데 날짜 단계 없음). 모델이 «됐다»고 해도 끝맺음 관문이 짚게 한다.
// 순수 함수 — 카드는 요청 시작 저장본과 프로젝트 열쇠로 다시 뽑는다(같은 씨앗은 같은 카드).
import type { Project } from "@/project/types";
import { gameVariation } from "../request/world";
import { tagged, type Finding } from "./finding";

const json = (v: unknown): string => JSON.stringify(v ?? null);

/** 층 이름 → 높이(지하 N층 = -N, N층 = N). 층 낱말이 없으면 undefined. */
export function floorOf(place: string): number | undefined {
  const under = /(?:지하|B)\s*(\d+)\s*층?/u.exec(place);
  if (under) return -Number(under[1]);
  if (/지하/u.test(place)) return -1;
  const up = /(\d+)\s*층/u.exec(place);
  return up ? Number(up[1]) : undefined;
}

/** 날 표시(1일·첫째 날·둘째 날·셋째 날) → 순번. */
const DAY_WORDS: readonly [RegExp, number][] = [[/(?:^|\D)1\s*일(?:째)?|첫\s*(?:째\s*)?날/u, 1], [/(?:^|\D)2\s*일(?:째)?|둘\s*째\s*날|이튿날/u, 2], [/(?:^|\D)3\s*일(?:째)?|셋\s*째\s*날|사흘\s*째/u, 3]];
export function dayOf(text: string): number | undefined {
  for (const [re, n] of DAY_WORDS) if (re.test(text)) return n;
  return undefined;
}

/** 카드가 이름 댄 장치가 저장 문서에 있나(도구별). 표식을 모르는 도구는 undefined — 세지 않는다. */
function deviceBuilt(tool: string, after: Project): boolean | undefined {
  const events = Object.values(after.maps).flatMap((m) => m.events ?? []);
  const all = json(events) + json(after.commonEvents);
  switch (tool) {
    case "configure_time_system": return !!after.system?.timeSystem && /"kind":"timePhase"/u.test(all);
    case "make_chase_scene": return /"chase"/u.test(json(events));
    case "author_party_split": return /"kind":"storeParty"/u.test(all);
    case "stage_map_reveal": return /"kind":"changeTile"/u.test(all);
    default: return undefined;
  }
}

/** 끝맺음 관문 문제 — 게임 하나를 짓는 턴에서, 청사진이 생긴 뒤에만. key = 프로젝트 열쇠(카드 씨앗). */
export function variationStructureProblems(before: Project, after: Project, task: string, key: string | undefined): Finding[] {
  const bp = after.gameBlueprint;
  if (!bp?.steps.length || !key) return [];
  const v = gameVariation(before, key, task).variation;
  if (!v) return [];
  const problems: Finding[] = [];
  const structure = v.structure;
  if (structure?.tools?.length) {
    const counted = structure.tools.map((tool) => deviceBuilt(tool, after)).filter((built): built is boolean => built !== undefined);
    if (counted.length && !counted.some(Boolean)) {
      problems.push(tagged("game", "변주 구조", `카드 구조 «${structure.ko}» 를 짓는 장치가 게임에 없다 — ${structure.tools.join(", ")} 로 짓는다.`));
    }
  }
  if (structure?.order === "descend") {
    const floors = bp.steps.map((step) => floorOf(step.place));
    const named = floors.filter((f): f is number => f !== undefined);
    const up = floors.findIndex((f, i) => i > 0 && f !== undefined && floors.slice(0, i).some((g) => g !== undefined && g < f));
    if (named.length < 2 || up >= 0) {
      problems.push(tagged("game", "변주 구조", `카드 구조 «${structure.ko}» 인데 청사진 걸음의 place 가 층을 내려가지 않는다(${bp.steps.map((s) => s.place).join(" → ")}). 장소 이름에 층을 붙이고(1층 → 지하 1층 → 지하 2층) 뒤 걸음일수록 낮은 층에 둔 뒤 write_blueprint 를 다시 부른다.`));
    }
  }
  if (v.event?.order === "days") {
    const days = bp.steps.map((step) => dayOf(`${step.place} ${step.action} ${step.goal ?? ""}`));
    const distinct = new Set(days.filter((d): d is number => d !== undefined));
    const back = days.findIndex((d, i) => i > 0 && d !== undefined && days.slice(0, i).some((e) => e !== undefined && e > d));
    if (distinct.size < 2 || back >= 0) {
      problems.push(tagged("game", "변주 사건", `카드 사건 «${v.event.ko}» 인데 청사진 걸음에 날 단계가 없다. 걸음 action 이나 goal 을 «첫째 날 → 둘째 날 → 셋째 날» 순으로 나누어 write_blueprint 를 다시 부른다.`));
    }
  }
  return problems;
}
