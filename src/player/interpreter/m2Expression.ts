import type { PlaySessionLike } from "@/project/sessionRuntimeTypes"
import { sessionQueryValue } from "@/project/conditionActorQueries";

type Token = number | string;

const OPERATORS: Readonly<Record<string, { readonly precedence: number; readonly apply: (left: number, right: number) => number }>> = {
  "+": { precedence: 1, apply: (left, right) => left + right },
  "-": { precedence: 1, apply: (left, right) => left - right },
  "*": { precedence: 2, apply: (left, right) => left * right },
  "/": { precedence: 2, apply: (left, right) => (right === 0 ? 0 : left / right) },
};

export function evaluateM2Expression(expression: string, session: PlaySessionLike): number {
  const output: Token[] = [];
  const operators: string[] = [];
  for (const token of tokenizeExpression(expression)) {
    if (typeof token === "number") {
      output.push(token);
    } else if (isIdentifier(token)) {
      output.push(resolveIdentifier(token, session));
    } else if (token === "(") {
      operators.push(token);
    } else if (token === ")") {
      while (operators.length > 0 && operators[operators.length - 1] !== "(") output.push(operators.pop() ?? "");
      if (operators[operators.length - 1] === "(") operators.pop();
    } else if (OPERATORS[token]) {
      while (shouldPopOperator(operators[operators.length - 1], token)) output.push(operators.pop() ?? "");
      operators.push(token);
    }
  }
  while (operators.length > 0) output.push(operators.pop() ?? "");
  return evaluatePostfix(output);
}

function tokenizeExpression(expression: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < expression.length) {
    const char = expression[index] ?? "";
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      const match = /^[0-9]+(?:\.[0-9]+)?/.exec(expression.slice(index));
      if (!match) return tokens;
      tokens.push(Number(match[0]));
      index += match[0].length;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(expression.slice(index));
      if (!match) return tokens;
      tokens.push(match[0]);
      index += match[0].length;
      continue;
    }
    if (char in OPERATORS || char === "(" || char === ")") tokens.push(char);
    index += 1;
  }
  return tokens;
}

function shouldPopOperator(top: string | undefined, next: string): boolean {
  if (!top || top === "(") return false;
  return (OPERATORS[top]?.precedence ?? 0) >= (OPERATORS[next]?.precedence ?? 0);
}

function evaluatePostfix(tokens: readonly Token[]): number {
  const stack: number[] = [];
  for (const token of tokens) {
    if (typeof token === "number") {
      stack.push(token);
      continue;
    }
    const operator = OPERATORS[token];
    if (!operator) continue;
    const right = stack.pop() ?? 0;
    const left = stack.pop() ?? 0;
    stack.push(operator.apply(left, right));
  }
  return stack.pop() ?? 0;
}

function isIdentifier(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(token);
}

const EXPRESSION_BUILTINS: Readonly<Record<string, { query: string; target: string }>> = {
  leaderLevel: { query: "actorLevel", target: "leader" },
  leaderHp: { query: "actorHp", target: "leader" },
  leaderMp: { query: "actorMp", target: "leader" },
  leaderHpPercent: { query: "actorHpPercent", target: "leader" },
  partySize: { query: "partySize", target: "" },
  playtime: { query: "playtimeSeconds", target: "" },
  steps: { query: "steps", target: "" },
  clearCount: { query: "clearCount", target: "" },
};

function resolveIdentifier(identifier: string, session: PlaySessionLike): number {
  if (identifier === "gold") return session.gold;
  if (identifier === "playerX") return session.x;
  if (identifier === "playerY") return session.y;
  // 명작 공백 G1: leaderLevel·leaderHp·partySize 등 — Data Query 와 같은 해석기.
  const builtin = EXPRESSION_BUILTINS[identifier];
  if (builtin) return sessionQueryValue(session, builtin.query, builtin.target);
  return session.variables[identifier] ?? 0;
}
