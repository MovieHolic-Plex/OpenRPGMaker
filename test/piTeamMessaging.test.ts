import { describe, expect, it } from "vitest";
import { PiTeamMessaging } from "../scripts/lib/piTeamMessaging";

function team() {
  const bus = new PiTeamMessaging();
  bus.register("chief", "팀장", null);
  bus.register("outside", "외부", "village");
  bus.register("inside", "실내", "inn");
  return bus;
}

describe("team direct messaging", () => {
  it("routes a door negotiation to its recipient, correlates the reply and requires explicit application acknowledgement", () => {
    const bus = team();
    const question = bus.send("outside", "inside", "여관 진입 좌표?", "question");
    expect(bus.read("chief")).toEqual([]);
    expect(() => bus.acknowledge("inside", question.id)).toThrow();
    expect(bus.read("inside")).toMatchObject([{ id: question.id, read: true, acknowledged: false }]);
    expect(bus.read("inside")).toEqual([]);
    const reply = bus.send("inside", "outside", "inn (8,12)", "reply", question.id);
    expect(bus.outstanding()).toHaveLength(1);
    expect(bus.read("outside")).toMatchObject([{ replyTo: question.id }]);
    bus.acknowledge("outside", reply.id);
    expect(bus.unread("inside")).toBe(true);
    expect(bus.sent("inside")[0]).toMatchObject({ id: reply.id, acknowledged: true });
    expect(bus.outstanding()).toEqual([]);
  });
  it("rejects misrouted replies, spoofed acknowledgements, self messages and unavailable recipients", () => {
    const bus = team();
    const question = bus.send("outside", "inside", "문?", "question");
    expect(() => bus.send("chief", "outside", "응", "reply", question.id)).toThrow();
    expect(() => bus.acknowledge("chief", question.id)).toThrow();
    expect(() => bus.send("inside", "inside", "나")).toThrow();
    expect(() => bus.send("inside", "missing", "문")).toThrow();
    bus.close("outside");
    expect(() => bus.send("inside", "outside", "응", "reply", question.id)).toThrow(/unavailable/);
  });
  it("wakes on delivery and distinguishes timeout, cancellation and a closed teammate", async () => {
    const bus = team();
    const waiting = bus.wait("inside");
    bus.send("outside", "inside", "문 옮김");
    expect(await waiting).toBe("messages");
    bus.read("inside");
    expect(await bus.wait("inside", 0)).toBe("timeout");
    const abort = new AbortController();
    const cancelled = bus.wait("inside", 10000, abort.signal);
    abort.abort();
    expect(await cancelled).toBe("aborted");
    const closing = bus.wait("inside");
    bus.close("outside");
    expect(await closing).toBe("team_changed");
  });
  it("isolates runs and bounds payload/history without silently truncating agreements", () => {
    const bus = team();
    expect(() => bus.send("inside", "outside", "x".repeat(4001))).toThrow();
    for (let i = 0; i < 256; i++) bus.send("inside", "outside", `message ${i}`);
    expect(() => bus.send("inside", "outside", "overflow")).toThrow(/budget/);
    expect(team().read("outside")).toEqual([]);
  });
});

it("reading or acknowledging a question does not fabricate an answer", () => {
  const bus = team();
  const q = bus.send("outside", "inside", "입구?", "question");
  bus.read("inside");
  bus.acknowledge("inside", q.id);
  expect(bus.outstanding()).toMatchObject([{ id: q.id }]);
});
