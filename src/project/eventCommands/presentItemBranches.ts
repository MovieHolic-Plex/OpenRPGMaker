// presentItem(아이템 제시) 명령의 하위 명령 배열들.
// 명령 트리를 도는 곳마다 option·otherwise·cancel 세 갈래를 손으로 적으면 하나씩 빠진다
// (choices 의 cancelBranch 가 그렇게 빠진 전례가 있다). 순회는 lists, 재작성은 map 을 쓴다.
import type { Command } from "@/project/types";

type PresentItemCommand = Extract<Command, { kind: "presentItem" }>;

/** 실행 순서와 무관한 모든 하위 명령 배열(정답 option → 틀림 → 닫음). */
export function presentItemBranchLists(command: PresentItemCommand): Command[][] {
  return [
    ...command.options.map((option) => option.branch),
    command.otherwiseBranch ?? [],
    command.cancelBranch ?? [],
  ];
}

/** 하위 명령 배열을 모두 바꾼 사본. 없던 선택 분기는 없는 채로 둔다. */
export function mapPresentItemBranches(
  command: PresentItemCommand,
  rewrite: (commands: Command[]) => Command[],
): PresentItemCommand {
  return {
    ...command,
    options: command.options.map((option) => ({ ...option, branch: rewrite(option.branch) })),
    ...(command.otherwiseBranch ? { otherwiseBranch: rewrite(command.otherwiseBranch) } : {}),
    ...(command.cancelBranch ? { cancelBranch: rewrite(command.cancelBranch) } : {}),
  };
}
