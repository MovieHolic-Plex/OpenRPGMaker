/** @vitest-environment happy-dom */
// 이벤트 편집기 보기 셋(쉬움·보통·고급)과 장면 카드 모델(목업 v2).
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { editorState } from "@/editor/editorState";
import { eventEditorViewLevel, setEventEditorViewLevel } from "@/editor/panels/eventEditor/beginnerChrome";
import { clearCommandInspector } from "@/editor/panels/eventEditor/commandInspector";
import { renderEventEditorDynamic } from "@/editor/panels/eventEditor/content";
import { FORK_THEN_BRANCH_INDEX } from "@/editor/eventCommandPaths";
import { buildSceneCards, conditionQuestion, SCENE_COMMENT_COMMAND_ID } from "@/editor/panels/eventEditor/sceneCards";
import { resetEventViewSession } from "@/editor/panels/eventEditor/storyboardView";
import { resetViewLevelHintForTest, VIEW_LEVEL_HINT_QUIET_MS, viewLevelHintFor } from "@/editor/panels/eventEditor/viewLevelHint";
import { noteViewLevelSignal, resetEventEditLineForTest } from "@/editor/panels/eventEditor/eventEditLine";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent } from "@/project/types";

const comment = (text: string): Command => ({ kind: "m2Command", commandId: SCENE_COMMENT_COMMAND_ID, fields: { comment: text, color: "green" } });
const say = (speaker: string, body: string): Command => ({ kind: "text", speaker, body });
const narrate = (body: string): Command => ({ kind: "text", body, context: "narration" });

describe("장면 카드 모델", () => {
  it("대사 줄은 얼굴 바꾸기와 함께 한 대화 카드로 묶고, 상점은 따로 카드다", () => {
    const cards = buildSceneCards([
      { kind: "changeFace", faceId: "f" } as Command,
      say("오든", "회복약이랑 약초는 여기서 사고판다."),
      { kind: "shop", itemIds: ["a"], allowSell: true, title: "오든 약재상" },
    ]);
    expect(cards.map((card) => card.kind)).toEqual(["talk", "shop"]);
    expect(cards[0]!.title).toBe("오든이 말한다");
    expect(cards[0]!.paths).toEqual([[0], [1]]);
    expect(cards[1]!.shop?.title).toBe("오든 약재상");
  });

  it("주석 명령은 카드 경계이자 이름이고, 다음 주석까지 모두 담는다", () => {
    const cards = buildSceneCards([
      comment("막을 연다"),
      { kind: "playAudio", resourceId: "se", loop: false, channel: "se" } as Command,
      narrate("쇠 장화 소리"),
      comment("마주 선다"),
      say("발렌", "넘겨라."),
      say("이리스", "싫어요."),
    ]);
    expect(cards.map((card) => [card.kind, card.title, card.commandCount])).toEqual([
      ["stage", "막을 연다", 3],
      ["talk", "마주 선다", 3],
    ]);
  });

  it("전투 뒤 전투 결과 갈림은 전투 카드 하나와 이기면·지면 갈래다", () => {
    const cards = buildSceneCards([
      { kind: "battleProcessing", troopId: "t", canEscape: false, canLose: true } as Command,
      { kind: "fork", condition: { kind: "battleResult", result: "victory" }, then: [narrate("이겼다")], else: [narrate("졌다")] } as Command,
    ]);
    expect(cards).toHaveLength(1);
    expect(cards[0]!.kind).toBe("battle");
    expect(cards[0]!.branches.map((branch) => branch.label)).toEqual(["이기면", "지면"]);
    expect(cards[0]!.branches[0]!.containerPath).toEqual([1, FORK_THEN_BRANCH_INDEX]);
  });

  it("조건 문장을 물음으로 바꾼다", () => {
    expect(conditionQuestion("「해 손잡이 당김」이 켜져 있으면")).toBe("「해 손잡이 당김」이 켜져 있나?");
    expect(conditionQuestion("전투 승리일 때")).toBe("전투 승리일 때?");
  });
});

