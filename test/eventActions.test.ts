// test/eventActions.test.ts
// 이벤트 명령 경로 탐색/조작 로직 검증(순수).

import { beforeEach, describe, expect, it } from "vitest";
import { addCommand, addEvent, getCommand, replaceCommand } from "@/editor/eventActions";
import {
  addEventPageCommandAt,
  replaceEventPageCommandAt,
} from "@/editor/eventPages";
import {
  CHOICE_CANCEL_BRANCH_INDEX,
  FORK_ELSE_BRANCH_INDEX,
  FORK_THEN_BRANCH_INDEX,
  LOOP_BODY_BRANCH_INDEX,
  SHOP_TRANSACTION_BRANCH_INDEX,
  resolveCommandAtPath,
  resolveCommandListAtPath,
  resolveRootCommandBranchList,
} from "@/editor/eventCommandPaths";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import type { Command, EventPage, GameEvent, MapId } from "@/project/types";

type TextCommand = Extract<Command, { kind: "text" }>;
type SetFlagCommand = Extract<Command, { kind: "setFlag" }>;

function expectTextCommand(command: Command | null): TextCommand {
  if (command?.kind === "text") return command;
  const actual = command?.kind ?? "null";
  throw new Error(`expected command text, got ${actual}`);
}

function expectSetFlagCommand(command: Command | null): SetFlagCommand {
  if (command?.kind === "setFlag") return command;
  const actual = command?.kind ?? "null";
  throw new Error(`expected command setFlag, got ${actual}`);
}

describe("명령 경로 탐색", () => {
  it("루트 명령을 찾는다", () => {
    const cmds: Command[] = [
      { kind: "text", body: "A" },
      { kind: "text", body: "B" },
    ];
    expect(resolveCommandAtPath(cmds, [0])?.kind).toBe("text");
    expect(expectTextCommand(resolveCommandAtPath(cmds, [1])).body).toBe("B");
  });

  it("choices의 branch 안으로 들어간다", () => {
    const cmds: Command[] = [
      {
        kind: "choices",
        prompt: "p",
        options: [
          {
            text: "o1",
            branch: [
              { kind: "text", body: "inside1" },
              { kind: "setFlag", flag: "f", value: true },
            ],
          },
          { text: "o2", branch: [{ kind: "text", body: "inside2" }] },
        ],
      },
    ];
    // path [0, 0, 0] = choices[0].options[0].branch[0]
    expect(expectTextCommand(resolveCommandAtPath(cmds, [0, 0, 0])).body).toBe("inside1");
    expect(expectSetFlagCommand(resolveCommandAtPath(cmds, [0, 0, 1])).flag).toBe("f");
    expect(expectTextCommand(resolveCommandAtPath(cmds, [0, 1, 0])).body).toBe("inside2");
  });

  it("choices가 아닌 곳에서 branch 진입 시 null", () => {
    const cmds: Command[] = [{ kind: "text", body: "x" }];
    expect(resolveCommandAtPath(cmds, [0, 0, 0])).toBeNull();
  });

  it("존재하지 않는 인덱스는 null", () => {
    const cmds: Command[] = [{ kind: "text", body: "x" }];
    expect(resolveCommandAtPath(cmds, [5])).toBeNull();
  });
});

