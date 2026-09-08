import { describe, expect, it } from "vitest";
import { parseAcceptance } from "@/ai/assistantAcceptance";
import { AssistantAcceptanceLedger } from "@/ai/assistantAcceptanceLedger";
import { functionalFixture } from "./fixtures/functionalAcceptance";

export function criteriaFor(fixture: ReturnType<typeof functionalFixture>) {
  const { origin, destination, seller, outgoing, returning, reward, project } = fixture;
  return [
    { kind: "shopPurchase", target: { mapId: origin.id }, start: project.startPos,
      seller: { eventId: seller.id }, item: { id: "item_potion" }, count: 2, unitPrice: 10 },
    { kind: "mapRoundTrip", target: { mapId: origin.id }, start: project.startPos,
      destination: { mapId: destination.id }, outgoing: { eventId: outgoing.id }, returning: { eventId: returning.id } },
    { kind: "npcReward", requirement: { target: { mapId: origin.id, eventId: reward.id }, grants: [{ kind: "item", id: "item_potion", count: 2 }], oneTime: true } },
  ];
}
function ledgerFor(fixture: ReturnType<typeof functionalFixture>) {
  const ledger = new AssistantAcceptanceLedger("functional-test", "Requested gameplay", fixture.project);
  const promises = parseAcceptance(criteriaFor(fixture).map((criterion, i) => ({ id: `required-${i}`, title: criterion.kind, criteria: [criterion] })));
  if (!promises) throw new Error("Missing test promises");
  ledger.adopt(promises);
  return ledger;
}

describe("immutable engine-evaluated functional acceptance", () => {
  it("verifies purchase, real outgoing/return traversal and one-time reward without model evidence", () => {
    const fixture = functionalFixture();
    const before = structuredClone(fixture.project);
    const snapshot = ledgerFor(fixture).evaluate(fixture.project);
    expect(snapshot, JSON.stringify(snapshot)).toMatchObject({ status: "verified", items: [
      { evidence: [{ passed: true }] }, { evidence: [{ passed: true }] }, { evidence: [{ passed: true }] },
    ] });
    expect(fixture.project).toEqual(before);
  });
  it("carries outgoing interpreter state into the return interaction in the same engine session", () => {
    const fixture = functionalFixture();
    fixture.outgoing.pages![0].commands.unshift({ kind: "setSwitch", switchId: "switch_met_guard", value: true });
    fixture.returning.pages![0].conditions = [{ kind: "switch", switchId: "switch_met_guard", value: true }];
    expect(ledgerFor(fixture).evaluate(fixture.project).items[1].evidence[0].passed).toBe(true);
  });
  it.each(["missing-return", "wrong-destination", "blocked-route", "wrong-start", "inactive-return"])("rejects round trip %s", variant => {
    const fixture = functionalFixture();
    const ledger = ledgerFor(fixture);
    if (variant === "missing-return") fixture.destination.events = [];
    if (variant === "wrong-destination") fixture.outgoing.pages![0].commands = [{ kind: "transfer", mapId: fixture.origin.id, x: 1, y: 1 }];
    if (variant === "wrong-start") fixture.project.startPos = { x: 2, y: 2 };
    if (variant === "inactive-return") fixture.returning.pages![0].conditions = [{ kind: "switch", switchId: "unopened", value: true }];
    if (variant === "blocked-route") {
      for (let x = 0; x < fixture.origin.width; x++) fixture.origin.events.push({ ...structuredClone(fixture.seller), id: `wall_${x}`, x, y: 2 });
    }
    const snapshot = ledger.evaluate(fixture.project);
    expect(snapshot.items[1].evidence[0].passed).toBe(false);
  });
  it.each(["wrong-count", "repeatable", "wrong-target", "unmet-condition"])("rejects reward %s", variant => {
    const fixture = functionalFixture();
    const ledger = ledgerFor(fixture);
    if (variant === "wrong-count") fixture.reward.pages![0].commands[0] = { kind: "changeItem", itemId: "item_potion", op: "+=", amount: 1 };
    if (variant === "repeatable") fixture.reward.pages![0].commands.pop();
    if (variant === "wrong-target") fixture.reward.id = "other_npc";
    if (variant === "unmet-condition") fixture.reward.pages![0].conditions = [{ kind: "switch", switchId: "unopened", value: true }];
    expect(ledger.evaluate(fixture.project).items[2].evidence[0].passed).toBe(false);
  });
  it("cannot replace or repair accepted expectations and recomputes after an applied edit", () => {
    const fixture = functionalFixture();
    const ledger = ledgerFor(fixture);
    expect(ledger.evaluate(fixture.project).status).toBe("verified");
    fixture.project.session.gold = 1;
    const easier = parseAcceptance([{ id: "required-0", title: "Skip purchase", required: false,
      criteria: [{ kind: "eventCount", target: { mapId: fixture.origin.id }, count: fixture.origin.events.length }] }]);
    ledger.adopt(easier ?? []);
    expect(ledger.repair("required-0", easier?.[0].criteria)).toMatchObject({ ok: false, code: "immutable-valid" });
    expect(ledger.evaluate(fixture.project).items[0]).toMatchObject({ required: true, evidence: [{ passed: false }] });
  });
  it("does not verify an unapplied draft or reuse applied proof after a database-only write", () => {
    const fixture = functionalFixture();
    const ledger = ledgerFor(fixture);
    expect(ledger.evaluate(fixture.project).status).toBe("verified");
    const draft = structuredClone(fixture.project);
    draft.session.gold = 1;
    expect(ledger.evaluate(fixture.project, draft).items[0].status).toBe("verifying");
    expect(ledger.evaluate(draft).items[0].evidence[0].passed).toBe(false);
  });
  it("rejects a fabricated executable or pass field inside a reward requirement", () => {
    const fixture = functionalFixture();
    const criterion = criteriaFor(fixture)[2];
    const parsed = parseAcceptance([{ id: "forged", title: "Reward", criteria: [{ ...criterion,
      requirement: { ...criterion.requirement, passed: true, script: "grant reward" } }] }]);
    expect(parsed?.[0].criteria).toBeNull();
  });
  it("does not walk out of a fabricated blocked entry", () => {
    const fixture = functionalFixture();
    const ledger = ledgerFor(fixture);
    fixture.origin.events.push({ ...structuredClone(fixture.seller), id: "start_blocker", ...fixture.project.startPos });
    expect(ledger.evaluate(fixture.project).items[0].evidence[0].passed).toBe(false);
    expect(ledger.evaluate(fixture.project).items[1].evidence[0].passed).toBe(false);
  });
  it.each(["count", "unitPrice", "seller", "start"])("keeps missing purchase %s unverified", field => {
    const fixture = functionalFixture();
    const candidate = Object.fromEntries(Object.entries(criteriaFor(fixture)[0]).filter(([key]) => key !== field));
    const parsed = parseAcceptance([{ id: "missing", title: "Requested purchase", criteria: [candidate] }]);
    expect(parsed?.[0].criteria).toBeNull();
  });
});
