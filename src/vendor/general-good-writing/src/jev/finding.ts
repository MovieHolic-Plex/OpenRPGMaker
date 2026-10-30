import { assertNever } from "../detect.ts";
import { field, isJsonObject, type Json, type JsonObject } from "../text/json.ts";
import { roundHalfEven } from "../text/num.ts";
import { type Answers, JevError } from "./client.ts";
import { flagOptions, type Question, ROUTE_MARGIN } from "./questions.ts";

export type Finding = {
  readonly layer: string;
  readonly question: string;
  readonly value: number;
  readonly text: string;
  readonly where: string;
  readonly detail: JsonObject;
  readonly advisory: boolean;
  readonly route: string;
};

export type Dismissal = {
  readonly pid: string;
  readonly family: string;
  readonly sentence: string;
  readonly match: string;
  readonly reason: string;
  readonly value: number;
};

type FindingInit = Pick<Finding, "layer" | "question" | "value" | "text" | "where"> &
  Partial<Pick<Finding, "detail" | "advisory" | "route">>;

export function finding(init: FindingInit): Finding {
  return { detail: {}, advisory: false, route: "flag", ...init };
}

/** An answer object is missing a field the question kind requires, or carries it with the wrong type. */
export class MalformedAnswerError extends JevError {
  override readonly name = "MalformedAnswerError";
}

export function answerFor(answers: Answers, id: string): Json {
  const a = answers[id];
  if (a === undefined) throw new MalformedAnswerError(`no answer for question ${id}`);
  return a;
}

function numberField(answer: Json, key: string, fallback?: number): number {
  const v = field(answer, key);
  if (typeof v === "number") return v;
  if (v === undefined && fallback !== undefined) return fallback;
  throw new MalformedAnswerError(`answer field ${key} is not a number`);
}

export function noulOf(answer: Json): number {
  return numberField(answer, "noul");
}

export function noulAt(answers: Answers, id: string): number {
  return noulOf(answerFor(answers, id));
}

export function choiceOf(answer: Json): string {
  const v = field(answer, "choice");
  if (typeof v !== "string") throw new MalformedAnswerError("answer field choice is not a string");
  return v;
}

export function confidenceOf(answer: Json): number {
  return numberField(answer, "confidence", 0);
}

export function probabilitiesOf(answer: Json): ReadonlyMap<string, number> {
  const v = field(answer, "probabilities");
  if (v === undefined) return new Map();
  if (!isJsonObject(v)) throw new MalformedAnswerError("answer field probabilities is not an object");
  return new Map(Object.keys(v).map((k) => [k, numberField(v, k)] as const));
}

export type Evaluation = { readonly hit: boolean; readonly value: number; readonly detail: JsonObject; readonly route: string };

/**
 * A hit is a noul value at or past the threshold, or a flagged choice with enough probability and confidence. A hit
 * within ROUTE_MARGIN of its threshold (or a choice below .5 confidence) routes to `read`, a human look, not a flag.
 */
export function evaluateAnswer(q: Question, answer: Json): Evaluation {
  switch (q.kind) {
    case "noul": {
      const v = noulOf(answer);
      const hit = v >= q.threshold;
      const route = hit ? (v < q.threshold + ROUTE_MARGIN ? "read" : "flag") : "none";
      return { hit, value: v, detail: {}, route };
    }
    case "choice": {
      const choice = choiceOf(answer);
      const conf = confidenceOf(answer);
      const probs = probabilitiesOf(answer);
      const wanted = flagOptions(q);
      const v = wanted.reduce((best, w) => Math.max(best, probs.get(w) ?? 0), wanted.length > 0 ? Number.NEGATIVE_INFINITY : 0);
      const hit = wanted.includes(choice) && v >= q.threshold && conf >= q.minConfidence;
      const route = hit ? (conf < 0.5 || v < q.threshold + ROUTE_MARGIN ? "read" : "flag") : "none";
      return { hit, value: v, detail: { choice, confidence: roundHalfEven(conf, 2) }, route };
    }
    default:
      return assertNever(q.kind);
  }
}