describe("중첩 choices (깊은 재귀)", () => {
  it("choices 안의 choices 안의 명령까지 찾는다", () => {
    const cmds: Command[] = [
      {
        kind: "choices",
        options: [
          {
            text: "a",
            branch: [
              {
                kind: "choices",
                options: [
                  {
                    text: "a1",
                    branch: [{ kind: "text", body: "deep" }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ];
    // path: choices[0].opt0.branch[0] = 또 choices → 그 choices.opt0.branch[0]
    // [0,0,0, 0,0] = choices0 → opt0 → branch[0](choices) → opt0 → branch[0]
    expect(expectTextCommand(resolveCommandAtPath(cmds, [0, 0, 0, 0, 0])).body).toBe("deep");
  });
});

describe("shared nested command path resolver", () => {
  it("resolves choices cancel branches, fork branches, loop bodies, and shop transaction branches", () => {
    const commands: Command[] = [
      {
        kind: "choices",
        options: [{ text: "go", branch: [{ kind: "text", body: "choice" }] }],
        cancelBehavior: "branch",
        cancelBranch: [{ kind: "text", body: "cancel" }],
      },
      {
        kind: "fork",
        condition: { kind: "switch", switchId: "sw_a", value: true },
        then: [{ kind: "text", body: "then" }],
        else: [{ kind: "text", body: "else" }],
      },
      { kind: "loop", body: [{ kind: "text", body: "loop" }] },
      { kind: "shop", itemIds: [], transactionBranch: [{ kind: "text", body: "shop" }] },
    ];

    expect(expectTextCommand(resolveCommandAtPath(commands, [0, CHOICE_CANCEL_BRANCH_INDEX, 0])).body).toBe("cancel");
    expect(expectTextCommand(resolveCommandAtPath(commands, [1, FORK_THEN_BRANCH_INDEX, 0])).body).toBe("then");
    expect(expectTextCommand(resolveCommandAtPath(commands, [1, FORK_ELSE_BRANCH_INDEX, 0])).body).toBe("else");
    expect(expectTextCommand(resolveCommandAtPath(commands, [2, LOOP_BODY_BRANCH_INDEX, 0])).body).toBe("loop");
    expect(expectTextCommand(resolveCommandAtPath(commands, [3, SHOP_TRANSACTION_BRANCH_INDEX, 0])).body).toBe("shop");
  });

  it("creates optional editable branches only when requested", () => {
    const commands: Command[] = [
      {
        kind: "fork",
        condition: { kind: "switch", switchId: "sw_b", value: true },
        then: [],
      },
      { kind: "shop", itemIds: [] },
    ];

    expect(resolveCommandListAtPath(commands, [0, FORK_ELSE_BRANCH_INDEX])).toBeNull();
    expect(resolveCommandListAtPath(commands, [1, SHOP_TRANSACTION_BRANCH_INDEX])).toBeNull();

    const forkElse = resolveCommandListAtPath(commands, [0, FORK_ELSE_BRANCH_INDEX], { missingBranches: "create" });
    const shopTransaction = resolveCommandListAtPath(commands, [1, SHOP_TRANSACTION_BRANCH_INDEX], { missingBranches: "create" });
    forkElse?.push({ kind: "text", body: "created else" });
    shopTransaction?.push({ kind: "text", body: "created shop" });

    expect(expectTextCommand(resolveCommandAtPath(commands, [0, FORK_ELSE_BRANCH_INDEX, 0])).body).toBe("created else");
    expect(expectTextCommand(resolveCommandAtPath(commands, [1, SHOP_TRANSACTION_BRANCH_INDEX, 0])).body).toBe("created shop");
  });

  it("returns null for invalid branches consistently", () => {
    const commands: Command[] = [{ kind: "text", body: "plain" }];

    expect(resolveCommandListAtPath(commands, [0, FORK_THEN_BRANCH_INDEX])).toBeNull();
    expect(resolveCommandAtPath(commands, [0, SHOP_TRANSACTION_BRANCH_INDEX, 0])).toBeNull();
    expect(resolveRootCommandBranchList(commands[0], [CHOICE_CANCEL_BRANCH_INDEX], { missingBranches: "create" })).toBeNull();
  });
});

describe("shared command resolver consumers", () => {
  let mapId: MapId;
  let eventId: string;
  let pageId: string;

  beforeEach(() => {
    store.replace(createBlankProject());
    mapId = store.getCurrent().startMapId;
    eventId = addEvent(mapId, 1, 1);
    pageId = currentEventPage().id;
  });

  function currentEvent(): GameEvent {
    const event = store.getCurrent().maps[mapId]?.events.find((item) => item.id === eventId);
    if (!event) throw new Error("missing test event");
    return event;
  }

  function currentEventPage(): EventPage {
    const page = currentEvent().pages?.find((item) => item.id === pageId) ?? currentEvent().pages?.[0];
    if (!page) throw new Error("missing test event page");
    return page;
  }

  it("direct event actions use fork, loop, and shop branch paths", () => {
    addCommand(mapId, eventId, [], {
      kind: "fork",
      condition: { kind: "switch", switchId: "sw_direct", value: true },
      then: [],
    });
    addCommand(mapId, eventId, [0, FORK_ELSE_BRANCH_INDEX], { kind: "text", body: "direct else" });
    replaceCommand(mapId, eventId, [0, FORK_ELSE_BRANCH_INDEX, 0], { kind: "loop", body: [] });
    addCommand(mapId, eventId, [0, FORK_ELSE_BRANCH_INDEX, 0, LOOP_BODY_BRANCH_INDEX], { kind: "text", body: "direct loop" });

    expect(expectTextCommand(getCommand(currentEvent(), [0, FORK_ELSE_BRANCH_INDEX, 0, LOOP_BODY_BRANCH_INDEX, 0])).body).toBe("direct loop");
  });

  it("event pages create shop transaction branches the same way staging does", () => {
    const shopCommand: Command = { kind: "shop", itemIds: [] };
    replaceEventPageCommandAt(mapId, eventId, pageId, [0], shopCommand);
    addEventPageCommandAt(mapId, eventId, pageId, [0, SHOP_TRANSACTION_BRANCH_INDEX], { kind: "text", body: "persisted shop" });

    const persisted = currentEventPage().commands[0];
    const staged = structuredClone(shopCommand);
    resolveRootCommandBranchList(staged, [SHOP_TRANSACTION_BRANCH_INDEX], { missingBranches: "create" })?.push({
      kind: "text",
      body: "staged shop",
    });

    expect(persisted?.kind).toBe("shop");
    if (persisted?.kind !== "shop") throw new Error("expected persisted shop command");
    expect(expectTextCommand(persisted.transactionBranch?.[0] ?? null).body).toBe("persisted shop");
    expect(expectTextCommand(staged.transactionBranch?.[0] ?? null).body).toBe("staged shop");
  });

  it("creates missing shop transaction branches through the shared resolver for page edits", () => {
    replaceEventPageCommandAt(mapId, eventId, pageId, [0], { kind: "shop", itemIds: [], branchOnTransaction: true });

    addEventPageCommandAt(mapId, eventId, pageId, [0, SHOP_TRANSACTION_BRANCH_INDEX], {
      kind: "text",
      body: "created persisted branch",
    });

    const persisted = currentEventPage().commands[0];
    expect(persisted?.kind).toBe("shop");
    if (persisted?.kind !== "shop") throw new Error("expected persisted shop command");
    expect(expectTextCommand(persisted.transactionBranch?.[0] ?? null).body).toBe("created persisted branch");
  });

  it("keeps canceled staged shop branch edits isolated from the initial command", () => {
    const initial: Command = { kind: "shop", itemIds: [], branchOnTransaction: true };
    const staged = structuredClone(initial);

    resolveRootCommandBranchList(staged, [SHOP_TRANSACTION_BRANCH_INDEX], { missingBranches: "create" })?.push({
      kind: "text",
      body: "staged only",
    });

    expect(initial).toEqual({ kind: "shop", itemIds: [], branchOnTransaction: true });
    expect(staged.kind).toBe("shop");
    if (staged.kind !== "shop") throw new Error("expected staged shop command");
    expect(expectTextCommand(staged.transactionBranch?.[0] ?? null).body).toBe("staged only");
  });
});
