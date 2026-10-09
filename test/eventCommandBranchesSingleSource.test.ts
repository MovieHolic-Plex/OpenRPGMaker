// @vitest-environment happy-dom
//
// 분기 열거의 정본이 하나임을 못박는 계약 테스트.
//
// 회귀 배경(실측 2026-08-31): 같은 일을 하는 분기 열거 함수가 다섯 벌 있었고 그중 셋이
// 상점 실패 분기(`failedTransactionBranch`)를 빠뜨렸다. 런타임(`player/interpreter/resume.ts`)
// 은 그 분기를 실행하는데 목록·플로우·미리보기에는 줄이 안 났고, 검증도 그 안으로 들어가지
// 않았다 — 화면에 없는 분기는 모르고 지워진다. 라벨도 뷰마다 갈려 같은 분기가 «참» /
// «참일 때» / «조건이 맞을 때» / «조건을 만족함» 네 이름으로 불렸다.
import { describe, expect, it } from "vitest";
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import { renderCommandList } from "@/editor/panels/eventEditor/commandList";
import { renderStoryboard } from "@/editor/panels/eventEditor/storyboardView";
import { branchesOf, simulatePageCommands } from "@/editor/panels/eventEditor/previewSimulation";
import { commandBranches } from "@/editor/tools/commandTraversal";
import type { Command } from "@/project/types";

const SUCCESS = "거래 감사합니다!";
const FAILURE = "돈이 모자라시군요.";

function shopWithBothBranches(): Command {
  return {
    kind: "shop",
    itemIds: [],
    allowSell: true,
    branchOnTransaction: true,
    transactionBranch: [{ kind: "text", body: SUCCESS }],
    branchOnFailedTransaction: true,
    failedTransactionBranch: [{ kind: "text", body: FAILURE }],
  } as Command;
}

function textOf(node: HTMLElement): string {
  return node.textContent ?? "";
}

/** 목록 뷰는 host 에 그려 넣는다. 액션은 이 테스트에서 쓰지 않으므로 빈 껍데기를 넘긴다. */
function listHostFor(commands: Command[]): HTMLElement {
  const host = document.createElement("div");
  renderCommandList(host, commands, [], {} as never);
  return host;
}

describe("상점 실패 분기는 모든 뷰에 나온다", () => {
  it("정본이 성공·실패 두 분기를 라벨과 경로 칸까지 준다", () => {
    const branches = eventCommandBranches(shopWithBothBranches());
    expect(branches.map((branch) => branch.kind)).toEqual(["shopTransaction", "shopFailure"]);
    expect(branches.map((branch) => branch.label)).toEqual(["거래했을 때", "거래하지 못했을 때"]);
    // -1 / -12 는 `eventCommandPaths` 가 정한 분기 인덱스다. 목록 뷰는 예전에 -12 를
    // import 조차 하지 않아 이 분기를 주소로 가리킬 수 없었다.
    expect(branches.map((branch) => branch.branchIndex)).toEqual([-1, -12]);
  });

  it("목록 뷰가 실패 분기 줄과 그 안의 명령을 찍는다", () => {
    const host = listHostFor([shopWithBothBranches()]);
    const text = textOf(host);
    expect(text).toContain("거래했을 때");
    expect(text).toContain(SUCCESS);
    expect(text).toContain("거래하지 못했을 때");
    expect(text).toContain(FAILURE);
    expect(host.querySelector("[data-container-path='[0,-12]']")).not.toBeNull();
  });

  it("스토리 뷰가 실패 분기를 해결 가능한 경로로 찍는다", () => {
    const host = renderStoryboard([shopWithBothBranches()]);
    expect(textOf(host)).toContain(FAILURE);
    expect(host.querySelector<HTMLElement>("[data-cmd-path='[0,-12,0]']")?.textContent).toContain(FAILURE);
  });

  it("미리보기 스텝에 실패 분기 대사가 들어간다", () => {
    const steps = simulatePageCommands([shopWithBothBranches()]).steps;
    const bodies = steps.map((step) => (step.command.kind === "text" ? step.command.body : ""));
    expect(bodies).toContain(SUCCESS);
    expect(bodies).toContain(FAILURE);
    const failureStep = steps.find((step) => step.command.kind === "text" && step.command.body === FAILURE);
    expect(failureStep?.branchLabel).toBe("거래하지 못했을 때");
  });

  it("플로우가 쓰는 어댑터와 프로젝트 순회 어댑터도 두 분기를 본다", () => {
    expect(branchesOf(shopWithBothBranches()).map((branch) => branch.label))
      .toEqual(["거래했을 때", "거래하지 못했을 때"]);
    expect(commandBranches(shopWithBothBranches()).map((branch) => branch.kind))
      .toEqual(["shopTransaction", "shopFailure"]);
  });
});

describe("분기 라벨은 뷰마다 갈리지 않는다", () => {
  const fork: Command = {
    kind: "fork",
    condition: { kind: "switch", switchId: "0001", value: true },
    then: [{ kind: "text", body: "참 쪽" }],
    else: [{ kind: "text", body: "거짓 쪽" }],
  };

  it("조건 분기는 네 뷰 모두 같은 이름을 쓴다", () => {
    const canonical = eventCommandBranches(fork).map((branch) => branch.label);
    expect(canonical).toEqual(["조건이 맞을 때", "조건이 맞지 않을 때"]);

    // 플로우 어댑터
    expect(branchesOf(fork).map((branch) => branch.label)).toEqual(canonical);
    // 목록 뷰
    const list = textOf(listHostFor([fork]));
    for (const label of canonical) expect(list).toContain(label);
    // 스토리 뷰
    const storyboard = textOf(renderStoryboard([fork]));
    for (const label of canonical) expect(storyboard).toContain(label);
    // 미리보기 스텝 라벨
    const labels = simulatePageCommands([fork]).steps.map((step) => step.branchLabel).filter(Boolean);
    expect(new Set(labels)).toEqual(new Set(canonical));
  });

  it("빈 배열도 저작 대상이라 분기로 센다", () => {
    // `commandBranches` 로 빈 분기를 찾아 명령을 밀어 넣는 호출부가 있다(AI 병합 경로).
    const emptyShop = { kind: "shop", itemIds: [], failedTransactionBranch: [] } as Command;
    expect(eventCommandBranches(emptyShop).map((branch) => branch.kind)).toEqual(["shopFailure"]);
  });
});
