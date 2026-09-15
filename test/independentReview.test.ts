import { describe, expect, it } from "vitest";
import { buildIndependentReviewRequest, parseIndependentReview, reviewChanges, type ReviewInput } from "@/ai/independentReview";
import { defaultAiConfig, type ChatResult } from "@/ai/llmClient";
import { ToolVerificationEvidence } from "@/ai/toolVerificationEvidence";
import { startSession } from "@/project/session";
import { createBlankProject } from "@/project/defaults";

const approved = { revision: 7, verdict: "approved", summary: "Inspected", findings: [] };
const response = (value: unknown): ChatResult => ({ message: { role: "assistant", content: JSON.stringify(value) }, finishReason: "stop" });
describe("independent review protocol", () => {
  it.each([null, {}, { ...approved, revision: 6 }, { ...approved, findings: [{}] },
    { ...approved, verdict: "changes_requested" }, { ...approved, verdict: "success" }])("rejects malformed or stale verdict %j", value => {
    expect(() => parseIndependentReview(response(value), 7, [])).toThrow();
  });
  it("rejects executable requests even alongside a valid approval", () => {
    const result = response(approved);
    result.message.tool_calls = [{ id: "bad", type: "function", function: { name: "reset_project", arguments: "{}" } }];
    expect(() => parseIndependentReview(result, 7, [])).toThrow("independent-review-tool-call-rejected");
  });
  it("rejects truncated and malformed responses", () => {
    expect(() => parseIndependentReview({ ...response(approved), finishReason: "length" }, 7, [])).toThrow();
    expect(() => parseIndependentReview({ message: { role: "assistant", content: "not JSON" }, finishReason: "stop" }, 7, [])).toThrow();
  });
  it("reads one narrated verdict but refuses ambiguity and non-verdict objects", () => {
    const prose = (content: string): ChatResult => ({ message: { role: "assistant", content }, finishReason: "stop" });
    const verdict = JSON.stringify(approved);
    expect(parseIndependentReview(prose(`검토 결과 요청대로 반영되었습니다.\n${verdict}\n이상입니다.`), 7, []).status).toBe("approved");
    expect(parseIndependentReview(prose(`Here is my answer:\n\`\`\`json\n${verdict}\n\`\`\`\nThanks.`), 7, []).status).toBe("approved");
    expect(() => parseIndependentReview(prose(`${verdict} or maybe ${JSON.stringify({ ...approved, verdict: "changes_requested" })}`), 7, []))
      .toThrow("independent-review-malformed-json");
    expect(() => parseIndependentReview(prose('정상입니다 {"note":"no verdict here"}'), 7, [])).toThrow("independent-review-malformed-json");
    expect(() => parseIndependentReview(prose('대신 툴을 부릅니다 <tool_call><invoke name="reset_project">'), 7, [])).toThrow("independent-review-malformed-json");
  });
  it("cannot approve deterministic failures and does not invent checks for nonvisual work", () => {
    expect(parseIndependentReview(response(approved), 7, []).status).toBe("approved");
    const blocked = parseIndependentReview(response(approved), 7, ["run_scene_test: failed expectation"]);
    expect(blocked.status).toBe("changes_requested");
    expect(blocked.findings[0]).toMatchObject({ target: "required-evidence", problem: "run_scene_test: failed expectation" });
  });
  it("sends actual image parts, uses no tools and refuses an oversized complete envelope", () => {
    const input: ReviewInput = { revision: 7, originalRequest: "Inspect", before: [], after: [], changes: [],
      toolResults: [], acceptance: null, requiredProblems: [], images: [{ label: "Current render", dataUrl: "data:image/png;base64,AA==" }] };
    const config = defaultAiConfig();
    const request = buildIndependentReviewRequest(config, input);
    expect(request.tools).toEqual([]);
    expect(request.tool_choice).toBe("none");
    expect(request.messages[1]?.content).toContainEqual({ type: "image_url", image_url: { url: input.images[0]!.dataUrl } });
    expect(() => buildIndependentReviewRequest({ ...config, model: "tab_flash_lite_preview" },
      { ...input, originalRequest: "large ".repeat(200000) })).toThrow("independent-review-window-exceeded");
  });
  it("retains exact changed database records rather than whole unchanged collections", () => {
    const before = createBlankProject(), after = structuredClone(before);
    after.database.items[0]!.price = 654;
    expect(reviewChanges(before, after)).toEqual([{ path: `/database/items/${before.database.items[0]!.id}`,
      before: before.database.items[0], after: after.database.items[0] }]);
  });
});


