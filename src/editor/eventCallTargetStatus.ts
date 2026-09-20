// 맵 위 이벤트 부르기(callMapEvent) 대상 판정 — 검증·툴팁이 같은 정본을 나눠 쓴다.
//
// 실측 결함 (2026-09-20, 웹 워크스페이스): AI 마을 시공이 만든 집 문 본체 12채의
// 페이지 명령이 전부 비어 있었고, 호출될 실내 맵도 사라져 있었다. 런타임은 이런
// 호출을 조용히 건너뛰므로 발판을 밟아도 아무 일 없이 지나갔다. 조용한 무시를 끊기
// 위해 호출부 명령 행과 호출 대상 이벤트 양쪽에서 같은 판정을 경고로 보인다.
import { eventCommandBranches } from "@/editor/eventCommandBranches";
import type { Command, Condition, GameEvent, Project } from "@/project/types";

export type CallTargetProblem =
  | { readonly kind: "page-command-empty"; readonly message: string }
  | { readonly kind: "page-no-op"; readonly message: string }
  | { readonly kind: "transfer-target-missing"; readonly message: string };

/** 런타임 페이지 조건 평가의 에디터 쪽 보수적 근사 — 게임 세션 상태가 없다. */
function pageConditionLikelySatisfied(_condition: Condition): boolean {
  // 세션·시간·로케이션에 따라 달라지는 조건은 거짓이라 단정할 수 없다. 조건을
  // 좁게 깎으면 살아있는 문을 죽은 문으로 오판하고, 진짜 경고가 가짜에 묻힌다.
  return true;
}

/** 호출될 가능성이 있는 첫 페이지의 명령. 런타임은 뒤쪽 페이지를 우선한다. */
function callablePageCommands(event: GameEvent): readonly Command[] {
  const pages = event.pages ?? [];
  if (pages.length === 0) return event.commands ?? [];
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    const page = pages[index]!;
    if ((page.conditions ?? []).every(pageConditionLikelySatisfied)) return page.commands ?? [];
  }
  return [];
}

/** 깨진 transfer 목적지를 찾는다. 분기 열거는 eventCommandBranches 정본을 따른다. */
function transferMapIdMissing(project: Project, commands: readonly Command[]): string | undefined {
  for (const command of commands) {
    if (command.kind === "transfer" && !project.maps[command.mapId]) {
      return command.mapId;
    }
    const nested = eventCommandBranches(command)
      .map((branch) => transferMapIdMissing(project, branch.commands))
      .find((missing): missing is string => missing !== undefined);
    if (nested) return nested;
  }
  return undefined;
}

function commandHasVisibleEffect(command: Command): boolean {
  if (command.kind === "label" || command.kind === "breakLoop") return false;
  if (command.kind === "text") return command.body.trim().length > 0;
  if (command.kind === "loop") return command.body.some(commandHasVisibleEffect);
  if (command.kind === "fork") {
    return command.then.some(commandHasVisibleEffect) || (command.else?.some(commandHasVisibleEffect) ?? false);
  }
  return true;
}

/**
 * 이 호출이 런타임에서 효과를 내는가를 판정한다.
 *
 * 셋째 반환값(transferMapId)은 깨진 전이 목적지다. 대상 이벤트에 명령은 있지만 그
 * 안의 맵 이동이 사라진 맵을 가리킬 때, 호출부 경고가 어디를 고쳐야 하는지 정확히
 * 말할 수 있게 별도로 넘긴다.
 */
export function callMapEventTargetStatus(
  project: Project,
  target: GameEvent | undefined,
): { readonly callable: boolean; readonly problem?: CallTargetProblem; readonly transferMapId?: string } {
  if (!target) return { callable: true };
  const commands = callablePageCommands(target);
  if (commands.length === 0) {
    return {
      callable: false,
      problem: {
        kind: "page-command-empty",
        message: "호출 대상 이벤트의 실행할 명령이 없습니다. 이 호출은 게임에서 아무 효과가 없습니다.",
      },
    };
  }
  if (!commands.some(commandHasVisibleEffect)) {
    return {
      callable: false,
      problem: {
        kind: "page-no-op",
        message: "호출 대상 이벤트의 명령은 실행 결과를 만들지 않습니다. 이 호출은 게임에서 아무 효과가 없습니다.",
      },
    };
  }
  const transferMapId = transferMapIdMissing(project, commands);
  if (transferMapId) {
    return {
      callable: true,
      transferMapId,
      problem: {
        kind: "transfer-target-missing",
        message: "호출 대상 이벤트가 사라진 맵(" + transferMapId + ")으로 이동하려 합니다.",
      },
    };
  }
  return { callable: true };
}
