import { acceptanceRecord, parseAcceptanceCriteria, type AcceptanceCriterion } from "./assistantAcceptance";
import { ACCEPTANCE_CRITERIA_SCHEMA } from "./assistantAcceptanceTools";
import { extractJsonObject, type IntentFacts } from "./intentDeclaration";

export interface RequestRequirement {
  readonly text: string;
  readonly criteria: readonly AcceptanceCriterion[];
}

// Independent of the planner and its selected work. The model owns language;
// the host owns IDs, provenance, execution and the mandatory denominator.
export const REQUEST_COVERAGE_AUDIT = `REQUEST_COVERAGE_AUDIT
Extract EVERY obligation from the original user request, independently of any work plan.
Return {"requirements":[{"text":"exact contiguous quote from the request","criteria":[...]}],"clarifies":[{"requirementId":"existing unresolved requirement ID","text":"exact clarification quote"}]}.
Split independent obligations, including quantities, initial state, exclusions, conditions and unresolved decisions. Do not silently omit unsupported or negative clauses.
Quote complete sentences/clauses including linking words: EVERY word of the request must belong to a requirements or clarifies quote. The host retains all unquoted text as unverified. Quotes must occur uniquely in the request; expand short ambiguous quotes. This is coverage accounting, not permission to treat prose as proof.
For each obligation choose real criteria from the schema below. Purchases MUST use shopPurchase; NPC grants MUST use npcReward with all grants and oneTime; travel out and back MUST use mapRoundTrip. Database record property changes (enemy stats, actor/skill/item fields…) MUST use dbRecordValues with the exact collection, the existing record ID and dotted field paths — it proves stored values only, so runtime combat behavior still needs functionalUnresolved. A clause that forbids other changes to the same database record MUST use projectPreserve with those edited fields as its dbRecordValues allowance. Never substitute event counts, tool success, images or targetChange for functional behavior.
Use actual supplied IDs or exact requested names, never invented IDs. Preserve known fields in functionalUnresolved.expectations when incomplete, but never substitute an unrelated supported behavior for an unsupported clause. If ANY part of a clause has no exact evaluator, include functionalUnresolved with that clause and the missing check as its reason, even alongside supported criteria. Initial state and conditional or negative behavior are not proven by purchase deltas or static map checks.
The requirements array must be nonempty for authoring. For a clarification, put the existing unresolved ID in clarifies instead of duplicating its original obligation; still extract any NEW obligations. Empty requirements is allowed only when all work is clarification of supplied IDs. Questions and greetings are classified before this call.
No executable tests, success flags, optional requirements, withdrawals or planner decisions.
Criteria schema: ${JSON.stringify(ACCEPTANCE_CRITERIA_SCHEMA)}`;

export function unresolvedRequestCoverage(reason: string): readonly RequestRequirement[] {
  return [{ text: "Request coverage unverified", criteria: [{ kind: "functionalUnresolved", reason }] }];
}

/** Malformed/empty extraction never becomes a vacuously satisfied contract. */
export function parseRequestCoverage(raw: string, facts: IntentFacts, refinementIds: readonly string[]): readonly RequestRequirement[] {
  return parseRequestCoverageResult(raw, facts, refinementIds).requirements;
}

/** Keep extraction failure distinct from a valid audit declaring unsupported work. */
export function parseRequestCoverageResult(raw: string, facts: IntentFacts, refinementIds: readonly string[]): {
  readonly requirements: readonly RequestRequirement[];
  readonly error?: string;
} {
  const failed = (error: string) => ({ requirements: unresolvedRequestCoverage(error), error });
  let value: unknown;
  try { value = JSON.parse(extractJsonObject(raw) ?? ""); } catch { return failed("Request coverage extraction was not JSON"); }
  if (!acceptanceRecord(value) || !Array.isArray(value.requirements)) return failed("Request coverage extraction omitted requirements");
  const clarifies = value.clarifies ?? [];
  const covered = new Uint8Array(facts.userText.length);
  const link = (text: unknown): text is string => {
    if (typeof text !== "string" || !text.trim()) return false;
    const start = facts.userText.indexOf(text);
    if (start < 0 || start !== facts.userText.lastIndexOf(text)) return false;
    covered.fill(1, start, start + text.length);
    return true;
  };
  if (!Array.isArray(clarifies) || clarifies.some(entry => !acceptanceRecord(entry) || typeof entry.requirementId !== "string"
    || !refinementIds.includes(entry.requirementId) || !facts.unresolvedFunctional?.some(requirement => requirement.requirementId === entry.requirementId)
    || !link(entry.text))) {
    return failed("Request coverage claimed an unrecognized clarification");
  }
  if (value.requirements.length === 0 && clarifies.length === 0) return failed("Request coverage extraction was empty");
  let error: string | undefined;
  const requirements: RequestRequirement[] = value.requirements.map(entry => {
    if (!acceptanceRecord(entry) || !link(entry.text)) {
      error = "Extracted requirement is not linked to an exact original request clause";
      return unresolvedRequestCoverage(error)[0];
    }
    const criteria = parseAcceptanceCriteria(entry.criteria);
    if (!criteria) error = "Request coverage extraction included invalid criteria";
    return { text: entry.text, criteria: criteria ?? [{ kind: "functionalUnresolved" as const, reason: `No supported check for requested clause: ${entry.text}` }] };
  });
  // Structural span coverage only. No keyword/grammar planner, inferred targets,
  // or claim that a model-selected criterion proves the meaning of its quote.
  let gap = "";
  for (let index = 0; index <= facts.userText.length; index++) {
    if (index < covered.length && !covered[index]) gap += facts.userText[index];
    else if (gap) {
      if ([...gap].some(char => char.trim() && !".,;:!?".includes(char))) requirements.push({ text: gap.trim(),
        criteria: [{ kind: "functionalUnresolved", reason: `Unassessed original request text: ${gap.trim()}` }] });
      gap = "";
    }
  }
  return { requirements, ...(error ? { error } : {}) };
}