it("retains advisory evidence without making it a required explicit check", () => {
  const evidence = new ToolVerificationEvidence();
  const failure = { ok: true, data: { counts: { errors: 1 }, issues: [
    { severity: "error", code: "missing-reference", message: "Existing reference", mapId: "m" },
  ] } };
  evidence.captureLintBaseline(failure);
  evidence.observe("run_lint", {}, failure, "advisory");
  expect(evidence.problems().length).toBeGreaterThan(0);
  expect(evidence.problems("blocking")).toEqual([]);
  evidence.observe("run_lint", {}, failure, "explicit");
  expect(evidence.problems("blocking").length).toBeGreaterThan(0);
  expect(evidence.snapshot().requirements).toEqual([]);
  evidence.invalidateAfterWrite();
  expect(evidence.passed("run_lint")).toBe(false);
});


describe("provider JSON fences and narrated verdicts", () => {
  const fenced = (body: string): ChatResult => ({ message: { role: "assistant", content: body }, finishReason: "stop" });
  it.each(["json", ""])("accepts exactly one complete %s fence and preserves the verdict", language => {
    const request = { ...approved, verdict: "changes_requested", findings: [{ id: "price", target: "/database/items/item_potion",
      problem: "321 instead of 654", requestedChange: "Set price to 654", validation: "Read the current price" }] };
    const result = parseIndependentReview(fenced(`  \`\`\`${language}\n${JSON.stringify(request)}\n\`\`\`  `), 7, []);
    expect(result.status).toBe("changes_requested");
    expect(result.findings).toEqual(request.findings);
    expect(parseIndependentReview(fenced(`\`\`\`${language}\r\n${JSON.stringify(approved)}\r\n\`\`\``), 7, []).status).toBe("approved");
  });
  // A verdict wrapped in narration is still that reviewer's verdict, and discarding it cost the
  // draft the whole turn (F6). One unambiguous verdict object is read wherever it sits; the
  // shape checks below are unchanged, so nothing weaker than a whole-response answer is admitted.
  it.each([
    `Here is the review:\n\`\`\`json\n${JSON.stringify(approved)}\n\`\`\``,
    `\`\`\`json\n${JSON.stringify(approved)}\n\`\`\`\nAll done`,
    `\`\`\`json\n${JSON.stringify(approved)}`,
    `${JSON.stringify(approved)}\n\`\`\``,
    `\`\`\`json\n${JSON.stringify(approved)}\n\`\`\`\n\`\`\`json\n{}\n\`\`\``,
    `\`\`\`javascript\n${JSON.stringify(approved)}\n\`\`\``,
  ])("reads one narrated or oddly fenced verdict: %s", body => {
    expect(parseIndependentReview(fenced(body), 7, []).status).toBe("approved");
  });
  it.each([
    `\`\`\`json\n{"revision":7,\n\`\`\``,
    `${JSON.stringify(approved)} 또는 ${JSON.stringify({ ...approved, verdict: "changes_requested" })}`,
    'Reviewed. {"summary":"looks right"}',
  ])("still rejects truncated, ambiguous or verdict-free bodies: %s", body => {
    expect(() => parseIndependentReview(fenced(body), 7, [])).toThrow("independent-review-malformed-json");
  });
  it("does not let a valid fence bypass tool-call, revision or required-evidence checks", () => {
    const result = fenced(`\`\`\`json\n${JSON.stringify(approved)}\n\`\`\``);
    expect(() => parseIndependentReview(result, 8, [])).toThrow("independent-review-malformed-verdict");
    expect(parseIndependentReview(result, 7, ["run_scene_test: failed"]).status).toBe("changes_requested");
    result.message.tool_calls = [{ id: "bad", type: "function", function: { name: "reset_project", arguments: "{}" } }];
    expect(() => parseIndependentReview(result, 7, [])).toThrow("independent-review-tool-call-rejected");
  });
});


it("reviews the authored starting seed without reading later runtime state", () => {
  const before = createBlankProject(), after = structuredClone(before);
  after.session.gold = 654;
  const runtime = startSession(after);
  runtime.gold = 9999;
  expect(reviewChanges(before, after)).toEqual([{ path: "/session", before: before.session, after: after.session }]);
  expect(after.session.gold).toBe(654);
  expect(JSON.stringify(reviewChanges(before, after))).not.toContain('"gold":9999');
});
