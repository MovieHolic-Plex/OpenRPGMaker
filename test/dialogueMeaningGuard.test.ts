// 대사 고치기의 뜻 보존 관문(dialogueMeaningGuard.ts) — 닻마다 거절·통과, 그리고 rewrite_dialogue 가 거절된 줄을 쓰지 않는지.
import { describe, expect, it } from "vitest";
import { runTool } from "@/editor/tools";
import { createBlankProject } from "@/project/defaults";
import { collectDialogueLines } from "@/editor/dialogue/dialogueIndex";
import { checkMeaningPreserved, meaningGuardNames, quantityValues } from "@/editor/dialogue/dialogueMeaningGuard";
import { dialogueGuardNames } from "@/editor/tools/dialogueTools";
import type { Command, GameEvent } from "@/project/types";

const kinds = (before: string, after: string, names?: string[]) => checkMeaningPreserved(before, after, { names }).map((issue) => issue.kind);

describe("뜻 보존 관문 — 닻별", () => {
  it("숫자: 같은 수의 다른 꼴은 통과, 다른 수는 거절", () => {
    expect(kinds("늑대 송곳니 세 개를 가져와라.", "늑대 송곳니 셋을 가져와라.")).toEqual([]);
    expect(kinds("열두 명이 왔어요.", "열둘이 왔어요.")).toEqual([]);
    expect(kinds("30% 깎아 주지.", "30퍼센트 깎아 주지.")).toEqual([]);
    expect(kinds("3개를 모아라.", "4개를 모아라.")).toEqual(["number"]);
    expect(kinds("세 개를 모아라.", "몇 개 모아라.")).toEqual(["number"]);
    expect(quantityValues("한 번만 더, 하나만.")).toEqual(["1", "1"]);
    expect(kinds("여관에 가서 맥주나 한 잔 해야겠어.", "여관에 가서 맥주나 한잔해야겠어.")).toEqual([]);
    expect(quantityValues("한 장소에 모여라.")).toEqual([]);
    expect(kinds("실행 집이 넷(칩·버튼·메뉴·툴바)이다.", "칩, 버튼, 메뉴, 툴바 네 곳에서 실행한다.")).toEqual([]);
  });

  it("인용: 「」 안 이름이 빠지면 거절, 따옴표 종류만 바꾸면 통과", () => {
    expect(kinds("의뢰 「불덩이」를 받았다.", "의뢰를 받았다.")).toEqual(["quote"]);
    expect(kinds("의뢰 「불덩이」를 받았다.", "의뢰 「불덩어리」를 받았다.")).toEqual(["quote"]);
    expect(kinds("의뢰 「불덩이」를 받았다.", "\"불덩이\" 의뢰를 받았다.")).toEqual([]);
  });

  it("고유명사: DB 이름이 덜 나오면 거절, 조사가 바뀌는 것은 통과", () => {
    expect(kinds("카엘이 대장간에 갔다.", "그가 대장간에 갔다.", ["카엘"])).toEqual(["name"]);
    expect(kinds("카엘이 대장간에 갔다.", "대장간엔 카엘도 갔다.", ["카엘"])).toEqual([]);
  });

  it("유보: 아마·~지도·~것 같다가 줄면 거절", () => {
    expect(kinds("아마 내일 비가 올지도 몰라.", "내일 비가 온다.")).toEqual(["hedge"]);
    expect(kinds("비가 올 것 같아.", "비가 올 거 같네.")).toEqual([]);
    expect(kinds("세상에 지도는 없다.", "세상에 지도는 없어.")).toEqual([]);
  });

  it("부정: 안·못·없·아니 수가 바뀌면 거절, 띄어쓰기만 바뀌면 통과", () => {
    expect(kinds("안 했다.", "했다.")).toEqual(["polarity"]);
    expect(kinds("가지 마라.", "가라.")).toEqual(["polarity"]);
    expect(kinds("창은 안 판다.\n값이 아니라 이유를 가져와라.", "창은 돈으론 안 판다.\n이유를 가져와라.")).toEqual(["polarity"]);
    expect(kinds("값이 아니라 이유를 가져와라.", "값 말고 이유를 가져와라.")).toEqual([]);
    expect(kinds("그건 못 해.", "그건 못해.")).toEqual([]);
  });

  it("말투만 바꾸는 고치기는 통과", () => {
    expect(kinds("내가 했지.", "내가 했다.")).toEqual([]);
    expect(kinds("오늘은 바람이 차구나…", "오늘 바람 차네.")).toEqual([]);
    expect(kinds("어이, 거기 서라!", "거기 서.")).toEqual([]);
  });
});

describe("뜻 보존 관문 — 이름 목록과 rewrite_dialogue", () => {
  it("기본 DB 이름은 빼고 저자가 만든 이름·맵·퀘스트 제목을 센다", () => {
    const project = createBlankProject();
    project.database.actors.push({ ...project.database.actors[0]!, id: "actor_kael", name: "카엘" });
    project.maps[project.startMapId]!.name = "아스텔";
    const names = dialogueGuardNames(project);
    expect(names).toContain("카엘");
    expect(names).toContain("아스텔");
    expect(names).not.toContain("공격");
    expect(names).not.toContain("회복약");
    expect(meaningGuardNames({ quests: [{ title: "로한의 창" }] })).toEqual(["로한의 창"]);
  });

  it("뜻이 바뀐 줄은 쓰지 않고 거절 이유와 닻별 수를 돌려준다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    const say = (body: string): Command => ({ kind: "text", speaker: "로한", body } as Command);
    map.events.push({ id: "ev_rohan", name: "로한", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{
      id: "p1", name: "p1", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [say("송곳니 3개를 가져와라."), say("그럼 들어 주지.")],
    }] } as unknown as GameEvent);
    const ctx = { project };
    const lines = collectDialogueLines(project).filter((line) => line.speaker === "로한");
    const result = runTool(ctx, "rewrite_dialogue", { mode: "apply", edits: [
      { id: lines[0]!.id, hash: lines[0]!.hash, text: "송곳니 4개를 가져와라." },
      { id: lines[1]!.id, hash: lines[1]!.hash, text: "그럼 들어 주마." },
    ] });
    expect(result.ok, result.summary).toBe(true);
    const data = result.data as { rejected: { reason: string; message: string }[]; meaningGuard: { rejected: number; byKind: Record<string, number> } };
    expect(data.rejected).toHaveLength(1);
    expect(data.rejected[0]!.reason).toBe("meaning");
    expect(data.rejected[0]!.message).toContain("숫자");
    expect(data.meaningGuard.rejected).toBe(1);
    expect(data.meaningGuard.byKind.number).toBe(1);
    const after = collectDialogueLines(ctx.project).filter((line) => line.speaker === "로한").map((line) => line.text);
    expect(after).toEqual(["송곳니 3개를 가져와라.", "그럼 들어 주마."]);
  });

  it("allowMeaningChange 면 사람이 시킨 뜻 바꾸기를 받는다", () => {
    const project = createBlankProject();
    const map = project.maps[project.startMapId]!;
    map.events.push({ id: "ev_x", name: "x", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [{
      id: "p1", name: "p1", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [{ kind: "text", speaker: "상인", body: "50골드다." } as Command],
    }] } as unknown as GameEvent);
    const line = collectDialogueLines(project).find((entry) => entry.speaker === "상인")!;
    const result = runTool({ project }, "rewrite_dialogue", { mode: "apply", allowMeaningChange: true, edits: [{ id: line.id, hash: line.hash, text: "80골드다." }] });
    expect(result.ok, result.summary).toBe(true);
  });
});
