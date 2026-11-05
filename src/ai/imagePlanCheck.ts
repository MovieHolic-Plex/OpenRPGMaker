// ai/imagePlanCheck.ts
// 지은 뒤 도안과 맞대기(2026-11-05 imageplan-follow 6단계): 지은 맵 그림과 도안을 나란히 비전에 보여 도안 요소마다 있음·부분·없음을 받고,
// 「도안 따름」 점수(있음 + ½ 부분 ÷ 요소 수)가 기준(0.8) 아래면 없는 요소만 고치는 후속 요청 한 번을 만든다. 순수 함수만 — 호출은 editor/imagePlanFollowCheck.ts.
import type { WidenSubject } from "./vagueWidenCatalog";
import type { CellMap } from "./imagePlanCells";

export const PLAN_FOLLOW_BAR = 0.8;
export type PlanElementMark = "present" | "partial" | "missing";
export interface PlanElementCheck { readonly element: string; readonly mark: PlanElementMark; readonly where?: string; readonly fix?: string }
export interface PlanFollowCheck { readonly elements: readonly PlanElementCheck[]; readonly layout: "yes" | "partly" | "no"; readonly score: number }

export function planFollowCheckPrompt(subject: WidenSubject, cells: CellMap | undefined): string {
  const marks = cells?.landmarks.map((l) => `${l.label ?? l.kind}(도안 칸 ${l.x},${l.y})`).join(" · ");
  return [
    "첫 그림은 맵 도안, 둘째 그림은 그 도안을 보고 실제로 지은 게임 맵이다. 지은 맵이 도안을 따르는지 엄격하게 본다(더 나은지가 아니라 같은지).",
    `도안의 핵심 요소 5~8개(랜드마크·땅 높이 단·물·윤곽/배치·대칭·특수 물건)를 뽑고${marks ? ` — 이 랜드마크는 반드시 넣는다: ${marks}` : ""}, 지은 맵에서 각각 present(그 자리에 그 모양으로 있다) · partial(있지만 모양·자리·수가 다르다) · missing(없다) 로 적는다.`,
    `missing·partial 이면 fix 에 지은 맵에서 그 요소를 고칠 한 줄 지시(어느 자리에 무엇을)를 적는다.${subject === "dungeon" || subject === "castle" ? " 던전은 방 자리·고리 통로·대칭·물을 본다." : ""}`,
    '{"elements":[{"element":"…","mark":"present|partial|missing","where":"맵 어디","fix":"…"}],"layout":"yes|partly|no"} JSON 하나만.',
  ].join("\n");
}

export function parsePlanFollowCheck(data: Record<string, unknown> | null): PlanFollowCheck | null {
  if (!data || !Array.isArray(data.elements)) return null;
  const elements: PlanElementCheck[] = data.elements.slice(0, 10).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const o = item as Record<string, unknown>;
    const mark = o.mark === "present" || o.mark === "partial" || o.mark === "missing" ? o.mark : null;
    if (!mark || typeof o.element !== "string" || !o.element.trim()) return [];
    return [{ element: o.element.trim(), mark, ...(typeof o.where === "string" && o.where.trim() ? { where: o.where.trim() } : {}), ...(typeof o.fix === "string" && o.fix.trim() ? { fix: o.fix.trim() } : {}) }];
  });
  if (elements.length < 3) return null;
  const layout = data.layout === "yes" || data.layout === "partly" || data.layout === "no" ? data.layout : "partly";
  const score = elements.reduce((s, e) => s + (e.mark === "present" ? 1 : e.mark === "partial" ? 0.5 : 0), 0) / elements.length;
  return { elements, layout, score };
}

/** 기준 아래면 없는·부분 요소만 고치는 후속 요청(사용자 말처럼 입력창으로 보낸다). 기준 이상이면 null. */
export function planFollowFixRequest(check: PlanFollowCheck): string | null {
  if (check.score >= PLAN_FOLLOW_BAR && check.layout !== "no") return null;
  const todo = check.elements.filter((e) => e.mark !== "present");
  if (!todo.length) return null;
  const lines = todo.map((e) => `- ${e.element}(${e.mark === "missing" ? "없음" : "부분"}${e.where ? `, ${e.where}` : ""})${e.fix ? `: ${e.fix}` : ""}`);
  return [
    `[도안 맞대기] 방금 지은 맵이 도안을 ${Math.round(check.score * 100)}% 따른다(기준 ${Math.round(PLAN_FOLLOW_BAR * 100)}%). 아래 요소만 고친다 — 맞은 부분과 맵 전체는 다시 짓지 않는다.`,
    ...lines,
    "칩셋에 맞는 조각이 없으면 비슷한 것으로 때우지 말고 generate_missing_object 로 만든다. 고친 뒤 무엇을 고쳤는지 한 줄씩 말한다.",
  ].join("\n");
}