describe("보기 셋", () => {
  const EVENT_ID = "ev_scene_levels";
  const page: EventPage = {
    id: "p1", name: "처음", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands: [say("오든", "어서 오게."), { kind: "shop", itemIds: [], allowSell: true }],
  };

  beforeEach(() => {
    localStorage.clear();
    resetEventViewSession();
    const project = createBlankProject();
    const mapId = Object.keys(project.maps)[0]!;
    const event: GameEvent = { id: EVENT_ID, name: "오든", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page] };
    project.maps[mapId]!.events.push(event);
    store.replace(project);
    editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
  });
  afterEach(() => {
    localStorage.clear();
    clearCommandInspector();
    document.body.replaceChildren();
  });

  const render = (): HTMLElement => {
    const host = document.createElement("div");
    document.body.append(host);
    renderEventEditorDynamic(host, editorState.get().currentMapId!, EVENT_ID);
    return host;
  };

  it("시험 환경의 기본은 고급(명령 목록)이고, 고른 보기는 기억한다", () => {
    expect(eventEditorViewLevel()).toBe("advanced");
    setEventEditorViewLevel("easy");
    expect(eventEditorViewLevel()).toBe("easy");
    expect(localStorage.getItem("oprn.event-editor.view")).toBe("easy");
  });

  it("쉬움은 명령 목록 대신 장면 카드를 그리고, 줄 수·카드 추가를 숨긴다", () => {
    setEventEditorViewLevel("easy");
    const host = render();
    const cards = host.querySelector<HTMLElement>('[data-testid="event-scene-cards"]');
    expect(cards?.dataset.level).toBe("easy");
    expect(cards?.querySelectorAll(".event-scene-card")).toHaveLength(2);
    expect(host.querySelector('[data-testid="event-scene-card-count"]')).toBeNull();
    expect(host.querySelector('[data-testid="event-scene-add"]')).toBeNull();
    expect(host.querySelector(".cmd-item")).toBeNull();
    expect(host.querySelector('[data-testid="event-editor-advanced-toggle"]')).toBeNull();
  });

  it("보통은 카드에 줄 수와 카드 추가를 더한다", () => {
    setEventEditorViewLevel("normal");
    const host = render();
    expect(host.querySelectorAll('[data-testid="event-scene-card-count"]')).toHaveLength(2);
    expect(host.querySelector('[data-testid="event-scene-add"]')).not.toBeNull();
  });
});

describe("막히는 신호의 보기 제안", () => {
  beforeEach(() => {
    localStorage.clear();
    resetViewLevelHintForTest();
    resetEventEditLineForTest();
  });

  it("쉬움에서 두 번 되돌림은 보통을 한 번만 제안하고, 14일 뒤 다시 제안한다", () => {
    setEventEditorViewLevel("easy");
    const now = 1_000_000;
    expect(viewLevelHintFor("undo-twice", now)).toContain("보기 › 보통");
    expect(viewLevelHintFor("undo-twice", now + 1000)).toBeNull();
    expect(viewLevelHintFor("undo-twice", now + VIEW_LEVEL_HINT_QUIET_MS + 1)).toContain("보통");
  });

  it("숨은 명령·줄 복사·Delete 는 고급을 제안하고, 이미 그 보기 이상이면 말하지 않는다", () => {
    setEventEditorViewLevel("normal");
    expect(viewLevelHintFor("undo-twice")).toBeNull();
    expect(viewLevelHintFor("hidden-command")).toContain("보기 › 고급");
    expect(viewLevelHintFor("line-delete")).toBeNull();
    setEventEditorViewLevel("advanced");
    resetViewLevelHintForTest();
    expect(viewLevelHintFor("line-copy")).toBeNull();
  });

  it("보기를 스스로 바꾸지 않고, 열린 편집기의 요약줄 자리에 한 줄로 띄운다", () => {
    setEventEditorViewLevel("easy");
    const project = createBlankProject();
    const mapId = Object.keys(project.maps)[0]!;
    const page: EventPage = {
      id: "p1", name: "처음", conditions: [], graphic: {}, trigger: { kind: "action" }, priority: "same",
      movement: { type: "fixed", speed: 3, frequency: 3 },
      commands: [say("오든", "어서 오게.")],
    };
    project.maps[mapId]!.events.push({ id: "ev_hint", name: "오든", x: 1, y: 1, trigger: { kind: "action" }, commands: [], pages: [page] });
    store.replace(project);
    editorState.set({ currentMapId: mapId, selectedEventPageId: "p1" });
    const host = document.createElement("div");
    document.body.append(host);
    renderEventEditorDynamic(host, mapId, "ev_hint");
    const card = host.querySelector<HTMLElement>(".event-scene-card")!;
    card.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
    const summary = host.querySelector<HTMLElement>('[data-testid="event-edit-line-summary"]')!;
    expect(summary.dataset.kind).toBe("hint");
    expect(summary.textContent).toContain("고급");
    expect(eventEditorViewLevel()).toBe("easy");
    expect(noteViewLevelSignal("line-copy")).toBe(false);
    document.body.replaceChildren();
    clearCommandInspector();
  });
});
