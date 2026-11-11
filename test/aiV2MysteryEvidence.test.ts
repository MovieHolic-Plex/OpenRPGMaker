import { describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { createBuildRun } from "@/ai/v2/shared/buildRun";
import { evidenceOnThing } from "@/ai/v2/story/mysteryEvidencePlaces";
import { explainRemainingClues, pendingClueChain } from "@/ai/v2/story/mysteryClues";
import type { ToolContext } from "@/editor/tools/types";
import type { GameEvent, Project } from "@/project/types";

// 2026-11-12 Terra 측정 r1-mystery(눈가림 판정: 엔딩 못 봄). 판정자는 사슬의 단서 다섯을 다 모았는데 「최후의 지목」이
// «남은 단서 1개는 「서진의 해명」» 을 서른네 번 되풀이했다 — 실제로 없던 것은 지목 페이지가 요구하는 증거 아이템 『사건 의뢰』였다.
// 그 증거는 첫 단계 「서진」이 말로 주는 것(청사진 gives)인데 다른 맵 건물 앞 바닥 칸이 됐고, 서진은 그 자리를 처음 한 번만 말했다.
// 재는 법(모델 없음): 저장된 판을 판정자가 누른 차례로 눌러 보는 탐침(~/z-project/assistant-fable-runs/genre-tools/mystery/judgePath.mts)과 같은 함수 호출.
// 문서 openwiki/assistant-v2.md 「추리 — 지목이 안 열리는 까닭을 말한다」.

const person = { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, direction: "down", pattern: 1 };
const base = { trigger: { kind: "action" }, priority: "same", movement: { type: "fixed", speed: 3, frequency: 3 } };
const hidden = { transparent: true };

/** 사람 「서진」(말하고 증거를 준다) → 「멈춘 시계」 → 「최후의 지목」(시계 단서 + 증거 아이템이 있어야 열린다). gives = 청사진 첫 단계가 준다고 적은 것. */
function game(evidence: string, gives: string) {
  const project = createBlankProject();
  const place = project.maps[project.startMapId]!.name;
  project.database.items.push({ id: "item_ev", name: evidence, description: "[증거]", price: 0, consumable: false } as never);
  project.gameBlueprint = { version: 1, title: "시험 사건", genre: "추리", playerGoal: "범인을 찾는다", request: "추리 게임", updatedAt: "", ending: { name: "사건 해결", how: "지목", feeling: "후련" }, steps: [
    { id: "s1", kind: "talk", who: "서진", place, event: "서진", action: "집사에게 듣는다", needs: "", gives, feeling: "" },
    { id: "s2", kind: "find", place, event: "멈춘 시계", action: "시계를 본다", needs: gives, gives: "시계 단서", feeling: "" },
    { id: "s3", kind: "choice", place, event: "최후의 지목", action: "범인을 지목한다", needs: "시계 단서", gives: "사건 해결", feeling: "" },
  ] } as never;
  const ctx: ToolContext = { project, currentMapId: project.startMapId, assistantRun: true };
  const run = createBuildRun(ctx);
  const put = (event: Record<string, unknown>) => expect(run.call("upsert_event", { mapId: project.startMapId, event }).ok).toBe(true);
  put({ id: "ev_seojin", name: "서진", x: 4, y: 4, pages: [
    { ...base, id: "p0", conditions: [], graphic: person, commands: [{ kind: "text", speaker: "서진", body: "주인님이 돌아가셨습니다." }, { kind: "setSwitch", switchId: "sw_0001", value: true }, { kind: "changeItem", itemId: "item_ev", op: "+=", amount: 1 }, { kind: "text", body: `『${evidence}』을 증거로 챙겼다.` }, { kind: "setSwitch", switchId: "sw_0002", value: true }] },
    { ...base, id: "p1", conditions: [{ kind: "switch", switchId: "sw_0002", value: true }], graphic: person, commands: [{ kind: "text", body: "(다시 묻는다.)" }, { kind: "text", speaker: "서진", body: "주인님이 돌아가셨습니다." }] },
  ] });
  put({ id: "ev_clock", name: "멈춘 시계", x: 8, y: 4, pages: [
    { ...base, id: "p0", conditions: [], graphic: hidden, commands: [{ kind: "text", body: "먼저 서진의 이야기를 듣자." }] },
    { ...base, id: "p1", conditions: [{ kind: "switch", switchId: "sw_0001", value: true }], graphic: hidden, commands: [{ kind: "text", body: "(시계는 9시 12분에 멈춰 있다.)" }, { kind: "setSwitch", switchId: "sw_0003", value: true }] },
  ] });
  put({ id: "ev_accuse", name: "최후의 지목", x: 12, y: 4, pages: [
    { ...base, id: "p0", conditions: [], graphic: hidden, commands: [{ kind: "text", body: "아직 단서가 모자라다." }] },
    { ...base, id: "p1", conditions: [{ kind: "switch", switchId: "sw_0003", value: true }, { kind: "item", itemId: "item_ev", present: true }], graphic: hidden, commands: [{ kind: "presentItem", prompt: "증거는?", options: [{ itemId: "item_ev", branch: [{ kind: "text", body: "범인은 당신이다." }, { kind: "gameOver" }] }], otherwiseBranch: [], cancelBranch: [] }] },
  ] });
  return { ctx, run };
}
const eventOf = (project: Project, id: string): GameEvent | undefined => project.maps[project.startMapId]!.events.find((event) => event.id === id);
const textOf = (event: GameEvent | undefined): string => JSON.stringify(event?.pages ?? []);

describe("추리 증거 — 말로 건네는 것과 바닥에 떨어진 것", () => {
  it("청사진의 말하는 단계가 준다고 적은 그대로의 증거는 그 말이 건넨다(바닥 칸을 만들지 않는다)", () => {
    const { ctx, run } = game("사건 의뢰", "사건 의뢰");
    expect(evidenceOnThing(run)).toEqual([]);
    expect(eventOf(ctx.project, "ev_seojin_evidence")).toBeUndefined();
    expect(textOf(eventOf(ctx.project, "ev_seojin"))).toContain('"changeItem"');
  });

  it("세우기가 지어낸 물건은 바닥 칸으로 가고, 다시 물어도(못 주운 동안) 자리를 일러 준다", () => {
    const { ctx, run } = game("떨어진 은단추", "수사 시작");
    expect(evidenceOnThing(run)).toHaveLength(1);
    const giver = eventOf(ctx.project, "ev_seojin")!;
    expect(eventOf(ctx.project, "ev_seojin_evidence")).toBeDefined();
    expect(textOf(giver)).not.toContain('"changeItem"');
    const pages = giver.pages!;
    expect(JSON.stringify(pages[0]!.commands)).toMatch(/반짝이던데/u);
    const again = pages[1]!.commands.at(-1) as unknown as { kind: string; condition: { kind: string; itemId: string; present: boolean }; then: Array<{ body: string }> };
    expect(again.kind).toBe("fork");
    expect(again.condition).toEqual({ kind: "item", itemId: "item_ev", present: false });
    expect(again.then[0]!.body).toMatch(/ 바닥을 살펴보게\./u);
    // 되풀이 안전.
    expect(evidenceOnThing(run)).toEqual([]);
  });

  it("조사 칸·문 표시가 가로로 늘어선 줄에는 증거 칸을 놓지 않는다", () => {
    const plain = game("떨어진 은단추", "수사 시작");
    evidenceOnThing(plain.run);
    // 표시가 없으면 사람 둘레에서 가장 위 칸(같은 줄 y=2)에 놓인다 — 그 줄에 문 표시를 세우면 비켜 간다.
    expect(eventOf(plain.ctx.project, "ev_seojin_evidence")!.y).toBe(2);
    const { ctx, run } = game("떨어진 은단추", "수사 시작");
    for (const x of [2, 6]) expect(run.call("upsert_event", { mapId: ctx.project.startMapId, event: { id: `ev_door_${x}`, name: "들어갈 수 없는 입구", x, y: 2, pages: [{ ...base, id: "p0", conditions: [], graphic: hidden, commands: [{ kind: "text", body: "문이 잠겨 있다." }] }] } }).ok).toBe(true);
    evidenceOnThing(run);
    expect(eventOf(ctx.project, "ev_seojin_evidence")!.y).not.toBe(2);
  });

  it("이미 바닥 칸이 된 말 증거(저장된 판)는 되돌린다 — 칸과 귀띔을 걷고 그 말이 다시 건넨다", () => {
    const { ctx, run } = game("떨어진 은단추", "수사 시작");
    evidenceOnThing(run);
    const bp = ctx.project.gameBlueprint!;
    ctx.project = { ...ctx.project, gameBlueprint: { ...bp, steps: bp.steps.map((step, i) => (i === 0 ? { ...step, gives: "떨어진 은단추" } : step)) } };
    expect(evidenceOnThing(run)).toHaveLength(1);
    expect(eventOf(ctx.project, "ev_seojin_evidence")).toBeUndefined();
    const giver = textOf(eventOf(ctx.project, "ev_seojin"));
    expect(giver).toContain('"changeItem"');
    expect(giver).not.toMatch(/바닥/u);
  });
});

describe("추리 — 지목이 안 열리는 까닭을 말한다", () => {
  it("사슬을 다 마쳤는데 증거 아이템이 없으면 그 증거와 얻는 곳을 말한다(하나 앞 단서를 되풀이하지 않는다)", () => {
    const { ctx, run } = game("떨어진 은단추", "수사 시작");
    evidenceOnThing(run);
    explainRemainingClues(run);
    const accuse = eventOf(ctx.project, "ev_accuse")!;
    const pages = accuse.pages!;
    const names = pages.map((page) => (page as { name?: string }).name ?? page.id);
    // 남은 단서 페이지들 → 증거 페이지 → 지목 페이지. 뒤 페이지가 먼저 맞으므로 증거가 있으면 지목이 열린다.
    expect(names.indexOf("남은 단서 · 증거")).toBe(names.length - 2);
    const lack = pages.find((page) => (page as { name?: string }).name === "남은 단서 · 증거")!;
    expect(lack.conditions).toEqual([{ kind: "switch", switchId: "sw_0003", value: true }]);
    expect(JSON.stringify(lack.commands)).toMatch(/"itemId":"item_ev","present":false/u);
    expect(JSON.stringify(lack.commands)).toMatch(/『떨어진 은단추』.*「서진」이 일러 준 .*바닥을 살펴보자/u);
    const before = textOf(accuse);
    explainRemainingClues(run);
    expect(textOf(eventOf(ctx.project, "ev_accuse"))).toBe(before);
  });

  it("목표 사슬: 증거 칸을 안 주웠으면 그 칸을, 단서를 다 마쳤으면 어느 페이지에서든 지목을 가리킨다", () => {
    const { ctx, run } = game("떨어진 은단추", "수사 시작");
    evidenceOnThing(run);
    const chain = JSON.stringify(pendingClueChain(ctx.project, ctx.project.startMapId, { kind: "text", body: "이 페이지가 원래 걸던 다음 단계" }));
    expect(chain).toContain('"itemId":"item_ev","present":false');
    expect(chain).toMatch(/아직 못 찾은 단서가 있다\. 「서진」이 일러 준 곳에서/u);
    expect(chain).toContain("「최후의 지목」을 찾아가자");
    expect(chain).not.toContain("이 페이지가 원래 걸던 다음 단계");
  });
});
