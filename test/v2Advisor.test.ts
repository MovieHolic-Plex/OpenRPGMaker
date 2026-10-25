// 조수 v2 독립 검토자(src/ai/v2/advisor.ts)의 결정적 부분 — 변경 요약·도구 기록 압축·응답 해석(등급은 코드가 정한다)·후속 지시문.
import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import type { GameEvent, Project } from "@/project/types";
import { adviseTurn, advisorFollowUp, compactToolLog, parseAdvisorReply, summarizeProjectDiff } from "@/ai/v2/advisor";

const page = (id: string, conditions: unknown[], commands: unknown[], sprite = true) => ({
  id, name: id, conditions, trigger: { kind: "action" }, priority: "same", movement: { type: "fixed" }, commands,
  graphic: sprite ? { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, pattern: 0 } : { transparent: true },
});
const ev = (id: string, name: string, pages: unknown[]): GameEvent => ({ id, name, x: 3, y: 4, trigger: { kind: "action" }, commands: [], pages } as unknown as GameEvent);
function withEvents(project: Project, events: GameEvent[]): Project {
  const next = structuredClone(project);
  next.maps[next.startMapId]!.events = events;
  return next;
}

describe("summarizeProjectDiff", () => {
  const base = createBlankProject();
  const cutscene = ev("ev_cut", "오프닝 컷신", [page("p0", [], [{ kind: "text", speaker: "제페토", body: "어서 오게." }])]);
  const cafe = ev("ev_cafe", "서연", [
    page("p0", [], [{ kind: "text", speaker: "서연", body: "어서 오세요." }]),
    page("p1", [{ kind: "variable", variableId: "var_aff", op: ">=", value: 4 }], [{ kind: "text", speaker: "서연", body: "같이 걸어갈래요?" }, { kind: "setSwitch", switchId: "sw_walk", value: true }]),
  ]);
  const walk = ev("ev_walk", "산책 장면", [page("p0", [{ kind: "switch", switchId: "sw_walk", value: true }], [{ kind: "text", body: "둘이 걷는다." }])]);

  it("삭제된 이벤트와 공장 기본 오프닝을 그대로 적는다", () => {
    const before = withEvents(base, [cutscene]);
    const after = withEvents(base, []);
    const text = summarizeProjectDiff(before, after);
    expect(text).toContain("삭제: «오프닝 컷신» ev_cut");
    expect(text).toContain("## 오프닝 (이번에 바뀌지 않음)");
    expect(text).toContain("공장 기본");
  });

  it("다시 쓰기에서 사라진 페이지와 끊긴 스위치 고리를 짚는다", () => {
    const before = withEvents(base, [cafe, walk]);
    const rewritten = ev("ev_cafe", "서연", [1, 2, 3].map((d) => page(`d${d}`, [{ kind: "variable", variableId: "var_day", op: "==", value: d }], [{ kind: "text", speaker: "서연", body: `${d}일차 인사` }])));
    const after = withEvents(base, [rewritten, walk]);
    const text = summarizeProjectDiff(before, after);
    expect(text).toContain("⚠ 사라진 페이지 p1 [var_aff>=4]");
    expect(text).toContain("「서연: 같이 걸어갈래요?」");
    expect(text).toMatch(/끊김\(이번 실행\): sw_walk/u);
  });

  it("바뀐 것이 없으면 짧게 끝나고 상한을 지킨다", () => {
    const text = summarizeProjectDiff(base, structuredClone(base), 400);
    expect(text).toContain("바뀐 맵 없음");
    expect(text).toContain("이벤트 (추가 0 · 삭제 0 · 바뀜 0");
    expect(text.length).toBeLessThanOrEqual(400);
  });
});

describe("compactToolLog", () => {
  it("읽기는 이름별 횟수로 묶고 쓰기·실패는 한 줄씩 남긴다", () => {
    const text = compactToolLog([
      { name: "get_event", ok: true, summary: "읽음" }, { name: "get_event", ok: true, summary: "읽음" },
      { name: "remove_event", ok: true, args: { eventId: "ev_cut" }, summary: "이벤트 'ev_cut' 제거" },
      { name: "upsert_event", ok: false, args: { x: 1 }, summary: "형식 오류" },
    ]);
    expect(text).toContain("(읽기 get_event×2)");
    expect(text).toMatch(/remove_event .*ev_cut.*제거/u);
    expect(text).toContain("upsert_event ✗실패");
  });
});

describe("parseAdvisorReply — 등급은 코드가 정한다", () => {
  it("반대되는 주장·알리지 않은 삭제·「다 됐다」면서 빠진 것은 막음, 보이지 않는 주장은 우려", () => {
    const { notes } = parseAdvisorReply(JSON.stringify({
      claims: [
        { claim: "오프닝을 새로 만들었다", status: "contradicted", evidence: "## 오프닝 (이번에 바뀌지 않음)" },
        { claim: "이름을 바꿨다", status: "not_shown", evidence: "이름 바뀜 줄 없음" },
        { claim: "시계를 놓았다", status: "shown", evidence: "추가: «시계»" },
      ],
      removals: [{ what: "오프닝 컷신", mentioned: false, evidence: "삭제: «오프닝 컷신»" }, { what: "옛 표지판", mentioned: true, evidence: "삭제: «표지판»" }],
      unreachable: [{ what: "산책 장면", report_says_works: true, evidence: "끊김: sw_walk" }],
      missing: [{ part: "엔딩", report_says_done: false, evidence: "엔딩 없음" }],
    }));
    expect(notes.map((n) => n.level)).toEqual(["blocker", "concern", "blocker", "aside", "blocker", "concern"]);
  });

  it("읽지 못한 응답은 막지 않고 사유만 남긴다", () => {
    expect(parseAdvisorReply("모르겠어요").problem).toBeTruthy();
    expect(parseAdvisorReply(JSON.stringify({ claims: [] })).notes).toEqual([]);
  });
});

describe("adviseTurn / advisorFollowUp", () => {
  it("막음이 있으면 고치거나 못 했다고 쓰라는 후속 지시문을 만들고, 없으면 만들지 않는다", async () => {
    const chat = async () => JSON.stringify({ removals: [{ what: "오프닝 컷신", mentioned: false, evidence: "삭제: «오프닝 컷신»" }] });
    const verdict = await adviseTurn({ task: "회상을 넣어 줘", toolLog: "", diff: "삭제: «오프닝 컷신»", report: "다 됐습니다" }, chat);
    expect(verdict.notes[0]?.level).toBe("blocker");
    const follow = advisorFollowUp(verdict)!;
    expect(follow).toContain("[독립 검토자]");
    expect(follow).toContain("최종 보고(앞 보고를 고침):");
    expect(advisorFollowUp({ notes: [{ level: "concern", what: "x", evidence: "" }], ms: 0, inputChars: 0 })).toBeUndefined();
  });

  it("호출이 실패해도 던지지 않고 판정 불가로 남긴다", async () => {
    const verdict = await adviseTurn({ task: "t", toolLog: "", diff: "", report: "" }, async () => { throw new Error("429"); });
    expect(verdict.notes).toEqual([]);
    expect(verdict.problem).toMatch(/검토자 호출 실패/u);
  });
});
