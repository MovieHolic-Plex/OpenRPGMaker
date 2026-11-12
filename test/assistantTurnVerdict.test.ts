// 턴 기록의 모델 없는 판정 — 2026-11-12 Haiku 깔기 판에서 본 두 가지:
//  - 입력이 조수에 닿지 않은 턴(모델 호출 0 · 도구 0 · done 없음)이 «아무것도 안 깔림» 으로 세어졌다(기반 오류여야 한다).
//  - ask_user 로 끝난 턴은 설계상 최종 보고가 없다 — «v2Final 없음» 이 깨진 턴으로 읽혔다.
import { describe, expect, it } from "vitest";
import { endedOnQuestion, layStatus, neverStarted } from "@/harnesses/assistant-capability/node/turnVerdict";

const unsentTurn = { outcome: "settled", requests: [], toolCalls: [], done: [], v2Final: [] };
const workedTurn = { outcome: "settled", requests: [{ model: "m" }], toolCalls: [{ name: "make_place", ok: true }], done: [{ stats: {} }], v2Final: [{ complete: false }] };
const askedTurn = { outcome: "settled", requests: [{ model: "m" }], toolCalls: [{ name: "make_place", ok: true }, { name: "ask_user", ok: true }], done: [{ stats: {} }], v2Final: [] };
const cutTurn = { outcome: "timeout", requests: [{ model: "m" }], toolCalls: [{ name: "make_place", ok: true }], done: [], v2Final: [] };

describe("입력이 조수에 닿지 않은 턴은 기반 오류다", () => {
  it("모델 호출 0 · 도구 0 · done 없음 → neverStarted, 맵 깔기 판정은 infra", () => {
    expect(neverStarted([unsentTurn])).toBe(true);
    expect(layStatus({ maps: 0, turns: [unsentTurn], errors: 0, toolCalls: 0, timedOut: false })).toEqual({ status: "infra", unsent: true });
  });
  it("모델이 돌았으면 아니다 — 아무것도 안 깔았으면 nothing, 깔았으면 laid, 끊겼으면 timeout", () => {
    expect(neverStarted([workedTurn])).toBe(false);
    expect(neverStarted([])).toBe(false);
    expect(layStatus({ maps: 0, turns: [workedTurn], errors: 0, toolCalls: 1, timedOut: false }).status).toBe("nothing");
    expect(layStatus({ maps: 1, turns: [workedTurn], errors: 0, toolCalls: 1, timedOut: false }).status).toBe("laid");
    expect(layStatus({ maps: 1, turns: [cutTurn], errors: 0, toolCalls: 1, timedOut: true }).status).toBe("timeout");
    // 도구 없이 오류로 끝난 턴은 전처럼 infra.
    expect(layStatus({ maps: 0, turns: [{ ...workedTurn, toolCalls: [] }], errors: 1, toolCalls: 0, timedOut: false }).status).toBe("infra");
  });
});

describe("질문으로 끝난 턴", () => {
  it("ask_user 가 성공했고 최종 보고가 없으면 질문으로 끝난 것이다", () => {
    expect(endedOnQuestion([askedTurn])).toBe(true);
  });
  it("최종 보고가 있거나, 묻지 않았거나, 물음이 거절됐으면 아니다", () => {
    expect(endedOnQuestion([workedTurn])).toBe(false);
    expect(endedOnQuestion([cutTurn])).toBe(false);
    expect(endedOnQuestion([{ ...askedTurn, v2Final: [{ complete: true }] }])).toBe(false);
    expect(endedOnQuestion([{ ...askedTurn, toolCalls: [{ name: "ask_user", ok: false }] }])).toBe(false);
    expect(endedOnQuestion([])).toBe(false);
  });
});

describe("보정 기록의 «이어 쓴 답» 줄", () => {
  it("이어 쓴 답이 있으면 몇 장 중 몇 장인지와 어느 판인지 적는다 — 없으면 빈 글", async () => {
    const { carriedNote } = await import("@/harnesses/assistant-capability/node/mapVqa/verdict");
    expect(carriedNote({ planted: { total: 33 }, good: { total: 15 }, carried: { from: ["map-vqa-v2"], answers: 33 } })).toBe("48장 중 33장은 map-vqa-v2 의 답을 이어 씀(물음이 화소까지 같다) · 새로 물은 것 15장");
    expect(carriedNote({ planted: { total: 33 }, good: { total: 15 }, carried: { from: ["map-vqa-v2"], answers: 0 } })).toBe("");
    expect(carriedNote({ planted: { total: 33 }, good: { total: 15 } })).toBe("");
    expect(carriedNote(null)).toBe("");
  });
});
