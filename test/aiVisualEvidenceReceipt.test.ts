import { describe, expect, it } from "vitest";
import { deriveRunOutcome, type RunOutcomeFacts } from "@/ai/runOutcome";
import { AssistantImageEvidence } from "@/ai/assistantImageEvidence";
import { createBlankProject } from "@/project/defaults";
import { renderRunOutcome } from "@/editor/panels/aiChatRenderers";
import { installFakeDom } from "./fakeDom";
import type { Project } from "@/project/types";

// 이 파일이 지키는 것: "자료를 조회했다" / "이미지가 실제 요청에 실렸다" / "품질 검사를 했다" /
// "실제 플레이로 확인했다" 는 서로 다른 사실이다. 영수증은 **전달 사실만** 말한다.
// 모델이 그림을 이해했거나 보기 좋다고 판단했다는 주장은 여기서 만들어내지 않는다.

const baseFacts: RunOutcomeFacts = Object.freeze({
  execution: "response-final", acceptance: null,
  hasPendingDraft: false, hasApplied: false, persistence: "none",
});

function mapRegion(project: Project) {
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("Missing start map");
  return { mapId: map.id, x: 0, y: 0, w: map.width, h: map.height };
}

describe("visual delivery receipt", () => {
  it("reports no attachment when the run never rendered an image", () => {
    // Given: a run with no renderer at all.
    const facts: RunOutcomeFacts = { ...baseFacts, visualDelivery: { attempted: 0, attached: 0 } };
    // When
    const outcome = deriveRunOutcome(facts);
    // Then
    expect(outcome.imageAttached).toBe(false);
    expect(outcome.visualDelivery).toEqual({ attempted: 0, attached: 0 });
  });

  it("reports no attachment when rendering was attempted but nothing was acknowledged", () => {
    // Given: renderer threw or returned an empty list, so nothing reached the request.
    const facts: RunOutcomeFacts = { ...baseFacts, visualDelivery: { attempted: 2, attached: 0 } };
    // When
    const outcome = deriveRunOutcome(facts);
    // Then
    expect(outcome.imageAttached).toBe(false);
    expect(outcome.visualDelivery).toEqual({ attempted: 2, attached: 0 });
  });

  it("reports attachment only for images the provider actually acknowledged", () => {
    // Given
    const facts: RunOutcomeFacts = { ...baseFacts, visualDelivery: { attempted: 3, attached: 1 } };
    // When
    const outcome = deriveRunOutcome(facts);
    // Then
    expect(outcome.imageAttached).toBe(true);
    expect(outcome.visualDelivery).toEqual({ attempted: 3, attached: 1 });
  });

  it("keeps the delivery axis independent of goal and persistence axes", () => {
    // Given: a verified, persisted run that never sent an image.
    const facts: RunOutcomeFacts = { ...baseFacts, acceptance: "verified", hasApplied: true,
      persistence: "verified-current", visualDelivery: { attempted: 1, attached: 0 } };
    // When
    const outcome = deriveRunOutcome(facts);
    // Then: goal/delivery stay unchanged; the image axis does not inherit their success.
    expect(outcome.goal).toBe("satisfied");
    expect(outcome.delivery).toBe("persisted-verified");
    expect(outcome.imageAttached).toBe(false);
  });

  it("omits the receipt entirely for callers that do not report delivery facts", () => {
    // Given: a legacy caller.
    // When
    const outcome = deriveRunOutcome(baseFacts);
    // Then: absence is not a false claim in either direction.
    expect(outcome.imageAttached).toBe(false);
    expect(outcome.visualDelivery).toBeUndefined();
  });
});

describe("AssistantImageEvidence delivery facts", () => {
  it("counts a capture as attached only after the provider acknowledges it", () => {
    // Given
    const project = createBlankProject();
    const evidence = new AssistantImageEvidence();
    const receipt = evidence.capture(project, mapRegion(project));
    if (!receipt) throw new Error("Expected a real capture receipt");
    // Then: captured is not attached.
    expect(evidence.deliveryFacts()).toEqual({ attempted: 1, attached: 0 });
    // When
    evidence.deliver([receipt]);
    // Then
    expect(evidence.deliveryFacts()).toEqual({ attempted: 1, attached: 1 });
  });

  it("does not count a receipt from another run or revision", () => {
    // Given: a receipt captured against a different project revision.
    const project = createBlankProject();
    const evidence = new AssistantImageEvidence();
    const foreign = new AssistantImageEvidence().capture(project, mapRegion(project));
    if (!foreign) throw new Error("Expected a real capture receipt");
    // When: a foreign receipt is offered for delivery.
    evidence.deliver([foreign]);
    // Then
    expect(evidence.deliveryFacts()).toEqual({ attempted: 0, attached: 0 });
  });

  it("retires delivered facts when the authored content moved on", () => {
    // Given
    const project = createBlankProject();
    const evidence = new AssistantImageEvidence();
    const receipt = evidence.capture(project, mapRegion(project));
    if (!receipt) throw new Error("Expected a real capture receipt");
    evidence.deliver([receipt]);
    const map = project.maps[project.startMapId];
    if (!map) throw new Error("Missing start map");
    // When: the map actually changes after the image was sent.
    const moved: Project = { ...project, maps: { ...project.maps,
      [map.id]: { ...map, events: [...map.events, { id: "receipt-drift", x: 1, y: 1, pages: [] }] } } };
    evidence.current(moved);
    // Then: a stale image is not a current delivery receipt.
    expect(evidence.deliveryFacts()).toEqual({ attempted: 0, attached: 0 });
  });
});

describe("run outcome surface", () => {
  it("maps the receipt onto the concise result element without claiming comprehension", () => {
    // Given
    const restore = installFakeDom();
    try {
      const attached = deriveRunOutcome({ ...baseFacts, visualDelivery: { attempted: 1, attached: 1 } });
      const unattached = deriveRunOutcome({ ...baseFacts, visualDelivery: { attempted: 1, attached: 0 } });
      const unknown = deriveRunOutcome(baseFacts);
      // When
      const attachedEl = renderRunOutcome(attached);
      const unattachedEl = renderRunOutcome(unattached);
      const unknownEl = renderRunOutcome(unknown);
      // Then: machine-consumed state, and absence stays absent.
      expect(attachedEl.dataset.imageDelivery).toBe("attached");
      expect(unattachedEl.dataset.imageDelivery).toBe("unattached");
      expect(unknownEl.dataset.imageDelivery).toBeUndefined();
      // The other axes are untouched by the receipt.
      expect(attachedEl.dataset.goal).toBe("unassessed");
      expect(attachedEl.dataset.delivery).toBe("no-change");
    } finally { restore(); }
  });
});
