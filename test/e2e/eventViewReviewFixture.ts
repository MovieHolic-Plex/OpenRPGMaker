// 진단 스펙 두 개가 같이 쓰는 시드/열기 도우미. 스펙 파일에서 서로 import 하면 남의
// test() 까지 등록되므로, 공유분은 스펙이 아닌 이 모듈에 둔다.
import { expect, type Locator, type Page } from "@playwright/test";
import { createBlankProject, DEFAULT_ITEM_ID, DEFAULT_TROOP_ID } from "@/project/defaults";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";

function say(body: string): Command {
  return { kind: "text", speaker: "촌장", body };
}

/** 네 보기가 모두 무언가를 그릴 수밖에 없는 페이지: 분기 6종 전부 등장. */
export function branchRichPage(): EventPage {
  const commands: Command[] = [
    say("마을 창고가 털렸다네. 도와주겠나?"),
    {
      kind: "choices",
      prompt: "창고를 조사할까?",
      options: [
        { text: "조사한다", branch: [{ kind: "setSwitch", switchId: "0001", value: true }, say("좋아, 따라오게.")] },
        { text: "거절한다", branch: [say("그렇군… 마음이 바뀌면 오게.")] },
      ],
      cancelBehavior: "branch",
      cancelBranch: [say("(대답을 피했다)")],
    },
    {
      kind: "fork",
      condition: { kind: "switch", switchId: "0001", value: true },
      then: [say("자물쇠가 부서져 있다.")],
      else: [say("창고는 잠겨 있다.")],
    },
    { kind: "loop", body: [say("발자국을 따라간다…"), { kind: "wait", ms: 300 }, { kind: "breakLoop" }] },
    {
      kind: "shop",
      itemIds: [DEFAULT_ITEM_ID],
      allowSell: true,
      branchOnTransaction: true,
      transactionBranch: [say("거래 감사합니다!")],
      branchOnFailedTransaction: true,
      failedTransactionBranch: [say("돈이 모자라시군요.")],
    },
    {
      kind: "battleProcessing",
      troopId: DEFAULT_TROOP_ID,
      canEscape: true,
      canLose: true,
      branchOnResult: true,
      victoryBranch: [{ kind: "changeGold", op: "+=", amount: 200 }, say("도둑을 잡았다!")],
      defeatBranch: [say("놓쳤다…")],
      escapeBranch: [say("도둑이 달아났다.")],
    },
    { kind: "changeItem", itemId: DEFAULT_ITEM_ID, op: "+=", amount: 1 },
  ];
  return {
    id: "p1",
    name: "창고 조사",
    conditions: [],
    graphic: { sprite: { type: "bundled", id: "tex_easyrpg_charset_people1" }, direction: "down", pattern: 0 },
    trigger: { kind: "action" },
    priority: "same",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
}

export function reviewProject(): { project: Project; eventId: string } {
  const project = createBlankProject();
  project.switches = [{ id: "0001", name: "창고 조사 수락" }];
  project.characters = { "village-chief": { displayName: "촌장" } };
  const startMapId = project.startMapId;
  if (!startMapId) throw new Error("blank project has no startMapId");
  const start = project.maps[startMapId];
  if (!start) throw new Error("start map missing");
  // 표시 이름은 GameEvent 에 있지 않다 — characterId 로 project.characters 를 찾는다.
  const event: GameEvent = {
    id: "0001",
    x: 6,
    y: 6,
    trigger: { kind: "action" },
    commands: [],
    characterId: "village-chief",
    pages: [branchRichPage()],
  };
  start.events = [event];
  return { project, eventId: event.id };
}

export async function openEditor(page: Page, mapId: string, eventId: string): Promise<Locator> {
  // 브라우저 안에서 Vite 가 서빙하는 절대 경로를 import 한다. TS 가 이 경로를 모듈로
  // 해석하려 들지 않도록 문자열 변수로 넘긴다(빌드 대상이 아니라 런타임 경로다).
  await page.evaluate(async ({ activeMapId, id, modulePath }) => {
    const modalModule = await import(/* @vite-ignore */ modulePath) as {
      openEventEditorModal: (mapId: string, eventId: string) => void;
    };
    modalModule.openEventEditorModal(activeMapId, id);
  }, { activeMapId: mapId, id: eventId, modulePath: "/src/editor/panels/eventEditor/modal.ts" });
  const editor = page.getByTestId("event-editor-modal");
  await expect(editor).toBeVisible();
  return editor;
}
