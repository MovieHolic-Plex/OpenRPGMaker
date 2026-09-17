import type { Condition, Project } from "@/project/types";

export type ConditionCompileResult = {
  readonly condition: Condition;
  readonly warnings: readonly string[];
  readonly matched: readonly string[];
};

/**
 * Lightweight natural-language → Condition AST compiler for AI / quick authoring.
 * Prefer structured tool args when available; this is a best-effort Korean/English sketch.
 */
export function compileConditionFromText(text: string, project: Project): ConditionCompileResult {
  const raw = text.trim();
  const warnings: string[] = [];
  const matched: string[] = [];
  if (!raw) {
    return {
      // 비운 스위치 조건 — 첫 스위치(대개 퀘스트 진행 스위치)에 묶지 않는다. 호출자가 고르게 한다.
      condition: { kind: "switch", switchId: "", value: true },
      warnings: ["빈 문장 → 스위치를 고르지 않은 조건"],
      matched: [],
    };
  }

  // Split weak OR / AND (Korean + English). Not a full parser — nested groups limited.
  const orParts = splitKeep(raw, /\s*(?:\bOR\b|\b또는\b|\|)\s*/i);
  if (orParts.length > 1) {
    const children = orParts.map((part) => compileLeafOrAnd(part, project, warnings, matched));
    return { condition: { kind: "any", conditions: children }, warnings, matched };
  }
  return {
    condition: compileLeafOrAnd(raw, project, warnings, matched),
    warnings,
    matched,
  };
}

function compileLeafOrAnd(
  text: string,
  project: Project,
  warnings: string[],
  matched: string[],
): Condition {
  const andParts = splitKeep(text, /\s*(?:\bAND\b|\b그리고\b|&)\s*/i);
  if (andParts.length > 1) {
    return {
      kind: "all",
      conditions: andParts.map((part) => compileLeaf(part, project, warnings, matched)),
    };
  }
  return compileLeaf(text, project, warnings, matched);
}

function compileLeaf(
  text: string,
  project: Project,
  warnings: string[],
  matched: string[],
): Condition {
  const t = text.trim();
  const notMatch = t.match(/^(?:NOT|아님|아니|!)\s+(.+)$/i);
  if (notMatch?.[1]) {
    matched.push("not");
    return { kind: "not", condition: compileLeaf(notMatch[1], project, warnings, matched) };
  }

  // time phases
  if (/(밤|night)/i.test(t)) {
    matched.push("timePhase:night");
    return { kind: "timePhase", phase: "night" };
  }
  if (/(아침|morning)/i.test(t)) {
    matched.push("timePhase:morning");
    return { kind: "timePhase", phase: "morning" };
  }
  if (/(저녁|evening)/i.test(t)) {
    matched.push("timePhase:evening");
    return { kind: "timePhase", phase: "evening" };
  }
  if (/(낮|daytime|\bday\b)/i.test(t)) {
    matched.push("timePhase:day");
    return { kind: "timePhase", phase: "day" };
  }

  // seasons
  if (/(봄|spring)/i.test(t)) {
    matched.push("season:spring");
    return { kind: "season", season: "spring" };
  }
  if (/(여름|summer)/i.test(t)) {
    matched.push("season:summer");
    return { kind: "season", season: "summer" };
  }
  if (/(가을|fall|autumn)/i.test(t)) {
    matched.push("season:fall");
    return { kind: "season", season: "fall" };
  }
  if (/(겨울|winter)/i.test(t)) {
    matched.push("season:winter");
    return { kind: "season", season: "winter" };
  }

  // friendship: 호감 100 / friendship >= 50
  const friend = t.match(/(?:호감(?:도)?|friendship)\s*(?:>=|≥|이상)?\s*(\d+)/i);
  if (friend?.[1]) {
    matched.push("friendshipAtLeast");
    return { kind: "friendshipAtLeast", value: Number(friend[1]) || 0 };
  }

  // gold
  const gold = t.match(/(?:소지금|골드|gold)\s*(>=|<=|>|<|==|!=)?\s*(\d+)/i);
  if (gold?.[2]) {
    matched.push("gold");
    const op = (gold[1] as ConditionGoldOp | undefined) ?? ">=";
    return { kind: "gold", op, amount: Number(gold[2]) || 0 };
  }

  // switch by name / ON OFF
  const wantOn = !/(off|꺼|거짓|false)/i.test(t);
  const switchHit = findNamed(project.switches, t);
  if (switchHit) {
    matched.push(`switch:${switchHit.id}`);
    return { kind: "switch", switchId: switchHit.id, value: wantOn };
  }

  // variable compare: 점수 >= 3
  const varCmp = t.match(/(.+?)\s*(>=|<=|==|!=|>|<)\s*(-?\d+)\s*$/);
  if (varCmp?.[1] && varCmp[2] && varCmp[3]) {
    const hit = findNamed(project.variables, varCmp[1]);
    if (hit) {
      matched.push(`variable:${hit.id}`);
      return {
        kind: "variable",
        variableId: hit.id,
        op: varCmp[2] as "==" | ">=" | "<=" | ">" | "<" | "!=",
        value: Number(varCmp[3]) || 0,
      };
    }
  }
  const varHit = findNamed(project.variables, t);
  if (varHit) {
    matched.push(`variable:${varHit.id}`);
    return { kind: "variable", variableId: varHit.id, op: ">=", value: 1 };
  }

  // item possession
  const itemHit = findNamed(project.database.items, t);
  if (itemHit) {
    matched.push(`item:${itemHit.id}`);
    const present = !/(없|미소지|missing|without)/i.test(t);
    return { kind: "item", itemId: itemHit.id, present };
  }

  warnings.push(`해석 실패 → 스위치를 고르지 않은 조건: "${t}"`);
  return { kind: "switch", switchId: "", value: true };
}

type ConditionGoldOp = Extract<import("@/project/types").Condition, { kind: "gold" }>["op"];

function findNamed(
  list: readonly { readonly id: string; readonly name: string }[],
  text: string,
): { id: string; name: string } | undefined {
  const needle = text.trim().toLowerCase();
  if (!needle) return undefined;
  // exact id
  const byId = list.find((entry) => entry.id.toLowerCase() === needle);
  if (byId) return byId;
  // name includes
  const byName = list.find((entry) => entry.name.trim() && needle.includes(entry.name.trim().toLowerCase()));
  if (byName) return byName;
  // reverse includes
  return list.find((entry) => entry.name.trim() && entry.name.trim().toLowerCase().includes(needle));
}

function splitKeep(text: string, re: RegExp): string[] {
  return text.split(re).map((part) => part.trim()).filter(Boolean);
}
